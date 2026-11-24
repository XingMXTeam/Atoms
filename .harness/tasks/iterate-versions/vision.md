# Quality vision — iterate-versions

## Reference

REF-1: Extend the existing Atoms Studio workbench at `/projects/[projectId]`: use its calm Chinese-language card and tab styling, clear QA score badge, and visible preview/code relationship. The 版本 timeline should make version order, summary, score, and the rollback action easy to scan without competing with the preview.

## Anti-reference

ANTI-1: Avoid a generic dense admin table or a destructive “replace history” workflow. A rollback should feel like selecting a safe snapshot, with the historical versions still visible and the restored preview/code immediately understandable.

## Red lines

RL-1: Rollback must never delete or rewrite historical versions; the selected snapshot becomes current and the preview and code both show that same snapshot. (check: dom)

RL-2: A public share view must not expose owner mutations or depend on an owner `deviceId` cookie; visitor controls communicate read-only behavior. (check: command)

RL-3: Version history and seeded project cards must not render as blank, ambiguous rows: every version includes its summary and QA score, and first paint for a fresh device includes at least two completed examples with scores. (check: screenshot)
