---
version: "1.0"
passing_score: 90
passing_rule: all
max_rounds: 5
---

# SlotBoard v0.20.1 發布前審核規格

## [criterion:C1] 核心畫布互動安全

### Requirements / 要求

- Scene 與流程圖畫布皆可雙軸平移，Ctrl＋滾輪只縮放畫布。
- 點擊、拖曳、視窗失焦與 pointer cancel 不會讓物件飛走或留下殘餘拖曳狀態。
- 直線與箭頭具有不依畫布縮放而改變的友善命中區。

### Score anchors / 評分錨點

- 95–100：所有操作均有實作與回歸證據，沒有已知阻斷。
- 90–94：核心操作完整，僅有不影響試用的小型手感風險。
- 70–89：至少一項主要畫布操作缺失、易誤觸或缺乏回歸證據。
- 0–69：基本拖曳、平移或縮放不可可靠使用。

### Required evidence / 必須證據

- `app/editor.tsx` 的事件生命週期與命中區實作。
- `lib/interaction-math.js` 及相關自動測試結果。

## [criterion:C2] 群組與圖層語意

### Requirements / 要求

- 點擊群組任一成員或包圍盒空白處會操作外層群組，移動時成員保持相對位置。
- 群組縮放同步套用所有巢狀成員；旋轉由父層轉換共同生效。
- 圖層拖曳排序限制在同層級，背景預設鎖定且維持最底層。

### Score anchors / 評分錨點

- 95–100：群組移動／縮放、巢狀結構、排序與背景規則都有直接證據。
- 90–94：功能可用且安全，僅缺少非核心進階編輯手勢。
- 70–89：群組不能整體操作、排序可能破壞階層或背景位置。
- 0–69：群組或圖層順序造成主要內容不可用。

### Required evidence / 必須證據

- `LayerVisual`、`groupLayers`、`scaleGroupChildren`、`moveLayerByDrop`。
- 群組、拖放、背景鎖定與 PSD 順序測試。

## [criterion:C3] 資料保存與復原完整性

### Requirements / 要求

- 專案序列化／重開、30 Scene、跨 Scene 複製、模板與資產 ID 重映射均通過。
- 自動復原不覆蓋使用者已開始的操作。
- 舊 schema 可遷移，較新 schema 以唯讀安全開啟並可建立副本。

### Score anchors / 評分錨點

- 95–100：所有資料路徑都有成功與損壞案例測試。
- 90–94：核心保存可靠，僅缺少極端外部損壞情境。
- 70–89：存在資料遺失、ID 衝突或復原覆蓋風險。
- 0–69：專案無法可靠重開或匯入。

### Required evidence / 必須證據

- `tests/editor-model.test.mjs`、`tests/project-package.test.mjs`。
- 套件 hash、檔案數與容量預檢證據。

## [criterion:C4] PSD 與交付輸出正確性

### Requirements / 要求

- PSD 根圖層與巢狀群組順序符合編輯器視覺，背景位於最底層。
- 單 Scene PSD、批次 ZIP、PDF、圖片／Symbol 與群組轉換均有回歸測試。
- Krita 相容性已有實際使用者確認；不宣稱未驗證的 Photoshop 全版本相容。

### Score anchors / 評分錨點

- 95–100：像素、順序、群組與輸出路徑皆有自動驗證。
- 90–94：內部試用輸出可靠，僅保留跨軟體版本相容性風險。
- 70–89：圖層順序、群組或圖片輸出有明顯落差。
- 0–69：PSD 無法開啟或主要內容被背景遮蔽。

### Required evidence / 必須證據

- PSD prototype verification、round-trip 與 export tests。
- `lib/export-engine.js`、`artifacts/psd-regression/`。

## [criterion:C5] UI 可讀性與可發現性

### Requirements / 要求

- 系統字級、頂部模式按鈕、右側屬性面板與狀態提示在一般桌面寬度可閱讀。
- 群組、解散、圖層拖曳、畫布平移與縮放均有可辨識入口或提示。
- 放大 UI 不破壞畫布操作空間與控制功能。

### Score anchors / 評分錨點

- 95–100：主要入口清楚，字級與版面均有靜態／回歸證據。
- 90–94：可供同事試用，仍可能需要極短操作說明。
- 70–89：主要功能難以找到、文字難讀或控制重疊。
- 0–69：UI 阻止基本任務完成。

### Required evidence / 必須證據

- `app/globals.css`、`tests/rendered-html.test.mjs`。
- README 操作說明與既有使用者驗收回饋。

## [criterion:C6] 效能、建置與回歸品質

### Requirements / 要求

- TypeScript、build、lint、完整測試、PSD 驗證與 benchmark 全數通過。
- 50 Scene × 100 layer 與實際 Canvas／PSD／PDF 工作負載在既定預算內。
- 沒有未提交的產品程式碼變更。

### Score anchors / 評分錨點

- 95–100：所有檢查乾淨通過且有可重跑命令。
- 90–94：全部核心檢查通過，只有環境警告或非阻斷建議。
- 70–89：有失敗測試、lint、build 或效能超標。
- 0–69：無法建立可部署成品。

### Required evidence / 必須證據

- `npm run test`、`npm run lint`、`npm run benchmark` 輸出。
- `git status` 與提交識別。

## [criterion:C7] 線上發布與版本一致性

### Requirements / 要求

- GitHub Actions build 與 deploy 均成功。
- 線上 HTML、package、套件 manifest 與提交文件一致為 v0.20.1。
- GitHub Pages 可讀取正式 bundle，不含預覽環境殘留。

### Score anchors / 評分錨點

- 95–100：提交、CI、Pages 與線上版本均可交叉驗證。
- 90–94：部署成功，僅有不影響使用的第三方 action 警告。
- 70–89：版本不一致、部署未完成或線上資源缺失。
- 0–69：同事無法開啟線上工具。

### Required evidence / 必須證據

- GitHub Actions run `31765990579`。
- 線上首頁 v0.20.1 資源查核與 rendered HTML tests。

## Hard failures / 一票否決

- 完整測試、build、PSD 驗證或 Pages 部署失敗。
- 主要畫布無法平移／縮放／拖曳。
- 群組無法整體移動，或圖層／背景順序再次錯亂。
- 專案保存／重開造成可重現資料遺失。
- PSD 無法開啟或背景遮蔽主要物件。
