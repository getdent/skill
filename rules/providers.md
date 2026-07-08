IF editing `providers.json`, `scripts/**`, or `cli/**`:
### reconcile providers through the provider list
Read provider names, labels, modes, aliases, and harness folders from `providers.json` so the installer and build pipeline expose the same provider set.

### keep the codex harness at `.agents`
`.agents/skills` is Codex's official skills directory (USER scope `$HOME/.agents/skills`, repo scope `.agents/skills` — https://developers.openai.com/codex/skills) and the emerging cross-provider standard Gemini shares. `~/.codex` holds only config (`config.toml`, `AGENTS.md`).
Never: "correct" the codex harness to `~/.codex/skills` — blog posts claiming that path contradict the official docs.
