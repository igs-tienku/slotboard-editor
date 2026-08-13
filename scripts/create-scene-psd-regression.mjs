import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCanvas, Image } from "@napi-rs/canvas";
import * as agPsd from "ag-psd";
import { createProject, createShapeLayer } from "../lib/editor-model.js";
import { createScenePsd, renderSceneCanvas } from "../lib/export-engine.js";

globalThis.document = { createElement: () => createCanvas(1, 1) };
globalThis.Image = Image;
globalThis.agPsd = agPsd;
agPsd.initializeCanvas((width, height) => createCanvas(width, height));

const project = createProject("PSD group regression"), sceneId = project.sceneOrder[0], scene = project.scenes[sceneId];
const background = scene.layers.find((layer) => layer.name === "背景");
const childA = createShapeLayer("ellipse", 1, { name: "群組圓形", fill: "#eeeeea", transform: { x: 20, y: 15, width: 190, height: 110, rotation: 12, flipX: false, flipY: false } });
const childB = createShapeLayer("triangle", 1, { name: "群組三角形", fill: "#b8b9b3", opacity: .72, transform: { x: 135, y: 75, width: 150, height: 125, rotation: -18, flipX: true, flipY: false } });
scene.layers = [{
  id: "group_regression", type: "group", name: "位移旋轉群組", visible: true, locked: false, opacity: .82, opened: true,
  transform: { x: 310, y: 145, width: 330, height: 220, rotation: 28, flipX: false, flipY: true }, children: [childB, childA],
}, background];

const output = resolve("artifacts", "psd-regression");
await mkdir(output, { recursive: true });
const expected = await renderSceneCanvas(project, sceneId, true);
await writeFile(resolve(output, "expected-editor-render.png"), expected.toBuffer("image/png"));
await writeFile(resolve(output, "group-transform-regression.psd"), await createScenePsd(project, sceneId));
console.log(output);
