import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("build emits the GitHub Pages-compatible application", async () => {
  const html = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
  assert.match(html, /<title>SlotBoard 分鏡編輯器<\/title>/i);
  assert.match(html, /\.\/assets\//);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
  await access(new URL("../dist/assets/", import.meta.url));
});

test("M3 editor keeps reel, symbol, flow, annotation and PSD controls available", async () => {
  const [editor, entry, packageJson] = await Promise.all([
    readFile(new URL("../app/editor.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/main.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(editor, /SlotBoardEditor/);
  assert.match(editor, /groupLayers/);
  assert.match(editor, /undoHistory/);
  assert.match(editor, /replaceLayerWithImage/);
  assert.match(editor, /alignLayers/);
  assert.match(editor, /addTextLayer/);
  assert.match(editor, /addReelGridLayer/);
  assert.match(editor, /FlowOverview/);
  assert.match(editor, /PROJECT SYMBOLS/);
  assert.match(editor, /SCENE 標註/);
  assert.match(editor, /buildPrototypePsd/);
  assert.match(entry, /SlotBoardEditor/);
  assert.match(packageJson, /"verify:psd"/);
});
