# Technical design — polish

## Existing shape

Next.js App Router Chinese shell (`src/app/layout.tsx`, `globals.css` with `prefers-color-scheme` and system fonts), home project grid, workbench client (`workbench-client.tsx`, `workbench-panels.tsx`, `preview-pane.tsx`, `agent-timeline.tsx`, QA cards), public share page, self-hosted `/public/preview/*` (esbuild.wasm, vendor ESM, Tailwind CSS), and `sandbox="allow-scripts"` preview. Persistence, runs, versions, share, ZIP, and provider modes already exist from F1–F4. Polish refines presentation, completeness, and delivery artifacts — it does not add generation capabilities or new providers.

## Visual system and micro-interactions

- Consolidate calm tokens in `globals.css` / shared class patterns for home, workbench, and share: focus-visible rings on primary controls, tab indicator motion, timeline expand polish, subtle running pulse.
- Gate all decorative transitions/animations behind `@media (prefers-reduced-motion: reduce)` so motion resolves to static states.
- Ensure 我的项目 cards truncate or wrap without clipping at 1280 and 375 widths; code pane gains reliable horizontal scroll or an explicit wrap toggle so long lines stay reachable.
- Keep light/dark driven by `prefers-color-scheme` only (no separate theme toggle required).

## UX completeness states

- Add a discoverable Chinese follow-up prompt + send control in the workbench left rail that POSTs an incremental iteration through the existing owner-scoped run APIs; disable while a run is active; omit or disable on share.
- Surface persisted `runs.qa_rounds` in workbench metadata and show `已达修复上限` when the 3-round QA self-heal cap is reached.
- Complete Chinese empty / loading / error / interrupted (`继续`) / rate-limit / `演示回放` (Gemini→replay fallback) / preview compile-error banners using existing provider and probe signals.
- ZIP export and share creation keep disabled + pending feedback while in flight.

## Accessibility

- Keyboard focus-visible rings on prompt submit, follow-up send, timeline expanders, preview width toggle, tabs, share/ZIP actions.
- Meaningful landmarks/headings; labelled tablist/tabpanels; iframe preview has an accessible name.
- Contrast targets WCAG AA for text on used light and dark backgrounds; spot-check primary text/icons.

## Performance and preview runtime

- Serve `/preview/*` static assets with long-term `Cache-Control` (immutable hashed or long max-age) via Next/OpenNext/Workers static headers — do not change asset origin.
- Idle-preload `esbuild.wasm` with `requestIdleCallback` or a low-priority fetch when the workbench/share shell is idle and a preview is likely.
- Keep system font stack only; never introduce Google Fonts or other external font CDNs (zero CLS from font swaps).

## Desktop / mobile preview width

- On the 预览 tab, add a `桌面` / `移动 375px` toggle that constrains the preview frame width while leaving the iframe sandbox at `allow-scripts` only (`getPreviewSandboxAttribute`).
- Width preference is client UI state; share and owner previews both remain responsive inside the chosen frame.

## Delivery documentation

- Polish root `README.md`: positioning "可验证的 AI 应用生成", architecture overview, local dev/test quickstart, links to delivery docs.
- Author `docs/DELIVERY.md` with sections 思路与取舍 / 完成度 / 后续规划 / Cloudflare 部署步骤 covering Plan A vs WebContainer, China reachability, harness-in-product, done vs limits, roadmap, and wrangler/D1/secret/build/deploy commands for `atoms.maoxunxing.com` with `aws:us-east-1` placement.
- Provide `docs/writeup.md` as a symlink or matching write-up. Paraphrase only — never paste hiring-brief text or secret keys.

## China reachability audit

- Add a scripted Playwright (or equivalent) network audit covering `/`, `/projects/[projectId]`, and `/share/[shareSlug]` that fails if any request hits the forbidden CDN hosts.
- Document custom domain + Worker placement in delivery docs; do not rely on `*.workers.dev` for evaluator instructions.

## Verification approach

- Component/unit checks for reduced-motion CSS hooks, sandbox attribute, cache-header config, and docs secret/CDN string absences where appropriate.
- Playwright under `LLM_PROVIDER=mock`: follow-up from UI, `演示回放` banner when replay is active, preview width toggle, a11y tab order spot-check, responsive no-overflow, CDN network audit.
- Planner does not execute product tests; developer/evaluator run checks through harness verify/eval.
