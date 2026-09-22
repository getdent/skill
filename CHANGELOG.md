# Changelog

## 0.3.0

- `dent update` no longer fails with `EISDIR` when it replaces an old full skill copy (one with `references/`) with the pointer; the emptied directories are removed.
- `dent skill` asks npm once a day and, when the CLI is behind, opens with `Dent CLI vX is behind vY. Run: dent update`; the skill's session step reads that line and runs `dent update` before any Dent write.
- `dent check` is one compare: the CLI against npm, and every installed pointer's files on disk against the package. `dent update` upgrades the CLI through npm and rewrites the pointers that exist; it never adds one beside a plugin install. The four-owner machinery and `dent plugin-path` are gone.
- The skill installs the CLI once with `npm install -g @getdent/skill` and falls back to `npx @getdent/skill@latest <command>` only when that install is refused.
- The Claude Code marketplace entry is a `github` source on `getdent/skill` instead of a command source. Existing installs: run `/plugin marketplace update getdent` then `/plugin update dent@getdent` once.
- Build writes `dist/cli/dent` and `dist/web/dent` instead of three provider trees; `skill/scripts/context.js` is gone.
- Windows: `npm` and `npx` spawn through the shell, bundle paths compare with `relative()`, and CI runs a Windows job.

## 0.2.1

- `dent check` and `dent update` scan each harness root once when the home directory is the project root, so a skills-CLI copy keeps its owner and its label prints once.

## 0.2.0

One skill, every AI, every install method.

- The installed skill is a pointer: `skills/dent/SKILL.md` (Agent Skills format: quoted description, `license: MIT`, `metadata.version`) tells the agent to run `dent skill`, which prints the skill from the installed CLI, so no installed copy can go stale. Discovered by the Vercel `skills` CLI, openskills, reskill, Gemini CLI, and the Claude and Codex plugin loaders. `dent skill references/<path>` prints one reference.
- Manifests for every host: root `plugin.json` (Agent Plugins 1.0.0), `.claude-plugin/plugin.json` + `marketplace.json` (command source, one npm read a day in the background), `.codex-plugin/plugin.json` (OpenAI directory interface), `.agents/plugins/marketplace.json` (Codex marketplace), `.cursor-plugin/plugin.json`.
- Release artifacts: `dist/web/dent.skill` for claude.ai, Claude Desktop, and Cowork; `dist/openai/dent-plugin.zip` for the OpenAI Plugins Directory submission.
- `dent check` and `dent update` know four owners of an installed skill (plain copy, Claude plugin, Codex plugin, skills-CLI copy) and never rewrite one another tool owns; they print that owner's update command instead.
- `dent plugin-path` prints the package root for the Claude Code command source, asks npm at most once a day, and fetches a newer release only when one exists.
- License: MIT.
- CI on every pull request and push; tag-driven publish through npm trusted publishing and a GitHub release.

- The repo is `getdent/skill` and the marketplace is `getdent` and the plugin is `dent`, so the handle is `dent@getdent` in Claude Code and Codex.
- The npm package is `@getdent/skill` (was `@parkerlabs/dent`); the `dent` executable is unchanged. The skill, the package, and every manifest link to https://getdent.app.

Verification on 2026-09-22 (see `docs/agents/20260921-universal/` on the maintainer's machine): 59 tests, route/design/manifest guards, `claude plugin validate`, Vercel `skills` and openskills installs from the local repo, Codex 0.153.4 marketplace add and plugin install, a live end-to-end run of the skill against a Dent Testing Site (login, list, create Page, design, publish, public render, opt-in submit, Contact, analytics), and three adversarial reviews (infrastructure, code, skill text versus Dent source) folded in.

## 0.1.7

- `dent status` resolves the account through the catalog.
