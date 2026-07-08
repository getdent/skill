# Update the Dent skill

- A stale skill can carry wrong API instructions, so update before Dent writes.
<!-- dent:cli:start -->
- The Agent owns the update when a local harness can run commands; the User should not touch a terminal.
<!-- dent:cli:end -->
<!-- dent:web:start -->
- Claude web replacement is a fresh ZIP upload, not a local command.
<!-- dent:web:end -->

<!-- dent:cli:start -->
## 1. Read the staleness signal

The CLI variant surfaces staleness through the first `dent check` in the Dent Process.

- IF `dent` is not on PATH, run each Dent CLI command as `npx @parkerlabs/dent@latest <command>`.

### Treat either stale message as a stop-before-write condition
Pause Dent writes, tell the user the skill is stale, and update it before touching data.
Example: `Dent skill update available: installed v0.1.0, npm v0.1.1.`
Never: continue a write after the session-start check or `dent check` says an update exists.

## 2. Refresh the installed local skill

### Use the package updater
Run the updater from the package; it detects the configured Claude Code and Codex harnesses and rewrites the installed skill tree.
Template:
  ```bash
  dent update
  ```

### Do not hand the terminal step back to the user
Agents with shell access run the update themselves and report what changed.
Never: "Please run the update command and tell me when it finishes."

## 3. Verify the update landed

### Check the installed skill after the update
Run the package check and continue only when it reports the skill is current.
Template:
  ```bash
  dent check
  ```

Example: `Dent skill is up to date (v0.1.1).`
Never: assume the update worked without a successful check.
<!-- dent:cli:end -->

<!-- dent:web:start -->
## 1. State the Claude web update boundary

Claude web has no local CLI and cannot replace its uploaded skill files from inside the chat.

### Tell the user to upload a fresh ZIP
Say plainly that Claude web cannot self-update and the user must upload the latest Dent Claude-web ZIP before the chat can use the new instructions.
Template:
  I can't update the Dent skill from Claude web because this chat has no local CLI or file installer. Please upload the latest Dent Claude-web ZIP, then I can continue with the updated skill.

### Do not invent a local update path
The web variant only uses direct HTTP for Dent operations; skill replacement happens outside the chat by uploading a new ZIP.
Never: tell the user to run a local updater from Claude web.

## 2. Continue after the fresh ZIP is active

### Treat the re-upload as the verification step
After the fresh ZIP is uploaded, restart from the Dent Process and use the newly loaded instructions.
Example: "Once the fresh ZIP is active, I'll re-check the schema catalog before writing."
Never: claim that a Claude web chat verified a local installed skill.
<!-- dent:web:end -->
