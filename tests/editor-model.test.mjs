import assert from "node:assert/strict";
import test from "node:test";
import {
  addLayer,
  addScene,
  addTextLayer,
  alignLayers,
  commitHistory,
  createHistory,
  createProject,
  deserializeProject,
  duplicateScene,
  groupLayers,
  projectAssetBytes,
  redoHistory,
  replaceLayerWithImage,
  resetImagePlaceholder,
  renameScene,
  reorderScene,
  serializeProject,
  undoHistory,
  updateLayer,
} from "../lib/editor-model.js";

test("30 scenes survive serialize and reload without data loss", () => {
  let project = createProject("壓力測試");
  while (project.sceneOrder.length < 30) project = addScene(project).project;
  for (const sceneId of project.sceneOrder) {
    project = addLayer(project, sceneId, "rectangle");
    project = addLayer(project, sceneId, "arrow");
  }

  const restored = deserializeProject(serializeProject(project));
  assert.equal(restored.sceneOrder.length, 30);
  assert.deepEqual(restored, project);
  for (const sceneId of restored.sceneOrder) assert.equal(restored.scenes[sceneId].layers.length >= 2, true);
});

test("scene rename, reorder and duplicate preserve stable source data", () => {
  let project = createProject();
  const second = addScene(project, "第二幕");
  project = second.project;
  project = renameScene(project, second.sceneId, "Scatter 觸發");
  project = reorderScene(project, second.sceneId, -1);
  const duplicated = duplicateScene(project, second.sceneId);

  assert.equal(duplicated.project.sceneOrder[0], second.sceneId);
  assert.equal(duplicated.project.scenes[second.sceneId].name, "Scatter 觸發");
  assert.equal(duplicated.project.scenes[duplicated.sceneId].name, "Scatter 觸發 複本");
  assert.notEqual(duplicated.sceneId, second.sceneId);
});

test("shape edits, grouping and undo redo are reversible", () => {
  let project = createProject();
  const sceneId = project.sceneOrder[0];
  project = addLayer(project, sceneId, "star");
  project = addLayer(project, sceneId, "polygon");
  const ids = project.scenes[sceneId].layers.slice(0, 2).map((layer) => layer.id);
  const grouped = groupLayers(project, sceneId, ids);
  assert.ok(grouped.groupId);
  assert.equal(grouped.project.scenes[sceneId].layers[0].type, "group");

  const edited = updateLayer(grouped.project, sceneId, grouped.groupId, (layer) => { layer.transform.rotation = 35; });
  let history = createHistory(grouped.project);
  history = commitHistory(history, edited);
  assert.equal(history.present.scenes[sceneId].layers[0].transform.rotation, 35);
  history = undoHistory(history);
  assert.equal(history.present.scenes[sceneId].layers[0].transform.rotation, 0);
  history = redoHistory(history);
  assert.equal(history.present.scenes[sceneId].layers[0].transform.rotation, 35);
});

test("image replacement keeps crop settings after reload and can reset placeholder", () => {
  let project = createProject();
  const sceneId = project.sceneOrder[0];
  const layerId = project.scenes[sceneId].layers[1].id;
  const asset = { id: "asset_test", name: "hero.png", mimeType: "image/png", byteLength: 1024, width: 1200, height: 800, dataUrl: "data:image/png;base64,AAAA" };
  project = replaceLayerWithImage(project, sceneId, layerId, asset);
  project = updateLayer(project, sceneId, layerId, (layer) => {
    layer.fit = "cover";
    layer.focalPoint = { x: .2, y: .8 };
    layer.imageScale = 1.45;
  });
  const restored = deserializeProject(serializeProject(project));
  const imageLayer = restored.scenes[sceneId].layers[1];
  assert.equal(imageLayer.type, "image");
  assert.deepEqual(imageLayer.focalPoint, { x: .2, y: .8 });
  assert.equal(imageLayer.imageScale, 1.45);
  assert.equal(projectAssetBytes(restored), 1024);

  const reset = resetImagePlaceholder(restored, sceneId, layerId);
  assert.equal(reset.scenes[sceneId].layers[1].type, "shape");
  assert.equal(reset.scenes[sceneId].layers[1].name, "盤面 Placeholder");
  assert.equal(projectAssetBytes(reset), 0);
});

test("text, alignment and schema v1 migration use M2 defaults", () => {
  let project = createProject();
  const sceneId = project.sceneOrder[0];
  project = addTextLayer(project, sceneId);
  const text = project.scenes[sceneId].layers[0];
  assert.equal(text.type, "text");
  assert.equal(text.fontFamily, "Noto Sans TC");
  project = alignLayers(project, sceneId, [text.id], "centerX");
  assert.equal(project.scenes[sceneId].layers[0].transform.x, 280);

  const legacy = structuredClone(project);
  legacy.schemaVersion = 1;
  delete legacy.editorSettings;
  legacy.fonts = [];
  const migrated = deserializeProject(JSON.stringify(legacy));
  assert.equal(migrated.schemaVersion, 2);
  assert.equal(migrated.editorSettings.snap, true);
  assert.equal(migrated.fonts.length, 3);
});
