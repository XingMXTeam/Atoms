# Clarification answers — polish

Source: product-owner pre-approval of the imported PRD and `docs/plan/decisions.md` (2026-11-23 / 2026-11-24). Owner unavailable overnight; gaps closed from those authoritative decisions and recorded as assumptions.

1. Yes — keep imported `prd.md` unchanged; REQ-1..REQ-7 numbering is complete.
2. Production-polished (D8): calm, high-craft Chinese UI; restrained micro-interactions; accessibility, performance, and China reachability are in scope. Priority: correctness of UX states > accessibility/interaction > visual craft > performance > docs.
3. Keep REQ-5 in scope for F5; cut order only applies if budget forces later cuts, not as a default omission.
4. Workbench left rail: Chinese follow-up prompt + send control (PRD REQ-2); disabled while a run is active and on read-only share.
5. Polish `README.md`; add `docs/DELIVERY.md` with Chinese section headings 思路与取舍 / 完成度 / 后续规划 / Cloudflare 部署步骤; `docs/writeup.md` as symlink or matching write-up. Paraphrase only; never paste brief text or secrets.
6. Scripted verification (Playwright network audit and/or unit/command checks) asserting zero runtime requests to the listed CDNs across home, workbench, and share; document `atoms.maoxunxing.com` + `aws:us-east-1` placement.
