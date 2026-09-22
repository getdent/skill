# Update the Dent skill

- A stale skill carries wrong API instructions, so the update happens before any Dent write.
<!-- dent:cli:start -->
- The agent owns the whole update. The operator never touches a terminal.
<!-- dent:cli:end -->
<!-- dent:web:start -->
- Claude web replacement is a fresh ZIP upload, not a local command.
<!-- dent:web:end -->

<!-- dent:cli:start -->
## 1. Read the first line of `dent skill`

- The skill text you are following came from `dent skill`, printed by the installed CLI, so the CLI version is the skill version.
- `dent skill` asks npm once a day. When the CLI is behind, its first line is `Dent CLI v0.2.1 is behind v0.2.2. Run: dent update`.
- `dent check` runs the same compare on demand and also names installed pointers that differ from the package; it exits 2 when npm is unreachable.

IF `dent` is not on PATH:
### Install the CLI once
Run `npm install -g @getdent/skill`.
Template:
  ```bash
  npm install -g @getdent/skill
  ```

IF `npm install -g` is refused:
### Run every Dent command through npx
Prefix each Dent CLI command with `npx @getdent/skill@latest`.
Template:
  ```bash
  npx @getdent/skill@latest skill
  ```

### Stop before the write when the CLI is behind
Pause Dent writes, update, and start the Process again from `dent skill`.
Never: continue a write after `dent skill` said the CLI is behind.

## 2. Run the update

### Run `dent update`
`dent update` upgrades the CLI through npm when npm has a newer version, then rewrites the pointer in every harness it finds. After it returns, run `dent skill` again and follow the fresh text.
Template:
  ```bash
  dent update
  dent skill
  ```

### Run the update yourself
An agent with shell access runs `dent update` itself and reports what changed.
Never: "Please run the update command and tell me when it finishes."
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
