import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

globalThis.agPsd = await import("ag-psd");
const { buildPrototypePsd, inspectPrototypePsd, PROTOTYPE_FILE_NAME } = await import("../lib/psd-prototype.js");

const outputDirectory = resolve("artifacts", "psd-prototype");
await mkdir(outputDirectory, { recursive: true });

const bytes = buildPrototypePsd();
const result = inspectPrototypePsd(bytes);
const failed = result.checks.filter((check) => !check.passed);

await writeFile(resolve(outputDirectory, PROTOTYPE_FILE_NAME), bytes);
await writeFile(
  resolve(outputDirectory, "verification.json"),
  `${JSON.stringify({
    fileName: PROTOTYPE_FILE_NAME,
    byteLength: bytes.byteLength,
    checks: result.checks,
  }, null, 2)}\n`,
  "utf8",
);

for (const check of result.checks) {
  console.log(`${check.passed ? "PASS" : "FAIL"}  ${check.label}: ${check.detail}`);
}

if (failed.length > 0) process.exitCode = 1;
