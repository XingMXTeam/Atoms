# TASK-4 report — Self-hosted esbuild-wasm preview + 代码 tab

## Status

done

## Commit

`d513cde` — feat(TASK-4): Self-hosted esbuild-wasm preview + 代码 tab

## What changed

- `public/preview/esbuild.wasm` + `public/preview/tailwind.css` + `public/preview/vendor/{react,jsx-runtime,react-dom-client}.js` — same-origin preview runtime (REQ-6 / RL-2).
- `scripts/build-preview-vendor.mjs` + `scripts/preview-vendor-entries/*` — rebuild helper for vendor ESM named exports.
- `src/lib/preview/{bundle,sandbox,vendor}.ts` (+ tests) — esbuild-wasm memory bundle, secure sandbox helper, CDN blocklist / vendor map.
- `src/components/workbench/{preview-pane,code-pane,workbench-panels,workbench-client}.tsx` — 预览/代码 tabs, file tree + source viewer, iframe `sandbox="allow-scripts"`.
- `src/components/workbench/agent-timeline.tsx` — forwards Engineer `files[]` to preview via `onFiles`.
- `src/app/projects/[projectId]/page.tsx` — mounts workbench client; hydrates files from persisted engineer events.
- `e2e/generate-preview.spec.ts` — sandbox + mock content + 代码 tab journey.

## Checks (fresh)

- `test -f public/preview/esbuild.wasm` → pass
- `pnpm exec vitest run src/lib/preview` → 6 passed / 0 failed
- `pnpm exec playwright test e2e/generate-preview.spec.ts` → 1 passed / 0 failed
- `pnpm typecheck` → pass

## Decisions within contract

- Sandboxed iframe is opaque-origin: vendor JS + Tailwind CSS are **inlined into srcdoc** after same-origin fetch/read, so the iframe never needs host fetches or CDN.
- Vendor builds are fully self-contained ESM (named exports) to avoid import cycles when esbuild-wasm links React.
- Node unit tests initialize esbuild-wasm without `wasmURL` (Node entry); browser uses `/preview/esbuild.wasm`.

## Not done (out of scope)

- Full core/persistence e2e journeys (TASK-5).
- CodeMirror (deferred by tech design).
