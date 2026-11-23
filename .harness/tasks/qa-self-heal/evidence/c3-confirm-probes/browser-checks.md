# Confirmation browser checks — qa-self-heal, cycle 3

## Commands and results

- `fh verify`: PASS at HEAD `04d41e0f5b6eeb1250094477ee7593bf0b2c83d0`; recorded checks: typecheck, lint, unit, e2e, build.
- `harness capture qa-self-heal --run-id c3-confirm-2`: FAIL, 1/2 pages valid. Home PNG is 72,127 bytes. Workbench capture timed out on literal `/projects/[projectId]`; no fallback used.
- After a fresh `pnpm build`, `LLM_PROVIDER=mock pnpm exec playwright test e2e/qa-self-heal.spec.ts --workers=1`: FAIL, 0/3. Each journey remained on Home; both normal and recovery prompts were filled, but `开始生成` stayed disabled. No project/workbench was reached. This is separate from the recorded `fh verify` E2E pass (16 tests, 5 workers).

## Browser probes at 1280×800

1. Empty submit: button disabled with an empty prompt; expected guard behavior.
2. Long input: 1,014 characters including emoji and RTL text remained in the field; submit stayed disabled. The text wrapped within the textarea, but generation could not proceed.
3. Back/forward: navigation remained on `/`; entered text was retained and no page errors were recorded.

Additional layout measurement: Home title is 36px, body copy 16px, main content width 672px, and the four example cards align in a two-column grid. The visible page has no horizontal overflow. The overflow query found only the 1px-wide visually hidden form label, not visible clipped text. The 1280×800 screenshot shows the centered title, prompt, cards, and empty-project state; the lower empty state continues below the viewport.

## Evidence

- `.harness/tasks/qa-self-heal/evidence/c3-confirm-2/manifest.json`
- `.harness/tasks/qa-self-heal/evidence/c3-confirm-2/home-project-cards-qa-score.png`
- `.harness/tasks/qa-self-heal/evidence/c3-confirm-probes/home.png`
- `.harness/tasks/qa-self-heal/evidence/c3-confirm-probes/prompt-submit-disabled.png`
