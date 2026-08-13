# SlotBoard 承諾功能盤點

凍結版本：`c22728b`。結論：目前是可測試的功能原型，但尚未達到 PRD 所定義的完整 MVP 驗收；自動測試全數通過，不等於所有承諾均已實作。

## 已完成或基本完成

| 功能 | 狀態 | 證據／備註 |
|---|---|---|
| Scene 資料單位、新增、改名、排序、複製 | 已完成 | `lib/editor-model.js:191-235`；UI 位於 `app/editor.tsx:580-589` |
| 單 Scene 編輯、七種幾何圖形 | 已完成 | `app/editor.tsx:591-609`；`lib/editor-model.js:20-44` |
| 移動、縮放、旋轉、翻轉、數值輸入 | 已完成，手感待驗 | `app/editor.tsx:355-423,630-634`；含 M6.1 邊界與 Shift 約束 |
| 多選、群組／解散、鎖定／隱藏 | 已完成 | `lib/editor-model.js:548-601`；圖層面板可操作 |
| 復原／重做 100 步 | 已完成 | `lib/editor-model.js:612-638` |
| 對齊、等距、吸附、參考線、像素格 | 已完成 | `lib/editor-model.js:490-528`；`app/editor.tsx:623-628` |
| 文字內容、三種 Noto 字型、排版、外框、底色 | 已完成 | `app/editor.tsx:642-650` |
| 幾何圖形原地置換圖片 | 已完成 | `lib/editor-model.js:444-488`；保留 transform 與 placeholder |
| contain／cover、縮放、焦點、重設 | 已完成 | `app/editor.tsx:635-641`；往返測試通過 |
| 圖片容量限制與縮小副本確認 | 已完成 | `app/editor.tsx:80-104,492-520` |
| 可變欄列 Reel Grid、5×3、3-4-4-4-3 | 基本完成 | 預設建立為 5×3；逐欄列數及 3-4-4-4-3 UI 可用 |
| Symbol 名稱／顏色跨 Scene 引用 | 已完成 | `lib/editor-model.js:354-372`；跨 Scene 測試通過 |
| 流程 Scene 排列、方向連線、文字、分支與迴圈 | 基本完成 | `app/editor.tsx:226-247`；資料往返測試通過 |
| Scene 內容縮圖 | 已完成（即時渲染） | `app/editor.tsx:214-222` |
| Scene／物件錨定文字標註 | 基本完成 | `lib/editor-model.js:401-415` |
| IndexedDB 異常恢復草稿 | 已完成 | `lib/recovery-storage.js` |
| `.slotboard` 專案包與素材封裝 | 已完成 | `lib/project-package.js:58-66,106-112`；30 Scene 往返通過 |
| `.slottemplate` 匯出／匯入與新 ID | 已完成 | `lib/project-package.js:68-76,114-120`；模板測試通過 |
| 損壞包、檔案數及解壓容量防護 | 已完成 | `lib/project-package.js:78-104` |
| 單 Scene PSD、全 Scene ZIP、檔名預覽 | 已實作 | `lib/export-engine.js:130-143`；下載 UI `app/editor.tsx:677` |
| PDF 流程首頁與 Scene 詳情頁 | 已實作 | `lib/export-engine.js:145-199` |
| 無登入、無後端、無協作／時間軸 | 符合範圍 | 純前端程式；未加入排除功能 |

## 部分完成

| 功能 | 缺口 |
|---|---|
| 圖層排序 | 只有「最上層／最下層」，沒有逐層上移／下移；跨群組重排能力有限。 |
| Reel Grid 預設 | 5×3 與 3-4-4-4-3 可用；PRD 點名的 6×4 沒有一鍵預設。 |
| 流程總覽畫布 | 可捲動但固定為 1800×1200，不是真正無限畫布；沒有總覽縮放保存。 |
| Scene 縮圖效能 | 內容會更新，但沒有低解析快取、節流或大型專案降頻。 |
| 標註 | 可記錄目標圖層，但編輯器內不能自由拖曳，沒有可見引線；`annotation.x/y` 沒有 UI 使用。 |
| schema migration | v1/v2 可升級；未知版本直接拋錯，沒有 PRD 承諾的唯讀開啟／另存新版。 |
| 專案包 manifest | 有版本與素材索引，但 `toolVersion` 仍固定 `0.5.0`，沒有架構文件提到的內容雜湊。 |
| PDF | 程式有流程／Scene／上下游／引線；QA 樣張由獨立 Python 腳本產生，不是瀏覽器實際輸出。長標註、多標註、旋轉群組錨點仍未驗證。 |
| 效能 | 50×100 測的是序列化／還原，不是畫布渲染、DOM、圖片記憶體或 PSD/PDF 匯出壓力。 |
| GitHub Pages | `base: "./"` 建置通過，但尚未實際部署、重新整理或跨電腦驗收。 |

