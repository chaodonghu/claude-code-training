import { NextRequest } from "next/server"
import { describe, expect, it } from "vitest"
import { CARD_BIN, CARD_LIMIT_MAX, isValidLuhn } from "@/lib/cards"
import { POST as statusRoute } from "./[id]/status/route"
import { GET, POST } from "./route"

/** The store is shared, so each case names its own card and counts nothing. */
const VALID = {
  nickname: "Route valid",
  merchantId: "mch_01",
  limit: 25000,
  currency: "USD",
  category: "advertising",
}

const issue = (body: unknown, key?: string) =>
  POST(
    new NextRequest("http://localhost/api/cards", {
      method: "POST",
      body: JSON.stringify(body),
      headers: {
        "content-type": "application/json",
        ...(key ? { "idempotency-key": key } : {}),
      },
    }),
  )

const setStatus = (id: string, status: string) =>
  statusRoute(
    new NextRequest(`http://localhost/api/cards/${id}/status`, {
      method: "POST",
      body: JSON.stringify({ status }),
      headers: { "content-type": "application/json" },
    }),
    { params: Promise.resolve({ id }) },
  )

describe("POST /api/cards", () => {
  it("returns 201 with a test-BIN number that the card itself never carries", async () => {
    const response = await issue({ ...VALID, nickname: "Route reveal" })
    const body = await response.json()
    expect(response.status).toBe(201)
    expect(body.number).toMatch(/^\d{16}$/)
    expect(body.number.startsWith(CARD_BIN)).toBe(true)
    expect(isValidLuhn(body.number)).toBe(true)
    expect(body.card).not.toHaveProperty("number")
  })

  it("rejects a currency the merchant does not settle in", async () => {
    const response = await issue({ ...VALID, currency: "GBP" })
    expect(response.status).toBe(400)
    expect((await response.json()).message).toMatch(/must be in USD/)
  })

  it("rejects a limit above the cap", async () => {
    const response = await issue({ ...VALID, limit: CARD_LIMIT_MAX + 1 })
    expect(response.status).toBe(400)
    expect((await response.json()).message).toMatch(/minor units or less/)
  })

  it("replays an idempotency key rather than issuing twice", async () => {
    const key = "route-test-key"
    const first = await issue({ ...VALID, nickname: "Route replay" }, key)
    const second = await issue({ ...VALID, nickname: "Route replay" }, key)
    const [a, b] = [await first.json(), await second.json()]
    expect([first.status, second.status]).toEqual([201, 200])
    expect(b.card.id).toBe(a.card.id)
    expect(b).not.toHaveProperty("number")
  })
})

describe("GET /api/cards", () => {
  it("never carries a number on any card", async () => {
    await issue({ ...VALID, nickname: "Route listed" })
    const body = await (await GET()).json()
    expect(JSON.stringify(body)).not.toContain('"number"')
  })
})

describe("POST /api/cards/[id]/status", () => {
  it("refuses to reactivate a cancelled card", async () => {
    const issued = await issue({ ...VALID, nickname: "Route cancelled" })
    const { card } = await issued.json()

    expect((await setStatus(card.id, "cancelled")).status).toBe(200)
    const reactivate = await setStatus(card.id, "active")
    expect(reactivate.status).toBe(409)
    expect((await reactivate.json()).message).toMatch(/cannot move to active/)
  })
})
