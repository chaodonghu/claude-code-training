# SPEC · NWP-201 — Issue virtual cards from the console

> Written before any code. Generated with `/spec`, then edited by a human.
> Load it as context when you build: `@docs/specs/NWP-201-issue-cards.md`

**Ticket:** [NWP-201](../tickets/NWP-201.md)
**Author:** Dong Hu
**Status:** reviewed

## Problem

Ops issues virtual cards by messaging the platform team, who create them by hand. It takes hours, happens twelve to twenty times a week, and last month two cards got the wrong spend limit because the request lived in a Slack thread. Ops needs to issue a card, see the cards they have issued, and open one to check it.

## Current state

- **Nothing card-shaped exists.** `src/data/types.ts` has Payment, Refund, Dispute, Payout, Merchant. `src/data/store.ts` holds those five collections on `globalThis`. No `/cards` route, no `Card` type, no card API. `CLAUDE.md` says so in its layout table.
- **Every route handler is a `GET`.** `src/app/api/payments/route.ts` and `src/app/api/payments/export/route.ts`. There is no POST or mutation anywhere, so the write path is new ground and has no neighbour to copy.
- **Seed data is generated, not JSON.** `src/data/generate.ts` runs a seeded PRNG (`mulberry32`) over `GENERATED_AT`, returns `{ payments, refunds, disputes, payouts }`, and `store.ts` wraps it. The ticket says "seeded from JSON"; the code disagrees. Adding cards means extending `generate()` and the `Store` interface.
- **Money helpers exist.** `src/lib/money.ts` has `formatMoney(minorUnits, currency)` and `parseAmountToMinorUnits(input)` marked "Boundary only". The limit field uses both.
- **Merchants carry a currency.** `src/data/merchants.ts` gives each merchant `currency` and `timezone`. The form can default the card currency from the merchant, which the ticket does not mention.
- **Status badges are a lookup table.** `src/components/ui/payments/StatusBadge.tsx` maps every status union to label, dot, and variant. Card statuses extend those three records.
- **Navigation is a list.** `src/components/ui/navigation/AppSidebar.tsx` `navigation` array reads hrefs from `src/app/siteConfig.ts` `baseLinks`. `src/components/ui/navigation/Breadcrumbs.tsx` has a `LABELS` map by path segment. Cards needs an entry in each.
- **Detail page pattern.** `src/app/payments/[id]/page.tsx` shows the shape: back link, `h1` amount, badge, `dl` of `Field`s, `notFound()` on a bad id.
- **Dialog primitive.** `src/components/Drawer.tsx` is a Radix Dialog. No `Dialog.tsx` exists. The NWP-101 drawer on the sibling branch is a working example of a form inside it.
- **Tests are node-only vitest** over `src/**/*.test.ts` (`vitest.config.ts`). Luhn and the state machine test fine there; components do not.

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| "Money is integer minor units. A `$250.00` limit is `25000`. Never a float, never a string with a dollar sign." | ticket, `CLAUDE.md` | Limits drift or compare wrong |
| "Never persist or display a full card number after creation. Store the last four and the generated number's reference." | ticket, `.claude/rules/cards.md` | A PAN in the store, a list payload, or client state after the success screen |
| "Status is a state machine. `active → frozen → active`, and either can go to `cancelled`. `cancelled` is terminal." | ticket, `CLAUDE.md` | A cancelled card comes back |
| "Every generated number starts `4242` and carries a valid Luhn check digit." | `.claude/rules/cards.md` | A number that could resemble a real PAN |
| "Generate on the server. A card number produced in the browser is a bug." | `.claude/rules/cards.md` | Reveal-once cannot be enforced |
| "Validate everything from the client against an allowlist before it reaches the store." | `.claude/rules/api-routes.md` | Bad limits and currencies land in the store |
| "Return the same error shape everywhere: a status code that means what it says, and a body with a message safe to show a user." | `.claude/rules/api-routes.md` | The form cannot show why it failed |
| "Dialogs and forms must be operable. Every input has a label, the dialog has an accessible name, focus moves into it and returns on close, Escape closes it." | `.claude/rules/components.md` | Ops cannot drive it by keyboard |

## Approach

Model the card as a typed record with a status state machine encoded as a transition table, not scattered conditionals. Pure card logic lives in `src/lib/cards.ts`: Luhn check digit, number generation on the `4242` BIN from an injected random source so the seed and tests are deterministic, masking, and `CARD_TRANSITIONS` with a `canTransition` guard. Store operations live in `src/data/cards.ts`: parse and validate the issue payload against allowlists, generate the number, store only `last4` and an opaque `numberRef`, return the full number once to the caller, list, lookup, and transition. Route handlers under `src/app/api/cards/` are thin: `POST /api/cards` returns 201 with the masked card plus the number, `GET /api/cards`, `GET /api/cards/[id]`, and `POST /api/cards/[id]/status` for freeze, unfreeze, and cancel with 409 on an illegal move. The `/cards` page is a server component rendering the list from the store with a written empty state and an `IssueCardDrawer` client component. The drawer posts to the API, then swaps to a success screen showing the number once with a copy button; closing clears it from state and calls `router.refresh()` so the list shows the new card masked. `/cards/[id]` follows the payments detail layout and shows `spent` against `limit`, with a bar that turns amber past 80 percent. The seed gets six cards across all three statuses with varied spend so the list and detail have something to show on first load. Spend is a `spent` field in minor units; new cards start at 0.

