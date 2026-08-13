import { build } from "esbuild";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const projectRoot = resolve(".");
const outputRoot = resolve(projectRoot, "dist");
if (!outputRoot.startsWith(`${projectRoot}\\`) && !outputRoot.startsWith(`${projectRoot}/`)) {
  throw new Error("Refusing to clear an output directory outside the project");
}

await rm(outputRoot, { recursive: true, force: true });
await mkdir(resolve(outputRoot, "assets"), { recursive: true });

await build({
  entryPoints: [resolve(projectRoot, "src/main.tsx")],
  bundle: true,
  outfile: resolve(outputRoot, "assets/app.js"),
  format: "esm",
  platform: "browser",
  target: ["chrome111", "edge111"],
  minify: true,
  sourcemap: true,
  loader: { ".tsx": "tsx", ".css": "css" },
  define: { "process.env.NODE_ENV": '"production"' },
});

await cp(resolve(projectRoot, "public"), outputRoot, { recursive: true });

const sourceHtml = await readFile(resolve(projectRoot, "index.html"), "utf8");
const outputHtml = sourceHtml.replace(
  '<script type="module" src="/src/main.tsx"></script>',
  '<link rel="stylesheet" href="./assets/app.css" />\n    <script type="module" src="./assets/app.js"></script>',
);
await writeFile(resolve(outputRoot, "index.html"), outputHtml, "utf8");

console.log("Built SlotBoard M6.2 editor in dist/");
