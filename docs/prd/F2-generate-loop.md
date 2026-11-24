# F2 — Generate Loop

End-to-end generation: Planner → Architect → Engineer over SSE, visible agent timeline, in-browser preview, and persistence of projects/runs.

## Requirements

- **REQ-1** Home page: central prompt input, ≥4 example prompt cards, and a "我的项目" grid (empty state OK until projects exist).
- **REQ-2** Submitting a prompt creates a `project` + `run` for the current `deviceId` and opens the workbench route.
- **REQ-3** Server SSE stream emits ordered `agent_events` for Planner (mini-PRD + AC-1..n), Architect (file/component/data plan), and Engineer (structured `files[]`). Events persist to D1/`agent_events` with monotonic `seq`.
- **REQ-4** Workbench left rail shows an Agent timeline (Planner / Architect / Engineer cards: status, elapsed time, expandable payload). Chinese copy.
- **REQ-5** Workbench right pane has **预览** and **代码** tabs. Preview bundles generated multi-file React+TS via self-hosted `esbuild-wasm` into a sandboxed iframe (`sandbox="allow-scripts"` only — no `allow-same-origin`). Code tab shows a file tree + source viewer.
- **REQ-6** Vendor/self-host all preview runtime assets from our origin (esbuild.wasm, whitelisted ESM deps, Tailwind browser build). Zero runtime dependency on external CDNs.
- **REQ-7** On successful Engineer completion, persist a `versions` row (`files` JSON, `acceptance` JSON, `summary`) and set `projects.current_version_id`. Messages (user + agent summaries) are stored.
- **REQ-8** Model routing: Flash-class for Planner/Architect; Pro-class for Engineer (exact model ids configurable). Structured output via Gemini `responseSchema` with one automatic retry on parse failure.
- **REQ-9** Interrupt handling: if SSE disconnects mid-run, mark run `interrupted` and surface a Chinese "继续" affordance (documented known limitation).
- **REQ-10** E2E (`LLM_PROVIDER=mock`): core journey generate → preview renders expected mock content; persistence journey refresh → project still listed.

## Non-goals

- QA probe / self-heal / score badge (F3).
- Follow-up iterate patches, version rollback, share link, zip download, seed projects (F4).
- WebContainer or server-side bundling of the preview.
- Sign-up / multi-user auth.

## Acceptance criteria

1. Mock-provider e2e: submit example prompt → timeline shows Planner→Architect→Engineer completion → preview iframe is non-blank with mock app content.
2. After refresh, the project appears in "我的项目" with title derived from the Planner output.
3. Generated preview iframe cannot read host cookies (verified by sandbox attribute + a unit/e2e assertion).
4. Network panel / source audit: preview load does not request esm.sh, unpkg, jsdelivr, or Tailwind CDN.
5. `agent_events` for a completed mock run are queryable in order via the repository layer.
6. `fh verify` remains green; new unit tests cover SSE event parsing and version persistence helpers.
