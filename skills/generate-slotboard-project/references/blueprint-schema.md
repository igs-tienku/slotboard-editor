# SlotBoard blueprint schema

`build_slotboard.py` accepts UTF-8 JSON and produces a SlotBoard schema v3 package. The blueprint is an AI-facing intermediate format, not the SlotBoard project JSON itself.

## Root

```json
{
  "project": {
    "name": "Game storyboard",
    "width": 1080,
    "height": 1920
  },
  "scenes": [],
  "connections": []
}
```

- `project.name` is required.
- `width` and `height` must be integers from 320 to 8192.
- `scenes` must contain at least one Scene.
- Unknown root fields are rejected to catch misspellings.

## Scene

```json
{
  "key": "mg_base",
  "name": "01_MG_Base",
  "overview": { "x": 60, "y": 60 },
  "layers": [],
  "annotations": [
    { "text": "待確認：Spin 按鈕版位", "target": "hud_controls" }
  ]
}
```

- `key` is a unique lowercase identifier using letters, digits, `_`, or `-`.
- Scene dimensions default to project dimensions; optional `width`/`height` may override them.
- `overview` controls the flow-canvas card position and defaults to an automatic grid.
- The builder automatically adds a locked, full-canvas background last. Do not define a background layer.

## Common layer fields

Every layer requires:

```json
{
  "key": "unique_within_project",
  "type": "shape",
  "name": "HANDOFF_名稱",
  "transform": { "x": 100, "y": 120, "width": 300, "height": 200 },
  "visible": true,
  "locked": false,
  "opacity": 1
}
```

- Keys are globally unique so annotation targets remain unambiguous.
- Transform values are Scene-local; group children are group-local.
- `rotation` defaults to `0`; `flipX` and `flipY` default to `false`.
- Layers must remain within their immediate container bounds.
- Blueprint order is front-to-back. The generated project preserves that order.

## Shape

```json
{
  "key": "feature_bomb_range",
  "type": "shape",
  "kind": "rectangle",
  "name": "FEATURE_Bomb_3x3範圍",
  "transform": { "x": 280, "y": 650, "width": 420, "height": 420 },
  "fill": "#f2f2ee",
  "stroke": "#494a46",
  "strokeWidth": 4,
  "cornerRadius": 12
}
```

Supported kinds: `rectangle`, `ellipse`, `triangle`, `star`, `polygon`, `line`, `arrow`.

## Text

```json
{
  "key": "panel_title",
  "type": "text",
  "name": "PANEL_標題",
  "text": "10 FREE GAMES",
  "transform": { "x": 190, "y": 640, "width": 700, "height": 120 },
  "fontSize": 56,
  "fontWeight": 700,
  "textAlign": "center",
  "verticalAlign": "middle",
  "color": "#20211f",
  "background": "transparent"
}
```

Supported alignments: horizontal `left|center|right`, vertical `top|middle|bottom`.

## Reel Grid

```json
{
  "key": "board_7x7",
  "type": "reelGrid",
  "name": "BOARD_7x7",
  "columns": [7, 7, 7, 7, 7, 7, 7],
  "transform": { "x": 120, "y": 520, "width": 840, "height": 840 },
  "gap": 6,
  "frameColor": "#f0f0eb",
  "cellColor": "#858681"
}
```

Each integer creates that many empty cells. Symbol assignment and embedded image assets are intentionally excluded from the provisional builder; use geometry first, then replace or assign images in SlotBoard.

## Group

```json
{
  "key": "characters",
  "type": "group",
  "name": "CHARACTERS_三位女孩",
  "transform": { "x": 90, "y": 130, "width": 900, "height": 320 },
  "children": [
    {
      "key": "girl_bomb",
      "type": "shape",
      "kind": "ellipse",
      "name": "角色_Bomb",
      "transform": { "x": 0, "y": 20, "width": 260, "height": 280 },
      "fill": "#a6a7a2"
    }
  ]
}
```

Children use coordinates relative to the group. Nested groups are supported.

## Annotation

```json
{
  "text": "待確認：Bomb 邊界裁切規則",
  "target": "feature_bomb_range",
  "x": 1140,
  "y": 80
}
```

- `target` is an optional layer key.
- Default position is in SlotBoard's annotation pane to the right of the Scene.
- Use `待確認：`, `AI 推定：`, `來源衝突：`, or `規格：` prefixes.

## Connection

```json
{
  "from": "mg_result",
  "to": "cluster_win",
  "label": "有 5+ Cluster"
}
```

`from` and `to` must reference Scene keys and cannot be identical. Multiple labeled branches are allowed.

## Builder commands

```powershell
python scripts/build_slotboard.py blueprint.json storyboard.slotboard
python scripts/build_slotboard.py blueprint.json --validate-only
```

Successful output is a JSON summary containing Scene, layer, group, connection, and annotation counts plus the project hash. Warnings do not block generation; errors do.
