# Model source settings

## 1. Problem

On the live generate form, visitors see a “模型来源” block: two large radios, “平台演示” and “使用我的 API Key”, plus helper text about demo quota, cookies, device ids, and verification. The owner rejected that block. It does not meet the product design. The choice belongs in a configuration place. The prompt area should stay a place to describe an app and start generation.

## 2. Users and scenarios

- A first-time visitor wants to try Atoms and should be able to generate on the platform demo without opening settings.
- A visitor whose one platform generation is used up, or who wants later edits, needs their own API key and a clear place to enter it.
- The same visitor continues in the workbench. Follow-up and 继续 use the choice they already saved, and send them to that same place when a key is required.
- No sign-up. The visitor is still the anonymous device the product already uses. This feature adds no new role.

## 3. User stories

- As a visitor, I want the generate box to ask only for my idea, so that billing choices do not sit in the way of the first try.
- As a visitor, I want one settings place to choose platform demo or my own API key, so that I can configure that before or after I write a prompt.
- As a visitor who has used the free generation, I want the form to point me to settings, so that I know where to enter a key without the two radios returning to the prompt.
- As a visitor using my own key, I want a failed key to stay failed, so that Atoms does not silently spend a platform key instead.

## 4. Requirements

- **REQ-1** The generate prompt area does not show the “模型来源” radios (“平台演示” and “使用我的 API Key”) or the cookie, device-id, or verification helper text.
- **REQ-2** The default model source is platform demo, and a visitor can start a generation without opening settings first.
- **REQ-3** Platform versus visitor API key, and the key fields, live in one settings panel opened from a 设置 control beside the home title and from the workbench header.
- **REQ-4** The settings panel explains, in product copy, that each visitor gets one free platform generation, later real generation and edits are paid by the visitor's own API key, the key is used only for that request and is not saved on the server, and a failed key is not replaced by the platform key.
- **REQ-5** When the platform demo is exhausted, the platform budget is exhausted, or a visitor key is required or invalid, the generate form shows the API message and a control that opens settings, and it does not render the dual radios; the existing 改用演示回放 action stays when replay is available.
- **REQ-6** Follow-up and 继续 read the stored session key, send it only for that request, and when a key is required they point to the same settings panel instead of embedding the model-source radios or key fields.
- **REQ-7** Billing policy stays the same: Turnstile still gates the platform path, numeric caps stay the same, denial codes stay the same, the visitor key stays request-scoped in sessionStorage and the existing request headers, a failed visitor key never falls back to platform keys, and wrangler caps and secrets are not changed.

## 5. Non-functional requirements

- Chinese UI. No new framework, library, or font.
- The 设置 control is at least 44 by 44 CSS pixels and shows a visible focus ring.
- The settings panel is usable at 1280×800 and at 375×812: primary actions are not clipped; the panel scrolls inside itself when the key fields make it tall.
- Choosing a source and closing the panel does not navigate and does not add a network request.
- Saving settings is local to the tab. Reload keeps the choice and a valid key for that tab only. A new tab starts on platform demo.
- The platform path still shows the existing human-verification widget when a site key is configured, with no extra helper paragraph beside the prompt.

## 6. What good looks like

**Home, settings closed.** The title block remains centered: eyebrow “Atoms Studio”, heading “可验证的 AI 应用生成”, and the one-sentence subtitle. A 设置 control with a small gear sits on the right, above that title, outside the prompt card. The card is the existing rounded field, placeholder “描述你想生成的应用…”, and one dark pill “开始生成”. There is no two-column radio group and no paragraph about clearing cookies or device ids. When the platform path needs verification, only the verification widget appears between the field and the button row.

**Settings open.** A dialog titled “模型设置” covers the page without changing the URL. It contains the two choices, the key fields when “使用我的 API Key” is selected, and this paragraph: “每位访客可以免费使用平台演示完整生成 1 次。之后的真实生成和后续修改由你自己的 API Key 付费。密钥只用于当次请求，不会保存在服务器上。密钥调用失败时，不会改用平台密钥。” The surface uses the same white or zinc card, border, and radius as the prompt card. Escape, the close control, or the backdrop closes it and returns focus to the control that opened it.

**Denied generation.** The red alert shows the API sentence. Beside or under it is a text button “打开设置” that opens the same dialog. If the API offers replay, “改用演示回放” remains. The radios do not appear.

**Workbench.** The header row keeps the project title and “返回首页”, and adds the same 设置 control. The follow-up box is only “后续需求” and “发送后续需求”. It does not contain key fields. If continue or follow-up needs a key, the error and “打开设置” appear there.

## 7. Non-goals

- Merging, deploying, rotating secrets, or editing wrangler variables, caps, or secrets.
- Changing numeric caps, denial codes, header names, or where the server stores data.
- A new marketing or docs page for settings.
- A new dependency, icon package, or dialog library.
- Rewriting the agent timeline, preview, or billing decision order beyond the user-visible sentences that now point at 设置.
- Removing the human-verification widget from the platform path.

## 8. Success measures

- A visitor can submit a prompt on a fresh tab without opening settings, and the prompt surface contains neither the radios nor the cookie helper.
- Opening 设置 on the home page and on the workbench shows the same choice and the product paragraph above.
- After the demo or a key is refused, the form offers 打开设置 and does not reveal the radios.
- Existing policy tests still pass: same denial codes, same caps, Turnstile still required on the platform path, and a failed visitor key does not fall back to platform keys.
- A pull request is open for TT to review. It is not merged and not deployed.

## 9. Overview deltas

- Product: model source (platform demo vs the visitor's own API key) is configured in a settings panel. The generate form no longer presents that choice. The default remains one platform demo generation.
- Technical: the tab stores the selected source beside the existing session key. Server billing rules, caps, and header names are unchanged. Denial sentences that told the visitor to paste a key into the form now point at 设置.
