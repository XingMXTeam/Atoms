# Tech design — model-source-settings

## 1. Stack and key dependencies

Next.js App Router, React, TypeScript, Tailwind v4, Vitest, Testing Library, and Playwright, as the repo already uses them (`docs/plan/decisions.md` D3, `.harness/standards.md`). No new dependency. No icon package and no dialog library. The gear is an inline SVG. Styling uses the existing `atoms-focus-ring`, zinc border, `rounded-2xl`, and `rounded-full` classes already on the prompt and the workbench header.

## 2. Architecture overview

```
home title row ── 设置 (gear) ──┐
workbench header ── 设置 (gear) ┼─► ModelSourceSettings dialog
prompt error ── 打开设置 ───────┤         │
follow-up error ── 打开设置 ────┘         ▼
                              model-source-session.ts
                              sessionStorage:
                                atoms.model-source.mode
                                atoms.byok.session   (existing)
                                         │
prompt submit / follow-up / continue / SSE
  read mode + key, attach x-atoms-byok-* only when mode is byok
                                         │
                              existing /api/projects and continue routes
                              (codes, caps, Turnstile, no fallback unchanged)
```

The dialog is client-only. `src/app/page.tsx` stays a server component and mounts the client control next to the title. The workbench header mounts the same control.

## 3. Modules and boundaries

Create:

- `src/components/billing/model-source-session.ts` — mode plus the existing key session. The only writer of `atoms.byok.session` after this feature, besides `writeByokSession` which it calls.
- `src/components/billing/model-source-session.test.ts`
- `src/components/billing/model-source-settings.tsx` — gear and text triggers plus the dialog.
- `src/components/billing/model-source-settings.test.tsx`
- `src/components/home/prompt-form.test.tsx`
- `src/components/workbench/workbench-settings-entry.test.tsx`
- `e2e/model-source-settings.spec.ts`

Modify:

- `src/components/billing/model-access-fields.tsx` — copy only. Still the fieldset inside the dialog. Remove the cookie / device-id paragraph and the sentence that mentions 数据库, Cookie, and 日志.
- `src/components/home/prompt-form.tsx` — drop the radios and the local key draft. Read the session on submit.
- `src/app/page.tsx` — 设置 above the title, outside `PromptForm`.
- `src/components/workbench/workbench-client.tsx` — 设置 in the header row, immediately before 返回首页.
- `src/components/workbench/agent-timeline.tsx` — remove `ModelAccessFields`. Read the session for stream, continue, and follow-up.
- `src/components/workbench/agent-timeline.test.tsx`
- `src/lib/limits/demo-policy.ts` — the four exported Chinese sentences only.
- `src/lib/limits/demo-policy.test.ts` — add assertions for the new sentences. Do not change code or cap assertions.
- `src/lib/limits/turnstile.ts` — user-visible `messageZh` strings only.
- `src/lib/limits/turnstile.test.ts` — keep the existing regex; add a 设置 assertion.
- `src/lib/llm/run-provider.ts` — one `messageZh` string. Keep the phrase `平台密钥不会被用作备用` so `src/lib/llm/byok.test.ts` stays green without an edit.

Do not modify: `src/lib/llm/byok.ts` header names, `src/lib/runs/access.ts`, `src/lib/env.ts` defaults, `wrangler.jsonc`, `harness.config.json`, or any route's status codes.

`ModelAccessFields` is imported only by `model-source-settings.tsx`. `prompt-form.tsx` and `agent-timeline.tsx` must not import it.

## 4. Data flow and state

| Fact | Type | Default when absent | Owner | Lifetime |
| --- | --- | --- | --- | --- |
| Selected source | `"platform"` or `"byok"` | `"platform"` | `sessionStorage["atoms.model-source.mode"]` | this tab |
| Visitor credentials | existing `ByokCredentials` or null | null | `sessionStorage["atoms.byok.session"]` via `readByokSession` / `writeByokSession` | this tab |
| Dialog open | boolean | false | each `ModelSourceSettings` instance | while open |
| Key draft | existing `ByokDraft` | `EMPTY_BYOK_DRAFT`, or the stored credentials when the panel opens on `byok` | dialog state | while open |
| Prompt text, pending, alert, replay flag, Turnstile token | unchanged prompt-form state | empty / false | `PromptForm` | page |
| Offer settings | boolean | false | prompt form and timeline | until the next successful submit |

