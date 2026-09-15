import { NextRequest } from "next/server"
import { beforeEach, expect, it } from "vitest"
import { POST as statusRoute } from "@/app/api/cards/[id]/status/route"
import { GET as listRoute, POST as issueRoute } from "@/app/api/cards/route"
import { CARD_BIN, isValidLuhn } from "@/lib/cards"
import {
  cardById,
  issueCard,
  listCards,
  parseIssueCardInput,
  transitionCard,
} from "./cards"
import { store } from "./store"
import { Card, IssueCardInput } from "./types"

/** The store is a process-wide singleton, so every test starts from the seed. */
const seed: Card[] = store.cards.map((c) => ({ ...c, history: [...c.history] }))
const clone = (c: Card) => ({ ...c, history: [...c.history] })
beforeEach(() => {
  store.cards.splice(0, store.cards.length, ...seed.map(clone))
  store.issueKeys.clear()
})

const VALID: IssueCardInput = {
  nickname: "Ads spend",
  merchantId: "mch_01",
  limit: 25000,
  currency: "USD",
  category: "advertising",
}
const post = (path: string, body: unknown, headers: HeadersInit = {}) =>
  new NextRequest(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  })
const move = (id: string, status: string) =>
  statusRoute(post(`/api/cards/${id}/status`, { status }), {
    params: Promise.resolve({ id }),
  })

it("parses a valid body, trimming the nickname, and allows the cap exactly", () => {
  const trimmed = parseIssueCardInput({ ...VALID, nickname: "  Ads spend " })
  expect(trimmed).toEqual({ ok: true, value: VALID })
  expect(parseIssueCardInput({ ...VALID, limit: 5_000_000 }).ok).toBe(true)
})

it("rejects anything that is not an object", () => {
  for (const body of ["garbage", [VALID], null]) {
    const result = parseIssueCardInput(body)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.message).toMatch(/JSON object/)
  }
})

it.each([
  [{ nickname: "   " }, /nickname/],
  [{ nickname: "x".repeat(41) }, /40 characters/],
  [{ merchantId: undefined }, /Choose a merchant/],
  [{ merchantId: "mch_99" }, /does not exist/],
  [{ limit: 0 }, /greater than zero/],
  [{ limit: -1 }, /greater than zero/],
  [{ limit: 5_000_001 }, /5000000 minor units/],
  [{ limit: 250.5 }, /whole number/],
  [{ limit: "25000" }, /whole number/],
  [{ currency: "CAD" }, /one of USD, EUR, GBP/],
  [{ currency: "GBP" }, /must be in USD/],
  [{ category: "gambling" }, /Category must be/],
])("rejects %o on the server", (override, message) => {
  const result = parseIssueCardInput({ ...VALID, ...override })
  expect(result.ok).toBe(false)
  if (!result.ok) expect(result.message).toMatch(message)
})

it("issues a card that keeps the last four and a reference, never the number", () => {
  const { card, number } = issueCard(VALID)
  expect(number).toMatch(/^\d{16}$/)
  expect(number.startsWith(CARD_BIN)).toBe(true)
  expect(isValidLuhn(number)).toBe(true)
  expect(card.last4).toBe(number.slice(-4))
  expect(card.numberRef).toMatch(/^cn_[a-z0-9]{12}$/)
  expect(card).not.toHaveProperty("number")
  expect(JSON.stringify(store.cards)).not.toContain(number)
  expect(card.status).toBe("active")
  expect(card.limit).toBe(VALID.limit)
  expect(Number.isInteger(card.limit)).toBe(true)
  expect(card.history).toEqual([{ status: "active", at: card.createdAt }])
  expect(listCards()[0].id).toBe(card.id)
  expect(listCards()).toHaveLength(seed.length + 1)
  expect(cardById(card.id)).toBe(card)
  expect(cardById("card_nope")).toBeNull()
})

it("walks active to frozen to active to cancelled, recording each step", () => {
  const { card } = issueCard(VALID)
  for (const to of ["frozen", "active", "cancelled"] as const) {
    expect(transitionCard(card.id, to).ok).toBe(true)
    expect(card.status).toBe(to)
  }
  const statuses = card.history.map((e) => e.status)
  expect(statuses).toEqual(["active", "frozen", "active", "cancelled"])
})

it("refuses an illegal move or an unknown id, leaving the card alone", () => {
  const missing = { ok: false, status: 404, message: "No card with that id." }
  expect(transitionCard("card_nope", "frozen")).toEqual(missing)
  const { card } = issueCard(VALID)
  expect(transitionCard(card.id, "active")).toMatchObject({ status: 409 })
  transitionCard(card.id, "cancelled")
  for (const to of ["active", "frozen", "cancelled"] as const) {
    const result = transitionCard(card.id, to)
    expect(result).toMatchObject({ ok: false, status: 409 })
    if (!result.ok)
      expect(result.message).toBe(`A cancelled card cannot move to ${to}.`)
  }
  expect(card.status).toBe("cancelled")
  expect(card.history).toHaveLength(2)
})

it("POST returns 201 with the number exactly once, never in the list", async () => {
  const response = await issueRoute(post("/api/cards", VALID))
  const body = await response.json()
  expect(response.status).toBe(201)
  expect(body.number).toMatch(/^4242\d{12}$/)
  expect(body.card.last4).toBe(body.number.slice(-4))
  expect(body.card).not.toHaveProperty("number")
  const list = JSON.stringify(await (await listRoute()).json())
  expect(list).not.toContain(body.number)
  expect(list).not.toContain('"number"')
})

it("POST returns 400 for an invalid body and for non-JSON, storing nothing", async () => {
  const bad = await issueRoute(post("/api/cards", { ...VALID, limit: 0 }))
  expect(bad.status).toBe(400)
  expect((await bad.json()).message).toMatch(/greater than zero/)
  const garbage = await issueRoute(post("/api/cards", "not json"))
  expect(garbage.status).toBe(400)
  expect((await garbage.json()).message).toMatch(/JSON object/)
  expect(store.cards).toHaveLength(seed.length)
})

it("POST replays an idempotency key instead of issuing twice", async () => {
  const headers = { "idempotency-key": "issue-test-1" }
  const one = await (
    await issueRoute(post("/api/cards", VALID, headers))
  ).json()
  const again = await issueRoute(post("/api/cards", VALID, headers))
  const body = await again.json()
  expect(again.status).toBe(200)
  expect(body).toEqual({ card: one.card, replayed: true })
  expect(body).not.toHaveProperty("number")
  expect(store.cards).toHaveLength(seed.length + 1)
  await issueRoute(post("/api/cards", VALID))
  await issueRoute(post("/api/cards", VALID))
  expect(store.cards).toHaveLength(seed.length + 3)
})

it("status route moves a card, 400 bad status, 409 illegal, 404 unknown", async () => {
  const { card } = issueCard(VALID)
  const frozen = await move(card.id, "frozen")
  expect(frozen.status).toBe(200)
  expect((await frozen.json()).card.status).toBe("frozen")
  const bogus = await move(card.id, "deleted")
  expect(bogus.status).toBe(400)
  expect((await bogus.json()).message).toMatch(/Status must be one of/)
  expect((await move(card.id, "cancelled")).status).toBe(200)
  const revived = await move(card.id, "active")
  expect(revived.status).toBe(409)
  const message = (await revived.json()).message
  expect(message).toBe("A cancelled card cannot move to active.")
  expect(cardById(card.id)?.status).toBe("cancelled")
  expect((await move("card_nope", "frozen")).status).toBe(404)
})
