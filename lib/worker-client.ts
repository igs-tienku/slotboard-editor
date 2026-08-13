let worker: Worker | null = null;
let serial = 0;
const pending = new Map<number, { resolve: (value: any) => void; reject: (reason: Error) => void }>();

export function supportsSlotBoardWorker() {
  return typeof Worker !== "undefined" && typeof OffscreenCanvas !== "undefined" && typeof createImageBitmap !== "undefined";
}

function getWorker() {
  if (!supportsSlotBoardWorker()) throw new Error("此瀏覽器不支援背景處理");
  if (worker) return worker;
  worker = new Worker(new URL("./assets/export-worker.js", document.baseURI), { type: "module" });
  worker.onmessage = (event) => {
    const task = pending.get(event.data.id);
    if (!task) return;
    pending.delete(event.data.id);
    if (event.data.ok) task.resolve(event.data.bytes ?? event.data.result);
    else task.reject(new Error(event.data.error ?? "背景處理失敗"));
  };
  worker.onerror = (event) => {
    const error = new Error(event.message || "背景處理程序中斷");
    pending.forEach((task) => task.reject(error)); pending.clear();
    worker?.terminate(); worker = null;
  };
  return worker;
}

export function runWorkerTask(action: "scenePsd" | "psdZip" | "pdf" | "resizeImage", payload: any) {
  const id = ++serial, target = getWorker();
  return new Promise<any>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    target.postMessage({ id, action, payload });
  });
}
