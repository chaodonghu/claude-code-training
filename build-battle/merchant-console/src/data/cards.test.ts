import { beforeEach, describe, expect, it } from "vitest"
import { NextRequest } from "next/server"
import { GET as listRoute, POST as issueRoute } from "@/app/api/cards/route"
import { POST as statusRoute } from "@/app/api/cards/[id]/status/route"
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

/**
 * The store is a process-wide singleton, so every test starts from the seed
 * and the tests below never depend on an id another test created.
 */

const seed: Card[] = store.cards.map((card) => ({
  ...card,
  history: [...card.history],
}))

beforeEach(() => {
  store.cards.length = 0
  for (const card of seed) {
    store.cards.push({ ...card, history: [...card.history] })
  }
  store.issueKeys.clear()
})

const VALID: IssueCardInput = {
  nickname: "Ads spend",
  merchantId: "mch_01",
  limit: 25000,
  currency: "USD",
  category: "advertising",
}

const request = (
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
) =>
  new NextRequest(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  })

const params = (id: string) => ({ params: Promise.resolve({ id }) })

describe("parseIssueCardInput", () => {
  it("accepts a complete, valid body and trims the nickname", () => {
    const result = parseIssueCardInput({ ...VALID, nickname: "  Ads spend " })
    expect(result).toEqual({ ok: true, value: VALID })
  })

  it("rejects each bad field on the server, with a plain message", () => {
    const cases: [string, unknown, RegExp][] = [
      ["not an object", "garbage", /JSON object/],
      ["an array", [VALID], /JSON object/],
      ["blank nickname", { ...VALID, nickname: "   " }, /nickname/],
      [
        "long nickname",
        { ...VALID, nickname: "x".repeat(41) },
        /40 characters/,
      ],
      [
        "missing merchant",
        { ...VALID, merchantId: undefined },
        /Choose a merchant/,
      ],
      [
        "unknown merchant",
        { ...VALID, merchantId: "mch_99" },
        /does not exist/,
      ],
      ["zero limit", { ...VALID, limit: 0 }, /greater than zero/],
      ["negative limit", { ...VALID, limit: -1 }, /greater than zero/],
      [
        "limit over the cap",
        { ...VALID, limit: 5_000_001 },
        /5000000 minor units/,
      ],
      ["float limit", { ...VALID, limit: 250.5 }, /whole number/],
      ["string limit", { ...VALID, limit: "25000" }, /whole number/],
      [
        "currency off the allowlist",
        { ...VALID, currency: "CAD" },
        /one of USD, EUR, GBP/,
      ],
      [
        "currency the merchant does not use",
        { ...VALID, currency: "GBP" },
        /must be in USD/,
      ],
      [
        "category off the allowlist",
        { ...VALID, category: "gambling" },
        /Category must be/,
      ],
    ]
    for (const [label, body, message] of cases) {
      const result = parseIssueCardInput(body)
      expect(result.ok, label).toBe(false)
      if (!result.ok) expect(result.message, label).toMatch(message)
    }
  })

  it("accepts the limit cap exactly", () => {
    expect(parseIssueCardInput({ ...VALID, limit: 5_000_000 }).ok).toBe(true)
  })
})

describe("issueCard", () => {
  it("stores the last four and a reference, never the number", () => {
    const { card, number } = issueCard(VALID)

    expect(number).toMatch(/^\d{16}$/)
    expect(number.startsWith(CARD_BIN)).toBe(true)
    expect(isValidLuhn(number)).toBe(true)
    expect(card.last4).toBe(number.slice(-4))
    expect(card.numberRef).toMatch(/^cn_[a-z0-9]{12}$/)
    expect(card).not.toHaveProperty("number")
    expect(JSON.stringify(store.cards)).not.toContain(number)
  })

  it("starts active with one history entry", () => {
    const { card } = issueCard(VALID)

    expect(card.status).toBe("active")
    expect(card.limit).toBe(VALID.limit)
    expect(Number.isInteger(card.limit)).toBe(true)
    expect(card.history).toEqual([{ status: "active", at: card.createdAt }])
  })

  it("appears first in the list, which is newest first", () => {
    const { card } = issueCard(VALID)
    const listed = listCards()

    expect(listed[0].id).toBe(card.id)
    expect(listed.length).toBe(seed.length + 1)
    expect(cardById(card.id)).toBe(card)
    expect(cardById("card_nope")).toBeNull()
  })
})

