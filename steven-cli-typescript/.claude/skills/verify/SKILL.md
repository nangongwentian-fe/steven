---
name: verify
description: Type-check all TypeScript files in this project. Run before committing or creating a PR to catch type errors early.
---

Run the TypeScript type-checker across the entire project:

```sh
bun tsc --noEmit
```

Report any type errors found. If there are no errors, confirm the project type-checks cleanly.
