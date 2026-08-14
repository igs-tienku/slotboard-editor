export const SCHEMA_VERSION = 3;
export const DEFAULT_SCENE_SIZE = { width: 960, height: 540 };
export const FLOW_WORKSPACE_LIMIT = 12000;
export const ANNOTATION_PANE_WIDTH = 420;
export const DEFAULT_ANNOTATION_SIZE = { width: 320, height: 170 };
export const DEFAULT_CONNECTION_LABEL_SIZE = { width: 190, height: 92 };
export const FLOW_CARD_LIMITS = { minWidth: 200, maxWidth: 640, minHeight: 180, maxHeight: 600 };
export const SCENE_SIZE_PRESETS = {
  "landscape-hd": { name: "橫版 HD", width: 1920, height: 1080 },
  "landscape-work": { name: "橫版工作稿", width: 960, height: 540 },
  "portrait-hd": { name: "直版 HD", width: 1080, height: 1920 },
  "mobile-portrait": { name: "手機直版", width: 1080, height: 2340 },
  "tablet-landscape": { name: "平板橫版", width: 1366, height: 1024 },
};

const SHAPE_NAMES = {
  rectangle: "矩形",
  ellipse: "圓形",
  triangle: "三角形",
  star: "星形",
  polygon: "多邊形",
  line: "直線",
  arrow: "箭頭",
};

let serial = 0;
export function createId(prefix = "id") {
  serial += 1;
  return `${prefix}_${Date.now().toString(36)}_${serial.toString(36)}`;
}

export function defaultFlowCardSize(sceneOrSize) {
  const sceneWidth = Math.max(1, Number(sceneOrSize?.width) || DEFAULT_SCENE_SIZE.width);
  const sceneHeight = Math.max(1, Number(sceneOrSize?.height) || DEFAULT_SCENE_SIZE.height);
  const cardWidth = 280;
  const previewHeight = Math.max(110, Math.min(320, Math.round(cardWidth / (sceneWidth / sceneHeight))));
  return { width: cardWidth, height: Math.max(FLOW_CARD_LIMITS.minHeight, Math.min(FLOW_CARD_LIMITS.maxHeight, previewHeight + 106)) };
}

export function createShapeLayer(kind, index = 1, overrides = {}) {
  const isLine = kind === "line" || kind === "arrow";
  return {
    id: createId("layer"),
    type: "shape",
    kind,
    name: `${SHAPE_NAMES[kind] ?? "圖形"} ${String(index).padStart(2, "0")}`,
    visible: true,
    locked: false,
    opacity: 1,
    fill: isLine ? "transparent" : "#d6d6d1",
    stroke: isLine ? "#f2f2ed" : "#494a46",
    strokeWidth: isLine ? 5 : 2,
    cornerRadius: kind === "rectangle" ? 6 : 0,
    transform: {
      x: 260,
      y: 150,
      width: isLine ? 250 : 190,
      height: isLine ? 36 : 150,
      rotation: 0,
      flipX: false,
      flipY: false,
    },
    ...overrides,
  };
}

export function createTextLayer(index = 1, overrides = {}) {
  return {
    id: createId("layer"),
    type: "text",
    name: `文字 ${String(index).padStart(2, "0")}`,
    visible: true,
    locked: false,
    opacity: 1,
    text: "輸入文字",
    fontFamily: "Noto Sans TC",
    fontSize: 48,
    fontWeight: 700,
    fontStyle: "normal",
    textAlign: "center",
    verticalAlign: "middle",
    lineHeight: 1.25,
    letterSpacing: 0,
    color: "#f4f4f0",
    textStroke: "#20211f",
    textStrokeWidth: 0,
    background: "transparent",
    transform: { x: 280, y: 220, width: 400, height: 100, rotation: 0, flipX: false, flipY: false },
    ...overrides,
  };
}

export function createReelGridLayer(columns = [3, 3, 3, 3, 3], overrides = {}) {
  return {
    id: createId("layer"),
    type: "reelGrid",
    name: "Reel Grid 01",
    visible: true,
    locked: false,
    opacity: 1,
    columns: columns.map((rows) => Array.from({ length: rows }, () => null)),
    gap: 6,
    frameColor: "#f0f0eb",
    cellColor: "#858681",
    transform: { x: 180, y: 70, width: 600, height: 400, rotation: 0, flipX: false, flipY: false },
    ...overrides,
  };
}

export function createScene(name = "未命名 Scene", size = DEFAULT_SCENE_SIZE) {
  return {
    id: createId("scene"),
    name,
    width: size.width,
    height: size.height,
    overview: { x: 0, y: 0, ...defaultFlowCardSize(size) },
    layers: [],
    annotations: [],
    thumbnailRevision: 0,
  };
}

export function applyBuiltInSceneTemplate(scene, template = "basic") {
  const background = createShapeLayer("rectangle", 1, {
    name: "背景", fill: "#4c4d49", stroke: "#4c4d49", locked: true,
    transform: { x: 0, y: 0, width: scene.width, height: scene.height, rotation: 0, flipX: false, flipY: false },
  });
  if (template === "blank") { scene.layers = [background]; return scene; }
  const marginX = Math.round(scene.width * 0.18), marginY = Math.round(scene.height * 0.13);
  if (template === "reel") {
    scene.layers = [createReelGridLayer([3, 3, 3, 3, 3], {
      name: "Reel Grid 01", transform: { x: marginX, y: marginY, width: scene.width - marginX * 2, height: scene.height - marginY * 2, rotation: 0, flipX: false, flipY: false },
    }), background];
    return scene;
  }
  scene.layers = [createShapeLayer("rectangle", 2, {
    name: "盤面 Placeholder", fill: "#9b9c97", stroke: "#efefeb", strokeWidth: 4,
    transform: { x: marginX, y: marginY, width: scene.width - marginX * 2, height: scene.height - marginY * 2, rotation: 0, flipX: false, flipY: false },
  }), background];
  return scene;
}