describe("transitionCard", () => {
  it("returns 404 for an unknown card", () => {
    const result = transitionCard("card_nope", "frozen")
    expect(result).toEqual({
      ok: false,
      status: 404,
      message: "No card with that id.",
    })
  })

  it("walks active → frozen → active → cancelled and records each step", () => {
    const { card } = issueCard(VALID)

    for (const to of ["frozen", "active", "cancelled"] as const) {
      const result = transitionCard(card.id, to)
      expect(result.ok).toBe(true)
      expect(card.status).toBe(to)
    }
    expect(card.history.map((event) => event.status)).toEqual([
      "active",
      "frozen",
      "active",
      "cancelled",
    ])
  })

  it("refuses an illegal move with 409 and leaves the card alone", () => {
    const { card } = issueCard(VALID)

    const same = transitionCard(card.id, "active")
    expect(same).toMatchObject({ ok: false, status: 409 })

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
})

describe("POST /api/cards", () => {
  it("returns 201 with the number exactly once", async () => {
    const response = await issueRoute(request("/api/cards", VALID))
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(body.number).toMatch(/^4242\d{12}$/)
    expect(body.card.last4).toBe(body.number.slice(-4))
    expect(body.card).not.toHaveProperty("number")

    const list = await (await listRoute()).json()
    expect(JSON.stringify(list)).not.toContain(body.number)
    expect(JSON.stringify(list)).not.toContain('"number"')
  })

  it("returns 400 with a message for an invalid body and for non-JSON", async () => {
    const invalid = await issueRoute(
      request("/api/cards", { ...VALID, limit: 0 }),
    )
    expect(invalid.status).toBe(400)
    expect((await invalid.json()).message).toMatch(/greater than zero/)

    const garbage = await issueRoute(request("/api/cards", "not json"))
    expect(garbage.status).toBe(400)
    expect((await garbage.json()).message).toMatch(/JSON object/)

    expect(store.cards).toHaveLength(seed.length)
  })

  it("replays an idempotency key instead of issuing twice, without the number", async () => {
    const headers = { "idempotency-key": "issue-test-1" }
    const first = await (
      await issueRoute(request("/api/cards", VALID, headers))
    ).json()
    const second = await issueRoute(request("/api/cards", VALID, headers))
    const body = await second.json()

    expect(second.status).toBe(200)
    expect(body).toEqual({ card: first.card, replayed: true })
    expect(body).not.toHaveProperty("number")
    expect(store.cards).toHaveLength(seed.length + 1)
  })

  it("issues two cards when no key is sent", async () => {
    await issueRoute(request("/api/cards", VALID))
    await issueRoute(request("/api/cards", VALID))
    expect(store.cards).toHaveLength(seed.length + 2)
  })
})

describe("POST /api/cards/[id]/status", () => {
  it("moves a card and returns it, 400 on a bad status, 409 on an illegal move", async () => {
    const { card } = issueCard(VALID)
    const path = `/api/cards/${card.id}/status`

    const frozen = await statusRoute(
      request(path, { status: "frozen" }),
      params(card.id),
    )
    expect(frozen.status).toBe(200)
    expect((await frozen.json()).card.status).toBe("frozen")

    const bogus = await statusRoute(
      request(path, { status: "deleted" }),
      params(card.id),
    )
    expect(bogus.status).toBe(400)
    expect((await bogus.json()).message).toMatch(/Status must be one of/)

    const cancelled = await statusRoute(
      request(path, { status: "cancelled" }),
      params(card.id),
    )
    expect(cancelled.status).toBe(200)

    const revived = await statusRoute(
      request(path, { status: "active" }),
      params(card.id),
    )
    expect(revived.status).toBe(409)
    expect((await revived.json()).message).toBe(
      "A cancelled card cannot move to active.",
    )
    expect(cardById(card.id)?.status).toBe("cancelled")
  })

  it("returns 404 for an unknown card", async () => {
    const response = await statusRoute(
      request("/api/cards/card_nope/status", { status: "frozen" }),
      params("card_nope"),
    )
    expect(response.status).toBe(404)
  })
})
