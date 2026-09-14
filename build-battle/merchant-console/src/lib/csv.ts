import { merchantById } from "@/data/merchants"
import { Payment, PaymentFilters } from "@/data/types"
import { formatMoney } from "./money"

/**
 * CSV export for the payments table.
 *
 * Ops picks the columns and the scope, so everything the client sends is
 * checked against the registry below before it reaches a cell or a filename.
 */

export const EXPORT_COLUMNS = [
  "id",
  "created_at",
  "merchant",
  "description",
  "status",
  "method",
  "card_brand",
  "last4",
  "amount",
  "currency",
] as const

export type ExportColumn = (typeof EXPORT_COLUMNS)[number]

export type ExportScope = "filtered" | "all"

const COLUMN_LABELS: Record<ExportColumn, string> = {
  id: "Payment ID",
  created_at: "Created at",
  merchant: "Merchant",
  description: "Description",
  status: "Status",
  method: "Method",
  card_brand: "Card brand",
  last4: "Card last four",
  amount: "Amount",
  currency: "Currency",
}

export const EXPORT_COLUMN_OPTIONS: readonly {
  key: ExportColumn
  label: string
  defaultSelected: boolean
}[] = EXPORT_COLUMNS.map((key) => ({
  key,
  label: COLUMN_LABELS[key],
  defaultSelected: key !== "last4",
}))

/** Filters an untrusted list down to known columns, in registry order. */
export function parseExportColumns(raw: string | null): ExportColumn[] {
  const requested = new Set((raw ?? "").split(",").map((name) => name.trim()))
  return EXPORT_COLUMNS.filter((column) => requested.has(column))
}

export function parseExportScope(raw: string | null): ExportScope {
  return raw === "all" ? "all" : "filtered"
}

export function exportScopeLabel(
  scope: ExportScope,
  status: PaymentFilters["status"],
): string {
  if (scope === "all") return "all"
  return status && status !== "all" ? status : "filtered"
}

function escapeCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

function cell(payment: Payment, column: ExportColumn): string {
  switch (column) {
    case "id":
      return payment.id
    case "created_at":
      return payment.createdAt
    case "merchant":
      return merchantById(payment.merchantId)?.name ?? payment.merchantId
    case "description":
      return payment.description
    case "status":
      return payment.status
    case "method":
      return payment.method
    case "card_brand":
      return payment.cardBrand ?? ""
    case "last4":
      return payment.last4 ?? ""
    case "amount":
      return formatMoney(payment.amount, payment.currency)
    case "currency":
      return payment.currency
  }
}

export function toCsv(
  payments: Payment[],
  columns: readonly ExportColumn[] = EXPORT_COLUMNS,
): string {
  const header = columns.join(",")
  const rows = payments.map((payment) =>
    columns.map((column) => escapeCell(cell(payment, column))).join(","),
  )
  return [header, ...rows].join("\n")
}

export function exportFilename(label: string, date = new Date()): string {
  return `payments-${label}-${date.toISOString().slice(0, 10)}.csv`
}
