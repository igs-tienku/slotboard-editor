import assert from "node:assert/strict";
import test from "node:test";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { addAnnotation, addLayer, addReelGridLayer, addScene, addSymbol, assignReelSymbol, createProject, importSceneTemplate, replaceLayerWithImage, replaceSymbolImage } from "../lib/editor-model.js";
import { createPackageEntryFilter, createProjectPackage, createTemplatePackage, openProjectPackage, openTemplatePackage } from "../lib/project-package.js";

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
  assert.equal(manifest.toolVersion, "0.20.0");
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

test("slottemplate remaps anchored notes, Symbols and assets without target collisions", () => {
  let source = createProject("Template source");
  const sourceSceneId = source.sceneOrder[0];
  source = addReelGridLayer(source, sourceSceneId, [3, 3, 3]);
  const grid = source.scenes[sourceSceneId].layers[0];
  const symbolResult = addSymbol(source, "Wild"); source = symbolResult.project;
  source = replaceSymbolImage(source, symbolResult.symbolId, { id: "shared_asset", name: "wild.png", mimeType: "image/png", byteLength: 3, width: 1, height: 1, dataUrl: "data:image/png;base64,AQID" });
  source = assignReelSymbol(source, sourceSceneId, grid.id, 0, 0, symbolResult.symbolId);
  source = addAnnotation(source, sourceSceneId, "anchor", grid.id);
  source.symbols.unused_symbol = { id: "unused_symbol", name: "Unused", color: "#fff", assetId: "unused_asset" };
  source.assets.unused_asset = { id: "unused_asset", name: "unused.png", mimeType: "image/png", byteLength: 3, width: 1, height: 1, dataUrl: "data:image/png;base64,AQID" };

  const template = openTemplatePackage(createTemplatePackage(source, sourceSceneId).bytes);
  assert.equal(template.symbols.unused_symbol, undefined);
  assert.equal(template.assets.unused_asset, undefined);

  const target = createProject("Target");
  target.symbols[symbolResult.symbolId] = { id: symbolResult.symbolId, name: "Keep me", color: "#000", assetId: "shared_asset" };
  target.assets.shared_asset = { id: "shared_asset", name: "keep.png", mimeType: "image/png", byteLength: 3, width: 1, height: 1, dataUrl: "data:image/png;base64,BAUG" };
  const imported = importSceneTemplate(target, template);
  const importedScene = imported.project.scenes[imported.sceneId];
  const importedGrid = importedScene.layers[0];
  const importedSymbolId = importedGrid.columns[0][0];
  const importedSymbol = imported.project.symbols[importedSymbolId];

  assert.equal(imported.project.symbols[symbolResult.symbolId].name, "Keep me");
  assert.equal(imported.project.assets.shared_asset.name, "keep.png");
  assert.notEqual(importedSymbolId, symbolResult.symbolId);
  assert.notEqual(importedSymbol.assetId, "shared_asset");
  assert.equal(imported.project.assets[importedSymbol.assetId].name, "wild.png");
  assert.equal(importedScene.annotations[0].targetLayerId, importedGrid.id);
  assert.notEqual(importedScene.annotations[0].id, source.scenes[sourceSceneId].annotations[0].id);
});

test("corrupt packages are rejected without changing a project", () => {
  const before = createProject();
  assert.throws(() => openProjectPackage(new Uint8Array([1, 2, 3, 4])));
  assert.equal(before.sceneOrder.length, 1);
});

test("package preflight rejects declared file count and size before extraction", () => {
  const fileFilter = createPackageEntryFilter({ maxFiles: 1, maxUncompressedBytes: 10 });
  assert.equal(fileFilter({ name: "first.json", originalSize: 5 }), true);
  assert.throws(() => fileFilter({ name: "second.json", originalSize: 1 }), /too many files/i);

  const sizeFilter = createPackageEntryFilter({ maxFiles: 5, maxUncompressedBytes: 10 });
  assert.throws(() => sizeFilter({ name: "bomb.bin", originalSize: 11 }), /too large/i);
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
