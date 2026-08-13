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

test("M6.1 editor keeps safe transforms, context actions and production exports available", async () => {
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
  assert.match(editor, /createProjectPackage/);
  assert.match(editor, /createTemplatePackage/);
  assert.match(editor, /createPsdZip/);
  assert.match(editor, /createProjectPdf/);
  assert.match(editor, /EXPORT PREVIEW/);
  assert.match(editor, /aria-modal="true"/);
  assert.match(editor, /removeLayers/);
  assert.match(editor, /m6-context-menu/);
  assert.match(editor, /event\.shiftKey/);
  assert.match(editor, /locateLayerInScene/);
  assert.match(editor, /GRAYSCALE_PALETTE/);
  assert.match(editor, /SHAPE APPEARANCE/);
  assert.match(editor, /最高焦點/);
  assert.match(editor, /replaceSymbolImage/);
  assert.match(editor, /所有 Scene 引用已同步/);
  assert.match(editor, /copyLayerSelection/);
  assert.match(editor, /貼上物件/);
  assert.match(editor, /向上移一層/);
  assert.match(editor, /SCENE_SIZE_PRESETS/);
  assert.match(editor, /建立新專案/);
  assert.match(editor, /Reel Grid 5×3/);
  assert.match(editor, /6×4 預設/);
  assert.match(editor, /startAnnotationDrag/);
  assert.match(editor, /m11-annotation-link/);
  assert.match(editor, /moveAnnotation/);
  assert.match(editor, /autoArrangeScenes/);
  assert.match(editor, /m12-flow-toolbar/);
  assert.match(editor, /自動整理會重新排列/);
  assert.match(editor, /buildPrototypePsd/);
  assert.match(entry, /SlotBoardEditor/);
  assert.match(packageJson, /"verify:psd"/);
});
