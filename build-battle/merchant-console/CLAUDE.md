# Northwind Payments — Merchant Console

The internal tool support and ops staff use to look up a payment, refund it, work the dispute queue, and issue virtual cards.

Northwind Payments is fictional. Every merchant, cardholder, amount, and card in this app is generated.

## Commands

npm, with `package-lock.json` checked in. The `pnpm.overrides` key in `package.json` is inert.

```bash
npm ci                                  # install from the lockfile
npm run dev                             # Next.js dev server on http://localhost:3000, / redirects to /overview
npm test                                # vitest run, node environment, src/**/*.test.ts only
npx vitest run src/lib/csv.test.ts      # one file
npx vitest run -t "quotes cells"        # tests whose name matches
npm run lint                            # next lint
npx tsc --noEmit                        # typecheck; there is no npm script for it
npm run build
```

No database, no seed step, no Docker. Tests have no DOM, so components are verified in the browser, not in vitest.

## Data lives in memory

Seed data is generated in code at boot, not loaded from JSON: `src/data/generate.ts` runs a seeded PRNG over a fixed anchor date, so every machine gets identical records. `src/data/store.ts` holds the result on `globalThis` so dev-server module reloads keep one copy. Route handlers and server components read and write that store.

- Writes last for the life of the dev server and vanish on restart. That is expected.
- Persistence is tracked separately as NWP-203. **Do not add a database, an ORM, or migrations.**
- If you need more seed data, change `generate.ts`. Never edit seed data to make a failing case disappear.
- `GENERATED_AT` in `generate.ts` (2026-08-13) anchors every "last N days" window. Dashboards are relative to it, not to today, so they do not drift as the calendar moves.

## Where the rest of the context lives

This file loads every session, so it stays short. Detail that only matters once you open a particular kind of file lives in `.claude/rules/` and loads when you do:

| Rule | Applies to |
| --- | --- |
| `money.md` | `src/lib/`, `src/app/api/`, `src/data/` |
| `api-routes.md` | `src/app/api/` |
| `cards.md` | anything card-related |
| `components.md` | `src/components/`, `src/app/` |

## Conventions

These four explain most of the code, and breaking them is how bugs get in here.

1. **Money is integer minor units.** `$250.00` is `25000`. No floats, no strings with currency symbols. Format once, at the edge, next to its currency code.
2. **Storage and bucketing are UTC.** Display converts to the merchant's timezone. Nothing else does.
3. **One query builder.** Payment filtering goes through the builder behind `GET /api/payments`. A second implementation is a bug, not a shortcut.
4. **Validate on the server.** Anything from the client — column names, currencies, limits, statuses — is checked against an allowlist before it reaches a query, a filename, or the store.

## How a request flows

- **The URL is the filter state.** `src/app/payments/filter-bar.tsx` (client) pushes `status`, `merchantId`, and `search` as search params. `src/app/payments/page.tsx` (server) reads them, calls `queryPayments`, and renders. Nothing is held in React state across navigations.
- **Route handlers parse with `parseFilters`** in `src/data/queries.ts`, which is the allowlist boundary. `page.tsx` builds its filters inline with its own status allowlist; keep the two in step if you add a filter.
- **`filterPayments` / `sortPayments` / `paginate`** compose into `queryPayments`. The CSV export calls the first two and skips `paginate` on purpose, so it returns the whole filtered set rather than the page on screen.
- **The dialog primitive is `src/components/Drawer.tsx`**, a Radix Dialog styled as a side sheet. There is no `Dialog.tsx`, and `tailwind.config.ts` has no dialog keyframes.

## Card rules

- Generated numbers use the `4242` test BIN and a valid Luhn check digit. Nothing here may resemble a real PAN.
- The full number is returned exactly once, in the creation response. After that, last four only.
- Status is a state machine: `active ⇄ frozen`, either to `cancelled`, and `cancelled` is terminal.

## Layout

| Path | What lives there |
| --- | --- |
| `src/app/` | Console routes: overview, payments, disputes, payouts. Cards is NWP-201 and does not exist yet |
| `src/app/api/` | Route handlers |
| `src/data/` | Generated seed data, the in-memory store, the query builder, and types |
| `src/components/` | Tremor-based primitives and the console's own components |
| `src/lib/` | Money, date, and CSV helpers, each with a `.test.ts` beside it. Read these before touching an amount |

## Before you push

Run `npm test`, then `/ship-ready`. The skill checks the rules above, not just formatting.