export function createProject(name = "SlotBoard 專案", size = DEFAULT_SCENE_SIZE, template = "basic") {
  const normalizedSize = { width: Math.max(320, Math.min(8192, Math.round(size.width))), height: Math.max(320, Math.min(8192, Math.round(size.height))) };
  const scene = applyBuiltInSceneTemplate(createScene("MG 主畫面", normalizedSize), template);
  return {
    schemaVersion: SCHEMA_VERSION,
    id: createId("project"),
    name,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    defaultSceneSize: { ...normalizedSize },
    sceneOrder: [scene.id],
    scenes: { [scene.id]: scene },
    connections: [],
    symbols: {},
    assets: {},
    fonts: [
      { id: "noto-sans-tc", family: "Noto Sans TC", category: "sans", license: "OFL-1.1" },
      { id: "noto-serif-tc", family: "Noto Serif TC", category: "serif", license: "OFL-1.1" },
      { id: "noto-sans-mono", family: "Noto Sans Mono", category: "mono", license: "OFL-1.1" },
    ],
    editorSettings: { snap: true, guides: true, pixelGrid: false, snapDistance: 8, flowZoom: 1, sceneZoom: 1, backgroundLockInitialized: true },
  };
}

export function cloneProject(project) {
  return structuredClone(project);
}

function normalizeBackgroundOrder(project) {
  Object.values(project.scenes ?? {}).forEach((scene) => {
    const backgrounds = [], content = [];
    scene.layers.forEach((layer) => {
      const transform = layer.transform;
      const fullCanvasBackground = /^(背景|background)$/i.test(String(layer.name).trim()) && transform?.x === 0 && transform?.y === 0 && transform?.width >= scene.width && transform?.height >= scene.height;
      if (fullCanvasBackground) backgrounds.push(layer);
      else content.push(layer);
    });
    scene.layers = [...content, ...backgrounds];
  });
  return project;
}

function initializeDefaultBackgroundLocks(project) {
  project.editorSettings ??= { snap: true, guides: true, pixelGrid: false, snapDistance: 8, flowZoom: 1, sceneZoom: 1 };
  if (project.editorSettings.backgroundLockInitialized) return project;
  Object.values(project.scenes ?? {}).forEach((scene) => {
    scene.layers.forEach((layer) => {
      const transform = layer.transform;
      const fullCanvasBackground = /^(背景|background)$/i.test(String(layer.name).trim()) && transform?.x === 0 && transform?.y === 0 && transform?.width >= scene.width && transform?.height >= scene.height;
      if (fullCanvasBackground) layer.locked = true;
    });
  });
  project.editorSettings.backgroundLockInitialized = true;
  return project;
}

function initializeDiagramGeometry(project) {
  Object.values(project.scenes ?? {}).forEach((scene) => {
    scene.overview ??= { x: 0, y: 0 };
    const defaultCard = defaultFlowCardSize(scene);
    scene.overview.width = Number.isFinite(scene.overview.width) ? Math.max(FLOW_CARD_LIMITS.minWidth, Math.min(FLOW_CARD_LIMITS.maxWidth, scene.overview.width)) : defaultCard.width;
    scene.overview.height = Number.isFinite(scene.overview.height) ? Math.max(FLOW_CARD_LIMITS.minHeight, Math.min(FLOW_CARD_LIMITS.maxHeight, scene.overview.height)) : defaultCard.height;
    const placed = [];
    (scene.annotations ??= []).forEach((annotation) => {
      const legacyGeometry = !Number.isFinite(annotation.width) || !Number.isFinite(annotation.height);
      annotation.width = Number.isFinite(annotation.width) ? annotation.width : DEFAULT_ANNOTATION_SIZE.width;
      annotation.height = Number.isFinite(annotation.height) ? annotation.height : DEFAULT_ANNOTATION_SIZE.height;
      const totalWidth = scene.width + ANNOTATION_PANE_WIDTH;
      const outside = annotation.x < 0 || annotation.y < 0 || annotation.x + annotation.width > totalWidth || annotation.y + annotation.height > scene.height;
      const overlaps = placed.some((item) => annotation.x < item.x + item.width + 18 && annotation.x + annotation.width + 18 > item.x && annotation.y < item.y + item.height + 18 && annotation.y + annotation.height + 18 > item.y);
      if (outside || (legacyGeometry && overlaps)) {
        const slot = findAnnotationSlot(scene, annotation.width, annotation.height, placed);
        annotation.x = slot.x; annotation.y = slot.y;
      }
      placed.push(annotation);
    });
  });
  (project.connections ??= []).forEach((connection) => {
    connection.labelOffset ??= { x: 0, y: 0 };
    connection.labelSize ??= { ...DEFAULT_CONNECTION_LABEL_SIZE };
  });
  return project;
}

