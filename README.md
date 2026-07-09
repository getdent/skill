# Dent CLI + Agent Skill

Give your AI agent hands on your Dent site.

[Dent](https://getdent.app) is the funnel platform for people serious about ads. It spins up marketing websites that sell and deliver digital products — courses, downloads, subscriptions — through funnels, with first-party revenue attribution built in from the first visit. Dent is designed to be driven from the AI client you already use: your agent builds funnels, writes copy, configures offers, and reads your numbers through Dent's schema-driven API.

`@parkerlabs/dent` is how you connect that agent. It ships one executable, `dent`, plus a compiled skill for Claude Code, Codex, and Claude web that teaches your agent how to operate Dent well.

## Install

Paste this into your AI agent (Claude Code, Codex, or similar):

```text
Install the Dent CLI and agent skill: run `npm install -g @parkerlabs/dent`,
then `dent install`, then `dent login` and hand me the browser link so I can
sign in and authorize. If loopback can't reach you, use `dent login --copy-code`.
```

That's it. The agent installs the skill, and the browser login means it never sees a token — you sign in and click Authorize yourself.

## Manual setup (no AI)

If you'd rather your agent never touch setup or credentials:

```bash
npm install -g @parkerlabs/dent
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
dent check                  # is the installed skill current?
dent update                 # update the installed skill
dent logout                 # remove the stored credential
```

Prefer not to install globally? `npx @parkerlabs/dent@latest <command>` works for every command, but leaves no `dent` on your PATH.

## More

Full CLI reference, credential storage details, local development, and build docs live in [Claude.md](Claude.md).
