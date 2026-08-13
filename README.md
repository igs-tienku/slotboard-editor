# SlotBoard 分鏡編輯器

此工作區包含 SlotBoard MVP 的產品需求、技術架構、PSD 輸出技術原型，以及已完成的 M1–M6 編輯器。

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
- 專案級 Symbol 定義，可跨 Scene 引用並同步改名／改色
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

測試會完成 TypeScript 檢查、GitHub Pages 相容打包、重新產生 PSD，並驗證尺寸、中文圖層名稱、巢狀群組、順序、隱藏狀態及透明度。

基準 PSD 位於 `artifacts/psd-prototype/01_PSD技術驗證.psd`。已由使用者在 Krita 實際開啟並確認結構正常；正式發版前仍應補 Photoshop 相容性驗證。
