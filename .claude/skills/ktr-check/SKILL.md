---
name: ktr-check
description: Check a new Keep the Rhythm (KTR) version against Inkwell before adding it to KTR_TESTED_VERSIONS. Use when the user says KTR updated, word stats are hidden, they see "hasn't been tested with Inkwell", or asks to support a new KTR version.
---

# Check a new Keep the Rhythm version

Inkwell hides KTR stats on untested versions rather than show wrong numbers. A version is only added after its numbers match KTR's own views. All KTR code is in `src/integrations/keep-the-rhythm.ts`. It's read-only: never write KTR data or settings.

1. **Find the version.** Read `.obsidian/plugins/keep-the-rhythm/manifest.json` in the vault the user is using (test vault or the real writing vault, whose path is in Claude's memory). Compare it with `KTR_TESTED_VERSIONS` and `TESTED_SCHEMA`.
2. **Read the changes.** Look at KTR's release notes or changelog since the last tested version for anything touching `data.json`: field names, the schema version, how history is stored or merged across devices.
3. **Diff the data shape.** Compare the vault's KTR `data.json` with the trimmed fixture used by `tests/keep-the-rhythm.test.ts`. Check every field `usableData`, `dailyWordsIn`, `streakIn` and `weekStartFor` read.
4. **If the shape changed:** update the parsing, add a trimmed fixture for the new version next to the old one (keep the old one), and add tests for both.
5. **Compare the numbers by hand with the user.** For the same vault, ask them to read KTR's own today count, streak and heatmap for a few days, and compare with Inkwell's `inkwell-practice` and `inkwell-heatmap` blocks. Don't skip this step, because it's the reason the gate exists.
6. **Only when they match,** add the version to `KTR_TESTED_VERSIONS`, run `npm run check`, and commit with the versions compared and the days checked in the message.
7. If they don't match and the cause isn't clear, leave the version out and write it up as a bug.
