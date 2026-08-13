"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  addLayer,
  addAnnotation,
  addConnection,
  addReelColumn,
  addReelGridLayer,
  addScene,
  addSymbol,
  addTextLayer,
  alignLayers,
  assignReelSymbol,
  commitHistory,
  createHistory,
  createId,
  createProject,
  deserializeProject,
  distributeLayers,
  duplicateScene,
  findLayer,
  groupLayers,
  importSceneTemplate,
  projectAssetBytes,
  redoHistory,
  removeAnnotation,
  removeConnection,
  removeReelColumn,
  replaceLayerWithImage,
  renameScene,
  reorderScene,
  resetImagePlaceholder,
  serializeProject,
  undoHistory,
  ungroupLayer,
  updateEditorSettings,
  updateAnnotation,
  updateConnection,
  updateLayer,
  updateReelColumn,
  updateSceneOverview,
  updateSymbol,
} from "../lib/editor-model.js";
import { loadRecoveryProject, saveRecoveryProject } from "../lib/recovery-storage.js";
import { buildPrototypePsd, PROTOTYPE_FILE_NAME } from "../lib/psd-prototype.js";
import { createProjectPackage, createTemplatePackage, openProjectPackage, openTemplatePackage } from "../lib/project-package.js";
import { buildSceneFileNames, createProjectPdf, createPsdZip, createScenePsd } from "../lib/export-engine.js";

const LEGACY_RECOVERY_KEY = "slotboard:m1-recovery";
const tools = [
  ["rectangle", "矩形", "□"], ["ellipse", "圓形", "○"], ["triangle", "三角", "△"],
  ["star", "星形", "☆"], ["polygon", "多邊形", "⬡"], ["line", "直線", "╱"], ["arrow", "箭頭", "→"],
];

function loadRecovery() {
  try {
    const saved = localStorage.getItem(LEGACY_RECOVERY_KEY);
    return saved ? deserializeProject(saved) : createProject();
  } catch {
    return createProject();
  }
}

function readFileAsDataUrl(file: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function readImageSize(dataUrl: string) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = reject;
    image.src = dataUrl;
  });
}

async function createReducedImage(dataUrl: string, width: number, height: number) {
  const scale = Math.min(1, 8192 / width, 8192 / height);
  const targetWidth = Math.max(1, Math.round(width * scale));
  const targetHeight = Math.max(1, Math.round(height * scale));
  const image = new Image();
  await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = reject; image.src = dataUrl; });
  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  canvas.getContext("2d")?.drawImage(image, 0, 0, targetWidth, targetHeight);
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("圖片縮小失敗")), "image/webp", .9));
  return { dataUrl: await readFileAsDataUrl(blob), blob, width: targetWidth, height: targetHeight };
}

function shapePoints(kind: string, width: number, height: number) {
  if (kind === "triangle") return `${width / 2},0 ${width},${height} 0,${height}`;
  if (kind === "polygon") return `${width * .25},0 ${width * .75},0 ${width},${height / 2} ${width * .75},${height} ${width * .25},${height} 0,${height / 2}`;
  if (kind === "star") {
    const points = [];
    for (let index = 0; index < 10; index += 1) {
      const angle = -Math.PI / 2 + index * Math.PI / 5;
      const radius = index % 2 === 0 ? Math.min(width, height) / 2 : Math.min(width, height) / 4.4;
      points.push(`${width / 2 + Math.cos(angle) * radius},${height / 2 + Math.sin(angle) * radius}`);
    }
    return points.join(" ");
  }
  return "";
}

function ShapeVisual({ layer }: { layer: any }) {
  const { width, height } = layer.transform;
  const common = { fill: layer.fill, stroke: layer.stroke, strokeWidth: layer.strokeWidth, vectorEffect: "non-scaling-stroke" as const };
  if (layer.kind === "rectangle") return <rect width={width} height={height} rx={6} {...common} />;
  if (layer.kind === "ellipse") return <ellipse cx={width / 2} cy={height / 2} rx={width / 2} ry={height / 2} {...common} />;
  if (["triangle", "star", "polygon"].includes(layer.kind)) return <polygon points={shapePoints(layer.kind, width, height)} {...common} />;
  return <line x1={4} y1={height / 2} x2={width - 8} y2={height / 2} {...common} markerEnd={layer.kind === "arrow" ? "url(#arrowhead)" : undefined} />;
}

function ImageVisual({ layer, asset }: { layer: any; asset: any }) {
  const { width, height } = layer.transform;
  const scale = layer.fit === "contain" ? 1 : layer.imageScale ?? 1;
  const imageWidth = width * scale;
  const imageHeight = height * scale;
  const x = -(imageWidth - width) * (layer.focalPoint?.x ?? .5);
  const y = -(imageHeight - height) * (layer.focalPoint?.y ?? .5);
  const clipId = `clip_${layer.id}`;
  return <>
    <defs><clipPath id={clipId}><rect width={width} height={height} rx={layer.cornerRadius ?? 0} /></clipPath></defs>
    <rect width={width} height={height} rx={layer.cornerRadius ?? 0} fill="#52534f" />
    <image href={asset?.dataUrl} x={x} y={y} width={imageWidth} height={imageHeight} preserveAspectRatio={layer.fit === "contain" ? "xMidYMid meet" : "xMidYMid slice"} clipPath={`url(#${clipId})`} />
  </>;
}

