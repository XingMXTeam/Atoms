# API checks — generate-loop, cycle 2

Environment: local app started with `LLM_PROVIDER=mock`; requests used a real browser context with the app's `deviceId` cookie. Contract source: `tech-design.md` section 5.

| Method + path | Request | Expected | Actual | Verdict |
|---|---|---|---|---|
| POST `/api/projects` | `{"prompt":"做一个展示欢迎语的简洁应用"}` | 200 with `projectId`, `runId` | 200; JSON contained both IDs and `mode:"mock"`; browser had `deviceId` cookie | PASS |
| GET `/api/projects/{id}/runs/{runId}/stream` | Authenticated request for the created run | `text/event-stream`; ordered Planner, Architect, Engineer events | 200 `text/event-stream`; emitted `seq` 1 planner/plan, 2 architect/design, 3 engineer/file; Engineer payload contained structured `files[]`; stream ended | PASS |
| POST `/api/projects` | `{"prompt":""}` | Reject invalid prompt with a client error | 400 `{"messageZh":"请输入需求后再开始生成"}` | PASS |
| POST `/api/projects` | malformed JSON body `{` | Reject malformed request | 400 `{"messageZh":"请求格式无效，请重试"}` | PASS |
| GET `/projects/{id}?run={runId}` | Same project in a fresh browser context without the creating device cookie | Deny cross-device access | 404; empty response body | PASS |
| Aborted GET `/api/projects/{id}/runs/{runId}/stream` | Browser fetch aborted after opening the stream | Run becomes interrupted and exposes recovery state | Browser received `AbortError`; subsequent workbench remained `运行中`, agents `等待中`, no `继续` | FAIL |

The SSE event payloads included Planner acceptance criteria, Architect file/component/data plans, and Engineer file contents. After the stream completed, reopening the run showed a completed header but did not hydrate the cards or finish preview bundling; see the browser screenshots and report.
