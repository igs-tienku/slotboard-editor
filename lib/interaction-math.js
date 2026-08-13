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
