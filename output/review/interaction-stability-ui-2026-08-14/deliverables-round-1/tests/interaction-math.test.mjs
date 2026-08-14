import test from "node:test";
import assert from "node:assert/strict";
import {
  clampLayerTransformValue,
  clientDragDelta,
  hasDragIntent,
  nextFlowScenePosition,
  nextScrollAfterZoom,
  nextScrollPan,
  nextTranslationAfterZoom,
  nextTranslatedPan,
  nextWheelZoom,
  shouldReleaseNumberInputForWheel,
} from "../lib/interaction-math.js";

test("drag intent ignores a light click and accepts four-direction movement", () => {
  assert.equal(hasDragIntent(100, 100, 102, 102), false);
  assert.equal(hasDragIntent(100, 100, 104, 100), true);
  assert.equal(hasDragIntent(100, 100, 100, 96), true);
});

test("flow scroll panning updates both axes with symmetric sensitivity", () => {
  assert.deepEqual(nextScrollPan({ left: 600, top: 600 }, 100, 100, 140, 170), { left: 560, top: 530 });
  assert.deepEqual(nextScrollPan({ left: 600, top: 600 }, 100, 100, 60, 30), { left: 640, top: 670 });
});

test("Scene canvas translation updates both axes without aspect-ratio scaling", () => {
  assert.deepEqual(nextTranslatedPan({ x: 20, y: -10 }, 200, 300, 260, 250), { x: 80, y: -60 });
});

test("flow card movement compensates for overview zoom on both axes", () => {
  assert.deepEqual(nextFlowScenePosition({ x: 80, y: 120 }, 100, 100, 150, 75, .5), { x: 180, y: 70 });
  assert.deepEqual(clientDragDelta(100, 100, 150, 75, 2), { x: 25, y: -12.5 });
});

test("Ctrl-wheel zoom clamps its range and follows wheel direction", () => {
  assert.equal(nextWheelZoom(1, -100, .25, 2.5), 1.1);
  assert.equal(nextWheelZoom(1, 100, .25, 2.5), .9);
  assert.equal(nextWheelZoom(2.5, -100, .25, 2.5), 2.5);
  assert.equal(nextWheelZoom(.25, 100, .25, 2.5), .25);
  const secondStep = nextWheelZoom(nextWheelZoom(1, -100, .25, 2.5), -100, .25, 2.5);
  assert.equal(secondStep, 1.2);
  assert.equal(nextWheelZoom(secondStep, 100, .25, 2.5), 1.1);
});

test("zoom anchoring keeps the pointer's world position fixed", () => {
  assert.equal(nextScrollAfterZoom(600, 200, 1, 1.5), 1000);
  assert.deepEqual(nextTranslationAfterZoom({ x: 20, y: -10 }, { x: 100, y: 50 }, 1, 2), { x: -60, y: -70 });
});

test("focused number inputs release wheel control and transform fields stay in Scene bounds", () => {
  assert.equal(shouldReleaseNumberInputForWheel("number", true), true);
  assert.equal(shouldReleaseNumberInputForWheel("number", false), false);
  assert.equal(shouldReleaseNumberInputForWheel("text", true), false);
  const transform = { x: 100, y: 150, width: 300, height: 200 };
  const scene = { width: 960, height: 540 };
  assert.equal(clampLayerTransformValue("x", 9999, transform, scene), 660);
  assert.equal(clampLayerTransformValue("y", 9999, transform, scene), 340);
  assert.equal(clampLayerTransformValue("width", 9999, transform, scene), 860);
  assert.equal(clampLayerTransformValue("height", 9999, transform, scene), 390);
  assert.equal(clampLayerTransformValue("x", "invalid", transform, scene), 100);
});
