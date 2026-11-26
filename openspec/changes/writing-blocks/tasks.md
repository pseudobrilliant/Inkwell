# Tasks

Test lines named below go in this change's `specs/writing-blocks/spec.md`, replacing `Test: none yet` in the same task. `npm run spec` checks them once the change is archived into `openspec/specs/`, so check names by hand before then.

## 1. Pin today's behaviour, and setup

These tests describe current code and pass before anything else changes.

- [x] 1.1 In `tests/wordcount.test.ts`, add tests that pin current `countWords` behaviour:
  - multi-line `%%` comments, several comments in one note, and an unclosed `%%`
  - a callout's `[!writing]` header line, which is counted today
  - tab-indented lines

  Verify `npm test` passes on unchanged source.
- [x] 1.2 Export `workSection` from `src/became.ts` (no other change). In a new `tests/became.test.ts`, pin:
  - Work section found, ending at the next `#`/`##` but not at `###`
  - no Work section, an empty Work section, and Work as the last section
  - `## ` inside a `%%` comment ends the section today
  - an exercise flow against the fake vault: the exercise body is unchanged, `became` and `from` are set, and the draft holds the Work text

  Verify `npm test` passes.
- [x] 1.3 In `tests/promote.test.ts`, pin `splitScenes`:
  - `***` and a heading inside a `%%` comment split today
  - `> ***` does not split
  - no words are lost across splits

  Verify `npm test` passes.
- [x] 1.4 Add `@codemirror/merge` (dependency, bundled), and `@codemirror/state`, `@codemirror/view` and `@codemirror/language` (dev, types only; already external) at the installed versions. Build once with a throwaway `presentableDiff` import and record the size `main.js` grows by in design.md decision 3; if over about 10 KB, switch to a small word-token diff there. Verify `npm run build` passes, then remove the throwaway import.

## 2. Block format, creation and look

- [x] 2.1 In `test-vault`, check by hand how Obsidian edits a callout in Live Preview. Result: with the cursor inside, it shows the raw `> [!writing]` and `>` markers, which the writer doesn't want; they want to type in a styled box, like today's tabbed blocks. Spec gained "Writing inside the block" and "Paragraphs inside the block", and design decision 4 now hides the Markdown and owns Enter and Backspace (task 2.6).
- [x] 2.2 Create `src/writingblocks.ts` with:
  - find blocks and their comments, with line ranges, title, text and mode
  - wrap selected lines
  - convert a tab-indented run
  - `unwrapBlocks`

  Add `tests/writingblocks.test.ts`:
  - "finds a writing callout and its text"
  - "finds two blocks, each with its own mode"
  - "wraps a selection, keeping words and paragraphs"
  - "converts tab-indented lines into a block"
  - "a block with no comment is in Writing mode"
  - "a missing or unreadable comment means never reviewed"

  Set the Test lines for "A writing callout is a writing block", "Two blocks in one note", "Wrapping a selection", "Old tabbed writing becomes a block", "A new block is in Writing mode" and "Comment deleted by hand". Verify `npm test` passes.
