import assert from "node:assert/strict";
import test from "node:test";
import { createCanvas, Image } from "@napi-rs/canvas";
import * as agPsd from "ag-psd";
import { addReelGridLayer, addSymbol, assignReelSymbol, createProject, createShapeLayer, replaceSymbolImage } from "../lib/editor-model.js";
import { createScenePsd, renderSceneCanvas } from "../lib/export-engine.js";

globalThis.document = { createElement: (name) => {
  if (name !== "canvas") throw new Error(`Unexpected element: ${name}`);
  return createCanvas(1, 1);
} };
globalThis.Image = Image;
globalThis.agPsd = agPsd;
agPsd.initializeCanvas((width, height) => createCanvas(width, height));

function findLayer(layers, name) {
  for (const layer of layers ?? []) {
    if (layer.name === name) return layer;
    const nested = findLayer(layer.children, name);
    if (nested) return nested;
  }
  return null;
}

function alphaBounds(imageData) {
  let left = imageData.width, top = imageData.height, right = -1, bottom = -1, maxAlpha = 0;
  for (let y = 0; y < imageData.height; y += 1) for (let x = 0; x < imageData.width; x += 1) {
    const alpha = imageData.data[(y * imageData.width + x) * 4 + 3];
    maxAlpha = Math.max(maxAlpha, alpha);
    if (alpha > 0) { left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y); }
  }
  return { left, top, right, bottom, maxAlpha };
}

test("real Scene PSD preserves transformed group pixels, opacity and background order", async () => {
  const project = createProject("PSD Scene regression"), sceneId = project.sceneOrder[0], scene = project.scenes[sceneId];
  const child = createShapeLayer("rectangle", 1, {
    id: "child_shape", name: "群組內物件", opacity: 0.5, fill: "#eeeeee", stroke: "#333333",
    transform: { x: 34, y: 28, width: 120, height: 74, rotation: 13, flipX: false, flipY: true },
  });
  const group = {
    id: "group_regression", type: "group", name: "移動旋轉群組", visible: true, locked: false, opacity: 0.6, opened: true,
    transform: { x: 280, y: 150, width: 240, height: 160, rotation: 90, flipX: true, flipY: false },
    children: [child],
  };
  const background = scene.layers.find((layer) => layer.name === "背景");
  scene.layers = [group, background];

  const isolated = structuredClone(project);
  isolated.scenes[sceneId].layers = [structuredClone(group)];
  const expectedCanvas = await renderSceneCanvas(isolated, sceneId, true);
  const expectedBounds = alphaBounds(expectedCanvas.getContext("2d").getImageData(0, 0, scene.width, scene.height));

  const bytes = await createScenePsd(project, sceneId);
  const parsed = agPsd.readPsd(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), {
    skipThumbnail: true, skipCompositeImageData: true, useImageData: true,
  });
  // ag-psd reads its written record order back unchanged; Krita displays that
  // order in reverse, so the background must be first in the writer input.
  assert.deepEqual(parsed.children.map((layer) => layer.name), ["背景", "移動旋轉群組"]);
  const parsedGroup = findLayer(parsed.children, "移動旋轉群組"), parsedChild = findLayer(parsed.children, "群組內物件");
  assert.ok(parsedGroup && parsedChild?.imageData);
  assert.ok(Math.abs(parsedGroup.opacity - 0.6) < 0.01);
  assert.ok(Math.abs(parsedChild.opacity - 0.5) < 0.01);
  const actualBounds = alphaBounds(parsedChild.imageData);
  assert.deepEqual(
    { left: parsedChild.left + actualBounds.left, top: parsedChild.top + actualBounds.top, right: parsedChild.left + actualBounds.right, bottom: parsedChild.top + actualBounds.bottom },
    { left: expectedBounds.left, top: expectedBounds.top, right: expectedBounds.right, bottom: expectedBounds.bottom },
  );
  assert.equal(actualBounds.maxAlpha, 255, "leaf opacity must stay in the PSD property, not be baked into pixels");
  assert.ok(parsedChild.imageData.width < scene.width && parsedChild.imageData.height < scene.height, "transparent PSD margins should be cropped");
});

test("project Symbol images render inside Reel Grid pixels in the exported PSD", async () => {
  let project = createProject("Symbol image regression");
  const sceneId = project.sceneOrder[0];
  const symbolResult = addSymbol(project, "Wild"); project = symbolResult.project;
  const source = createCanvas(4, 4), sourceContext = source.getContext("2d");
  sourceContext.fillStyle = "#ef321e"; sourceContext.fillRect(0, 0, 4, 4);
  const dataUrl = source.toDataURL("image/png");
  project = replaceSymbolImage(project, symbolResult.symbolId, {
    id: "asset_symbol_red", name: "wild-red.png", mimeType: "image/png", byteLength: dataUrl.length, width: 4, height: 4, dataUrl,
  });
  project = addReelGridLayer(project, sceneId, [1]);
  const grid = project.scenes[sceneId].layers[0];
  project = assignReelSymbol(project, sceneId, grid.id, 0, 0, symbolResult.symbolId);

  const bytes = await createScenePsd(project, sceneId);
  const parsed = agPsd.readPsd(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), {
    skipThumbnail: true, skipCompositeImageData: true, useImageData: true,
  });
  const parsedGrid = findLayer(parsed.children, grid.name);
  assert.ok(parsedGrid?.imageData);
  const x = Math.round(grid.transform.x + grid.transform.width / 2 - parsedGrid.left);
  const y = Math.round(grid.transform.y + grid.transform.height / 2 - parsedGrid.top);
  const offset = (y * parsedGrid.imageData.width + x) * 4;
  const pixel = parsedGrid.imageData.data.slice(offset, offset + 4);
  assert.ok(pixel[0] > 220 && pixel[1] < 80 && pixel[2] < 80 && pixel[3] > 240, `expected red Symbol pixel, got ${[...pixel]}`);
});

test("Scene PSD renders with an OffscreenCanvas-style worker surface", async () => {
  const originalDocument = globalThis.document, originalOffscreenCanvas = globalThis.OffscreenCanvas;
  try {
    delete globalThis.document;
    globalThis.OffscreenCanvas = class { constructor(width, height) { return createCanvas(width, height); } };
    const project = createProject("Worker surface"), sceneId = project.sceneOrder[0];
    const bytes = await createScenePsd(project, sceneId);
    const parsed = agPsd.readPsd(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), { skipThumbnail: true, skipCompositeImageData: true, useImageData: true });
    assert.equal(parsed.width, project.scenes[sceneId].width);
    assert.equal(parsed.children.at(0).name, "背景");
  } finally {
    globalThis.document = originalDocument;
    globalThis.OffscreenCanvas = originalOffscreenCanvas;
  }
});
