# Scene planning method

## Source ledger

Create a compact table before storyboarding:

| ID | Topic | Statement | Status | Source | Storyboard effect |
|---|---|---|---|---|---|
| F-01 | Layout | Portrait 7×7 board | CONFIRMED | Basic spec | Use 1080×1920 and Reel Grid |
| U-01 | Timing | Feature duration not supplied | UNKNOWN | — | Add annotation; do not invent seconds |

Keep source wording separate from visualization decisions. A layout inferred from a screenshot is not a confirmed gameplay rule.

## When to split a Scene

Split when at least one is true:

1. The dominant focus changes, such as board → feature effect → modal.
2. A different team member would need a distinct art composition.
3. A branch or loop needs an independently reviewable state.
4. The layer hierarchy changes materially.
5. A before/after comparison communicates a rule better than annotations alone.

Do not split for camera easing, anticipation frames, particle progression, number-roll frames, or repeated cascade iterations unless the source explicitly requires different compositions.

## Recommended Scene taxonomy

- `BASE`: idle/base gameplay composition.
- `RESULT`: stopped board or evaluated result.
- `WIN`: highlighted win before removal.
- `TRANSITION`: cascade, refill, entry, exit, or mode change.
- `FEATURE`: one signature special mechanic state.
- `PANEL`: trigger, choice, information, total win, or max win.
- `FLOW_ONLY`: rare state needed to explain a branch but not a new art layout.

Prefix Scene names with a stable sequence and mode, for example `03_MG_ClusterWin` or `11_FG_TotalWin`.

## Cross-Scene logic

Connections describe presentation order, not server implementation. Use short labels:

- action: `Spin`, `開始 FG`;
- condition: `有 5+ Cluster`, `Scatter ≥ 3`;
- completion: `Bomb 與 Cascade 完成`;
- loop: `仍有 Cluster`;
- stop: `MAX WIN 截止`.

If one transition is uncertain, keep the connection but prefix its label with `待確認：`, or omit it and add a Scene annotation when even the destination is unknown.

## Layer planning

Plan from visual hierarchy, then encode front-to-back:

1. modal copy/effect/highlight;
2. foreground characters and active feature;
3. board symbols or Reel Grid;
4. board frame and secondary HUD;
5. decorative/context elements;
6. locked background.

Group reusable visual units: `角色_Bomb女孩`, `HUD_下注資訊`, `FEATURE_Bomb`, `PANEL_TotalWin`. A group should have a meaningful bounding box and local child coordinates.

## Unknowns and conflicts

Unknown information should remain visible to reviewers:

- Attach gameplay unknowns to the board or feature group.
- Attach text/timing unknowns to the relevant panel.
- Use a Scene-level note for source conflicts and authority decisions.
- Consolidate project-wide questions in `source-audit.md`; do not create a separate Scene merely for a question list unless requested.

## Competitor observations

For each observed behavior, record:

- URL and observation date;
- exact visible state;
- inferred transition, if any;
- reusable structural idea;
- protected material excluded from output.

Use generic grayscale replacements for composition. Never make the competitor screenshot the background of the deliverable unless the user owns it and explicitly requests embedding.