function TextVisual({ layer }: { layer: any }) {
  const { width, height } = layer.transform;
  const lines = String(layer.text).split("\n");
  const anchor = layer.textAlign === "left" ? "start" : layer.textAlign === "right" ? "end" : "middle";
  const x = layer.textAlign === "left" ? 8 : layer.textAlign === "right" ? width - 8 : width / 2;
  const totalHeight = lines.length * layer.fontSize * layer.lineHeight;
  const startY = layer.verticalAlign === "top" ? layer.fontSize : layer.verticalAlign === "bottom" ? height - totalHeight + layer.fontSize : (height - totalHeight) / 2 + layer.fontSize;
  return <>
    {layer.background !== "transparent" && <rect width={width} height={height} rx={5} fill={layer.background} />}
    <text x={x} y={startY} textAnchor={anchor} fill={layer.color} stroke={layer.textStroke} strokeWidth={layer.textStrokeWidth} paintOrder="stroke" fontFamily={layer.fontFamily} fontSize={layer.fontSize} fontWeight={layer.fontWeight} fontStyle={layer.fontStyle} letterSpacing={layer.letterSpacing}>
      {lines.map((line: string, index: number) => <tspan key={index} x={x} dy={index === 0 ? 0 : layer.fontSize * layer.lineHeight}>{line || " "}</tspan>)}
    </text>
  </>;
}

function ReelGridVisual({ layer, symbols }: { layer: any; symbols: any }) {
  const { width, height } = layer.transform;
  const columnWidth = (width - layer.gap * (layer.columns.length + 1)) / layer.columns.length;
  return <>
    <rect width={width} height={height} rx={7} fill="#252622" stroke={layer.frameColor} strokeWidth={3} />
    {layer.columns.map((column: any[], columnIndex: number) => {
      const cellHeight = (height - layer.gap * (column.length + 1)) / column.length;
      return column.map((symbolId, rowIndex) => {
        const symbol = symbolId ? symbols[symbolId] : null;
        const x = layer.gap + columnIndex * (columnWidth + layer.gap);
        const y = layer.gap + rowIndex * (cellHeight + layer.gap);
        return <g key={`${columnIndex}_${rowIndex}`}>
          <rect x={x} y={y} width={columnWidth} height={cellHeight} rx={4} fill={symbol?.color ?? layer.cellColor} stroke="#ffffff55" />
          <text x={x + columnWidth / 2} y={y + cellHeight / 2 + 5} textAnchor="middle" fill="#292a27" fontSize={Math.min(18, cellHeight / 3)} fontWeight={800}>{symbol?.name?.slice(0, 4) ?? "＋"}</text>
        </g>;
      });
    })}
  </>;
}

function LayerVisual({ layer, assets, selectedIds, onSelect }: { layer: any; assets: any; selectedIds: string[]; onSelect: (event: any, id: string) => void }) {
  if (!layer.visible) return null;
  const transform = layer.transform;
  const flipX = transform.flipX ? -1 : 1;
  const flipY = transform.flipY ? -1 : 1;
  const transformValue = `translate(${transform.x} ${transform.y}) rotate(${transform.rotation} ${transform.width / 2} ${transform.height / 2}) translate(${transform.flipX ? transform.width : 0} ${transform.flipY ? transform.height : 0}) scale(${flipX} ${flipY})`;
  return (
    <g transform={transformValue} opacity={layer.opacity} onPointerDown={(event) => onSelect(event, layer.id)} style={{ cursor: layer.locked ? "not-allowed" : "move" }}>
      {layer.type === "group"
        ? layer.children.map((child: any) => <LayerVisual key={child.id} layer={child} assets={assets} selectedIds={selectedIds} onSelect={onSelect} />)
        : layer.type === "image" ? <ImageVisual layer={layer} asset={assets[layer.assetId]} />
          : layer.type === "text" ? <TextVisual layer={layer} />
            : layer.type === "reelGrid" ? <ReelGridVisual layer={layer} symbols={assets.__symbols ?? {}} /> : <ShapeVisual layer={layer} />}
      {selectedIds.includes(layer.id) && (
        <g className="selection-box">
          <rect width={transform.width} height={transform.height} fill="none" stroke="#d9ff43" strokeWidth={2} vectorEffect="non-scaling-stroke" pointerEvents="none" />
          <circle cx={transform.width} cy={transform.height} r={7} fill="#d9ff43" stroke="#20211f" strokeWidth={2} data-handle="resize" />
          <line x1={transform.width / 2} y1={0} x2={transform.width / 2} y2={-26} stroke="#d9ff43" strokeWidth={2} vectorEffect="non-scaling-stroke" pointerEvents="none" />
          <circle cx={transform.width / 2} cy={-31} r={7} fill="#fff" stroke="#20211f" strokeWidth={2} data-handle="rotate" />
        </g>
      )}
    </g>
  );
}

function LayerTree({ layers, selectedIds, onSelect, onToggle, depth = 0 }: any) {
  return layers.map((layer: any) => (
    <div key={layer.id}>
      <div className={`m1-layer-row ${selectedIds.includes(layer.id) ? "selected" : ""}`} style={{ paddingLeft: 12 + depth * 18 }} onClick={(event) => onSelect(event, layer.id)}>
        <button title={layer.visible ? "隱藏" : "顯示"} onClick={(event) => { event.stopPropagation(); onToggle(layer.id, "visible"); }}>{layer.visible ? "●" : "○"}</button>
        <span className="layer-kind">{layer.type === "group" ? "▣" : "◆"}</span>
        <span className="layer-label"><b>{layer.name}</b><small>{layer.type === "group" ? `${layer.children.length} 個子圖層` : layer.type === "image" ? "圖片" : layer.type === "text" ? "文字" : layer.type === "reelGrid" ? `${layer.columns.length} 軸` : layer.kind}</small></span>
        <button title={layer.locked ? "解鎖" : "鎖定"} onClick={(event) => { event.stopPropagation(); onToggle(layer.id, "locked"); }}>{layer.locked ? "🔒" : "·"}</button>
      </div>
      {layer.type === "group" && layer.opened !== false && <LayerTree layers={layer.children} selectedIds={selectedIds} onSelect={onSelect} onToggle={onToggle} depth={depth + 1} />}
    </div>
  ));
}

