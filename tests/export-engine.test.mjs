import assert from "node:assert/strict";
import test from "node:test";
import { addScene, createProject, renameScene } from "../lib/editor-model.js";
import { buildSceneFileNames, sanitizeExportName } from "../lib/export-engine.js";

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
