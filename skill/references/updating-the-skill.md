# Update the Dent skill

- A stale skill carries wrong API instructions, so the update happens before any Dent write.
<!-- dent:cli:start -->
- The agent owns the whole update. The operator never touches a terminal.
<!-- dent:cli:end -->
<!-- dent:web:start -->
- Claude web replacement is a fresh ZIP upload, not a local command.
<!-- dent:web:end -->

<!-- dent:cli:start -->
## 1. Read what `dent check` printed

- The skill text you are following came from `dent skill`, printed by the installed CLI, so the CLI version is the skill version.
- `dent check` compares the running CLI, the installed pointer, and every plugin or manager-owned copy (Claude Code plugin, Codex plugin, skills CLI) against the published package.
- It prints one line per stale thing and exits 0 either way.
- A stale copied pointer prints the `dent update` line.
- A stale CLI prints `Dent CLI v0.1.7 is behind v0.1.8. Run: npm install -g @getdent/skill@latest`.
- A stale plugin install prints `Dent skill v0.1.7 is behind v0.1.8. Run: /plugin update dent@getdent`.
- A Claude Code plugin install refreshes itself in the background once a day, so that line means the refresh has not landed in this session yet.
- `Registry unreachable; compared against the local package only.` means the check fell back to the bundled package, and the local compare is then the answer.

IF `dent` is not on PATH:
### Run every Dent command through npx
Prefix each Dent CLI command with `npx @getdent/skill@latest`.
Template:
  ```bash
  npx @getdent/skill@latest check
  ```

### Stop before the write when anything is stale
Pause Dent writes, update, and start the Process again from the session step.
Never: continue a write after `dent check` printed an update line.

## 2. Run the update

### Run `dent update` for a stale CLI or a copied pointer
`dent update` upgrades the package when the registry has a newer version, then rewrites the pointer in every harness it finds. After it returns, run `dent skill` again and follow the fresh text.
Template:
  ```bash
  dent update
  ```

IF `dent update` printed a `Run:` line:
### Run the printed shell command yourself, relay a slash command
`dent update` upgrades the CLI but never rewrites a skill another tool owns. It prints the owner's own update command instead: `codex plugin marketplace upgrade` for a Codex plugin, `npx skills update dent -g` for a copy the skills CLI installed. Run those yourself. `/plugin update dent@getdent` is a Claude Code slash command, so give the operator that one line and wait.
Template:
  Run `/plugin update dent@getdent` in your client, then tell me it is done.

### Do not hand the terminal step back to the operator
An agent with shell access runs the update itself and reports what changed.
Never: "Please run the update command and tell me when it finishes."

## 3. Check again

### Run `dent check` once more before writing
Continue only when the check prints no update line.
Template:
  ```bash
  dent check
  ```

Never: assume the update landed without a second check.
<!-- dent:cli:end -->

<!-- dent:web:start -->
## 1. State the Claude web update boundary

- Claude web has no local CLI.
- It cannot replace its uploaded skill files from inside the chat.

### Tell the operator to upload a fresh ZIP
Say plainly that Claude web cannot update itself and the operator must upload the latest Dent Claude-web ZIP before the chat can use the new instructions.
Template:
  I can't update the Dent skill from Claude web because this chat has no local CLI or file installer. Please upload the latest Dent Claude-web ZIP, then I can continue with the updated skill.

### Do not invent a local update path
The web variant reaches Dent over direct HTTP only. Skill replacement happens outside the chat, by uploading a new ZIP.
Never: tell the operator to run a local updater from Claude web.

## 2. Continue after the fresh ZIP is active

### Treat the re-upload as the check
Once the fresh ZIP is active, start the Dent Process again and use the newly loaded instructions.
Example: "Once the fresh ZIP is active, I'll re-read the schema catalog before writing."
Never: claim that a Claude web chat verified a local installed skill.
<!-- dent:web:end -->
