# Quality vision — foundation

## 1. Positioning

Level: polished
Priorities: correctness > security/China reachability > clear Chinese system messages > visual calm > performance
Tone: a calm, professional Chinese product shell; information first, no demo-candy chrome.

## 2. References

REF-1: Atoms Studio Chinese placeholder home — worth copying: brand eyebrow 「Atoms Studio」, primary H1 「可验证的 AI 应用生成」, centered max-width column, zinc/neutral tokens, generous vertical rhythm, `lang="zh-CN"` — applies to: L3/L4
ANTI-1: Pixel-copy Atoms / busy AI marketing landings — avoid: English-first hero, gradient mesh noise, Google Fonts or Tailwind CDN, cluttered feature grids on the foundation shell — applies to: L3

## 3. Design intent

- Visual: restrained zinc neutrals, single clear H1 hierarchy, no decorative illustrations in F1
- Density: airy (placeholder home only)
- Interaction model: first visit silently mints `deviceId`; over-cap / replay surfaces a clear Chinese system label (「演示回放」) rather than a silent mode switch
- Key screens:

| Screen | User goal | Target state | Anchor |
|---|---|---|---|
| home `/` | recognize the product | Chinese H1 visible, calm centered layout, no CDN fonts | REF-1 |

## 4. Red lines

RL-1: Home page missing the Chinese product title 「可验证的 AI 应用生成」 or presenting an English-only product name as the primary heading. (check: screenshot)
RL-2: App source or runtime config introduces external CDN dependencies (esm.sh, unpkg, jsdelivr, Tailwind CDN, Google Fonts). (check: command)
RL-3: Real `GEMINI_API_KEY` or other secrets committed to the repository. (check: command)

## 5. Rubric mapping

- Design intent / REF-1 → L3 judge on home capture
- Interaction (replay / over-cap Chinese copy) → L4 judge items
- RL-1 → pitfall + essential home judge
- RL-2 / RL-3 → pitfall `grep`/`command` items
- ANTI-1 → pitfall against CDN / English-only primary chrome