Rules:

- `readModelSourceMode()` returns `"byok"` only when the stored value is exactly `byok`. Any other value, a missing key, or `window` undefined returns `"platform"`.
- `readActiveByokCredentials()` returns credentials only when the mode is `byok` and `readByokSession()` returns a credential. A leftover key while the mode is `platform` is ignored and must not be attached to a request.
- `selectPlatformDemo()` sets the mode to `platform` and calls `writeByokSession(null)`.
- `selectVisitorKey()` sets the mode to `byok` and does not invent a key.
- `saveVisitorKey(draft)` sets the mode to `byok`. When `draftCredentials(draft)` returns a credential, it writes that credential. When it returns null, it calls `writeByokSession(null)` and does not store a partial key. The mode stays `byok`, so the next submit is blocked instead of falling through to platform keys.
- Each of those three writers calls listeners registered with `subscribeModelSource(listener): () => void`.
- The prompt form and the timeline subscribe and re-read after a change. They do not keep a second copy of the key.
- Do not write the key or the mode to `localStorage`, cookies, D1, the URL, logs, or SSE payloads.
- Colliding keys already in the repo: `atoms.byok.session` stays. Do not rename it. `atoms.model-source.mode` is new. No other `atoms.model-source.*` key.

Client hydration: the first client render assumes `platform`. A `useEffect` reads the session and sets `hydrated`. 开始生成, 继续, and 发送后续需求 stay disabled until that read finishes, so a byok tab cannot submit once as platform. Testing Library flushes the effect before assertions.

Dialog:

- Closed: the panel is unmounted, so radios are not in the document.
- Open: `role="dialog"`, `aria-modal="true"`, `aria-labelledby="model-source-settings-title"`, `data-testid="model-source-settings-panel"`.
- Title text: `模型设置`.
- Explanation, `data-testid="model-source-explanation"`, exact text: `每位访客可以免费使用平台演示完整生成 1 次。之后的真实生成和后续修改由你自己的 API Key 付费。密钥只用于当次请求，不会保存在服务器上。密钥调用失败时，不会改用平台密钥。`
- The fieldset remains `ModelAccessFields` with the mode toggle on. Keep the short radio subtitles already in that file. Delete the paragraph that begins `演示额度用完后请改用自己的 API Key` and mentions `清除 Cookie` and `设备号`. Delete the paragraph that mentions `数据库、Cookie 或日志`. API Key placeholder becomes `只用于当次请求`.
- Selecting 平台演示 calls `selectPlatformDemo()` and clears the draft key in React state.
- Selecting 使用我的 API Key calls `selectVisitorKey()`. Field edits call `saveVisitorKey`.
- Gear trigger: `type="button"`, `data-testid="model-source-settings-open"`, `aria-label="设置"`, visible text `设置`, `min-h-11 min-w-11`, `rounded-full` zinc border like 返回首页. Inline SVG, `aria-hidden="true"`, 16×16, `stroke="currentColor"`, no icon import:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.75">
  <path stroke-linecap="round" stroke-linejoin="round" d="M10.3 3.3h3.4l.5 2.1a7.8 7.8 0 0 1 1.9 1.1l2-.8 1.7 2.9-1.6 1.4a7.6 7.6 0 0 1 0 2.2l1.6 1.4-1.7 2.9-2-.8a7.8 7.8 0 0 1-1.9 1.1l-.5 2.1h-3.4l-.5-2.1a7.8 7.8 0 0 1-1.9-1.1l-2 .8-1.7-2.9 1.6-1.4a7.6 7.6 0 0 1 0-2.2L4.2 8.6l1.7-2.9 2 .8a7.8 7.8 0 0 1 1.9-1.1l.5-2.1z" />
  <circle cx="12" cy="12" r="2.6" />
