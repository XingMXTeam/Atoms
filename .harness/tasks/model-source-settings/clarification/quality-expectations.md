# Quality expectations — model-source-settings

Quoted from the task contract (2026-11-28).

- **Level:** B polished, matching the existing Atoms Studio visual language (see `.harness/tasks/polish/vision.md`).
- **Rank:** correctness and security of the key first, then a clean generate surface, then visual fit.
- **Reference:** the current home prompt card and workbench chrome.
- **Anti-reference:** the screenshot's large dual radios and cookie/device-id/Turnstile helper sitting inside the generate form. Screenshot file: `/home/ubuntu/.cursor/projects/agent-repos-Atoms/assets/e31c10951ed1e8e35d8c8273a160737417c2517acb00c4a9aff06cf5f1cf97ee.png`. The live page the owner rejected is https://atoms.maoxunxing.com/.
- **Red lines:**
  - Never show implementation leakage (cookie clearing, device ids, header names, D1) in the generate form.
  - Never persist the visitor key outside sessionStorage.
  - Never fall back from a failed visitor key to platform keys.
  - Never change wrangler caps or secrets.
  - Turnstile still gates the platform path.
  - Visitors can generate on the default platform path without opening settings first.
- **Tone:** Chinese product copy. The settings explanation may say that one free platform generation is included, later real generation and edits are paid by the visitor's own key, the key is used only for that request and is not saved on the server, and a failed key is not replaced by the platform key. It must not read like an implementation note.
