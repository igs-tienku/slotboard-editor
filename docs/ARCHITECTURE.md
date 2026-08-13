# SlotBoard 技術架構與開發里程碑

- 版本：1.0
- 日期：2026-08-13
- 架構目標：純前端、可部署至 GitHub Pages、資料可攜、輸出可重現

## 1. 架構原則

1. **專案資料是唯一真相來源**：畫布物件、流程座標、Symbol 定義與輸出均由同一份版本化資料模型產生。
2. **編輯器與輸出器分離**：畫布渲染不直接等同 PSD/PDF 寫入；輸出前先建立固定的中間渲染模型。
3. **不依賴後端**：所有編輯、保存、圖片處理及輸出均在瀏覽器完成。
4. **不可逆轉換延後**：原圖保留在專案資產庫；預覽與 PSD 點陣化只在需要時產生。
5. **先守住 PSD 契約**：任何新物件類型若無法穩定輸出，不能宣稱進入正式支援範圍。

## 2. 建議技術棧

- React + TypeScript：應用介面及互動。
- Vite／靜態輸出：GitHub Pages 建置。
- Canvas 2D：Scene 顯示、選取框、吸附與輸出光柵化。
- Zustand 或等價小型 store：編輯狀態及命令分派；第一版也可先用 reducer 驗證模型。
- Immer 或明確 immutable command：復原／重做。
- IndexedDB：單一恢復草稿及大尺寸二進位素材。
- JSZip：`.slotboard`、`.slottemplate` 與批次 PSD 打包。
- ag-psd：PSD 寫入及自動往返驗證。
- pdf-lib 或同級純前端工具：流程總覽與多頁 Scene PDF。
- Web Worker：PSD、PDF、縮圖及圖片縮放，避免阻塞主執行緒。

目前技術原型使用專案既有的 React/vinext 骨架驗證 PSD；正式 GitHub Pages 版本應確認靜態資產 base path 與 Worker 載入路徑。

## 3. 模組邊界

```text
Application shell
├── Project lifecycle
│   ├── New / open / import / export
│   ├── Schema migration
│   └── Recovery draft
├── Flow overview
│   ├── Scene placement
│   ├── Connections and labels
│   └── Auto layout
├── Scene editor
│   ├── Tools and selection
│   ├── Transform / snap / align
│   ├── Layer tree
│   ├── Text and appearance
│   └── Annotation region
├── Slot domain
│   ├── Reel Grid definitions
│   └── Project Symbol registry
├── Asset pipeline
│   ├── File validation
│   ├── Original binary storage
│   ├── Preview generation
│   └── Crop / fit metadata
└── Export pipeline
    ├── Render model
    ├── PSD writer
    ├── PDF writer
    └── Filename / ZIP manifest
```

## 4. 核心資料模型

以下為方向性模型；實作前應用 JSON Schema 或 Zod 固定契約。

```ts
type SlotBoardProject = {
  schemaVersion: number;
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  defaultSceneSize: { width: number; height: number };
  sceneOrder: string[];
  scenes: Record<string, Scene>;
  connections: SceneConnection[];
  symbols: Record<string, SymbolDefinition>;
  assets: Record<string, AssetMetadata>;
  fonts: FontReference[];
};

type Scene = {
  id: string;
  name: string;
  width: number;
  height: number;
  overview: { x: number; y: number };
  layers: LayerNode[];
  annotations: Annotation[];
  thumbnailRevision: number;
};

type LayerNode =
  | GroupLayer
  | ShapeLayer
  | TextLayer
  | ImageLayer
  | ReelGridLayer
  | SymbolInstanceLayer
  | LineLayer;

type BaseLayer = {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number; // 0..1
  transform: {
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
    flipX: boolean;
    flipY: boolean;
  };
};

type SymbolDefinition = {
  id: string;
  name: string;
  assetId?: string;
  placeholder: ShapeAppearance;
  fit: "contain" | "cover";
  focalPoint: { x: number; y: number };
};

type SceneConnection = {
  id: string;
  fromSceneId: string;
  toSceneId: string;
  label: string;
  route?: Array<{ x: number; y: number }>;
};
```

群組是唯一容許 `children` 的節點。Symbol instance 只引用專案級定義，不複製圖片資料。所有 ID 為永久識別，不因 Scene 改名或改序而改變。

## 5. 命令與復原模型