export function migrateProject(input) {
  if (!input || typeof input !== "object") throw new Error("Invalid project data");
  if (Number(input.schemaVersion) > SCHEMA_VERSION) {
    if (!Array.isArray(input.sceneOrder) || !input.scenes || typeof input.scenes !== "object") throw new Error("Unsupported project structure");
    const readonly = cloneProject(input);
    readonly.connections ??= [];
    readonly.symbols ??= {};
    readonly.assets ??= {};
    readonly.editorSettings ??= { snap: true, guides: true, pixelGrid: false, snapDistance: 8, flowZoom: 1, sceneZoom: 1 };
    readonly.editorSettings.flowZoom ??= 1;
    readonly.editorSettings.sceneZoom ??= 1;
    readonly.compatibility = { readOnly: true, sourceSchemaVersion: input.schemaVersion };
    Object.values(readonly.scenes).forEach((scene) => { scene.annotations ??= []; scene.overview ??= { x: 80, y: 80 }; });
    return normalizeBackgroundOrder(readonly);
  }
  if (input.schemaVersion === SCHEMA_VERSION) {
    const migrated = cloneProject(input);
    migrated.editorSettings ??= { snap: true, guides: true, pixelGrid: false, snapDistance: 8 };
    migrated.editorSettings.flowZoom ??= 1;
    migrated.editorSettings.sceneZoom ??= 1;
    return normalizeBackgroundOrder(initializeDefaultBackgroundLocks(initializeDiagramGeometry(migrated)));
  }
  if (input.schemaVersion === 1) {
    const migrated = cloneProject(input);
    migrated.schemaVersion = 3;
    migrated.fonts = [
      { id: "noto-sans-tc", family: "Noto Sans TC", category: "sans", license: "OFL-1.1" },
      { id: "noto-serif-tc", family: "Noto Serif TC", category: "serif", license: "OFL-1.1" },
      { id: "noto-sans-mono", family: "Noto Sans Mono", category: "mono", license: "OFL-1.1" },
    ];
    migrated.editorSettings = { snap: true, guides: true, pixelGrid: false, snapDistance: 8, flowZoom: 1, sceneZoom: 1 };
    return normalizeBackgroundOrder(initializeDefaultBackgroundLocks(initializeDiagramGeometry(migrated)));
  }
  if (input.schemaVersion === 2) {
    const migrated = cloneProject(input);
    migrated.schemaVersion = 3;
    migrated.connections ??= [];
    migrated.symbols ??= {};
    migrated.editorSettings ??= { snap: true, guides: true, pixelGrid: false, snapDistance: 8 };
    migrated.editorSettings.flowZoom ??= 1;
    migrated.editorSettings.sceneZoom ??= 1;
    Object.values(migrated.scenes).forEach((scene) => {
      scene.overview ??= { x: 0, y: 0 };
      scene.annotations ??= [];
    });
    return normalizeBackgroundOrder(initializeDefaultBackgroundLocks(initializeDiagramGeometry(migrated)));
  }
  throw new Error(`Unsupported schemaVersion: ${String(input.schemaVersion)}`);
}

export function makeEditableCopy(project) {
  const next = cloneProject(project);
  next.schemaVersion = SCHEMA_VERSION;
  next.id = createId("project");
  next.name = `${project.name ?? "SlotBoard 專案"}（可編輯副本）`;
  next.createdAt = new Date().toISOString();
  next.updatedAt = next.createdAt;
  delete next.compatibility;
  return migrateProject(next);
}

function touch(project) {
  project.updatedAt = new Date().toISOString();
  return project;
}

export function addScene(project, name, options = {}) {
  const next = cloneProject(project);
  const size = options.size ?? next.defaultSceneSize;
  const scene = applyBuiltInSceneTemplate(createScene(name || `Scene ${String(next.sceneOrder.length + 1).padStart(2, "0")}`, size), options.template ?? "blank");
  scene.overview = { ...scene.overview, x: 60 + (next.sceneOrder.length % 4) * 320, y: 60 + Math.floor(next.sceneOrder.length / 4) * 280 };
  next.scenes[scene.id] = scene;
  next.sceneOrder.push(scene.id);
  return { project: touch(next), sceneId: scene.id };
}

export function renameScene(project, sceneId, name) {
  const next = cloneProject(project);
  if (!next.scenes[sceneId]) return project;
  next.scenes[sceneId].name = name.trim() || "未命名 Scene";
  return touch(next);
}

export function reorderScene(project, sceneId, direction) {
  const next = cloneProject(project);
  const index = next.sceneOrder.indexOf(sceneId);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= next.sceneOrder.length) return project;
  [next.sceneOrder[index], next.sceneOrder[target]] = [next.sceneOrder[target], next.sceneOrder[index]];
  return touch(next);
}

function renewLayerIds(layer, idMap = new Map()) {
  const copy = structuredClone(layer);
  const previousId = copy.id;
  copy.id = createId(copy.type === "group" ? "group" : "layer");
  idMap.set(previousId, copy.id);
  if (copy.children) copy.children = copy.children.map((child) => renewLayerIds(child, idMap));
  return copy;
}

function remapAnnotations(annotations, layerIdMap) {
  return (annotations ?? []).map((annotation) => ({
    ...structuredClone(annotation),
    id: createId("annotation"),
    targetLayerId: annotation.targetLayerId ? layerIdMap.get(annotation.targetLayerId) ?? null : null,
  }));
}

export function duplicateScene(project, sceneId) {
  const source = project.scenes[sceneId];
  if (!source) return { project, sceneId };
  const next = cloneProject(project);
  const copy = structuredClone(source);
  const layerIdMap = new Map();
  copy.id = createId("scene");
  copy.name = `${source.name} 複本`;
  copy.layers = copy.layers.map((layer) => renewLayerIds(layer, layerIdMap));
  copy.annotations = remapAnnotations(copy.annotations, layerIdMap);
  copy.thumbnailRevision += 1;
  next.scenes[copy.id] = copy;
  const sourceIndex = next.sceneOrder.indexOf(sceneId);
  next.sceneOrder.splice(sourceIndex + 1, 0, copy.id);
  return { project: touch(next), sceneId: copy.id };
}

export function updateScene(project, sceneId, updater) {
  const next = cloneProject(project);
  const scene = next.scenes[sceneId];
  if (!scene) return project;
  updater(scene);
  scene.thumbnailRevision += 1;
  return touch(next);
}

export function walkLayers(layers, visitor, parent = null) {
  for (const layer of layers) {
    visitor(layer, parent);
    if (layer.children) walkLayers(layer.children, visitor, layer);
  }
}

