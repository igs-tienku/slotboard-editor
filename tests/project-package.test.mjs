import assert from "node:assert/strict";
import test from "node:test";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
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
  const files = unzipSync(packaged.bytes);
  const manifest = JSON.parse(strFromU8(files["manifest.json"]));
  assert.equal(manifest.toolVersion, "0.16.1");
  assert.match(manifest.contentHashes["project.json"], /^fnv1a32:/);
  assert.match(manifest.assets[0].hash, /^fnv1a32:/);
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

test("package content hashes reject modified project JSON", () => {
  const packaged = createProjectPackage(createProject("完整性"));
  const files = unzipSync(packaged.bytes);
  files["project.json"] = strToU8(`${strFromU8(files["project.json"])} `);
  assert.throws(() => openProjectPackage(zipSync(files)), /integrity/i);
});

test("asset hashes reject same-length image corruption", () => {
  let project = createProject("素材完整性");
  const sceneId = project.sceneOrder[0], layerId = project.scenes[sceneId].layers[0].id;
  project = replaceLayerWithImage(project, sceneId, layerId, { id: "asset_hash", name: "hash.png", mimeType: "image/png", byteLength: 3, width: 1, height: 1, dataUrl: "data:image/png;base64,AQID" });
  const files = unzipSync(createProjectPackage(project).bytes);
  const assetPath = Object.keys(files).find((path) => path.startsWith("assets/"));
  files[assetPath][1] ^= 0xff;
  assert.throws(() => openProjectPackage(zipSync(files)), /damaged asset/i);
});
