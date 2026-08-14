# Frozen deliverable — round 1

- Freeze time: 2026-08-14 Asia/Taipei
- Base commit: `f7a3e6abfeca716b097a55ec01e066c1dc67d702`
- Product diff hash: `44d274a905389247c939e23b71011b8ac242f378`
- Package version: `0.22.0`
- Review state: read-only until deterministic verdict is validated.

## Product file hashes (SHA-256)

- `app/editor.tsx`: `8EC03B79481D37A397C8BFC50D5CE8D4ABBCF4CE3734B8CEF60B3EB6B06367D4`
- `app/globals.css`: `781B4B71BAF5F87BA7A12CCFE707B6BD2F3AFC669DA11FEBC78FC3B93DF64A20`
- `lib/editor-model.js`: `B9C465FC53A9371AD8CA0DF6812DFA0C73A6A2335F7961730AD3AF4AC7993EAB`
- `lib/interaction-math.js`: `CC52ED66540921F864FDC09BDD4B9E849F1DDC38AA6360A7060383396F3493B5`
- `package.json`: `2BB729BA0515EB979D9DAEC5F7ADE3A51E879781AAFDDF7EF67341BF57164F7F`
- `README.md`: `14BFAA96E22936B5CACA9B41EB462E844670C0E9389D362FD7132545637333B8`
- `tests/editor-model.test.mjs`: `E61F932F32C669FC37C4A3386081CF28DECE1074039E86224417DB278DFC67B8`
- `tests/interaction-math.test.mjs`: `D3A0BF7135CCDE57F5F0F1880D76DCE14A1447D507792133C044B486B23A8326`
- `tests/rendered-html.test.mjs`: `83B085B5A908C76B47904BE7AA6BECBCCD3D81C784389298042E48E1D74F52EF`

## Frozen deliverable scope

- Source and tests listed in `task.md`.
- `README.md`, package/manifest/Skill version files and build script.
- Generated `dist/` from the successful v0.22.0 build is reproducible and intentionally not tracked.
