# Placeholder assets

M00 uses PlayCanvas primitives and CSS only. Placeholder files added later must:

- use the canonical filename from `data/assets/manifest.json`;
- keep the same stable asset ID when replaced;
- be marked `PLACEHOLDER` or `DEV_GENERATED`;
- never require gameplay-code changes when upgraded to `FINAL`.
