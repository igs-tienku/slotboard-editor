import test from "node:test";
import assert from "node:assert/strict";
import { access, stat } from "node:fs/promises";
import { BUILTIN_FONT_FACES, loadBuiltInFonts } from "../lib/builtin-fonts.js";

test("all declared built-in font faces exist and are non-empty", async () => {
  assert.equal(BUILTIN_FONT_FACES.length, 5);
  for (const face of BUILTIN_FONT_FACES) {
    const url = new URL(`../public/fonts/${face.file}`, import.meta.url);
    await access(url);
    assert.ok((await stat(url)).size > 10_000);
  }
  await access(new URL("../public/fonts/OFL-1.1.txt", import.meta.url));
});

test("font loader uses the project-relative font URLs in document and worker contexts", async () => {
  const added = [];
  class FakeFontFace {
    constructor(family, source, descriptors) { Object.assign(this, { family, source, descriptors }); }
    async load() { return this; }
  }
  const result = await loadBuiltInFonts({
    FontFaceCtor: FakeFontFace,
    fontSet: { add: (face) => added.push(face) },
    baseUrl: "https://example.test/slotboard-editor/",
  });
  assert.equal(result.failed.length, 0);
  assert.equal(added.length, BUILTIN_FONT_FACES.length);
  assert.ok(added.every((face) => face.source.includes("/slotboard-editor/fonts/")));
});
