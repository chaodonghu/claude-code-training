# SPEC · NWP-101 — Payments export: columns and scope

> Written before any code. Generated with `/spec`, then edited by a human.
> Load it as context when you build: `@docs/specs/NWP-101-export-options.md`

**Ticket:** [NWP-101](../tickets/NWP-101.md)
**Author:** Dong Hu
**Status:** building

## Problem

Ops exports the payments table several times a day and the file is fixed: every column, current filter only. The card last four is in every file, so anything sent to a merchant is cleaned up by hand first. Dana's team puts that at 3 to 4 hours a month, plus one near miss where an unedited file almost went to the wrong merchant.

## Current state

- `src/app/payments/page.tsx` renders the Export button as a plain `<a>` to `/api/payments/export?<current filters>`. The page already knows `total` for the current filter from `queryPayments`.
- `src/app/api/payments/export/route.ts` parses filters with `parseFilters`, runs `filterPayments` and `sortPayments`, and returns `toCsv(rows)` with every column. It already ignores `page`, so it exports the whole filtered set, not one page.
- `src/lib/csv.ts` owns `EXPORT_COLUMNS`, the per-cell serializer, `toCsv(payments, columns)`, and `exportFilename(date)`. `toCsv` already accepts a column subset. The amount cell goes through `formatMoney` once, and `currency` is already its own column.
- `src/lib/csv.test.ts` pins escaping and the column contract. Its docstring says NWP-101 changes which columns ship, not how a cell is written.
- `src/data/queries.ts` is the one query builder. `parseFilters` is the allowlist boundary for filter params. `PaymentFilters` is all optional, so `filterPayments({})` is "all payments" through the same builder.
- `src/components/Drawer.tsx` is a Radix Dialog with title, description, close button, focus management, and Escape. `.claude/rules/components.md` lists a Dialog component, but no `Dialog.tsx` exists and `tailwind.config.ts` has no dialog keyframes.

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| "Validate on the server. Anything from the client — column names, currencies, limits, statuses — is checked against an allowlist before it reaches a query, a filename, or the store." | `CLAUDE.md` | Client-chosen column names reach the serializer or the filename |
| "One query builder. Payment filtering goes through the builder behind `GET /api/payments`." | `CLAUDE.md` | A second filter path for scope=all |
| "Money is integer minor units. Format once, at the edge, next to its currency code." | `CLAUDE.md` | A second amount formatter in the export |
| "Dialogs and forms must be operable. Every input has a label, the dialog has an accessible name, focus moves into it and returns on close, Escape closes it." | `.claude/rules/components.md` | Ops cannot drive the dialog by keyboard |
| "Return the same error shape everywhere: a status code that means what it says, and a body with a message safe to show a user." | `.claude/rules/api-routes.md` | Empty column set returns an empty file instead of a 400 |

## Approach

Replace the fixed Export link with an Export button that opens the existing Drawer. The drawer lists the columns as labelled checkboxes driven by one registry in `src/lib/csv.ts` (key, label, selected by default), with `last4` off by default. A radio pair picks the scope, current filter or all payments, and shows the row count for the chosen scope from counts the server page already has. Download is a link to `GET /api/payments/export?<filters>&scope=<filtered|all>&columns=<a,b,c>`, rendered as a disabled button when no column is selected. The route parses `columns` and `scope` against allowlists in `csv.ts`, returns 400 on an empty or unknown column set, runs `filterPayments` on either the parsed filters or `{}` for all payments, and names the file `payments-<scope label>-<UTC date>.csv` where the label is derived server-side from the validated status filter or scope, never from client text.

**Considered and rejected:**
- Adding a Tremor `Dialog.tsx`. It needs new tailwind keyframes and a new component for one caller. The Drawer is already a Radix Dialog with the accessibility rules met.
- Building the CSV in the browser from the table rows. The table is one page of a paginated list, so this exports one page. This is the bug the ticket warns about.
- A `POST` export endpoint. A `GET` link downloads natively with no fetch, blob, or object URL code, and every param is allowlisted before use.

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/lib/csv.ts` | change | Column registry with labels and defaults, `parseExportColumns`, `parseExportScope`, `exportScopeLabel`, `exportFilename(label, date)` |
| `src/lib/csv.test.ts` | change | Cover the column parser, default selection, scope label, and the new filename |
| `src/app/api/payments/export/route.ts` | change | Honor `columns` and `scope`, 400 on an empty column set, scope in the filename |
| `src/app/payments/export-dialog.tsx` | add | Client component: Drawer with column checkboxes, scope radios, row count, Download link |
| `src/app/payments/page.tsx` | change | Pass the current query, column options, and both row counts into the dialog |

## Plan

1. **Registry and parsers in `csv.ts`, tests first** — done when: `npm test` goes red on the new cases, then green.
2. **Route honors columns and scope** — done when: `curl` with `columns=id,amount&scope=all` returns two columns and every row, and `columns=` returns 400 with a JSON message.
3. **Dialog wired into the page** — done when: the browser shows the drawer, last4 is unchecked by default, the row count changes with scope, Download disables at zero columns, and the file lands with the right name.

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Ops can choose columns, last4 off by default | Test on the default selection. Browser: open drawer, last4 unchecked. `curl` with a column subset |
| Scope current filter or all, count visible | Browser: switch scope, count changes. `curl` with `scope=all` on a status filter returns more rows than without |
| Filename reflects scope and date | Test on `exportFilename`. `curl -I` shows `payments-disputed-<date>.csv` for status=disputed and `payments-all-<date>.csv` for scope=all |
| Amounts minor units internally, formatted once, currency in own column | Existing `toCsv` tests; no new formatter in the diff |
| Deselecting every column disables Download | Browser: uncheck all, button disabled. `curl` with empty `columns` returns 400 |

## Risks

- `exportFilename` gains a parameter, so its existing test changes. The ticket's filename criterion requires it.
- `filterPayments({})` for all payments relies on `PaymentFilters` staying all optional. It is today.

## Out of scope

- Fixing `sortPayments` amount ordering, which compares amounts as strings. Found while reading, left for its own ticket.
- Persisting a user's column choice across sessions. Persistence is NWP-203.

## Open questions

- None blocking. Column order in the file follows the order requested; the dialog sends registry order, so files from the UI are stable while API callers can choose their own layout.
