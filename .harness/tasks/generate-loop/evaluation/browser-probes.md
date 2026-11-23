# Browser probes — generate-loop, cycle 2

- Empty prompt: on `/`, the primary submit control was disabled while the textarea was empty; no navigation occurred. Expected validation behavior.
- Example card: clicking 待办清单 left the textarea empty. Filling it directly with `做一个展示欢迎语的简洁应用` changed the DOM value but the submit control remained disabled.
- Long Unicode input: a 1,008-character value with Chinese, emoji, and RTL text was accepted by the textarea; submit remained disabled. The document width remained 1,280 px at the 1,280 px viewport.
- Rapid repeated submit: after entering `重复提交探针`, the submit control remained disabled, so repeated activation could not be performed; this reproduces the same blocking prompt interaction.
- Reload/persistence: the API-created project remained listed under 我的项目 after returning home and reloading. Cross-device route access returned 404 in another browser context.

All browser actions ran against the local app with `LLM_PROVIDER=mock` and Playwright 1.65.1.
