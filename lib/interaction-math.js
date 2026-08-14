export const DRAG_THRESHOLD_PX = 4;

export function hasDragIntent(startX, startY, clientX, clientY, threshold = DRAG_THRESHOLD_PX) {
  return Math.hypot(clientX - startX, clientY - startY) >= threshold;
}

export function clientDragDelta(startX, startY, clientX, clientY, scale = 1) {
  const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
  return { x: (clientX - startX) / safeScale, y: (clientY - startY) / safeScale };
}

export function nextScrollPan(origin, startX, startY, clientX, clientY) {
  const delta = clientDragDelta(startX, startY, clientX, clientY);
  return { left: origin.left - delta.x, top: origin.top - delta.y };
}

export function nextTranslatedPan(origin, startX, startY, clientX, clientY) {
  const delta = clientDragDelta(startX, startY, clientX, clientY);
  return { x: origin.x + delta.x, y: origin.y + delta.y };
}

export function nextFlowScenePosition(origin, startX, startY, clientX, clientY, zoom) {
  const delta = clientDragDelta(startX, startY, clientX, clientY, zoom);
  return { x: origin.x + delta.x, y: origin.y + delta.y };
}

export function nextWheelZoom(currentZoom, deltaY, minZoom, maxZoom, step = .1) {
  const direction = deltaY < 0 ? 1 : -1;
  return Math.max(minZoom, Math.min(maxZoom, Math.round((currentZoom + direction * step) * 100) / 100));
}

export function nextScrollAfterZoom(scroll, anchor, previousZoom, nextZoom) {
  const ratio = nextZoom / previousZoom;
  return (scroll + anchor) * ratio - anchor;
}

export function nextTranslationAfterZoom(origin, anchor, previousZoom, nextZoom) {
  const ratio = nextZoom / previousZoom;
  return {
    x: anchor.x - (anchor.x - origin.x) * ratio,
    y: anchor.y - (anchor.y - origin.y) * ratio,
  };
}
