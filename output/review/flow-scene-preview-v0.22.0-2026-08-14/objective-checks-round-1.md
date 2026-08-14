# Objective checks — round 1

## Automated checks

- `npm run test`: PASS, 51 tests / 51 passed. Includes TypeScript, production build, PSD structure, package integrity, migration, flow interaction and rendered-source checks.
- `npm run verify:psd`: PASS inside the full test run; dimensions, Chinese layer names, nested groups, order, visibility and opacity passed.
- `npm run lint`: PASS with zero errors and zero warnings after correcting the Hook dependency warning found in the first engineering run.
- `npm run benchmark`: PASS. Real Canvas + PSD + PDF workload: 569.3223 ms. 50 Scenes × 100 layers: 31.8701 ms.
- `git diff --check`: PASS; only Windows LF→CRLF informational warnings were emitted.
- `scripts/validate-review-spec.ps1 -Strict`: PASS; five criteria, all-score rule, threshold 85, max five rounds.

## Feature-specific deterministic checks

- Default sizing: landscape 960×540 → card 280×264; portrait 1080×1920 → card 280×426.
- Resize math: tested at flow zoom 0.5, with Shift aspect lock, and at min/max clamps 200×180 / 640×600.
- Persistence: customized card sizes survive serialize/deserialize; old overview objects missing width/height receive ratio-aware defaults.
- Connections: source uses actual `fromSize.width` and `fromSize.height / 2`; target uses actual card height.
- Auto-arrange: tests include variable 520×400 and 300×500 cards in the same column and assert 70px separation; next column uses max card width plus 100px.
- Preview: source thumbnail SVG uses the full `viewBox="0 0 scene.width scene.height"`; CSS enforces `object-fit: contain` at every card size.

## Environmental limitation

- No connected browser instance was available in this session, so real pointer-driven visual QA was not recorded. The acceptance rubric does not require a reference screenshot; interaction math, event routing, rendered-source structure and full regression tests are available as evidence. This limitation must lower confidence if the source evidence is insufficient.
