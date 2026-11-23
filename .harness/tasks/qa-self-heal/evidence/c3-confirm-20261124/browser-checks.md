# Browser checks — qa-self-heal, cycle 3 confirmation

Chromium, Playwright 1.65.1, production server (`next start`), `LLM_PROVIDER=mock`, viewport 1280×800. Each server was started and stopped inside its Bash invocation.

- Empty submit: `开始生成` was disabled on the empty form; URL remained `/`.
- Long prompt: 1,205 Unicode code points (emoji, Hebrew RTL, and 1,200 CJK chars) fit the textarea; measured horizontal overflow was false.
- Rapid double submit: two near-simultaneous clicks navigated to one workbench; QA completed with status `completed`.
- Probe boundary: posted a malformed report from the iframe and a report-shaped message from the host window. The QA timeline text remained unchanged after 500 ms (`qaTimelineUnchanged: true`).
- Back/forward: after returning to Home, back reopened the project and forward returned to Home; the persisted project card remained visible.
- Recovery visual: workbench badge showed `100 分`; preview `data-preview-painted=true` and rendered the repaired todo preview. Home card showed `100 分` after navigation and reload.
- Exhaustion visual: QA history showed repairs 1, 2, and 3, then `已达修复上限（第 3 轮）`; badge showed `0 分`. However, the same live badge reported `data-run-qa-rounds="0"` despite those three visible repair events. This conflicts with the expected persisted round count.
- Layout measurement on the recovery workbench at 1280×800: 1 node met the overflow heuristic. No visible text clipping or overlap was apparent in the opened screenshot; the node was not identified, so it is not counted as a visual defect.

Fresh screenshots: `workbench-browser-journey.png`, `home-after-recovery.png`, and `workbench-exhausted.png`. The official capture manifest is separately recorded and reports 1/2 pages valid: the configured workbench template `/projects/[projectId]` timed out in capture's fresh context.
