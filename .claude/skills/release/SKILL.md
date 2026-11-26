---
name: release
description: Cut a new Inkwell release (version bump, tag, draft GitHub release for BRAT). Use when the user says "release", "cut a release", "ship x.y.z", or "bump the version".
---

# Release Inkwell

Pushing a tag is outward-facing: confirm the version number with the user before step 4.

1. **Clean tree on master.** `git status` must be clean and `master` up to date with `origin`. If not, stop and say what's uncommitted.
2. **Check.** `npm run check` must pass.
3. **Pick the version.** Read the current one from `manifest.json`. Suggest patch for fixes, minor for new features, and list the commits since the last tag (`git log $(git describe --tags --abbrev=0)..HEAD --oneline`) so the user can decide.
4. **Bump.** `npm version x.y.z`. This runs `version-bump.mjs` (updates `manifest.json` and `versions.json`) and creates a commit and a tag. The tag must be `x.y.z` with **no `v` prefix**. If `.npmrc` doesn't set `tag-version-prefix=""`, use `npm version x.y.z --no-git-tag-version`, commit, then `git tag x.y.z`.
5. **Push.** `git push origin master` and `git push origin x.y.z`.
6. **Watch.** `gh run watch` on the Release workflow. It lints, tests, builds, checks the tag matches the manifest, attests `main.js` and `styles.css`, and creates a **draft** release.
7. **Notes.** Draft release notes from the commit list in the user's voice (short, what a writer would notice), and show them. Publishing the draft (`gh release edit x.y.z --draft=false`) only when the user says so.
