---
name: commit-attribution
description: Git commit and PR attribution guidelines for this project
metadata:
  type: reference
---

**Commit messages** should end with:
```
Co-Authored-By: Claude Code <noreply@anthropic.com>
```

**Pull request descriptions** should end with:
```
🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

These lines ensure proper attribution for automated contributions.

Why: Aligns with the project's policy for tracking AI-generated changes and provides clear credit.

How to apply: When creating a commit (`git commit -m "..."`) or writing a PR description, append the respective lines exactly as shown.

[[git-workflow]]
