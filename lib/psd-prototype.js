export const PROTOTYPE_FILE_NAME = "01_PSD技術驗證.psd";
export const DOCUMENT_WIDTH = 640;
export const DOCUMENT_HEIGHT = 360;

function rgba(width, height, painter) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const [r, g, b, a = 255] = painter(x, y);
      data[offset] = r;
      data[offset + 1] = g;
      data[offset + 2] = b;
      data[offset + 3] = a;
    }
  }
  return { width, height, data };
}

function solid(width, height, color, border = null) {
  return rgba(width, height, (x, y) => {
    if (border && (x < 2 || y < 2 || x >= width - 2 || y >= height - 2)) return border;
    return color;
  });
}

function symbol(width, height, tone, mark) {
  return rgba(width, height, (x, y) => {
    const edge = x < 2 || y < 2 || x >= width - 2 || y >= height - 2;
    const cx = width / 2;
    const cy = height / 2;
    const dx = x - cx;
    const dy = y - cy;
    const radius = Math.min(width, height) * 0.22;
    const inside = mark === "circle"
      ? dx * dx + dy * dy < radius * radius
      : Math.abs(dx) + Math.abs(dy) < radius * 1.35;
    if (edge) return [250, 250, 246, 255];
    if (inside) return [55, 56, 53, 255];
    return [tone, tone, Math.max(0, tone - 2), 255];
  });
}

function layer(name, left, top, imageData, options = {}) {
  return {
    name,
    left,
    top,
    right: left + imageData.width,
    bottom: top + imageData.height,
    imageData,
    ...options,
  };
}

function makeComposite() {
  const data = solid(DOCUMENT_WIDTH, DOCUMENT_HEIGHT, [73, 74, 71, 255]);
  const paintRect = (left, top, width, height, color) => {
    for (let y = top; y < Math.min(top + height, DOCUMENT_HEIGHT); y += 1) {
      for (let x = left; x < Math.min(left + width, DOCUMENT_WIDTH); x += 1) {
        const offset = (y * DOCUMENT_WIDTH + x) * 4;
        data.data[offset] = color[0];
        data.data[offset + 1] = color[1];
        data.data[offset + 2] = color[2];
        data.data[offset + 3] = color[3] ?? 255;
      }
    }
  };
  paintRect(36, 24, 244, 30, [238, 238, 234, 255]);
  paintRect(112, 80, 416, 232, [35, 36, 33, 255]);
  const tones = [241, 212, 180, 146, 116];
  for (let column = 0; column < 5; column += 1) {
    for (let row = 0; row < 3; row += 1) {
      paintRect(122 + column * 80, 90 + row * 72, 74, 66, [tones[column], tones[column], tones[column] - 2, 255]);
    }
  }
  return data;
}

export function createPrototypeDocument() {
  const reelChildren = [];
  const tones = [241, 212, 180, 146, 116];
  for (let column = 0; column < 5; column += 1) {
    const columnChildren = [];
    for (let row = 0; row < 3; row += 1) {
      const isHiddenProof = column === 0 && row === 2;
      columnChildren.push(layer(
        isHiddenProof ? "Symbol_神秘圖案_隱藏" : `Symbol_${column + 1}_${row + 1}`,
        122 + column * 80,
        90 + row * 72,
        symbol(74, 66, tones[column], (column + row) % 2 === 0 ? "circle" : "diamond"),
        isHiddenProof ? { hidden: true, opacity: 0.45 } : undefined,
      ));
    }
    reelChildren.push({ name: `第${column + 1}軸`, opened: column === 0, children: columnChildren });
  }

  return {
    width: DOCUMENT_WIDTH,
    height: DOCUMENT_HEIGHT,
    imageData: makeComposite(),
    children: [
      layer("畫面標題_點陣文字", 36, 24, solid(244, 30, [238, 238, 234, 255]), { opacity: 0.86 }),
      {
        name: "盤面_ReelGrid",
        opened: true,
        children: [
          ...reelChildren,
          layer("盤面外框", 112, 80, solid(416, 232, [35, 36, 33, 255], [242, 242, 238, 255])),
        ],
      },
      layer("背景", 0, 0, solid(DOCUMENT_WIDTH, DOCUMENT_HEIGHT, [73, 74, 71, 255])),
    ],
  };
}

export function buildPrototypePsd() {
  const writer = globalThis.agPsd?.writePsdUint8Array;
  if (!writer) throw new Error("PSD writer is not initialized");
  return writer(createPrototypeDocument(), { generateThumbnail: false });
}

function findLayer(layers, name) {
  for (const current of layers ?? []) {
    if (current.name === name) return current;
    const nested = findLayer(current.children, name);
    if (nested) return nested;
  }
  return undefined;
}

export function inspectPrototypePsd(bytes) {
  const reader = globalThis.agPsd?.readPsd;
  if (!reader) throw new Error("PSD reader is not initialized");
  const parsed = reader(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), {
    skipThumbnail: true,
    skipCompositeImageData: true,
    skipLayerImageData: true,
  });
  const rootNames = parsed.children?.map((entry) => entry.name) ?? [];
  const reel = findLayer(parsed.children, "盤面_ReelGrid");
  const firstColumn = findLayer(parsed.children, "第1軸");
  const hidden = findLayer(parsed.children, "Symbol_神秘圖案_隱藏");
  const title = findLayer(parsed.children, "畫面標題_點陣文字");

  const checks = [
    {
      label: "文件尺寸",
      passed: parsed.width === DOCUMENT_WIDTH && parsed.height === DOCUMENT_HEIGHT,
      detail: `${parsed.width} × ${parsed.height} RGB`,
    },
    {
      label: "中文根圖層",
      passed: rootNames.join("|") === "畫面標題_點陣文字|盤面_ReelGrid|背景",
      detail: rootNames.join(" → "),
    },
    {
      label: "巢狀群組",
      passed: Boolean(reel?.children?.length === 6 && firstColumn?.children?.length === 3),
      detail: `Reel Grid ${reel?.children?.length ?? 0} 個子項目；第一軸 ${firstColumn?.children?.length ?? 0} 層`,
    },
    {
      label: "隱藏與透明度",
      passed: hidden?.hidden === true && Math.abs((hidden.opacity ?? 0) - 0.45) < 0.01,
      detail: `hidden=${String(hidden?.hidden)}；opacity=${hidden?.opacity ?? "缺少"}`,
    },
    {
      label: "標題透明度",
      passed: Math.abs((title?.opacity ?? 0) - 0.86) < 0.01,
      detail: `opacity=${title?.opacity ?? "缺少"}`,
    },
  ];

  return { parsed, checks };
}
