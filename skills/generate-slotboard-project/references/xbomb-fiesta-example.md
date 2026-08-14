# XBomb Fiesta 2048 example decomposition

This example is derived from `XBomb_Fiesta_2048_spec.md`. It demonstrates decisions; it is not a universal Scene template.

## Confirmed structure

- Portrait 1080×1920 presentation.
- 7×7 orthogonal cluster board; win threshold is 5+.
- Cascade loop with persistent cell multipliers in Free Game.
- Feature order after cascades: Bomb → Wild → Swap.
- Main Game Scatter trigger/top-up, Free Game, Buy Bonus, Total Win, and MAX WIN states.
- Three characters above the board correspond to Bomb, Wild, and Swap.

## Recommended first-draft Scenes

| Order | Scene | Purpose | Key layers |
|---:|---|---|---|
| 1 | `01_MG_Base` | Stable portrait composition | three-character group, 7×7 grid, HUD, controls |
| 2 | `02_MG_StopResult` | Stopped board and Scatter anticipation | grid, Scatter highlights |
| 3 | `03_MG_ClusterWin` | 5+ group highlight | grid, white cluster overlay, win label |
| 4 | `04_MG_Cascade` | Removal, multiplier floor, refill | grid, removed-cell mask, multiplier label, down arrows |
| 5 | `05_FEATURE_Bomb` | Left character and 3×3 blast range | character focus, heart path, bomb/range group |
| 6 | `06_FEATURE_Wild` | Middle character creates Wilds | character focus, heart paths, Wild placeholders |
| 7 | `07_FEATURE_Swap` | Right character changes one symbol set | source highlight, arrows, target symbol placeholders |
| 8 | `08_MG_BigPrizeTease` | Three-character singing sequence | all characters high-focus, ordered labels |
| 9 | `09_MG_ScatterTopUp` | 2+ Scatter to guaranteed FG | Scatter highlights, group heart wave, added Scatter |
| 10 | `10_PANEL_FGEntry` | Scatter count and awarded spins | centered Free Games panel |
| 11 | `11_FG_Base` | FG layout and persistent multipliers | grid, remaining spins, persistent multiplier callout |
| 12 | `12_PANEL_TotalOrMaxWin` | Total Win / MAX WIN handoff | modal, stop-rule annotation |
| 13 | `13_PANEL_BuyBonus` | Known purchase choices only | normal FG, Super FG, transaction unknown annotations |

## Flow summary

```text
MG Base → Stop Result
Stop Result → Cluster Win → Cascade ↺ Cluster Win
Stop Result / Cascade stable → Bomb → Wild → Swap
Stable board → Scatter Top-Up → FG Entry → FG Base
FG Base ↺ FG Base (remaining spins / retrigger)
FG Base → Total or Max Win → MG Base
MG Base → Buy Bonus → FG Entry or FG Base
Any paying path → MAX WIN panel when authoritative stop flag is reached
```

## Required unknown annotations

At minimum surface:

- paytable and multiplier payout formula;
- Bomb first-hit and edge clipping rules;
- Wild substitution/persistence;
- Swap eligibility/count;
- Main Game multiplier reset timing;
- Super FG spin count and feature count;
- Buy Bonus prices and transaction/recovery flow;
- MAX WIN basis and stop semantics;
- exact panel timing and quick-stop behavior.

## Visual choices that are inference

- Exact geometry, panel dimensions, arrows, and grayscale emphasis.
- Which board cells illustrate each feature.
- Combining Total Win and MAX WIN in one draft Scene.
- Showing Buy Bonus as a review panel despite an incomplete source state machine.

Mark these as `AI 推定` where they could be mistaken for approved art or logic.

A buildable provisional blueprint is provided at [xbomb-fiesta-blueprint.json](xbomb-fiesta-blueprint.json). It intentionally uses only geometry and text; original symbol and character art are not embedded.