export function findLayer(layers, id) {
  let found;
  walkLayers(layers, (layer) => { if (layer.id === id) found = layer; });
  return found;
}

export function updateLayerTree(layers, id, updater) {
  return layers.map((layer) => {
    if (layer.id === id) {
      const copy = structuredClone(layer);
      updater(copy);
      return copy;
    }
    if (layer.children) return { ...layer, children: updateLayerTree(layer.children, id, updater) };
    return layer;
  });
}

function removeLayerTree(layers, ids) {
  return layers
    .filter((layer) => !ids.has(layer.id))
    .map((layer) => layer.children ? { ...layer, children: removeLayerTree(layer.children, ids) } : layer);
}

export function removeLayers(project, sceneId, layerIds) {
  const ids = new Set(layerIds);
  if (!ids.size) return project;
  return updateScene(project, sceneId, (scene) => {
    scene.layers = removeLayerTree(scene.layers, ids);
    scene.annotations = scene.annotations.filter((annotation) => !annotation.targetLayerId || !ids.has(annotation.targetLayerId));
  });
}

export function locateLayerInScene(project, sceneId, layerId) {
  return updateLayer(project, sceneId, layerId, (layer) => {
    const scene = project.scenes[sceneId];
    layer.transform.width = Math.max(1, Math.min(Number.isFinite(layer.transform.width) ? layer.transform.width : 1, scene.width));
    layer.transform.height = Math.max(1, Math.min(Number.isFinite(layer.transform.height) ? layer.transform.height : 1, scene.height));
    layer.transform.x = Math.round((scene.width - layer.transform.width) / 2);
    layer.transform.y = Math.round((scene.height - layer.transform.height) / 2);
  });
}

function reorderLayerTree(layers, layerId, destination) {
  const index = layers.findIndex((layer) => layer.id === layerId);
  if (index >= 0) {
    const next = [...layers], [layer] = next.splice(index, 1);
    if (destination === "front") next.unshift(layer);
    else if (destination === "back") next.push(layer);
    else {
      const target = destination === "up" ? Math.max(0, index - 1) : Math.min(next.length, index + 1);
      next.splice(target, 0, layer);
    }
    return next;
  }
  return layers.map((layer) => layer.children ? { ...layer, children: reorderLayerTree(layer.children, layerId, destination) } : layer);
}

export function reorderLayer(project, sceneId, layerId, destination) {
  return normalizeBackgroundOrder(updateScene(project, sceneId, (scene) => { scene.layers = reorderLayerTree(scene.layers, layerId, destination); }));
}

function moveLayerAmongSiblings(layers, draggedId, targetId, placement) {
  const draggedIndex = layers.findIndex((layer) => layer.id === draggedId);
  const targetIndex = layers.findIndex((layer) => layer.id === targetId);
  if (draggedIndex >= 0 || targetIndex >= 0) {
    if (draggedIndex < 0 || targetIndex < 0 || draggedIndex === targetIndex || layers[draggedIndex].locked) return { layers, moved: false };
    const next = [...layers];
    const [dragged] = next.splice(draggedIndex, 1);
    const nextTargetIndex = next.findIndex((layer) => layer.id === targetId);
    next.splice(nextTargetIndex + (placement === "after" ? 1 : 0), 0, dragged);
    return { layers: next, moved: true };
  }
  for (let index = 0; index < layers.length; index += 1) {
    const layer = layers[index];
    if (!layer.children) continue;
    const result = moveLayerAmongSiblings(layer.children, draggedId, targetId, placement);
    if (result.moved) {
      const next = [...layers];
      next[index] = { ...layer, children: result.layers };
      return { layers: next, moved: true };
    }
  }
  return { layers, moved: false };
}

export function moveLayerByDrop(project, sceneId, draggedId, targetId, placement = "before") {
  if (!project.scenes[sceneId] || draggedId === targetId || !["before", "after"].includes(placement)) return project;
  const next = cloneProject(project);
  const result = moveLayerAmongSiblings(next.scenes[sceneId].layers, draggedId, targetId, placement);
  if (!result.moved) return project;
  next.scenes[sceneId].layers = result.layers;
  next.scenes[sceneId].thumbnailRevision += 1;
  return touch(normalizeBackgroundOrder(next));
}

function collectSelectedLayers(layers, selected, output) {
  for (const layer of layers) {
    if (selected.has(layer.id)) output.push(structuredClone(layer));
    else if (layer.children) collectSelectedLayers(layer.children, selected, output);
  }
}

export function copyLayerSelection(project, sceneId, layerIds) {
  const output = [];
  collectSelectedLayers(project.scenes[sceneId]?.layers ?? [], new Set(layerIds), output);
  return output;
}

export function pasteLayerSelection(project, sceneId, clipboardLayers, offset = 24) {
  if (!project.scenes[sceneId] || !clipboardLayers?.length) return { project, layerIds: [] };
  const next = cloneProject(project);
  const copies = clipboardLayers.map((source) => {
    const copy = renewLayerIds(source);
    copy.name = `${source.name} 複本`;
    copy.transform.x = Math.max(0, Math.min(next.scenes[sceneId].width - copy.transform.width, copy.transform.x + offset));
    copy.transform.y = Math.max(0, Math.min(next.scenes[sceneId].height - copy.transform.height, copy.transform.y + offset));
    return copy;
  });
  next.scenes[sceneId].layers.unshift(...copies);
  next.scenes[sceneId].thumbnailRevision += 1;
  normalizeBackgroundOrder(next);
  return { project: touch(next), layerIds: copies.map((layer) => layer.id) };
}

