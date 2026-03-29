---
description: "Use when creating, modifying, or deleting any project file. Enforces changelog and reasoning documentation for every change. Triggers on all file operations."
applyTo: "**"
---
# Change Tracking Instructions

## On Every File Change
After creating or modifying ANY file, you MUST append to `CHANGELOG.md`:

```markdown
### [YYYY-MM-DDTHH:MM] — <short title>
- **Files**: `path/to/file1.js`, `path/to/file2.js`
- **Change**: <1-2 sentence description of what changed and why>
```

## On Every Design Decision
Before implementing any architectural choice, append to `REASONING.md`:

```markdown
### <Decision Title>
- **Decision**: <what was decided>
- **Alternatives**: <what else was considered>
- **Rationale**: <why this choice>
```

## On Notable AI-Assisted Development
When a prompt or AI workflow produces a good result, append to `PROMPTS.md`:

```markdown
### <What was built>
- **Tool**: GitHub Copilot / AI Toolkit / etc.
- **Prompt**: <the prompt used>
- **Result**: <what it produced>
- **Tip**: <what made it work well>
```
