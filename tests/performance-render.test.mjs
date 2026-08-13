import assert from "node:assert/strict";
import test from "node:test";
import { createCanvas, Image } from "@napi-rs/canvas";
import * as agPsd from "ag-psd";
import { addLayer, addScene, createProject } from "../lib/editor-model.js";
import { createProjectPdf, createPsdZip, estimateExportWorkingSet, renderSceneCanvas } from "../lib/export-engine.js";

globalThis.document = { createElement: (name) => {
  if (name !== "canvas") throw new Error(`Unexpected element: ${name}`);
  return createCanvas(1, 1);
} };
globalThis.Image = Image;
globalThis.agPsd = agPsd;
agPsd.initializeCanvas((width, height) => createCanvas(width, height));

function makeProject(sceneCount, layersPerScene) {
  let project = createProject("render benchmark", { width: 320, height: 320 }, "blank");
  while (project.sceneOrder.length < sceneCount) project = addScene(project, undefined, { size: { width: 320, height: 320 }, template: "blank" }).project;
  for (const sceneId of project.sceneOrder) for (let index = 0; index < layersPerScene; index += 1) project = addLayer(project, sceneId, index % 2 ? "ellipse" : "rectangle");
  return project;
}

test("real canvas rendering, batch PSD and PDF stay within the M15 budget", { timeout: 30000 }, async () => {
  const renderProject = makeProject(8, 50);
  const renderStarted = performance.now();
  for (const sceneId of renderProject.sceneOrder) await renderSceneCanvas(renderProject, sceneId, true);
  const renderMs = performance.now() - renderStarted;
  assert.ok(renderMs < 8000, `8 × 50-layer Scene render took ${Math.round(renderMs)}ms`);

  const exportProject = makeProject(3, 18);
  const estimate = estimateExportWorkingSet(exportProject);
  assert.equal(estimate.totalLayers, 57);
  assert.ok(estimate.psdPeakBytes < 4 * 1024 * 1024, "sequential PSD estimate should not multiply by layer count");

  const psdStarted = performance.now(), zip = await createPsdZip(exportProject), psdMs = performance.now() - psdStarted;
  assert.ok(zip.length > 1000);
  assert.ok(psdMs < 15000, `3-Scene PSD ZIP took ${Math.round(psdMs)}ms`);

  const pdfStarted = performance.now(), pdf = await createProjectPdf(exportProject), pdfMs = performance.now() - pdfStarted;
  assert.ok(pdf.length > 1000);
  assert.ok(pdfMs < 10000, `3-Scene PDF took ${Math.round(pdfMs)}ms`);
});
