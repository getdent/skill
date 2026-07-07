# dent-cli

`dent-cli` ships one executable, `dent`, plus compiled AI-agent skill packs for Dent operators.

Dent is multi-tenant. Each operator has a site URL and a personal access token. The CLI stores those once, outside project directories, then agents can drive Dent's schema-driven HTTP API.

## Quick start

```bash
npm install -g dent-cli && dent install && dent login
```

That installs the npm package globally, installs the Dent agent skill, then starts browser authorization so the CLI can store your Dent Site URL and token. The npm package name is `dent-cli`; the persistent executable is `dent`.

Transient npx setup works too, but it does not leave a `dent` command installed. Use `npx dent-cli@latest` for every step and every later command:

```bash
npx dent-cli@latest install && npx dent-cli@latest login
```

## Install

```bash
npm install -g dent-cli
```

## Agent skill install

```bash
dent install
```

The installer detects project and global harness folders such as `.claude`, `.agents`, and `.cursor`. It installs the compiled provider skill tree into `skills/dent`. Use `--force` with `install` or `update` to recopy even when the installed skill is already current.

Non-interactive examples:

```bash
dent install --dir . --provider claude-code --scope project --yes
dent install --target /path/to/.claude --provider claude-code --yes
dent install --dir . --provider claude-code --scope project --yes --force
```

Update and check:

```bash
dent check
dent update
dent update --force
```

## Login

Tokens are never accepted as command-line arguments.

```bash
# browser authorization; opens Dent, then stores the selected Site URL and token
dent login

# automation: token is read from stdin
echo "$DENT_PERSONAL_ACCESS_TOKEN" | dent login --site-url https://example.com --platform-url https://ondent.app --stdin

# power users: hidden interactive token prompt
dent login --site-url https://example.com --token-prompt
```

By default `dent login` starts at the production Dent platform (`https://ondent.app`), opens a browser consent page, and polls until the operator clicks Authorize or Decline. Use `--site-url` or `DENT_SITE_URL` to point the browser flow at staging or local development.

During browser authorization, Dent shows a Site picker when the Account has multiple Sites. The CLI receives the selected Site URL with the token and stores it automatically. If an older authorization response omits the Site URL, the CLI falls back to fetching Sites and asking in the terminal.

Browser authorization stores the Dent Platform URL too so `dent logout` can revoke the token later. When using `--stdin` or `--token-prompt` with a custom Site URL, pass `--platform-url` if token revocation uses a different host.

Stored config goes to the operating-system user config directory:

- macOS: `~/Library/Application Support/dent/config.json`
- Linux: `$XDG_CONFIG_HOME/dent/config.json` or `~/.config/dent/config.json`
- Windows: `%APPDATA%\\dent\\config.json`
- Override for tests and automation: `$DENT_CONFIG_DIR/config.json`

The file is written with mode `0600` where the platform supports it.

Power users can override stored credentials:

```bash
export DENT_SITE_URL=https://example.com
export DENT_API_KEY=...
export DENT_PLATFORM_URL=https://ondent.app
```

`DENT_SITE_URL` and `DENT_API_KEY` each override the matching stored field; if only one is set, the other falls back to stored config. `DENT_PLATFORM_URL` is used by login/logout when token revocation needs a separate Platform host. Tests and automation can set `DENT_CONFIG_DIR` to change where the stored config is read and written.

## Logout

```bash
dent logout
```

Logout revokes the stored token with Dent, then removes the local config file. If Dent cannot be reached or the token was already revoked, the CLI prints the revoke failure plainly and still removes the local config so local logout is never stuck.

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
```

For `dent api`, the CLI fetches `GET /api/v1/schema/` once per invocation and uses the target action's catalog `mode` as the HTTP method source of truth: `read` uses `GET`, `write` and `remote` use `POST`, and `destroy` uses `DELETE`. `--method` is the explicit override. Collection and nested-collection creates require `--data` or an explicit method, so a bare nested collection such as `dent api courses 9203 sections` lists sections with `GET` instead of guessing a create.

The CLI stays generic because Dent's catalog is introspectable at `GET /api/v1/schema/` and `GET /platform/api/v1/schema/`.

## Build

```bash
npm run build
```

Outputs:

- `dist/providers/claude-code/dent/`
- `dist/providers/codex/dent/`
- `dist/web/dent.zip`

The Claude web ZIP has `dent/` as the ZIP root. Claude web has no local CLI, so that variant instructs the agent to call Dent's HTTP API directly with a key the user provides in chat.
