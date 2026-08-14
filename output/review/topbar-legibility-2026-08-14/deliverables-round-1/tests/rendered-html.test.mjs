import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("build emits the GitHub Pages-compatible application", async () => {
  const [html, application] = await Promise.all([
    readFile(new URL("../dist/index.html", import.meta.url), "utf8"),
    readFile(new URL("../dist/assets/app.js", import.meta.url), "utf8"),
  ]);
  assert.match(html, /<title>SlotBoard 分鏡編輯器<\/title>/i);
  assert.match(html, /\.\/assets\//);
  assert.match(html, /app\.js\?v=0\.18\.2/);
  assert.match(html, /app\.css\?v=0\.18\.2/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
  await access(new URL("../dist/assets/", import.meta.url));
  await access(new URL("../dist/assets/export-worker.js", import.meta.url));
  await access(new URL("../dist/vendor/ag-psd.bundle.js", import.meta.url));
  await access(new URL("../dist/fonts/noto-sans-tc-400.woff2", import.meta.url));
  await access(new URL("../dist/fonts/noto-serif-tc-400.woff2", import.meta.url));
  await access(new URL("../dist/fonts/noto-sans-mono-400.woff2", import.meta.url));
  assert.match(application, /vendor\/ag-psd\.bundle\.js/);
  assert.doesNotMatch(application, /import\.meta\.env/, "production bundle must not retain Vite-only runtime globals");
});

test("Pages workflow gates deployment on the complete test suite", async () => {
  const workflow = await readFile(new URL("../.github/workflows/pages.yml", import.meta.url), "utf8");
  assert.match(workflow, /npm run test/);
  assert.match(workflow, /actions\/upload-pages-artifact@v3/);
  assert.match(workflow, /actions\/deploy-pages@v4/);
  assert.match(workflow, /needs: build/);
});

test("M6.1 editor keeps safe transforms, context actions and production exports available", async () => {
  const [editor, entry, packageJson, css] = await Promise.all([
    readFile(new URL("../app/editor.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/main.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
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
  assert.match(editor, /makeEditableCopy/);
  assert.match(editor, /唯讀模式/);
  assert.match(editor, /另存可編輯副本/);
  assert.match(editor, /runWorkerTask/);
  assert.match(editor, /sceneThumbnailCache/);
  assert.match(editor, /背景處理/);
  assert.match(editor, /estimateExportWorkingSet/);
  assert.match(editor, /預估 PSD 峰值/);
  assert.match(editor, /getScreenCTM/);
  assert.match(editor, /startScenePan/);
  assert.match(editor, /scrollLeft/);
  assert.match(editor, /Ctrl＋滾輪縮放 · Space／中鍵平移/);
  assert.match(editor, /aspectRatio/);
  assert.match(editor, /buildPrototypePsd/);
  assert.match(editor, /onMoveStart=\{startFlowMove\}/);
  assert.match(editor, /onMovePreview=\{previewFlowMove\}/);
  assert.match(editor, /commitHistory\(move\.baseHistory, move\.latest\)/);
  assert.match(editor, /addEventListener\("wheel", zoomWithWheel, \{ passive: false \}\)/);
  assert.match(editor, /event\.ctrlKey/);
  assert.match(editor, /event\.preventDefault\(\)/);
  assert.match(editor, /nextTranslationAfterZoom/);
  assert.match(editor, /nextScrollAfterZoom/);
  assert.match(editor, /m1-mode-button/);
  assert.match(editor, /aria-pressed=\{viewMode === "scene"\}/);
  assert.match(editor, /aria-pressed=\{viewMode === "flow"\}/);
  assert.match(entry, /SlotBoardEditor/);
  assert.match(packageJson, /"verify:psd"/);
  assert.match(css, /\.m1-center\s*\{[^}]*min-height:\s*0[^}]*overflow:\s*hidden/s);
  assert.match(css, /\.m3-flow-shell\s*\{[^}]*height:\s*100%[^}]*overflow:\s*hidden/s);
  assert.match(css, /\.m3-flow-canvas\s*\{[^}]*height:\s*0[^}]*overflow:\s*auto/s);
  assert.match(css, /\.m1-history \.m1-mode-button\s*\{[^}]*width:\s*auto[^}]*min-width:\s*68px[^}]*padding:\s*0 16px[^}]*white-space:\s*nowrap/s);
  assert.doesNotMatch(css, /\.m1-history \.m1-mode-button\s*\{[^}]*width:\s*34px/s);
});