所有編輯操作應轉成可序列化命令：

```ts
type Command = {
  label: string;
  apply(project: SlotBoardProject): SlotBoardProject;
  revert(project: SlotBoardProject): SlotBoardProject;
};
```

- 拖曳中的每一幀只更新暫存視圖；放開滑鼠後才提交一個命令。
- 圖片二進位資料不直接放進復原堆疊，只記錄 asset ID 的引用變更。
- Scene 複製、跨 Scene 貼上及 Symbol 換圖必須是單一可復原交易。
- 恢復草稿保存目前專案，不保存無限長復原歷史。

## 6. 資產與容量控制

匯入流程：

1. 讀取檔案大小及圖片尺寸。
2. 檢查單張 20 MB、8192×8192 px 及專案 200 MB 限制。
3. 超標時提出建立縮小副本，顯示預計尺寸與檔案大小。
4. 原始或確認後的縮小副本寫入 IndexedDB。
5. 產生適合畫布及縮圖的預覽版本。
6. 專案包輸出時按 asset ID 嵌入二進位檔。

應使用引用計數或匯出時掃描，避免已無圖層引用的素材持續膨脹專案包。

## 7. PSD 輸出管線

```text
Scene data
  → resolve Symbol and asset references
  → flatten transforms into render jobs
  → rasterize each leaf layer at Scene pixel size
  → rebuild nested group tree
  → map name / order / opacity / hidden
  → compose optional document preview
  → write PSD in Web Worker
  → read back metadata and validate
  → download or add to ZIP
```

### 7.1 輸出規則

- 葉節點必須輸出為獨立點陣圖層。
- 群組遞迴映射，不可為了效能把群組內容合併。
- PSD 的圖層順序須有單元測試；PSD API 通常使用由上至下順序，不能靠人工目測猜測。
- Scene 標註不送入 PSD renderer。
- 隱藏圖層仍渲染內容並設定 hidden，方便美術重新顯示。
- 圖層鎖定旗標不映射。
- 所有文字先由固定字型與 Scene renderer 光柵化。
- `cover` 圖片依焦點裁切後輸出，不保留裁切外像素。

### 7.2 自動驗證

每個匯出可在開發模式執行 metadata round trip：

- 文件寬高
- 根圖層順序
- 群組與巢狀子層數量
- Unicode 名稱
- opacity 容許 8-bit 量化誤差
- hidden 狀態
- 每個葉節點的 bounds

自動解析成功不等於 Adobe Photoshop 相容性通過；正式版本矩陣仍需人工開檔。

## 8. PDF 輸出管線

1. 依 Scene 縮圖、總覽座標與連線建立流程總覽頁。
2. 根據總覽包圍盒選擇合適的大頁面，保留最小可讀 Scene 標題。
3. 依 `sceneOrder` 建立一 Scene 一頁。
4. Scene 頁只渲染可見圖層。
5. 在畫布旁輸出標註區及引線，列出上游／下游 Scene 與連線文字。
6. 輸出前檢查字型是否可嵌入及中文字形是否完整。

## 9. 專案包格式

```text
project.slotboard
├── manifest.json
├── project.json
├── assets/
│   └── <asset-id>.<ext>
├── previews/
│   └── <scene-id>.webp
└── fonts/                 # 只放產品已授權內建字型的必要資料
```

`manifest.json` 保存格式版本、建立工具版本、內容雜湊及資產索引。匯入時應先解壓至記憶體／暫存 IndexedDB，全部驗證成功後再替換目前專案，避免半套匯入破壞工作。

## 10. 效能策略

- 只渲染目前 Scene 的高解析畫布。
- 縮圖與總覽使用低解析快取。
- 圖層面板採虛擬化，避免 5,000 個以上節點同時進入 DOM。
- 圖片解碼、縮圖、PSD 與 PDF 輸出放入 Worker。
- 大型匯出採逐 Scene 處理並釋放 bitmap，禁止同時展開全部 Scene 的全解析像素。
- 在 Chrome DevTools 建立 50 Scene × 100 圖層的固定壓力資料集。

## 11. 安全與可靠性

- 匯入包需要限制解壓後大小、檔案數量、圖片尺寸及巢狀深度，避免 ZIP bomb 或記憶體耗盡。
- Scene／圖層名稱輸出檔名時須移除 Windows 不允許字元。
- 匯出前處理同名 Scene，避免 ZIP 內檔案互相覆蓋。
- 自動儲存應 debounce，並在寫入完成後更新恢復狀態。
- schema migration 必須保留原始檔；失敗時僅允許唯讀開啟。

