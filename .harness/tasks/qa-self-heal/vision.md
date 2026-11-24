# Quality vision — qa-self-heal

## 1. Positioning

Atoms Studio presents generation as a verifiable workflow: a probe observes the generated preview, QA reports criterion-level outcomes, and bounded repairs remain visible to the user. The interface is Chinese, calm, and consistent with the existing workbench. Optimize for trustworthy status, clear recovery, and an auditable connection between a failure and the fix round that handled it.

## 2. References

REF-1: The existing generate-loop workbench at `/projects/[projectId]` is the positive reference: two-pane workspace, Chinese agent timeline, readable expandable agent cards, and a stable preview. Extend its timeline with QA and fix events and show one consistent score badge on the workbench and home project card. Keep status before details and preserve the existing restrained zinc visual language.

ANTI-1: Avoid an opaque “AI fixed it” experience: no hidden repair attempts, untraceable score, endless retrying, or English-only QA labels. Such behavior makes the result impossible to inspect and obscures the repair limit.

## 3. Red lines

RL-1: The preview probe accepts messages from an untrusted or unexpected source, or the sandbox is granted `allow-same-origin`. The probe boundary must validate message origin/source and payload shape while keeping generated code isolated. (check: dom)

RL-2: Any run performs more than three fix rounds, or an exhausted run loses its final score/version instead of showing the capped state. (check: command)

RL-3: A completed workbench presents a score without an inspectable QA verdict/fix history, or the timeline fails to show which round resolved or exhausted a failed criterion. (check: screenshot)

## 4. Interaction and key screens

- Probe lifecycle: preview rebuild → validated probe report → QA verdicts and score → zero to three visible fix rounds → final score and terminal state.
- Workbench `/projects/[projectId]`: show live probe/verdict/fix/error events in sequence; expand the QA card to inspect per-AC verdict, reason, and resolution/exhaustion round; keep the score badge visible after completion.
- Home `/`: show the persisted score on the completed project card after returning from the workbench.
- Failure states explain the issue in Chinese. Exhaustion uses the specified clear state 「已达修复上限」 and retains the last version and score.
- E2E journeys create/open a project through the UI or API in the same deviceId browser context; do not capture an unauthenticated placeholder workbench route.

## 5. Rubric mapping

- REQ-1/REQ-3 probe integrity and capped loop are judged against RL-1 and RL-2 and checked deterministically with unit/E2E commands.
- REQ-2/REQ-4/REQ-6 visible criterion verdicts, ordered repair history, and legible timeline are judged against REF-1 and RL-3.
- REQ-5 consistent persisted badges across workbench and project cards are judged against REF-1.
- REQ-7 is exercised by the blocking mock negative E2E journey; the visible recovery and score are judged against RL-3.
