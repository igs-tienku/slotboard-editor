import { zipSync } from "fflate";
import { PDFDocument } from "pdf-lib";

export function sanitizeExportName(name) {
  return [...String(name || "Scene")].map((character) => character.charCodeAt(0) < 32 || '<>:"/\\|?*'.includes(character) ? "_" : character).join("").trim() || "Scene";
}

export function buildSceneFileNames(project) {
  const used = new Map();
  return project.sceneOrder.map((sceneId, index) => {
    const base = `${String(index + 1).padStart(2, "0")}_${sanitizeExportName(project.scenes[sceneId].name)}`;
    const count = (used.get(base) ?? 0) + 1;
    used.set(base, count);
    return { sceneId, base: count === 1 ? base : `${base}_${count}` };
  });
}

function makeCanvas(width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.ceil(width)); canvas.height = Math.max(1, Math.ceil(height));
  return canvas;
}

function polygonPoints(kind, width, height) {
  if (kind === "triangle") return [[width / 2, 0], [width, height], [0, height]];
  if (kind === "polygon") return [[width * .25, 0], [width * .75, 0], [width, height / 2], [width * .75, height], [width * .25, height], [0, height / 2]];
  const points = [];
  for (let index = 0; index < 10; index += 1) {
    const angle = -Math.PI / 2 + index * Math.PI / 5;
    const radius = index % 2 === 0 ? Math.min(width, height) / 2 : Math.min(width, height) / 4.4;
    points.push([width / 2 + Math.cos(angle) * radius, height / 2 + Math.sin(angle) * radius]);
  }
  return points;
}

function drawShape(context, layer) {
  const { width, height } = layer.transform;
  context.beginPath();
  if (layer.kind === "rectangle") context.roundRect(0, 0, width, height, 6);
  else if (layer.kind === "ellipse") context.ellipse(width / 2, height / 2, width / 2, height / 2, 0, 0, Math.PI * 2);
  else if (["triangle", "polygon", "star"].includes(layer.kind)) {
    const points = polygonPoints(layer.kind, width, height);
    context.moveTo(points[0][0], points[0][1]); points.slice(1).forEach(([x, y]) => context.lineTo(x, y)); context.closePath();
  } else {
    context.moveTo(4, height / 2); context.lineTo(width - 8, height / 2);
    if (layer.kind === "arrow") { context.lineTo(width - 22, height / 2 - 12); context.moveTo(width - 8, height / 2); context.lineTo(width - 22, height / 2 + 12); }
  }
  if (layer.fill && layer.fill !== "transparent") { context.fillStyle = layer.fill; context.fill(); }
  context.strokeStyle = layer.stroke ?? "#444"; context.lineWidth = layer.strokeWidth ?? 1; context.stroke();
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = reject; image.src = dataUrl; });
}

async function drawImageLayer(context, layer, asset) {
  if (!asset?.dataUrl) return;
  const image = await loadImage(asset.dataUrl);
  const { width, height } = layer.transform;
  context.save(); context.beginPath(); context.roundRect(0, 0, width, height, layer.cornerRadius ?? 0); context.clip();
  const baseScale = layer.fit === "contain" ? Math.min(width / image.width, height / image.height) : Math.max(width / image.width, height / image.height);
  const scale = baseScale * (layer.fit === "cover" ? layer.imageScale ?? 1 : 1);
  const drawWidth = image.width * scale, drawHeight = image.height * scale;
  const x = (width - drawWidth) * (layer.focalPoint?.x ?? .5), y = (height - drawHeight) * (layer.focalPoint?.y ?? .5);
  context.drawImage(image, x, y, drawWidth, drawHeight); context.restore();
}

function drawText(context, layer) {
  const { width, height } = layer.transform;
  if (layer.background !== "transparent") { context.fillStyle = layer.background; context.fillRect(0, 0, width, height); }
  context.font = `${layer.fontStyle} ${layer.fontWeight} ${layer.fontSize}px "${layer.fontFamily}", sans-serif`;
  context.textAlign = layer.textAlign; context.textBaseline = "alphabetic"; context.fillStyle = layer.color;
  context.strokeStyle = layer.textStroke; context.lineWidth = layer.textStrokeWidth * 2;
  const lines = String(layer.text).split("\n"), total = lines.length * layer.fontSize * layer.lineHeight;
  const x = layer.textAlign === "left" ? 8 : layer.textAlign === "right" ? width - 8 : width / 2;
  const startY = layer.verticalAlign === "top" ? layer.fontSize : layer.verticalAlign === "bottom" ? height - total + layer.fontSize : (height - total) / 2 + layer.fontSize;
  lines.forEach((line, index) => { const y = startY + index * layer.fontSize * layer.lineHeight; if (layer.textStrokeWidth) context.strokeText(line, x, y); context.fillText(line, x, y); });
}

