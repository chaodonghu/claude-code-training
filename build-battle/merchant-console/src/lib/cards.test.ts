import { describe, expect, it } from "vitest"
import { parseIssueCardInput } from "@/data/cards"
import {
  CARD_BIN,
  CARD_CATEGORIES,
  CARD_CATEGORY_LABELS,
  CARD_LIMIT_MAX,
  CARD_TRANSITIONS,
  canTransition,
  generateCardNumber,
  isValidLuhn,
  maskCard,
} from "./cards"
import { CardCategory, CardStatus } from "@/data/types"

/**
 * Nothing in this repository may resemble a real PAN, so the BIN and the
 * check digit are asserted over many draws rather than a single sample.
 */

/** The same PRNG the seed uses, so a failure reproduces on every machine. */
function seededRandom(seed: number) {
  let a = seed
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

describe("generateCardNumber", () => {
  it("produces 16 digits on the test BIN with a valid check digit", () => {
    const random = seededRandom(20260813)
    for (let draw = 0; draw < 200; draw++) {
      const number = generateCardNumber(random)
      expect(number).toMatch(/^\d{16}$/)
      expect(number.startsWith(CARD_BIN)).toBe(true)
      expect(isValidLuhn(number)).toBe(true)
    }
  })

  it("varies between draws", () => {
    const random = seededRandom(7)
    const drawn = new Set(
      Array.from({ length: 50 }, () => generateCardNumber(random)),
    )
    expect(drawn.size).toBeGreaterThan(1)
  })
})

describe("isValidLuhn", () => {
  it("rejects a number with one digit changed", () => {
    const number = generateCardNumber(seededRandom(99))
    const index = 8
    const digit = Number(number[index])
    const altered =
      number.slice(0, index) + ((digit + 1) % 10) + number.slice(index + 1)

    expect(isValidLuhn(number)).toBe(true)
    expect(isValidLuhn(altered)).toBe(false)
  })

  it("rejects anything that is not all digits", () => {
    expect(isValidLuhn("4242 4242 4242 4242")).toBe(false)
    expect(isValidLuhn("")).toBe(false)
  })
})

describe("maskCard", () => {
  it("shows the last four and nothing else", () => {
    expect(maskCard("4242")).toBe("•••• 4242")
  })
})

describe("canTransition", () => {
  const statuses: CardStatus[] = ["active", "frozen", "cancelled"]

  it("allows every legal move", () => {
    expect(canTransition("active", "frozen")).toBe(true)
    expect(canTransition("active", "cancelled")).toBe(true)
    expect(canTransition("frozen", "active")).toBe(true)
    expect(canTransition("frozen", "cancelled")).toBe(true)
  })

  it("refuses every illegal move, including same-state", () => {
    expect(canTransition("active", "active")).toBe(false)
    expect(canTransition("frozen", "frozen")).toBe(false)
    expect(canTransition("cancelled", "cancelled")).toBe(false)
    expect(canTransition("cancelled", "active")).toBe(false)
    expect(canTransition("cancelled", "frozen")).toBe(false)
  })

  it("agrees with the transition table on every pair", () => {
    for (const from of statuses) {
      for (const to of statuses) {
        expect(canTransition(from, to)).toBe(
          CARD_TRANSITIONS[from].includes(to),
        )
      }
    }
  })

  it("makes cancelled terminal", () => {
    expect(CARD_TRANSITIONS.cancelled).toEqual([])
  })
})

describe("CARD_LIMIT_MAX", () => {
  it("caps a card at 5,000,000 minor units", () => {
    expect(CARD_LIMIT_MAX).toBe(5_000_000)
  })
})

describe("the category lock", () => {
  const issue = (category: unknown) =>
    parseIssueCardInput({
      nickname: "Ads spend",
      merchantId: "mch_01",
      limit: 25000,
      currency: "USD",
      category,
    })

  it("accepts every category on the allowlist", () => {
    for (const category of CARD_CATEGORIES) {
      const result = issue(category)
      expect(result.ok).toBe(true)
      if (result.ok) expect(result.value.category).toBe(category)
    }
  })

  it("rejects one that is not on the allowlist", () => {
    for (const category of ["gambling", "", "OTHER", 3, null, undefined]) {
      const result = issue(category)
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.message).toMatch(/Category must be one of/)
    }
  })

  it("lists a label for every category", () => {
    for (const category of CARD_CATEGORIES) {
      expect(CARD_CATEGORY_LABELS[category as CardCategory]).toBeTruthy()
    }
  })
})

describe("the merchant currency lock", () => {
  const issue = (currency: unknown) =>
    parseIssueCardInput({
      nickname: "Ads spend",
      merchantId: "mch_01",
      limit: 25000,
      currency,
      category: "other",
    })

  it("accepts the merchant's own currency", () => {
    expect(issue("USD").ok).toBe(true)
  })

  it("rejects a currency the merchant does not settle in", () => {
    for (const currency of ["EUR", "GBP"]) {
      const result = issue(currency)
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.message).toMatch(/must be in USD/)
    }
  })
})
