# API checks — qa-self-heal, cycle 1

The tech design documents the existing run SSE transport and the `runs`, `versions`, and `agent_events` persistence boundary, but it does not define a public request/response API contract, read paths, error statuses, or malformed-input responses for this feature. There is therefore no documented API case to execute without inventing a contract.

| case | method + path | expected | actual | verdict |
|---|---|---|---|---|
| Public QA read/write contract | Not specified | Not specified | Not specified | SKIP — no standalone API contract is documented |

The browser journeys were exercised separately. The workbench and project-card score badges both displayed `100 分` after navigation and reload. The required equality of the persisted run and version rows could not be checked from a documented read endpoint.

Refinement: add a read-only contract or deterministic verification path that compares the run score, version score, and project-card score, including malformed input and permission behavior where applicable.
