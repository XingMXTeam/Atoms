# F5 — Polish & Deliver

Design-system pass, restrained micro-interactions, discoverable follow-up UX, performance, accessibility, resilient empty/error/loading states, and delivery documentation.

## Requirements

- **REQ-1** Visual system & micro-interactions: calm, high-craft Chinese UI across home + workbench + share pages; light/dark follows `prefers-color-scheme`; restrained refined micro-interactions (smooth tab indicator/panel transitions, subtle running pulse, timeline card expand polish) strictly respecting `prefers-reduced-motion: reduce`. Ensure zero clipped text in 我的项目 cards at 1280px & 375px, and ensure the code pane keeps long source lines readable at 1280px & 375px via clean horizontal scroll or wrap toggle.
- **REQ-2** Empty / loading / error / UX completeness states:
  - Discoverable Chinese follow-up prompt input + send control in the workbench left rail (starts an incremental iteration run directly from UI, disabled while a run is active or on read-only share view).
  - Accurate persisted `runs.qa_rounds` reflected on workbench metadata including when hitting the 3-round exhaustion cap (`已达修复上限`).
  - Clear Chinese empty / loading / error / interrupted (`继续`) / rate-limit / Gemini→replay fallback banner (`演示回放`) / preview compile error states, plus disabled pending feedback on ZIP export and share creation.
- **REQ-3** Accessibility: keyboard focus-visible rings on primary controls, meaningful landmarks/headings, labelled tabs and iframe preview, contrast meets WCAG AA for text on backgrounds used (both light and dark modes).
- **REQ-4** Performance: fast home + workbench shell load, long-term `Cache-Control` headers for static preview runtime assets (`/preview/*`), idle preloading of `esbuild.wasm` (`requestIdleCallback` / low-priority fetch) when feasible, zero CLS from external font CDNs (system font stack only).
- **REQ-5** Desktop / Mobile preview width toggle (`桌面` / `移动 375px`) on the 预览 tab, keeping the preview sandboxed (`allow-scripts` only) and responsive.
- **REQ-6** Delivery documentation (paraphrase only — **never** paste confidential hiring-brief text or secret keys):
  - Polished `README.md`: project positioning ("可验证的 AI 应用生成"), architecture overview, local dev/test quickstart, and links to delivery docs.
  - Detailed `docs/DELIVERY.md` (and `docs/writeup.md` symlink or matching write-up): (a) architecture & key trade-offs (Plan A `esbuild-wasm` vs WebContainer, China reachability, harness-in-product story), (b) completion status (what is done vs known limitations), (c) prioritized next-step roadmap, (d) step-by-step Cloudflare deployment commands (`npx wrangler login`, D1 database creation & schema migration, `npx wrangler secret put GEMINI_API_KEY`, `pnpm run build:cf` / deploy to `atoms.maoxunxing.com`).
- **REQ-7** Mainland-China reachability & security audit: scripted verification asserting zero runtime requests to external CDNs (`esm.sh`, `unpkg`, `jsdelivr`, `cdn.tailwindcss.com`, `fonts.googleapis.com`, `fonts.gstatic.com`) across home, workbench, and share routes, and custom domain path (`atoms.maoxunxing.com`) documented with `aws:us-east-1` placement.

## Non-goals

- New generation capabilities beyond F1–F4.
- Marketing site / blog.
- Committing any confidential brief text or secret keys.

## Acceptance criteria

1. A11y & responsive spot-check: keyboard tab order reaches prompt submit, follow-up input, timeline expanders, preview width toggle, and preview/code/version tabs; zero horizontal page overflow at 1280×800 and 375×812; zero clipped card text; code pane long lines stay reachable.
2. Workbench follow-up prompt input creates an incremental iteration run directly through the UI in a mock E2E test; `replay` mode displays the visible `演示回放` fallback banner.
3. `README.md` and `docs/DELIVERY.md` (plus `docs/writeup.md`) exist with sections 思路与取舍 / 完成度 / 后续规划 / Cloudflare 部署步骤; contain zero secret keys.
4. Network audit across home, workbench, and share routes records zero requests to external CDNs (`esm.sh`, `unpkg`, `jsdelivr`, `cdn.tailwindcss.com`, `fonts.googleapis.com`, `fonts.gstatic.com`).
5. `fh verify` (`typecheck`, `lint`, `unit`, `build`, `e2e`) passes cleanly after all polish changes.
