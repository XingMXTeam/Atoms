# Evaluation — foundation, cycle 1 (confirm)
Tools: Playwright 1.65.1; capture run c1-confirm (status pass, 1 page); fh verify green at HEAD ca82e23

## E2E cases
| case | category | blocking | result | evidence |
| --- | --- | --- | --- | --- |
| E2E-1 | core | yes | PASS | e2e-smoke.txt — heading 可验证的 AI 应用生成 visible; title includes Atoms Studio |
| E2E-2 | core | yes | PASS | e2e-smoke.txt — deviceId HttpOnly cookie minted on first visit |
| E2E-3 | negative | yes | PASS | rb12-rb14-probe.json — over DEVICE_DAILY_RUN_LIMIT → replay + 演示回放; refuse path Chinese |
| E2E-4 | negative | yes | PASS | rb12-rb14-probe.json — mock completion meta.mode=mock, deterministic text |
| E2E-5 | boundary | no | PASS | rb12-rb14-probe.json — over DAILY_TOKEN_CAP → replay (not gemini) |
| E2E-6 | persistence | yes | PASS | e2e-smoke.txt — same deviceId after reload |
| E2E-7 | uiJourney | no | PASS | e2e7-ui.json — main landmark, H1 largest, no horizontal overflow at 1280 |

Notes: E2E-3/4/5 have no dedicated Playwright route in F1; confirmed via Vitest helper probe that exercises the same decision/provider contracts the cases name. Smoke Playwright covers E2E-1/2/6.

## Rubric (judge items)
| id | layer | level | score | reason | artifacts |
| --- | --- | --- | --- | --- | --- |
| RB-2 | L3-ui | essential | 1 | Home matches REF-1: eyebrow, Chinese H1, centered zinc column, zh-CN | c1-confirm/home.png, home-metrics.json |
| RB-3 | L3-ui | pitfall | 1 | RL-1 absent — primary H1 is Chinese product title | c1-confirm/home.png, e2e-smoke.txt |
| RB-12 | L4-interaction | essential | 1 | Replay meta/decision label is explicit 演示回放 | rb12-rb14-probe.json |
| RB-14 | L4-interaction | important | 1 | Over-cap → 演示回放 or Chinese refuse; never silent English-only | rb12-rb14-probe.json |
| RB-24 | L4-interaction | important | 1 | ANTI-1 absent — no marketing mesh/grid/English-first hero | c1-confirm/home.png, home-metrics.json |

## Comparison with references
| dimension | REF-n / ANTI-n | ours | gap | fix | rubric id |
| --- | --- | --- | --- | --- | --- |
| Brand + H1 | REF-1 | Atoms Studio eyebrow + 可验证的 AI 应用生成 | none | — | RB-2 |
| Layout | REF-1 | centered max-w column, airy vertical rhythm | none | — | RB-2 |
| Locale | REF-1 | lang=zh-CN, Chinese primary chrome | none | — | RB-2, RB-3 |
| Marketing anti | ANTI-1 | solid white, no gradient/grid/CDN fonts | none | — | RB-24 |
| Replay label | REF-1 interaction | meta.label 演示回放 on soft-cap/fallback | no browser badge yet (F1 non-goal) | later feature UI | RB-12 |

## Exploratory findings
| id | probe | result | severity | add as E2E case? | evidence |
| --- | --- | --- | --- | --- | --- |
| X-1 | rapid reloads ×5 | H1 stable every time (~530ms) | info | no | e2e7-ui.json |
| X-2 | two tabs same origin | single shared deviceId cookie; both show Chinese H1 | info | optional persistence case | e2e7-ui.json |
| X-3 | back navigation to home | H1 restored after goBack from about:blank | info | no | e2e7-ui.json |
| X-4 | slow network (+200ms/route) | H1 still visible after delayed reload | info | no | e2e7-ui.json |

## Findings
| heuristic | artifact | severity | problem | recommendation | rubric id |
| --- | --- | --- | --- | --- | --- |
| — | — | — | none blocking or major | — | — |
| H-UX-2.3 | rb12-rb14-probe.json | info | 演示回放 is meta-only in F1 (no visible run chrome) | keep as F2 timeline badge acceptance | RB-12 |

## Rubric refinement suggestions
| RS (assigned by kernel) | type | item | problem | suggestion |
| --- | --- | --- | --- | --- |
| (pending) | refine | RB-12 | F1 has no browser-visible run chrome | Split meta-label essential now vs later UI badge item |
| (pending) | add-verification | RB-14 | E2E-3/5 not wired as Playwright | Add HTTP/fixture e2e that seeds usage at cap |