## 12. 開發里程碑

### M0：PSD 技術閘門（已建立，自動驗證完成）

- 瀏覽器端產生 PSD。
- 中文圖層名稱。
- 兩層巢狀群組。
- 圖層順序、透明度及隱藏狀態。
- 產生獨立點陣圖層。
- 自動往返解析報告。
- 待辦：在目標 Photoshop 版本實際開啟並記錄結果。

退出條件：Photoshop 開檔成功，圖層結構與自動報告一致。

### M1：專案骨架與 Scene 編輯基礎（已完成）

- 固定資料 schema、migration 介面及命令系統。
- 新建／改名／改序／複製 Scene。
- 單 Scene 畫布、選取、移動、縮放、旋轉。
- 矩形、圓形、三角形、星形、多邊形、線及箭頭。
- 圖層面板、群組、鎖定、隱藏、名稱。
- 復原／重做。

退出條件：30 Scene 專案可保存、重開並保持內容一致。

完成紀錄（2026-08-13）：資料 schema、migration 入口、100 步歷史、Scene 操作、七種圖形、選取變形、巢狀群組與本機恢復草稿均已實作；30 Scene 自動保存／重開測試通過。

### M2：精確排版與圖片（已完成）

- 對齊、等距分布、參考線、吸附、像素格線。
- X、Y、寬、高及旋轉數值面板。
- 圖片資產庫、容量限制、縮小副本流程。
- contain／cover、焦點、重設 placeholder。
- 文字功能與內建開源字型。

退出條件：正式素材可在三次操作內替換 placeholder，重開後裁切一致。

完成紀錄（2026-08-13）：已實作畫布／多物件對齊、水平／垂直等距、8px 智慧吸附、動態參考線、像素格線、數值面板、20 MB／8192px／200 MB 容量規則、超標縮小副本、原地圖片置換、contain／cover、焦點、縮放與 placeholder 重設。恢復草稿升級至 IndexedDB，可保存圖片資料與裁切設定；文字工具涵蓋三類 Noto 開源字型、內容、字級、字重、斜體、行距、字距、水平／垂直對齊、外框與底色。圖片裁切序列化／重開測試通過。

### M3：Slot 結構與流程總覽

- 可變列數 Reel Grid。
- 專案級 Symbol 定義與跨 Scene 引用。
- 無限畫布 Scene 排列、連線文字、迴圈及自動整理。
- Scene 縮圖快取。
- 畫布外標註、物件錨點及整體備註。

退出條件：可完整重建至少一份中等複雜度歷史 Slot 分鏡。

### M4：可攜專案與模板

- `.slotboard` 匯出／匯入。
- `.slottemplate` 及 Scene 另存模板。
- IndexedDB 單一恢復草稿。
- schema migration、唯讀降級及損壞包錯誤處理。

退出條件：在另一台支援瀏覽器開啟專案包，畫面與素材完整一致。

### M5：正式輸出

- 每 Scene PSD、檔名預覽及批次 ZIP。
- 流程總覽與一 Scene 一頁 PDF。
- 開發模式 PSD round trip 檢查。
- Photoshop 版本矩陣人工 QA。

退出條件：PRD 第 10 節 PSD 與效率驗收全部通過。

### M6：效能、可用性與發布

- 50 Scene × 100 圖層壓力測試。
- 鍵盤操作、焦點順序及基本無障礙。
- GitHub Pages base path、重新載入及瀏覽器相容性。
- 五份歷史分鏡重建測試。
- 使用說明、版本號及錯誤回報資訊。

退出條件：Chrome／Edge 驗收完成，至少 4/5 歷史案例不需外部繪圖工具。

## 13. 近期下一步

1. 將 `artifacts/psd-prototype/01_PSD技術驗證.psd` 交給有 Photoshop 的測試者。
2. 在 Photoshop 記錄版本、開檔結果、圖層順序、群組、中文名稱、透明度及隱藏狀態。
3. 若通過，凍結 PSD 原型為 M0 基準檔並開始 M1。
4. 若失敗，只修 PSD writer 或輸出資料映射；在通過前不開發完整編輯器。
