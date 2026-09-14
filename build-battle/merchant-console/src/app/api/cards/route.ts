import { issueCard, listCards, parseIssueCardInput } from "@/data/cards"
import { NextRequest, NextResponse } from "next/server"

export function GET() {
  return NextResponse.json({ cards: listCards() })
}

export async function POST(request: NextRequest) {
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
  return NextResponse.json({ card, number }, { status: 201 })
}
