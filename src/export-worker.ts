import * as agPsd from "ag-psd";
import { createProjectPdf, createPsdZip, createScenePsd } from "../lib/export-engine.js";

(globalThis as any).agPsd = agPsd;

function bytesToDataUrl(bytes: Uint8Array, mimeType: string) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  return `data:${mimeType};base64,${btoa(binary)}`;
}

async function resizeImage(dataUrl: string, width: number, height: number) {
  const bitmap = await createImageBitmap(await (await fetch(dataUrl)).blob());
  const scale = Math.min(1, 8192 / width, 8192 / height);
  const targetWidth = Math.max(1, Math.round(width * scale)), targetHeight = Math.max(1, Math.round(height * scale));
  const canvas = new OffscreenCanvas(targetWidth, targetHeight);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
  bitmap.close();
  const blob = await canvas.convertToBlob({ type: "image/webp", quality: .9 });
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return { dataUrl: bytesToDataUrl(bytes, blob.type), byteLength: bytes.length, mimeType: blob.type, width: targetWidth, height: targetHeight };
}

self.onmessage = async (event: MessageEvent) => {
  const { id, action, payload } = event.data;
  try {
    let bytes: Uint8Array | null = null, result: any = null;
    if (action === "scenePsd") bytes = await createScenePsd(payload.project, payload.sceneId);
    else if (action === "psdZip") bytes = await createPsdZip(payload.project);
    else if (action === "pdf") bytes = new Uint8Array(await createProjectPdf(payload.project));
    else if (action === "resizeImage") result = await resizeImage(payload.dataUrl, payload.width, payload.height);
    else throw new Error(`Unknown worker action: ${action}`);
    if (bytes) (self as any).postMessage({ id, ok: true, bytes }, [bytes.buffer]);
    else (self as any).postMessage({ id, ok: true, result });
  } catch (error) {
    (self as any).postMessage({ id, ok: false, error: error instanceof Error ? error.message : String(error) });
  }
};
