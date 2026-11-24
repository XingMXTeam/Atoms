# Confirm browser checks — polish c1-2

- App: `next start --port 3000`, `LLM_PROVIDER=mock`
- Capture: `harness capture polish` → `20261124-043110` (fail 1/3; placeholders)
- Journey: `evidence/c1-2-browser/journey.mjs` → all scripted E2E cases PASS
- CDN offenders: 0 / 203 requests
- Preview Cache-Control: `public, max-age=31536000, immutable`
- Fonts: system stack only
- Reduced motion: pulse/transitions `0s`
- Preview sandbox: `allow-scripts`; mobile width 375
