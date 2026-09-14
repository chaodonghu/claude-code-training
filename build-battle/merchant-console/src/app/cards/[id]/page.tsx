import { Divider } from "@/components/Divider"
import { StatusBadge } from "@/components/ui/payments/StatusBadge"
import { cardById } from "@/data/cards"
import { merchantById } from "@/data/merchants"
import { CARD_CATEGORY_LABELS, maskCard } from "@/lib/cards"
import { formatInZone } from "@/lib/dates"
import { formatMoney } from "@/lib/money"
import { cx } from "@/lib/utils"
import Link from "next/link"
import { notFound } from "next/navigation"

const AMBER_AT = 80

/**
 * Tailwind scans for literal class names, so the bar picks its width from
 * this table rather than building one from the percentage at runtime.
 */
const BAR_WIDTHS = [
  "w-[0%]",
  "w-[5%]",
  "w-[10%]",
  "w-[15%]",
  "w-[20%]",
  "w-[25%]",
  "w-[30%]",
  "w-[35%]",
  "w-[40%]",
  "w-[45%]",
  "w-[50%]",
  "w-[55%]",
  "w-[60%]",
  "w-[65%]",
  "w-[70%]",
  "w-[75%]",
  "w-[80%]",
  "w-[85%]",
  "w-[90%]",
  "w-[95%]",
  "w-[100%]",
] as const

export default async function CardDetail({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const card = cardById(id)
  if (!card) notFound()

  const merchant = merchantById(card.merchantId)!
  const remaining = card.limit - card.spent
  // Display only. Amounts stay integer minor units everywhere else.
  const percent = Math.min(100, Math.round((card.spent * 100) / card.limit))
  const barWidth = BAR_WIDTHS[Math.round(percent / 5)]

  return (
    <div className="p-4 sm:p-6">
      <Link
        href="/cards"
        className="text-sm text-gray-500 hover:text-gray-900 dark:hover:text-gray-50"
      >
        ← All cards
      </Link>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">
          {card.nickname}
        </h1>
        <StatusBadge status={card.status} />
      </div>
      <p className="mt-1 font-mono text-sm text-gray-500">
        {maskCard(card.last4)}
      </p>

      <Divider />

      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
        Spend against limit
      </h2>
      <div className="mt-3 max-w-md">
        <div
          role="progressbar"
          aria-label="Spend against limit"
          aria-valuenow={card.spent}
          aria-valuemin={0}
          aria-valuemax={card.limit}
          className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800"
        >
          <div
            className={cx(
              "h-full rounded-full",
              percent >= AMBER_AT ? "bg-amber-500" : "bg-blue-500",
              barWidth,
            )}
          />
        </div>
        <p className="mt-2 text-sm text-gray-500">
          {percent}% of limit used · {formatMoney(card.spent, card.currency)} of{" "}
          {formatMoney(card.limit, card.currency)}
        </p>
      </div>

      <Divider />

      <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Merchant">
          {merchant.name}
          <span className="ml-2 text-gray-500">{merchant.country}</span>
        </Field>
        <Field label="Category">{CARD_CATEGORY_LABELS[card.category]}</Field>
        <Field label="Limit">{formatMoney(card.limit, card.currency)}</Field>
        <Field label="Spent">{formatMoney(card.spent, card.currency)}</Field>
        <Field label="Remaining">{formatMoney(remaining, card.currency)}</Field>
        <Field label="Currency">{card.currency}</Field>
        <Field label="Created (UTC)">
          <span className="font-mono text-sm">{card.createdAt}</span>
        </Field>
        <Field label={`Created (${merchant.timezone})`}>
          {formatInZone(card.createdAt, merchant.timezone)}
        </Field>
        <Field label="Card id">
          <span className="font-mono text-sm">{card.id}</span>
        </Field>
        <Field label="Number reference">
          <span className="font-mono text-sm">{card.numberRef}</span>
        </Field>
      </dl>
    </div>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <dt className="text-sm text-gray-500">{label}</dt>
      <dd className="mt-1 text-sm text-gray-900 dark:text-gray-50">
        {children}
      </dd>
    </div>
  )
}
