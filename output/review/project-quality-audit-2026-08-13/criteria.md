---
title: "SlotBoard 專案品質與 MVP 承諾覆蓋"
version: "1.0"
passing_score: 85
passing_rule: all
max_rounds: 5
---

# 審核規範

每項獨立評分 0–100，所有項目均須達 85 分且不得出現硬性失敗。缺少所要求的客觀或人工證據必須降分，不得以平均分補償。

## [criterion:C1] 啟動、部署與版本可追溯性

### Requirements

- 正式站回應成功，HTML、JS、CSS 與 Worker 使用相容的相對路徑並載入同一版本。
- TypeScript 建置、完整測試與 GitHub Pages 工作流程通過。
- 版本、提交、部署結果可追溯，工作目錄不得夾帶未說明變更。

### Score anchors

- 95–100：正式站與本機產物一致，完整測試及部署通過，版本與快取策略可追溯。
- 85–94：可正常啟動部署，僅有不影響使用的小型維運警告。
- 70–84：可建置但缺少正式站或資產載入證據，或版本資訊不一致。
- 40–69：主要模式或資產偶發無法載入。
- 0–39：空白頁、建置失敗或正式站不可用。

### Required evidence

- `npm run test`、`npm run lint`、GitHub Actions 結果及正式站 HTTP／版本資產檢查。
- `package.json`、`scripts/build.mjs`、`.github/workflows` 與部署提交位置。

## [criterion:C2] 基礎編輯操作與畫布導航

### Requirements

- Scene 中選取、輕點、四向拖曳、不同尺寸座標換算、縮放、Shift 等比縮放、旋轉及 Shift 90 度吸附正確。
- Scene 與流程總覽皆可四向平移；物件不會因點擊 UI 飛出畫面，越界物件能可靠找回。
- 復原／重做、刪除、Escape、右鍵合法操作及鎖定行為一致。
- 事件必須正確區分物件拖曳、畫布平移與工具列互動。

### Score anchors

- 95–100：Chrome／Edge 互動矩陣全通過，且座標與事件路由有自動回歸測試。
- 85–94：核心互動有充分演算法測試，至少一個支援瀏覽器人工通過，無阻斷缺陷。
- 70–84：程式路徑存在但缺少真實互動證據，或仍有明顯手感風險。
- 40–69：任一主要變形或畫布導航不可靠。
- 0–39：無法基本選取、拖曳、平移或復原。

### Required evidence

- 支援瀏覽器的實際操作紀錄或截圖；若不可用須明確列為證據缺口。
- `app/editor.tsx` 的 pointer routing、座標換算、pointer capture 與 CSS overflow 證據。
- 對橫版、直版、流程 X/Y 平移、輕點不移動及找回功能的自動化回歸結果。

## [criterion:C3] Scene 建構與企劃功能承諾

### Requirements

- Scene 尺寸／模板、常見幾何圖形、文字、圖片原地置換、圖層群組／排序／鎖定／隱藏、對齊／分布／吸附／格線均可用。
- 五級具名灰階、彩色與自訂色保留；文字及圖片裁切設定可保存。
- Reel Grid 可變列數與預設、跨 Scene Symbol 圖片同步、標註引線、流程連線／縮放／擴張／自動整理均符合 PRD。
- Scene 清單排序與流程位置彼此獨立，且 Scene 可複製、跨 Scene 貼上。

### Score anchors

- 95–100：承諾矩陣逐項有 UI、模型與保存／輸出證據，無未揭露缺口。
- 85–94：所有核心承諾均可完成，僅有非阻斷的小型便利性差距。
- 70–84：一項以上 PRD 核心承諾只有資料模型或部分 UI。
- 40–69：多項建立分鏡必需功能缺失或無法保存。
- 0–39：無法完成基本 Slot Scene 示意圖。

### Required evidence

- PRD 第 3–5、7 節逐項功能矩陣，附程式位置、測試名稱與缺口。
- 模型 serialize／reload、跨 Scene、Symbol、Reel、標註與流程測試結果。

## [criterion:C4] 專案資料、安全與恢復可靠性

### Requirements

- `.slotboard`、`.slottemplate` 可攜且不依賴原始本機路徑，素材及 ID 正確往返。
- IndexedDB 恢復草稿、undo／redo、schema migration、未來版本唯讀副本均安全。
- 損壞包、內容雜湊、檔案數、解壓容量、圖片尺寸與容量限制不會破壞目前專案。
- 檔名、重名與 Windows 不合法字元安全處理。

### Score anchors

