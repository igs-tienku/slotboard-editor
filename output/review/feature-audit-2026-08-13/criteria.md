---
version: "1.0"
passing_score: 85
passing_rule: all
max_rounds: 5
---

## [criterion:C1] Scene 與基礎編輯核心

### Requirements

Scene 為資料單位；支援新增、改名、排序、複製、單 Scene 編輯、多選、拖移、縮放、旋轉、翻轉、鎖定、顯示、群組、圖層順序、復原重做、對齊吸附，且物件可救回、不易誤移出畫布。

### Score anchors

- 95–100：全部存在且有模型或互動測試。
- 85–94：主要功能完整，僅少量人工手感待驗。
- 70–84：有一項承諾缺失或僅表面控制項。
- 0–69：多項核心操作缺失或資料可遺失。

### Required evidence

模型函式、編輯器事件處理、回歸測試與可觀察控制項位置。硬失敗：Scene 或復原重做不可用；物件仍可永久遺失。

## [criterion:C2] 圖形、文字、圖片與色彩

### Requirements

常見幾何圖形、灰階重要度工作流、其他顏色色盤、文字、開源中文字型、圖片原地原尺寸置換、contain/cover、焦點與重設 placeholder 均可用。

### Score anchors

- 95–100：各類功能完整且持久化、輸出一致。
- 85–94：主要功能完整，字型或進階裁切僅需人工驗收。
- 70–84：缺少明確色盤、文字／圖片的一項關鍵操作。
- 0–69：基本拼圖需求不成立。

### Required evidence

圖形／文字／圖片模型、UI 控制、素材限制與測試。硬失敗：圖片置換會改變物件幾何或無法復原。

## [criterion:C3] Slot 專用元件與跨 Scene 流程

### Requirements

可變欄列 Reel Grid、5×3 與 3-4-4-4-3、專案共用 Symbol、Scene 縮圖、流程總覽、分支／迴圈／標籤、Scene 標註與目標圖層關聯可持久化。

### Score anchors

- 95–100：全部功能完整且有跨 Scene 測試。
- 85–94：核心完整，僅操作手感待驗。
- 70–84：一項專用元件或流程關聯部分完成。
- 0–69：仍只能靠一般圖形手拼主要 Slot 結構。

### Required evidence

模型、畫面、持久化測試與 PDF 使用證據。硬失敗：Symbol 修改不同步或流程關係遺失。

## [criterion:C4] 專案保存、模板與恢復

### Requirements

IndexedDB 自動恢復、`.slotboard` 專案包、`.slottemplate` Scene 模板、素材封裝、ID 重建、舊 schema migration、損壞包安全拒絕與無登入單機使用完整。

### Score anchors

- 95–100：完整且有往返、損壞與大量 Scene 測試。
- 85–94：完整，僅跨瀏覽器人工驗收待補。
- 70–84：封裝或恢復有一項缺口。
- 0–69：保存後不能可靠重開。

### Required evidence

套件程式、儲存程式、限制與自動測試。硬失敗：損壞匯入會覆蓋目前專案或素材遺失。

## [criterion:C5] PSD 正式交付

### Requirements

單 Scene PSD、全 Scene ZIP、安全檔名預覽、中文圖層名、群組、順序、隱藏、透明度、背景底層、可由美術依圖層置換正式圖像；Krita 可開，Photoshop 相容性有明確狀態。

### Score anchors

- 95–100：正式編輯器 PSD 已在 Krita 與 Photoshop 矩陣驗收。
- 85–94：正式輸出結構自動驗證且 Krita 實測通過，僅 Photoshop 待補。
- 70–84：技術樣本通過，但正式編輯器 PSD 尚缺結構實測。
- 0–69：PSD 無圖層或順序錯誤。

### Required evidence

匯出程式、round-trip、Krita／Photoshop 紀錄。硬失敗：背景遮住內容、群組或圖層結構遺失。

## [criterion:C6] PDF 溝通輸出

### Requirements

PDF 首頁完整流程，後續每 Scene 一頁，含畫面、標註引線、上下游關係、中文與足夠頁面尺寸；有結構與視覺 QA。

### Score anchors

- 95–100：動態專案輸出及樣張均完整驗證。
- 85–94：實作完整且樣張 QA 通過，動態瀏覽器下載待人工驗收。
- 70–84：有 PDF 但缺流程、標註或關係資訊。
- 0–69：不可產出可用 PDF。

### Required evidence

PDF 實作、樣張頁數／尺寸、渲染圖檢查。硬失敗：中文亂碼或 Scene 被裁切。

## [criterion:C7] Canva 式可用性與操作發現

### Requirements

主要常用操作可直覺找到；左側 Scene、工具列、圖層／屬性面板、右鍵整合選單、快捷鍵、焦點、明確游標、Shift 約束、錯誤訊息與輸出進度合理。需判斷是否已達「知名網路工具 Canva 的主要功能」這項原始期望，並指出範圍落差。

### Score anchors

- 95–100：關鍵工作流通過使用者實測，沒有重大尋找或誤操作問題。
- 85–94：主要操作完整，少量手感待調整。
- 70–84：功能可用但仍缺多項 Canva 常見編輯便利性。
- 0–69：使用者常找不到功能或容易破壞作品。

### Required evidence

UI 原始碼、無障礙檢查、使用者回報與人工驗收狀態。硬失敗：常見操作沒有可發現入口或已知重大操作 bug 未處理。

## [criterion:C8] 效能、相容性與發布

### Requirements

30 Scene 資料往返、50 Scene × 100 圖層壓力測試、Chrome／Edge、GitHub Pages 相對路徑與重新整理、版本與使用說明均有證據；不要求協作、登入或時間軸。

### Score anchors

- 95–100：效能、兩瀏覽器與已部署站台全部驗收。
- 85–94：自動效能與建置通過，僅部署或一項人工瀏覽器驗收待補。
- 70–84：自動測試完整，但瀏覽器與部署均未驗收。
- 0–69：規模或靜態建置不達標。

### Required evidence

測試輸出、Vite／hosting 設定、部署狀態與 QA 文件。硬失敗：50×100 不可處理或正式建置失敗。

## [criterion:C9] 驗收覆蓋與承諾透明度

### Requirements

PRD 每項需求可映射到程式、測試或明確人工待辦；不得把尚未完成的 Photoshop、瀏覽器、歷史案例效率或 Canva 範圍宣稱為完成。

### Score anchors

- 95–100：完整可追溯矩陣，沒有未揭露缺口。
- 85–94：主要可追溯，少量低風險人工項目待補。
- 70–84：文件有列待辦，但仍有承諾未落地或未測。
- 0–69：里程碑完成宣稱與實際證據顯著不符。

### Required evidence

PRD、架構完成紀錄、README、QA 文件、測試名稱與產品程式。硬失敗：把已知未完成項目標為已驗收完成。
