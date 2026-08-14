# SlotBoard v0.20.1 同事試用發布審核

## Objective

判定目前 Git 提交 `4461c9d` 與 GitHub Pages v0.20.1 是否已達到可分享給企劃與美術同事進行實際試用的品質。

## Deliverables under review

- Git commit: `4461c9d fix: make grouped artwork move as one`
- Application source: `app/`, `lib/`, `scripts/`, `tests/`
- Built artifact: `dist/`
- Live deployment: `https://igs-tienku.github.io/slotboard-editor/`
- Product commitments: `README.md`, `docs/PRD.md`, `docs/ARCHITECTURE.md`, `docs/M6-QA.md`

## Required outcome

- Scene 編輯、畫布平移／縮放、圖形拖曳、群組、右側圖層排序與背景鎖定可安全使用。
- 專案保存／重開、Scene／模板套件、PSD／ZIP／PDF 輸出與圖層順序有客觀證據。
- UI 可讀性、提示與同事初次使用門檻不構成阻斷。
- 效能、建置、測試與部署皆通過。
- 每項標準至少 90 分，無一票否決，才可判定可分享試用。

## Review output

`output/review/release-readiness-v0.20.1-2026-08-14/`

## Scope boundary

本審核判定的是「可供內部同事試用」，不是正式商業發行、多人協作、行動裝置觸控完整支援或 Photoshop 全版本認證。