</svg>
```

- Text trigger: `appearance="text"`, `type="button"`, `data-testid="open-model-settings"`, label `打开设置`, underline text-button classes matching 改用演示回放.
- Close control: `type="button"`, `aria-label="关闭设置"`. Escape, that control, and a click on the backdrop close the dialog. Focus moves to the first focusable element inside the dialog on open, returns to the trigger that opened it on close, and Tab / Shift+Tab cycle inside the dialog while it is open.
- Overlay: `fixed inset-0 z-50`. Panel: `max-w-lg`, `max-h-[min(32rem,calc(100vh-2rem))]`, `overflow-y-auto`, `rounded-2xl`, zinc border, white / `dark:bg-zinc-950`, padding `p-5`, stack `gap-3`.

Home layout in `src/app/page.tsx`, replacing the current title wrapper only:

```tsx
<div className="flex w-full max-w-xl flex-col gap-3">
  <div className="flex justify-end">
    <ModelSourceSettings appearance="gear" />
  </div>
  <div className="text-center">
    {/* existing eyebrow, h1, and subtitle */}
  </div>
</div>
```

`PromptForm` stays a sibling below that block, not a parent of the gear.

Workbench header actions:

```tsx
<div className="flex shrink-0 items-center gap-2">
  <ModelSourceSettings appearance="gear" />
  <Link href="/">返回首页</Link>
</div>
```

Prompt submit:

- Disabled until hydrated, when the prompt is empty, while pending, or when platform mode has a site key and the Turnstile token is empty.
- Mode `byok` and `readActiveByokCredentials()` null: do not `POST`. Set the alert to `请完整填写你的 API Key。Gemini 只需密钥；OpenAI 兼容接口还需要 Base URL 和模型名。` and `offerSettings`.
- Mode `byok` with credentials: `POST /api/projects` with `byokHeaders(credentials)` and without the Turnstile header.
- Mode `platform`: `POST` without BYOK headers. Include `x-atoms-turnstile-token` only when the token is non-empty.
- Do not call `writeByokSession` from the prompt form.
- On a non-OK response, keep the prompt. If `code` is `demo_exhausted`, `platform_budget`, `byok_required`, `byok_invalid`, or `turnstile_required`, show `messageZh` in `role="alert"` and render the text settings trigger. If `replayAvailable` is true, keep the existing 改用演示回放 button. Network and generic failures do not show 打开设置.
- The existing hint under an empty prompt, and the line `平台演示极有限 · 自己的密钥用于正式生成 · ⌘/Ctrl + Enter` when the prompt is non-empty, stay.
- Turnstile: when hydrated, mode is `platform`, and `/api/billing/config` returned a non-empty `turnstileSiteKey`, render `TurnstileWidget` inside `<div data-testid="turnstile-slot">` with no sibling paragraph. Otherwise do not render that slot.

Follow-up and continue, in `agent-timeline.tsx`:

- Delete the `byokDraft` state, the effect that copies the session into that draft, and `rejectIncompleteByok`.
- Before `startNextRun`, if mode is `byok` and `readActiveByokCredentials()` is null, do not `POST`. Alert: `请完整填写你的 API Key。Gemini 只需密钥；OpenAI 兼容接口还需要 Base URL 和模型名。平台密钥不会被使用。` and offer settings.
- `startNextRun` and `openRunStream` attach `byokHeaders` only from `readActiveByokCredentials()`.
- Parse `code` from the continue JSON. For the same five codes, show `messageZh` and the text settings trigger. Do not add a replay button on the workbench. The interrupt copy `连接已中断。可点击「继续」重新生成。` does not offer settings.
- Auto-repair uses the same guard and the same error path.

## 5. API / interface contracts

No new endpoint. `GET /api/billing/config` and the project and continue routes stay as they are, including status codes and the JSON fields `code`, `messageZh`, and `replayAvailable`.

Session module exports:

```ts
export const MODEL_SOURCE_MODE_KEY = "atoms.model-source.mode";
export type ModelSourceMode = "platform" | "byok";
export function readModelSourceMode(): ModelSourceMode;
export function readActiveByokCredentials(): ByokCredentials | null;
export function selectPlatformDemo(): void;
export function selectVisitorKey(): void;
export function saveVisitorKey(draft: ByokDraft): ByokCredentials | null;
export function subscribeModelSource(listener: () => void): () => void;
```

Settings props:

```ts
export function ModelSourceSettings(props: {
  appearance?: "gear" | "text";
  label?: string;
}): JSX.Element;
```

`appearance` defaults to `"gear"`. The text label defaults to `打开设置`.

Denial sentences, codes unchanged:

```ts
export const DEMO_EXHAUSTED_MESSAGE_ZH =
  "免费演示已用完：每位访客只能使用平台模型完整生成 1 次。请到设置中填写你自己的 API Key，或改用演示回放。";

