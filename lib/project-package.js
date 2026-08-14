import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";

const MAX_FILES = 5000;
const MAX_UNCOMPRESSED_BYTES = 500 * 1024 * 1024;
const TOOL_VERSION = "0.21.1";

export function createPackageEntryFilter({ maxFiles = MAX_FILES, maxUncompressedBytes = MAX_UNCOMPRESSED_BYTES } = {}) {
  let declaredFiles = 0, declaredBytes = 0;
  return (file) => {
    if (file.name.endsWith("/")) return false;
    declaredFiles += 1;
    declaredBytes += file.originalSize;
    if (declaredFiles > maxFiles) throw new Error("Package contains too many files");
    if (declaredBytes > maxUncompressedBytes) throw new Error("Package is too large after decompression");
    return true;
  };
}

function contentHash(bytes) {
  let hash = 0x811c9dc5;
  for (const byte of bytes) { hash ^= byte; hash = Math.imul(hash, 0x01000193); }
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function sanitizeName(name) {
  const safe = [...String(name || "SlotBoard")]
    .map((character) => character.charCodeAt(0) < 32 || '<>:"/\\|?*'.includes(character) ? "_" : character)
    .join("");
  return safe.trim() || "SlotBoard";
}

function dataUrlToBytes(dataUrl) {
  const match = /^data:([^;,]+)?(;base64)?,(.*)$/.exec(dataUrl ?? "");
  if (!match) throw new Error("Invalid embedded asset");
  const mimeType = match[1] || "application/octet-stream";
  if (!match[2]) return { mimeType, bytes: strToU8(decodeURIComponent(match[3])) };
  const binary = atob(match[3]);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return { mimeType, bytes };
}

function bytesToDataUrl(bytes, mimeType) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  return `data:${mimeType};base64,${btoa(binary)}`;
}

function makeManifest(kind, source, assetIndex, contentHashes) {
  return {
    format: "slotboard-package",
    kind,
    packageVersion: 1,
    schemaVersion: source.schemaVersion,
    toolVersion: TOOL_VERSION,
    name: source.name,
    assets: assetIndex,
    contentHashes,
  };
}

function extractAssets(project) {
  const copy = structuredClone(project);
  const files = {};
  const index = [];
  Object.values(copy.assets ?? {}).forEach((asset) => {
    if (!asset.dataUrl) return;
    const { bytes, mimeType } = dataUrlToBytes(asset.dataUrl);
    const extension = mimeType.split("/")[1]?.replace("jpeg", "jpg") || "bin";
    const path = `assets/${asset.id}.${extension}`;
    files[path] = bytes;
    index.push({ id: asset.id, path, mimeType, byteLength: bytes.length, hash: contentHash(bytes) });
    delete asset.dataUrl;
  });
  return { copy, files, index };
}

export function createProjectPackage(project) {
  const { copy, files, index } = extractAssets(project);
  files["project.json"] = strToU8(JSON.stringify(copy));
  files["manifest.json"] = strToU8(JSON.stringify(makeManifest("project", project, index, { "project.json": contentHash(files["project.json"]) }), null, 2));
  return { bytes: zipSync(files, { level: 6 }), fileName: `${sanitizeName(project.name)}.slotboard` };
}

export function createTemplatePackage(project, sceneId) {
  const scene = project.scenes[sceneId];
  if (!scene) throw new Error("Scene not found");
  const symbolIds = new Set(), assetIds = new Set();
  const inspectLayers = (layers) => layers.forEach((layer) => {
    if (layer.type === "image" && layer.assetId) assetIds.add(layer.assetId);
    if (layer.type === "reelGrid") layer.columns.forEach((column) => column.forEach((symbolId) => { if (symbolId) symbolIds.add(symbolId); }));
    if (layer.children) inspectLayers(layer.children);
  });
  inspectLayers(scene.layers);
  const symbols = {};
  symbolIds.forEach((symbolId) => {
    const symbol = project.symbols?.[symbolId];
    if (!symbol) return;
    symbols[symbolId] = symbol;
    if (symbol.assetId) assetIds.add(symbol.assetId);
  });
  const assets = {};
  assetIds.forEach((assetId) => { if (project.assets?.[assetId]) assets[assetId] = project.assets[assetId]; });
  const source = { ...project, name: scene.name, scenes: { [scene.id]: scene }, sceneOrder: [scene.id], connections: [], symbols, assets };
  const { copy, files, index } = extractAssets(source);
  files["template.json"] = strToU8(JSON.stringify({ scene: copy.scenes[scene.id], symbols: copy.symbols, assets: copy.assets }));
  files["manifest.json"] = strToU8(JSON.stringify(makeManifest("template", source, index, { "template.json": contentHash(files["template.json"]) }), null, 2));
  return { bytes: zipSync(files, { level: 6 }), fileName: `${sanitizeName(scene.name)}.slottemplate` };
}

function readPackage(bytes, expectedKind) {
  const files = unzipSync(bytes, { filter: createPackageEntryFilter() });
  const entries = Object.entries(files);
  if (entries.length > MAX_FILES) throw new Error("Package contains too many files");
  const total = entries.reduce((sum, [, data]) => sum + data.length, 0);
  if (total > MAX_UNCOMPRESSED_BYTES) throw new Error("Package is too large after decompression");
  const manifestData = files["manifest.json"];
  if (!manifestData) throw new Error("Missing manifest.json");
  const manifest = JSON.parse(strFromU8(manifestData));
  if (manifest.format !== "slotboard-package" || manifest.packageVersion !== 1) throw new Error("Unsupported package format");
  if (manifest.kind !== expectedKind) throw new Error(`Expected ${expectedKind} package`);
  for (const [path, expectedHash] of Object.entries(manifest.contentHashes ?? {})) {
    if (!files[path] || contentHash(files[path]) !== expectedHash) throw new Error(`Content integrity check failed: ${path}`);
  }
  return { files, manifest };
}

function restoreAssets(container, files, manifest) {
  for (const entry of manifest.assets ?? []) {
    const bytes = files[entry.path];
    if (!bytes || bytes.length !== entry.byteLength || (entry.hash && contentHash(bytes) !== entry.hash)) throw new Error(`Missing or damaged asset: ${entry.id}`);
    if (container.assets?.[entry.id]) container.assets[entry.id].dataUrl = bytesToDataUrl(bytes, entry.mimeType);
  }
}

export function openProjectPackage(bytes) {
  const { files, manifest } = readPackage(bytes, "project");
  if (!files["project.json"]) throw new Error("Missing project.json");
  const project = JSON.parse(strFromU8(files["project.json"]));
  restoreAssets(project, files, manifest);
  return project;
}

export function openTemplatePackage(bytes) {
  const { files, manifest } = readPackage(bytes, "template");
  if (!files["template.json"]) throw new Error("Missing template.json");
  const template = JSON.parse(strFromU8(files["template.json"]));
  restoreAssets(template, files, manifest);
  return template;
}
