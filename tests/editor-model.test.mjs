import assert from "node:assert/strict";
import test from "node:test";
import {
  addLayer,
  addAnnotation,
  addConnection,
  addReelGridLayer,
  addScene,
  addTextLayer,
  addSymbol,
  alignLayers,
  assignReelSymbol,
  autoArrangeScenes,
  commitHistory,
  copyLayerSelection,
  createHistory,
  createProject,
  deserializeProject,
  duplicateScene,
  groupLayers,
  locateLayerInScene,
  makeEditableCopy,
  moveAnnotation,
  moveLayerByDrop,
  projectAssetBytes,
  pasteLayerSelection,
  redoHistory,
  replaceLayerWithImage,
  replaceSymbolImage,
  resizeAnnotation,
  resetImagePlaceholder,
  resetSymbolImage,
  scaleGroupChildren,
  renameScene,
  reorderLayer,
  reorderScene,
  serializeProject,
  undoHistory,
  updateAnnotation,
  updateEditorSettings,
  updateLayer,
  updateReelColumn,
  updateSceneOverview,
  updateSymbol,
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

test("project sizes and built-in Scene templates create correctly scaled starting content", () => {
  const portrait = createProject("直版企劃", { width: 1080, height: 1920 }, "blank");
  const portraitScene = portrait.scenes[portrait.sceneOrder[0]];
  assert.deepEqual(portrait.defaultSceneSize, { width: 1080, height: 1920 });
  assert.equal(portraitScene.layers.length, 1);
  assert.equal(portraitScene.layers[0].name, "背景");
  assert.deepEqual({ width: portraitScene.layers[0].transform.width, height: portraitScene.layers[0].transform.height }, { width: 1080, height: 1920 });

  const reel = addScene(portrait, "6×4 測試", { size: { width: 1366, height: 1024 }, template: "reel" });
  const reelScene = reel.project.scenes[reel.sceneId];
  assert.equal(reelScene.width, 1366);
  assert.equal(reelScene.layers[0].type, "reelGrid");
  assert.deepEqual(reelScene.layers[0].columns.map((column) => column.length), [3, 3, 3, 3, 3]);

  const clamped = createProject("尺寸防呆", { width: 10, height: 99999 }, "basic");
  assert.deepEqual(clamped.defaultSceneSize, { width: 320, height: 8192 });
});

test("variable reel grids and project symbols stay linked across scenes", () => {
  let project = createProject();
  const firstScene = project.sceneOrder[0];
  const secondResult = addScene(project, "FG");
  project = secondResult.project;
  const symbolResult = addSymbol(project, "Wild", "#ffffff");
  project = symbolResult.project;
  project = addReelGridLayer(project, firstScene, [3, 4, 4, 4, 3]);
  project = addReelGridLayer(project, secondResult.sceneId, [3, 3, 3, 3, 3]);
  const firstGrid = project.scenes[firstScene].layers[0];
  const secondGrid = project.scenes[secondResult.sceneId].layers[0];
  project = assignReelSymbol(project, firstScene, firstGrid.id, 0, 0, symbolResult.symbolId);
  project = assignReelSymbol(project, secondResult.sceneId, secondGrid.id, 2, 1, symbolResult.symbolId);
  project = updateReelColumn(project, firstScene, firstGrid.id, 0, 5);
  project = updateSymbol(project, symbolResult.symbolId, { name: "Wild 正式版", color: "#eeeeee" });
  const asset = { id: "asset_wild", name: "wild.png", mimeType: "image/png", byteLength: 12, width: 2, height: 2, dataUrl: "data:image/png;base64,AAAA" };
  project = replaceSymbolImage(project, symbolResult.symbolId, asset);
  const restored = deserializeProject(serializeProject(project));
  assert.equal(restored.scenes[firstScene].layers[0].columns[0].length, 5);
  assert.equal(restored.scenes[firstScene].layers[0].columns[0][0], symbolResult.symbolId);
  assert.equal(restored.scenes[secondResult.sceneId].layers[0].columns[2][1], symbolResult.symbolId);
  assert.equal(restored.symbols[symbolResult.symbolId].name, "Wild 正式版");
  assert.equal(restored.symbols[symbolResult.symbolId].assetId, asset.id);
  assert.equal(restored.assets[asset.id].name, "wild.png");

  const reset = resetSymbolImage(restored, symbolResult.symbolId);
  assert.equal(reset.symbols[symbolResult.symbolId].assetId, null);
  assert.equal(reset.assets[asset.id], undefined);
});

test("flow positions, branching connections and anchored annotations persist", () => {
  let project = createProject();
  const first = project.sceneOrder[0];
  const second = addScene(project, "FG"); project = second.project;
  const third = addScene(project, "普通得分"); project = third.project;
  project = updateSceneOverview(project, first, { x: 80, y: 120 });
  project = addConnection(project, first, second.sceneId, "Scatter Trigger");
  project = addConnection(project, first, third.sceneId, "普通結果");
  const targetLayerId = project.scenes[first].layers[0].id;
  project = addAnnotation(project, first, "背景需要更暗", targetLayerId);
  const annotationId = project.scenes[first].annotations[0].id;
  project = updateAnnotation(project, first, annotationId, { x: 1080, y: 160 });
  project = moveAnnotation(project, first, annotationId, { x: 99999, y: -80 });
  const restored = deserializeProject(serializeProject(project));
  assert.deepEqual(restored.scenes[first].overview, { x: 80, y: 120 });
  assert.equal(restored.connections.length, 2);
  assert.equal(restored.scenes[first].annotations[0].targetLayerId, targetLayerId);
  assert.equal(restored.scenes[first].annotations[0].x, restored.scenes[first].width + 6000);
  assert.equal(restored.scenes[first].annotations[0].y, 0);
  assert.deepEqual(restored.connections[0].labelOffset, { x: 0, y: 0 });
  assert.deepEqual(restored.connections[0].labelSize, { width: 190, height: 92 });
});

test("annotations receive non-overlapping slots and persist editable sizes", () => {
  let project = createProject("標註排版");
  const sceneId = project.sceneOrder[0];
  project = addAnnotation(project, sceneId, "第一張");
  project = addAnnotation(project, sceneId, "第二張");
  project = addAnnotation(project, sceneId, "第三張");
  const [first, second, third] = project.scenes[sceneId].annotations;
  assert.equal(first.width, 320);
  assert.ok(second.y >= first.y + first.height + 18);
  assert.ok(third.x >= first.x + first.width + 18);
  project = resizeAnnotation(project, sceneId, first.id, { width: 510, height: 240 });
  assert.deepEqual({ width: project.scenes[sceneId].annotations[0].width, height: project.scenes[sceneId].annotations[0].height }, { width: 510, height: 240 });
});

test("legacy annotation cards are assigned geometry and separated when they overlap", () => {
  let project = createProject("舊標註修復");
  const sceneId = project.sceneOrder[0];
  project = addAnnotation(project, sceneId, "舊卡一");
  project = addAnnotation(project, sceneId, "舊卡二");
  project.scenes[sceneId].annotations.forEach((annotation, index) => {
    delete annotation.width; delete annotation.height;
    annotation.x = project.scenes[sceneId].width + 60;
    annotation.y = 80 + index * 90;
  });
  const restored = deserializeProject(serializeProject(project));
  const [first, second] = restored.scenes[sceneId].annotations;
  assert.equal(first.width, 320);
  assert.equal(second.height, 170);
  assert.ok(second.y >= first.y + first.height + 18 || second.x >= first.x + first.width + 18);
});

test("flow workspace accepts negative coordinates and reports its real limit", () => {
  let project = createProject("大型流程");
  const sceneId = project.sceneOrder[0];
  project = updateSceneOverview(project, sceneId, { x: -4800, y: -7300 });
  assert.deepEqual(project.scenes[sceneId].overview, { x: -4800, y: -7300 });
  project = updateSceneOverview(project, sceneId, { x: -99999, y: 99999 });
  assert.deepEqual(project.scenes[sceneId].overview, { x: -12000, y: 12000 });
});

test("flow auto-arrange handles branches and cycles while zoom persists", () => {
  let project = createProject();
  const first = project.sceneOrder[0];
  const second = addScene(project, "FG"); project = second.project;
  const third = addScene(project, "選擇分支"); project = third.project;
  const fourth = addScene(project, "循環返回"); project = fourth.project;
  project = addConnection(project, first, second.sceneId, "進 FG");
  project = addConnection(project, first, third.sceneId, "分支");
  project = addConnection(project, second.sceneId, fourth.sceneId, "結束");
  project = addConnection(project, fourth.sceneId, second.sceneId, "重試");
  project = updateEditorSettings(project, { flowZoom: 0.7, sceneZoom: 1.35 });
  project = autoArrangeScenes(project);
  const restored = deserializeProject(serializeProject(project));
  assert.equal(restored.editorSettings.flowZoom, 0.7);
  assert.equal(restored.editorSettings.sceneZoom, 1.35);
  assert.equal(restored.scenes[first].overview.x, 80);
  assert.ok(restored.scenes[third.sceneId].overview.x > restored.scenes[first].overview.x);
  assert.equal(new Set(restored.sceneOrder.map((id) => `${restored.scenes[id].overview.x},${restored.scenes[id].overview.y}`)).size, 4);
});

test("scene rename, reorder and duplicate preserve stable source data", () => {
  let project = createProject();
  const second = addScene(project, "第二幕");
  project = second.project;
  project = renameScene(project, second.sceneId, "Scatter 觸發");
  project = reorderScene(project, second.sceneId, -1);
  const sourceTargetId = project.scenes[second.sceneId].layers[0].id;
  project = addAnnotation(project, second.sceneId, "跟隨物件", sourceTargetId);
  const duplicated = duplicateScene(project, second.sceneId);

  assert.equal(duplicated.project.sceneOrder[0], second.sceneId);
  assert.equal(duplicated.project.scenes[second.sceneId].name, "Scatter 觸發");
  assert.equal(duplicated.project.scenes[duplicated.sceneId].name, "Scatter 觸發 複本");
  assert.notEqual(duplicated.sceneId, second.sceneId);
  const duplicatedScene = duplicated.project.scenes[duplicated.sceneId];
  assert.notEqual(duplicatedScene.layers[0].id, sourceTargetId);
  assert.equal(duplicatedScene.annotations[0].targetLayerId, duplicatedScene.layers[0].id);
  assert.notEqual(duplicatedScene.annotations[0].id, project.scenes[second.sceneId].annotations[0].id);
});

test("layer clipboard crosses scenes, renews nested ids and supports step ordering", () => {
  let project = createProject();
  const sourceSceneId = project.sceneOrder[0];
  const target = addScene(project, "FG"); project = target.project;
  project = addLayer(project, sourceSceneId, "ellipse");
  project = addLayer(project, sourceSceneId, "triangle");
  const sourceLayers = project.scenes[sourceSceneId].layers;
  const clipboard = copyLayerSelection(project, sourceSceneId, [sourceLayers[0].id, sourceLayers[1].id]);
  const pasted = pasteLayerSelection(project, target.sceneId, clipboard);
  project = pasted.project;
  assert.equal(pasted.layerIds.length, 2);
  assert.deepEqual(project.scenes[target.sceneId].layers.slice(0, 2).map((layer) => layer.name), clipboard.map((layer) => `${layer.name} 複本`));
  assert.equal(pasted.layerIds.every((id) => !clipboard.some((layer) => layer.id === id)), true);

  const before = project.scenes[target.sceneId].layers.map((layer) => layer.id);
  project = reorderLayer(project, target.sceneId, before[1], "up");
  assert.deepEqual(project.scenes[target.sceneId].layers.slice(0, 2).map((layer) => layer.id), [before[1], before[0]]);
  project = reorderLayer(project, target.sceneId, before[1], "down");
  assert.deepEqual(project.scenes[target.sceneId].layers.slice(0, 2).map((layer) => layer.id), [before[0], before[1]]);

  const grouped = groupLayers(project, sourceSceneId, [sourceLayers[0].id, sourceLayers[1].id]);
  project = grouped.project;
  const groupClipboard = copyLayerSelection(project, sourceSceneId, [grouped.groupId]);
  const pastedGroup = pasteLayerSelection(project, target.sceneId, groupClipboard, 40);
  const newGroup = pastedGroup.project.scenes[target.sceneId].layers.find((layer) => layer.id === pastedGroup.layerIds[0]);
  assert.equal(newGroup.type, "group");
  assert.notEqual(newGroup.id, groupClipboard[0].id);
  assert.deepEqual(newGroup.children.map((layer) => layer.id).some((id) => groupClipboard[0].children.some((source) => source.id === id)), false);
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
  const layerId = project.scenes[sceneId].layers.find((layer) => layer.name.includes("Placeholder")).id;
  const asset = { id: "asset_test", name: "hero.png", mimeType: "image/png", byteLength: 1024, width: 1200, height: 800, dataUrl: "data:image/png;base64,AAAA" };
  project = replaceLayerWithImage(project, sceneId, layerId, asset);
  project = updateLayer(project, sceneId, layerId, (layer) => {
    layer.fit = "cover";
    layer.focalPoint = { x: .2, y: .8 };
    layer.imageScale = 1.45;
  });
  const restored = deserializeProject(serializeProject(project));
  const imageLayer = restored.scenes[sceneId].layers.find((layer) => layer.id === layerId);
  assert.equal(imageLayer.type, "image");
  assert.deepEqual(imageLayer.focalPoint, { x: .2, y: .8 });
  assert.equal(imageLayer.imageScale, 1.45);
  assert.equal(projectAssetBytes(restored), 1024);

  const reset = resetImagePlaceholder(restored, sceneId, layerId);
  const resetLayer = reset.scenes[sceneId].layers.find((layer) => layer.id === layerId);
  assert.equal(resetLayer.type, "shape");
  assert.equal(resetLayer.name, "盤面 Placeholder");
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
  assert.equal(migrated.schemaVersion, 3);
  assert.equal(migrated.editorSettings.snap, true);
  assert.equal(migrated.editorSettings.sceneZoom, 1);
  assert.equal(migrated.fonts.length, 3);
});

test("future schema opens read-only and can create a current editable copy", () => {
  const future = createProject("未來版本");
  future.schemaVersion = 99;
  future.futureOnlyField = { preserved: true };
  const opened = deserializeProject(JSON.stringify(future));
  assert.equal(opened.compatibility.readOnly, true);
  assert.equal(opened.compatibility.sourceSchemaVersion, 99);
  assert.equal(opened.futureOnlyField.preserved, true);
  const editable = makeEditableCopy(opened);
  assert.equal(editable.schemaVersion, 3);
  assert.equal(editable.compatibility, undefined);
  assert.match(editable.name, /可編輯副本/);
  assert.notEqual(editable.id, opened.id);
});

test("removing selected layers also clears annotations anchored to them", async () => {
  const { addAnnotation, removeLayers } = await import("../lib/editor-model.js");
  let project = createProject();
  const sceneId = project.sceneOrder[0];
  const layerId = project.scenes[sceneId].layers.find((layer) => layer.name.includes("Placeholder")).id;
  project = addAnnotation(project, sceneId, "remove with target", layerId);
  project = removeLayers(project, sceneId, [layerId]);
  assert.equal(project.scenes[sceneId].layers.length, 1);
  assert.equal(project.scenes[sceneId].annotations.length, 0);
});

test("locate and layer-order commands recover off-canvas objects", async () => {
  const { locateLayerInScene, reorderLayer, updateLayer } = await import("../lib/editor-model.js");
  let project = createProject();
  const sceneId = project.sceneOrder[0], layerId = project.scenes[sceneId].layers.find((layer) => layer.name.includes("Placeholder")).id;
  project = updateLayer(project, sceneId, layerId, (layer) => { layer.transform.x = -4000; layer.transform.y = 9000; });
  project = locateLayerInScene(project, sceneId, layerId);
  const located = project.scenes[sceneId].layers.find((layer) => layer.id === layerId);
  assert.ok(located.transform.x >= 0 && located.transform.x + located.transform.width <= project.scenes[sceneId].width);
  assert.ok(located.transform.y >= 0 && located.transform.y + located.transform.height <= project.scenes[sceneId].height);
  project = reorderLayer(project, sceneId, layerId, "back");
  assert.equal(project.scenes[sceneId].layers.at(-2).id, layerId);
  assert.equal(project.scenes[sceneId].layers.at(-1).name, "背景");
  project = reorderLayer(project, sceneId, layerId, "front");
  assert.equal(project.scenes[sceneId].layers[0].id, layerId);
});

test("locate shrinks oversized objects before computing the Scene center", () => {
  let project = createProject("oversized locate", { width: 960, height: 540 }, "blank");
  const sceneId = project.sceneOrder[0];
  project = addLayer(project, sceneId, "rectangle");
  const layerId = project.scenes[sceneId].layers[0].id;
  project = updateLayer(project, sceneId, layerId, (layer) => {
    layer.transform = { ...layer.transform, x: 5000, y: 5000, width: 1200, height: 300 };
  });
  project = locateLayerInScene(project, sceneId, layerId);
  const transform = project.scenes[sceneId].layers[0].transform;
  assert.deepEqual({ x: transform.x, y: transform.y, width: transform.width, height: transform.height }, { x: 0, y: 120, width: 960, height: 300 });
});

test("loading an older project repairs a full-canvas background placed on top", () => {
  const project = createProject();
  const sceneId = project.sceneOrder[0], scene = project.scenes[sceneId];
  scene.layers.unshift(scene.layers.pop());
  assert.equal(scene.layers[0].name, "背景");
  const restored = deserializeProject(JSON.stringify(project));
  assert.equal(restored.scenes[sceneId].layers.at(-1).name, "背景");
});

test("shape fill, stroke and corner radius survive project reload", () => {
  let project = createProject(), sceneId = project.sceneOrder[0];
  project = addLayer(project, sceneId, "rectangle");
  const layerId = project.scenes[sceneId].layers[0].id;
  project = updateLayer(project, sceneId, layerId, (layer) => {
    layer.fill = "#d95f59"; layer.stroke = "#102030"; layer.strokeWidth = 7; layer.cornerRadius = 24;
  });
  const restored = deserializeProject(serializeProject(project)), shape = restored.scenes[sceneId].layers[0];
  assert.deepEqual([shape.fill, shape.stroke, shape.strokeWidth, shape.cornerRadius], ["#d95f59", "#102030", 7, 24]);
});

test("drag reorder moves only unlocked siblings and keeps the background at the bottom", () => {
  let project = createProject();
  const sceneId = project.sceneOrder[0];
  project = addLayer(project, sceneId, "ellipse");
  project = addLayer(project, sceneId, "triangle");
  const [triangle, ellipse, placeholder, background] = project.scenes[sceneId].layers;
  assert.equal(background.name, "背景");
  assert.equal(background.locked, true);

  project = moveLayerByDrop(project, sceneId, triangle.id, placeholder.id, "after");
  assert.deepEqual(project.scenes[sceneId].layers.map((layer) => layer.id), [ellipse.id, placeholder.id, triangle.id, background.id]);

  const unchanged = moveLayerByDrop(project, sceneId, background.id, ellipse.id, "before");
  assert.equal(unchanged, project);
  assert.equal(unchanged.scenes[sceneId].layers.at(-1).id, background.id);
});

test("drag reorder preserves group boundaries while allowing child sibling order", () => {
  let project = createProject();
  const sceneId = project.sceneOrder[0];
  project = addLayer(project, sceneId, "ellipse");
  project = addLayer(project, sceneId, "triangle");
  const source = project.scenes[sceneId].layers.slice(0, 2);
  const grouped = groupLayers(project, sceneId, source.map((layer) => layer.id));
  project = grouped.project;
  let group = project.scenes[sceneId].layers.find((layer) => layer.id === grouped.groupId);
  const [first, second] = group.children;
  project = moveLayerByDrop(project, sceneId, second.id, first.id, "before");
  group = project.scenes[sceneId].layers.find((layer) => layer.id === grouped.groupId);
  assert.deepEqual(group.children.map((layer) => layer.id), [second.id, first.id]);

  const rootLayer = project.scenes[sceneId].layers.find((layer) => layer.type !== "group" && layer.name !== "背景");
  const unchanged = moveLayerByDrop(project, sceneId, second.id, rootLayer.id, "before");
  assert.equal(unchanged, project);
});

test("legacy projects receive a one-time default background lock without relocking user choices", () => {
  const legacy = createProject();
  const sceneId = legacy.sceneOrder[0];
  delete legacy.editorSettings.backgroundLockInitialized;
  legacy.scenes[sceneId].layers.at(-1).locked = false;
  const migrated = deserializeProject(JSON.stringify(legacy));
  assert.equal(migrated.scenes[sceneId].layers.at(-1).locked, true);
  assert.equal(migrated.editorSettings.backgroundLockInitialized, true);

  migrated.scenes[sceneId].layers.at(-1).locked = false;
  const reopened = deserializeProject(JSON.stringify(migrated));
  assert.equal(reopened.scenes[sceneId].layers.at(-1).locked, false);
});

test("group resizing scales every nested child from the same frozen geometry", () => {
  const children = [{
    id: "nested-group",
    type: "group",
    transform: { x: 10, y: 20, width: 100, height: 80 },
    children: [{ id: "child", transform: { x: 5, y: 8, width: 40, height: 30 } }],
  }];
  const scaled = scaleGroupChildren(children, 2, .5);
  assert.deepEqual(scaled[0].transform, { x: 20, y: 10, width: 200, height: 40 });
  assert.deepEqual(scaled[0].children[0].transform, { x: 10, y: 4, width: 80, height: 15 });
  assert.deepEqual(children[0].transform, { x: 10, y: 20, width: 100, height: 80 });
});
