import { describe, expect, it } from "vitest"
import {
  CARD_BIN,
  CARD_CATEGORIES,
  CARD_CATEGORY_LABELS,
  CARD_LIMIT_MAX,
  CARD_STATUSES,
  CARD_TRANSITIONS,
  canTransition,
  generateCardNumber,
  isValidLuhn,
  maskCard,
} from "./cards"

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
  // Nothing here may resemble a real PAN, so many draws, not one sample.
  it("draws 16 digits on the test BIN with a valid check digit, and varies", () => {
    const random = seededRandom(20260813)
    const drawn = new Set<string>()
    for (let draw = 0; draw < 200; draw++) {
      const number = generateCardNumber(random)
      expect(number).toMatch(/^\d{16}$/)
      expect(number.startsWith(CARD_BIN)).toBe(true)
      expect(isValidLuhn(number)).toBe(true)
      drawn.add(number)
    }
    expect(drawn.size).toBeGreaterThan(1)
  })
})
describe("isValidLuhn", () => {
  it("rejects a changed digit and anything that is not all digits", () => {
    const number = generateCardNumber(seededRandom(99))
    const digit = Number(number[8])
    const altered = number.slice(0, 8) + ((digit + 1) % 10) + number.slice(9)

    expect(isValidLuhn(number)).toBe(true)
    expect(isValidLuhn(altered)).toBe(false)
    expect(isValidLuhn("4242 4242 4242 4242")).toBe(false)
    expect(isValidLuhn("")).toBe(false)
  })
})

describe("canTransition", () => {
  const pairs = CARD_STATUSES.flatMap((from) =>
    CARD_STATUSES.map(
      (to) => [from, to, CARD_TRANSITIONS[from].includes(to)] as const,
    ),
  )

  it.each(pairs)("%s to %s is %s", (from, to, allowed) => {
    expect(canTransition(from, to)).toBe(allowed)
  })

  it("makes cancelled terminal", () => {
    expect(CARD_TRANSITIONS.cancelled).toEqual([])
  })
})

describe("the allowlists", () => {
  it("masks to the last four, caps the limit, and labels every category", () => {
    expect(maskCard("4242")).toBe("•••• 4242")
    expect(CARD_LIMIT_MAX).toBe(5_000_000)
    expect(CARD_CATEGORIES.length).toBe(6)
    for (const category of CARD_CATEGORIES) {
      expect(CARD_CATEGORY_LABELS[category]).toBeTruthy()
    }
  })
})
