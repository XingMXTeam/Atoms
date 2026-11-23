# F5 — Polish & Deliver

Design-system pass, micro-interactions, performance, accessibility, resilient empty/error/loading states, and the evaluation write-up.

## Requirements

- **REQ-1** Visual system: professional calm Chinese UI, light/dark follows `prefers-color-scheme`, restrained refined micro-interactions (no gratuitous motion). Consistent spacing/typography/components across home + workbench.
- **REQ-2** Empty / loading / error states for: home project grid, SSE run in progress, interrupted run, rate-limit / token-cap, Gemini→replay fallback banner ("演示回放"), and preview compile failure.
- **REQ-3** Accessibility: keyboard focus visible on primary controls, meaningful landmarks/headings, iframe preview labelled, contrast meets WCAG AA for text on backgrounds used.
- **REQ-4** Performance: Lighthouse-oriented pass on home + workbench shell (self-hosted wasm cached long-term; preload esbuild.wasm on idle when feasible). No layout shift from font CDNs (fonts are system/self-hosted only).
- **REQ-5** Optional mobile preview width toggle on the 预览 tab (cuttable if over budget).
- **REQ-6** Write-up doc (paraphrase only — **never** paste the hiring brief): approach & trade-offs, what is done / not done, next steps with priority. Place under `docs/` (e.g. `docs/writeup.md`).
- **REQ-7** Mainland-China reachability smoke checklist executed (or scripted assertions): no external CDN requests on core flows; custom domain path documented.

## Non-goals

- New generation capabilities beyond F1–F4.
- Marketing site / blog.
- Committing the original hiring-test brief or any secret keys.

## Acceptance criteria

1. Manual or automated a11y spot-check: tab order reaches prompt submit, timeline expanders, preview/code/version tabs; no critical axe violations on home shell.
2. Replay-fallback banner appears when provider mode is `replay` (forced in a test).
3. `docs/writeup.md` exists with sections 思路与取舍 / 完成度 / 后续规划; contains no verbatim hiring-brief text and no API keys.
4. Bundle/network audit on home + one workbench load: zero requests to esm.sh / unpkg / jsdelivr / Tailwind CDN / fonts.googleapis.com.
5. `fh verify` remains green after polish; any deferred cut items listed in the write-up with rationale.
