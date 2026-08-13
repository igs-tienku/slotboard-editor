"use client";

import { useMemo, useState } from "react";
import {
  buildPrototypePsd,
  inspectPrototypePsd,
  PROTOTYPE_FILE_NAME,
} from "../lib/psd-prototype";

type CheckResult = {
  label: string;
  passed: boolean;
  detail: string;
};

const sceneLayers = [
  { name: "畫面標題", meta: "點陣文字 · 86%", tone: "#f4f4f2" },
  { name: "盤面_ReelGrid", meta: "群組 · 展開", tone: "#c8c8c4" },
  { name: "第一軸", meta: "巢狀群組", tone: "#a3a39f", nested: true },
  { name: "Symbol_銀幣", meta: "可見 · 100%", tone: "#dadad7", nested: true },
  { name: "Symbol_神秘圖案", meta: "隱藏 · 45%", tone: "#747470", nested: true },
  { name: "背景", meta: "點陣圖層 · 100%", tone: "#555552" },
];

export function PsdPrototype() {
  const [checks, setChecks] = useState<CheckResult[] | null>(null);
  const [busy, setBusy] = useState(false);
  const passedCount = useMemo(
    () => checks?.filter((check) => check.passed).length ?? 0,
    [checks],
  );

  async function generateAndDownload() {
    setBusy(true);
    try {
      const bytes = buildPrototypePsd();
      const result = inspectPrototypePsd(bytes);
      setChecks(result.checks);

      const fileBuffer = bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength,
      ) as ArrayBuffer;
      const blob = new Blob([fileBuffer], { type: "image/vnd.adobe.photoshop" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = PROTOTYPE_FILE_NAME;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="prototype-shell">
      <header className="topbar">
        <div className="brand-block">
          <span className="brand-mark">SB</span>
          <div>
            <p className="eyebrow">SLOTBOARD · TECHNICAL SPIKE</p>
            <h1>PSD 圖層交付驗證台</h1>
          </div>
        </div>
        <div className="top-actions">
          <span className="status-pill"><i />瀏覽器端產生</span>
          <button className="primary-action" onClick={generateAndDownload} disabled={busy}>
            {busy ? "正在產生…" : "下載驗證 PSD"}
          </button>
        </div>
      </header>

      <section className="workspace" aria-label="PSD 技術原型工作區">
        <aside className="scene-rail">
          <div className="rail-heading">
            <span>SCENES</span>
            <button aria-label="新增場景" disabled>＋</button>
          </div>
          <button className="scene-card active">
            <span className="scene-number">01</span>
            <span className="mini-scene" aria-hidden="true">
              <i /><i /><i /><i /><i /><i />
            </span>
            <span><b>PSD 技術驗證</b><small>640 × 360</small></span>
          </button>
          <p className="rail-note">本頁只驗證輸出契約；Scene 編輯器不在此技術原型範圍。</p>
        </aside>

        <section className="stage-area">
          <div className="stage-toolbar">
            <span>Scene 01 / PSD 技術驗證</span>
            <span className="zoom-control">− 75% ＋</span>
          </div>
          <div className="stage-mat">
            <div className="scene-canvas" role="img" aria-label="五軸、每軸三格的灰階 Slot 盤面示意">
              <div className="scene-title">FREE GAME 畫面示意</div>
              <div className="reel-grid">
                {Array.from({ length: 15 }, (_, index) => (
                  <div className={`symbol-cell tone-${(index % 5) + 1}`} key={index}>
                    <span>{index % 3 === 0 ? "★" : index % 3 === 1 ? "●" : "◆"}</span>
                  </div>
                ))}
              </div>
              <div className="scene-caption">Reel Grid / 5 × 3</div>
            </div>
          </div>
        </section>

        <aside className="layers-panel">
          <div className="panel-heading">
            <div><span>圖層</span><span className="muted">屬性</span></div>
            <button aria-label="更多圖層操作" disabled>•••</button>
          </div>
          <div className="layer-list">
            {sceneLayers.map((layer) => (
              <div className={`layer-row ${layer.nested ? "nested" : ""}`} key={layer.name}>
                <span className="visibility">{layer.meta.startsWith("隱藏") ? "○" : "●"}</span>
                <i style={{ background: layer.tone }} />
                <span><b>{layer.name}</b><small>{layer.meta}</small></span>
              </div>
            ))}
          </div>

          <div className="contract-card">
            <p className="eyebrow">EXPORT CONTRACT</p>
            <h2>此原型驗證什麼？</h2>
            <ul>
              <li>640 × 360 RGB PSD</li>
              <li>中文圖層與巢狀群組</li>
              <li>圖層順序、透明度與隱藏狀態</li>
              <li>每個示意元素保留獨立點陣內容</li>
            </ul>
          </div>

          {checks && (
            <div className="check-card" aria-live="polite">
              <div className="check-summary">
                <span>結構自檢</span>
                <b>{passedCount}/{checks.length} 通過</b>
              </div>
              {checks.map((check) => (
                <div className="check-row" key={check.label}>
                  <span className={check.passed ? "pass" : "fail"}>{check.passed ? "✓" : "!"}</span>
                  <span><b>{check.label}</b><small>{check.detail}</small></span>
                </div>
              ))}
              <p>自檢驗證檔案結構；最終相容性仍須由 Photoshop 實際開檔確認。</p>
            </div>
          )}
        </aside>
      </section>
    </main>
  );
}
