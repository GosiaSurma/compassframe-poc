"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

type MagicalMode = "off" | "light" | "full"
type Role = "parent" | "teen"

const MODES: { value: MagicalMode; label: string; desc: string }[] = [
  { value: "off",   label: "Off",   desc: "Plain conversational interface." },
  { value: "light", label: "Light", desc: "Subtle visual warmth and softer transitions." },
  { value: "full",  label: "Full",  desc: "Immersive ambient presentation. (Coming soon)" },
]

export function SettingsForm({
  currentRole,
  currentMagicalMode,
}: {
  currentRole: Role
  currentMagicalMode: string
}) {
  const router = useRouter()
  const [magicalMode, setMagicalMode] = useState<MagicalMode>(
    (currentMagicalMode as MagicalMode) ?? "off",
  )
  const [role, setRole] = useState<Role>(currentRole)
  const [savingMode, setSavingMode] = useState(false)
  const [confirmRole, setConfirmRole] = useState(false)
  const [pendingRole, setPendingRole] = useState<Role | null>(null)
  const [savingRole, setSavingRole] = useState(false)
  const [modeSuccess, setModeSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function saveMagicalMode(mode: MagicalMode) {
    setSavingMode(true)
    setModeSuccess(false)
    setError(null)
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ magicalMode: mode }),
    })
    setSavingMode(false)
    if (res.ok) {
      setMagicalMode(mode)
      setModeSuccess(true)
      setTimeout(() => setModeSuccess(false), 2000)
    } else {
      setError("Failed to save")
    }
  }

  function requestRoleChange(newRole: Role) {
    if (newRole === role) return
    setPendingRole(newRole)
    setConfirmRole(true)
  }

  async function confirmRoleChange() {
    if (!pendingRole) return
    setSavingRole(true)
    setError(null)
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: pendingRole }),
    })
    setSavingRole(false)
    if (res.ok) {
      setRole(pendingRole)
      setConfirmRole(false)
      setPendingRole(null)
      router.refresh()
    } else {
      setError("Failed to save role")
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">
          {error}
        </p>
      )}

      {/* ── Magical Mode ──────────────────────────────────────────── */}
      <section className="bg-white rounded-2xl border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-sm font-semibold text-gray-900">Magical Mode</h2>
          {modeSuccess && (
            <span className="text-xs text-green-600">Saved ✓</span>
          )}
        </div>
        <p className="text-xs text-gray-400 mb-4">
          Affects presentation only — the logic never changes.
        </p>

        <div className="space-y-2">
          {MODES.map(({ value, label, desc }) => (
            <button
              key={value}
              onClick={() => saveMagicalMode(value)}
              disabled={savingMode}
              className={cn(
                "w-full text-left px-4 py-3 rounded-xl border-2 transition-all",
                magicalMode === value
                  ? "border-brand-500 bg-brand-50"
                  : "border-gray-100 hover:border-gray-200",
              )}
            >
              <span className="text-sm font-medium text-gray-900">{label}</span>
              <span className="text-xs text-gray-500 block mt-0.5">{desc}</span>
            </button>
          ))}
        </div>
      </section>

      {/* ── Role ──────────────────────────────────────────────────── */}
      <section className="bg-white rounded-2xl border border-gray-100 p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-1">Your role</h2>
        <p className="text-xs text-gray-400 mb-4">
          Changing your role may affect existing relationships.
        </p>

        <div className="flex gap-3">
          {(["parent", "teen"] as Role[]).map(r => (
            <button
              key={r}
              onClick={() => requestRoleChange(r)}
              className={cn(
                "flex-1 py-2.5 rounded-xl border-2 text-sm font-medium capitalize transition-all",
                role === r
                  ? "border-brand-500 bg-brand-50 text-brand-700"
                  : "border-gray-100 text-gray-500 hover:border-gray-200",
              )}
            >
              {r}
            </button>
          ))}
        </div>

        {/* Confirmation panel */}
        {confirmRole && pendingRole && (
          <div className="mt-4 bg-amber-50 border border-amber-100 rounded-xl p-4">
            <p className="text-sm text-amber-800 mb-3">
              Switch from <strong className="capitalize">{role}</strong> to{" "}
              <strong className="capitalize">{pendingRole}</strong>? This may affect how your
              linked relationships work.
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={confirmRoleChange}
                loading={savingRole}
                variant="primary"
              >
                Confirm
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => { setConfirmRole(false); setPendingRole(null) }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
