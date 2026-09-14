"use client"

import { Button } from "@/components/Button"
import {
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/Drawer"
import type { ExportColumn, ExportScope } from "@/lib/csv"
import { Download } from "lucide-react"
import { useState } from "react"

const SCOPES: { value: ExportScope; label: string }[] = [
  { value: "filtered", label: "Current filter" },
  { value: "all", label: "All payments" },
]

export function ExportDialog({
  query,
  columns,
  counts,
}: {
  query: string
  columns: { key: ExportColumn; label: string; defaultSelected: boolean }[]
  counts: { filtered: number; all: number }
}) {
  const [selected, setSelected] = useState<Set<ExportColumn>>(
    () =>
      new Set(
        columns.filter((c) => c.defaultSelected).map((c) => c.key),
      ),
  )
  const [scope, setScope] = useState<ExportScope>("filtered")

  const toggle = (key: ExportColumn, checked: boolean) => {
    setSelected((current) => {
      const next = new Set(current)
      if (checked) next.add(key)
      else next.delete(key)
      return next
    })
  }

  const params = new URLSearchParams(query)
  params.set("scope", scope)
  params.set(
    "columns",
    columns
      .filter((c) => selected.has(c.key))
      .map((c) => c.key)
      .join(","),
  )
  const href = `/api/payments/export?${params.toString()}`

  return (
    <Drawer>
      <DrawerTrigger asChild>
        <Button
          variant="secondary"
          className="w-full gap-2 py-1.5 sm:w-fit"
        >
          <Download
            className="-ml-0.5 size-4 shrink-0 text-gray-400 dark:text-gray-600"
            aria-hidden="true"
          />
          Export
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Export payments</DrawerTitle>
          <DrawerDescription>
            Pick the columns and the rows this file should contain.
          </DrawerDescription>
        </DrawerHeader>
        <DrawerBody className="flex flex-col gap-6">
          <fieldset>
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Columns
            </legend>
            <div className="mt-2 flex flex-col gap-2">
              {columns.map((column) => (
                <div key={column.key} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id={`export-column-${column.key}`}
                    checked={selected.has(column.key)}
                    onChange={(event) =>
                      toggle(column.key, event.target.checked)
                    }
                    className="size-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-950"
                  />
                  <label
                    htmlFor={`export-column-${column.key}`}
                    className="text-sm text-gray-900 dark:text-gray-50"
                  >
                    {column.label}
                  </label>
                </div>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Scope
            </legend>
            <div className="mt-2 flex flex-col gap-2">
              {SCOPES.map((option) => (
                <div key={option.value} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="export-scope"
                    id={`export-scope-${option.value}`}
                    value={option.value}
                    checked={scope === option.value}
                    onChange={() => setScope(option.value)}
                    className="size-4 border-gray-300 text-blue-500 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-950"
                  />
                  <label
                    htmlFor={`export-scope-${option.value}`}
                    className="text-sm text-gray-900 dark:text-gray-50"
                  >
                    {option.label}
                  </label>
                </div>
              ))}
            </div>
            <p className="mt-2 text-sm text-gray-500" aria-live="polite">
              {counts[scope].toLocaleString()} rows
            </p>
          </fieldset>
        </DrawerBody>
        <DrawerFooter>
          <DrawerClose asChild>
            <Button variant="secondary" className="py-1.5">
              Cancel
            </Button>
          </DrawerClose>
          {selected.size === 0 ? (
            <Button variant="primary" className="py-1.5" disabled>
              Download
            </Button>
          ) : (
            <Button variant="primary" className="py-1.5" asChild>
              <a href={href} download>
                Download
              </a>
            </Button>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