- 95–100：正常、舊版、未來版、損壞及容量邊界全部有客觀測試。
- 85–94：核心保存與拒絕策略完整，僅缺少極端環境人工驗證。
- 70–84：正常往返可用，但安全拒絕或恢復路徑有缺口。
- 40–69：匯入失敗可能破壞專案或素材遺失。
- 0–39：無可靠保存或專案重開能力。

### Required evidence

- 專案包、migration、recovery 與容量檢查程式位置。
- 正常往返、舊／未來 schema、損壞／竄改包及檔名測試結果。

## [criterion:C5] PSD、批次 PSD 與 PDF 輸出契約

### Requirements

- PSD 尺寸、根圖層順序、背景最下層、巢狀群組、名稱、透明度、隱藏與父群組 transform 正確。
- 畫面可見結果、圖片裁切、文字、Reel Grid 與 Symbol 圖片能依 Scene 內容光柵化；標註不進 PSD。
- 批次檔名依 Scene 清單順序、安全且不重複；PDF 含流程總覽、每 Scene、上下游、連線文字、標註與引線。
- Krita／Photoshop 相容性與人工驗收狀態誠實記錄。

### Score anchors

- 95–100：自動 round-trip、像素比較、Krita 與目標 Photoshop 三種複雜度皆通過。
- 85–94：自動結構與像素驗證完整，Krita 已通過；Photoshop 待外部矩陣且被清楚揭露。
- 70–84：可輸出但任一關鍵圖層契約缺少自動或人工證據。
- 40–69：圖層順序、群組 transform、背景或畫面像素錯誤。
- 0–39：無法產生可開啟 PSD 或 PSD 不是分層結構。

### Required evidence

- `verify:psd`、真實 Scene PSD round-trip、像素邊界／順序／Symbol 測試與 PDF 結構檢查。
- Krita／Photoshop 人工狀態及固定回歸素材位置。

## [criterion:C6] 效能、可用性與錯誤韌性

### Requirements

- 50 Scene × 100 圖層資料壓測通過；實際 Canvas、PSD ZIP 與 PDF 有合理時間及工作集界線。
- 重工作業優先使用 Worker／OffscreenCanvas，主執行緒回退不破壞結果。
- 鍵盤輸入不誤觸快捷鍵，焦點、dialog、進度及錯誤訊息具基本可用性。
- 大型專案不因無界縮圖快取或一次展開全部像素而明顯失控。

### Score anchors

- 95–100：資料、渲染與輸出壓測均通過，工作集與可用性有瀏覽器人工證據。
- 85–94：客觀壓測與架構防護完整，僅缺少長時間／不同硬體矩陣。
- 70–84：只有序列化壓測，或 Worker／記憶體策略未覆蓋正式輸出。
- 40–69：典型 30 Scene 專案操作或輸出會長時間凍結。
- 0–39：正常規模即崩潰、失去資料或無法輸出。

### Required evidence

- `npm run benchmark` 數據、worker build／fallback 檢查、縮圖快取上限與逐 Scene 釋放證據。
- 快捷鍵保護、焦點／dialog 靜態規則及可用時的瀏覽器人工紀錄。

## [criterion:C7] 規劃文件一致性與驗收誠實度

### Requirements

- PRD、架構里程碑、README、QA 與實際完成狀態一致。
- 未完成的 Chrome／Edge、Photoshop、10 Scene／30 分鐘、4/5 歷史案例與美術 10 分鐘替換不得宣稱已驗收。
- 每項已完成承諾可追溯至程式、測試或人工紀錄；排除項目沒有被誤列為缺陷。
- 已知高風險與回歸測試指引可讓下一位測試者重現。

### Score anchors

- 95–100：文件、版本與證據矩陣同步，完成／待驗狀態沒有矛盾。
- 85–94：主要狀態誠實且可追溯，僅有小型版本或措辭落差。
- 70–84：文件把實作完成寫成驗收完成，或遺漏重要人工待辦。
- 40–69：多處完成宣告與實際功能不符。
- 0–39：無可用規劃基準或刻意隱藏硬性缺口。

### Required evidence

- PRD／ARCHITECTURE／M6-QA／README 對照矩陣及 Git 提交證據。
- 明列自動通過、人工通過、人工待驗與超出範圍四種狀態。

# 硬性失敗條件

- 正式站空白、主要資產無法載入或完整測試失敗。
- Scene 或流程畫布無法四向導航，或基本拖曳會造成物件不可恢復遺失。
- PSD 背景、圖層順序、巢狀群組或父群組 transform 與 Scene 畫面不符。
- 專案正常保存重開遺失 Scene／素材，或損壞匯入覆蓋目前專案。
- 將缺少人工證據的 Chrome／Edge、Photoshop 或效率目標宣稱為已驗收。
