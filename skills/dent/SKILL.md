---
name: dent
description: "Build and run a Dent Site through its first-party API: Funnels, Pages, Offers, Articles, Courses, Spaces, Analytics. Trigger on Dent, funnel, opt-in page, sales page, checkout, course. Do not trigger for WordPress-only work."
license: MIT
metadata:
  version: "0.2.1"
  homepage: "https://getdent.app"
---

# Dent

[Dent](https://getdent.app) spins up marketing Sites that sell and deliver digital Products. This file is a pointer. The skill itself ships inside the `dent` command, so it is never older than the CLI.

Run this first, then follow what it prints:

```bash
dent skill
```

- IF `dent` is not on PATH, run `npx @getdent/skill@latest skill` instead, and run every later `dent` command the same way.
- A reference the skill names, such as `references/interview.md`, is printed by `dent skill references/interview.md`.
- The skill and CLI live at [github.com/getdent/skill](https://github.com/getdent/skill).
