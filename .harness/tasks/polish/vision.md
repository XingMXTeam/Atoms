# Quality vision — polish

## 1. Positioning
Level: production-polished
Priorities: correctness of UX states > accessibility & interaction > visual craft > performance > delivery docs
Tone: calm Chinese work tool; information first; restrained motion; trustworthy under mainland-China networks

## 2. References
REF-1: Existing Atoms Studio home (`/`), workbench (`/projects/[projectId]`), and share (`/share/[shareSlug]`) — worth copying: quiet zinc card surfaces, Chinese labels, tab chrome, QA score badge language, and clear preview/code relationship — refined with focus rings, complete empty/error/follow-up states, and micro-interactions that still feel calm. Applies to: L3/L4

ANTI-1: Marketing-site flash — avoid bouncing CTAs, decorative motion that ignores `prefers-reduced-motion`, clipped 我的项目 titles, unlabeled iframe/tabs, and any runtime dependency on external font or JS CDNs that flash layout or fail behind the GFW. Applies to: L3/L4

## 3. Design intent
- Visual: Chinese UI; light/dark via `prefers-color-scheme`; system font stack only; card gaps and typography stay legible at 1280×800 and 375×812 with zero clipped project-card text; code pane long lines remain reachable via horizontal scroll or wrap toggle.
- Density: balanced workbench — left rail timeline + follow-up, right panels for 预览/代码/版本.
- Interaction model: direct manipulation with immediate pending/disabled feedback; tab indicator/panel transitions and timeline expand polish are subtle and cancel under reduced-motion.
- Key screens:
  | Screen | User goal | Target state | Anchor |
  | home | scan projects | seeded cards fully readable, no overflow | REF-1 |
  | workbench | iterate + inspect | follow-up input, state banners, preview width toggle, focus-visible rings | REF-1 |
  | share | read-only inspect | same visual system, no mutation affordances | REF-1 |

## 4. Red lines
RL-1: 我的项目 card titles/metadata must never clip or overflow the page horizontally at 1280×800 or 375×812; code pane long lines must stay reachable. (check: screenshot)

RL-2: With `prefers-reduced-motion: reduce`, tab/timeline/running-pulse animations must not continue; decorative motion is fully suppressed. (check: dom)

RL-3: Runtime network activity on home, workbench, and share must never request `esm.sh`, `unpkg`, `jsdelivr`, `cdn.tailwindcss.com`, `fonts.googleapis.com`, or `fonts.gstatic.com`. (check: command)

RL-4: Delivery docs (`README.md`, `docs/DELIVERY.md`, `docs/writeup.md`) must never contain secret keys or confidential hiring-brief text. (check: command)

## 5. Rubric mapping
- Design intent → L3 items; interaction/a11y model → L4 items
- RL-1..RL-4 → pitfall (or essential judge) items citing those anchors
- REF-1 → comparison baseline in every full evaluation
