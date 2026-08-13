import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { SlotBoardEditor } from "../app/editor";
import "../app/globals.css";

function renderApplication() {
  const root = document.getElementById("root");
  if (!root) throw new Error("Missing #root mount point");
  createRoot(root).render(
    <StrictMode>
      <SlotBoardEditor />
    </StrictMode>,
  );
}

const psdRuntime = document.createElement("script");
psdRuntime.src = `${import.meta.env.BASE_URL}vendor/ag-psd.bundle.js`;
psdRuntime.onload = renderApplication;
psdRuntime.onerror = () => {
  throw new Error("Unable to load the PSD runtime");
};
document.head.appendChild(psdRuntime);
