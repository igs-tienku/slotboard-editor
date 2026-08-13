import assert from "node:assert/strict";
import test from "node:test";
import { addLayer, addScene, createProject, importSceneTemplate, replaceLayerWithImage } from "../lib/editor-model.js";
import { createProjectPackage, createTemplatePackage, openProjectPackage, openTemplatePackage } from "../lib/project-package.js";

test("slotboard package round-trips 30 scenes and embedded assets", () => {
  let project = createProject("完整測試");
  while (project.sceneOrder.length < 30) project = addScene(project).project;
  const sceneId = project.sceneOrder[0];
  project = addLayer(project, sceneId, "ellipse");
  const layerId = project.scenes[sceneId].layers[0].id;
  project = replaceLayerWithImage(project, sceneId, layerId, { id: "asset_a", name: "a.png", mimeType: "image/png", byteLength: 3, width: 1, height: 1, dataUrl: "data:image/png;base64,AQID" });
  const packaged = createProjectPackage(project);
  assert.match(packaged.fileName, /\.slotboard$/);
  const restored = openProjectPackage(packaged.bytes);
  assert.equal(restored.sceneOrder.length, 30);
  assert.equal(restored.assets.asset_a.dataUrl, "data:image/png;base64,AQID");
  assert.equal(restored.scenes[sceneId].layers[0].assetId, "asset_a");
});

test("slottemplate imports a scene with fresh ids", () => {
  const source = createProject("來源");
  const sourceSceneId = source.sceneOrder[0];
  const packaged = createTemplatePackage(source, sourceSceneId);
  assert.match(packaged.fileName, /\.slottemplate$/);
  const template = openTemplatePackage(packaged.bytes);
  const target = createProject("目標");
  const imported = importSceneTemplate(target, template);
  assert.equal(imported.project.sceneOrder.length, 2);
  assert.notEqual(imported.sceneId, sourceSceneId);
  assert.match(imported.project.scenes[imported.sceneId].name, /模板/);
});

test("corrupt packages are rejected without changing a project", () => {
  const before = createProject();
  assert.throws(() => openProjectPackage(new Uint8Array([1, 2, 3, 4])));
  assert.equal(before.sceneOrder.length, 1);
});
