export const SCHEMA_VERSION = 3;
export const DEFAULT_SCENE_SIZE = { width: 960, height: 540 };

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
    overview: { x: 0, y: 0 },
    layers: [],
    annotations: [],
    thumbnailRevision: 0,
  };
}

export function createProject(name = "SlotBoard 專案") {
  const scene = createScene("MG 主畫面");
  scene.layers = [
    createShapeLayer("rectangle", 2, {
      name: "盤面 Placeholder",
      fill: "#9b9c97",
      stroke: "#efefeb",
      strokeWidth: 4,
      transform: { x: 260, y: 100, width: 440, height: 330, rotation: 0, flipX: false, flipY: false },
    }),
    createShapeLayer("rectangle", 1, {
      name: "背景",
      fill: "#4c4d49",
      stroke: "#4c4d49",
      transform: { x: 0, y: 0, width: scene.width, height: scene.height, rotation: 0, flipX: false, flipY: false },
    }),
  ];
  return {
    schemaVersion: SCHEMA_VERSION,
    id: createId("project"),
    name,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    defaultSceneSize: { ...DEFAULT_SCENE_SIZE },
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
    editorSettings: { snap: true, guides: true, pixelGrid: false, snapDistance: 8 },
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

export function migrateProject(input) {
  if (!input || typeof input !== "object") throw new Error("Invalid project data");
  if (input.schemaVersion === SCHEMA_VERSION) return normalizeBackgroundOrder(cloneProject(input));
  if (input.schemaVersion === 1) {
    const migrated = cloneProject(input);
    migrated.schemaVersion = 3;
    migrated.fonts = [
      { id: "noto-sans-tc", family: "Noto Sans TC", category: "sans", license: "OFL-1.1" },
      { id: "noto-serif-tc", family: "Noto Serif TC", category: "serif", license: "OFL-1.1" },
      { id: "noto-sans-mono", family: "Noto Sans Mono", category: "mono", license: "OFL-1.1" },
    ];
    migrated.editorSettings = { snap: true, guides: true, pixelGrid: false, snapDistance: 8 };
    return normalizeBackgroundOrder(migrated);
  }
  if (input.schemaVersion === 2) {
    const migrated = cloneProject(input);
    migrated.schemaVersion = 3;
    migrated.connections ??= [];
    migrated.symbols ??= {};
    Object.values(migrated.scenes).forEach((scene) => {
      scene.overview ??= { x: 0, y: 0 };
      scene.annotations ??= [];
    });
    return normalizeBackgroundOrder(migrated);
  }
  throw new Error(`Unsupported schemaVersion: ${String(input.schemaVersion)}`);
}

function touch(project) {
  project.updatedAt = new Date().toISOString();
  return project;
}

export function addScene(project, name) {
  const next = cloneProject(project);
  const scene = createScene(name || `Scene ${String(next.sceneOrder.length + 1).padStart(2, "0")}`, next.defaultSceneSize);
  scene.overview = { x: 60 + (next.sceneOrder.length % 4) * 260, y: 60 + Math.floor(next.sceneOrder.length / 4) * 190 };
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

function renewLayerIds(layer) {
  const copy = structuredClone(layer);
  copy.id = createId(copy.type === "group" ? "group" : "layer");
  if (copy.children) copy.children = copy.children.map(renewLayerIds);
  return copy;
}

export function duplicateScene(project, sceneId) {
  const source = project.scenes[sceneId];
  if (!source) return { project, sceneId };
  const next = cloneProject(project);
  const copy = structuredClone(source);
  copy.id = createId("scene");
  copy.name = `${source.name} 複本`;
  copy.layers = copy.layers.map(renewLayerIds);
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
    layer.transform.x = Math.round(Math.max(0, (scene.width - layer.transform.width) / 2));
    layer.transform.y = Math.round(Math.max(0, (scene.height - layer.transform.height) / 2));
    layer.transform.width = Math.min(layer.transform.width, scene.width);
    layer.transform.height = Math.min(layer.transform.height, scene.height);
  });
}

function reorderLayerTree(layers, layerId, destination) {
  const index = layers.findIndex((layer) => layer.id === layerId);
  if (index >= 0) {
    const next = [...layers], [layer] = next.splice(index, 1);
    if (destination === "front") next.unshift(layer);
    else next.push(layer);
    return next;
  }
  return layers.map((layer) => layer.children ? { ...layer, children: reorderLayerTree(layer.children, layerId, destination) } : layer);
}

export function reorderLayer(project, sceneId, layerId, destination) {
  return updateScene(project, sceneId, (scene) => { scene.layers = reorderLayerTree(scene.layers, layerId, destination); });
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
  next.scenes[sceneId].overview = { ...next.scenes[sceneId].overview, ...position };
  return touch(next);
}

export function addConnection(project, fromSceneId, toSceneId, label = "下一步") {
  if (!project.scenes[fromSceneId] || !project.scenes[toSceneId] || fromSceneId === toSceneId) return project;
  const next = cloneProject(project);
  next.connections.push({ id: createId("connection"), fromSceneId, toSceneId, label });
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
    scene.annotations.push({ id: createId("annotation"), text, targetLayerId, x: scene.width + 60, y: 80 + scene.annotations.length * 90 });
  });
}

export function updateAnnotation(project, sceneId, annotationId, patch) {
  return updateScene(project, sceneId, (scene) => {
    const annotation = scene.annotations.find((item) => item.id === annotationId);
    if (annotation) Object.assign(annotation, patch);
  });
}

export function removeAnnotation(project, sceneId, annotationId) {
  return updateScene(project, sceneId, (scene) => { scene.annotations = scene.annotations.filter((item) => item.id !== annotationId); });
}

export function importSceneTemplate(project, template) {
  const next = cloneProject(project);
  const scene = structuredClone(template.scene);
  const oldSceneId = scene.id;
  scene.id = createId("scene");
  scene.name = `${scene.name}（模板）`;
  scene.overview = { x: 60 + (next.sceneOrder.length % 4) * 260, y: 60 + Math.floor(next.sceneOrder.length / 4) * 190 };
  scene.layers = scene.layers.map(renewLayerIds);
  next.scenes[scene.id] = scene;
  next.sceneOrder.push(scene.id);
  Object.assign(next.symbols, structuredClone(template.symbols ?? {}));
  Object.assign(next.assets, structuredClone(template.assets ?? {}));
  next.connections = next.connections.filter((connection) => connection.fromSceneId !== oldSceneId && connection.toSceneId !== oldSceneId);
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
