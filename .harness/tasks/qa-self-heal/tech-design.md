# Tech design — qa-self-heal

## 1. Stack and dependencies

Use the existing Next.js App Router, React, TypeScript, Tailwind, OpenNext/Workers, Drizzle repository, LLM provider abstraction, event stream, esbuild-wasm preview, and Playwright/Vitest setup. No new framework or external runtime CDN is required. QA uses the existing server-side Flash-class model routing; tests and E2E use the deterministic mock provider.

## 2. Architecture and data flow

```text
Workbench + preview iframe
  ├─ compile/runtime result and DOM summary
  └─ validated postMessage probe report
       → workbench host
       → existing run SSE endpoint / agent pipeline
          ├─ persist + stream probe event
          ├─ QA evaluates Planner acceptance criteria + probe report
          ├─ persist + stream per-criterion verdict and score
          ├─ when needed, QA fix instruction → Engineer files delta only
          ├─ apply delta and rebuild preview, then probe and judge again
          └─ finish on pass or after at most three fix rounds

Repository
  runs.qa_rounds / runs.qa_score
  versions.qa_score
  agent_events: probe | verdict | fix | error

Surfaces
  /projects/[projectId] workbench badge + expandable QA timeline card
  / home project card score badge
```

The existing workbench SSE stream remains the event transport. Each QA lifecycle event is persisted before/with its streamed timeline event and receives the run's monotonically increasing event sequence. Repository interfaces and both D1 and local SQLite adapters remain the persistence boundary. The latest final score is written to both the run and resulting version. Project-list data reads that persisted score for the home card.

## 3. Probe boundary

The preview iframe remains sandboxed without `allow-same-origin`. The host validates `message` source against the active preview iframe and validates the payload with a schema before treating it as a probe report. The report is bounded and contains compile errors, runtime errors, blank-screen detection, and a summarized DOM description; it does not include arbitrary unbounded page content. Invalid messages are ignored or recorded as an error event and never trigger QA or a repair.

Probe outcomes distinguish a healthy rendered preview from a compile/runtime failure or blank screen. Rebuilds after an Engineer patch trigger a fresh probe before the next QA judgment. Do not use screenshot-diff QA; it is a PRD non-goal.

## 4. QA and repair contracts

QA input is the Planner acceptance criteria plus the latest validated probe report and relevant run context. Structured QA output contains one `pass`/`fail` verdict and reason for each criterion and an integer `qa_score` from 0 through 100. A failure requiring repair produces a focused fix instruction. Engineer repair output is a `files` delta only; apply it to the current file set, rebuild the preview, and judge the updated result.

Increment and persist `runs.qa_rounds` only for an actual fix attempt. The loop may perform no more than three fix attempts for a run. On a fourth needed repair, do not call Engineer again: persist the terminal exhausted state 「已达修复上限」 together with the latest version and score. Errors in probe, QA, or repair are represented by `agent_events.type = error` and leave a user-visible recoverable run state.

## 5. UI behavior

Add QA to the existing workbench agent timeline rather than introducing a separate route. Stream probe, verdict, fix, and error cards in event order. The expandable QA card lists each acceptance criterion, verdict, reason, and the fix round that resolved it or the fact that it remained/exhausted. Show the final score badge on the completed workbench header and the corresponding project card on `/`. The exhausted state and operational errors use clear Chinese copy. Preserve loading, running, success, failure, and exhausted feedback.

## 6. Verification strategy

- Unit: validate probe message schema/source handling, blank-screen and report aggregation, criterion verdict/score aggregation, delta-only repair shape, and strict three-round cap including the no-fourth-call case.
- E2E (`LLM_PROVIDER=mock`): deliberately make first Engineer output fail compilation; observe probe and failed criterion; observe patch/rebuild/re-judge; assert healthy final preview within three rounds and visible score. Cover exhaustion path, timeline expansion, and persistence/navigation of the badge.
- Run the repository's `fh verify` gates: typecheck, lint, unit, E2E, and build; E2E uses mock provider.

## 7. Route capture

Use `pages.json` for `/` and the authenticated workbench route. The workbench route requires a project created in the same browser context with its deviceId cookie. Capture/judge the QA timeline after a deterministic mock run; never treat a bare `/projects/demo` visit as valid workbench evidence.

## 8. Assumptions and non-goals

- Continue the existing API/SSE and repository patterns; no new service or model provider is introduced.
- Model-specific Flash identifier remains governed by the existing model-routing configuration.
- Human editing, more than three repair rounds, screenshot-diff QA, and F4 share/zip/rollback remain outside scope.