export function addLayer(project, sceneId, kind) {
  return updateScene(project, sceneId, (scene) => {
    let count = 0;
    walkLayers(scene.layers, (layer) => { if (layer.type === "shape" && layer.kind === kind) count += 1; });
    scene.layers.unshift(createShapeLayer(kind, count + 1, {
      transform: { x: 80 + count * 18, y: 70 + count * 18, width: kind === "line" || kind === "arrow" ? 250 : 190, height: kind === "line" || kind === "arrow" ? 36 : 150, rotation: 0, flipX: false, flipY: false },
    }));
  });
}

export function addTextLayer(project, sceneId) {
  return updateScene(project, sceneId, (scene) => {
    let count = 0;
    walkLayers(scene.layers, (layer) => { if (layer.type === "text") count += 1; });
    scene.layers.unshift(createTextLayer(count + 1));
  });
}

export function addReelGridLayer(project, sceneId, columns = [3, 3, 3, 3, 3]) {
  return updateScene(project, sceneId, (scene) => {
    let count = 0;
    walkLayers(scene.layers, (layer) => { if (layer.type === "reelGrid") count += 1; });
    scene.layers.unshift(createReelGridLayer(columns, { name: `Reel Grid ${String(count + 1).padStart(2, "0")}` }));
  });
}

export function updateReelColumn(project, sceneId, layerId, columnIndex, rows) {
  return updateLayer(project, sceneId, layerId, (layer) => {
    if (layer.type !== "reelGrid") return;
    const current = layer.columns[columnIndex] ?? [];
    layer.columns[columnIndex] = Array.from({ length: Math.max(1, Math.min(12, rows)) }, (_, index) => current[index] ?? null);
  });
}

export function addReelColumn(project, sceneId, layerId, rows = 3) {
  return updateLayer(project, sceneId, layerId, (layer) => { if (layer.type === "reelGrid" && layer.columns.length < 12) layer.columns.push(Array.from({ length: rows }, () => null)); });
}

export function removeReelColumn(project, sceneId, layerId) {
  return updateLayer(project, sceneId, layerId, (layer) => { if (layer.type === "reelGrid" && layer.columns.length > 1) layer.columns.pop(); });
}

export function addSymbol(project, name, color = "#e8e8e3") {
  const next = cloneProject(project);
  const symbol = { id: createId("symbol"), name: name || `Symbol ${Object.keys(next.symbols).length + 1}`, color, assetId: null, fit: "cover", focalPoint: { x: 0.5, y: 0.5 } };
  next.symbols[symbol.id] = symbol;
  return { project: touch(next), symbolId: symbol.id };
}

export function updateSymbol(project, symbolId, patch) {
  const next = cloneProject(project);
  if (!next.symbols[symbolId]) return project;
  Object.assign(next.symbols[symbolId], patch);
  return touch(next);
}

export function replaceSymbolImage(project, symbolId, asset) {
  const next = cloneProject(project);
  const symbol = next.symbols[symbolId];
  if (!symbol) return project;
  const previousAssetId = symbol.assetId;
  next.assets[asset.id] = structuredClone(asset);
  symbol.assetId = asset.id;
  symbol.fit ??= "cover";
  symbol.focalPoint ??= { x: 0.5, y: 0.5 };
  if (previousAssetId && !projectUsesAsset(next, previousAssetId)) delete next.assets[previousAssetId];
  return touch(next);
}

export function resetSymbolImage(project, symbolId) {
  const next = cloneProject(project);
  const symbol = next.symbols[symbolId];
  if (!symbol?.assetId) return project;
  const previousAssetId = symbol.assetId;
  symbol.assetId = null;
  if (!projectUsesAsset(next, previousAssetId)) delete next.assets[previousAssetId];
  return touch(next);
}

export function assignReelSymbol(project, sceneId, layerId, columnIndex, rowIndex, symbolId) {
  return updateLayer(project, sceneId, layerId, (layer) => {
    if (layer.type === "reelGrid" && layer.columns[columnIndex]?.[rowIndex] !== undefined) layer.columns[columnIndex][rowIndex] = symbolId;
  });
}

export function updateSceneOverview(project, sceneId, position) {
  const next = cloneProject(project);
  if (!next.scenes[sceneId]) return project;
  const overview = next.scenes[sceneId].overview;
  next.scenes[sceneId].overview = {
    ...overview,
    x: Number.isFinite(position.x) ? Math.max(-FLOW_WORKSPACE_LIMIT, Math.min(FLOW_WORKSPACE_LIMIT, Math.round(position.x))) : overview.x,
    y: Number.isFinite(position.y) ? Math.max(-FLOW_WORKSPACE_LIMIT, Math.min(FLOW_WORKSPACE_LIMIT, Math.round(position.y))) : overview.y,
    width: Number.isFinite(position.width) ? Math.max(FLOW_CARD_LIMITS.minWidth, Math.min(FLOW_CARD_LIMITS.maxWidth, Math.round(position.width))) : overview.width,
    height: Number.isFinite(position.height) ? Math.max(FLOW_CARD_LIMITS.minHeight, Math.min(FLOW_CARD_LIMITS.maxHeight, Math.round(position.height))) : overview.height,
  };
  return touch(next);
}

