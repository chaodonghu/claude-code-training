import { transitionCard } from "@/data/cards"
import { CardStatus } from "@/data/types"
import { CARD_STATUSES } from "@/lib/cards"
import { NextRequest, NextResponse } from "next/server"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { message: `Status must be one of ${CARD_STATUSES.join(", ")}.` },
      { status: 400 },
    )
  }

  const status = (body as { status?: unknown } | null)?.status
  if (
    typeof status !== "string" ||
    !CARD_STATUSES.includes(status as CardStatus)
  ) {
    return NextResponse.json(
      { message: `Status must be one of ${CARD_STATUSES.join(", ")}.` },
      { status: 400 },
    )
  }

  const result = transitionCard(id, status as CardStatus)
  if (!result.ok) {
    return NextResponse.json(
      { message: result.message },
      { status: result.status },
    )
  }

  return NextResponse.json({ card: result.card })
}
