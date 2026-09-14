import { CardCategory, CardStatus, Currency } from "@/data/types"

/**
 * Pure card logic. No store, no request: the seed and the tests both drive
 * this with their own random source so a number reproduces on every machine.
 */

/** Test BIN. Every number generated here starts with it, so none can resemble a real PAN. */
export const CARD_BIN = "4242"

/** Integer minor units. A card cannot be issued above this. */
export const CARD_LIMIT_MAX = 5_000_000

const CARD_NUMBER_LENGTH = 16

/** The digit that makes a partial number satisfy Luhn. */
function luhnCheckDigit(partial: string): string {
  let sum = 0
  let double = true
  for (let i = partial.length - 1; i >= 0; i--) {
    let digit = Number(partial[i])
    if (double) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    double = !double
    sum += digit
  }
  return String((10 - (sum % 10)) % 10)
}

export function isValidLuhn(number: string): boolean {
  if (!/^\d+$/.test(number)) return false
  const body = number.slice(0, -1)
  return luhnCheckDigit(body) === number.slice(-1)
}

/** Sixteen digits: the test BIN, random filler, and a Luhn check digit. */
export function generateCardNumber(random: () => number = Math.random): string {
  let body = CARD_BIN
  while (body.length < CARD_NUMBER_LENGTH - 1) {
    body += String(Math.floor(random() * 10))
  }
  return body + luhnCheckDigit(body)
}

export function maskCard(last4: string): string {
  return `•••• ${last4}`
}

/** The state machine. `cancelled` is terminal and a card cannot move to itself. */
export const CARD_TRANSITIONS: Record<CardStatus, readonly CardStatus[]> = {
  active: ["frozen", "cancelled"],
  frozen: ["active", "cancelled"],
  cancelled: [],
}

export function canTransition(from: CardStatus, to: CardStatus): boolean {
  return CARD_TRANSITIONS[from].includes(to)
}

/** The status allowlist, read off the transition table so there is one source. */
export const CARD_STATUSES = Object.keys(CARD_TRANSITIONS) as CardStatus[]

export const CARD_CURRENCIES: readonly Currency[] = ["USD", "EUR", "GBP"]

/** What the card is locked to. Chosen at issue time and shown on the card. */
export const CARD_CATEGORIES: readonly CardCategory[] = [
  "advertising",
  "software",
  "contractors",
  "travel",
  "office",
  "other",
]

export const CARD_CATEGORY_LABELS: Record<CardCategory, string> = {
  advertising: "Advertising",
  software: "Software",
  contractors: "Contractors",
  travel: "Travel",
  office: "Office",
  other: "Other",
}

const REF_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789"
const REF_LENGTH = 12

/** Opaque handle for a card. Random, never derived from the number. */
export function generateNumberRef(random: () => number = Math.random): string {
  let ref = ""
  while (ref.length < REF_LENGTH) {
    ref += REF_ALPHABET[Math.floor(random() * REF_ALPHABET.length)]
  }
  return `cn_${ref}`
}