export const PLATFORM_BUDGET_MESSAGE_ZH =
  "平台演示的全站额度已用完，本次不会调用平台模型。请到设置中填写你自己的 API Key，或改用演示回放。";

export const BYOK_REQUIRED_MESSAGE_ZH =
  "继续生成和后续修改不能使用平台模型。请到设置中填写你自己的 API Key。";

export const TURNSTILE_REQUIRED_MESSAGE_ZH =
  "请先完成人机验证，再使用平台演示。你也可以到设置中改用自己的 API Key。";
```

`turnstile.ts` literals:

- Missing secret: `平台演示的人机验证未配置，已拒绝调用平台模型。请到设置中改用自己的 API Key。` (still matches `/不会|拒绝|自己的 API Key/`).
- Empty token: `请先完成人机验证，再使用平台演示。也可以到设置中改用自己的 API Key。`
- siteverify HTTP failure and unsuccessful payload: `人机验证没有通过，平台模型未被调用。请重试，或到设置中改用自己的 API Key。`
- Network throw: `人机验证暂时不可用，平台模型未被调用。请稍后重试，或到设置中改用自己的 API Key。`

`run-provider.ts` missing-key sentence:

`这次运行需要你的 API Key，但请求里没有带上。请到设置中重新填写密钥后再试。平台密钥不会被用作备用。`

Numeric caps stay `PLATFORM_DEMO_GENERATIONS` 1, daily token cap 50000, monthly token cap 300000, in both `src/lib/env.ts` defaults and `wrangler.jsonc`. Do not edit those files.

## 6. Error handling

| Failure | Visitor sees | Retry | Logged |
| --- | --- | --- | --- |
| BYOK selected, key missing or invalid, before request | The incomplete-key sentence and 打开设置. No request. | Edit the key in settings. The prompt is kept. | Nothing with the key. |
| `demo_exhausted`, `platform_budget` | API `messageZh`, 打开设置, and 改用演示回放 when `replayAvailable` | Settings, or the existing replay button | Server behavior unchanged. |
| `byok_required`, `byok_invalid`, `turnstile_required` | API `messageZh` and 打开设置. No new replay button. | Settings, or complete the widget on the platform path | Unchanged. |
| Visitor key rejected upstream | Existing public failure text. No platform retry. | Settings | Unchanged. `publicByokFailureMessage` is not edited. |
| Network error on create | `网络异常，请检查连接后重试` | Submit again | Unchanged. |
| sessionStorage throws | The in-memory dialog still closes. The next request sends a key only if `writeByokSession` succeeded. | Re-enter the key | No key in the console. |

## 7. Test strategy

Unit (`model-source-session.test.ts`, jsdom): default mode is platform; `byok` mode with a valid stored key returns it; mode `platform` ignores a directly planted `atoms.byok.session`; `selectPlatformDemo` removes that key; a 5-character key and a 513-character key do not persist; an 8-character Gemini key without spaces persists; `localStorage` has neither key.

Component (`model-source-settings.test.tsx`): gear opens the dialog; the product paragraph is exact; the document text does not include `清除 Cookie`, `重置 Cookie`, `设备号`, `x-atoms-byok`, or `D1`; choosing 平台演示 removes the session key; Escape closes and returns focus to the gear; the trigger is `type="button"`.

Component (`prompt-form.test.tsx`): no `模型来源`, no `input[name=model-access]`, no cookie helper. Mock `fetch`: config returns `{ turnstileSiteKey: "" }` unless a case sets a site key. Fresh session, non-empty prompt, click 开始生成, one `POST /api/projects` without `x-atoms-byok-key`, and no dialog was opened. With site key `site-key` and platform mode, `turnstile-slot` is present and the cookie paragraph is absent. After `selectVisitorKey()` and no key, submit does not call `POST` and shows 打开设置. A 402 body `{ code: "demo_exhausted", messageZh, replayAvailable: true }` shows the message, 打开设置, and 改用演示回放, and does not show the radios. `platform_budget` does the same. `byok_required` with `replayAvailable: false` shows 打开设置 and no 改用演示回放. Clear `sessionStorage` in `beforeEach`.

Component (`workbench-settings-entry.test.tsx`): render `WorkbenchClient` with stub `EventSource` and `fetch`. The header has a button named 设置, and it is not inside `follow-up-form`.

Component (`agent-timeline.test.tsx`, added cases): the timeline does not render `模型来源` or an API Key field. With a saved byok credential, follow-up `fetch` includes `x-atoms-byok-key`. A continue response `{ code: "byok_required", messageZh, replayAvailable: false }` shows that message and 打开设置, and still no radio. Stub `EventSource` as the existing tests do.

Policy: `pnpm exec vitest run src/lib/limits/demo-policy.test.ts src/lib/limits/turnstile.test.ts src/lib/llm/byok.test.ts src/lib/runs/access.test.ts` passes. Extend `demo-policy.test.ts` so each of the four exported sentences matches `/设置/` and does not match `/粘贴|重置 Cookie|清除 Cookie/`, while the existing code assertions stay. Extend `turnstile.test.ts` so the empty-token message matches `/设置/` and not `/粘贴/`.

E2E (`e2e/model-source-settings.spec.ts`, `LLM_PROVIDER=mock` from the Playwright config): the cases in `e2e-cases.json`. Do not leave BYOK selected when clicking 开始生成, because `decidePlatformAccess` treats any visitor key as BYOK before the mock branch. The happy path stays on platform demo.

No new visual baseline is adopted in this feature.

## 8. Run instructions

Working directory: the repository root.

```
pnpm dev
```

App URL: `http://127.0.0.1:3000`. Evaluation and Playwright use `http://127.0.0.1:3000` with `LLM_PROVIDER=mock`. Capture pages are listed in `pages.json`.

## 9. Risks and trade-offs

- A settings route would be easier to screenshot and would add a page the owner did not ask for. A dialog keeps the URL and matches “a settings page or panel”.
- Ignoring a leftover `atoms.byok.session` when the mode key is absent forces a fresh tab onto platform demo, including a tab that still has a key saved by the old form. That matches “default remains platform demo”. The visitor opens 设置 and enters the key again.
- Selecting BYOK and then submitting with an empty key must not `POST` as platform. The client blocks. The server still treats a request with no BYOK headers as platform, so the block is required.
- Copy changes are the only server edits. Decision order, caps, and header names stay so the current policy tests keep passing.
- `agent-timeline.tsx` is already over the 300-line standard. This feature removes the embedded key form. Do not split the timeline in this cut.

## 10. Overview deltas

- Product: model source is a settings panel. The generate form no longer offers the two radios. Default remains the platform demo.
- Technical: `atoms.model-source.mode` sits beside `atoms.byok.session` in sessionStorage. Server billing modules keep their behavior; denial sentences point at 设置.
