import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { SlotBoardEditor } from "../app/editor";
import { loadBuiltInFonts } from "../lib/builtin-fonts.js";
import "../app/globals.css";

async function renderApplication() {
  await loadBuiltInFonts();
  const root = document.getElementById("root");
  if (!root) throw new Error("Missing #root mount point");
  createRoot(root).render(
    <StrictMode>
      <SlotBoardEditor />
    </StrictMode>,
  );
}

const psdRuntime = document.createElement("script");
psdRuntime.src = new URL("./vendor/ag-psd.bundle.js", document.baseURI).href;
psdRuntime.onload = renderApplication;
psdRuntime.onerror = () => {
  throw new Error("Unable to load the PSD runtime");
};
document.head.appendChild(psdRuntime);
