# Dent CLI

## Default login: OAuth browser flow

`dent login` is the default login. The standalone CLI starts Dent's OAuth 2.0 Authorization Code + PKCE login against production Dent by default (`https://ondent.app`): it opens the browser, the operator signs in and clicks Authorize, the loopback callback receives the authorization code, and the CLI exchanges code + verifier before saving the token.

If loopback cannot reach the CLI because the operator is in a remote browser, web agent, or locked-down machine, use the browser code recovery flow:

```bash
dent login                        # opens the browser, waits on loopback
dent login --no-open              # prints the authorize URL, waits on loopback (the agent path)
dent login --copy-code --start    # prints the URL, saves the pending exchange for five minutes
dent login --copy-code --code X   # finishes with the code the operator typed
```

Never ask the operator to create a personal access token for normal login. Never put a token in argv. Explicit token input remains only for power-user recovery with `--token-prompt` or `--stdin`, and the CLI verifies it against `GET /api/v1/schema/` before saving it.

```bash
# recovery: hidden interactive token prompt
dent login --site-url https://example.com --token-prompt

# recovery automation: token is read from stdin
echo "$DENT_PERSONAL_ACCESS_TOKEN" | dent login --site-url https://example.com --stdin
```

## Why

`@getdent/skill` ships one executable, `dent`, plus compiled AI-agent skill bundles so an operator's AI agent can operate Dent through the first-party schema-driven tenant API. One skill source compiles into provider bundles that keep Claude Code, Codex, and Claude web aligned with Dent's schema catalog.

Dent is multi-tenant. Each active target has a Dent Site URL and stored credential. The CLI stores verified credentials outside project directories, then agents can drive Dent's schema-driven tenant API.

## Quick start

```bash
npm install -g @getdent/skill
dent install
dent login
```

Transient `npx` setup works too, but it does not leave a `dent` command installed:

```bash
npx @getdent/skill@latest install
npx @getdent/skill@latest login
```

If `dent` is not on `PATH`, run each Dent CLI command as `npx @getdent/skill@latest <command>`.

## Install the agent skill

```bash
dent install
```

The installer detects project and global harness folders such as `.claude` and `.agents`. It installs the compiled provider skill tree into `skills/dent`. Use `--force` with `install` or `update` to recopy even when the installed skill is already current.

Non-interactive examples:

```bash
dent install --dir . --provider claude-code --scope project --yes
dent install --target /path/to/.claude --provider claude-code --yes
dent install --dir . --provider codex --scope project --yes --force
```

Update and check:

```bash
dent check
dent check --quiet
dent check --plugin-root <path>
dent update
dent update --force
```

- `dent check` asks npm for the latest version and names every stale CLI, skill, or plugin copy; a stale line is not an error, an unreachable registry exits 2.
- `dent check --quiet` prints only the stale lines.
- `dent check` knows four owners of an installed skill: a plain copy in a harness dir, a Claude Code plugin (`~/.claude/plugins/installed_plugins.json`, or `--plugin-root <path>`), a Codex plugin (`~/.codex/plugins/cache/*/dent/*/`), and a skills-CLI copy (`~/.agents/.skill-lock.json`, `skills-lock.json`).
- `dent update` upgrades a global CLI through npm first, then refreshes every plain copy.
- `dent update` never rewrites a skill another tool owns; it prints that owner's update command instead (`/plugin update dent@getdent`, `codex plugin marketplace upgrade`, `npx skills update dent -g`).
- `dent plugin-path` prints the package root; the package root is the plugin for every host.
- `dent plugin-path` asks the registry at most once a day (stamp file `plugin-refresh` in the config dir, mtime), and when the registry is ahead it re-runs `npx --yes --prefer-online @getdent/skill@latest plugin-path --fresh` and prints that path instead; an unreachable registry prints the current path and leaves the stamp alone.
- The marketplace entry is a Claude Code command source running `npx --yes --prefer-offline @getdent/skill@latest plugin-path`; Claude Code runs it once per session in the background, and the daily stamp keeps npm traffic to one small read a day.
- The published marketplace command resolves `plugin-path` from npm, so a release is on npm before it is on GitHub.
- `skills/dent/` is the one skill every installer discovers (Vercel `skills`, openskills, reskill, Gemini CLI, the Claude and Codex plugin loaders), and it is a pointer: frontmatter from `skill/Source.md` plus the body of `skill/Pointer.md`, no references.
- `dent skill` prints the full cli-variant skill from `dist/providers/<first cli provider>/dent/SKILL.md` without its frontmatter; `dent skill references/<path>` prints one reference and refuses any path outside that bundle. The skill text can never be older than the installed CLI.
- The claude.ai `.skill` upload stays the full web variant because that host has no shell.
- The manifests are `plugin.json` (Agent Plugins 1.0.0, read by Cursor and pi), `.claude-plugin/plugin.json` + `marketplace.json`, `.codex-plugin/plugin.json` + `.agents/plugins/marketplace.json`, and `.cursor-plugin/plugin.json`.
- `npm run build` writes `skills/dent`, `dist/web/dent.skill`, `dist/openai/dent-plugin.zip`, and rewrites the version in every manifest; `check:plugin` fails when any manifest's version drifts from `package.json`, and `check:clean` fails when a tracked generated file differs from a fresh build or a new one is untracked.
- The SKILL.md frontmatter carries the version as `metadata.version` (the Agent Skills standard has no top-level `version`); the CLI reads that first and the legacy top-level `version` second.
- `.github/workflows/ci.yml` runs build, tests, the three guards, and `check:clean` on every pull request and push to `main`.
- `.github/workflows/publish.yml` runs when a `v*` tag is pushed: build, tests, guards, `check:clean`, tag equals `package.json` version, `npm publish` through npm trusted publishing (no token, skipped when that version is already on npm), then the GitHub release with `dist/web/dent.skill` and `dist/openai/dent-plugin.zip`.
- The `version` npm script rebuilds and stages every manifest, so an `npm version` commit carries the bumped skill and manifests; pushing its tag starts the publish workflow.
- npm trusted publishing is bound once on npmjs.com to `getdent/skill` and the workflow file `publish.yml`.
- The package license is MIT; the SaaS behind the API stays closed.

