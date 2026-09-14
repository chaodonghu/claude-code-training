import { describe, expect, it } from "vitest"
import { Payment } from "@/data/types"
import {
  EXPORT_COLUMN_OPTIONS,
  EXPORT_COLUMNS,
  exportFilename,
  exportScopeLabel,
  parseExportColumns,
  toCsv,
} from "./csv"

/**
 * The export is the file ops hands to a merchant, so a broken cell is a
 * support ticket rather than a stack trace. These tests pin the escaping and
 * the column contract, plus the parsers that decide which columns and which
 * rows a download gets.
 */

const payment: Payment = {
  id: "pay_0001",
  merchantId: "mch_01",
  amount: 25000,
  currency: "USD",
  status: "captured",
  method: "card",
  cardBrand: "visa",
  last4: "4242",
  createdAt: "2026-03-14T10:15:00.000Z",
  description: "Order 1180",
}

describe("toCsv", () => {
  it("writes a header row followed by one row per payment", () => {
    const lines = toCsv([payment]).split("\n")
    expect(lines).toHaveLength(2)
    expect(lines[0]).toBe(EXPORT_COLUMNS.join(","))
  })

  it("writes only the requested columns, in the order given", () => {
    expect(toCsv([payment], ["id", "amount"])).toBe(
      ["id,amount", "pay_0001,$250.00"].join("\n"),
    )
  })

  it("quotes cells containing a comma, so amounts do not split", () => {
    const large = { ...payment, amount: 123456789 }
    expect(toCsv([large], ["amount"])).toBe(
      ["amount", '"$1,234,567.89"'].join("\n"),
    )
  })

  it("doubles embedded quotes rather than dropping them", () => {
    const quoted = { ...payment, description: 'Order "rush"' }
    expect(toCsv([quoted], ["description"])).toBe(
      ["description", '"Order ""rush"""'].join("\n"),
    )
  })

  it("keeps a newline inside a description in one quoted cell", () => {
    const multiline = { ...payment, description: "Order 1180\nsecond line" }
    const body = toCsv([multiline], ["description"])
      .split("\n")
      .slice(1)
      .join("\n")
    expect(body).toBe('"Order 1180\nsecond line"')
  })

  it("resolves the merchant name, and falls back to the id when unknown", () => {
    expect(toCsv([payment], ["merchant"])).toContain("Lumen Coffee Roasters")
    const orphan = { ...payment, merchantId: "mch_missing" }
    expect(toCsv([orphan], ["merchant"])).toContain("mch_missing")
  })

  it("writes an empty cell for a payment with no card", () => {
    const bank: Payment = {
      ...payment,
      method: "bank_transfer",
      cardBrand: null,
      last4: null,
    }
    expect(toCsv([bank], ["card_brand", "last4"])).toBe(
      ["card_brand,last4", ","].join("\n"),
    )
  })

  it("emits a header even with no rows", () => {
    expect(toCsv([], ["id"])).toBe("id")
  })
})

describe("EXPORT_COLUMN_OPTIONS", () => {
  it("lists every export column, in order", () => {
    expect(EXPORT_COLUMN_OPTIONS.map((option) => option.key)).toEqual([
      ...EXPORT_COLUMNS,
    ])
  })

  it("leaves the card last four off by default, and nothing else", () => {
    expect(
      EXPORT_COLUMN_OPTIONS.filter((option) => !option.defaultSelected).map(
        (option) => option.key,
      ),
    ).toEqual(["last4"])
  })
})

describe("parseExportColumns", () => {
  it("drops names that are not export columns", () => {
    expect(parseExportColumns("id,merchant_id,amount")).toEqual([
      "id",
      "amount",
    ])
  })

  it("keeps a repeated column once", () => {
    expect(parseExportColumns("id,id,amount")).toEqual(["id", "amount"])
  })

  it("keeps a subset in the requested order", () => {
    expect(parseExportColumns("currency, amount ,id")).toEqual([
      "currency",
      "amount",
      "id",
    ])
  })

  it("never includes the card last four unless asked", () => {
    const defaults = EXPORT_COLUMN_OPTIONS.filter((o) => o.defaultSelected)
      .map((o) => o.key)
      .join(",")
    expect(parseExportColumns(defaults)).not.toContain("last4")
  })

  it("returns nothing for a missing or empty parameter", () => {
    expect(parseExportColumns(null)).toEqual([])
    expect(parseExportColumns("")).toEqual([])
  })
})

describe("exportScopeLabel", () => {
  it("says all when the scope ignores the filter", () => {
    expect(exportScopeLabel("all", "disputed")).toBe("all")
  })

  it("names the status the file was filtered to", () => {
    expect(exportScopeLabel("filtered", "disputed")).toBe("disputed")
  })

  it("falls back to filtered when no status narrows the set", () => {
    expect(exportScopeLabel("filtered", "all")).toBe("filtered")
    expect(exportScopeLabel("filtered", undefined)).toBe("filtered")
  })
})

describe("exportFilename", () => {
  it("stamps the scope and the UTC date, so two exports on the same day collide by design", () => {
    expect(
      exportFilename("disputed", new Date("2026-03-14T23:00:00.000Z")),
    ).toBe("payments-disputed-2026-03-14.csv")
  })
})
