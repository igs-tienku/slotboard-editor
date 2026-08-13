# SlotBoard 分鏡編輯器

此工作區包含 SlotBoard MVP 的產品需求、技術架構、PSD 輸出技術原型，以及已完成並部署的 M1–M16 編輯器。

- 正式網站：https://igs-tienku.github.io/slotboard-editor/
- 公開原始碼：https://github.com/igs-tienku/slotboard-editor

## 已完成

- 正式 MVP PRD：`docs/PRD.md`
- 編輯器架構及 M0–M6 里程碑：`docs/ARCHITECTURE.md`
- 瀏覽器端 PSD 下載原型
- PSD 寫入後重新解析的自動結構檢查
- Photoshop 人工驗證清單：`docs/PSD-SPIKE-REPORT.md`
- M1 專案 schema 與最多 100 步復原／重做
- Scene 新增、改名、改序、複製及本機異常恢復草稿
- 七種基礎圖形、選取、移動、縮放、旋轉與翻轉
- 圖層命名、顯示、鎖定、群組及解除群組
- 30 Scene 保存、重開與內容一致性測試
- 畫布／多物件對齊、等距分布、智慧吸附、參考線及像素格線
- 圖片容量驗證、超標縮小副本、原地置換、contain／cover、焦點及重設
- IndexedDB 大型恢復草稿，保留圖片與裁切設定
- 文字內容、三類 Noto 開源字型、字級字重、行距字距、對齊、外框及底色
- 可變軸數及逐軸列數的 Reel Grid，含 5×3 與 3-4-4-4-3 等結構
- 專案級 Symbol 定義，可跨 Scene 引用並同步改名／改色／換圖
- 可拖曳 Scene 的流程總覽、自由文字連線、分支及迴圈
- 依 Scene 內容自動更新的縮圖
- 畫布外 Scene 標註與指定圖層錨點
- `.slotboard` 專案包：包含版本化 JSON、圖片素材與 manifest
- `.slottemplate` Scene 模板包，可匯入目前專案並產生新 ID
- 檔名清理、損壞包拒絕、解壓容量與檔案數量防護

## 本機使用

```powershell
npm install
npm run dev
```

開啟後即可編輯 Scene。右上角可開啟／儲存 `.slotboard`，或將目前 Scene 匯出為 `.slottemplate`；上方可切換「Scene／流程」模式。右上角仍可下載 M0 PSD 技術樣本。

## 驗證

```powershell
npm run test
```

## M5 輸出

- 單一 Scene 可匯出保留圖層與群組結構的 PSD。
- 全專案可依 Scene 順序匯出 Windows 安全命名的 PSD ZIP。
- PDF 第一頁為完整流程總覽，後續每頁包含 Scene 畫面、標註引線，以及上游／下游關係。
- 匯出前會顯示預計檔名；技術樣張與自動 round-trip 測試仍保留。
- PDF 視覺驗證樣張位於 `output/pdf/slotboard-m5-sample.pdf`。

## M6 驗收

- `npm run benchmark` 會驗證 50 Scene × 100 圖層的序列化與還原。
- 已加入 Delete／Backspace、Escape、輸入欄位快捷鍵保護與清楚的鍵盤焦點。
- GitHub Pages 子路徑採相對資產路徑建置；人工瀏覽器與 Krita／Photoshop 驗收清單見 `docs/M6-QA.md`。

### M6.1 操作修正

- 點擊物件不再建立空白拖曳紀錄；超過 4px 才開始移動，且物件與縮放結果會留在 Scene 範圍內。
- Shift＋縮放維持比例；Shift＋旋轉吸附 0°／90°／180°／270°。
- 右鍵可找回物件、調整最上／最下層、置換圖片或刪除；空白處右鍵可新增常用內容。
- 新舊專案的全畫布背景均會保持在最下層，PSD 匯出另有同樣防呆。

### M6.2 PSD 群組修正

- 巢狀群組的父層位移、旋轉與翻轉會正確套用到 PSD 內每個獨立子圖層。
- PSD opacity 不再重複烘焙，並新增正式 Scene 的像素 round-trip 測試。

## M7 圖形外觀

- 一般幾何圖形可設定填色、外框色、外框寬度與矩形圓角。
- 內建「背景、次要、一般、重要、最高焦點」五級灰階色盤。
- 同時保留常用彩色色盤與自訂色，符合灰階優先但不限制其他顏色的需求。

## M8 Symbol 圖片

