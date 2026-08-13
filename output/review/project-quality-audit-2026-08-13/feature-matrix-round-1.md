# Round 1 PRD 承諾矩陣

| 區域 | 實作狀態 | 主要證據 | 反例／缺口 |
|---|---|---|---|
| Scene 尺寸、模板、排序、複製 | 已實作 | `lib/editor-model.js`；尺寸／模板／排序往返測試 | 瀏覽器實際流程待驗 |
| 幾何圖形、文字、圖片、群組 | 已實作 | `app/editor.tsx`、`lib/editor-model.js` | 三款 Noto 只列名稱，沒有字型檔或 `@font-face`，不能稱為真正內建 |
| 移動、縮放、旋轉、翻轉 | 已實作 | SVG CTM 座標、Shift 約束、邊界限制 | 缺橫／直版真實 pointer 測試；流程 Scene 卡片拖曳每幀建立歷史，Undo 可能只退一小步 |
| Scene 畫布平移 | 已實作 | 空白／鎖定層／Space／中鍵路由、置中按鈕 | 無瀏覽器互動證據 |
| 流程畫布平移與縮放 | 已實作 | scrollLeft／scrollTop、縮放中心保持、動態世界與 CSS 高度約束 | 垂直拖曳修正只有靜態 CSS 回歸，無可執行的 X/Y 演算法測試或瀏覽器證據 |
| 圖層、對齊、分布、吸附、格線 | 已實作 | 模型命令與 UI；serialize 測試 | 跨巢狀群組任意拖排不在 MVP 明確驗收中 |
| 灰階／彩色／自訂色 | 已實作 | 五級具名灰階與彩色色盤、color input | 無瀏覽器實際選色驗證 |
| Reel Grid 與 Symbol 圖片 | 已實作 | 可變列、5×3／6×4／3-4-4-4-3、跨 Scene Symbol、PSD 像素測試 | 瀏覽器匯圖流程待驗 |
| 標註與引線 | 已實作 | 可拖曳座標、物件錨點、PDF 引線與保存測試 | `.slottemplate` 匯入更新 layer ID，卻未重映射 annotation target ID |
| Scene 模板可攜性 | 部分可靠 | `.slottemplate` 往返與 fresh layer IDs 測試 | Symbol／asset ID 可能覆寫目標專案同 ID；模板帶入全專案未引用素材 |
| 專案包與 schema | 已實作 | 30 Scene＋素材、雜湊竄改、未來 schema 唯讀測試 | ZIP 在檔案數／解壓總量檢查前已由 `unzipSync` 全量解壓，Zip bomb 防護順序不足 |
| PSD | 已實作 | 尺寸、中文、群組、順序、透明度、hidden、父群組 transform、Symbol 像素 round-trip | Photoshop 人工矩陣待補 |
| PDF | 已實作 | 流程首頁、Scene 頁、上下游、標註與引線；效能測試 | 長文字與大量標註的視覺人工 QA 待補 |
| Worker／效能 | 已實作 | Worker／OffscreenCanvas、逐 Scene 輸出、裁邊、200 縮圖快取；benchmark | 不同硬體與長時間瀏覽器記憶體待驗 |
| 部署與無後端 | 已實作 | GitHub Pages 0.17.1、相對資產、無登入／後端 | Chrome／Edge 重新整理與下載人工矩陣待補 |
| 文件一致性 | 部分一致 | PRD、ARCHITECTURE、M6-QA 有人工待辦 | `docs/M6-QA.md` 仍標 0.7.0；README／架構把未真正隨附的 Noto 稱為內建／已完成 |
