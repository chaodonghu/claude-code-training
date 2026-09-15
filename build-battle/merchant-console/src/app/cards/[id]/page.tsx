import { Divider } from "@/components/Divider"
import { StatusBadge } from "@/components/ui/payments/StatusBadge"
import { CARD_HISTORY_LABELS } from "@/lib/cards"
import { cardById } from "@/data/cards"
import { spentOnCard } from "@/data/queries"
import { merchantById } from "@/data/merchants"
import { CARD_CATEGORY_LABELS, maskCard } from "@/lib/cards"
import { formatInZone } from "@/lib/dates"
import { formatMoney } from "@/lib/money"
import { cx } from "@/lib/utils"
import Link from "next/link"
import { CardStatusActions } from "../card-status-actions"
import { notFound } from "next/navigation"

const AMBER_AT = 80

export default async function CardDetail({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const card = cardById(id)
  if (!card) notFound()

  // Fall back to the id rather than crash if a merchant record is gone.
  const merchant = merchantById(card.merchantId)
  const merchantName = merchant?.name ?? card.merchantId
  const timezone = merchant?.timezone ?? "UTC"
  const spent = spentOnCard(card.id)
  const remaining = card.limit - spent
  // Display only. Amounts stay integer minor units everywhere else.
  const percent = Math.min(100, Math.round((spent * 100) / card.limit))

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
        <CardStatusActions id={card.id} status={card.status} />
      </div>
      <p className="mt-1 font-mono text-sm text-gray-500">
        {maskCard(card.last4)}
      </p>

      <Divider />

      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
        Spend against limit
      </h2>
      <div className="mt-3 max-w-md">
        <progress
          aria-label="Spend against limit"
          value={spent}
          max={card.limit}
          className={cx(
            "h-2 w-full appearance-none overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800",
            "[&::-moz-progress-bar]:rounded-full [&::-webkit-progress-bar]:bg-transparent [&::-webkit-progress-value]:rounded-full",
            percent >= AMBER_AT
              ? "[&::-moz-progress-bar]:bg-amber-500 [&::-webkit-progress-value]:bg-amber-500"
              : "[&::-moz-progress-bar]:bg-blue-500 [&::-webkit-progress-value]:bg-blue-500",
          )}
        />
        <p className="mt-2 text-sm text-gray-500">
          {percent}% of limit used · {formatMoney(spent, card.currency)} of{" "}
          {formatMoney(card.limit, card.currency)}
        </p>
      </div>

      <Divider />

      <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Merchant">
          {merchantName}
          {merchant && (
            <span className="ml-2 text-gray-500">{merchant.country}</span>
          )}
        </Field>
        <Field label="Category">{CARD_CATEGORY_LABELS[card.category]}</Field>
        <Field label="Limit">{formatMoney(card.limit, card.currency)}</Field>
        <Field label="Spent">{formatMoney(spent, card.currency)}</Field>
        <Field label="Remaining">{formatMoney(remaining, card.currency)}</Field>
        <Field label="Currency">{card.currency}</Field>
        <Field label="Created (UTC)">
          <span className="font-mono text-sm">{card.createdAt}</span>
        </Field>
        <Field label={`Created (${timezone})`}>
          {formatInZone(card.createdAt, timezone)}
        </Field>
        <Field label="Card id">
          <span className="font-mono text-sm">{card.id}</span>
        </Field>
        <Field label="Number reference">
          <span className="font-mono text-sm">{card.numberRef}</span>
        </Field>
      </dl>

      <Divider />

      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
        History
      </h2>
      <ol className="mt-4 space-y-4">
        {card.history.map((event, index) => (
          <li key={index} className="flex gap-3">
            <span
              className="mt-1.5 size-2 shrink-0 rounded-full bg-blue-500"
              aria-hidden="true"
            />
            <div>
              <p className="text-sm text-gray-900 dark:text-gray-50">
                {index === 0 ? "Issued" : CARD_HISTORY_LABELS[event.status]}
              </p>
              <p className="text-sm text-gray-500">
                {formatInZone(event.at, timezone)}
              </p>
            </div>
          </li>
        ))}
      </ol>
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
