import {
  cardById,
  issueCard,
  listCards,
  parseIssueCardInput,
} from "@/data/cards"
import { store } from "@/data/store"
import { NextRequest, NextResponse } from "next/server"

export function GET() {
  return NextResponse.json({ cards: listCards() })
}

const IDEMPOTENCY_KEY_MAX = 200

/** An opaque client key. Anything over the cap is treated as absent. */
function issueKeyFrom(request: NextRequest): string | null {
  const key = request.headers.get("idempotency-key")
  if (!key || key.length > IDEMPOTENCY_KEY_MAX) return null
  return key
}

export async function POST(request: NextRequest) {
  const key = issueKeyFrom(request)
  if (key) {
    const existingId = store.issueKeys.get(key)
    const existing = existingId ? cardById(existingId) : null
    // A replay never re-reveals the number; that response happened once.
    if (existing) {
      return NextResponse.json({ card: existing, replayed: true })
    }
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { message: "Send a JSON object with the card details." },
      { status: 400 },
    )
  }

  const parsed = parseIssueCardInput(body)
  if (!parsed.ok) {
    return NextResponse.json({ message: parsed.message }, { status: 400 })
  }

  // The full number travels in this response and nowhere else.
  const { card, number } = issueCard(parsed.value)
  if (key) store.issueKeys.set(key, card.id)
  return NextResponse.json({ card, number }, { status: 201 })
}
