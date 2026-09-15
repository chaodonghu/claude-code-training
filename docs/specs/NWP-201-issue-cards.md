# SPEC · NWP-201 — Issue virtual cards from the console

> Written before any code. Generated with `/spec`, then edited by a human.
> Load it as context when you build: `@docs/specs/NWP-201-issue-cards.md`

**Ticket:** [NWP-201](../tickets/NWP-201.md) · **Author:** Dong Hu · **Status:** done

## Problem

Ops issues virtual cards by messaging the platform team, who create them by hand. It takes hours, happens twelve to twenty times a week, and last month two cards got the wrong limit because the request lived in a Slack thread. Ops needs to issue a card, see the cards they have issued, and open one to check it.

## Current state

- Nothing card-shaped exists. `src/data/types.ts` has Payment, Refund, Dispute, Payout, Merchant; `src/data/store.ts` holds those on `globalThis`. No `/cards` route, no card API.
- Every route handler is a `GET` (`src/app/api/payments/route.ts`, `src/app/api/payments/export/route.ts`). The write path has no neighbour to copy.
- Seed data is generated, not JSON: `src/data/generate.ts` runs a seeded PRNG over `GENERATED_AT`. Cards join the seed there.
- Reusable: `formatMoney` and `parseAmountToMinorUnits` in `src/lib/money.ts`; merchants carry `currency` and `timezone` in `src/data/merchants.ts`; `StatusBadge.tsx` maps statuses through lookup tables; `AppSidebar.tsx`, `Breadcrumbs.tsx`, and `siteConfig.ts` hold navigation as data; `src/components/Drawer.tsx` is the Radix Dialog; `src/app/payments/[id]/page.tsx` is the detail layout to follow. Tests are node-only vitest over `src/**/*.test.ts`.

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| "Money is integer minor units. A `$250.00` limit is `25000`." | ticket, `CLAUDE.md` | Limits drift or compare wrong |
| "Never persist or display a full card number after creation. Store the last four and the generated number's reference." | ticket, `.claude/rules/cards.md` | A PAN in the store or a payload |
| "Status is a state machine. `active → frozen → active`, either to `cancelled`, `cancelled` is terminal." | ticket, `CLAUDE.md` | A cancelled card comes back |
| "Every generated number starts `4242` and carries a valid Luhn check digit." Generate on the server. | `.claude/rules/cards.md` | A number that could resemble a real PAN |
| "Validate everything from the client against an allowlist." Same error shape everywhere. | `.claude/rules/api-routes.md` | Bad input lands in the store |
| "Dialogs and forms must be operable." | `.claude/rules/components.md` | Ops cannot drive it by keyboard |

## Approach

A `Card` type with no number field, so storing one cannot compile. Pure logic in `src/lib/cards.ts`: Luhn, generation on the `4242` BIN from an injected random source, masking, and `CARD_TRANSITIONS` as a table with `canTransition`. Store operations in `src/data/cards.ts` with `parseIssueCardInput` as the allowlist boundary. Thin routes under `src/app/api/cards/`. A `/cards` server page with an issue drawer that posts, shows the number once on a success screen, and discards it on close. A `/cards/[id]` detail page with spend against limit. Six seeded cards.

**Rejected:** a separate reveal page (puts the number in a server render and history); Server Actions (the app's rule is route handlers write the store); a `numberRef` derived from the PAN (a hash is a lookup table away from it); a decimal-string limit on the API (the form converts with the boundary helper, the API takes integer minor units).

## File map

| File | Why |
| --- | --- |
| `src/data/types.ts` | `Card`, `CardStatus`, `CardCategory`, `CardEvent`, `IssueCardInput`, `Payment.cardId` |
| `src/lib/cards.ts`, `cards.test.ts` | Luhn, generator, mask, transitions, allowlists; tests beside |
| `src/data/cards.ts`, `cards.test.ts` | parse, issue, list, lookup, transition; store and route tests |
| `src/data/generate.ts`, `store.ts` | seeded cards, `cards` and `issueKeys` on the store |
| `src/data/queries.ts`, `queries.test.ts` | `spentOnCard`; numeric amount sort |
| `src/app/api/cards/route.ts`, `[id]/route.ts`, `[id]/status/route.ts` | list and issue, detail, transition |
| `src/app/cards/page.tsx`, `issue-card-drawer.tsx`, `card-status-actions.tsx`, `[id]/page.tsx`, `[id]/not-found.tsx` | list, drawer, freeze/unfreeze/cancel, detail, written 404 |
| `StatusBadge.tsx`, `siteConfig.ts`, `AppSidebar.tsx`, `Breadcrumbs.tsx` | card statuses and navigation |

## Plan

1. Types, `lib/cards.ts`, tests first. Done when `npm test` goes red then green on Luhn and every transition pair.
2. Store operations and seed. Done when six cards exist on boot with no number, typecheck clean.
3. Routes. Done when curl shows 201 with a Luhn-valid `4242` number, `last4` only in list and detail, 400 per rejection, 409 on an illegal move.
4. List, drawer, navigation. Done when a card is issued in the browser, revealed once, and masked in the list after close.
5. Detail with spend against limit. Done when a seeded card shows it and a bad id 404s.
6. Stretch after 5: freeze and unfreeze without reload, amber past 80 percent, category lock, written empty and error states.

## Verification

Luhn, transitions, categories: `src/lib/cards.test.ts`. Parser rejections, issue storing only the last four, history, and the route handlers with real requests: `src/data/cards.test.ts`. Curl: valid POST, every rejection, list and detail without a number, cancel then reactivate 409, currency mismatch 400, idempotent replay. Browser: issue, reveal once, mask, freeze without reload, cancel confirm, amber bar, 404.

## Departures from the plan

- Category lock arrived in the model early because it changes the type. `CARD_STATUSES` is derived from the transition table for the status route.
- After review feedback, five unlisted items were added: currency must match the merchant (server rejects, drawer field read-only); idempotent issue on `Idempotency-Key` with a replay returning the card and no number; inline cancel confirmation; a `history` of status events shown on the detail page; and spend derived by `spentOnCard` in `src/data/queries.ts` from captured payments tagged with `cardId`, the seed tagging real merchant-matched payments instead of storing a number.
- `sortPayments` compared amounts as strings. Fixed in passing, with a test.

## Out of scope

Persistence (NWP-203), auth, issuer calls, editing a limit after issue (NWP-202). Refunds against tagged payments do not reduce card spend.
