# Quality vision — generate-loop

## 1. Positioning

Level: polished
Priorities: correctness of generate→preview → sandbox/China reachability → clear Chinese agent feedback → calm layout → performance
Tone: a professional Chinese product workbench; multi-agent progress is visible and trustworthy, never noisy demo-candy.

## 2. References

REF-1: Calm Chinese generate workbench — worth copying: home with centered prompt, ≥4 example cards, 「我的项目」 grid; workbench with left Agent timeline (Planner/Architect/Engineer status + elapsed + expandable payload in Chinese) and right 预览/代码 tabs with a non-blank preview — applies to: L3/L4
ANTI-1: CDN-dependent preview / insecure sandbox / English-only agent chrome — avoid: esm.sh/unpkg/jsdelivr/Tailwind CDN fetches at preview runtime, iframe `sandbox` missing or including `allow-same-origin`, English-only timeline labels, WebContainer framing — applies to: L2/L3

## 3. Design intent

- Visual: restrained zinc neutrals inherited from foundation; clear two-pane workbench; timeline cards as the primary progress metaphor
- Density: home is airy; workbench is information-dense but scannable (status before payload)
- Interaction model: submit → navigate → stream timeline updates → preview auto-builds when Engineer `files[]` arrive; interrupt shows 「继续」 rather than a silent stall
- Key screens:

| Screen | User goal | Target state | Anchor |
|---|---|---|---|
| home `/` | start a generation | prompt + ≥4 example cards + 「我的项目」 | REF-1 |
| workbench `/projects/[projectId]` | watch agents and see the app | Chinese timeline complete; 预览 non-blank; 代码 shows files | REF-1 |

## 4. Red lines

RL-1: Preview iframe is missing `sandbox` or its sandbox includes `allow-same-origin` (generated code must not read host cookies). (check: dom)
RL-2: Preview or app runtime depends on external CDNs (esm.sh, unpkg, jsdelivr, Tailwind CDN, Google Fonts). (check: command)
RL-3: After a successful mock generate, the Agent timeline lacks Chinese Planner/Architect/Engineer progress or the 预览 pane is blank. (check: screenshot)

## 5. Rubric mapping

- Design intent / REF-1 → L3/L4 judges on home + workbench captures
- Interaction (stream feedback, 「继续」, tab switch) → L4 judge items
- RL-1 → pitfall + essential DOM/command checks on iframe sandbox
- RL-2 → pitfall grep/command for CDN URLs and vendor-from-origin assets
- RL-3 → essential workbench judge + e2e core journey
- ANTI-1 → pitfalls against CDN / insecure sandbox / English-only chrome
