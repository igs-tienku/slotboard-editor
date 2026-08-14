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
  autoArrangeScenes,
  assignReelSymbol,
  commitHistory,
  copyLayerSelection,
  createHistory,
  createId,
  createProject,
  deserializeProject,
  distributeLayers,
  DEFAULT_ANNOTATION_SIZE,
  DEFAULT_CONNECTION_LABEL_SIZE,
  duplicateScene,
  findLayer,
  FLOW_WORKSPACE_LIMIT,
  groupLayers,
  importSceneTemplate,
  locateLayerInScene,
  makeEditableCopy,
  moveAnnotation,
  moveLayerByDrop,
  pasteLayerSelection,
  projectAssetBytes,
  redoHistory,
  removeAnnotation,
  removeConnection,
  removeReelColumn,
  removeLayers,
  resizeAnnotation,
  reorderLayer,
  replaceLayerWithImage,
  replaceSymbolImage,
  renameScene,
  reorderScene,
  resetImagePlaceholder,
  resetSymbolImage,
  scaleGroupChildren,
  SCENE_SIZE_PRESETS,
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
import { clampLayerTransformValue, hasDragIntent, nextFlowScenePosition, nextScrollAfterZoom, nextScrollPan, nextTranslationAfterZoom, nextTranslatedPan, nextWheelZoom, shouldReleaseNumberInputForWheel } from "../lib/interaction-math.js";
import { buildPrototypePsd, PROTOTYPE_FILE_NAME } from "../lib/psd-prototype.js";
import { createProjectPackage, createTemplatePackage, openProjectPackage, openTemplatePackage } from "../lib/project-package.js";
import { buildSceneFileNames, createProjectPdf, createPsdZip, createScenePsd, estimateExportWorkingSet } from "../lib/export-engine.js";
import { runWorkerTask, supportsSlotBoardWorker } from "../lib/worker-client";

const LEGACY_RECOVERY_KEY = "slotboard:m1-recovery";
const tools = [
  ["rectangle", "矩形", "□"], ["ellipse", "圓形", "○"], ["triangle", "三角", "△"],
  ["star", "星形", "☆"], ["polygon", "多邊形", "⬡"], ["line", "直線", "╱"], ["arrow", "箭頭", "→"],
];

const GRAYSCALE_PALETTE = [
  ["背景", "#4c4d49"], ["次要", "#777873"], ["一般", "#a6a7a2"], ["重要", "#d2d3ce"], ["最高焦點", "#f2f2ee"],
] as const;
const COLOR_PALETTE = ["#d95f59", "#e49a3a", "#dbc93d", "#78a85b", "#4f9b9b", "#5686c4", "#8668b4", "#bd6c9b"];

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
  if (supportsSlotBoardWorker()) {
    try {
      const reduced = await runWorkerTask("resizeImage", { dataUrl, width, height });
      return { ...reduced, blob: await (await fetch(reduced.dataUrl)).blob() };
    } catch {
      // Continue with the compatible main-thread path.
    }
  }
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
  if (layer.kind === "rectangle") return <rect width={width} height={height} rx={layer.cornerRadius ?? 6} {...common} />;
  if (layer.kind === "ellipse") return <ellipse cx={width / 2} cy={height / 2} rx={width / 2} ry={height / 2} {...common} />;
  if (["triangle", "star", "polygon"].includes(layer.kind)) return <polygon points={shapePoints(layer.kind, width, height)} {...common} />;
  return <>
    <line className="m20-line-hit-target" x1={0} y1={height / 2} x2={width} y2={height / 2} fill="none" stroke="transparent" strokeWidth={24} strokeLinecap="round" vectorEffect="non-scaling-stroke" pointerEvents="stroke" />
    <line x1={4} y1={height / 2} x2={width - 8} y2={height / 2} {...common} markerEnd={layer.kind === "arrow" ? "url(#arrowhead)" : undefined} />
  </>;
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

function ReelGridVisual({ layer, symbols, assets }: { layer: any; symbols: any; assets: any }) {
  const { width, height } = layer.transform;
  const columnWidth = (width - layer.gap * (layer.columns.length + 1)) / layer.columns.length;
  return <>
    <rect width={width} height={height} rx={7} fill="#252622" stroke={layer.frameColor} strokeWidth={3} />
    {layer.columns.map((column: any[], columnIndex: number) => {
      const cellHeight = (height - layer.gap * (column.length + 1)) / column.length;
      return column.map((symbolId, rowIndex) => {
        const symbol = symbolId ? symbols[symbolId] : null;
        const asset = symbol?.assetId ? assets[symbol.assetId] : null;
        const x = layer.gap + columnIndex * (columnWidth + layer.gap);
        const y = layer.gap + rowIndex * (cellHeight + layer.gap);
        const fit = symbol?.fit ?? "cover";
        const scale = asset ? (fit === "contain" ? Math.min(columnWidth / asset.width, cellHeight / asset.height) : Math.max(columnWidth / asset.width, cellHeight / asset.height)) : 1;
        const imageWidth = asset ? asset.width * scale : 0;
        const imageHeight = asset ? asset.height * scale : 0;
        const imageX = x + (columnWidth - imageWidth) * (symbol?.focalPoint?.x ?? .5);
        const imageY = y + (cellHeight - imageHeight) * (symbol?.focalPoint?.y ?? .5);
        const clipId = `symbol_clip_${layer.id}_${columnIndex}_${rowIndex}`;
        return <g key={`${columnIndex}_${rowIndex}`}>
          <defs><clipPath id={clipId}><rect x={x} y={y} width={columnWidth} height={cellHeight} rx={4} /></clipPath></defs>
          <rect x={x} y={y} width={columnWidth} height={cellHeight} rx={4} fill={symbol?.color ?? layer.cellColor} stroke="#ffffff55" />
          {asset?.dataUrl
            ? <image href={asset.dataUrl} x={imageX} y={imageY} width={imageWidth} height={imageHeight} clipPath={`url(#${clipId})`} />
            : <text x={x + columnWidth / 2} y={y + cellHeight / 2 + 5} textAnchor="middle" fill="#292a27" fontSize={Math.min(18, cellHeight / 3)} fontWeight={800}>{symbol?.name?.slice(0, 4) ?? "＋"}</text>}
        </g>;
      });
    })}
  </>;
}