## 尚未實作

| PRD 承諾 | 判定依據 |
|---|---|
| 新建專案時選橫版、直版、裝置尺寸或自訂尺寸 | 沒有新建專案／尺寸選擇 UI；Scene 固定預設 960×540。 |
| 內建空白橫版、空白直版、基本 Reel Grid Scene 模板 | 只有目前 Scene 的匯出模板；沒有內建模板選擇器。 |
| 跨 Scene 複製貼上物件 | 模型與 UI 均沒有 copy／paste 命令。 |
| 圖形外觀編輯 | Shape 有 fill／stroke 資料，但屬性面板沒有圖形填色、外框、外框寬度或圓角控制。 |
| 五級具名灰階色盤 | 沒有「背景／次要／一般／重要／最高焦點」色盤。 |
| 圖形的一般彩色色盤與自訂色 | 只有文字與 Symbol 有 color input；一般幾何圖形沒有選色入口。 |
| Symbol 圖片與同步換圖 | Symbol 模型雖有 `assetId`，UI 與 Reel renderer 只使用名稱和顏色，沒有圖片匯入／渲染。 |
| 流程自動整理 | 沒有 auto-layout 命令或確認流程。 |
| 流程總覽縮放與縮放保存 | 沒有 zoom 狀態或控制。 |
| 標註自由拖曳與編輯器引線 | 標註 UI 是固定右側清單。 |
| Web Worker 匯出／縮圖／圖片縮放 | 所有工作仍在主執行緒；大型輸出可能凍結 UI。 |
| 失敗 migration 唯讀模式 | 未支援。 |

## 發現的高風險實作問題

1. **PSD 的群組 transform 未套用到子圖層。** 編輯器 composite 會先套 group transform 再畫 child（`lib/export-engine.js:109-117`），但 PSD 群組遞迴直接個別 rasterize child（`lib/export-engine.js:125-128`），沒有帶入父群組位移、旋轉、翻轉或透明度。因此移動／旋轉過的群組，PSD 內各子圖層可能與畫面不同。這會直接碰觸 PSD 硬性契約。
2. **正式編輯器 PSD 尚無 round-trip 測試。** 現有 `verify:psd` 驗證的是固定 M0 技術樣本，不是 `createScenePsd()` 對真實 Scene／圖片／文字／Reel／群組的輸出。
3. **架構完成標籤高於實際覆蓋。** `docs/ARCHITECTURE.md` 將 M1–M4 標為已完成、README 稱 M1–M6 已完成，但上述 PRD 缺口尚未完整列入待辦。

## 仍需人工驗收

- 正式編輯器輸出的 3 種複雜度 PSD：Krita 與目標 Photoshop，尤其測試「移動＋旋轉＋透明度」的巢狀群組。
- Chrome 與 Edge：開啟、重新整理、IndexedDB 恢復、圖片匯入、PSD／ZIP／PDF 下載。
- 10 Scene／30 分鐘；5 份歷史案例至少 4 份不需外部工具。
- 美術用單一 Scene 在 10 分鐘內替換正式素材，確認全畫布點陣圖層是否增加操作負擔。
- 大量原圖的記憶體、主執行緒凍結與長時間匯出。

## 建議補完順序

1. P0：修 PSD 群組 transform，建立正式 `createScenePsd()` round-trip 測試。
2. P0：補圖形外觀面板、五級灰階色盤與一般彩色／自訂色。
3. P0：補 Symbol 圖片匯入、渲染、跨 Scene 同步與 PSD／PDF 輸出。
4. P1：跨 Scene 複製貼上、物件複製、逐層排序。
5. P1：新建尺寸／內建模板／6×4 Reel preset。
6. P1：標註拖曳與編輯器引線；流程縮放、真正可擴張畫布與自動整理。
7. P1：migration 唯讀降級、manifest 版本／雜湊。
8. P2：Worker、縮圖快取與渲染／匯出壓力測試。
9. 最後完成 Chrome／Edge、GitHub Pages、Photoshop 與 4/5 歷史案例驗收。
