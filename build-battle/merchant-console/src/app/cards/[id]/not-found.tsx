import Link from "next/link"

export default function CardNotFound() {
  return (
    <div className="p-4 sm:p-6">
      <h1 className="text-lg font-semibold text-gray-900 sm:text-xl dark:text-gray-50">
        No card with that id
      </h1>
      <p className="mt-1 text-sm text-gray-500">
        The card was never issued, or the link is wrong. Cards created in this
        session also disappear when the dev server restarts.
      </p>
      <Link
        href="/cards"
        className="mt-4 inline-block text-sm text-blue-600 hover:underline dark:text-blue-500"
      >
        ← All cards
      </Link>
    </div>
  )
}
