# Dev plan — generate-loop

### TASK-1: Home prompt, example cards, and 我的项目 grid

**Goal** — Replace the F1 placeholder home with the generate entry surface and wire submit → project+run → workbench navigation.

**Files**
- Modify: `src/app/page.tsx`
- Create: `src/components/home/prompt-form.tsx`, `example-cards.tsx`, `project-grid.tsx`
- Create: `src/app/api/projects/route.ts` (POST create)
- Create: `src/app/projects/[projectId]/page.tsx` (stub shell OK if timeline lands in TASK-3)
- Tests: `e2e/generate-home.spec.ts`, `e2e/generate-submit.spec.ts`

**Contract**
- Central prompt + ≥4 Chinese example cards that fill the input.
- 「我的项目」 region (empty state allowed).
- Submit with non-empty prompt creates device-scoped project+run and navigates to `/projects/[projectId]`.

**Verify**
- `pnpm typecheck`
- Playwright home + submit specs

### TASK-2: SSE agent pipeline + repository persistence for events/versions

**Goal** — Server SSE Planner→Architect→Engineer with persisted monotonic `agent_events`, version+message writes, Flash/Pro routing + schema retry.

**Files**
- Create: `src/lib/agents/{pipeline,planner,architect,engineer,events}.ts`
- Extend: `src/lib/db/repository.ts` (+ tests)
- Extend: `src/lib/llm/**`, `.env.example` (`GEMINI_MODEL_FLASH`, `GEMINI_MODEL_PRO`)
- Create: `src/app/api/projects/[projectId]/runs/[runId]/stream/route.ts`
- Tests: `src/lib/agents/*.test.ts`, repository version/event tests

**Contract**
- Ordered events: Planner (mini-PRD + AC-1..n), Architect (plan), Engineer (`files[]`).
- `seq` monotonic; mock provider returns fixed multi-file fixture.
- On Engineer success: `versions` row + `projects.current_version_id` + user/agent messages.
- Parse failure → one automatic retry.

**Verify**
- `pnpm exec vitest run src/lib/agents src/lib/db src/lib/llm`
- `pnpm typecheck`

### TASK-3: Workbench Agent timeline + interrupt 继续 affordance

**Goal** — Left-rail Chinese Agent timeline consuming SSE; interrupt marks run and shows 「继续」.

**Files**
- Create: `src/components/workbench/agent-timeline.tsx`, `agent-card.tsx`
- Modify: `src/app/projects/[projectId]/page.tsx`
- Create: `src/app/api/projects/[projectId]/runs/[runId]/continue/route.ts`
- Tests: `e2e/generate-timeline.spec.ts`; unit for interrupted status

**Contract**
- Cards for Planner / Architect / Engineer: status, elapsed, expandable payload; Chinese copy.
- SSE disconnect → `runs.status=interrupted` + visible 「继续」 (known limitation documented in code comment or short docs note).

**Verify**
- Playwright timeline spec; `rg 继续 src`; `pnpm typecheck`

### TASK-4: Self-hosted esbuild-wasm preview + 代码 tab

**Goal** — Right pane 预览/代码; same-origin esbuild-wasm bundle into `sandbox="allow-scripts"` iframe; vendor whitelist; file tree + source viewer.

**Files**
- Create: `src/lib/preview/bundle.ts`, sandbox helpers + tests
- Create: `public/preview/esbuild.wasm` (copied from package), vendor ESM map, Tailwind browser build under `public/preview/`
- Create: `src/components/workbench/preview-pane.tsx`, `code-pane.tsx`
- Tests: `src/lib/preview/*.test.ts`, `e2e/generate-preview.spec.ts`

**Contract**
- iframe sandbox is `allow-scripts` only (never `allow-same-origin`).
- Zero runtime CDN dependency for preview assets.
- Code tab: file tree + read-only source for selected file.

**Verify**
- `test -f public/preview/esbuild.wasm`
- Vitest preview + Playwright preview specs
- `pnpm typecheck`

### TASK-5: Mock e2e core+persistence journeys and verify green

**Goal** — REQ-10 journeys + all five `fh verify` gates green under `LLM_PROVIDER=mock`.

**Files**
- Create: `e2e/generate-core.spec.ts`, `e2e/generate-persistence.spec.ts`
- Adjust Playwright fixtures as needed; keep `playwright.config.ts` forcing `LLM_PROVIDER=mock`

**Contract**
- Core: generate → preview shows expected mock content.
- Persistence: refresh → project listed under 「我的项目」 with Planner-derived title.
- typecheck / lint / unit / e2e / build all green.

**Verify**
- `pnpm typecheck && pnpm lint && pnpm test && pnpm test:e2e && pnpm build`

### TASK-6: Fix open eval gaps — sandbox/CDN greps, interrupt chrome scoping, painted preview

**Goal** — Close cycle-1 open items: remove `allow-same-origin` / CDN host strings that veto greps, scope 「继续」 to interrupted runs only, and make 预览 paint identifiable mock UI (visual assertion, not srcdoc alone).

**Files**
- Modify: `src/lib/preview/bundle.ts` (+ tests that must not embed CDN host literals as runtime strings)
- Modify: workbench timeline / header status components so completed runs hide interrupt recovery chrome and do not stay on 「运行中」
- Modify: preview host / iframe paint path so mock content is visible; e2e asserts painted pixels or accessible probe text
- Tests: `src/lib/preview/*.test.ts`, `e2e/generate-preview.spec.ts`, `e2e/generate-timeline.spec.ts`, `e2e/generate-core.spec.ts`

**Contract**
- No `allow-same-origin` in `src`; no esm.sh/unpkg/jsdelivr/Tailwind CDN/Google Fonts host strings in `src`.
- 「继续」 / interrupt banner appears iff `data-run-status=interrupted`; completed success does not show it; header status matches terminal run state.
- After mock Engineer completion, 预览 shows screenshot-identifiable mock UI (RB-13 / RB-30 / E2E-1).

**Verify**
- `pnpm exec vitest run src/lib/preview src/lib/agents`
- Playwright preview + timeline + core specs
- `pnpm typecheck && pnpm lint`
