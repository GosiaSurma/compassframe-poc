"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"

interface Props {
  currentName: string | null
}

export function NameForm({ currentName }: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(currentName ?? "")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    if (!name.trim()) return
    setSaving(true)
    setError(null)

    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    })

    setSaving(false)

    if (!res.ok) {
      const d = await res.json()
      setError(d.error ?? "Failed to save")
      return
    }

    setEditing(false)
    router.refresh()
  }

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="text-xs text-brand-600 hover:text-brand-700 font-medium mt-2"
      >
        {currentName ? "Edit name" : "Add display name"}
      </button>
    )
  }

  return (
    <div className="mt-3 space-y-2">
      <input
        type="text"
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="Your name"
        autoFocus
        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <Button variant="primary" size="sm" onClick={handleSave} loading={saving} disabled={!name.trim()}>
          Save
        </Button>
        <Button variant="ghost" size="sm" onClick={() => { setEditing(false); setName(currentName ?? "") }}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
