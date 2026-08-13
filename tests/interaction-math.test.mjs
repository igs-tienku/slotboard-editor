import test from "node:test";
import assert from "node:assert/strict";
import {
  clientDragDelta,
  hasDragIntent,
  nextFlowScenePosition,
  nextScrollPan,
  nextTranslatedPan,
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