- 每個專案級 Symbol 可匯入或更換一張圖片，所有 Scene 的 Reel Grid 引用同步更新。
- Symbol 圖片沿用單張 20 MB／8192px、專案 200 MB 與超標縮小副本規則。
- 可移除圖片回到灰階 placeholder；不再引用的舊圖片會從專案資產庫清除。
- Scene 畫布、PSD 與 PDF 共用同一套 contain／cover 與焦點資料，PSD 像素 round-trip 已納入自動測試。

## M9 跨 Scene 剪貼簿與圖層排序

- Ctrl+C／Ctrl+V 可在不同 Scene 間複製貼上物件；Ctrl+D 可在目前 Scene 建立複本。
- 群組貼上會替群組與所有子物件產生新 ID，避免後續編輯互相干擾。
- 右鍵選單提供複製、貼上、建立複本、逐層上移／下移及最上／最下層。
- 貼上位置會偏移並限制在 Scene 內；背景防呆仍保證全畫布背景位於最下層。

## M10 新建尺寸與內建模板

- 新建專案或新增 Scene 時，可選橫版 HD、工作稿、直版 HD、手機、平板或 320–8192px 自訂尺寸。
- 內建空白、基本盤面與 Reel Grid 5×3 三種起始模板；內容會依 Scene 尺寸等比例配置。
- Reel Grid 屬性區新增 6×4 與 3-4-4-4-3 快捷預設。
- 新建專案在取代已有工作前會要求確認；新增 Scene 不影響專案既有內容。

## M11 可拖曳標註與錨點引線

- 標註卡片直接顯示在 Scene 延伸畫布，可用編號圓鈕自由拖曳並保存位置。
- 先選物件再新增標註，會建立物件錨點；畫布即時顯示錨點圓點與連到卡片的引線。
- Scene 整體備註不強制連線，物件被刪除時仍會清理其錨定標註。
- PDF 會沿用標註位置，繪出同一物件錨點、引線與卡片。

## M12 流程縮放與自動整理

- 流程總覽可在 50%–150% 間縮放、快速回到 100%，縮放值會隨專案保存。
- 拖曳 Scene 時會依縮放比例換算座標，縮小檢視時仍可精確移動。
- 流程世界會依 Scene 最遠位置自動擴張，不再固定於 1800×1200。
- 自動整理會依連線方向安排欄位與分支列；含迴圈的流程也能安全完成排列。

## M13 唯讀相容模式與套件完整性

- 高於目前 schema 的專案可安全地以唯讀模式開啟、檢視及輸出，不再直接拒絕。
- 「另存可編輯副本」會保留可理解的資料，建立目前 schema 的新專案 ID 並立即匯出備份。
- `.slotboard`／`.slottemplate` manifest 會寫入實際工具版本、JSON 內容雜湊及每個素材雜湊。
- 匯入會拒絕 JSON 被修改或素材內容遭同長度破壞的套件；舊版無雜湊套件仍可開啟。

## M14 背景處理與縮圖快取

- 支援 Worker／OffscreenCanvas 時，單 Scene PSD、批次 PSD ZIP、PDF 與超標圖片縮小會在背景執行。
- 瀏覽器不支援或 Worker 發生錯誤時會自動退回相容模式，不會讓輸出功能失效。
- Worker 以獨立 GitHub Pages 資產建置；正式 Scene PSD 已通過無 `document` 的離屏畫布測試。
- Scene 縮圖改為依 `scene.id + thumbnailRevision` 快取的低成本 SVG，最多保留 200 份，避免流程總覽重複建立大量節點。

## M15 真實輸出壓測與記憶體優化

- PSD 子圖層改為逐層光柵化，不再以 `Promise.all` 同時保留大量全畫布像素。
- 每個 PSD 圖層會裁掉透明邊界，仍保留正確的 `left／top／right／bottom` 與群組結構。
- 輸出視窗會顯示圖層數、素材量與 PSD 峰值工作記憶體估算，超過 512 MB 時顯示警示。
- 自動壓測包含 8 Scene × 50 圖層真實 Canvas 渲染，以及 3 Scene × 18 圖層的 PSD ZIP、PDF 實際產生；目前 30 秒測試預算內通過。

測試會完成 TypeScript 檢查、GitHub Pages 相容打包、重新產生 PSD，並驗證尺寸、中文圖層名稱、巢狀群組、順序、隱藏狀態及透明度。

基準 PSD 位於 `artifacts/psd-prototype/01_PSD技術驗證.psd`。已由使用者在 Krita 實際開啟並確認結構正常；正式發版前仍應補 Photoshop 相容性驗證。
