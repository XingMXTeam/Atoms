# Claude Code host setup

Register the session-start hook in `.claude/settings.json`:

```json
{
  "hooks": {
    "SessionStart": [{ "hooks": [{ "type": "command", "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/session-start.sh" }] }]
  }
}
```

The `harness` skill is already installed at `.claude/skills/harness/SKILL.md`, the three role agents (planner, developer, evaluator) at `.claude/agents/`, and the bundled skills pack (the authoring chain clarify-requirements → write-acceptance-criteria, implement-task, e2e-testing, …) alongside them. Manage the pack with `harness skills list|install`.

The main session is the orchestrator: it runs `harness next`, dispatches the role agent the action names (`harness packet <feature>` prints that agent's input), and runs the kernel commands. It does not do role work itself.