export function autoArrangeScenes(project) {
  const next = cloneProject(project);
  const indegree = new Map(next.sceneOrder.map((id) => [id, 0]));
  const outgoing = new Map(next.sceneOrder.map((id) => [id, []]));
  next.connections.forEach((connection) => {
    if (!indegree.has(connection.fromSceneId) || !indegree.has(connection.toSceneId)) return;
    indegree.set(connection.toSceneId, indegree.get(connection.toSceneId) + 1);
    outgoing.get(connection.fromSceneId).push(connection.toSceneId);
  });
  const level = new Map(next.sceneOrder.map((id) => [id, 0]));
  const queue = next.sceneOrder.filter((id) => indegree.get(id) === 0);
  const visited = new Set();
  while (queue.length) {
    const id = queue.shift(); visited.add(id);
    outgoing.get(id).forEach((target) => {
      level.set(target, Math.max(level.get(target), level.get(id) + 1));
      indegree.set(target, indegree.get(target) - 1);
      if (indegree.get(target) === 0) queue.push(target);
    });
  }
  let cycleLevel = Math.max(0, ...level.values()) + 1;
  next.sceneOrder.forEach((id) => { if (!visited.has(id)) level.set(id, cycleLevel++); });
  const columns = new Map();
  next.sceneOrder.forEach((id) => {
    const column = level.get(id);
    if (!columns.has(column)) columns.set(column, []);
    columns.get(column).push(id);
  });
  let x = 80;
  [...columns.keys()].sort((a, b) => a - b).forEach((column) => {
    const ids = columns.get(column);
    const columnWidth = Math.max(...ids.map((id) => next.scenes[id].overview.width ?? defaultFlowCardSize(next.scenes[id]).width));
    let y = 80;
    ids.forEach((id) => {
      const scene = next.scenes[id], defaults = defaultFlowCardSize(scene);
      const cardWidth = scene.overview.width ?? defaults.width, cardHeight = scene.overview.height ?? defaults.height;
      scene.overview = { ...scene.overview, x, y, width: cardWidth, height: cardHeight };
      y += cardHeight + 70;
    });
    x += columnWidth + 100;
  });
  return touch(next);
}

export function addConnection(project, fromSceneId, toSceneId, label = "下一步") {
  if (!project.scenes[fromSceneId] || !project.scenes[toSceneId] || fromSceneId === toSceneId) return project;
  const next = cloneProject(project);
  next.connections.push({
    id: createId("connection"), fromSceneId, toSceneId, label,
    labelOffset: { x: 0, y: 0 }, labelSize: { ...DEFAULT_CONNECTION_LABEL_SIZE },
  });
  return touch(next);
}

export function updateConnection(project, connectionId, patch) {
  const next = cloneProject(project);
  const connection = next.connections.find((item) => item.id === connectionId);
  if (connection) Object.assign(connection, patch);
  return touch(next);
}

export function removeConnection(project, connectionId) {
  const next = cloneProject(project);
  next.connections = next.connections.filter((item) => item.id !== connectionId);
  return touch(next);
}

export function addAnnotation(project, sceneId, text = "新增標註", targetLayerId = null) {
  return updateScene(project, sceneId, (scene) => {
    const width = DEFAULT_ANNOTATION_SIZE.width, height = DEFAULT_ANNOTATION_SIZE.height;
    const { x, y } = findAnnotationSlot(scene, width, height, scene.annotations);
    scene.annotations.push({ id: createId("annotation"), text, targetLayerId, x, y, width, height });
  });
}

function findAnnotationSlot(scene, width, height, occupiedItems) {
  const gap = 18, rows = Math.max(1, Math.floor((scene.height - 60) / (height + gap)));
  const xPositions = [scene.width + 50];
  for (let x = scene.width - width - 30; x >= 30; x -= width + gap) xPositions.push(x);
  for (const x of xPositions) {
    for (let row = 0; row < rows; row += 1) {
      const y = 50 + row * (height + gap);
      const occupied = occupiedItems.some((item) => {
        const itemWidth = item.width ?? DEFAULT_ANNOTATION_SIZE.width;
        const itemHeight = item.height ?? DEFAULT_ANNOTATION_SIZE.height;
        return x < item.x + itemWidth + gap && x + width + gap > item.x && y < item.y + itemHeight + gap && y + height + gap > item.y;
      });
      if (!occupied) return { x, y };
    }
  }
  return { x: scene.width + 50, y: 50 };
}

export function updateAnnotation(project, sceneId, annotationId, patch) {
  return updateScene(project, sceneId, (scene) => {
    const annotation = scene.annotations.find((item) => item.id === annotationId);
    if (annotation) Object.assign(annotation, patch);
  });
}

export function moveAnnotation(project, sceneId, annotationId, position) {
  const scene = project.scenes[sceneId];
  if (!scene) return project;
  const annotation = scene.annotations.find((item) => item.id === annotationId);
  if (!annotation) return project;
  const height = annotation.height ?? DEFAULT_ANNOTATION_SIZE.height;
  const width = annotation.width ?? DEFAULT_ANNOTATION_SIZE.width;
  return updateAnnotation(project, sceneId, annotationId, {
    x: Math.round(Math.max(0, Math.min(scene.width + ANNOTATION_PANE_WIDTH - width, position.x))),
    y: Math.round(Math.max(0, Math.min(Math.max(0, scene.height - height), position.y))),
  });
}

export function resizeAnnotation(project, sceneId, annotationId, size) {
  const scene = project.scenes[sceneId];
  const annotation = scene?.annotations.find((item) => item.id === annotationId);
  if (!scene || !annotation) return project;
  const width = Math.round(Math.max(240, Math.min(720, size.width)));
  const height = Math.round(Math.max(130, Math.min(scene.height, size.height)));
  return updateAnnotation(project, sceneId, annotationId, {
    width, height,
    x: Math.round(Math.min(annotation.x, Math.max(0, scene.width + ANNOTATION_PANE_WIDTH - width))),
    y: Math.round(Math.min(annotation.y, Math.max(0, scene.height - height))),
  });
}

export function removeAnnotation(project, sceneId, annotationId) {
  return updateScene(project, sceneId, (scene) => { scene.annotations = scene.annotations.filter((item) => item.id !== annotationId); });
}

