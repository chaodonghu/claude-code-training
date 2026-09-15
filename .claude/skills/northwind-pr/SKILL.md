---
name: northwind-pr
description: Write the pull request title and description for the current branch in the Northwind team's required format (title, what changed, how I verified it, acceptance criteria, deliberately not done). Use when the user asks to write or draft a PR description for a Northwind ticket, or invokes /northwind-pr.
---

# /northwind-pr

Write the pull request description for the work in this branch, in the team's required format.

The description is read before the diff. Its job is to let a reviewer understand the change, trust the verification, and see exactly which acceptance criteria are met without opening a single file.

## Before writing anything

Read all three of these. Do not start drafting until you have.

1. **The branch diff.** Run both, and read the full diff, not just the stat:

   ```bash
   git diff main...HEAD --stat
   git diff main...HEAD
   ```

2. **The git log.** How the work was sequenced, and the ticket ID from the commit subjects:

   ```bash
   git log main..HEAD --oneline
   ```

3. **The ticket.** Find it in `docs/tickets/<TICKET-ID>.md`. The ticket ID is in the branch name and commit subjects (for example `NWP-201`). Copy the acceptance criteria checkboxes verbatim. If a spec exists in `docs/specs/` for the same ticket, read it too and note where the build departed from the plan.

If the ticket file does not exist, or the branch has no commits ahead of `main`, stop and tell the user. Do not write a description from guesswork.

## The format

Produce exactly these sections, in this order.

### Title

```
<TICKET-ID>: <what it does>
```

Plain language, present tense, under about 70 characters. `NWP-201: issue virtual cards from the merchant console`, not `NWP-201: card issuance implementation`.

### What changed

One paragraph. What can the app do now that it could not do before, and how does it do it at the level a reviewer cares about. This is not a file list. The diff is already a file list.

### How I verified it

The actual commands run and what they output. For each one, the command in a code block or inline, then the result you saw: the test summary line, the count, the error that went away. If something was checked in the browser, say what you clicked and what appeared.

If you have not run a check in this session, run it now, or leave it out. See the rules below.

### Acceptance criteria

The ticket's checkboxes, copied verbatim. For each one, go find the code that satisfies it before ticking it. Tick it only if the code is there and it works.

- `- [x]` means met, with the code in this diff.
- `- [ ]` means not met.
- A partial criterion stays unticked and gets a one-line note under it saying which part is done and which is not.

### Deliberately not done

Anything out of scope for this PR, or left for a follow-up: stretch goals not attempted, edge cases consciously deferred, tests you intended to write, cleanups you noticed and left alone. One bullet each, with the reason. If there is truly nothing, write "Nothing" rather than deleting the section.

## After writing

Print the title and the full description. Save the body to a file in the scratchpad directory so it can be passed to `gh pr create --body-file` or to `/submit`. Do not open the pull request yourself unless the user asks.

## Rules

- **Never claim a verification step that was not actually run.** If a command did not run in this session, it does not appear under "How I verified it". Running it now is fine. Writing it from memory or intent is not. This applies to the template's own checklist items too: do not tick "`npm test` passes" without having run `npm test` and seen the output.
- **Never tick a criterion on intent.** Find the code. If you cannot point to it, the box stays empty.
- **Read before writing.** Diff, log, and ticket, every time, even when you wrote the code yourself in this session. The description reports what is in the branch, not what you remember doing.
- **Plain language.** No ceremony, no "implemented functionality", no restating the section heading inside the section.
- **Keep it short.** One paragraph for what changed. Bullets everywhere else. No emoji, no filler, no closing summary.
- **Deliberately not done is not optional.** Leaving scope gaps unstated is worse than stating them. The reviewer finds them either way.
