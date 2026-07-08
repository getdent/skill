# Dent CLI

## Default login: OAuth browser flow

`dent login` is the default login. The standalone CLI starts Dent's OAuth 2.0 Authorization Code + PKCE login against production Dent by default (`https://ondent.app`): it opens the browser, the operator signs in and clicks Authorize, the loopback callback receives the authorization code, and the CLI exchanges code + verifier before saving the token.

If loopback cannot reach the CLI because the operator is in a remote browser, web agent, or locked-down machine, use the browser code recovery flow:

```bash
dent login
dent login --copy-code
```

Never ask the operator to create a personal access token for normal login. Never put a token in argv. Explicit token input remains only for power-user recovery with `--token-prompt` or `--stdin`, and the CLI verifies it against `GET /api/v1/schema/` before saving it.

```bash
# recovery: hidden interactive token prompt
dent login --site-url https://example.com --token-prompt

# recovery automation: token is read from stdin
echo "$DENT_PERSONAL_ACCESS_TOKEN" | dent login --site-url https://example.com --stdin
```

## Why

`@parkerlabs/dent` ships one executable, `dent`, plus compiled AI-agent skill bundles so an operator's AI agent can operate Dent through the first-party schema-driven tenant API. One skill source compiles into provider bundles that keep Claude Code, Codex, and Claude web aligned with Dent's schema catalog.

Dent is multi-tenant. Each active target has a Dent Site URL and stored credential. The CLI stores verified credentials outside project directories, then agents can drive Dent's schema-driven tenant API.

## Quick start

```bash
npm install -g @parkerlabs/dent
dent install
dent login
```

Transient `npx` setup works too, but it does not leave a `dent` command installed:

```bash
npx @parkerlabs/dent@latest install
npx @parkerlabs/dent@latest login
```

If `dent` is not on `PATH`, run each Dent CLI command as `npx @parkerlabs/dent@latest <command>`.

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
dent update
dent update --force
```

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

Logout removes the stored credential for the active target.

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

- `dist/providers/claude-code/dent/`
- `dist/providers/codex/dent/`
- `dist/providers/claude-web/dent/`
- `dist/providers/claude-web/dent.zip`

All providers pass through the provider customization seam in `scripts/build.js`, even though the content is identical today.

## Facts

- `cli/bin/dent.js` owns the operator command surface, credential storage, target switching, catalog reads, and generic tenant API calls.
- `providers.json` is the provider source of truth for both the build pipeline and installer.
- `scripts/build.js` compiles `skill/Source.md` into `dist/providers/<provider>/dent`.
- Every provider bundle passes through the build customization seam before it is written.
- The CLI verifies credentials against the tenant schema catalog before saving them.
- The CLI resolves entity names, actions, modes, and parameters from the schema catalog instead of hardcoded entity lists.
- `skill/references/` contains authored skill prose owned outside this documentation pass.
- `docs/agents/` holds agent-run evidence for hardening and verification work.
