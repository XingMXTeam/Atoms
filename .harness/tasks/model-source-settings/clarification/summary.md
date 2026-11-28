# Clarification summary — model-source-settings

## Goal

Move the model-source choice off the generate form. The owner rejected the live “模型来源” block (two large radios, “平台演示” and “使用我的 API Key”, plus helper text about demo quota, cookies, device ids, and verification) on https://atoms.maoxunxing.com/. That block does not meet the product design. Configuration belongs in a settings place. The generate surface stays clean. Success is the written done-when: the form no longer shows those radios or the cookie/verification helper; settings is where the visitor chooses platform vs BYOK and enters a key; the default remains platform demo; existing policy tests still pass; a PR is open for TT to review.

## Users and roles

Anonymous visitors, still identified only by the existing device cookie. No sign-up and no new role. A visitor can run the default platform demo without opening settings. When `LLM_PROVIDER=gemini`, that demo remains one complete generation per visitor, and follow-up still cannot spend platform keys.

## Main path

The home prompt stays a Chinese textarea plus 开始生成. A small 设置 control sits near the home title, outside the prompt form. The workbench header has the same control. Both open one shared dialog, not a new marketing page. The dialog is the only place for the platform-vs-visitor-key choice, the key fields, and the product explanation.

**Assumption (recorded):** there is no app-wide chrome header today. The task allowed a header gear or a settings page or panel. This plan uses a dialog opened from the home title area and from the workbench header, because that fits the current pages without a new route.

## Error and edge paths

If the API returns demo exhausted, platform budget exhausted, or a visitor key required or invalid, the form shows that message and a control that opens the same dialog. It does not put the radios back on the form. The existing 改用演示回放 button stays when the API says replay is available. A key that fails is not replaced by a platform key. Turnstile stays on the platform path as the widget only, without the rejected helper paragraph.

## Data

The choice is `platform` or `byok`, stored in sessionStorage next to the existing BYOK session. The key stays in that existing sessionStorage entry, is sent only on the request that uses it (`x-atoms-byok-*`), and is never written to D1, cookies, logs, localStorage, or the URL. Absent choice means platform demo.

## Integrations

Server billing behavior stays the same: same denial codes, same numeric caps, same header names, Turnstile still required before a platform-key call, no fallback from a failed visitor key onto platform keys. User-visible Chinese sentences that tell the visitor to paste a key into the form change so they point at 设置. Tests that assert codes stay. A test that asserts an exact old sentence is updated to the new sentence.

## Stack

The repo's existing Next.js App Router + TypeScript + Tailwind. No new framework or dependency. Confirmed by the task and by `docs/plan/decisions.md` D3, D8, and D10.

## Budgets

Leave `harness.config.json` as it is: `maxMacroCycles` 5, `requiredStablePasses` 2, gate commands `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`.

## Quality

Level B polished. Rank: key correctness and security, then a clean generate surface, then visual fit with the current home prompt card and workbench chrome. Anti-reference: the rejected screenshot. Red lines are in `quality-expectations.md`.

## Non-goals

Do not merge, deploy, rotate secrets, or edit wrangler production vars, caps, or secrets. Do not change numeric caps, denial codes, header names, or server persistence. Do not add a marketing settings page. Do not add a dependency.

## Coverage

| Module | Covered | Where answered |
| --- | --- | --- |
| 1. Goal and success | yes | answers.md §1 |
| 2. Users, roles, permissions | yes | answers.md §2 |
| 3. Main path | yes | answers.md §3 |
| 4. Error and edge paths | yes | answers.md §4 |
| 5. Data objects | yes | answers.md §5 |
| 6. Integrations and API boundaries | yes | answers.md §6 |
| 7. Non-functional limits | yes | answers.md §7 |
| 8. Non-goals | yes | answers.md §8 |
| 9. Acceptance | yes | answers.md §9 |
| 10. Budgets and stop policy | yes | answers.md §10 |
| 11. Quality expectations | yes | answers.md §11, quality-expectations.md |
| Stack | yes | answers.md §12 |

confirmed-by-user: yes (2026-11-28, "Done when: the generate form no longer shows the “模型来源” radios or the cookie/verification helper; settings is the place to choose platform vs BYOK and enter keys; default remains platform demo; existing policy tests still pass; a PR is open for TT to review.")
open-questions: 0
