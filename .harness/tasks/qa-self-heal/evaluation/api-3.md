# API checks — qa-self-heal, cycle 3 confirmation

The tech design describes the preview probe flowing through the existing run SSE endpoint and repository, but it does not specify concrete endpoint paths, methods, request/response schemas, documented error statuses, or ownership-denial behavior. The PRD and E2E cases do not supply those details.

| case | request | expected | actual | verdict |
| --- | --- | --- | --- | --- |
| Success, malformed payload, boundary, and deviceId ownership | No request contract is specified | Not specified | Not sent | Not independently verifiable |

No request shapes were inferred. The browser's real postMessage boundary was separately probed and is documented in `evidence/c3-confirm-20261124/browser-checks.md`.

Refinement: document the run/SSE and probe-facing endpoint contracts (method/path, payload schema, success response, malformed payload behavior, and deviceId ownership failure), then add real-request checks for those cases.
