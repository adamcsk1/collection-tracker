# Collection Tracker

OpenCode should use `.opencode/project-instructions.md` and `.opencode/review-instructions.md` as the source of truth for project rules and review rules.

The GitHub Copilot files in `.github/` are bridge files only. They point Copilot at the `.opencode/` source-of-truth files and should not contain duplicated long-form rules.

Project-specific OpenCode agents live in `.opencode/agents/`:

- `coder` - general implementation work
- `architect` - planning, architecture, and Nx boundary decisions
- `code-reviewer` - read-only change review
- `testing` - Vitest and Cypress guidance
- `i18n-a11y` - internationalisation and accessibility work
- `commit` - conventional commit preparation

Always read relevant source files before editing. Prefer small, direct changes that match existing patterns.
