# Clarification answers — model-source-settings

Quoted from the task's user request, or from `docs/plan/decisions.md` where that file is already the confirmed decision. The settings-shape paragraph is the recorded assumption the task asked to keep, marked as such. Date of the written contract: 2026-11-28.

## 1. Goal and success

> Move Atoms model-source / BYOK UI out of the main generate form and into a dedicated settings/config place.

> TT said this must not be shown here — it does not meet the product design. By default there should be a configuration place for it.

> Done when: the generate form no longer shows the “模型来源” radios or the cookie/verification helper; settings is the place to choose platform vs BYOK and enter keys; default remains platform demo; existing policy tests still pass; a PR is open for TT to review.

## 2. Users and roles

> Default path remains platform demo (1 complete generation per visitor, no follow-up on platform keys when LLM_PROVIDER=gemini). Visitors can generate without first opening settings.

From `docs/plan/decisions.md`: "no sign-up" and "Cloudflare **D1** (+ Drizzle) keyed by anonymous deviceId cookie". No new role is introduced.

## 3. Main path

> The generate / prompt area stays clean. Do not show those radios or the cookie/Turnstile/device-id helper text there.

> Model source (platform vs BYOK) and BYOK key fields live in a dedicated settings/config entry that fits the existing Atoms UI (for example a header settings/gear control and a settings page or panel). Keep the explanation there, written as product copy, not implementation leakage.

**Recorded assumption (task instruction, not a second product policy):** "There is no app chrome header today. Prefer a small gear/settings control on the home page (near the title, not inside the prompt form) and the same entry on the workbench header, opening one shared settings panel (dialog) rather than a new marketing page. The panel holds model source + key fields + the product explanation. Remove ModelAccessFields from the home prompt form AND from the workbench follow-up area; follow-up/continue reads the session key and, when a key is required, links to the same settings panel instead of embedding the radios."

## 4. Error and edge paths

> If the platform demo is exhausted or the user needs their own key, the generate flow can point them to that settings place. Do not leave the dual-choice always visible on the form.

> When demo is exhausted / BYOK required / platform budget, the error returned by the API can stay, but the form should point the visitor to settings (a button or link that opens the panel) rather than rendering the dual radios. Replay fallback button behavior that already exists may stay.

> a failed user key must never fall back to platform keys.

## 5. Data

> BYOK stays request-scoped (x-atoms-byok-* headers, browser sessionStorage only, never written to D1/cookies/logs)

> session mode persistence in sessionStorage alongside the existing BYOK session

> The key is used only for that request and is not saved on the server.

## 6. Integrations

> Keep existing billing/policy behavior unchanged: Turnstile still required on the platform path, caps unchanged, BYOK stays request-scoped (x-atoms-byok-* headers, browser sessionStorage only, never written to D1/cookies/logs), and a failed user key must never fall back to platform keys.

> Do not change server policy, caps, header names, or persistence rules except copy that tells the user to open settings instead of "paste your key here" if that string is user-visible on the form. Prefer updating the user-visible Chinese denial strings so they point at 设置 rather than telling the user to paste a key into the form, while keeping the same denial codes and tests that assert codes. If a test asserts the exact Chinese sentence, update the test with the new product sentence. Do not change numeric caps.

> Turnstile widget stays on the platform path but should not be wrapped in the rejected helper paragraph; if it must appear for the platform path, keep it quiet (the widget itself) and do not add the cookie/device-id paragraph beside the prompt.

From `docs/plan/decisions.md` D5: "Gemini (paid key), server-side only via REST streaming". D11: "Provider modes `gemini` / `mock` (deterministic, for e2e) / `replay`".

## 7. Non-functional limits

> fits the existing Atoms UI

> Chinese UI. No new framework or dependency.

> Quality level: B polished, matching the existing Atoms Studio visual language (see polish vision).

## 8. Non-goals

> Do not merge and do not deploy.

> Do not merge, deploy, rotate secrets, or change wrangler production vars/caps.

> Non-goal: merge, deploy, secret rotation, wrangler var/cap edits.

> Keep server billing modules behavior-identical.

## 9. Acceptance

> Done when: the generate form no longer shows the “模型来源” radios or the cookie/verification helper; settings is the place to choose platform vs BYOK and enter keys; default remains platform demo; existing policy tests still pass; a PR is open for TT to review.

> existing policy tests still pass

## 10. Budgets and stop policy

> Budgets: keep harness.config.json as-is (maxMacroCycles 5, requiredStablePasses 2, gateCommands typecheck/lint/test/build).

## 11. Quality

> Quality level: B polished, matching the existing Atoms Studio visual language (see polish vision). Rank: correctness and security of the key first, then a clean generate surface, then visual fit. Reference: the current home prompt card and workbench chrome. Anti-reference: the screenshot's large dual radios and cookie/device-id/Turnstile helper sitting inside the generate form. Red lines: never show implementation leakage (cookie clearing, device ids, header names, D1) in the generate form; never persist the visitor key outside sessionStorage; never fall back from a failed visitor key to platform keys; never change wrangler caps/secrets; Turnstile still gates the platform path; visitors can generate on the default platform path without opening settings first.

Product copy the settings panel may use:

> one free platform generation, then the visitor's own key pays for real generation and later edits; the key is used only for that request and is not saved on the server; a key that fails is not replaced by the platform key. Do NOT mention cookies, device ids, clearing cookies, Turnstile internals, or header names in the generate form. A short product sentence in settings is OK if it does not read like an implementation note.

## 12. Stack

> Stack: the repo's existing Next.js App Router + TypeScript + Tailwind. The user said it must fit the existing Atoms UI and must not change billing policy.

From `docs/plan/decisions.md` D3: "Next.js (App Router) + TypeScript". D8: "Chinese UI". D10: no runtime external CDNs. No new framework or dependency.