export function importSceneTemplate(project, template) {
  const next = cloneProject(project);
  const scene = structuredClone(template.scene);
  const layerIdMap = new Map();
  const symbolIds = new Set();
  const assetIds = new Set();
  const inspectLayers = (layers) => layers.forEach((layer) => {
    if (layer.type === "image" && layer.assetId) assetIds.add(layer.assetId);
    if (layer.type === "reelGrid") layer.columns.forEach((column) => column.forEach((symbolId) => { if (symbolId) symbolIds.add(symbolId); }));
    if (layer.children) inspectLayers(layer.children);
  });
  inspectLayers(scene.layers);
  symbolIds.forEach((symbolId) => {
    const assetId = template.symbols?.[symbolId]?.assetId;
    if (assetId) assetIds.add(assetId);
  });
  const assetIdMap = new Map();
  assetIds.forEach((assetId) => {
    const asset = template.assets?.[assetId];
    if (!asset) return;
    const nextId = createId("asset");
    assetIdMap.set(assetId, nextId);
    next.assets[nextId] = { ...structuredClone(asset), id: nextId };
  });
  const symbolIdMap = new Map();
  symbolIds.forEach((symbolId) => {
    const symbol = template.symbols?.[symbolId];
    if (!symbol) return;
    const nextId = createId("symbol");
    symbolIdMap.set(symbolId, nextId);
    next.symbols[nextId] = { ...structuredClone(symbol), id: nextId, assetId: symbol.assetId ? assetIdMap.get(symbol.assetId) ?? null : null };
  });
  scene.id = createId("scene");
  scene.name = `${scene.name}（模板）`;
  scene.overview = { ...scene.overview, x: 60 + (next.sceneOrder.length % 4) * 320, y: 60 + Math.floor(next.sceneOrder.length / 4) * 280 };
  scene.layers = scene.layers.map((layer) => renewLayerIds(layer, layerIdMap));
  const remapLayerResources = (layers) => layers.forEach((layer) => {
    if (layer.type === "image") layer.assetId = layer.assetId ? assetIdMap.get(layer.assetId) ?? null : null;
    if (layer.type === "reelGrid") layer.columns = layer.columns.map((column) => column.map((symbolId) => symbolId ? symbolIdMap.get(symbolId) ?? null : null));
    if (layer.children) remapLayerResources(layer.children);
  });
  remapLayerResources(scene.layers);
  scene.annotations = remapAnnotations(scene.annotations, layerIdMap);
  next.scenes[scene.id] = scene;
  next.sceneOrder.push(scene.id);
  return { project: touch(next), sceneId: scene.id };
}

export function updateEditorSettings(project, patch) {
  const next = cloneProject(project);
  next.editorSettings = { ...next.editorSettings, ...patch };
  return touch(next);
}

export function projectAssetBytes(project) {
  return Object.values(project.assets ?? {}).reduce((sum, asset) => sum + (asset.byteLength ?? 0), 0);
}

export function replaceLayerWithImage(project, sceneId, layerId, asset) {
  const next = cloneProject(project);
  const previousLayer = findLayer(next.scenes[sceneId]?.layers ?? [], layerId);
  const previousAssetId = previousLayer?.type === "image" ? previousLayer.assetId : null;
  next.assets[asset.id] = structuredClone(asset);
  const scene = next.scenes[sceneId];
  if (!scene) return project;
  scene.layers = updateLayerTree(scene.layers, layerId, (layer) => {
    const placeholder = layer.type === "image" ? layer.placeholder : structuredClone(layer);
    layer.type = "image";
    layer.assetId = asset.id;
    layer.fit = "cover";
    layer.focalPoint = { x: 0.5, y: 0.5 };
    layer.imageScale = 1;
    layer.cornerRadius = layer.cornerRadius ?? 6;
    layer.placeholder = placeholder;
    delete layer.kind;
    delete layer.fill;
  });
  scene.thumbnailRevision += 1;
  if (previousAssetId && !projectUsesAsset(next, previousAssetId)) delete next.assets[previousAssetId];
  return touch(next);
}

function projectUsesAsset(project, assetId) {
  let used = false;
  Object.values(project.scenes).forEach((scene) => walkLayers(scene.layers, (layer) => { if (layer.assetId === assetId) used = true; }));
  Object.values(project.symbols ?? {}).forEach((symbol) => { if (symbol.assetId === assetId) used = true; });
  return used;
}

export function resetImagePlaceholder(project, sceneId, layerId) {
  const current = findLayer(project.scenes[sceneId]?.layers ?? [], layerId);
  const assetId = current?.type === "image" ? current.assetId : null;
  const next = updateScene(project, sceneId, (scene) => {
    scene.layers = updateLayerTree(scene.layers, layerId, (layer) => {
      if (layer.type !== "image" || !layer.placeholder) return;
      const placeholder = structuredClone(layer.placeholder);
      const preserved = { id: layer.id, name: layer.name, transform: structuredClone(layer.transform), visible: layer.visible, locked: layer.locked, opacity: layer.opacity };
      Object.keys(layer).forEach((key) => delete layer[key]);
      Object.assign(layer, placeholder, preserved);
    });
  });
  if (assetId && !projectUsesAsset(next, assetId)) delete next.assets[assetId];
  return next;
}

