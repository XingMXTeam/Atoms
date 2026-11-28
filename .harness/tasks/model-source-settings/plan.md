# Plan — model-source-settings

Two tasks. Task 1 builds the session, the dialog, the home and workbench entry points, and the denial sentences. Task 2 removes the key fields from follow-up and continue. Server decision order, caps, and header names stay.

### TASK-1: Add the shared model-source panel and clean the home prompt

**Goal** — A visitor can open 设置 beside the home title or in the workbench header, choose platform demo or a visitor key, and start a generation on the default platform path with a prompt form that no longer contains the radios or the cookie helper.

**Files**
- Create: `src/components/billing/model-source-session.ts`
- Create: `src/components/billing/model-source-session.test.ts`
- Create: `src/components/billing/model-source-settings.tsx`
- Create: `src/components/billing/model-source-settings.test.tsx`
- Create: `src/components/home/prompt-form.test.tsx`
- Create: `src/components/workbench/workbench-settings-entry.test.tsx`
- Modify: `src/components/billing/model-access-fields.tsx`
- Modify: `src/components/home/prompt-form.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/components/workbench/workbench-client.tsx`
- Modify: `src/lib/limits/demo-policy.ts`
- Modify: `src/lib/limits/demo-policy.test.ts`
- Modify: `src/lib/limits/turnstile.ts`
- Modify: `src/lib/limits/turnstile.test.ts`
- Modify: `src/lib/llm/run-provider.ts`
- Tests: the new files above, plus the two policy test files

**Contract**
- Implement `model-source-session.ts` and `ModelSourceSettings` exactly as in `tech-design.md` sections 4 and 5, including the gear SVG, the explanation string, and `type="button"` on every trigger.
- `src/app/page.tsx` places `<ModelSourceSettings appearance="gear" />` in a right-aligned row above the centered title, outside `PromptForm`.
- `workbench-client.tsx` places the same gear immediately before the 返回首页 link.
- `prompt-form.tsx` no longer imports `ModelAccessFields` or keeps a key draft. Submit rules, Turnstile slot, and `offerSettings` follow `tech-design.md` section 4.
- Replace the four `*_MESSAGE_ZH` constants and the `turnstile.ts` / `run-provider.ts` sentences with the literals in `tech-design.md` section 5. Do not change denial codes, status numbers, or numeric caps.
- `model-access-fields.tsx`: delete the cookie / device-id paragraph and the 数据库 / Cookie / 日志 paragraph. Placeholder `只用于当次请求`. Keep the radio labels and their short subtitles.
- Do not edit `src/lib/llm/byok.ts`, `src/lib/env.ts`, `wrangler.jsonc`, or `agent-timeline.tsx` in this task.

**Verify**
- Unit and component: `pnpm exec vitest run src/components/billing/model-source-session.test.ts src/components/billing/model-source-settings.test.tsx src/components/home/prompt-form.test.tsx src/components/workbench/workbench-settings-entry.test.tsx src/lib/limits/demo-policy.test.ts src/lib/limits/turnstile.test.ts src/lib/llm/byok.test.ts` — expect all passing, including the new session, dialog, prompt, header, and sentence assertions from `tech-design.md` section 7.
- The workbench entry test stubs `EventSource` and `fetch`, renders `WorkbenchClient`, and finds the header button named 设置 outside `follow-up-form`.
- Typecheck: `pnpm typecheck` — expect exit 0.
- API / integration: N/A — no new route. Policy coverage is the vitest command above.

### TASK-2: Use stored model source for follow-up and continue

**Goal** — Follow-up and 继续 send the stored visitor key only when the saved mode is byok, and they point at the same settings panel when a key is required, without embedding the radios or key fields.

**Files**
- Modify: `src/components/workbench/agent-timeline.tsx`
- Modify: `src/components/workbench/agent-timeline.test.tsx`
- Create: `e2e/model-source-settings.spec.ts`
- Tests: `src/components/workbench/agent-timeline.test.tsx`, `e2e/model-source-settings.spec.ts`

**Contract**
- Remove `ModelAccessFields`, `byokDraft`, and `rejectIncompleteByok` from `agent-timeline.tsx`.
- Stream, continue, and follow-up call `readActiveByokCredentials()`. They do not call `readByokSession()` directly and they do not call `writeByokSession`.
- The byok-without-key guard, the five denial codes, and the text trigger `打开设置` follow `tech-design.md` section 4. The interrupted-connection sentence does not offer settings.
- `e2e/model-source-settings.spec.ts` implements E2E-1 through E2E-8. A fresh context uses platform demo for every 开始生成 click. BYOK is selected only in the cases that must not submit a generation.

**Verify**
- Component: `pnpm exec vitest run src/components/workbench/agent-timeline.test.tsx src/lib/runs/access.test.ts` — expect the new timeline cases and the existing access tests to pass.
- Typecheck: `pnpm typecheck` — expect exit 0.
- Browser: `pnpm exec playwright test e2e/model-source-settings.spec.ts` after `pnpm build` — expect 8 passing. This command is not a `tasks.json` check because the harness command timeout is 120000ms; it is the rubric command RB-28. Run it before calling the task done.

## Editable scope
- `src/components/billing/**`
- `src/components/home/prompt-form.tsx`
- `src/components/home/prompt-form.test.tsx`
- `src/app/page.tsx`
- `src/components/workbench/workbench-client.tsx`
- `src/components/workbench/workbench-settings-entry.test.tsx`
- `src/components/workbench/agent-timeline.tsx`
- `src/components/workbench/agent-timeline.test.tsx`
- `src/lib/limits/demo-policy.ts`
- `src/lib/limits/demo-policy.test.ts`
- `src/lib/limits/turnstile.ts`
- `src/lib/limits/turnstile.test.ts`
- `src/lib/llm/run-provider.ts`
- `e2e/model-source-settings.spec.ts`
