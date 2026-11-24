# Tech design — generate-loop

## 1. Stack and key dependencies

Confirmed as the repo (D1/D3). No new frameworks.

- Next.js App Router 16 + React 19 + TypeScript strict + Tailwind v4
- Existing: `esbuild-wasm`, Drizzle dual adapters, LLM provider factory, deviceId cookie, rate limits
- Named additions allowed: small helpers for SSE parsing, preview host page assets under `public/` (self-hosted `esbuild.wasm`, vendored ESM whitelist, Tailwind browser build). Optional lightweight file-tree component — no WebContainer, no CDN UI kits, no CodeMirror required in F2.

## 2. Architecture overview

```
Browser
  `/` home: prompt + example cards + 我的项目
  `/projects/[projectId]` workbench
       ├─ left: Agent timeline (Planner / Architect / Engineer)
       └─ right: 预览 | 代码
            预览 → esbuild-wasm (same origin) → iframe sandbox="allow-scripts"
Server (Route Handlers)
  POST create project+run
  GET  SSE `/api/projects/[id]/runs/[runId]/stream`
       → pipeline Planner(Flash) → Architect(Flash) → Engineer(Pro)
       → persist agent_events (seq++), messages, versions
OpenNext Worker (placement aws:us-east-1) → Gemini REST streamGenerateContent
D1 / better-sqlite3 via AppRepository
```

## 3. Modules and boundaries

| Module | Path | Owns |
|---|---|---|
| Home UI | `src/app/page.tsx` (+ home components under `src/components/home/`) | prompt, example cards, project grid |
| Workbench UI | `src/app/projects/[projectId]/page.tsx` (+ `src/components/workbench/`) | timeline, 预览/代码 tabs |
| Generate API | `src/app/api/projects/**` | create project/run, SSE stream, continue |
| Agent pipeline | `src/lib/agents/{planner,architect,engineer,pipeline}.ts` | ordered stages + schemas |
| SSE events | `src/lib/agents/events.ts` | event types, seq, persistence helpers |
| Preview runtime | `src/lib/preview/bundle.ts` + `public/preview/**` | esbuild-wasm host, vendor map, iframe srcdoc |
| Repository extensions | `src/lib/db/repository.ts` | listProjects, runs, agent_events, versions, messages |
| Model routing | `src/lib/llm/**` + env | Flash vs Pro ids, responseSchema + 1 retry |

Client components never import db/llm/secrets (`server-only`). Preview iframe never receives host cookies (`sandbox` without `allow-same-origin`).

## 4. Data flow and state

1. Submit prompt (deviceId from cookie) → rate-limit check → `createProject` + `createRun(status=running)` + user `messages` row → redirect `/projects/[id]?run=...`.
2. Workbench opens EventSource → server runs pipeline; each stage emits SSE + inserts `agent_events` with monotonic `seq`.
3. Planner payload: mini-PRD + `AC-1..n`. Architect: file/component/data plan. Engineer: structured `files[]` via Gemini `responseSchema` (one parse retry).
4. On Engineer success: insert `versions` (`files`, `acceptance` from Planner ACs, `summary`), set `projects.current_version_id`, agent summary `messages`, run `status=completed`.
5. Client preview: when `files[]` present, esbuild-wasm bundles from memory + same-origin vendor map → write iframe `srcdoc` with `sandbox="allow-scripts"` only.
6. SSE disconnect → server/client mark run `interrupted`; UI shows 「继续」 which re-opens the stream (documented known limitation).

### State shape (client workbench)

```ts
type AgentName = "planner" | "architect" | "engineer";
type AgentCardState = {
  agent: AgentName;
  status: "pending" | "running" | "completed" | "error" | "interrupted";
  startedAt?: number;
  finishedAt?: number;
  payload?: unknown;
};
type WorkbenchState = {
  projectId: string;
  runId: string;
  runStatus: "running" | "completed" | "interrupted" | "failed";
  agents: AgentCardState[];
  files: { path: string; content: string }[];
  activeTab: "preview" | "code";
};
```