export function alignLayers(project, sceneId, layerIds, mode) {
  if (!layerIds.length) return project;
  const scene = project.scenes[sceneId];
  const layers = layerIds.map((id) => findLayer(scene.layers, id)).filter(Boolean);
  if (!layers.length) return project;
  const left = Math.min(...layers.map((layer) => layer.transform.x));
  const top = Math.min(...layers.map((layer) => layer.transform.y));
  const right = Math.max(...layers.map((layer) => layer.transform.x + layer.transform.width));
  const bottom = Math.max(...layers.map((layer) => layer.transform.y + layer.transform.height));
  let next = project;
  for (const target of layers) {
    next = updateLayer(next, sceneId, target.id, (layer) => {
      if (mode === "left") layer.transform.x = layerIds.length === 1 ? 0 : left;
      if (mode === "centerX") layer.transform.x = (layerIds.length === 1 ? scene.width / 2 : (left + right) / 2) - layer.transform.width / 2;
      if (mode === "right") layer.transform.x = (layerIds.length === 1 ? scene.width : right) - layer.transform.width;
      if (mode === "top") layer.transform.y = layerIds.length === 1 ? 0 : top;
      if (mode === "centerY") layer.transform.y = (layerIds.length === 1 ? scene.height / 2 : (top + bottom) / 2) - layer.transform.height / 2;
      if (mode === "bottom") layer.transform.y = (layerIds.length === 1 ? scene.height : bottom) - layer.transform.height;
    });
  }
  return next;
}

export function distributeLayers(project, sceneId, layerIds, axis) {
  if (layerIds.length < 3) return project;
  const scene = project.scenes[sceneId];
  const layers = layerIds.map((id) => findLayer(scene.layers, id)).filter(Boolean);
  const sorted = [...layers].sort((a, b) => axis === "x" ? a.transform.x - b.transform.x : a.transform.y - b.transform.y);
  const first = sorted[0];
  const last = sorted.at(-1);
  const start = axis === "x" ? first.transform.x : first.transform.y;
  const end = axis === "x" ? last.transform.x : last.transform.y;
  const step = (end - start) / (sorted.length - 1);
  let next = project;
  sorted.slice(1, -1).forEach((target, index) => {
    next = updateLayer(next, sceneId, target.id, (layer) => { layer.transform[axis] = Math.round(start + step * (index + 1)); });
  });
  return next;
}

export function updateLayer(project, sceneId, layerId, updater) {
  return updateScene(project, sceneId, (scene) => {
    scene.layers = updateLayerTree(scene.layers, layerId, updater);
  });
}

export function scaleGroupChildren(layers, scaleX, scaleY) {
  return layers.map((layer) => ({
    ...layer,
    transform: layer.transform ? {
      ...layer.transform,
      x: Math.round(layer.transform.x * scaleX),
      y: Math.round(layer.transform.y * scaleY),
      width: Math.max(1, Math.round(layer.transform.width * scaleX)),
      height: Math.max(1, Math.round(layer.transform.height * scaleY)),
    } : layer.transform,
    ...(layer.children ? { children: scaleGroupChildren(layer.children, scaleX, scaleY) } : {}),
  }));
}

function removeSelected(layers, selected, collected) {
  const output = [];
  for (const layer of layers) {
    if (selected.has(layer.id)) {
      collected.push(layer);
      continue;
    }
    output.push(layer.children ? { ...layer, children: removeSelected(layer.children, selected, collected) } : layer);
  }
  return output;
}

export function groupLayers(project, sceneId, layerIds) {
  if (layerIds.length < 2) return { project, groupId: null };
  const selected = new Set(layerIds);
  let groupId = null;
  const next = updateScene(project, sceneId, (scene) => {
    const collected = [];
    scene.layers = removeSelected(scene.layers, selected, collected);
    if (collected.length < 2) return;
    const left = Math.min(...collected.map((layer) => layer.transform?.x ?? 0));
    const top = Math.min(...collected.map((layer) => layer.transform?.y ?? 0));
    const right = Math.max(...collected.map((layer) => (layer.transform?.x ?? 0) + (layer.transform?.width ?? 0)));
    const bottom = Math.max(...collected.map((layer) => (layer.transform?.y ?? 0) + (layer.transform?.height ?? 0)));
    const children = collected.map((layer) => ({
      ...layer,
      transform: layer.transform ? { ...layer.transform, x: layer.transform.x - left, y: layer.transform.y - top } : layer.transform,
    }));
    groupId = createId("group");
    scene.layers.unshift({
      id: groupId,
      type: "group",
      name: `群組 ${String(scene.layers.filter((layer) => layer.type === "group").length + 1).padStart(2, "0")}`,
      visible: true,
      locked: false,
      opacity: 1,
      transform: { x: left, y: top, width: right - left, height: bottom - top, rotation: 0, flipX: false, flipY: false },
      children,
      opened: true,
    });
  });
  return { project: next, groupId };
}

export function ungroupLayer(project, sceneId, groupId) {
  return updateScene(project, sceneId, (scene) => {
    const output = [];
    for (const layer of scene.layers) {
      if (layer.id !== groupId || layer.type !== "group") {
        output.push(layer);
        continue;
      }
      for (const child of layer.children) {
        output.push({
          ...child,
          transform: child.transform ? {
            ...child.transform,
            x: child.transform.x + layer.transform.x,
            y: child.transform.y + layer.transform.y,
            rotation: child.transform.rotation + layer.transform.rotation,
          } : child.transform,
        });
      }
    }
    scene.layers = output;
  });
}

export function serializeProject(project) {
  return JSON.stringify(project);
}

export function deserializeProject(text) {
  return migrateProject(JSON.parse(text));
}

export function createHistory(initial) {
  return { past: [], present: initial, future: [] };
}

export function commitHistory(history, next) {
  if (next === history.present || serializeProject(next) === serializeProject(history.present)) return history;
  return { past: [...history.past.slice(-99), history.present], present: next, future: [] };
}

export function undoHistory(history) {
  if (!history.past.length) return history;
  return {
    past: history.past.slice(0, -1),
    present: history.past.at(-1),
    future: [history.present, ...history.future],
  };
}

export function redoHistory(history) {
  if (!history.future.length) return history;
  return {
    past: [...history.past, history.present],
    present: history.future[0],
    future: history.future.slice(1),
  };
}
