# Browser checks — iterate-versions confirm c1-2

App: `LLM_PROVIDER=mock pnpm exec next start --port 3000` (started/stopped in the same shell as capture+journey).
Capture: `harness capture iterate-versions --run-id c1-2` → **fail** (1/3 pages; placeholder `/projects/[projectId]` and `/share/[shareSlug]`).
Supplemental: Playwright journey `evidence/c1-2-browser/journey.mjs` (Playwright 1.65.1).
`fh verify` at HEAD `8d8813e`: typecheck, lint, unit, build, e2e all passed.

## Screens opened

| artifact | hierarchy / layout | overflow | states | REF/RL gap |
| --- | --- | --- | --- | --- |
| `home-seeded-project-grid.png` | Calm Chinese home; 4 example prompts; 2 seeded cards with scores | clipped=1 (H-UI-6.4) | empty-submit disabled | RL-3 satisfied |
| `workbench-initial.png` | Workbench tabs + QA badge; **no follow-up composer** | n/a | completed generate | REF-1 interaction gap |
| `workbench-version-timeline.png` | Chronological v2 current / v1 restore; summaries + QA | clipped=0 | current vs restore | matches REF-1 |
| `workbench-after-rollback-versions.png` | Status 已恢复所选版本; v1 current; both rows remain | clipped=0 | non-destructive | RL-1 / ANTI-1 |
| `workbench-after-rollback-preview.png` | Preview shows 体验 Atoms Studio (v1) | n/a | restored | RL-1 |
| `workbench-after-rollback-code.png` | Code without 优先级 | n/a | restored | RL-1 |
| `workbench-zip-export.png` / journey zip | 下载 ZIP visible; pending text 正在导出… | n/a | download fired | REQ-4 |
| `public-read-only-share.png` | 只读分享 badge; preview only; no ZIP/restore | clipped=1 | read-only | RL-2 |
| `public-read-only-share-code.png` | Code tab with files | n/a | read-only | RL-2 |

## Measurements

- home badges: `94 分`, `96 分` (2)
- timeline rows: 2; current then restore affordance
- share mutationButtons: `[]`; visitor POST versions → 403
- clipped: home 1, timeline 0, share 1

## Probes

1. empty submit → 开始生成 disabled
2. long input (606 + emoji/RTL) → accepted; clipped=1
3. rapid double ZIP → button not left pending/disabled
4. back/forward mid-run URLs → no crash
