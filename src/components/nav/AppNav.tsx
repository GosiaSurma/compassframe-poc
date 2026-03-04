"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import {
  Sparkles,
  Trophy,
  Share2,
  Gift,
  User,
  Settings,
  Lock,
  LogOut,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface Props {
  userName: string
  userRole: string
  hasCompletedReflection: boolean
  unreadGiftCount: number
}

const NAV_ITEMS = [
  { href: "/reflection", label: "Reflection", Icon: Sparkles, alwaysOn: true },
  { href: "/challenge",  label: "Challenge",  Icon: Trophy,   alwaysOn: false },
  { href: "/share",      label: "Share",      Icon: Share2,   alwaysOn: false },
  { href: "/gifts",      label: "Gifts",      Icon: Gift,     alwaysOn: true },
  { href: "/profile",    label: "Profile",    Icon: User,     alwaysOn: true },
  { href: "/settings",   label: "Settings",   Icon: Settings, alwaysOn: true },
] as const

export function AppNav({ userName, userRole, hasCompletedReflection, unreadGiftCount }: Props) {
  const pathname = usePathname()

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + "/")
  }

  function isUnlocked(alwaysOn: boolean) {
    return alwaysOn || hasCompletedReflection
  }

  return (
    <>
      {/* ── Desktop sidebar ─────────────────────────────────────── */}
      <nav className="hidden md:flex flex-col w-56 shrink-0 bg-white border-r border-gray-100 py-6 px-3">
        {/* Logo */}
        <div className="px-3 mb-8">
          <span className="text-base font-semibold text-gray-900 tracking-tight">
            Compassframe
          </span>
          <p className="text-xs text-gray-400 capitalize mt-0.5">{userRole}</p>
        </div>

        {/* Nav links */}
        <ul className="space-y-0.5 flex-1">
          {NAV_ITEMS.map(({ href, label, Icon, alwaysOn }) => {
            const unlocked = isUnlocked(alwaysOn)
            const active = isActive(href)

            if (!unlocked) {
              return (
                <li key={href}>
                  <span
                    title="Complete a Reflection to unlock"
                    className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-300 cursor-not-allowed select-none"
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="flex-1">{label}</span>
                    <Lock className="w-3 h-3" />
                  </span>
                </li>
              )
            }

            const showBadge = href === "/gifts" && unreadGiftCount > 0

            return (
              <li key={href}>
                <Link
                  href={href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                    active
                      ? "bg-brand-50 text-brand-700 font-medium"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
                  )}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="flex-1">{label}</span>
                  {showBadge && (
                    <span className="bg-brand-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                      {unreadGiftCount > 9 ? "9+" : unreadGiftCount}
                    </span>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>

        {/* User + sign-out */}
        <div className="border-t border-gray-100 pt-4 mt-4 px-3">
          <p className="text-xs font-medium text-gray-700 truncate mb-2">{userName}</p>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex items-center gap-2 text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign out
          </button>
        </div>
      </nav>

      {/* ── Mobile bottom tab bar ───────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-gray-100 z-40 safe-area-bottom">
        <ul className="flex items-center justify-around px-1 py-1">
          {NAV_ITEMS.map(({ href, label, Icon, alwaysOn }) => {
            const unlocked = isUnlocked(alwaysOn)
            const active = isActive(href)

            if (!unlocked) {
              return (
                <li key={href} className="flex-1">
                  <span className="flex flex-col items-center gap-0.5 py-1 text-gray-300 select-none">
                    <Icon className="w-5 h-5" />
                    <span className="text-[9px]">{label}</span>
                  </span>
                </li>
              )
            }

            const showBadge = href === "/gifts" && unreadGiftCount > 0

            return (
              <li key={href} className="flex-1">
                <Link
                  href={href}
                  className={cn(
                    "flex flex-col items-center gap-0.5 py-1 w-full transition-colors relative",
                    active ? "text-brand-600" : "text-gray-400",
                  )}
                >
                  <div className="relative">
                    <Icon className="w-5 h-5" />
                    {showBadge && (
                      <span className="absolute -top-1 -right-1 bg-brand-500 text-white text-[8px] font-bold w-3.5 h-3.5 rounded-full flex items-center justify-center">
                        {unreadGiftCount > 9 ? "9+" : unreadGiftCount}
                      </span>
                    )}
                  </div>
                  <span className="text-[9px]">{label}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </>
  )
}
