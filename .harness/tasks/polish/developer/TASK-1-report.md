# TASK-1 developer report

- **Task:** Design-system pass, reduced-motion, and responsive card/code readability
- **Commit:** `188297c`
- **Files:** `src/app/globals.css`, `src/app/globals.css.test.ts`, `src/app/page.tsx`, `src/app/projects/[projectId]/page.tsx`, `src/components/home/example-cards.tsx`, `src/components/home/project-grid.tsx`, `src/components/home/prompt-form.tsx`, `src/components/share/shared-project.tsx`, `src/components/workbench/agent-card.tsx`, `src/components/workbench/agent-timeline.tsx`, `src/components/workbench/code-pane.tsx`, `src/components/workbench/qa-timeline-card.tsx`, `src/components/workbench/workbench-client.tsx`, `src/components/workbench/workbench-panels.tsx`, `e2e/polish.spec.ts`
- **Checks:**
  - `pnpm exec vitest run src/app/globals.css.test.ts src/components/workbench/agent-card.test.tsx` — 2 files / 4 tests passed.
  - `LLM_PROVIDER=mock pnpm exec playwright test e2e/polish.spec.ts --grep "visual-system|reduced-motion|card-clip|a11y|no-page-overflow"` — 5 passed.
  - `pnpm typecheck` — passed.
- **Implementation:**
  - Consolidated calm design tokens + shared `atoms-focus-ring` / tab / expand / running-pulse utilities in `globals.css`, with `@media (prefers-reduced-motion: reduce)` kill switch.
  - Project cards get `data-testid` hooks, `min-w-0` + truncate/wrap so titles never clip at 1280/375; home/workbench/share shells clip horizontal overflow.
  - Code pane adds an explicit wrap toggle while keeping horizontal scroll for long lines.
  - Primary controls (prompt submit, tabs, expanders, share/ZIP, continue) use the shared focus-visible ring; running agents use the gated pulse; expand panels use gated transitions.
  - Seeded project links open the workbench by falling back to the current version's `runId` when no `?run=` query is present.
- **Contract decisions:** Preview width toggle and follow-up UX left for later polish tasks. Motion is CSS-only (no new deps).
