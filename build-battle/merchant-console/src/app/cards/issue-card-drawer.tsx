"use client"

import { Button } from "@/components/Button"
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/Drawer"
import { Input } from "@/components/Input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/Select"
import { Card, CardCategory, Currency } from "@/data/types"
import {
  CARD_CATEGORIES,
  CARD_CATEGORY_LABELS,
  CARD_CURRENCIES,
} from "@/lib/cards"
import { parseAmountToMinorUnits } from "@/lib/money"
import { Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

type MerchantOption = { id: string; name: string; currency: Currency }

type Issued = { card: Card; number: string }

/** Four-digit groups, the way the number is read off a screen. */
function groupDigits(number: string): string {
  return number.replace(/(.{4})/g, "$1 ").trim()
}

export function IssueCardDrawer({
  merchants,
}: {
  merchants: MerchantOption[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [nickname, setNickname] = useState("")
  const [merchantId, setMerchantId] = useState("")
  const [limit, setLimit] = useState("")
  const [currency, setCurrency] = useState<Currency>("USD")
  const [category, setCategory] = useState<CardCategory>("other")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [issued, setIssued] = useState<Issued | null>(null)
  const [copied, setCopied] = useState(false)

  // The number lives only here, so closing the drawer is what discards it.
  const reset = () => {
    setNickname("")
    setMerchantId("")
    setLimit("")
    setCurrency("USD")
    setCategory("other")
    setError(null)
    setPending(false)
    setIssued(null)
    setCopied(false)
  }

  const close = () => {
    setOpen(false)
    reset()
    router.refresh()
  }

  const onMerchantChange = (id: string) => {
    setMerchantId(id)
    const merchant = merchants.find((m) => m.id === id)
    if (merchant) setCurrency(merchant.currency)
  }

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    const minorUnits = parseAmountToMinorUnits(limit)
    if (minorUnits === null) {
      setError("Enter an amount like 250.00")
      return
    }

    setPending(true)
    try {
      const response = await fetch("/api/cards", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          nickname,
          merchantId,
          limit: minorUnits,
          currency,
          category,
        }),
      })
      const body = await response.json()
      if (!response.ok) {
        setError(body?.message ?? "Could not issue the card.")
        return
      }
      setIssued(body as Issued)
    } catch {
      setError("Could not reach the server. Try again.")
    } finally {
      setPending(false)
    }
  }

  const copy = async () => {
    if (!issued) return
    await navigator.clipboard.writeText(issued.number)
    setCopied(true)
  }

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => (next ? setOpen(true) : close())}
    >
      <DrawerTrigger asChild>
        <Button className="w-full gap-2 py-1.5 sm:w-fit">
          <Plus className="-ml-0.5 size-4 shrink-0" aria-hidden="true" />
          Issue card
        </Button>
      </DrawerTrigger>
      <DrawerContent className="sm:max-w-lg">
        {issued ? (
          <>
            <DrawerHeader>
              <DrawerTitle>Card issued</DrawerTitle>
              <DrawerDescription>{issued.card.nickname}</DrawerDescription>
            </DrawerHeader>
            <DrawerBody className="space-y-4">
              <p className="font-mono text-lg tracking-wider text-gray-900 dark:text-gray-50">
                {groupDigits(issued.number)}
              </p>
              <Button variant="secondary" className="py-1.5" onClick={copy}>
                {copied ? "Copied" : "Copy"}
              </Button>
              <p className="text-sm text-gray-500">
                This is the only time the full number is shown.
              </p>
            </DrawerBody>
            <DrawerFooter>
              <Button onClick={close}>Done</Button>
            </DrawerFooter>
          </>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-1 flex-col">
            <DrawerHeader>
              <DrawerTitle>Issue a card</DrawerTitle>
              <DrawerDescription>
                Single merchant, virtual, with a limit from the moment it
                exists.
              </DrawerDescription>
            </DrawerHeader>
            <DrawerBody className="space-y-4">
              <div>
                <label
                  htmlFor="card-nickname"
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Nickname
                </label>
                <Input
                  id="card-nickname"
                  name="nickname"
                  value={nickname}
                  onChange={(event) => setNickname(event.target.value)}
                  placeholder="Ads spend"
                  maxLength={40}
                  required
                  className="mt-2"
                />
              </div>

              <div>
                <label
                  htmlFor="card-merchant"
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Merchant
                </label>
                <Select
                  value={merchantId}
                  onValueChange={onMerchantChange}
                  required
                >
                  <SelectTrigger id="card-merchant" className="mt-2">
                    <SelectValue placeholder="Choose a merchant" />
                  </SelectTrigger>
                  <SelectContent>
                    {merchants.map((merchant) => (
                      <SelectItem key={merchant.id} value={merchant.id}>
                        {merchant.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label
                  htmlFor="card-limit"
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Spend limit
                </label>
                <Input
                  id="card-limit"
                  name="limit"
                  type="text"
                  inputMode="decimal"
                  value={limit}
                  onChange={(event) => setLimit(event.target.value)}
                  placeholder="250.00"
                  required
                  className="mt-2"
                />
              </div>

              <div>
                <label
                  htmlFor="card-currency"
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Currency
                </label>
                <Select
                  value={currency}
                  onValueChange={(next) => setCurrency(next as Currency)}
                >
                  <SelectTrigger id="card-currency" className="mt-2">
                    <SelectValue placeholder="Currency" />
                  </SelectTrigger>
                  <SelectContent>
                    {CARD_CURRENCIES.map((code) => (
                      <SelectItem key={code} value={code}>
                        {code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label
                  htmlFor="card-category"
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Category
                </label>
                <Select
                  value={category}
                  onValueChange={(next) => setCategory(next as CardCategory)}
                  required
                >
                  <SelectTrigger id="card-category" className="mt-2">
                    <SelectValue placeholder="Choose a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CARD_CATEGORIES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {CARD_CATEGORY_LABELS[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {error && (
                <p
                  role="alert"
                  className="text-sm text-red-600 dark:text-red-500"
                >
                  {error}
                </p>
              )}
            </DrawerBody>
            <DrawerFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={close}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button type="submit" isLoading={pending} disabled={pending}>
                Issue card
              </Button>
            </DrawerFooter>
          </form>
        )}
      </DrawerContent>
    </Drawer>
  )
}
