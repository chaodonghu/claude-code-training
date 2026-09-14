import { describe, expect, it } from "vitest"
import { sortPayments } from "./queries"
import { Payment } from "./types"

/**
 * Amounts are integer minor units, so they sort numerically. Comparing them
 * as strings puts 100000 before 25000, which is how a big payment hides at
 * the top of a page sorted by amount.
 */

const payment = (id: string, amount: number): Payment => ({
  id,
  merchantId: "mch_01",
  amount,
  currency: "USD",
  status: "captured",
  method: "card",
  cardBrand: "visa",
  last4: "4242",
  createdAt: "2026-08-01T00:00:00.000Z",
  description: "Online order",
})

describe("sortPayments by amount", () => {
  const rows = [payment("a", 25000), payment("b", 9000), payment("c", 100000)]

  it("orders ascending by value, not by digit string", () => {
    expect(sortPayments(rows, "amount", "asc").map((p) => p.amount)).toEqual([
      9000, 25000, 100000,
    ])
  })

  it("orders descending by value", () => {
    expect(sortPayments(rows, "amount", "desc").map((p) => p.amount)).toEqual([
      100000, 25000, 9000,
    ])
  })
})
