import assert from "node:assert/strict";
import test from "node:test";
import { addScene, createProject, renameScene } from "../lib/editor-model.js";
import { buildSceneFileNames, psdLayerSequence, sanitizeExportName } from "../lib/export-engine.js";

test("export filenames are ordered, Windows-safe and collision-free", () => {
  let project = createProject();
  const first = project.sceneOrder[0];
  project = renameScene(project, first, "MG:開始?");
  const second = addScene(project, "MG:開始?"); project = second.project;
  const names = buildSceneFileNames(project);
  assert.equal(names[0].base, "01_MG_開始_");
  assert.equal(names[1].base, "02_MG_開始_");
  assert.equal(sanitizeExportName("A/B\\C"), "A_B_C");
});

test("PSD order preserves artwork order while forcing full-canvas background to the bottom", () => {
  const transform = { x: 0, y: 0, width: 960, height: 540 };
  const editorLayers = [{ name: "Foreground", transform }, { name: "背景", transform }, { name: "Content", transform }];
  assert.deepEqual(psdLayerSequence(editorLayers, { width: 960, height: 540 }).map((layer) => layer.name), ["Foreground", "Content", "背景"]);
});