function drawReel(context, layer, project) {
  const { width, height } = layer.transform, gap = layer.gap;
  context.fillStyle = "#252622"; context.fillRect(0, 0, width, height);
  const columnWidth = (width - gap * (layer.columns.length + 1)) / layer.columns.length;
  layer.columns.forEach((column, columnIndex) => {
    const cellHeight = (height - gap * (column.length + 1)) / column.length;
    column.forEach((symbolId, rowIndex) => {
      const symbol = project.symbols[symbolId]; const x = gap + columnIndex * (columnWidth + gap), y = gap + rowIndex * (cellHeight + gap);
      context.fillStyle = symbol?.color ?? layer.cellColor; context.fillRect(x, y, columnWidth, cellHeight);
      context.fillStyle = "#292a27"; context.font = `700 ${Math.min(18, cellHeight / 3)}px sans-serif`; context.textAlign = "center"; context.fillText(symbol?.name?.slice(0, 4) ?? "+", x + columnWidth / 2, y + cellHeight / 2 + 5);
    });
  });
}

async function drawLayer(context, layer, project, options = {}) {
  if (options.visibleOnly && !layer.visible) return;
  context.save(); const t = layer.transform;
  context.translate(t.x, t.y); context.translate(t.width / 2, t.height / 2); context.rotate(t.rotation * Math.PI / 180); context.scale(t.flipX ? -1 : 1, t.flipY ? -1 : 1); context.translate(-t.width / 2, -t.height / 2); context.globalAlpha *= layer.opacity;
  if (layer.type === "group") for (const child of [...layer.children].reverse()) await drawLayer(context, child, project, options);
  else if (layer.type === "image") await drawImageLayer(context, layer, project.assets[layer.assetId]);
  else if (layer.type === "text") drawText(context, layer);
  else if (layer.type === "reelGrid") drawReel(context, layer, project);
  else drawShape(context, layer);
  context.restore();
}

export async function renderSceneCanvas(project, sceneId, visibleOnly = true) {
  const scene = project.scenes[sceneId], canvas = makeCanvas(scene.width, scene.height), context = canvas.getContext("2d");
  context.clearRect(0, 0, scene.width, scene.height);
  for (const layer of [...scene.layers].reverse()) await drawLayer(context, layer, project, { visibleOnly });
  return canvas;
}

async function buildPsdLayer(layer, scene, project) {
  if (layer.type === "group") return { name: layer.name, hidden: !layer.visible, opacity: layer.opacity, opened: layer.opened !== false, children: await Promise.all(layer.children.map((child) => buildPsdLayer(child, scene, project))) };
  const canvas = makeCanvas(scene.width, scene.height), context = canvas.getContext("2d");
  await drawLayer(context, layer, project, { visibleOnly: false });
  return { name: layer.name, hidden: !layer.visible, opacity: layer.opacity, left: 0, top: 0, right: scene.width, bottom: scene.height, imageData: context.getImageData(0, 0, scene.width, scene.height) };
}

export async function createScenePsd(project, sceneId) {
  const scene = project.scenes[sceneId];
  const composite = await renderSceneCanvas(project, sceneId, true);
  const documentData = { width: scene.width, height: scene.height, imageData: composite.getContext("2d").getImageData(0, 0, scene.width, scene.height), children: await Promise.all(scene.layers.map((layer) => buildPsdLayer(layer, scene, project))) };
  return globalThis.agPsd.writePsdUint8Array(documentData, { generateThumbnail: false });
}

export async function createPsdZip(project) {
  const files = {};
  for (const item of buildSceneFileNames(project)) files[`${item.base}.psd`] = await createScenePsd(project, item.sceneId);
  return zipSync(files, { level: 0 });
}

