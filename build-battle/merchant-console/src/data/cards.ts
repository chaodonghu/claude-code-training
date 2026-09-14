import { merchantById } from "./merchants"
import { store } from "./store"
import { Card, CardStatus, Currency, IssueCardInput } from "./types"
import {
  CARD_CURRENCIES,
  CARD_LIMIT_MAX,
  canTransition,
  generateCardNumber,
  generateNumberRef,
} from "@/lib/cards"

const NICKNAME_MAX = 40

export type ParseResult =
  { ok: true; value: IssueCardInput } | { ok: false; message: string }

/**
 * Everything from the client is checked here before it reaches the store.
 * Rejects on the first problem so no case can go missing in a nested branch.
 */
export function parseIssueCardInput(body: unknown): ParseResult {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, message: "Send a JSON object with the card details." }
  }

  const input = body as Record<string, unknown>

  const nickname =
    typeof input.nickname === "string" ? input.nickname.trim() : ""
  if (nickname.length === 0) {
    return { ok: false, message: "Give the card a nickname." }
  }
  if (nickname.length > NICKNAME_MAX) {
    return {
      ok: false,
      message: `Nickname must be ${NICKNAME_MAX} characters or fewer.`,
    }
  }

  const merchantId =
    typeof input.merchantId === "string" ? input.merchantId : ""
  if (merchantId.length === 0) {
    return { ok: false, message: "Choose a merchant." }
  }
  if (!merchantById(merchantId)) {
    return { ok: false, message: "That merchant does not exist." }
  }

  const limit = input.limit
  if (typeof limit !== "number" || !Number.isInteger(limit)) {
    return {
      ok: false,
      message: "Spend limit must be a whole number of minor units.",
    }
  }
  if (limit <= 0) {
    return { ok: false, message: "Spend limit must be greater than zero." }
  }
  if (limit > CARD_LIMIT_MAX) {
    return {
      ok: false,
      message: `Spend limit must be ${CARD_LIMIT_MAX} minor units or less.`,
    }
  }

  const currency = input.currency
  if (
    typeof currency !== "string" ||
    !CARD_CURRENCIES.includes(currency as Currency)
  ) {
    return {
      ok: false,
      message: `Currency must be one of ${CARD_CURRENCIES.join(", ")}.`,
    }
  }

  return {
    ok: true,
    value: { nickname, merchantId, limit, currency: currency as Currency },
  }
}

const pad = (n: number, width = 6) => String(n).padStart(width, "0")

/**
 * Generates the number, keeps the last four, and hands the full number back
 * to the caller. It is never written to the store, so this response is the
 * only place it exists.
 */
export function issueCard(
  input: IssueCardInput,
  random: () => number = Math.random,
): { card: Card; number: string } {
  const number = generateCardNumber(random)

  const card: Card = {
    id: `card_${pad(store.cards.length + 1)}`,
    nickname: input.nickname,
    merchantId: input.merchantId,
    limit: input.limit,
    spent: 0,
    currency: input.currency,
    status: "active",
    last4: number.slice(-4),
    numberRef: generateNumberRef(random),
    createdAt: new Date().toISOString(),
  }

  store.cards.push(card)
  return { card, number }
}

export function listCards(): Card[] {
  return [...store.cards].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function cardById(id: string): Card | null {
  return store.cards.find((card) => card.id === id) ?? null
}

export function transitionCard(
  id: string,
  to: CardStatus,
):
  { ok: true; card: Card } | { ok: false; status: 404 | 409; message: string } {
  const card = cardById(id)
  if (!card) {
    return { ok: false, status: 404, message: "No card with that id." }
  }
  if (!canTransition(card.status, to)) {
    return {
      ok: false,
      status: 409,
      message: `A ${card.status} card cannot move to ${to}.`,
    }
  }

  card.status = to
  return { ok: true, card }
}
