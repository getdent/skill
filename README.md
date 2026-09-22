# Dent Skill

Give your AI agent hands on your [Dent](https://getdent.app) site.

[Dent](https://getdent.app) is the funnel platform for people serious about ads. It spins up marketing websites that sell and deliver digital products — courses, downloads, subscriptions — through funnels, with first-party revenue attribution built in from the first visit. Dent is designed to be driven from the AI client you already use: your agent builds funnels, writes copy, configures offers, and reads your numbers through Dent's schema-driven API.

`@getdent/skill` is how you connect that agent. It ships one executable, `dent`, plus one [Agent Skills](https://agentskills.io) skill (`skills/dent`) that works in Claude Code, Codex (CLI and the Codex app inside ChatGPT), Cursor, Gemini CLI, GitHub Copilot, Windsurf, OpenClaw, and every other agent that reads `SKILL.md` and can run a shell, plus a web variant for claude.ai.

The installed `SKILL.md` is a pointer. The skill text ships inside the `dent` command and `dent skill` prints it, so whatever you installed can never be older than the CLI on your machine, and keeping the CLI current is the whole update.

## Quick start: tell your AI

Paste this into any AI that can run commands on your machine (Claude Code, Codex, Cursor, Gemini CLI, Copilot, Windsurf, and the rest). It does the whole setup and hands you one link to sign in with:

```text
Set up Dent for me. Run `npm install -g @getdent/skill`. If `npm` is not installed, install Node.js LTS from https://nodejs.org first and try again. Then run `dent install --yes`, then `dent login --no-open` and give me the link it prints so I can sign in and authorize in my browser. Once I say I'm signed in, run `dent skill` and follow what it prints.
```

The AI never sees a password or token: you sign in and click Authorize yourself. The rows below are the same thing per host, for people who prefer a plugin manager.

## Install

Pick the row for the AI you use. Use one install method per machine; two copies of the skill show up twice.

| You use | Install | Updates |
|---|---|---|
| **Claude Code** (recommended) | `/plugin marketplace add getdent/skill` then `/plugin install dent@getdent` | Automatic, same pointer. The pointer plugin itself refreshes from GitHub when you turn on auto-update for the `getdent` marketplace under `/plugin` → Marketplaces, or run `/plugin marketplace update getdent` then `/plugin update dent@getdent` |
| **Codex CLI and Codex app** | `codex plugin marketplace add getdent/skill` then `codex plugin add dent@getdent` | Automatic: Codex pulls the marketplace from GitHub in the background at every startup; `codex plugin marketplace upgrade` forces it |
| **Codex app, ChatGPT** (once Dent is listed in the OpenAI Plugins Directory) | Plugins → search "Dent" → Install | Automatic through the directory |
| **ChatGPT Business / Enterprise workspace** | An admin imports `getdent/skill` as a plugin marketplace from GitHub (Workspace settings → Plugins); the workspace then sees Dent in Work mode and Codex | Daily sync from GitHub |
| **Cursor, Gemini CLI, Copilot, Windsurf, Amp, OpenCode, Kiro, Cline, Roo, Goose, Zed, OpenClaw, or any of 50+ [Agent Skills](https://agentskills.io) hosts** | `npx skills add getdent/skill -g` (add `-a cursor`, `-a codex`, … to pick agents) | Automatic: the installed file is a pointer; the skill's first step keeps the `dent` CLI current |
| **Gemini CLI** (native) | `gemini skills install https://github.com/getdent/skill` | Automatic, same pointer |
| **claude.ai, Claude Desktop, Cowork** | Download `dent.skill` (a zip) from the [latest release](https://github.com/getdent/skill/releases/latest) (v0.2.0 and up), then Customize → Skills → + → Upload a skill. Turn on "Code execution and file creation" first; your workspace's network setting must allow your Dent site's domain. | Re-download and re-upload |
| **npm** (Claude Code and Codex skill folders) | `npm install -g @getdent/skill` then `dent install` | Automatic, same pointer; `dent update` upgrades the CLI by hand |
| **Manual** | `git clone https://github.com/getdent/skill` and symlink `skills/dent` into your agent's skills folder | Automatic, same pointer |

Then tell your agent, in any of them:

```text
Log me in to Dent with `dent login --no-open` and hand me the browser link so I can sign in and authorize.
```

On every host with a terminal, the skill runs `dent skill` at the start of every session, then `dent whoami`, and hands you a browser link to sign in. When `dent` is not on PATH the agent installs it once with `npm install -g @getdent/skill`, and only when that install is refused does it run every command through `npx @getdent/skill@latest`. The agent never sees a token there: you sign in and click Authorize yourself. claude.ai is the one exception, below.

Updates, per row: the pointer never goes stale, so the only thing that can be behind is the `dent` CLI. `dent skill` asks npm once a day, and when a newer release exists its first line says so with the exact command, `dent update`, which the agent runs before touching your Site. `dent update` upgrades the CLI through npm and rewrites the pointer in every harness it finds. claude.ai uploads are the one place you re-upload by hand, because that host has no shell to run `dent skill`.

claude.ai has no terminal, so the web variant asks you once to paste a Dent personal access token into the chat and reaches your Site over HTTP from there.

chatgpt.com in a browser can hold the skill but cannot reach your Site: ChatGPT web only calls outside APIs through a Custom GPT Action or a remote MCP server. Use the Codex app or Codex CLI rows for the full capability in ChatGPT today.

If the browser cannot reach the machine the agent runs on, the agent starts `dent login --copy-code --start`, you authorize, then read it the code from the page (it cannot be copied) and it finishes with `dent login --copy-code --code <code>`.

## Manual setup (no AI)

If you'd rather your agent never touch setup or credentials:

```bash
npm install -g @getdent/skill
dent install
dent login                  # browser OAuth; no token to handle
```

To keep a personal access token out of any AI context entirely:

```bash
dent login --site-url https://example.com --token-prompt   # hidden interactive prompt
echo "$DENT_PERSONAL_ACCESS_TOKEN" | dent login --stdin    # automation
```

Credentials are stored outside project directories, in your operating-system user config directory (for example `~/Library/Application Support/dent/config.json` on macOS), written with mode `0600`. No token ever goes in argv.

## What your agent can do

Once installed, ask your agent things like:

- "Build a funnel for my new course with an opt-in page, sales page, and upsell."
- "Write the sales page copy for my $49 offer and publish it."
- "How did my funnels perform last month? Where am I leaking?"
- "Enroll this contact in the course and tag them."
- "Draft three SEO articles for the blog."

The skill reads Dent's schema catalog live, so entities, actions, and parameters always match your site instead of a hardcoded list.

## Useful commands

```bash
dent whoami                 # who you're logged in as
dent schema                 # list every entity your site exposes
dent schema contacts        # actions and parameters for one entity
dent api contacts           # list contacts
dent api contacts 123       # read one
dent api contacts --data '{"email":"person@example.com"}'   # create
dent skill                  # print the skill; `dent skill references/<path>` prints one reference
dent check                  # is the CLI current, and does every installed pointer match it? (asks npm)
dent update                 # upgrade the CLI when npm has a newer one, then refresh the pointer
dent logout                 # remove the stored credential; revokes the token on Dent when it knows the token's id
```

Prefer not to install globally? `npx @getdent/skill@latest <command>` works for every command, but leaves no `dent` on your PATH.

## More

Full CLI reference, credential storage details, local development, and build docs live in [Claude.md](Claude.md).

No Dent site yet? Start one at [getdent.app](https://getdent.app), then come back and install the skill.
