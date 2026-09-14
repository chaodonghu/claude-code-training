"use client"

import { Button } from "@/components/Button"
import { CardStatus } from "@/data/types"
import { CARD_TRANSITIONS } from "@/lib/cards"
import { useRouter } from "next/navigation"
import { useState } from "react"

/** What the move is called from the operator's side, keyed by where it lands. */
const ACTION_LABELS: Record<CardStatus, string> = {
  active: "Unfreeze",
  frozen: "Freeze",
  cancelled: "Cancel",
}

export function CardStatusActions({
  id,
  status,
}: {
  id: string
  status: CardStatus
}) {
  const router = useRouter()
  const [pending, setPending] = useState<CardStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

  // The buttons come from the transition table, so the UI cannot offer a move
  // the server would refuse.
  const moves = CARD_TRANSITIONS[status]

  const move = async (to: CardStatus) => {
    setError(null)
    setPending(to)
    try {
      const response = await fetch(`/api/cards/${id}/status`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: to }),
      })
      const body = await response.json()
      if (!response.ok) {
        setError(body?.message ?? "Could not update the card.")
        return
      }
      router.refresh()
    } catch {
      setError("Could not reach the server. Try again.")
    } finally {
      setPending(null)
    }
  }

  if (moves.length === 0) {
    return <span className="text-sm text-gray-400">Cancelled</span>
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {confirming ? (
        <>
          <span className="text-xs text-gray-500">Cancel this card?</span>
          <Button
            variant="destructive"
            className="px-2 py-1 text-xs"
            onClick={() => move("cancelled")}
            isLoading={pending === "cancelled"}
            disabled={pending !== null}
          >
            Confirm cancel
          </Button>
          <Button
            variant="secondary"
            className="px-2 py-1 text-xs"
            onClick={() => setConfirming(false)}
            disabled={pending !== null}
          >
            Keep
          </Button>
        </>
      ) : (
        moves.map((to) => (
          <Button
            key={to}
            variant="secondary"
            className="px-2 py-1 text-xs"
            onClick={() =>
              to === "cancelled" ? setConfirming(true) : move(to)
            }
            isLoading={pending === to}
            disabled={pending !== null}
          >
            {ACTION_LABELS[to]}
          </Button>
        ))
      )}
      {error && (
        <span role="alert" className="text-xs text-red-600 dark:text-red-500">
          {error}
        </span>
      )}
    </div>
  )
}
