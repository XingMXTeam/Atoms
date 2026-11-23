# API checks — generate-loop, confirmation cycle 2

Base: `http://127.0.0.1:3000`, `LLM_PROVIDER=mock`. A GET `/` first minted the anonymous device cookie in the same curl cookie jar. The contract in `tech-design.md` documents `POST /api/projects { prompt } → { projectId, runId }`; it does not prescribe exact error status/body shapes.

| Case | Request | Expected | Actual | Result |
|---|---|---|---|---|
| Create | `POST /api/projects`, JSON `{"prompt":"做一个 API evaluator 专用的待办应用"}` with device cookie | JSON contains projectId and runId | HTTP 200; `{"projectId":"769b1990-dca4-4d9b-b9cf-715484c8c162","runId":"25c00934-a847-4f5c-9ae5-4b38f81344b5","mode":"mock"}` | PASS |
| Empty prompt | `POST /api/projects`, JSON `{"prompt":"   "}` with device cookie | Request rejected | HTTP 400; `{"messageZh":"请输入需求后再开始生成"}` | PASS |
| Malformed JSON | `POST /api/projects`, body `{` with device cookie | Request rejected | HTTP 400; `{"messageZh":"请求格式无效，请重试"}` | PASS |

All calls were made directly over HTTP to the running app. No documented contract exists for error body shape or status code; the current Chinese responses are recorded as observed behavior.