function SceneThumbnail({ scene }: { scene: any }) {
  const render = (layers: any[]): any[] => [...layers].reverse().flatMap((layer): any[] => {
    if (!layer.visible) return [];
    if (layer.type === "group") return render(layer.children);
    const transform = layer.transform;
    const fill = layer.type === "text" ? "#eeeeea" : layer.type === "image" ? "#b8c0aa" : layer.type === "reelGrid" ? "#777872" : layer.fill === "transparent" ? "#c8c9c4" : layer.fill;
    return [<rect key={layer.id} x={transform.x} y={transform.y} width={transform.width} height={transform.height} fill={fill ?? "#aaa"} stroke={layer.stroke ?? "#ffffff55"} strokeWidth={Math.max(1, layer.strokeWidth ?? 1)} />];
  });
  return <svg className="m3-scene-thumbnail" viewBox={`0 0 ${scene.width} ${scene.height}`}><rect width={scene.width} height={scene.height} fill="#3f403c" />{render(scene.layers)}</svg>;
}

function FlowOverview({ project, activeSceneId, connectionFrom, onSelect, onStartConnection, onConnect, onMove, onUpdateConnection, onRemoveConnection }: any) {
  const drag = useRef<any>(null);
  return <div className="m3-flow-canvas" onPointerMove={(event) => {
    if (!drag.current) return;
    onMove(drag.current.id, { x: drag.current.x + event.clientX - drag.current.startX, y: drag.current.y + event.clientY - drag.current.startY });
  }} onPointerUp={() => { drag.current = null; }}>
    <svg className="m3-connections">
      <defs><marker id="flowArrow" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto"><path d="M0 0 L10 4 L0 8 Z" fill="#6f772f" /></marker></defs>
      {project.connections.map((connection: any) => {
        const from = project.scenes[connection.fromSceneId]?.overview;
        const to = project.scenes[connection.toSceneId]?.overview;
        if (!from || !to) return null;
        const x1 = from.x + 190, y1 = from.y + 62, x2 = to.x, y2 = to.y + 62;
        return <g key={connection.id}><path d={`M${x1} ${y1} C${x1 + 70} ${y1}, ${x2 - 70} ${y2}, ${x2} ${y2}`} fill="none" stroke="#6f772f" strokeWidth="2" markerEnd="url(#flowArrow)" /><foreignObject x={(x1 + x2) / 2 - 55} y={(y1 + y2) / 2 - 18} width="110" height="36"><div className="flow-edge-label"><input value={connection.label} onChange={(event) => onUpdateConnection(connection.id, event.target.value)} /><button onClick={() => onRemoveConnection(connection.id)}>×</button></div></foreignObject></g>;
      })}
    </svg>
    {project.sceneOrder.map((id: string, index: number) => {
      const scene = project.scenes[id];
      return <div key={id} className={`m3-flow-card ${id === activeSceneId ? "active" : ""} ${id === connectionFrom ? "connecting" : ""}`} style={{ left: scene.overview.x, top: scene.overview.y }} onPointerDown={(event) => { if ((event.target as Element).closest("button")) return; drag.current = { id, x: scene.overview.x, y: scene.overview.y, startX: event.clientX, startY: event.clientY }; onSelect(id); }}>
        <span className="flow-card-index">{String(index + 1).padStart(2, "0")}</span><div className="flow-card-preview"><SceneThumbnail scene={scene} /></div><b>{scene.name}</b><small>{scene.layers.length} layers · {scene.annotations.length} notes</small>
        <div><button onClick={() => onStartConnection(id)}>起點</button>{connectionFrom && connectionFrom !== id && <button className="connect-target" onClick={() => onConnect(id)}>連到這裡</button>}</div>
      </div>;
    })}
    <div className="m3-flow-hint">拖曳 Scene 排列流程；先按「起點」，再按另一張卡片的「連到這裡」。流程可分支及迴圈。</div>
  </div>;
}