- [x] 2.3 Make `countWords` ignore writing header lines. Update the 1.1 test that pinned the header being counted, and add "counts only a block's current text" to `tests/wordcount.test.ts`; set the "Counting a reviewed block" Test line. Verify `npm test` passes.
- [ ] 2.4 Add the "New writing block" command (`editorCallback`, plus `editor-menu` entry) in `src/main.ts`: an empty block with the cursor inside, a wrapped selection, or a converted tabbed run. Add "inserts an empty block with the cursor on its line" to `tests/writingblocks.test.ts` and set the "Empty block at the cursor" Test line. Verify `npm test`, then by hand in `test-vault`.
- [ ] 2.5 Add writing block CSS to `styles.css`: hidden icon, box, `var(--font-monospace)`, first-line indent per paragraph. Use classes and Obsidian variables only. Add the `<br>`-splitting post processor in `src/writingblockview.ts`. Verify in `test-vault` against the screenshot's look, in Live Preview and reading view, light and dark, with Strict line breaks on and off.
- [ ] 2.6 Create `src/writingblockeditor.ts` (`registerEditorExtension`, Live Preview only):
  - with the cursor in a block, line decorations with the same classes as 2.5's rendered block
  - the header text and each `> ` hidden as atomic ranges
  - a high-precedence keymap for Enter and Backspace inside blocks only

  Put the key logic in pure functions in `src/writingblocks.ts` (`enterAt`, `backspaceAt`, returning the change and new cursor). Add to `tests/writingblocks.test.ts`:
  - "enter starts a new paragraph in the block"
  - "enter on an empty last line leaves the block"
  - "backspace at a paragraph's start joins it to the one before"
  - "backspace on the only empty line removes the block"

  Set the Test lines for "Enter stays in the block", "Enter twice leaves the block" and "Backspace joins paragraphs". Verify `npm test`, then by hand in `test-vault`:
  - no `>` or `[!writing]` shows while typing
  - clicking in and out doesn't move the box
  - arrow keys skip the hidden Markdown
  - undo works
  - on a phone: autocorrect, swipe and dictation

  Stop and return to the writer if Obsidian fights the hidden Markdown (see design.md's fallback).

## 3. Modes and the first draft

- [ ] 3.1 In `src/writingblocks.ts`, add:
  - build the first-draft comment (`%% writing-block first-draft <mode>`, the text, `%%`, after one blank line)
  - set the mode
  - refuse review when the text contains `%%`

  Add tests:
  - "first review saves the text as the first draft below the block"
  - "switching modes changes only the mode word"
  - "the first draft never changes across mode switches"
  - "each block keeps its own mode"
  - "refuses review when the writing contains %%"

  Set the Test lines for "First review saves the first draft", "The first draft never moves", "Switching changes only the mode word", "Each block keeps its own mode" and "Writing that would end the comment early". Verify `npm test` passes.
- [ ] 3.2 Add `ignoresComments()` to `src/integrations/keep-the-rhythm.ts`, reading `settings.ignoreComments` behind the version gate. Add "reads whether comments are ignored, or null when unavailable" to `tests/keep-the-rhythm.test.ts`. Set both Keep the Rhythm scenario Test lines, with a note that the notice itself is checked by hand. Verify `npm test` passes.
- [ ] 3.3 Add the "Writing mode", "Review mode" and "Edited mode" commands (`editorCheckCallback`, only with the cursor in a block, plus `editor-menu`). Each is a single editor transaction with its own `userEvent`. Show the KTR notice on first review when `ignoresComments()` is false. Verify by hand in `test-vault`: modes switch, undo reverses each, the mode survives reload, and the notice appears only with the setting off.
- [ ] 3.4 Add mode buttons to the callout title in `src/writingblockview.ts`. In reading view they use `vault.process`, re-finding the block by line and checking its text first. Verify by hand in reading view and in Live Preview with the cursor outside the block, on desktop and phone.
- [ ] 3.5 **Check KTR** in `test-vault` with "Don't count comments" on:
  - first review, switching modes, and toggling between Writing and Edited change the day's count by 0
  - replacing 3 words with 5 logs +2

  Record the results in the change. Stop and return to the writer if any number is off.

## 4. Review, Edited and Writing views

- [ ] 4.1 Add `diffSegments(before, after)` to `src/writingblocks.ts` using `presentableDiff` (or the 1.4 fallback), on unwrapped prose, with paragraph breaks as changes, bounded by `scanLimit` and `timeout`. Add tests:
  - "diff marks replaced words as removed then added"
  - "no changes gives no marks"
  - "a split paragraph shows as a change"
  - "rebuilding the first draft from the segments gives it back exactly"

  Set the Test lines for "Changes show while revising", "No changes yet" and "Paragraph breaks count as changes". Verify `npm test` passes, and a 5,000-word heavily rewritten block diffs in under 100 ms in a test.
- [ ] 4.2 Create `src/writingblockeditor.ts` (`registerEditorExtension`, Live Preview only). With the cursor inside a block:
  - Review marks: added text highlighted, removed text struck through, debounced and mapped through edits
  - the comment collapsed to a "First draft kept" widget
  - Edited shows clean text

  Verify by hand in `test-vault` while typing, pasting, splitting paragraphs, undoing and redoing, in split panes and on a phone with autocorrect, swipe and dictation.
- [ ] 4.3 Writing mode after review:
  - Live Preview: a block widget showing the first draft, and a `transactionFilter` that drops typing into it with the notice
  - reading view: the first draft rendered

  Add "typing into a reviewed block in Writing mode is refused" to `tests/writingblocks.test.ts`, testing the pure range check the filter uses, and set the "Looking back at the first draft" Test line with a note that the notice is checked by hand. Verify `npm test`, then by hand on desktop and phone.
- [ ] 4.4 Draw Review and Edited in reading view and rendered callouts in `src/writingblockview.ts`. Set the "Reading the revision" Test line to "edited shows current text with no marks" in `tests/writingblocks.test.ts` (the pure render input), added here. Verify `npm test`, then by hand.

## 5. Moving work up and the template

- [ ] 5.1 Pass `workSection`'s result through `unwrapBlocks`. Add "a story starts from the block's current text" to `tests/became.test.ts` (fake vault) and update the 1.2 tests whose behaviour changes. Set the "A story starts from the revised text" Test line. Verify `npm test` passes.
- [ ] 5.2 In `promoteToLongForm`, call `unwrapBlocks` on the draft body before `splitScenes`. Add "scenes hold only current text, and the original draft is archived first" to `tests/promote.test.ts`, with `***` in a first draft. Set the "Promoting keeps the first draft out of scenes" Test line. Verify `npm test` passes.
- [ ] 5.3 Start the built-in exercise template's `## Work` with an empty writing block in `src/templates.ts`. Add "the built-in exercise template starts Work with a writing block" to `tests/blocks.test.ts` (templates suite), and set the "New exercise has a block" Test line. Verify `npm test` passes and a new exercise in `test-vault` has the block.

## 6. Docs, ADR, check

- [ ] 6.1 Update the README: writing blocks, the three modes, converting tabbed blocks, and turning on KTR's "Don't count comments". Update CLAUDE.md:
  - Practice tools: a short writing-blocks summary linking the spec
  - Movement: the current text only carries forward
  - the KTR rules: the comment setting

  Verify both read correctly.
- [ ] 6.2 Mark ADR 0006 accepted and add it to `openspec/decisions/README.md`. Add the "Don't count comments" check to the `ktr-check` skill. Verify `npm run spec` passes.
- [ ] 6.3 Run `npm run check` and verify it passes with zero lint errors. Run `npm run deploy:test` and walk through every scenario in the spec once in `test-vault` on desktop and phone.

## Workflow follow-up

- Archive the change with `npx openspec archive writing-blocks` after review, then verify `npm run spec` checks the merged Test lines.
