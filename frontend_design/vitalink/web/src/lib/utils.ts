import { type ClassValue } from "clsx"
import clsx from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatTimeHM(input: string | number | Date) {
  try {
    const d = input instanceof Date ? input : new Date(input)
    if (isNaN(d.getTime())) return String(input)
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: true })
  } catch (_) {
    return String(input)
  }
}