## 5. API / interface contracts

```ts
// POST /api/projects  { prompt: string } → { projectId, runId }
// GET  /api/projects/[projectId]/runs/[runId]/stream  text/event-stream
// POST /api/projects/[projectId]/runs/[runId]/continue → { runId } // 「继续」

type AgentEvent = {
  id: string;
  runId: string;
  seq: number;
  agent: "planner" | "architect" | "engineer";
  type: "plan" | "design" | "file" | "error";
  payload: unknown;
};

interface AppRepository {
  // foundation methods plus:
  listProjects(deviceId: string): Promise<Project[]>;
  createRun(input: { projectId: string; status: string }): Promise<Run>;
  updateRun(id: string, patch: Partial<Run>): Promise<Run>;
  appendAgentEvent(input: Omit<AgentEvent, "id">): Promise<AgentEvent>;
  listAgentEvents(runId: string): Promise<AgentEvent[]>;
  createVersion(input: {
    projectId: string;
    runId: string;
    files: unknown;
    acceptance: unknown;
    summary: string;
  }): Promise<Version>;
  setCurrentVersion(projectId: string, versionId: string): Promise<void>;
  addMessage(input: { projectId: string; role: "user" | "agent"; content: string }): Promise<Message>;
}
```

Mock provider returns a fixed multi-file React+TS fixture that renders identifiable Chinese mock content for e2e.

## 6. Error handling

| Failure | User-visible | Retry | Persist |
|---|---|---|---|
| Structured output parse fail | silent auto-retry once; then Chinese error on card | 1 automatic | agent_events type=error |
| SSE disconnect | run `interrupted` + 「继续」 | user-triggered continue | runs.status |
| Rate limit / Gemini down | foundation replay + 「演示回放」 or Chinese refuse | next day / env fix | usage |
| esbuild compile error | 预览 pane shows Chinese error panel | fix in later QA feature | client only in F2 |
| Cross-device project access | 404 / empty | none | scoped by deviceId |

## 7. Test strategy

- **Unit:** SSE/event seq helpers; version persistence helpers; sandbox attribute helper; mock pipeline fixture shape; CDN-free vendor map presence.
- **E2E (`LLM_PROVIDER=mock`):** core generate→timeline→preview content; persistence refresh→「我的项目」; negative interrupt/empty prompt; boundary example-card fill; uiJourney tab switch; crossFeature deviceId still set from foundation.
- **Static:** grep CDN hosts absent; iframe sandbox assertions.
- **Verify:** keep `typecheck` / `lint` / `unit` / `e2e` / `build` green.

## 8. Run instructions

- Install: `pnpm install`
- Dev: `pnpm dev` → `http://127.0.0.1:3000`
- Eval/capture base: `http://127.0.0.1:3000`
- Frontend working directory: repository root
- E2E: `LLM_PROVIDER=mock pnpm test:e2e`
- Capture precondition: `pages.json` lists home `/` only. Workbench `/projects/[id]` needs the creating `deviceId` cookie; there is no F2 seed at `/projects/demo`. For workbench/timeline/preview judges, capture via an authenticated post-submit Playwright journey in the same browser context (UI submit or API create + cookie), never a bare demo route.

## 9. Risks and trade-offs

- OpenNext SSE buffering — stream flush / `runtime` config must be validated early in TASK-2.
- esbuild-wasm ~10MB — self-host under `public/`, long-cache headers, idle preload from home acceptable.
- 「继续」 is not a perfect checkpoint resume — documented known limitation per PRD.
- CodeMirror deferred to keep F2 inside budget; tree+viewer still satisfies REQ-5.

## 10. Overview deltas

- Product: generate-loop capability (home prompt, workbench timeline, preview, persistence).
- Technical: SSE agent pipeline; esbuild-wasm same-origin preview host; repository methods for runs/events/versions/messages; Flash/Pro model env routing.
