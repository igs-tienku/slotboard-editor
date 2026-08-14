---
name: generate-slotboard-project
description: Convert Slot-machine specifications and reference material into an editable SlotBoard storyboard project (.slotboard). Use when Codex must read Google Sheets, Excel/XLSX, Markdown, screenshots, public competitor URLs or videos, then derive Scene states, grayscale geometry, layer groups, annotations, flow connections, unresolved questions, and a validated project that opens in SlotBoard. Also use to revise or regenerate an AI-created SlotBoard project from updated gameplay or presentation specs. Do not use for final art production or frame-level animation timelines.
---

# Generate SlotBoard Project

Create a reviewable storyboard, not final art. Treat `Scene` as the base unit: one Scene contains a meaningful visual state, layers, annotations, and connections to other Scenes.

## Required inputs and outputs

Accept one or more of:

- Markdown or text specifications;
- Excel/XLSX or Google Sheets;
- screenshots, videos, or public competitor pages;
- existing `.slotboard` projects or user corrections.

Deliver under a user-approved output folder:

1. `source-audit.md` — authoritative sources, conflicts, confirmed facts, inferences, and unknowns;
2. `scene-plan.md` — Scene list, purpose, entry/exit, and important layers;
3. `blueprint.json` — deterministic intermediate input;
4. `<project-name>.slotboard` — editable SlotBoard project;
5. `validation-report.md` — commands, counts, warnings, and open questions.

If the user asks only for a draft, still keep `blueprint.json` and validation evidence. Do not silently omit unresolved information.

## Read these references

- Read [references/scene-planning.md](references/scene-planning.md) before decomposing gameplay or competitor behavior.
- Read [references/blueprint-schema.md](references/blueprint-schema.md) before writing `blueprint.json` or invoking the builder.
- Read [references/xbomb-fiesta-example.md](references/xbomb-fiesta-example.md) only when an example of a complex cluster/cascade game is useful.

## Workflow

### 1. Acquire and rank sources

Use the best available reader for each source:

- For XLSX/Google Sheets, use an available spreadsheet/Google Sheets skill or normalize the workbook into implementation-ready Markdown first.
- For Markdown, inspect headings, tables, diagrams, image links, unknown lists, and conflicts.
- For public competitor pages, inspect only accessible material. Record URLs and observation dates. Never bypass access controls.
- For screenshots or video, distinguish directly visible states from inferred transitions.

Rank authority explicitly: approved spec > revision/meeting decision > implementation contract > visual reference > competitor inference. Never let a screenshot override a written rule without recording a conflict.

### 2. Build a fact ledger

Classify every relevant statement as:

- `CONFIRMED`: directly supported by an authoritative source;
- `INFERRED`: a reasonable visualization choice, identified as inference;
- `UNKNOWN`: missing information that affects implementation or presentation;
- `CONFLICT`: sources disagree and require a named decision.

Do not invent paytables, probabilities, timing, server results, panel rules, art assets, or feature branches. Put uncertain presentation choices in Scene annotations using prefixes such as `待確認：` or `AI 推定：`.

### 3. Decompose into Scenes

Create a new Scene only when the team needs to review a distinct visual state. Typical boundaries include:

- idle/base screen;
- stopped result before evaluation;
- win highlight/removal;
- cascade/refill state;
- each major feature's signature state;
- entry, choice, result, total-win, or max-win panels;
- materially different MG/FG layouts.

Do not create one Scene per animation frame. Represent repeated cascades with a loop connection and an annotation. Keep the first draft focused, normally 8–20 Scenes unless the source clearly requires more.

### 4. Compose the grayscale storyboard

Use the SlotBoard visual language:

- `#f2f2ee`: highest-focus active feature or modal;
- `#d2d3ce`: important gameplay object;
- `#a6a7a2`: normal content;
- `#777873`: secondary context;
- `#4c4d49`: background.

Use Reel Grid for regular rectangular grids. Use geometry and text for characters, panels, effects, arrows, HUD, controls, and placeholders. Group component parts that should move together. Name layers for handoff, for example `FEATURE_Bomb_爆炸範圍`, not `矩形 07`.

Keep background locked and last in the layer list. The blueprint lists layers from front to back. Place every object inside Scene bounds.

### 5. Encode flow and annotations

Use connections for state transitions and branches. Label conditions with source-grounded language such as `有 5+ Cluster`, `Bomb 完成`, or `MAX WIN 截止`.

Attach annotations to the most relevant layer. Use Scene-level annotations for source authority, loop rules, missing timing, and unresolved decisions. Do not encode a timeline because SlotBoard's unit is Scene rather than time.

### 6. Build and validate

Run:

```powershell
python scripts/build_slotboard.py blueprint.json output.slotboard
python scripts/build_slotboard.py blueprint.json --validate-only
```

Treat any builder error as blocking. Inspect warnings and either correct the blueprint or copy them into `validation-report.md` as explicit open questions.

Then verify the package with the current SlotBoard project/package tests when the repository is available. Open the result in SlotBoard and inspect at minimum:

- Scene count and names;
- portrait/landscape dimensions;
- background position and lock;
- layer/group order;
- flow connections;
- annotation targets;
- off-canvas objects.

If PSD is requested, export from SlotBoard and verify in Krita or another available PSD reader. Do not claim Photoshop compatibility without actually testing it.

### 7. Report confidence

Summarize:

- source coverage;
- number of Scenes, layers, groups, connections, and annotations;
- confirmed vs inferred Scene decisions;
- blocking and non-blocking unknowns;
- validation results;
- recommended human review order.

## Competitor-reference constraints

Competitor material may inform flow structure, state changes, hierarchy, pacing descriptions, and generic geometry. Do not copy or redistribute protected art, characters, logos, audio, source code, or extracted proprietary assets. Rebuild observations with grayscale placeholders and cite which ideas are directly observed versus inferred.

## Quality gates

Do not deliver when any of these are true:

- source conflicts are hidden;
- a required major feature has no Scene or annotation;
- Scene keys, layer keys, or connection references are invalid;
- background is missing, unlocked, or above artwork;
- objects are outside Scene bounds;
- the `.slotboard` package fails integrity validation;
- the output cannot be opened by the current SlotBoard version.
