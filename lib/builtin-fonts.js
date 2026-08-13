export const BUILTIN_FONT_FACES = [
  { family: "Noto Sans TC", file: "noto-sans-tc-400.woff2", weight: "400" },
  { family: "Noto Sans TC", file: "noto-sans-tc-700.woff2", weight: "700 900" },
  { family: "Noto Serif TC", file: "noto-serif-tc-400.woff2", weight: "400" },
  { family: "Noto Serif TC", file: "noto-serif-tc-700.woff2", weight: "700 900" },
  { family: "Noto Sans Mono", file: "noto-sans-mono-400.woff2", weight: "400 900" },
];

let defaultLoadPromise;

function defaultFontContext() {
  const documentFontSet = globalThis.document?.fonts;
  const workerFontSet = globalThis.fonts;
  const baseUrl = globalThis.document?.baseURI ?? (globalThis.location?.href ? new URL("../", globalThis.location.href).href : null);
  return { FontFaceCtor: globalThis.FontFace, fontSet: documentFontSet ?? workerFontSet, baseUrl };
}

async function loadFaces({ FontFaceCtor, fontSet, baseUrl }) {
  if (!FontFaceCtor || !fontSet || !baseUrl) return { loaded: [], failed: BUILTIN_FONT_FACES.map((face) => face.family) };
  const results = await Promise.allSettled(BUILTIN_FONT_FACES.map(async (definition) => {
    const source = `url(${new URL(`./fonts/${definition.file}`, baseUrl).href}) format("woff2")`;
    const face = new FontFaceCtor(definition.family, source, { style: "normal", weight: definition.weight, display: "swap" });
    const loaded = await face.load();
    fontSet.add(loaded);
    return `${definition.family}:${definition.weight}`;
  }));
  return {
    loaded: results.filter((result) => result.status === "fulfilled").map((result) => result.value),
    failed: results.flatMap((result, index) => result.status === "rejected" ? [BUILTIN_FONT_FACES[index].family] : []),
  };
}

export function loadBuiltInFonts(overrides) {
  if (overrides) return loadFaces({ ...defaultFontContext(), ...overrides });
  defaultLoadPromise ??= loadFaces(defaultFontContext());
  return defaultLoadPromise;
}