function LayerVisual({ layer, assets, selectedIds, onSelect, onContextMenu, interactionId, interactionLocked }: { layer: any; assets: any; selectedIds: string[]; onSelect: (event: any, id: string) => void; onContextMenu: (event: any, id: string) => void; interactionId?: string; interactionLocked?: boolean }) {
  if (!layer.visible) return null;
  const transform = layer.transform;
  const effectiveInteractionId = interactionId ?? layer.id;
  const effectiveInteractionLocked = interactionLocked ?? layer.locked;
  const flipX = transform.flipX ? -1 : 1;
  const flipY = transform.flipY ? -1 : 1;
  const transformValue = `translate(${transform.x} ${transform.y}) rotate(${transform.rotation} ${transform.width / 2} ${transform.height / 2}) translate(${transform.flipX ? transform.width : 0} ${transform.flipY ? transform.height : 0}) scale(${flipX} ${flipY})`;
  return (
    <g transform={transformValue} opacity={layer.opacity} data-layer-locked={effectiveInteractionLocked ? "true" : undefined} onPointerDown={(event) => onSelect(event, effectiveInteractionId)} onContextMenu={(event) => onContextMenu(event, effectiveInteractionId)} style={{ cursor: effectiveInteractionLocked ? "grab" : "move" }}>
      {layer.type === "group"
        ? <>
          <rect className="m20-group-hit-target" width={transform.width} height={transform.height} fill="transparent" pointerEvents="all" />
          {layer.children.map((child: any) => <LayerVisual key={child.id} layer={child} assets={assets} selectedIds={selectedIds} onSelect={onSelect} onContextMenu={onContextMenu} interactionId={effectiveInteractionId} interactionLocked={effectiveInteractionLocked} />)}
        </>
        : layer.type === "image" ? <ImageVisual layer={layer} asset={assets[layer.assetId]} />
          : layer.type === "text" ? <TextVisual layer={layer} />
            : layer.type === "reelGrid" ? <ReelGridVisual layer={layer} symbols={assets.__symbols ?? {}} assets={assets} /> : <ShapeVisual layer={layer} />}
      {selectedIds.includes(layer.id) && effectiveInteractionId === layer.id && (
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

function LayerTree({ layers, selectedIds, onSelect, onToggle, onContextMenu, onDragStart, onDragOver, onDrop, onDragEnd, dropTarget, depth = 0 }: any) {
  return layers.map((layer: any) => (
    <div key={layer.id}>
      <div className={`m1-layer-row ${selectedIds.includes(layer.id) ? "selected" : ""} ${layer.locked ? "locked" : "draggable"} ${dropTarget?.id === layer.id ? `drop-${dropTarget.placement}` : ""}`} style={{ paddingLeft: 12 + depth * 18 }} draggable={!layer.locked} title={layer.locked ? "圖層已鎖定" : "拖曳調整圖層順序"} onDragStart={(event) => onDragStart(event, layer.id)} onDragOver={(event) => onDragOver(event, layer.id)} onDrop={(event) => onDrop(event, layer.id)} onDragEnd={onDragEnd} onClick={(event) => onSelect(event, layer.id)} onContextMenu={(event) => onContextMenu(event, layer.id)}>
        <button draggable={false} title={layer.visible ? "隱藏" : "顯示"} onClick={(event) => { event.stopPropagation(); onToggle(layer.id, "visible"); }}>{layer.visible ? "●" : "○"}</button>
        <span className="layer-kind">{layer.type === "group" ? "▣" : "◆"}</span>
        <span className="layer-label"><b>{layer.name}</b><small>{layer.type === "group" ? `${layer.children.length} 個子圖層` : layer.type === "image" ? "圖片" : layer.type === "text" ? "文字" : layer.type === "reelGrid" ? `${layer.columns.length} 軸` : layer.kind}</small></span>
        <button draggable={false} title={layer.locked ? "解鎖" : "鎖定"} onClick={(event) => { event.stopPropagation(); onToggle(layer.id, "locked"); }}>{layer.locked ? "🔒" : "·"}</button>
      </div>
      {layer.type === "group" && layer.opened !== false && <LayerTree layers={layer.children} selectedIds={selectedIds} onSelect={onSelect} onToggle={onToggle} onContextMenu={onContextMenu} onDragStart={onDragStart} onDragOver={onDragOver} onDrop={onDrop} onDragEnd={onDragEnd} dropTarget={dropTarget} depth={depth + 1} />}
    </div>
  ));
}

const sceneThumbnailCache = new Map<string, string>();
function SceneThumbnail({ scene }: { scene: any }) {
  const key = `${scene.id}:${scene.thumbnailRevision}:${scene.width}x${scene.height}`;
  let source = sceneThumbnailCache.get(key);
  if (!source) {
    const rectangles: string[] = [];
    const render = (layers: any[], offsetX = 0, offsetY = 0) => [...layers].reverse().forEach((layer: any) => {
      if (!layer.visible) return;
      if (layer.type === "group") { render(layer.children, offsetX + layer.transform.x, offsetY + layer.transform.y); return; }
      const transform = layer.transform;
      const fill = layer.type === "text" ? "#eeeeea" : layer.type === "image" ? "#b8c0aa" : layer.type === "reelGrid" ? "#777872" : layer.fill === "transparent" ? "#c8c9c4" : layer.fill;
      rectangles.push(`<rect x="${offsetX + transform.x}" y="${offsetY + transform.y}" width="${transform.width}" height="${transform.height}" fill="${fill ?? "#aaa"}" stroke="${layer.stroke ?? "#ffffff55"}" stroke-width="${Math.max(1, layer.strokeWidth ?? 1)}"/>`);
    });
    render(scene.layers);
    source = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${scene.width} ${scene.height}"><rect width="100%" height="100%" fill="#3f403c"/>${rectangles.join("")}</svg>`)}`;
    sceneThumbnailCache.set(key, source);
    if (sceneThumbnailCache.size > 200) sceneThumbnailCache.delete(sceneThumbnailCache.keys().next().value as string);
  }
  return <img className="m3-scene-thumbnail" src={source} alt="" />;
}

function layerCenter(layers: any[], targetId: string, offsetX = 0, offsetY = 0): { x: number; y: number } | null {
  for (const layer of layers) {
    const x = offsetX + layer.transform.x, y = offsetY + layer.transform.y;
    if (layer.id === targetId) return { x: x + layer.transform.width / 2, y: y + layer.transform.height / 2 };
    if (layer.children) {
      const nested = layerCenter(layer.children, targetId, x, y);
      if (nested) return nested;
    }
  }
  return null;
}

function svgClientPoint(svg: SVGSVGElement, clientX: number, clientY: number) {
  const matrix = svg.getScreenCTM();
  if (!matrix) return { x: clientX, y: clientY };
  const point = svg.createSVGPoint();
  point.x = clientX; point.y = clientY;
  const transformed = point.matrixTransform(matrix.inverse());
  return { x: transformed.x, y: transformed.y };
}

function FlowOverview({ project, activeSceneId, connectionFrom, zoom, onZoom, onAutoArrange, onSelect, onStartConnection, onConnect, onMoveStart, onMovePreview, onMoveEnd, onLabelTransformStart, onLabelTransformPreview, onLabelTransformEnd, onUpdateConnection, onRemoveConnection }: any) {
  const flowCardWidth = 220;
  const flowCardMidY = 80;
  const origin = FLOW_WORKSPACE_LIMIT;
  const width = FLOW_WORKSPACE_LIMIT * 2 + 320, height = FLOW_WORKSPACE_LIMIT * 2 + 260;
  const drag = useRef<any>(null), labelDrag = useRef<any>(null), pan = useRef<any>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const previousZoom = useRef(zoom);
  const zoomAnchor = useRef<{ x: number; y: number } | null>(null);
  const [panning, setPanning] = useState(false);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!canvas.dataset.panReady) {
      canvas.scrollLeft = (origin + flowCardWidth / 2) * zoom - canvas.clientWidth / 2;
      canvas.scrollTop = (origin + flowCardMidY) * zoom - canvas.clientHeight / 2;
      canvas.dataset.panReady = "true";
    } else if (previousZoom.current !== zoom) {
      const anchor = zoomAnchor.current ?? { x: canvas.clientWidth / 2, y: canvas.clientHeight / 2 };
      canvas.scrollLeft = nextScrollAfterZoom(canvas.scrollLeft, anchor.x, previousZoom.current, zoom);
      canvas.scrollTop = nextScrollAfterZoom(canvas.scrollTop, anchor.y, previousZoom.current, zoom);
      zoomAnchor.current = null;
    }
    previousZoom.current = zoom;
  }, [zoom, origin]);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const zoomWithWheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      const rect = canvas.getBoundingClientRect();
      zoomAnchor.current = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      onZoom(nextWheelZoom(zoom, event.deltaY, .5, 1.5));
    };
    canvas.addEventListener("wheel", zoomWithWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", zoomWithWheel);
  }, [zoom, onZoom]);
  const finishPointers = (commitMove: boolean) => {
    if (labelDrag.current) onLabelTransformEnd(commitMove && labelDrag.current.moved);
    if (drag.current) onMoveEnd(commitMove && drag.current.moved);
    labelDrag.current = null; drag.current = null; pan.current = null; setPanning(false);
  };
  return <div className="m3-flow-shell">
    <div className="m12-flow-toolbar"><button onClick={() => onZoom(Math.max(.5, zoom - .1))}>－</button><b>{Math.round(zoom * 100)}%</b><button onClick={() => onZoom(Math.min(1.5, zoom + .1))}>＋</button><button onClick={() => onZoom(1)}>100%</button><button className="arrange" onClick={onAutoArrange}>自動整理</button><span>大型工作區 ±{FLOW_WORKSPACE_LIMIT.toLocaleString()}；虛線為實際邊界</span></div>
    <div ref={canvasRef} className={`m3-flow-canvas ${panning ? "is-panning" : ""}`} onPointerDown={(event) => {
      const interactive = (event.target as Element).closest(".m3-flow-card, .flow-edge-label, button, input, textarea");
      if ((event.button !== 0 || interactive) && event.button !== 1) return;
      const canvas = event.currentTarget;
      pan.current = { startX: event.clientX, startY: event.clientY, scrollLeft: canvas.scrollLeft, scrollTop: canvas.scrollTop };
      setPanning(true); canvas.setPointerCapture?.(event.pointerId); event.preventDefault();
    }} onPointerMove={(event) => {
      if (labelDrag.current) {
        const current = labelDrag.current;
        if (!current.moved && !hasDragIntent(current.startX, current.startY, event.clientX, event.clientY)) return;
        current.moved = true;
        const dx = (event.clientX - current.startX) / zoom, dy = (event.clientY - current.startY) / zoom;
        onLabelTransformPreview(current.id, current.mode === "resize"
          ? { labelSize: { width: Math.max(150, Math.min(560, current.width + dx)), height: Math.max(80, Math.min(360, current.height + dy)) } }
          : { labelOffset: { x: current.x + dx, y: current.y + dy } });
        return;
      }
      if (pan.current) {
        const next = nextScrollPan({ left: pan.current.scrollLeft, top: pan.current.scrollTop }, pan.current.startX, pan.current.startY, event.clientX, event.clientY);
        event.currentTarget.scrollLeft = next.left; event.currentTarget.scrollTop = next.top; return;
      }
      if (!drag.current) return;
      if (!drag.current.moved && !hasDragIntent(drag.current.startX, drag.current.startY, event.clientX, event.clientY)) return;
      drag.current.moved = true;
      onMovePreview(drag.current.id, nextFlowScenePosition({ x: drag.current.x, y: drag.current.y }, drag.current.startX, drag.current.startY, event.clientX, event.clientY, zoom));
    }} onPointerUp={() => finishPointers(true)} onPointerCancel={() => finishPointers(false)}>
    <div className="m12-flow-scaled-space" style={{ width: width * zoom, height: height * zoom }}><div className="m12-flow-world" style={{ width, height, transform: `scale(${zoom})` }}>
    <svg className="m3-connections" style={{ width, height }}>
      <defs><marker id="flowArrow" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto"><path d="M0 0 L10 4 L0 8 Z" fill="#6f772f" /></marker></defs>
      <rect className="m20-flow-boundary" x="1" y="1" width={width - 2} height={height - 2} rx="3" />
      <text className="m20-flow-boundary-label" x="24" y="42">工作區邊界 −{FLOW_WORKSPACE_LIMIT.toLocaleString()}</text>
      {project.connections.map((connection: any) => {
        const from = project.scenes[connection.fromSceneId]?.overview, to = project.scenes[connection.toSceneId]?.overview;
        if (!from || !to) return null;
        const x1 = from.x + flowCardWidth + origin, y1 = from.y + flowCardMidY + origin, x2 = to.x + origin, y2 = to.y + flowCardMidY + origin;
        const offset = connection.labelOffset ?? { x: 0, y: 0 }, size = connection.labelSize ?? DEFAULT_CONNECTION_LABEL_SIZE;
        const labelX = (x1 + x2) / 2 - size.width / 2 + offset.x, labelY = (y1 + y2) / 2 - size.height / 2 + offset.y;
        const startLabelTransform = (event: any, mode: "move" | "resize") => {
          event.preventDefault(); event.stopPropagation();
          labelDrag.current = { id: connection.id, mode, startX: event.clientX, startY: event.clientY, x: offset.x, y: offset.y, width: size.width, height: size.height, moved: false };
          onLabelTransformStart(connection.id); (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
        };
        return <g key={connection.id}><path d={`M${x1} ${y1} C${x1 + 70} ${y1}, ${x2 - 70} ${y2}, ${x2} ${y2}`} fill="none" stroke="#6f772f" strokeWidth="2" markerEnd="url(#flowArrow)" /><foreignObject x={labelX} y={labelY} width={size.width} height={size.height} className="m20-flow-label-object"><div className="flow-edge-label">
          <div className="m20-flow-label-head" title="拖曳連線標註" onPointerDown={(event) => startLabelTransform(event, "move")}><b>連線標註</b><button title="刪除連線" onPointerDown={(event) => event.stopPropagation()} onClick={() => onRemoveConnection(connection.id)}>×</button></div>
          <textarea value={connection.label} aria-label="連線標註文字" onChange={(event) => onUpdateConnection(connection.id, { label: event.target.value })} />
          <button className="m20-flow-label-resize" title="拖曳調整標註尺寸" aria-label="調整連線標註尺寸" onPointerDown={(event) => startLabelTransform(event, "resize")}>↘</button>
        </div></foreignObject></g>;
      })}
    </svg>
    {project.sceneOrder.map((id: string, index: number) => {
      const scene = project.scenes[id];
      return <div key={id} className={`m3-flow-card ${id === activeSceneId ? "active" : ""} ${id === connectionFrom ? "connecting" : ""}`} style={{ left: scene.overview.x + origin, top: scene.overview.y + origin }} onPointerDown={(event) => { if ((event.target as Element).closest("button")) return; drag.current = { id, x: scene.overview.x, y: scene.overview.y, startX: event.clientX, startY: event.clientY, moved: false }; onMoveStart(id); event.currentTarget.setPointerCapture?.(event.pointerId); onSelect(id); }}>
        <span className="flow-card-index">{String(index + 1).padStart(2, "0")}</span><div className="flow-card-preview"><SceneThumbnail scene={scene} /></div><b>{scene.name}</b><small>{scene.layers.length} layers · {scene.annotations.length} notes</small>
        <div><button onClick={() => onStartConnection(id)}>起點</button>{connectionFrom && connectionFrom !== id && <button className="connect-target" onClick={() => onConnect(id)}>連到這裡</button>}</div>
      </div>;
    })}
    <div className="m3-flow-hint" style={{ left: origin + 16, top: origin + 16 }}>拖曳空白處平移大畫布 · Scene 與連線標註皆可拖曳 · Ctrl＋滾輪縮放</div>
    </div></div>
  </div></div>;
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
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; layerId: string | null } | null>(null);
  const [clipboardCount, setClipboardCount] = useState(0);
  const [setupMode, setSetupMode] = useState<"project" | "scene" | null>(null);
  const [setupDraft, setSetupDraft] = useState({ name: "SlotBoard 專案", preset: "landscape-work", width: 960, height: 540, template: "basic" });
  const [scenePan, setScenePan] = useState({ x: 0, y: 0 });
  const [scenePanning, setScenePanning] = useState(false);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [layerDropTarget, setLayerDropTarget] = useState<{ id: string; placement: "before" | "after" } | null>(null);
  const historyRef = useRef(history);
  const dragRef = useRef<any>(null);
  const scenePanRef = useRef<any>(null);
  const flowMoveRef = useRef<any>(null);
  const flowLabelRef = useRef<any>(null);
  const sceneStageRef = useRef<HTMLDivElement>(null);
  const sceneZoomRef = useRef(1);
  const userInteractedRef = useRef(false);
  const spaceHeldRef = useRef(false);
  const layerClipboardRef = useRef<any[]>([]);
  const layerDragIdRef = useRef<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const packageInputRef = useRef<HTMLInputElement>(null);

  const project = history.present;
  const scene = project.scenes[activeSceneId] ?? project.scenes[project.sceneOrder[0]];
  const sceneZoom = project.editorSettings.sceneZoom ?? 1;
  const selectedLayer: any = selectedIds.length === 1 ? findLayer(scene.layers, selectedIds[0]) : null;

  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  useEffect(() => {
    sceneZoomRef.current = sceneZoom;
  }, [sceneZoom]);

  useEffect(() => {
    const updateSpace = (event: KeyboardEvent, held: boolean) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select, [contenteditable='true']") || event.code !== "Space") return;
      spaceHeldRef.current = held; setSpaceHeld(held);
      if (held) event.preventDefault();
    };
    const down = (event: KeyboardEvent) => { userInteractedRef.current = true; updateSpace(event, true); };
    const up = (event: KeyboardEvent) => updateSpace(event, false);
    window.addEventListener("keydown", down); window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, []);

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [contextMenu]);

  useEffect(() => {
    const stage = sceneStageRef.current;
    if (viewMode !== "scene" || !stage) return;
    const zoomWithWheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      userInteractedRef.current = true;
      const rect = stage.getBoundingClientRect();
      const anchor = { x: event.clientX - rect.left - rect.width / 2, y: event.clientY - rect.top - rect.height / 2 };
      const previous = sceneZoomRef.current;
      const next = nextWheelZoom(previous, event.deltaY, .25, 2.5);
      if (next === previous) return;
      sceneZoomRef.current = next;
      setScenePan((origin) => nextTranslationAfterZoom(origin, anchor, previous, next));
      setHistory((current: any) => ({ ...current, present: updateEditorSettings(current.present, { sceneZoom: next }) }));
    };
    stage.addEventListener("wheel", zoomWithWheel, { passive: false });
    return () => stage.removeEventListener("wheel", zoomWithWheel);
  }, [viewMode]);

  useEffect(() => {
    const finishDrag = () => {
      const drag = dragRef.current;
      if (drag?.moved) setHistory(commitHistory(drag.baseHistory, drag.latest));
      dragRef.current = null;
      scenePanRef.current = null;
      setGuides({});
      setScenePanning(false);
    };
    const cancelDrag = () => {
      const drag = dragRef.current;
      if (drag?.moved) setHistory(drag.baseHistory);
      dragRef.current = null;
      scenePanRef.current = null;
      setGuides({});
      setScenePanning(false);
    };
    const cancelWhenHidden = () => { if (document.visibilityState === "hidden") cancelDrag(); };
    window.addEventListener("pointerup", finishDrag, true);
    window.addEventListener("pointercancel", cancelDrag, true);
    window.addEventListener("blur", cancelDrag);
    document.addEventListener("visibilitychange", cancelWhenHidden);
    return () => {
      window.removeEventListener("pointerup", finishDrag, true);
      window.removeEventListener("pointercancel", cancelDrag, true);
      window.removeEventListener("blur", cancelDrag);
      document.removeEventListener("visibilitychange", cancelWhenHidden);
    };
  }, []);

  useEffect(() => {
    loadRecoveryProject()
      .then((saved: any) => {
        if (saved && !userInteractedRef.current) {
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
      const target = event.target as HTMLElement | null;
      const editing = target?.matches("input, textarea, select, [contenteditable='true']");
      if (!editing && event.key === "Escape") { setSelectedIds([]); setShowExport(false); setContextMenu(null); return; }
      if (historyRef.current.present.compatibility?.readOnly) return;
      if (!editing && (event.key === "Delete" || event.key === "Backspace") && selectedIds.length) {
        event.preventDefault();
        setHistory((current: any) => commitHistory(current, removeLayers(current.present, activeSceneId, selectedIds)));
        setSelectedIds([]);
        return;
      }
      if (editing || !(event.ctrlKey || event.metaKey)) return;
      if (event.key.toLowerCase() === "c" && selectedIds.length) {
        event.preventDefault();
        layerClipboardRef.current = copyLayerSelection(historyRef.current.present, activeSceneId, selectedIds);
        setClipboardCount(layerClipboardRef.current.length);
        setNotice(`已複製 ${layerClipboardRef.current.length} 個物件，可切換 Scene 後貼上`);
        return;
      }
      if (event.key.toLowerCase() === "v" && layerClipboardRef.current.length) {
        event.preventDefault();
        setHistory((current: any) => {
          const result = pasteLayerSelection(current.present, activeSceneId, layerClipboardRef.current);
          setSelectedIds(result.layerIds);
          return commitHistory(current, result.project);
        });
        return;
      }
      if (event.key.toLowerCase() === "d" && selectedIds.length) {
        event.preventDefault();
        setHistory((current: any) => {
          const copied = copyLayerSelection(current.present, activeSceneId, selectedIds);
          const result = pasteLayerSelection(current.present, activeSceneId, copied);
          setSelectedIds(result.layerIds);
          return commitHistory(current, result.project);
        });
        return;
      }
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
  }, [activeSceneId, selectedIds]);

  const sceneIndex = project.sceneOrder.indexOf(activeSceneId);
  const flattenedCount = useMemo(() => {
    let count = 0;
    const visit = (layers: any[]) => layers.forEach((layer) => { count += 1; if (layer.children) visit(layer.children); });
    visit(scene.layers);
    return count;
  }, [scene.layers]);
  const exportEstimate = useMemo(() => estimateExportWorkingSet(project), [project]);
  const annotationCanvasWidth = Math.max(scene.width + 420, ...scene.annotations.map((annotation: any) => annotation.x + (annotation.width ?? DEFAULT_ANNOTATION_SIZE.width) + 40));

  function commit(nextProject: any) {
    if (project.compatibility?.readOnly) { setNotice("此專案來自較新的 schema，目前為唯讀；請先建立可編輯副本"); return; }
    setHistory((current: any) => commitHistory(current, nextProject));
  }

  function updateViewSettings(patch: any) {
    setHistory((current: any) => ({ ...current, present: updateEditorSettings(current.present, patch) }));
  }

  function convertReadonlyCopy() {
    const next = makeEditableCopy(project);
    setHistory(createHistory(next)); setActiveSceneId(next.sceneOrder[0]); setSelectedIds([]);
    const result = createProjectPackage(next);
    downloadBytes(result.bytes, result.fileName);
    setNotice(`已建立並匯出可編輯副本：${result.fileName}`);
  }

  function openSetup(mode: "project" | "scene") {
    const size = mode === "project" ? project.defaultSceneSize : { width: scene.width, height: scene.height };
    setSetupDraft({ name: mode === "project" ? "SlotBoard 專案" : `Scene ${String(project.sceneOrder.length + 1).padStart(2, "0")}`, preset: "custom", width: size.width, height: size.height, template: mode === "project" ? "basic" : "blank" });
    setSetupMode(mode);
  }

  function applySetup() {
    const size = { width: Math.max(320, Math.min(8192, Number(setupDraft.width))), height: Math.max(320, Math.min(8192, Number(setupDraft.height))) };
    if (setupMode === "project") {
      if ((project.sceneOrder.length > 1 || flattenedCount > 2) && !window.confirm("建立新專案會取代目前工作內容。確定繼續？")) return;
      const next = createProject(setupDraft.name.trim() || "SlotBoard 專案", size, setupDraft.template);
      setHistory(createHistory(next)); setActiveSceneId(next.sceneOrder[0]); setSelectedIds([]); setViewMode("scene");
    } else {
      const result = addScene(project, setupDraft.name, { size, template: setupDraft.template });
      commit(result.project); setActiveSceneId(result.sceneId); setSelectedIds([]);
    }
    setSetupMode(null);
  }

  function selectLayer(event: any, id: string) {
    event.stopPropagation();
    if (event.button !== undefined && event.button !== 0) return;
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
    const svg = (event.currentTarget as SVGGElement).ownerSVGElement;
    const startPoint = svg ? svgClientPoint(svg, event.clientX, event.clientY) : { x: event.clientX, y: event.clientY };
    dragRef.current = {
      id,
      mode,
      startX: event.clientX,
      startY: event.clientY,
      startCanvasX: startPoint.x,
      startCanvasY: startPoint.y,
      baseHistory: historyRef.current,
      baseTransform: structuredClone(layer.transform),
      baseChildren: layer.type === "group" ? structuredClone(layer.children) : null,
      latest: historyRef.current.present,
      moved: false,
    };
    (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
  }

  function startAnnotationDrag(event: any, annotation: any, mode: "move" | "resize" = "move") {
    event.preventDefault(); event.stopPropagation();
    const svg = (event.currentTarget as SVGElement).ownerSVGElement;
    const startPoint = svg ? svgClientPoint(svg, event.clientX, event.clientY) : { x: event.clientX, y: event.clientY };
    dragRef.current = {
      id: annotation.id, mode: `annotation-${mode}`, startX: event.clientX, startY: event.clientY,
      startCanvasX: startPoint.x, startCanvasY: startPoint.y,
      baseHistory: historyRef.current, basePosition: { x: annotation.x, y: annotation.y }, latest: historyRef.current.present, moved: false,
      baseSize: { width: annotation.width ?? DEFAULT_ANNOTATION_SIZE.width, height: annotation.height ?? DEFAULT_ANNOTATION_SIZE.height },
    };
    (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
  }

  function pointerMove(event: any) {
    const drag = dragRef.current;
    if (!drag) return;
    const svg = event.currentTarget as SVGSVGElement;
    const point = svgClientPoint(svg, event.clientX, event.clientY);
    const dx = point.x - drag.startCanvasX;
    const dy = point.y - drag.startCanvasY;
    if (!drag.moved && !hasDragIntent(drag.startX, drag.startY, event.clientX, event.clientY)) return;
    drag.moved = true;
    if (drag.mode === "annotation-move" || drag.mode === "annotation-resize") {
      const next = drag.mode === "annotation-resize"
        ? resizeAnnotation(drag.baseHistory.present, activeSceneId, drag.id, { width: drag.baseSize.width + dx, height: drag.baseSize.height + dy })
        : moveAnnotation(drag.baseHistory.present, activeSceneId, drag.id, { x: drag.basePosition.x + dx, y: drag.basePosition.y + dy });
      drag.latest = next;
      setHistory({ ...drag.baseHistory, present: next });
      return;
    }
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
        layer.transform.x = Math.min(Math.max(0, x), Math.max(0, scene.width - layer.transform.width));
        layer.transform.y = Math.min(Math.max(0, y), Math.max(0, scene.height - layer.transform.height));
        setGuides(nextGuides);
      } else if (drag.mode === "resize") {
        let width = Math.max(24, Math.round(drag.baseTransform.width + dx));
        let height = Math.max(24, Math.round(drag.baseTransform.height + dy));
        if (event.shiftKey) {
          const ratio = drag.baseTransform.width / drag.baseTransform.height;
          if (Math.abs(dx) >= Math.abs(dy)) height = Math.max(24, Math.round(width / ratio));
          else width = Math.max(24, Math.round(height * ratio));
        }
        const maxWidth = Math.max(24, scene.width - drag.baseTransform.x), maxHeight = Math.max(24, scene.height - drag.baseTransform.y);
        const fitScale = Math.min(1, maxWidth / width, maxHeight / height);
        layer.transform.width = Math.round(width * fitScale);
        layer.transform.height = Math.round(height * fitScale);
        if (layer.type === "group" && drag.baseChildren) {
          const scaleX = layer.transform.width / Math.max(1, drag.baseTransform.width);
          const scaleY = layer.transform.height / Math.max(1, drag.baseTransform.height);
          layer.children = scaleGroupChildren(drag.baseChildren, scaleX, scaleY);
        }
      } else {
        const cx = drag.baseTransform.x + drag.baseTransform.width / 2;
        const cy = drag.baseTransform.y + drag.baseTransform.height / 2;
        const px = point.x;
        const py = point.y;
        let rotation = Math.round(Math.atan2(py - cy, px - cx) * 180 / Math.PI + 90);
        if (event.shiftKey) rotation = Math.round(rotation / 90) * 90;
        layer.transform.rotation = ((rotation % 360) + 360) % 360;
      }
    });
    drag.latest = next;
    setHistory({ ...drag.baseHistory, present: next });
  }

  function pointerUp() {
    const drag = dragRef.current;
    if (!drag) return;
    if (drag.moved) setHistory(commitHistory(drag.baseHistory, drag.latest));
    dragRef.current = null;
    setGuides({});
  }

  function startScenePan(event: any) {
    const emptyStage = event.target === event.currentTarget;
    const canvasSurface = Boolean((event.target as Element).closest?.("[data-pan-surface='true'], [data-layer-locked='true']"));
    if (event.button !== 1 && !(event.button === 0 && (spaceHeldRef.current || emptyStage || canvasSurface))) return;
    event.preventDefault(); event.stopPropagation(); setContextMenu(null);
    if (emptyStage && event.button === 0) setSelectedIds([]);
    scenePanRef.current = { startX: event.clientX, startY: event.clientY, x: scenePan.x, y: scenePan.y };
    setScenePanning(true); event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function moveScenePan(event: any) {
    const pan = scenePanRef.current;
    if (!pan) return;
    setScenePan(nextTranslatedPan({ x: pan.x, y: pan.y }, pan.startX, pan.startY, event.clientX, event.clientY));
  }

  function endScenePan() {
    scenePanRef.current = null; setScenePanning(false);
  }

  function startFlowMove(id: string) {
    flowMoveRef.current = { id, baseHistory: historyRef.current, latest: historyRef.current.present };
  }

  function previewFlowMove(id: string, position: any) {
    const move = flowMoveRef.current;
    if (!move || move.id !== id) return;
    move.latest = updateSceneOverview(move.baseHistory.present, id, position);
    setHistory({ ...move.baseHistory, present: move.latest });
  }

  function endFlowMove(commitMove: boolean) {
    const move = flowMoveRef.current;
    if (!move) return;
    setHistory(commitMove ? commitHistory(move.baseHistory, move.latest) : move.baseHistory);
    flowMoveRef.current = null;
  }

  function startFlowLabelTransform(id: string) {
    flowLabelRef.current = { id, baseHistory: historyRef.current, latest: historyRef.current.present };
  }

  function previewFlowLabelTransform(id: string, patch: any) {
    const transform = flowLabelRef.current;
    if (!transform || transform.id !== id) return;
    transform.latest = updateConnection(transform.baseHistory.present, id, patch);
    setHistory({ ...transform.baseHistory, present: transform.latest });
  }

  function endFlowLabelTransform(commitTransform: boolean) {
    const transform = flowLabelRef.current;
    if (!transform) return;
    setHistory(commitTransform ? commitHistory(transform.baseHistory, transform.latest) : transform.baseHistory);
    flowLabelRef.current = null;
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
      let bytes;
      try { bytes = supportsSlotBoardWorker() ? await runWorkerTask("scenePsd", { project, sceneId: activeSceneId }) : await createScenePsd(project, activeSceneId); }
      catch { setNotice("背景輸出不可用，已改用相容模式"); bytes = await createScenePsd(project, activeSceneId); }
      const file = buildSceneFileNames(project).find((item: any) => item.sceneId === activeSceneId);
      downloadBytes(bytes, `${file?.base ?? "Scene"}.psd`, "image/vnd.adobe.photoshop");
    } catch (error) { setNotice(`PSD 輸出失敗：${error instanceof Error ? error.message : "未知錯誤"}`); }
    finally { setExportBusy(false); }
  }

  async function exportAllPsd() {
    setExportBusy(true);
    try {
      let bytes;
      try { bytes = supportsSlotBoardWorker() ? await runWorkerTask("psdZip", { project }) : await createPsdZip(project); }
      catch { setNotice("背景輸出不可用，已改用相容模式"); bytes = await createPsdZip(project); }
      downloadBytes(bytes, `${project.name}_PSD.zip`);
    }
    catch (error) { setNotice(`批次 PSD 失敗：${error instanceof Error ? error.message : "未知錯誤"}`); }
    finally { setExportBusy(false); }
  }

  async function exportPdf() {
    setExportBusy(true);
    try {
      let bytes;
      try { bytes = supportsSlotBoardWorker() ? await runWorkerTask("pdf", { project }) : await createProjectPdf(project); }
      catch { setNotice("背景輸出不可用，已改用相容模式"); bytes = await createProjectPdf(project); }
      downloadBytes(bytes, `${project.name}_分鏡.pdf`, "application/pdf");
    }
    catch (error) { setNotice(`PDF 輸出失敗：${error instanceof Error ? error.message : "未知錯誤"}`); }
    finally { setExportBusy(false); }
  }

  function updateSelected(property: string, value: any) {
    if (!selectedLayer) return;
    commit(updateLayer(project, activeSceneId, selectedLayer.id, (layer: any) => {
      if (property in layer.transform) layer.transform[property] = clampLayerTransformValue(property, value, layer.transform, scene);
      else layer[property] = value;
    }));
  }

  function releaseNumberInputWheel(event: any) {
    userInteractedRef.current = true;
    const input = event.target as HTMLInputElement;
    if (shouldReleaseNumberInputForWheel(input.type, document.activeElement === input)) input.blur();
  }

  async function prepareImageAsset(file?: File) {
    if (!file) return null;
    if (!file.type.startsWith("image/")) { setNotice("請選擇 PNG、JPG、WebP 等圖片檔"); return null; }
    let dataUrl = await readFileAsDataUrl(file);
    let { width, height } = await readImageSize(dataUrl);
    let blob: Blob = file;
    if (file.size > 20 * 1024 * 1024 || width > 8192 || height > 8192) {
      const accepted = window.confirm(`圖片為 ${width}×${height}、${(file.size / 1024 / 1024).toFixed(1)} MB，超過單張限制。是否建立縮小副本？`);
      if (!accepted) return null;
      const reduced = await createReducedImage(dataUrl, width, height);
      ({ dataUrl, width, height, blob } = reduced);
      if (blob.size > 20 * 1024 * 1024) { setNotice("縮小後仍超過 20 MB，請先在圖片工具中降低尺寸"); return null; }
    }
    if (projectAssetBytes(project) + blob.size > 200 * 1024 * 1024) { setNotice("專案素材總量將超過 200 MB，無法匯入"); return null; }
    return { id: createId("asset"), name: file.name, mimeType: blob.type || file.type, byteLength: blob.size, width, height, dataUrl };
  }

  async function importImage(file?: File) {
    if (!file || !selectedLayer || selectedLayer.type === "group") return;
    const asset = await prepareImageAsset(file);
    if (!asset) return;
    commit(replaceLayerWithImage(project, activeSceneId, selectedLayer.id, asset));
    setNotice(`已置換圖片：${file.name}`);
  }

  async function importSymbolImage(symbolId: string, file?: File) {
    if (!file || !symbolId) return;
    const asset = await prepareImageAsset(file);
    if (!asset) return;
    commit(replaceSymbolImage(project, symbolId, asset));
    setNotice(`已更新 Symbol 圖片：${file.name}；所有 Scene 引用已同步`);
  }

  function align(mode: string) { commit(alignLayers(project, activeSceneId, selectedIds, mode)); }
  function distribute(axis: string) { commit(distributeLayers(project, activeSceneId, selectedIds, axis)); }

  function openContextMenu(event: any, layerId: string | null = null) {
    event.preventDefault(); event.stopPropagation();
    if (layerId && !selectedIds.includes(layerId)) setSelectedIds([layerId]);
    setContextMenu({ x: Math.min(event.clientX, window.innerWidth - 190), y: Math.min(event.clientY, window.innerHeight - 420), layerId });
  }

  function contextAction(action: string) {
    const layerId = contextMenu?.layerId ?? selectedIds[0] ?? null;
    if (action === "addScene") openSetup("scene");
    if (action === "addRectangle") { const next = addLayer(project, activeSceneId, "rectangle"); commit(next); setSelectedIds([next.scenes[activeSceneId].layers[0].id]); }
    if (action === "addText") { const next = addTextLayer(project, activeSceneId); commit(next); setSelectedIds([next.scenes[activeSceneId].layers[0].id]); }
    if (layerId && action === "locate") commit(locateLayerInScene(project, activeSceneId, layerId));
    if (layerId && action === "front") commit(reorderLayer(project, activeSceneId, layerId, "front"));
    if (layerId && action === "back") commit(reorderLayer(project, activeSceneId, layerId, "back"));
    if (layerId && action === "up") commit(reorderLayer(project, activeSceneId, layerId, "up"));
    if (layerId && action === "down") commit(reorderLayer(project, activeSceneId, layerId, "down"));
    if (layerId && action === "copy") { layerClipboardRef.current = copyLayerSelection(project, activeSceneId, selectedIds.includes(layerId) ? selectedIds : [layerId]); setClipboardCount(layerClipboardRef.current.length); setNotice(`已複製 ${layerClipboardRef.current.length} 個物件`); }
    if (layerId && action === "duplicate") { const copied = copyLayerSelection(project, activeSceneId, selectedIds.includes(layerId) ? selectedIds : [layerId]); const result = pasteLayerSelection(project, activeSceneId, copied); commit(result.project); setSelectedIds(result.layerIds); }
    if (action === "paste" && layerClipboardRef.current.length) { const result = pasteLayerSelection(project, activeSceneId, layerClipboardRef.current); commit(result.project); setSelectedIds(result.layerIds); }
    if (layerId && action === "replace") imageInputRef.current?.click();
    if (layerId && action === "delete") { commit(removeLayers(project, activeSceneId, [layerId])); setSelectedIds([]); }
    setContextMenu(null);
  }

  function startLayerReorder(event: any, layerId: string) {
    const layer: any = findLayer(scene.layers, layerId);
    if (!layer || layer.locked || (event.target as Element).closest("button")) { event.preventDefault(); return; }
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/x-slotboard-layer", layerId);
    layerDragIdRef.current = layerId;
  }

  function previewLayerReorder(event: any, targetId: string) {
    const draggedId = layerDragIdRef.current ?? event.dataTransfer.getData("text/x-slotboard-layer");
    if (!draggedId || draggedId === targetId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    const rect = event.currentTarget.getBoundingClientRect();
    const target: any = findLayer(scene.layers, targetId);
    const isBackgroundBoundary = /^(背景|background)$/i.test(String(target?.name ?? "").trim()) && target?.transform?.x === 0 && target?.transform?.y === 0 && target?.transform?.width >= scene.width && target?.transform?.height >= scene.height;
    const placement = isBackgroundBoundary || event.clientY < rect.top + rect.height / 2 ? "before" : "after";
    setLayerDropTarget({ id: targetId, placement });
  }

  function finishLayerReorder(event: any, targetId: string) {
    event.preventDefault();
    const draggedId = layerDragIdRef.current ?? event.dataTransfer.getData("text/x-slotboard-layer");
    const placement = layerDropTarget?.id === targetId ? layerDropTarget.placement : "before";
    setLayerDropTarget(null);
    layerDragIdRef.current = null;
    if (!draggedId || draggedId === targetId) return;
    const next = moveLayerByDrop(project, activeSceneId, draggedId, targetId, placement);
    if (next === project) { setNotice("圖層只能在同一群組層級內排序"); return; }
    commit(next);
  }

  return (
    <main className={`m1-shell ${project.compatibility?.readOnly ? "m13-readonly" : ""}`} onPointerDownCapture={() => { userInteractedRef.current = true; }} onWheelCapture={releaseNumberInputWheel}>
      <header className="m1-topbar">
        <div className="m1-brand"><span>SB</span><div><small>SLOTBOARD · M2</small><b>{project.name}</b></div></div>
        <div className="m1-history">
          <button onClick={() => setHistory((current: any) => undoHistory(current))} disabled={!history.past.length} title="復原 Ctrl+Z">↶</button>
          <button onClick={() => setHistory((current: any) => redoHistory(current))} disabled={!history.future.length} title="重做 Ctrl+Y">↷</button>
          <button className={`m1-mode-button ${viewMode === "scene" ? "mode-active" : ""}`} aria-pressed={viewMode === "scene"} onClick={() => setViewMode("scene")}>Scene</button>
          <button className={`m1-mode-button ${viewMode === "flow" ? "mode-active" : ""}`} aria-pressed={viewMode === "flow"} onClick={() => setViewMode("flow")}>流程</button>
          <span>{recoveryReady ? "自動儲存開啟" : "載入草稿…"}</span>
        </div>
        <div className="m1-actions"><button className="secondary" onClick={() => openSetup("project")}>新建</button><button className="secondary" onClick={() => packageInputRef.current?.click()}>開啟</button><button className="secondary" onClick={exportProject}>儲存</button><button className="secondary" onClick={exportTemplate}>模板</button><button className="secondary" onClick={() => setShowExport(true)}>輸出</button><input className="visually-hidden" ref={packageInputRef} type="file" accept=".slotboard,.slottemplate" onChange={(event) => { void importPackage(event.target.files?.[0]); event.target.value = ""; }} /></div>
      </header>

      {project.compatibility?.readOnly && <div className="m13-readonly-banner" role="status"><b>唯讀模式</b><span>此檔案使用 schema v{project.compatibility.sourceSchemaVersion}，目前版本支援至 v3。你可以檢視與輸出，但不能直接修改。</span><button onClick={convertReadonlyCopy}>另存可編輯副本</button></div>}

      <div className="m1-workspace">
        <aside className="m1-scenes">
          <div className="m1-panel-title"><span>SCENES</span><button className="m6-add-scene" onClick={() => openSetup("scene")}>＋ Scene</button><b>{project.sceneOrder.length}</b></div>
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
            <button title="Shift 多選至少 2 個物件後建立群組" disabled={selectedIds.length < 2} onClick={() => { const result = groupLayers(project, activeSceneId, selectedIds); commit(result.project); if (result.groupId) setSelectedIds([result.groupId]); }}><b>▣</b><small>群組</small></button>
            <button title="選取群組後解散為個別圖層" disabled={selectedLayer?.type !== "group"} onClick={() => { commit(ungroupLayer(project, activeSceneId, selectedLayer.id)); setSelectedIds([]); }}><b>▦</b><small>解散</small></button>
            <button disabled={!selectedLayer || selectedLayer.type === "group"} onClick={() => imageInputRef.current?.click()}><b>▧</b><small>換圖片</small></button>
            <input ref={imageInputRef} className="visually-hidden" type="file" accept="image/*" onChange={(event) => { void importImage(event.target.files?.[0]); event.target.value = ""; }} />
          </div>
          <div ref={sceneStageRef} className={`m1-stage-wrap ${project.editorSettings.pixelGrid ? "pixel-grid" : ""} ${scenePanning ? "is-panning" : ""} ${spaceHeld ? "pan-ready" : ""}`} onPointerDownCapture={startScenePan} onPointerMove={moveScenePan} onPointerUp={endScenePan} onPointerCancel={endScenePan} onContextMenu={(event) => openContextMenu(event)}>
            <div className="m3-editor-plane m11-editor-plane" style={{ transform: `translate(${scenePan.x}px, ${scenePan.y}px) scale(${sceneZoom})`, transformOrigin: "center center" }}>
            <svg className="m1-canvas m11-annotation-canvas" style={{ aspectRatio: `${annotationCanvasWidth} / ${scene.height}` }} viewBox={`0 0 ${annotationCanvasWidth} ${scene.height}`} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp} aria-label={`${scene.name} 編輯畫布與標註`}>
              <defs><marker id="arrowhead" markerWidth="12" markerHeight="10" refX="10" refY="5" orient="auto"><path d="M0 0 L10 5 L0 10 Z" fill="#f2f2ed" /></marker></defs>
              <rect data-pan-surface="true" width={scene.width} height={scene.height} fill="#31322f" />
              <rect data-pan-surface="true" x={scene.width} width={annotationCanvasWidth - scene.width} height={scene.height} fill="#eceee8" />
              {[...scene.layers].reverse().map((layer: any) => <LayerVisual key={layer.id} layer={layer} assets={{ ...project.assets, __symbols: project.symbols }} selectedIds={selectedIds} onSelect={selectLayer} onContextMenu={openContextMenu} />)}
              {project.editorSettings.guides && guides.x !== undefined && <line x1={guides.x} x2={guides.x} y1={0} y2={scene.height} stroke="#d9ff43" strokeWidth={1} vectorEffect="non-scaling-stroke" pointerEvents="none" />}
              {project.editorSettings.guides && guides.y !== undefined && <line x1={0} x2={scene.width} y1={guides.y} y2={guides.y} stroke="#d9ff43" strokeWidth={1} vectorEffect="non-scaling-stroke" pointerEvents="none" />}
              {scene.annotations.map((annotation: any) => {
                const target = annotation.targetLayerId ? layerCenter(scene.layers, annotation.targetLayerId) : null;
                return target ? <g key={`line_${annotation.id}`} className="m11-annotation-link" pointerEvents="none"><line x1={target.x} y1={target.y} x2={annotation.x} y2={annotation.y + 18} /><circle cx={target.x} cy={target.y} r={7} /></g> : null;
              })}
              {scene.annotations.map((annotation: any, index: number) => {
                const target: any = annotation.targetLayerId ? findLayer(scene.layers, annotation.targetLayerId) : null;
                const width = annotation.width ?? DEFAULT_ANNOTATION_SIZE.width, height = annotation.height ?? DEFAULT_ANNOTATION_SIZE.height;
                return <foreignObject key={annotation.id} x={annotation.x} y={annotation.y} width={width} height={height} className="m11-note-object">
                  <div className="m3-note m11-note">
                    <div className="m11-note-head" title="拖曳標註" onPointerDown={(event) => startAnnotationDrag(event, annotation)}><span>{index + 1}</span><b>拖曳標註</b></div>
                    <textarea value={annotation.text} onChange={(event) => commit(updateAnnotation(project, activeSceneId, annotation.id, { text: event.target.value }))} />
                    <div className="m11-note-foot"><small>{annotation.targetLayerId ? `連到：${target?.name ?? "已刪除圖層"}` : "Scene 整體備註"}</small><button className="m11-note-delete" onClick={() => commit(removeAnnotation(project, activeSceneId, annotation.id))}>刪除</button></div>
                    <button className="m11-note-resize" title="拖曳調整標註尺寸" aria-label="調整 Scene 標註尺寸" onPointerDown={(event) => startAnnotationDrag(event, annotation, "resize")}>↘</button>
                  </div>
                </foreignObject>;
              })}
            </svg>
            <button className="m11-add-note" onClick={() => commit(addAnnotation(project, activeSceneId, "新增標註", selectedLayer?.id ?? null))}>＋ SCENE 標註{selectedLayer ? `：${selectedLayer.name}` : ""}</button>
            </div>
          </div>
          <footer className="m1-statusbar"><span>Scene {sceneIndex + 1}/{project.sceneOrder.length}</span><span>{flattenedCount} 個圖層</span><span>{scene.width} × {scene.height}px</span><button className={project.editorSettings.snap ? "active" : ""} onClick={() => commit(updateEditorSettings(project, { snap: !project.editorSettings.snap }))}>吸附</button><button className={project.editorSettings.guides ? "active" : ""} onClick={() => commit(updateEditorSettings(project, { guides: !project.editorSettings.guides }))}>參考線</button><button className={project.editorSettings.pixelGrid ? "active" : ""} onClick={() => commit(updateEditorSettings(project, { pixelGrid: !project.editorSettings.pixelGrid }))}>像素格</button><button onClick={() => setScenePan({ x: 0, y: 0 })}>畫布置中</button><button title="重設畫布縮放" onClick={() => { setScenePan({ x: 0, y: 0 }); updateViewSettings({ sceneZoom: 1 }); }}>{Math.round(sceneZoom * 100)}%</button><span className="m1-tip">空白處拖曳 · Ctrl＋滾輪縮放 · Space／中鍵平移</span></footer>
          </> : <FlowOverview project={project} activeSceneId={activeSceneId} connectionFrom={connectionFrom} zoom={project.editorSettings.flowZoom ?? 1} onZoom={(flowZoom: number) => updateViewSettings({ flowZoom: Math.round(flowZoom * 10) / 10 })} onAutoArrange={() => { if (window.confirm("自動整理會重新排列所有 Scene，連線內容不會改變。確定繼續？")) commit(autoArrangeScenes(project)); }} onSelect={setActiveSceneId} onStartConnection={(id: string) => setConnectionFrom(id)} onConnect={(id: string) => { if (connectionFrom) commit(addConnection(project, connectionFrom, id)); setConnectionFrom(null); }} onMoveStart={startFlowMove} onMovePreview={previewFlowMove} onMoveEnd={endFlowMove} onLabelTransformStart={startFlowLabelTransform} onLabelTransformPreview={previewFlowLabelTransform} onLabelTransformEnd={endFlowLabelTransform} onUpdateConnection={(id: string, patch: any) => commit(updateConnection(project, id, patch))} onRemoveConnection={(id: string) => commit(removeConnection(project, id))} />}
        </section>

        <aside className="m1-right">
          <div className="m1-tabs"><b>圖層</b><span>屬性</span></div>
          <div className="m1-layer-list"><LayerTree layers={scene.layers} selectedIds={selectedIds} onSelect={selectLayer} onContextMenu={openContextMenu} onToggle={(id: string, prop: string) => commit(updateLayer(project, activeSceneId, id, (layer: any) => { layer[prop] = !layer[prop]; }))} onDragStart={startLayerReorder} onDragOver={previewLayerReorder} onDrop={finishLayerReorder} onDragEnd={() => { layerDragIdRef.current = null; setLayerDropTarget(null); }} dropTarget={layerDropTarget} /></div>
          <section className="m1-properties">
            <div className="m1-panel-title"><span>PROPERTIES</span>{selectedLayer && <b>{selectedLayer.type === "group" ? "群組" : "圖形"}</b>}</div>
            {selectedLayer ? <>
              <div className="m2-align-panel">
                <span>對齊</span>
                <div className="m2-align-actions">{[["left","靠左"],["centerX","水平置中"],["right","靠右"],["top","靠上"],["centerY","垂直置中"],["bottom","靠下"]].map(([mode, title]) => <button key={mode} title={title} onClick={() => align(mode)}>{mode === "left" ? "┫" : mode === "right" ? "┣" : mode === "top" ? "┻" : mode === "bottom" ? "┳" : "╋"}</button>)}</div>
                <div className="m2-distribute-actions"><button disabled={selectedIds.length < 3} onClick={() => distribute("x")}>水平等距</button><button disabled={selectedIds.length < 3} onClick={() => distribute("y")}>垂直等距</button></div>
                <button className="m6-locate" onClick={() => commit(locateLayerInScene(project, activeSceneId, selectedLayer.id))}>找回畫面中央</button>
              </div>
              <label className="m1-field full"><span>圖層名稱</span><input value={selectedLayer.name} onChange={(event) => updateSelected("name", event.target.value)} /></label>
              <div className="m1-property-grid">
                {[['x','X'],['y','Y'],['width','W'],['height','H'],['rotation','角度']].map(([key, label]) => <label className="m1-field" key={key}><span>{label}</span><input type="number" value={Math.round(selectedLayer.transform[key])} onChange={(event) => updateSelected(key, event.target.value)} /></label>)}
                <label className="m1-field"><span>透明度</span><input type="number" min="0" max="100" value={Math.round(selectedLayer.opacity * 100)} onChange={(event) => updateSelected("opacity", Number(event.target.value) / 100)} /></label>
              </div>
              <div className="m1-flips"><button className={selectedLayer.transform.flipX ? "active" : ""} onClick={() => updateSelected("flipX", !selectedLayer.transform.flipX)}>水平翻轉</button><button className={selectedLayer.transform.flipY ? "active" : ""} onClick={() => updateSelected("flipY", !selectedLayer.transform.flipY)}>垂直翻轉</button></div>
              {selectedLayer.type === "shape" && <div className="m2-special-panel m7-shape-panel">
                <div className="m1-panel-title"><span>SHAPE APPEARANCE</span><b>灰階優先</b></div>
                {!["line", "arrow"].includes(selectedLayer.kind) && <>
                  <div className="m7-palette-label">重要度灰階</div>
                  <div className="m7-gray-palette">{GRAYSCALE_PALETTE.map(([label, color]) => <button key={label} className={selectedLayer.fill === color ? "active" : ""} title={label} onClick={() => updateSelected("fill", color)}><i style={{ background: color }} /><span>{label}</span></button>)}</div>
                  <div className="m7-palette-label">常用彩色</div>
                  <div className="m7-color-palette">{COLOR_PALETTE.map((color) => <button key={color} className={selectedLayer.fill === color ? "active" : ""} aria-label={`填色 ${color}`} style={{ background: color }} onClick={() => updateSelected("fill", color)} />)}</div>
                </>}
                <div className="m7-shape-fields">
                  {!["line", "arrow"].includes(selectedLayer.kind) && <label>自訂填色<input type="color" value={selectedLayer.fill === "transparent" ? "#ffffff" : selectedLayer.fill} onChange={(event) => updateSelected("fill", event.target.value)} /></label>}
                  <label>外框色<input type="color" value={selectedLayer.stroke} onChange={(event) => updateSelected("stroke", event.target.value)} /></label>
                  <label>外框寬度<input type="number" min="0" max="40" value={selectedLayer.strokeWidth} onChange={(event) => updateSelected("strokeWidth", Number(event.target.value))} /></label>
                  {selectedLayer.kind === "rectangle" && <label>圓角<input type="number" min="0" max={Math.round(Math.min(selectedLayer.transform.width, selectedLayer.transform.height) / 2)} value={selectedLayer.cornerRadius ?? 6} onChange={(event) => updateSelected("cornerRadius", Number(event.target.value))} /></label>}
                </div>
              </div>}
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
                <div className="m3-reel-actions"><button onClick={() => commit(addReelColumn(project, activeSceneId, selectedLayer.id))}>＋軸</button><button onClick={() => commit(removeReelColumn(project, activeSceneId, selectedLayer.id))}>－軸</button><button onClick={() => { const next = addReelGridLayer(project, activeSceneId, [4,4,4,4,4,4]); commit(next); setSelectedIds([next.scenes[activeSceneId].layers[0].id]); }}>6×4 預設</button><button onClick={() => { const next = addReelGridLayer(project, activeSceneId, [3,4,4,4,3]); commit(next); setSelectedIds([next.scenes[activeSceneId].layers[0].id]); }}>3-4-4-4-3</button></div>
                <div className="m3-column-list">{selectedLayer.columns.map((column: any[], columnIndex: number) => <div key={columnIndex} className="m3-column-item"><label>第 {columnIndex + 1} 軸<input type="number" min="1" max="12" value={column.length} onChange={(event) => commit(updateReelColumn(project, activeSceneId, selectedLayer.id, columnIndex, Number(event.target.value)))} /></label><div>{column.map((symbolId, rowIndex) => <select key={rowIndex} value={symbolId ?? ""} onChange={(event) => commit(assignReelSymbol(project, activeSceneId, selectedLayer.id, columnIndex, rowIndex, event.target.value || null))}><option value="">Placeholder</option>{Object.values(project.symbols).map((symbol: any) => <option key={symbol.id} value={symbol.id}>{symbol.name}</option>)}</select>)}</div></div>)}</div>
              </div>}
            </> : <p className="empty-properties">選取畫布或圖層中的物件，即可精確調整位置與尺寸。</p>}
          </section>
          <section className="m3-symbol-panel">
            <div className="m1-panel-title"><span>PROJECT SYMBOLS</span><button onClick={() => { const result = addSymbol(project, `Symbol ${Object.keys(project.symbols).length + 1}`); commit(result.project); }}>＋ 新增</button></div>
            {Object.values(project.symbols).length ? Object.values(project.symbols).map((symbol: any) => {
              const asset = symbol.assetId ? project.assets[symbol.assetId] : null;
              const uses = Object.values(project.scenes).reduce((count: number, item: any) => {
                let sceneUses = 0;
                const visit = (layers: any[]) => layers.forEach((layer) => { if (layer.type === "reelGrid") layer.columns.flat().forEach((id: string) => { if (id === symbol.id) sceneUses += 1; }); if (layer.children) visit(layer.children); });
                visit(item.layers); return count + sceneUses;
              }, 0);
              return <div className="m3-symbol-row" key={symbol.id}>
                <label className="m8-symbol-preview" title="匯入或更換 Symbol 圖片">
                  {asset?.dataUrl ? <img src={asset.dataUrl} alt="" /> : <span style={{ background: symbol.color }}>＋</span>}
                  <input className="visually-hidden" type="file" accept="image/*" onChange={(event) => { void importSymbolImage(symbol.id, event.target.files?.[0]); event.target.value = ""; }} />
                </label>
                <div className="m8-symbol-fields"><input value={symbol.name} onChange={(event) => commit(updateSymbol(project, symbol.id, { name: event.target.value }))} /><small>{asset?.name ?? "尚未匯入圖片"} · {uses} 次引用</small></div>
                <input aria-label={`${symbol.name} placeholder 顏色`} type="color" value={symbol.color} onChange={(event) => commit(updateSymbol(project, symbol.id, { color: event.target.value }))} />
                {asset && <button className="m8-symbol-remove" title="移除圖片，回到 placeholder" onClick={() => commit(resetSymbolImage(project, symbol.id))}>×</button>}
              </div>;
            }) : <p className="empty-properties">先新增專案 Symbol；點預覽格匯入圖片，之後換圖會跨 Scene 同步。</p>}
          </section>
        </aside>
      </div>
      {contextMenu && <div className="m6-context-menu" role="menu" style={{ left: contextMenu.x, top: contextMenu.y }} onPointerDown={(event) => event.stopPropagation()}>
        {contextMenu.layerId ? <>
          <button role="menuitem" onClick={() => contextAction("locate")}>找回畫面中央</button>
          <button role="menuitem" onClick={() => contextAction("copy")}>複製物件 Ctrl+C</button>
          <button role="menuitem" onClick={() => contextAction("duplicate")}>建立複本 Ctrl+D</button>
          <button role="menuitem" disabled={!clipboardCount} onClick={() => contextAction("paste")}>貼上 Ctrl+V</button>
          <button role="menuitem" onClick={() => contextAction("front")}>移到最上層</button>
          <button role="menuitem" onClick={() => contextAction("up")}>向上移一層</button>
          <button role="menuitem" onClick={() => contextAction("down")}>向下移一層</button>
          <button role="menuitem" onClick={() => contextAction("back")}>移到最下層</button>
          {(findLayer(scene.layers, contextMenu.layerId) as any)?.type !== "group" && <button role="menuitem" onClick={() => contextAction("replace")}>置換成圖片…</button>}
          <hr />
          <button className="danger" role="menuitem" onClick={() => contextAction("delete")}>刪除物件</button>
        </> : <>
          <button role="menuitem" onClick={() => contextAction("addRectangle")}>新增矩形</button>
          <button role="menuitem" onClick={() => contextAction("addText")}>新增文字</button>
          <button role="menuitem" disabled={!clipboardCount} onClick={() => contextAction("paste")}>貼上物件 Ctrl+V</button>
          <button role="menuitem" onClick={() => contextAction("addScene")}>新增 Scene</button>
        </>}
      </div>}
      {notice && <button className="m2-notice" onClick={() => setNotice("")}>{notice}<span>×</span></button>}
      {setupMode && <div className="m5-modal-backdrop" onClick={(event) => { if (event.target === event.currentTarget) setSetupMode(null); }}>
        <section className="m5-export-modal m10-setup-modal" role="dialog" aria-modal="true" aria-labelledby="setup-title">
          <div className="m5-modal-head"><div><small>{setupMode === "project" ? "NEW PROJECT" : "NEW SCENE"}</small><h2 id="setup-title">{setupMode === "project" ? "建立新專案" : "新增 Scene"}</h2></div><button aria-label="關閉設定視窗" onClick={() => setSetupMode(null)}>×</button></div>
          <div className="m10-setup-body">
            <label><span>{setupMode === "project" ? "專案名稱" : "Scene 名稱"}</span><input value={setupDraft.name} onChange={(event) => setSetupDraft({ ...setupDraft, name: event.target.value })} /></label>
            <label><span>尺寸預設</span><select value={setupDraft.preset} onChange={(event) => { const preset = (SCENE_SIZE_PRESETS as any)[event.target.value]; setSetupDraft({ ...setupDraft, preset: event.target.value, ...(preset ? { width: preset.width, height: preset.height } : {}) }); }}><option value="custom">自訂尺寸</option>{Object.entries(SCENE_SIZE_PRESETS).map(([id, preset]: any) => <option key={id} value={id}>{preset.name} · {preset.width}×{preset.height}</option>)}</select></label>
            <div className="m10-size-row"><label><span>寬度 px</span><input type="number" min="320" max="8192" value={setupDraft.width} onChange={(event) => setSetupDraft({ ...setupDraft, preset: "custom", width: Number(event.target.value) })} /></label><button title="交換寬高" onClick={() => setSetupDraft({ ...setupDraft, preset: "custom", width: setupDraft.height, height: setupDraft.width })}>⇄</button><label><span>高度 px</span><input type="number" min="320" max="8192" value={setupDraft.height} onChange={(event) => setSetupDraft({ ...setupDraft, preset: "custom", height: Number(event.target.value) })} /></label></div>
            <fieldset><legend>起始模板</legend><div className="m10-template-grid">{[["blank","空白"],["basic","基本盤面"],["reel","Reel Grid 5×3"]].map(([id, label]) => <button key={id} className={setupDraft.template === id ? "active" : ""} onClick={() => setSetupDraft({ ...setupDraft, template: id })}><i>{id === "blank" ? "□" : id === "basic" ? "▣" : "▦"}</i><b>{label}</b></button>)}</div></fieldset>
          </div>
          <div className="m10-setup-actions"><button onClick={() => setSetupMode(null)}>取消</button><button className="primary" onClick={applySetup}>{setupMode === "project" ? "建立專案" : "新增 Scene"}</button></div>
        </section>
      </div>}
      {showExport && <div className="m5-modal-backdrop" onClick={(event) => { if (event.target === event.currentTarget && !exportBusy) setShowExport(false); }}><section className="m5-export-modal" role="dialog" aria-modal="true" aria-labelledby="export-title"><div className="m5-modal-head"><div><small>EXPORT PREVIEW · {supportsSlotBoardWorker() ? "背景處理" : "相容模式"}</small><h2 id="export-title">正式輸出</h2></div><button aria-label="關閉輸出視窗" onClick={() => setShowExport(false)} disabled={exportBusy}>×</button></div><div className={`m15-export-estimate ${exportEstimate.psdPeakBytes + exportEstimate.assetBytes > 512 * 1024 * 1024 ? "warning" : ""}`}><b>{exportEstimate.totalLayers} 個輸出圖層</b><span>預估 PSD 峰值 {Math.ceil(exportEstimate.psdPeakBytes / 1024 / 1024)} MB · 素材 {Math.ceil(exportEstimate.assetBytes / 1024 / 1024)} MB</span></div><div className="m5-file-preview">{buildSceneFileNames(project).map((item: any) => <div key={item.sceneId}><span>{item.base}.psd</span><small>{project.scenes[item.sceneId].width} × {project.scenes[item.sceneId].height}</small></div>)}</div><div className="m5-export-actions"><button onClick={() => void exportSinglePsd()} disabled={exportBusy}>目前 Scene PSD</button><button onClick={() => void exportAllPsd()} disabled={exportBusy}>全部 PSD ZIP</button><button onClick={() => void exportPdf()} disabled={exportBusy}>流程與標註 PDF</button><button className="technical" onClick={downloadPsd} disabled={exportBusy}>M0 技術樣本</button></div>{exportBusy && <p className="m5-progress" role="status">正在背景逐層光柵化與封裝，可繼續檢視目前專案…</p>}</section></div>}
    </main>
  );
}
