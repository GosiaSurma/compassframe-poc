import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import crypto from "crypto"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Generates a cryptographically-random URL-safe token. */
export function generateToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("hex")
}

/** Returns a Date `hours` from now. */
export function expiresIn(hours: number): Date {
  return new Date(Date.now() + hours * 60 * 60 * 1000)
}
