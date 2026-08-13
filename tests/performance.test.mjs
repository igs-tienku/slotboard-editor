import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import test from "node:test";
import { addScene, createProject, createShapeLayer, deserializeProject, serializeProject } from "../lib/editor-model.js";

test("50 scenes × 100 layers serialize and reload within the M6 budget", () => {
  let project = createProject("M6 壓力測試");
  while (project.sceneOrder.length < 50) project = addScene(project, `Scene ${project.sceneOrder.length + 1}`).project;
  project.sceneOrder.forEach((sceneId, sceneIndex) => {
    project.scenes[sceneId].layers = Array.from({ length: 100 }, (_, layerIndex) => createShapeLayer("rectangle", layerIndex + 1, {
      transform: { x: (layerIndex % 10) * 82, y: Math.floor(layerIndex / 10) * 48, width: 72, height: 38, rotation: sceneIndex % 8, flipX: false, flipY: false },
    }));
  });

  const started = performance.now();
  const serialized = serializeProject(project);
  const restored = deserializeProject(serialized);
  const elapsed = performance.now() - started;
  const layerCount = restored.sceneOrder.reduce((count, id) => count + restored.scenes[id].layers.length, 0);

  assert.equal(restored.sceneOrder.length, 50);
  assert.equal(layerCount, 5000);
  assert.ok(elapsed < 3000, `serialize/reload took ${elapsed.toFixed(1)} ms`);
});