**Considered and rejected:**
- A separate `/cards/[id]/issued` page for the reveal. Puts the number in a server render and a browser history entry. The drawer's success screen keeps it in one client state object that is discarded on close.
- Server Actions for the mutation. Nothing in the app uses them, and `CLAUDE.md` says route handlers read and write the store. Following the neighbourhood.
- Accepting the limit as a decimal string on the API. The existing `parseAmountToMinorUnits` is marked boundary-only and the form is the boundary for typed text. The API takes an integer in minor units and validates it as one, so the wire contract matches the store.
- Deriving `numberRef` from the number. A hash of the PAN is a lookup table away from the PAN. The ref is random and opaque.

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/data/types.ts` | change | `Card`, `CardStatus`, `IssueCardInput` |
| `src/lib/cards.ts` | add | Luhn, `generateCardNumber(random)`, `maskCard`, `CARD_TRANSITIONS`, `canTransition`, `CARD_LIMIT_MAX` |
| `src/lib/cards.test.ts` | add | BIN, length, Luhn validity over many draws; every legal and illegal transition; the limit bounds |
| `src/data/cards.ts` | add | `parseIssueCardInput`, `issueCard`, `listCards`, `cardById`, `transitionCard` |
| `src/data/generate.ts`, `src/data/store.ts` | change | Six seeded cards; `cards` on the `Store` |
| `src/app/api/cards/route.ts` | add | `GET` list, `POST` issue |
| `src/app/api/cards/[id]/route.ts` | add | `GET` detail |
| `src/app/api/cards/[id]/status/route.ts` | add | `POST` transition |
| `src/app/cards/page.tsx` | add | List table, empty state, issue drawer trigger |
| `src/app/cards/issue-card-drawer.tsx` | add | Client form, success screen with one-time number |
| `src/app/cards/[id]/page.tsx` | add | Detail with spend against limit |
| `src/components/ui/payments/StatusBadge.tsx` | change | `CardStatus` in the three lookup tables |
| `src/app/siteConfig.ts`, `AppSidebar.tsx`, `Breadcrumbs.tsx` | change | Cards in navigation |

## Plan

1. **Types, `lib/cards.ts`, tests first** — done when: `npm test` goes red on the new file, then green, with Luhn and transition cases passing.
2. **Store operations and seed** — done when: `store.cards` has six cards on boot and none carries a full number; `npx tsc --noEmit` clean.
3. **Routes** — done when: curl `POST /api/cards` returns 201 with a `4242` number that passes Luhn, `GET` list and detail carry `last4` and no number, each rejection case returns 400 with a message, an illegal transition returns 409.
4. **List page, drawer, navigation** — done when: `/cards` renders the seed, the drawer issues a card, the success screen shows the number once, closing it shows the card masked in the list.
5. **Detail page** — done when: `/cards/<id>` shows the record and spend against limit; a bad id 404s.
6. **Stretch, in order** — freeze and unfreeze from the list without reload; amber bar past 80 percent; merchant category lock; written empty and error states.

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Issue a card; it appears in the list | Browser: fill the drawer, submit, close, new row present. curl `POST` then `GET` list |
| Card list at `/cards` with the six fields | Browser: table columns. Seeded rows on first load |
| Card detail with spend against limit | Browser: open a seeded card with spend. curl `GET /api/cards/<id>` |
| Numbers server-side on `4242` with valid Luhn | `cards.test.ts` over many draws. curl the POST response and check the prefix and Luhn by hand |
| Reveal once, mask forever | curl: number present in the POST body only, absent from list and detail. Browser: success screen shows it, list and detail show `•••• 1234`. Grep the store type for a number field |
| Server-side validation | curl each of: no merchant, unknown merchant, limit 0, limit -1, limit 5,000,001, limit 250.5, currency CAD. Each 400 with a message. `parseIssueCardInput` tests |
| State machine | `cards.test.ts` covers every pair. curl cancel then unfreeze returns 409 |

## Risks

- **A PAN leaking into a payload or state.** The `Card` type has no number field, so the compiler enforces storage. The reveal exists only in the POST response and drawer state, and closing the drawer resets that state.
- **The write path is new.** No existing mutation route to copy. The error shape from `api-routes.md` is the contract; the form renders `message` from a non-2xx response.
- **Clock.** 45 minutes. Steps 1 to 5 are core. Step 6 is only started after step 5 verifies.

## Out of scope

- Persistence (NWP-203), auth, real issuer calls, editing a limit after issue (NWP-202).
- Recording spend from payments. `spent` is a stored field; no card transactions exist in the store.

## Open questions

- Currency defaults to the issuing merchant's currency and can be changed to any of the three. A mismatch is allowed, not rejected, since the ticket only names the allowlist. Reverse this if ops should never issue a card in a foreign currency.
- Nickname is required, trimmed, and capped at 40 characters. The ticket sets no length; 40 fits the table.
