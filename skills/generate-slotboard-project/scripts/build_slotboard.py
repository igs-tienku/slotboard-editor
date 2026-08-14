#!/usr/bin/env python3
"""Validate an AI-facing blueprint and build a SlotBoard .slotboard package."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


SCHEMA_VERSION = 3
TOOL_VERSION = "0.22.0"
KEY_PATTERN = re.compile(r"^[a-z0-9][a-z0-9_-]*$")
SHAPE_KINDS = {"rectangle", "ellipse", "triangle", "star", "polygon", "line", "arrow"}
ROOT_FIELDS = {"project", "scenes", "connections"}
PROJECT_FIELDS = {"name", "width", "height", "createdAt"}
SCENE_FIELDS = {"key", "name", "width", "height", "overview", "layers", "annotations"}
COMMON_LAYER_FIELDS = {"key", "type", "name", "transform", "visible", "locked", "opacity"}
TYPE_LAYER_FIELDS = {
    "shape": {"kind", "fill", "stroke", "strokeWidth", "cornerRadius"},
    "text": {"text", "fontFamily", "fontSize", "fontWeight", "fontStyle", "textAlign", "verticalAlign", "lineHeight", "letterSpacing", "color", "textStroke", "textStrokeWidth", "background"},
    "reelGrid": {"columns", "gap", "frameColor", "cellColor"},
    "group": {"children", "opened"},
}


class BlueprintError(ValueError):
    pass


def fail(message: str) -> None:
    raise BlueprintError(message)


def reject_unknown_fields(value: dict[str, Any], allowed: set[str], context: str) -> None:
    unknown = sorted(set(value) - allowed)
    if unknown:
        fail(f"{context} contains unsupported fields: {', '.join(unknown)}")


def require_dict(value: Any, context: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        fail(f"{context} must be an object")
    return value


def require_list(value: Any, context: str) -> list[Any]:
    if not isinstance(value, list):
        fail(f"{context} must be an array")
    return value


def require_number(value: Any, context: str) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        fail(f"{context} must be numeric")
    return float(value)


def require_dimension(value: Any, context: str, minimum: int = 1, maximum: int = 8192) -> int:
    numeric = require_number(value, context)
    rounded = int(round(numeric))
    if rounded != numeric or not minimum <= rounded <= maximum:
        fail(f"{context} must be an integer from {minimum} to {maximum}")
    return rounded


def require_key(value: Any, context: str) -> str:
    if not isinstance(value, str) or not KEY_PATTERN.fullmatch(value):
        fail(f"{context} must match {KEY_PATTERN.pattern}")
    return value


def stable_id(prefix: str, key: str) -> str:
    digest = hashlib.sha1(key.encode("utf-8")).hexdigest()[:12]
    return f"{prefix}_{digest}"


def fnv1a32(data: bytes) -> str:
    value = 0x811C9DC5
    for byte in data:
        value ^= byte
        value = (value * 0x01000193) & 0xFFFFFFFF
    return f"fnv1a32:{value:08x}"


def normalized_transform(raw: Any, context: str, container_width: int, container_height: int) -> dict[str, Any]:
    value = require_dict(raw, context)
    reject_unknown_fields(value, {"x", "y", "width", "height", "rotation", "flipX", "flipY"}, context)
    for field in ("x", "y", "width", "height"):
        if field not in value:
            fail(f"{context}.{field} is required")
    x = int(round(require_number(value["x"], f"{context}.x")))
    y = int(round(require_number(value["y"], f"{context}.y")))
    width = require_dimension(value["width"], f"{context}.width")
    height = require_dimension(value["height"], f"{context}.height")
    if x < 0 or y < 0 or x + width > container_width or y + height > container_height:
        fail(f"{context} is outside its {container_width}x{container_height} container")
    return {
        "x": x,
        "y": y,
        "width": width,
        "height": height,
        "rotation": int(round(require_number(value.get("rotation", 0), f"{context}.rotation"))) % 360,
        "flipX": bool(value.get("flipX", False)),
        "flipY": bool(value.get("flipY", False)),
    }


def common_layer(raw: dict[str, Any], key: str, transform: dict[str, Any], layer_type: str) -> dict[str, Any]:
    opacity = require_number(raw.get("opacity", 1), f"layer {key}.opacity")
    if not 0 <= opacity <= 1:
        fail(f"layer {key}.opacity must be from 0 to 1")
    return {
        "id": stable_id("group" if layer_type == "group" else "layer", key),
        "type": layer_type,
        "name": str(raw.get("name") or key),
        "visible": bool(raw.get("visible", True)),
        "locked": bool(raw.get("locked", False)),
        "opacity": opacity,
        "transform": transform,
    }


def build_layer(
    raw_value: Any,
    context: str,
    container_width: int,
    container_height: int,
    all_keys: set[str],
    key_to_id: dict[str, str],
    counts: dict[str, int],
) -> dict[str, Any]:
    raw = require_dict(raw_value, context)
    layer_type = raw.get("type")
    if layer_type not in TYPE_LAYER_FIELDS:
        fail(f"{context}.type must be one of: {', '.join(TYPE_LAYER_FIELDS)}")
    reject_unknown_fields(raw, COMMON_LAYER_FIELDS | TYPE_LAYER_FIELDS[layer_type], context)
    key = require_key(raw.get("key"), f"{context}.key")
    if key in all_keys:
        fail(f"duplicate layer key: {key}")
    all_keys.add(key)
    transform = normalized_transform(raw.get("transform"), f"{context}.transform", container_width, container_height)
    layer = common_layer(raw, key, transform, layer_type)
    key_to_id[key] = layer["id"]
    counts["layers"] += 1

    if layer_type == "shape":
        kind = raw.get("kind")
        if kind not in SHAPE_KINDS:
            fail(f"{context}.kind must be one of: {', '.join(sorted(SHAPE_KINDS))}")
        is_line = kind in {"line", "arrow"}
        layer.update({
            "kind": kind,
            "fill": str(raw.get("fill", "transparent" if is_line else "#d6d6d1")),
            "stroke": str(raw.get("stroke", "#f2f2ed" if is_line else "#494a46")),
            "strokeWidth": max(0, require_number(raw.get("strokeWidth", 5 if is_line else 2), f"{context}.strokeWidth")),
            "cornerRadius": max(0, require_number(raw.get("cornerRadius", 6 if kind == "rectangle" else 0), f"{context}.cornerRadius")),
        })
    elif layer_type == "text":
        text_align = raw.get("textAlign", "center")
        vertical_align = raw.get("verticalAlign", "middle")
        if text_align not in {"left", "center", "right"}:
            fail(f"{context}.textAlign is invalid")
        if vertical_align not in {"top", "middle", "bottom"}:
            fail(f"{context}.verticalAlign is invalid")
        layer.update({
            "text": str(raw.get("text", "輸入文字")),
            "fontFamily": str(raw.get("fontFamily", "Noto Sans TC")),
            "fontSize": max(1, require_number(raw.get("fontSize", 48), f"{context}.fontSize")),
            "fontWeight": int(round(require_number(raw.get("fontWeight", 700), f"{context}.fontWeight"))),
            "fontStyle": str(raw.get("fontStyle", "normal")),
            "textAlign": text_align,
            "verticalAlign": vertical_align,
            "lineHeight": max(0.1, require_number(raw.get("lineHeight", 1.25), f"{context}.lineHeight")),
            "letterSpacing": require_number(raw.get("letterSpacing", 0), f"{context}.letterSpacing"),
            "color": str(raw.get("color", "#f4f4f0")),
            "textStroke": str(raw.get("textStroke", "#20211f")),
            "textStrokeWidth": max(0, require_number(raw.get("textStrokeWidth", 0), f"{context}.textStrokeWidth")),
            "background": str(raw.get("background", "transparent")),
        })
    elif layer_type == "reelGrid":
        columns = require_list(raw.get("columns"), f"{context}.columns")
        if not 1 <= len(columns) <= 12:
            fail(f"{context}.columns must contain 1 to 12 columns")
        normalized_columns = []
        for index, rows in enumerate(columns):
            row_count = require_dimension(rows, f"{context}.columns[{index}]", 1, 12)
            normalized_columns.append([None] * row_count)
        layer.update({
            "columns": normalized_columns,
            "gap": max(0, require_number(raw.get("gap", 6), f"{context}.gap")),
            "frameColor": str(raw.get("frameColor", "#f0f0eb")),
            "cellColor": str(raw.get("cellColor", "#858681")),
        })
    else:
        children_raw = require_list(raw.get("children"), f"{context}.children")
        if not children_raw:
            fail(f"{context}.children must not be empty")
        counts["groups"] += 1
        layer["children"] = [
            build_layer(child, f"{context}.children[{index}]", transform["width"], transform["height"], all_keys, key_to_id, counts)
            for index, child in enumerate(children_raw)
        ]
        layer["opened"] = bool(raw.get("opened", True))
    return layer


def background_layer(scene_key: str, width: int, height: int) -> dict[str, Any]:
    return {
        "id": stable_id("layer", f"{scene_key}_background"),
        "type": "shape",
        "kind": "rectangle",
        "name": "背景",
        "visible": True,
        "locked": True,
        "opacity": 1,
        "fill": "#4c4d49",
        "stroke": "#4c4d49",
        "strokeWidth": 2,
        "cornerRadius": 6,
        "transform": {"x": 0, "y": 0, "width": width, "height": height, "rotation": 0, "flipX": False, "flipY": False},
    }


def build_project(blueprint: Any) -> tuple[dict[str, Any], dict[str, Any]]:
    root = require_dict(blueprint, "root")
    reject_unknown_fields(root, ROOT_FIELDS, "root")
    project_raw = require_dict(root.get("project"), "project")
    reject_unknown_fields(project_raw, PROJECT_FIELDS, "project")
    name = str(project_raw.get("name") or "").strip()
    if not name:
        fail("project.name is required")
    default_width = require_dimension(project_raw.get("width"), "project.width", 320)
    default_height = require_dimension(project_raw.get("height"), "project.height", 320)
    scene_values = require_list(root.get("scenes"), "scenes")
    if not scene_values:
        fail("scenes must not be empty")

    scene_keys: set[str] = set()
    layer_keys: set[str] = set()
    key_to_layer_id: dict[str, str] = {}
    scene_key_to_id: dict[str, str] = {}
    scenes: dict[str, Any] = {}
    scene_order: list[str] = []
    pending_annotations: list[tuple[dict[str, Any], list[Any], str, set[str]]] = []
    counts = {"scenes": 0, "layers": 0, "groups": 0, "annotations": 0, "connections": 0}
    warnings: list[str] = []

    for index, scene_value in enumerate(scene_values):
        raw = require_dict(scene_value, f"scenes[{index}]")
        reject_unknown_fields(raw, SCENE_FIELDS, f"scenes[{index}]")
        key = require_key(raw.get("key"), f"scenes[{index}].key")
        if key in scene_keys:
            fail(f"duplicate Scene key: {key}")
        scene_keys.add(key)
        width = require_dimension(raw.get("width", default_width), f"scenes[{index}].width", 320)
        height = require_dimension(raw.get("height", default_height), f"scenes[{index}].height", 320)
        overview_raw = require_dict(raw.get("overview", {}), f"scenes[{index}].overview")
        reject_unknown_fields(overview_raw, {"x", "y"}, f"scenes[{index}].overview")
        overview = {
            "x": int(round(require_number(overview_raw.get("x", 60 + (index % 4) * 280), f"scenes[{index}].overview.x"))),
            "y": int(round(require_number(overview_raw.get("y", 60 + (index // 4) * 220), f"scenes[{index}].overview.y"))),
        }
        layer_values = require_list(raw.get("layers", []), f"scenes[{index}].layers")
        existing_layer_keys = set(layer_keys)
        built_layers = [
            build_layer(layer, f"scenes[{index}].layers[{layer_index}]", width, height, layer_keys, key_to_layer_id, counts)
            for layer_index, layer in enumerate(layer_values)
        ]
        scene_layer_keys = layer_keys - existing_layer_keys
        scene_id = stable_id("scene", key)
        scene_key_to_id[key] = scene_id
        scene = {
            "id": scene_id,
            "name": str(raw.get("name") or key),
            "width": width,
            "height": height,
            "overview": overview,
            "layers": [*built_layers, background_layer(key, width, height)],
            "annotations": [],
            "thumbnailRevision": 0,
        }
        scenes[scene_id] = scene
        scene_order.append(scene_id)
        pending_annotations.append((scene, require_list(raw.get("annotations", []), f"scenes[{index}].annotations"), key, scene_layer_keys))
        counts["scenes"] += 1

    for scene, annotations, scene_key, scene_layer_keys in pending_annotations:
        for index, annotation_value in enumerate(annotations):
            raw = require_dict(annotation_value, f"Scene {scene_key} annotation[{index}]")
            reject_unknown_fields(raw, {"text", "target", "x", "y"}, f"Scene {scene_key} annotation[{index}]")
            text = str(raw.get("text") or "").strip()
            if not text:
                fail(f"Scene {scene_key} annotation[{index}].text is required")
            target_key = raw.get("target")
            if target_key is not None and target_key not in scene_layer_keys:
                fail(f"Scene {scene_key} annotation[{index}] must reference a layer in the same Scene: {target_key}")
            scene["annotations"].append({
                "id": stable_id("annotation", f"{scene_key}_{index}_{text}"),
                "text": text,
                "targetLayerId": key_to_layer_id.get(target_key) if target_key else None,
                "x": int(round(require_number(raw.get("x", scene["width"] + 60), f"Scene {scene_key} annotation[{index}].x"))),
                "y": int(round(require_number(raw.get("y", 80 + index * 90), f"Scene {scene_key} annotation[{index}].y"))),
            })
            counts["annotations"] += 1

    connections = []
    for index, connection_value in enumerate(require_list(root.get("connections", []), "connections")):
        raw = require_dict(connection_value, f"connections[{index}]")
        reject_unknown_fields(raw, {"from", "to", "label"}, f"connections[{index}]")
        from_key = require_key(raw.get("from"), f"connections[{index}].from")
        to_key = require_key(raw.get("to"), f"connections[{index}].to")
        if from_key not in scene_key_to_id or to_key not in scene_key_to_id:
            fail(f"connections[{index}] references an unknown Scene")
        if from_key == to_key:
            fail(f"connections[{index}] cannot connect a Scene to itself")
        connections.append({
            "id": stable_id("connection", f"{index}_{from_key}_{to_key}"),
            "fromSceneId": scene_key_to_id[from_key],
            "toSceneId": scene_key_to_id[to_key],
            "label": str(raw.get("label") or "下一步"),
        })
        counts["connections"] += 1

    if counts["annotations"] == 0:
        warnings.append("No annotations were supplied; confirm that assumptions and unknowns are documented elsewhere.")
    if len(scene_values) > 1 and counts["connections"] == 0:
        warnings.append("Multiple Scenes have no flow connections.")
    if counts["groups"] == 0:
        warnings.append("No groups were supplied; verify whether handoff components should move together.")

    timestamp = str(project_raw.get("createdAt") or datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"))
    project = {
        "schemaVersion": SCHEMA_VERSION,
        "id": stable_id("project", name),
        "name": name,
        "createdAt": timestamp,
        "updatedAt": timestamp,
        "defaultSceneSize": {"width": default_width, "height": default_height},
        "sceneOrder": scene_order,
        "scenes": scenes,
        "connections": connections,
        "symbols": {},
        "assets": {},
        "fonts": [
            {"id": "noto-sans-tc", "family": "Noto Sans TC", "category": "sans", "license": "OFL-1.1"},
            {"id": "noto-serif-tc", "family": "Noto Serif TC", "category": "serif", "license": "OFL-1.1"},
            {"id": "noto-sans-mono", "family": "Noto Sans Mono", "category": "mono", "license": "OFL-1.1"},
        ],
        "editorSettings": {"snap": True, "guides": True, "pixelGrid": False, "snapDistance": 8, "flowZoom": 1, "sceneZoom": 1, "backgroundLockInitialized": True},
    }
    return project, {"counts": counts, "warnings": warnings}


def package_project(project: dict[str, Any], output: Path) -> dict[str, Any]:
    project_bytes = json.dumps(project, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    project_hash = fnv1a32(project_bytes)
    manifest = {
        "format": "slotboard-package",
        "kind": "project",
        "packageVersion": 1,
        "schemaVersion": SCHEMA_VERSION,
        "toolVersion": TOOL_VERSION,
        "name": project["name"],
        "assets": [],
        "contentHashes": {"project.json": project_hash},
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
        archive.writestr("project.json", project_bytes)
        archive.writestr("manifest.json", json.dumps(manifest, ensure_ascii=False, indent=2).encode("utf-8"))
    with zipfile.ZipFile(output, "r") as archive:
        restored = archive.read("project.json")
        restored_manifest = json.loads(archive.read("manifest.json").decode("utf-8"))
    if fnv1a32(restored) != restored_manifest["contentHashes"]["project.json"]:
        fail("generated package failed its integrity check")
    return {"output": str(output.resolve()), "bytes": output.stat().st_size, "project_hash": project_hash}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("blueprint", type=Path, help="UTF-8 SlotBoard blueprint JSON")
    parser.add_argument("output", type=Path, nargs="?", help="Output .slotboard path")
    parser.add_argument("--validate-only", action="store_true", help="Validate and summarize without writing a package")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        blueprint = json.loads(args.blueprint.read_text(encoding="utf-8"))
        project, report = build_project(blueprint)
        result = {"valid": True, "schemaVersion": SCHEMA_VERSION, "toolVersion": TOOL_VERSION, **report}
        if not args.validate_only:
            if args.output is None:
                fail("output path is required unless --validate-only is used")
            if args.output.suffix.lower() != ".slotboard":
                fail("output file must use the .slotboard extension")
            result.update(package_project(project, args.output))
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0
    except (OSError, json.JSONDecodeError, BlueprintError) as error:
        print(json.dumps({"valid": False, "error": str(error)}, ensure_ascii=False, indent=2), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