## Credential storage

Stored config goes to the operating-system user config directory:

- macOS: `~/Library/Application Support/dent/config.json`
- Linux: `$XDG_CONFIG_HOME/dent/config.json` or `~/.config/dent/config.json`
- Windows: `%APPDATA%\dent\config.json`
- Override for tests and automation: `$DENT_CONFIG_DIR/config.json`

The file is written with mode `0600` where the platform supports it. The CLI stores separate `live` and `local` credentials in the Dent config file.

Power users can override stored credentials:

```bash
export DENT_TARGET=live
export DENT_SITE_URL=https://example.com
export DENT_API_KEY=...
```

`DENT_TARGET` selects `live` or `local`. `DENT_SITE_URL` and `DENT_API_KEY` each override the matching active stored credential; if only one is set, the other falls back to stored config.

## Local Dent development

From this repo, `bun dent-skill setup` switches the CLI to the local target and points it at a local Dent repo. By default it uses the sibling `../creator-income-blueprint` checkout and reads the Site URL with that repo's `bun site`.

```bash
bun dent-skill setup
echo "$LOCAL_DENT_PERSONAL_ACCESS_TOKEN" | dent login --stdin
bun dent-skill reset
```

`bun dent-skill reset` switches back to the live target. Live and local credentials are stored separately, so swapping targets does not require re-authenticating either one.

## Logout

```bash
dent logout
```

- Logout revokes the token on Dent through `DELETE /platform/api/v1/tokens/{id}` with the id stored at login.
- Logout removes the stored credential for the active target even when the revoke fails, and names the token id to revoke by hand.

## API commands

```bash
dent whoami
dent schema
dent schema contacts
dent api contacts
dent api contacts 123
dent api contacts --data '{"email":"person@example.com"}'
dent api contacts 123 enroll --data @payload.json
dent api courses 9203 sections
dent api dent breakdown --param dimension=source --param period=last_month --param includeAdmin=true --param limit=5
```

For `dent api`, the CLI fetches `GET /api/v1/schema/` once per invocation and uses the target action's catalog `mode` as the HTTP method source of truth: `read` uses `GET`, `write` and `remote` use `POST`, and `destroy` uses `DELETE`. `--method` is the explicit override. Collection and nested-collection creates require `--data` or an explicit method, so a bare nested collection such as `dent api courses 9203 sections` lists sections with `GET` instead of guessing a create.

Parameterized catalog actions use repeated `--param name=value` options.

## Build

```bash
npm run build
```

Outputs:

- `skills/dent/` (tracked; the pointer every installer and plugin loader reads)
- `dist/providers/claude-code/dent/`
- `dist/providers/codex/dent/`
- `dist/providers/claude-web/dent/`
- `dist/web/dent.skill` (the claude.ai upload, attached to each GitHub release)
- `dist/openai/dent-plugin.zip` is the OpenAI Plugins Directory submission bundle, attached to each GitHub release.

- Every provider passes through the provider customization seam in `scripts/build.js`.
- The two `cli` providers produce identical content.
- The `web` provider strips the `<!-- dent:cli -->` blocks and keeps the `<!-- dent:web -->` ones.

## Facts

- `cli/bin/dent.js` owns the operator command surface, credential storage, target switching, catalog reads, and generic tenant API calls.
- `providers.json` is the provider source of truth for both the build pipeline and installer.
- `scripts/build.js` compiles `skill/Source.md` into `dist/providers/<provider>/dent`.
- Every provider bundle passes through the build customization seam before it is written.
- A pasted token is verified against the tenant schema catalog before it is saved; a browser login saves the exchanged token first and verifies after, so a Site that is slow to answer never loses the login.
- The CLI resolves entity names, actions, modes, and parameters from the schema catalog instead of hardcoded entity lists.
- `skill/references/` contains authored skill prose owned outside this documentation pass.
- `docs/agents/` holds agent-run evidence for hardening and verification work.