function drawFlowPage(project) {
  const scenePositions = project.sceneOrder.map((id) => project.scenes[id].overview);
  const width = Math.max(1600, ...scenePositions.map((position) => position.x + 330));
  const height = Math.max(900, ...scenePositions.map((position) => position.y + 300));
  const canvas = makeCanvas(width, height), context = canvas.getContext("2d"); context.fillStyle = "#f4f4f0"; context.fillRect(0, 0, width, height); context.fillStyle = "#1f201d"; context.font = "700 30px sans-serif"; context.fillText(`${project.name} - FLOW OVERVIEW`, 48, 52);
  project.connections.forEach((connection) => { const from = project.scenes[connection.fromSceneId], to = project.scenes[connection.toSceneId]; context.strokeStyle = "#70772f"; context.lineWidth = 3; context.beginPath(); context.moveTo(from.overview.x + 230, from.overview.y + 130); context.lineTo(to.overview.x + 40, to.overview.y + 130); context.stroke(); context.font = "14px sans-serif"; context.fillText(connection.label, (from.overview.x + to.overview.x) / 2 + 80, (from.overview.y + to.overview.y) / 2 + 110); });
  project.sceneOrder.forEach((id, index) => { const scene = project.scenes[id], x = scene.overview.x + 40, y = scene.overview.y + 80; context.fillStyle = "#fff"; context.strokeStyle = "#333"; context.lineWidth = 2; context.fillRect(x, y, 190, 100); context.strokeRect(x, y, 190, 100); context.fillStyle = "#20211f"; context.font = "700 16px sans-serif"; context.fillText(`${index + 1}. ${scene.name}`, x + 12, y + 32); context.font = "12px sans-serif"; context.fillText(`${scene.layers.length} layers / ${scene.annotations.length} notes`, x + 12, y + 58); }); return canvas;
}

function findLayerCenter(layers, targetId, offsetX = 0, offsetY = 0) {
  for (const layer of layers) {
    const x = offsetX + layer.transform.x, y = offsetY + layer.transform.y;
    if (layer.id === targetId) return { x: x + layer.transform.width / 2, y: y + layer.transform.height / 2 };
    if (layer.type === "group") {
      const result = findLayerCenter(layer.children, targetId, x, y);
      if (result) return result;
    }
  }
  return null;
}

function connectedSceneNames(project, sceneId, direction) {
  return project.connections
    .filter((connection) => direction === "upstream" ? connection.toSceneId === sceneId : connection.fromSceneId === sceneId)
    .map((connection) => {
      const connectedId = direction === "upstream" ? connection.fromSceneId : connection.toSceneId;
      return `${project.scenes[connectedId]?.name ?? "Unknown"}${connection.label ? ` (${connection.label})` : ""}`;
    });
}

export async function createProjectPdf(project) {
  const pdf = await PDFDocument.create();
  const canvases = [drawFlowPage(project)];
  for (const sceneId of project.sceneOrder) {
    const scene = project.scenes[sceneId], sceneCanvas = await renderSceneCanvas(project, sceneId, true), pageCanvas = makeCanvas(scene.width + 360, Math.max(scene.height, 600)), context = pageCanvas.getContext("2d");
    context.fillStyle = "#f4f4f0"; context.fillRect(0, 0, pageCanvas.width, pageCanvas.height); context.drawImage(sceneCanvas, 0, 0); context.fillStyle = "#20211f"; context.font = "700 22px sans-serif"; context.fillText(scene.name, scene.width + 28, 40); context.font = "14px sans-serif";
    scene.annotations.forEach((annotation, index) => {
      const y = 85 + index * 90, target = annotation.targetLayerId ? findLayerCenter(scene.layers, annotation.targetLayerId) : null;
      if (target) { context.strokeStyle = "#94a326"; context.lineWidth = 2; context.beginPath(); context.moveTo(target.x, target.y); context.lineTo(scene.width + 25, y - 5); context.stroke(); }
      context.fillStyle = "#d9ff43"; context.beginPath(); context.arc(scene.width + 40, y - 5, 14, 0, Math.PI * 2); context.fill(); context.fillStyle = "#20211f"; context.fillText(String(index + 1), scene.width + 35, y); context.fillText(annotation.text, scene.width + 65, y);
    });
    const upstream = connectedSceneNames(project, sceneId, "upstream"), downstream = connectedSceneNames(project, sceneId, "downstream"), relationY = pageCanvas.height - 52;
    context.fillStyle = "#686a65"; context.font = "13px sans-serif"; context.fillText(`上游：${upstream.join("、") || "無"}`, scene.width + 28, relationY); context.fillText(`下游：${downstream.join("、") || "無"}`, scene.width + 28, relationY + 24);
    canvases.push(pageCanvas);
  }
  for (const canvas of canvases) { const png = await pdf.embedPng(canvas.toDataURL("image/png")); const page = pdf.addPage([canvas.width, canvas.height]); page.drawImage(png, { x: 0, y: 0, width: canvas.width, height: canvas.height }); }
  return pdf.save();
}
