---
name: deploy-vault
description: Build Inkwell and copy it into the user's real writing vault. Use when the user says "deploy", "deploy to the writing vault", "put it in my vault", or wants to try a change in their real vault. For the test vault use `npm run deploy:test` instead.
---

# Deploy to the writing vault

The real vault path is in Claude's memory (`writing-vault`); if it isn't there, ask the user. Only deploy there when the user asks. Day-to-day development uses `test-vault/`.

1. Run `npm run check`. If it fails, stop and report. Never deploy a build that fails lint, spec, or tests.
2. Run `scripts/deploy.sh <vault path>`. It copies `main.js`, `manifest.json` and `styles.css` into `.obsidian/plugins/inkwell/` and refuses a folder that isn't a vault.
3. Tell the user it's deployed and that they need to reload Inkwell in Obsidian: turn it off and on in Community plugins, or run "Reload app without saving".
4. If the change touched settings migration (`mergeSettings`) or anything that moves or rewrites notes, say so plainly, since this is the vault with their real writing in it.