export function SlotBoardEditor() {
  const [history, setHistory] = useState(() => createHistory(loadRecovery()));
  const [activeSceneId, setActiveSceneId] = useState(() => history.present.sceneOrder[0]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [guides, setGuides] = useState<{ x?: number; y?: number }>({});
  const [notice, setNotice] = useState("");
  const [viewMode, setViewMode] = useState<"scene" | "flow">("scene");
  const [connectionFrom, setConnectionFrom] = useState<string | null>(null);
  const [exportBusy, setExportBusy] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const historyRef = useRef(history);
  const dragRef = useRef<any>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const packageInputRef = useRef<HTMLInputElement>(null);

  const project = history.present;
  const scene = project.scenes[activeSceneId] ?? project.scenes[project.sceneOrder[0]];
  const selectedLayer: any = selectedIds.length === 1 ? findLayer(scene.layers, selectedIds[0]) : null;

  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  useEffect(() => {
    loadRecoveryProject()
      .then((saved: any) => {
        if (saved) {
          const restored = deserializeProject(saved);
          setHistory(createHistory(restored));
          setActiveSceneId(restored.sceneOrder[0]);
        }
      })
      .catch(() => setNotice("無法讀取恢復草稿，已使用目前專案"))
      .finally(() => setRecoveryReady(true));
  }, []);

  useEffect(() => {
    if (!recoveryReady) return;
    const timer = window.setTimeout(() => {
      saveRecoveryProject(serializeProject(history.present)).catch(() => setNotice("恢復草稿寫入失敗，請立即匯出專案"));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [history.present, recoveryReady]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      if (event.key.toLowerCase() === "z") {
        event.preventDefault();
        setHistory((current: any) => event.shiftKey ? redoHistory(current) : undoHistory(current));
      }
      if (event.key.toLowerCase() === "y") {
        event.preventDefault();
        setHistory((current: any) => redoHistory(current));
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  const sceneIndex = project.sceneOrder.indexOf(activeSceneId);
  const flattenedCount = useMemo(() => {
    let count = 0;
    const visit = (layers: any[]) => layers.forEach((layer) => { count += 1; if (layer.children) visit(layer.children); });
    visit(scene.layers);
    return count;
  }, [scene.layers]);

  function commit(nextProject: any) {
    setHistory((current: any) => commitHistory(current, nextProject));
  }

  function selectLayer(event: any, id: string) {
    event.stopPropagation();
    const layer: any = findLayer(scene.layers, id);
    if (!layer || layer.locked) return;
    const nextSelection = event.shiftKey
      ? selectedIds.includes(id) ? selectedIds.filter((item) => item !== id) : [...selectedIds, id]
      : [id];
    setSelectedIds(nextSelection);
    if (nextSelection.length !== 1) return;
    const target = event.target as Element;
    const handle = target.getAttribute?.("data-handle");
    const mode = handle === "resize" ? "resize" : handle === "rotate" ? "rotate" : "move";
    dragRef.current = {
      id,
      mode,
      startX: event.clientX,
      startY: event.clientY,
      baseHistory: historyRef.current,
      baseTransform: structuredClone(layer.transform),
      latest: historyRef.current.present,
    };
    (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
  }

  function pointerMove(event: any) {
    const drag = dragRef.current;
    if (!drag) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const scale = scene.width / rect.width;
    const dx = (event.clientX - drag.startX) * scale;
    const dy = (event.clientY - drag.startY) * scale;
    const next = updateLayer(drag.baseHistory.present, activeSceneId, drag.id, (layer: any) => {
      if (drag.mode === "move") {
        let x = Math.round(drag.baseTransform.x + dx);
        let y = Math.round(drag.baseTransform.y + dy);
        const nextGuides: { x?: number; y?: number } = {};
        if (project.editorSettings.snap) {
          const threshold = project.editorSettings.snapDistance ?? 8;
          const xTargets = [0, scene.width / 2 - layer.transform.width / 2, scene.width - layer.transform.width];
          const yTargets = [0, scene.height / 2 - layer.transform.height / 2, scene.height - layer.transform.height];
          scene.layers.forEach((other: any) => {
            if (other.id === layer.id || !other.transform) return;
            xTargets.push(other.transform.x, other.transform.x + other.transform.width / 2 - layer.transform.width / 2, other.transform.x + other.transform.width - layer.transform.width);
            yTargets.push(other.transform.y, other.transform.y + other.transform.height / 2 - layer.transform.height / 2, other.transform.y + other.transform.height - layer.transform.height);
          });
          const snapX = xTargets.find((target) => Math.abs(target - x) <= threshold);
          const snapY = yTargets.find((target) => Math.abs(target - y) <= threshold);
          if (snapX !== undefined) { x = Math.round(snapX); nextGuides.x = x + layer.transform.width / 2; }
          if (snapY !== undefined) { y = Math.round(snapY); nextGuides.y = y + layer.transform.height / 2; }
        }
        layer.transform.x = x;
        layer.transform.y = y;
        setGuides(nextGuides);
      } else if (drag.mode === "resize") {
        layer.transform.width = Math.max(24, Math.round(drag.baseTransform.width + dx));
        layer.transform.height = Math.max(24, Math.round(drag.baseTransform.height + dy));
      } else {
        const cx = drag.baseTransform.x + drag.baseTransform.width / 2;
        const cy = drag.baseTransform.y + drag.baseTransform.height / 2;
        const px = (event.clientX - rect.left) * scale;
        const py = (event.clientY - rect.top) * scale;
        layer.transform.rotation = Math.round(Math.atan2(py - cy, px - cx) * 180 / Math.PI + 90);
      }
    });
    drag.latest = next;
    setHistory({ ...drag.baseHistory, present: next });
  }

  function pointerUp() {
    const drag = dragRef.current;
    if (!drag) return;
    setHistory(commitHistory(drag.baseHistory, drag.latest));
    dragRef.current = null;
    setGuides({});
  }

  function downloadPsd() {
    const bytes = buildPrototypePsd();
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const url = URL.createObjectURL(new Blob([buffer], { type: "image/vnd.adobe.photoshop" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = PROTOTYPE_FILE_NAME;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function downloadBytes(bytes: Uint8Array, fileName: string, type = "application/zip") {
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const url = URL.createObjectURL(new Blob([buffer], { type }));
    const link = document.createElement("a");
    link.href = url; link.download = fileName; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportProject() {
    const result = createProjectPackage(project);
    downloadBytes(result.bytes, result.fileName);
    setNotice(`已匯出 ${result.fileName}`);
  }

  function exportTemplate() {
    const result = createTemplatePackage(project, activeSceneId);
    downloadBytes(result.bytes, result.fileName);
    setNotice(`已匯出 Scene 模板：${result.fileName}`);
  }

  async function importPackage(file?: File) {
    if (!file) return;
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (file.name.toLowerCase().endsWith(".slottemplate")) {
        const result = importSceneTemplate(project, openTemplatePackage(bytes));
        commit(result.project); setActiveSceneId(result.sceneId); setViewMode("scene");
        setNotice(`已匯入模板：${file.name}`);
      } else {
        const opened = deserializeProject(JSON.stringify(openProjectPackage(bytes)));
        setHistory(createHistory(opened)); setActiveSceneId(opened.sceneOrder[0]); setSelectedIds([]);
        setNotice(`已開啟專案：${file.name}`);
      }
    } catch (error) {
      setNotice(`無法匯入：${error instanceof Error ? error.message : "檔案損壞"}`);
    }
  }

  async function exportSinglePsd() {
    setExportBusy(true);
    try {
      const bytes = await createScenePsd(project, activeSceneId);
      const file = buildSceneFileNames(project).find((item: any) => item.sceneId === activeSceneId);
      downloadBytes(bytes, `${file?.base ?? "Scene"}.psd`, "image/vnd.adobe.photoshop");
    } catch (error) { setNotice(`PSD 輸出失敗：${error instanceof Error ? error.message : "未知錯誤"}`); }
    finally { setExportBusy(false); }
  }

  async function exportAllPsd() {
    setExportBusy(true);
    try { downloadBytes(await createPsdZip(project), `${project.name}_PSD.zip`); }
    catch (error) { setNotice(`批次 PSD 失敗：${error instanceof Error ? error.message : "未知錯誤"}`); }
    finally { setExportBusy(false); }
  }

  async function exportPdf() {
    setExportBusy(true);
    try { downloadBytes(await createProjectPdf(project), `${project.name}_分鏡.pdf`, "application/pdf"); }
    catch (error) { setNotice(`PDF 輸出失敗：${error instanceof Error ? error.message : "未知錯誤"}`); }
    finally { setExportBusy(false); }
  }

  function updateSelected(property: string, value: any) {
    if (!selectedLayer) return;
    commit(updateLayer(project, activeSceneId, selectedLayer.id, (layer: any) => {
      if (property in layer.transform) layer.transform[property] = Number(value);
      else layer[property] = value;
    }));
  }

  async function importImage(file?: File) {
    if (!file || !selectedLayer || selectedLayer.type === "group") return;
    if (!file.type.startsWith("image/")) { setNotice("請選擇 PNG、JPG、WebP 等圖片檔"); return; }
    let dataUrl = await readFileAsDataUrl(file);
    let { width, height } = await readImageSize(dataUrl);
    let blob: Blob = file;
    if (file.size > 20 * 1024 * 1024 || width > 8192 || height > 8192) {
      const accepted = window.confirm(`圖片為 ${width}×${height}、${(file.size / 1024 / 1024).toFixed(1)} MB，超過單張限制。是否建立縮小副本？`);
      if (!accepted) return;
      const reduced = await createReducedImage(dataUrl, width, height);
      ({ dataUrl, width, height, blob } = reduced);
      if (blob.size > 20 * 1024 * 1024) { setNotice("縮小後仍超過 20 MB，請先在圖片工具中降低尺寸"); return; }
    }
    if (projectAssetBytes(project) + blob.size > 200 * 1024 * 1024) { setNotice("專案素材總量將超過 200 MB，無法匯入"); return; }
    const asset = { id: createId("asset"), name: file.name, mimeType: blob.type || file.type, byteLength: blob.size, width, height, dataUrl };
    commit(replaceLayerWithImage(project, activeSceneId, selectedLayer.id, asset));
    setNotice(`已置換圖片：${file.name}`);
  }

  function align(mode: string) { commit(alignLayers(project, activeSceneId, selectedIds, mode)); }
  function distribute(axis: string) { commit(distributeLayers(project, activeSceneId, selectedIds, axis)); }

  return (
    <main className="m1-shell">
      <header className="m1-topbar">
        <div className="m1-brand"><span>SB</span><div><small>SLOTBOARD · M2</small><b>{project.name}</b></div></div>
        <div className="m1-history">
          <button onClick={() => setHistory((current: any) => undoHistory(current))} disabled={!history.past.length} title="復原 Ctrl+Z">↶</button>
          <button onClick={() => setHistory((current: any) => redoHistory(current))} disabled={!history.future.length} title="重做 Ctrl+Y">↷</button>
          <button className={viewMode === "scene" ? "mode-active" : ""} onClick={() => setViewMode("scene")}>Scene</button>
          <button className={viewMode === "flow" ? "mode-active" : ""} onClick={() => setViewMode("flow")}>流程</button>
          <span>{recoveryReady ? "自動儲存開啟" : "載入草稿…"}</span>
        </div>
        <div className="m1-actions"><button className="secondary" onClick={() => packageInputRef.current?.click()}>開啟</button><button className="secondary" onClick={exportProject}>儲存</button><button className="secondary" onClick={exportTemplate}>模板</button><button className="secondary" onClick={() => setShowExport(true)}>輸出</button><button className="accent" onClick={() => { const result = addScene(project); commit(result.project); setActiveSceneId(result.sceneId); setSelectedIds([]); }}>＋ Scene</button><input className="visually-hidden" ref={packageInputRef} type="file" accept=".slotboard,.slottemplate" onChange={(event) => { void importPackage(event.target.files?.[0]); event.target.value = ""; }} /></div>
      </header>

      <div className="m1-workspace">
        <aside className="m1-scenes">
          <div className="m1-panel-title"><span>SCENES</span><b>{project.sceneOrder.length}</b></div>
          <div className="m1-scene-list">
            {project.sceneOrder.map((id: string, index: number) => {
              const item = project.scenes[id];
              return <button key={id} className={`m1-scene-item ${id === activeSceneId ? "active" : ""}`} onClick={() => { setActiveSceneId(id); setSelectedIds([]); }}>
                <span className="m1-scene-index">{String(index + 1).padStart(2, "0")}</span>
                <span className="m1-thumb"><SceneThumbnail scene={item} /></span>
                <span><b>{item.name}</b><small>{item.width} × {item.height}</small></span>
              </button>;
            })}
          </div>
          <div className="m1-scene-controls">
            <button onClick={() => commit(reorderScene(project, activeSceneId, -1))} disabled={sceneIndex <= 0}>上移</button>
            <button onClick={() => commit(reorderScene(project, activeSceneId, 1))} disabled={sceneIndex === project.sceneOrder.length - 1}>下移</button>
            <button onClick={() => { const result = duplicateScene(project, activeSceneId); commit(result.project); setActiveSceneId(result.sceneId); }}>複製</button>
          </div>
          <label className="m1-field scene-name"><span>SCENE 名稱</span><input value={scene.name} onChange={(event) => commit(renameScene(project, activeSceneId, event.target.value))} /></label>
        </aside>

        <section className="m1-center">
          {viewMode === "scene" ? <>
          <div className="m1-toolstrip">
            {tools.map(([kind, label, icon]) => <button key={kind} title={`新增${label}`} onClick={() => { const next = addLayer(project, activeSceneId, kind); commit(next); setSelectedIds([next.scenes[activeSceneId].layers[0].id]); }}><b>{icon}</b><small>{label}</small></button>)}
            <button title="新增文字" onClick={() => { const next = addTextLayer(project, activeSceneId); commit(next); setSelectedIds([next.scenes[activeSceneId].layers[0].id]); }}><b>T</b><small>文字</small></button>
            <button title="新增 Reel Grid" onClick={() => { const next = addReelGridLayer(project, activeSceneId); commit(next); setSelectedIds([next.scenes[activeSceneId].layers[0].id]); }}><b>▦</b><small>Reel Grid</small></button>
            <span className="tool-divider" />
            <button disabled={selectedIds.length < 2} onClick={() => { const result = groupLayers(project, activeSceneId, selectedIds); commit(result.project); if (result.groupId) setSelectedIds([result.groupId]); }}><b>▣</b><small>群組</small></button>
            <button disabled={selectedLayer?.type !== "group"} onClick={() => { commit(ungroupLayer(project, activeSceneId, selectedLayer.id)); setSelectedIds([]); }}><b>▦</b><small>解散</small></button>
            <button disabled={!selectedLayer || selectedLayer.type === "group"} onClick={() => imageInputRef.current?.click()}><b>▧</b><small>換圖片</small></button>
            <input ref={imageInputRef} className="visually-hidden" type="file" accept="image/*" onChange={(event) => { void importImage(event.target.files?.[0]); event.target.value = ""; }} />
          </div>
          <div className={`m1-stage-wrap ${project.editorSettings.pixelGrid ? "pixel-grid" : ""}`} onPointerDown={() => setSelectedIds([])}>
            <div className="m3-editor-plane">
            <svg className="m1-canvas" viewBox={`0 0 ${scene.width} ${scene.height}`} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp} aria-label={`${scene.name} 編輯畫布`}>
              <defs><marker id="arrowhead" markerWidth="12" markerHeight="10" refX="10" refY="5" orient="auto"><path d="M0 0 L10 5 L0 10 Z" fill="#f2f2ed" /></marker></defs>
              <rect width={scene.width} height={scene.height} fill="#31322f" />
              {[...scene.layers].reverse().map((layer: any) => <LayerVisual key={layer.id} layer={layer} assets={{ ...project.assets, __symbols: project.symbols }} selectedIds={selectedIds} onSelect={selectLayer} />)}
              {project.editorSettings.guides && guides.x !== undefined && <line x1={guides.x} x2={guides.x} y1={0} y2={scene.height} stroke="#d9ff43" strokeWidth={1} vectorEffect="non-scaling-stroke" pointerEvents="none" />}
              {project.editorSettings.guides && guides.y !== undefined && <line x1={0} x2={scene.width} y1={guides.y} y2={guides.y} stroke="#d9ff43" strokeWidth={1} vectorEffect="non-scaling-stroke" pointerEvents="none" />}
            </svg>
            <aside className="m3-annotations"><div className="m3-annotation-head"><b>SCENE 標註</b><button onClick={() => commit(addAnnotation(project, activeSceneId, "新增標註", selectedLayer?.id ?? null))}>＋</button></div>{scene.annotations.map((annotation: any, index: number) => { const target: any = annotation.targetLayerId ? findLayer(scene.layers, annotation.targetLayerId) : null; return <div className="m3-note" key={annotation.id}><span>{index + 1}</span><textarea value={annotation.text} onChange={(event) => commit(updateAnnotation(project, activeSceneId, annotation.id, { text: event.target.value }))} /><small>{annotation.targetLayerId ? `連到：${target?.name ?? "已刪除圖層"}` : "Scene 整體備註"}</small><button onClick={() => commit(removeAnnotation(project, activeSceneId, annotation.id))}>刪除</button></div>; })}</aside>
            </div>
          </div>
          <footer className="m1-statusbar"><span>Scene {sceneIndex + 1}/{project.sceneOrder.length}</span><span>{flattenedCount} 個圖層</span><span>{scene.width} × {scene.height}px</span><button className={project.editorSettings.snap ? "active" : ""} onClick={() => commit(updateEditorSettings(project, { snap: !project.editorSettings.snap }))}>吸附</button><button className={project.editorSettings.guides ? "active" : ""} onClick={() => commit(updateEditorSettings(project, { guides: !project.editorSettings.guides }))}>參考線</button><button className={project.editorSettings.pixelGrid ? "active" : ""} onClick={() => commit(updateEditorSettings(project, { pixelGrid: !project.editorSettings.pixelGrid }))}>像素格</button></footer>
          </> : <FlowOverview project={project} activeSceneId={activeSceneId} connectionFrom={connectionFrom} onSelect={setActiveSceneId} onStartConnection={(id: string) => setConnectionFrom(id)} onConnect={(id: string) => { if (connectionFrom) commit(addConnection(project, connectionFrom, id)); setConnectionFrom(null); }} onMove={(id: string, position: any) => commit(updateSceneOverview(project, id, position))} onUpdateConnection={(id: string, label: string) => commit(updateConnection(project, id, { label }))} onRemoveConnection={(id: string) => commit(removeConnection(project, id))} />}
        </section>

        <aside className="m1-right">
          <div className="m1-tabs"><b>圖層</b><span>屬性</span></div>
          <div className="m1-layer-list"><LayerTree layers={scene.layers} selectedIds={selectedIds} onSelect={selectLayer} onToggle={(id: string, prop: string) => commit(updateLayer(project, activeSceneId, id, (layer: any) => { layer[prop] = !layer[prop]; }))} /></div>
          <section className="m1-properties">
            <div className="m1-panel-title"><span>PROPERTIES</span>{selectedLayer && <b>{selectedLayer.type === "group" ? "群組" : "圖形"}</b>}</div>
            {selectedLayer ? <>
              <div className="m2-align-panel">
                <span>對齊</span>
                <div>{[["left","靠左"],["centerX","水平置中"],["right","靠右"],["top","靠上"],["centerY","垂直置中"],["bottom","靠下"]].map(([mode, title]) => <button key={mode} title={title} onClick={() => align(mode)}>{mode === "left" ? "┫" : mode === "right" ? "┣" : mode === "top" ? "┻" : mode === "bottom" ? "┳" : "╋"}</button>)}</div>
                <div><button disabled={selectedIds.length < 3} onClick={() => distribute("x")}>水平等距</button><button disabled={selectedIds.length < 3} onClick={() => distribute("y")}>垂直等距</button></div>
              </div>
              <label className="m1-field full"><span>圖層名稱</span><input value={selectedLayer.name} onChange={(event) => updateSelected("name", event.target.value)} /></label>
              <div className="m1-property-grid">
                {[['x','X'],['y','Y'],['width','W'],['height','H'],['rotation','角度']].map(([key, label]) => <label className="m1-field" key={key}><span>{label}</span><input type="number" value={Math.round(selectedLayer.transform[key])} onChange={(event) => updateSelected(key, event.target.value)} /></label>)}
                <label className="m1-field"><span>透明度</span><input type="number" min="0" max="100" value={Math.round(selectedLayer.opacity * 100)} onChange={(event) => updateSelected("opacity", Number(event.target.value) / 100)} /></label>
              </div>
              <div className="m1-flips"><button className={selectedLayer.transform.flipX ? "active" : ""} onClick={() => updateSelected("flipX", !selectedLayer.transform.flipX)}>水平翻轉</button><button className={selectedLayer.transform.flipY ? "active" : ""} onClick={() => updateSelected("flipY", !selectedLayer.transform.flipY)}>垂直翻轉</button></div>
              {selectedLayer.type === "image" && <div className="m2-special-panel">
                <div className="m1-panel-title"><span>IMAGE FIT</span><b>{project.assets[selectedLayer.assetId]?.name}</b></div>
                <div className="segmented"><button className={selectedLayer.fit === "contain" ? "active" : ""} onClick={() => updateSelected("fit", "contain")}>完整顯示</button><button className={selectedLayer.fit === "cover" ? "active" : ""} onClick={() => updateSelected("fit", "cover")}>填滿裁切</button></div>
                <label className="range-field"><span>圖片縮放 {Math.round((selectedLayer.imageScale ?? 1) * 100)}%</span><input type="range" min="1" max="3" step=".05" value={selectedLayer.imageScale ?? 1} onChange={(event) => updateSelected("imageScale", Number(event.target.value))} /></label>
                <div className="m1-property-grid"><label className="m1-field"><span>焦點 X</span><input type="number" min="0" max="100" value={Math.round(selectedLayer.focalPoint.x * 100)} onChange={(event) => updateSelected("focalPoint", { ...selectedLayer.focalPoint, x: Number(event.target.value) / 100 })} /></label><label className="m1-field"><span>焦點 Y</span><input type="number" min="0" max="100" value={Math.round(selectedLayer.focalPoint.y * 100)} onChange={(event) => updateSelected("focalPoint", { ...selectedLayer.focalPoint, y: Number(event.target.value) / 100 })} /></label></div>
                <div className="m2-special-actions"><button onClick={() => imageInputRef.current?.click()}>重新選圖</button><button onClick={() => commit(resetImagePlaceholder(project, activeSceneId, selectedLayer.id))}>重設 Placeholder</button></div>
              </div>}
              {selectedLayer.type === "text" && <div className="m2-special-panel text-panel">
                <div className="m1-panel-title"><span>TEXT</span><b>可編輯</b></div>
                <label className="m1-field full"><span>文字內容</span><textarea value={selectedLayer.text} onChange={(event) => updateSelected("text", event.target.value)} /></label>
                <label className="m1-field full"><span>開源字型</span><select value={selectedLayer.fontFamily} onChange={(event) => updateSelected("fontFamily", event.target.value)}><option>Noto Sans TC</option><option>Noto Serif TC</option><option>Noto Sans Mono</option></select></label>
                <div className="m1-property-grid"><label className="m1-field"><span>字級</span><input type="number" min="8" max="240" value={selectedLayer.fontSize} onChange={(event) => updateSelected("fontSize", Number(event.target.value))} /></label><label className="m1-field"><span>字重</span><select value={selectedLayer.fontWeight} onChange={(event) => updateSelected("fontWeight", Number(event.target.value))}><option value="400">正常</option><option value="700">粗體</option><option value="900">黑體</option></select></label><label className="m1-field"><span>行距</span><input type="number" min=".8" max="3" step=".05" value={selectedLayer.lineHeight} onChange={(event) => updateSelected("lineHeight", Number(event.target.value))} /></label><label className="m1-field"><span>字距</span><input type="number" min="-10" max="30" value={selectedLayer.letterSpacing} onChange={(event) => updateSelected("letterSpacing", Number(event.target.value))} /></label></div>
                <div className="segmented"><button className={selectedLayer.textAlign === "left" ? "active" : ""} onClick={() => updateSelected("textAlign", "left")}>靠左</button><button className={selectedLayer.textAlign === "center" ? "active" : ""} onClick={() => updateSelected("textAlign", "center")}>置中</button><button className={selectedLayer.textAlign === "right" ? "active" : ""} onClick={() => updateSelected("textAlign", "right")}>靠右</button></div>
                <div className="segmented"><button className={selectedLayer.verticalAlign === "top" ? "active" : ""} onClick={() => updateSelected("verticalAlign", "top")}>靠上</button><button className={selectedLayer.verticalAlign === "middle" ? "active" : ""} onClick={() => updateSelected("verticalAlign", "middle")}>垂直置中</button><button className={selectedLayer.verticalAlign === "bottom" ? "active" : ""} onClick={() => updateSelected("verticalAlign", "bottom")}>靠下</button></div>
                <div className="m2-color-grid"><label>文字色<input type="color" value={selectedLayer.color} onChange={(event) => updateSelected("color", event.target.value)} /></label><label>外框色<input type="color" value={selectedLayer.textStroke} onChange={(event) => updateSelected("textStroke", event.target.value)} /></label><label>底色<input type="color" value={selectedLayer.background === "transparent" ? "#20211f" : selectedLayer.background} onChange={(event) => updateSelected("background", event.target.value)} /></label><label>外框<input type="number" min="0" max="16" value={selectedLayer.textStrokeWidth} onChange={(event) => updateSelected("textStrokeWidth", Number(event.target.value))} /></label></div>
                <div className="m1-flips"><button className={selectedLayer.fontStyle === "italic" ? "active" : ""} onClick={() => updateSelected("fontStyle", selectedLayer.fontStyle === "italic" ? "normal" : "italic")}>斜體</button><button onClick={() => updateSelected("background", selectedLayer.background === "transparent" ? "#20211f" : "transparent")}>切換底色</button></div>
              </div>}
              {selectedLayer.type === "reelGrid" && <div className="m2-special-panel m3-reel-panel">
                <div className="m1-panel-title"><span>REEL GRID</span><b>{selectedLayer.columns.length} 軸</b></div>
                <div className="m3-reel-actions"><button onClick={() => commit(addReelColumn(project, activeSceneId, selectedLayer.id))}>＋軸</button><button onClick={() => commit(removeReelColumn(project, activeSceneId, selectedLayer.id))}>－軸</button><button onClick={() => { const next = addReelGridLayer(project, activeSceneId, [3,4,4,4,3]); commit(next); setSelectedIds([next.scenes[activeSceneId].layers[0].id]); }}>3-4-4-4-3 預設</button></div>
                <div className="m3-column-list">{selectedLayer.columns.map((column: any[], columnIndex: number) => <div key={columnIndex} className="m3-column-item"><label>第 {columnIndex + 1} 軸<input type="number" min="1" max="12" value={column.length} onChange={(event) => commit(updateReelColumn(project, activeSceneId, selectedLayer.id, columnIndex, Number(event.target.value)))} /></label><div>{column.map((symbolId, rowIndex) => <select key={rowIndex} value={symbolId ?? ""} onChange={(event) => commit(assignReelSymbol(project, activeSceneId, selectedLayer.id, columnIndex, rowIndex, event.target.value || null))}><option value="">Placeholder</option>{Object.values(project.symbols).map((symbol: any) => <option key={symbol.id} value={symbol.id}>{symbol.name}</option>)}</select>)}</div></div>)}</div>
              </div>}
            </> : <p className="empty-properties">選取畫布或圖層中的物件，即可精確調整位置與尺寸。</p>}
          </section>
          <section className="m3-symbol-panel"><div className="m1-panel-title"><span>PROJECT SYMBOLS</span><button onClick={() => { const result = addSymbol(project, `Symbol ${Object.keys(project.symbols).length + 1}`); commit(result.project); }}>＋ 新增</button></div>{Object.values(project.symbols).length ? Object.values(project.symbols).map((symbol: any) => <div className="m3-symbol-row" key={symbol.id}><input type="color" value={symbol.color} onChange={(event) => commit(updateSymbol(project, symbol.id, { color: event.target.value }))} /><input value={symbol.name} onChange={(event) => commit(updateSymbol(project, symbol.id, { name: event.target.value }))} /><small>{Object.values(project.scenes).reduce((count: number, item: any) => { let uses = 0; const visit = (layers: any[]) => layers.forEach((layer) => { if (layer.type === "reelGrid") layer.columns.flat().forEach((id: string) => { if (id === symbol.id) uses += 1; }); if (layer.children) visit(layer.children); }); visit(item.layers); return count + uses; }, 0)} 次引用</small></div>) : <p className="empty-properties">先新增專案 Symbol，再於 Reel Grid 的格子中引用；改名或改色會跨 Scene 同步。</p>}</section>
        </aside>
      </div>
      {notice && <button className="m2-notice" onClick={() => setNotice("")}>{notice}<span>×</span></button>}
      {showExport && <div className="m5-modal-backdrop" onClick={() => !exportBusy && setShowExport(false)}><section className="m5-export-modal" onClick={(event) => event.stopPropagation()}><div className="m5-modal-head"><div><small>EXPORT PREVIEW</small><h2>正式輸出</h2></div><button onClick={() => setShowExport(false)} disabled={exportBusy}>×</button></div><div className="m5-file-preview">{buildSceneFileNames(project).map((item: any) => <div key={item.sceneId}><span>{item.base}.psd</span><small>{project.scenes[item.sceneId].width} × {project.scenes[item.sceneId].height}</small></div>)}</div><div className="m5-export-actions"><button onClick={() => void exportSinglePsd()} disabled={exportBusy}>目前 Scene PSD</button><button onClick={() => void exportAllPsd()} disabled={exportBusy}>全部 PSD ZIP</button><button onClick={() => void exportPdf()} disabled={exportBusy}>流程與標註 PDF</button><button className="technical" onClick={downloadPsd} disabled={exportBusy}>M0 技術樣本</button></div>{exportBusy && <p className="m5-progress">正在逐層光柵化與封裝，請勿關閉頁面…</p>}</section></div>}
    </main>
  );
}
