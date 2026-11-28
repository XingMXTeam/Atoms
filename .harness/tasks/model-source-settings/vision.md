# Quality vision — model-source-settings

## 1. Positioning
Level: polished
Priorities: correctness and security of the visitor key > a clean generate surface > visual fit with the current Atoms chrome > motion or novelty
Tone: calm Chinese product copy; the prompt asks for an app idea; billing configuration stays in settings

## 2. References
REF-1: The current Atoms Studio home prompt card (`src/app/page.tsx`, `src/components/home/prompt-form.tsx`) and workbench header (`src/components/workbench/workbench-client.tsx`), the same language as `.harness/tasks/polish/vision.md` — worth copying: centered Chinese title, one rounded-2xl prompt field, one zinc pill primary button, quiet zinc secondary text, and rounded-full header actions. The 设置 control and the settings dialog reuse that chrome and do not invent a second visual system. Applies to: L3/L4
ANTI-1: The live generate form the owner rejected at https://atoms.maoxunxing.com/ (screenshot `/home/ubuntu/.cursor/projects/agent-repos-Atoms/assets/e31c10951ed1e8e35d8c8273a160737417c2517acb00c4a9aff06cf5f1cf97ee.png`) — avoid a “模型来源” fieldset of two large bordered radios (“平台演示”, “使用我的 API Key”) plus the helper about demo quota, clearing cookies, a new device id, and human verification, sitting inside the prompt or the workbench follow-up. Also avoid implementation-leak copy (cookie clearing, device ids, header names, D1, database, logs) on the generate surface. Applies to: L3/L4

## 3. Design intent
- Visual: Chinese UI; zinc borders, `rounded-2xl` prompt and dialog, `rounded-full` 设置 and 开始生成; light and dark via the existing `dark:` classes; no new hex colors and no new font.
- Density: balanced. The home prompt group is the textarea, an optional quiet verification widget, and one button row. Settings is a separate dialog, not a second card stacked under the prompt.
- Interaction model: the first generation is type-then-submit. Settings is one explicit click, edit, then dismiss. Denied generations keep the typed prompt and offer 打开设置.
- Key screens:
  | Screen | User goal | Target state | Anchor |
  | home-generate | start a demo without configuration | title, 设置 outside the form, textarea, one 开始生成, no radios, no cookie helper | REF-1 |
  | settings-panel | choose platform or own key | dialog “模型设置”, two choices, key fields only for own key, the product paragraph, URL unchanged | REF-1 |
  | workbench | continue or follow up | header 设置 next to 返回首页; follow-up has no key fields; a missing key offers 打开设置 | REF-1 |

## 4. Red lines
RL-1: The home prompt form and the workbench follow-up area never show the “模型来源” radios or the cookie, device-id, or verification helper paragraph. (check: screenshot)
RL-2: A visitor API key is never written outside sessionStorage, a failed visitor key never falls back to platform keys, and wrangler caps and secrets are not changed. (check: command)
RL-3: A visitor can submit 开始生成 on the default platform path without opening settings, and the platform path still requires Turnstile when a site key is configured. (check: dom)

## 5. Rubric mapping
- Design intent and REF-1 map to L3 and L4 judge items for the home prompt, the dialog, and the workbench header.
- ANTI-1 maps to a pitfall that fails when the rejected radios or helper return to the generate or follow-up surface.
- RL-1 maps to a screenshot pitfall. RL-2 maps to command checks on session storage, fallback tests, and wrangler caps. RL-3 maps to a DOM pitfall: default submit does not require settings, and the platform path still mounts the verification slot when a site key exists.
