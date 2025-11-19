import { useEffect, useState } from "react"

type ToastItem = {
  id: string
  title?: string
  description?: string
  action?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

type Event = { type: "add"; toast: ToastItem } | { type: "remove"; id: string } | { type: "clear" }

const listeners = new Set<(e: Event) => void>()
const toastsStore: ToastItem[] = []

export function toast(t: Omit<ToastItem, "id">) {
  const id = Math.random().toString(36).slice(2)
  const item: ToastItem = { id, ...t }
  toastsStore.push(item)
  for (const l of listeners) l({ type: "add", toast: item })
  return id
}

export function dismiss(id?: string) {
  if (!id) {
    toastsStore.splice(0, toastsStore.length)
    for (const l of listeners) l({ type: "clear" })
    return
  }
  const idx = toastsStore.findIndex((x) => x.id === id)
  if (idx >= 0) toastsStore.splice(idx, 1)
  for (const l of listeners) l({ type: "remove", id })
}

export function useToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  useEffect(() => {
    const handler = (e: Event) => {
      if (e.type === "add") setToasts((prev) => [...prev, e.toast])
      else if (e.type === "remove") setToasts((prev) => prev.filter((t) => t.id !== e.id))
      else if (e.type === "clear") setToasts([])
    }
    listeners.add(handler)
    return () => {
      listeners.delete(handler)
    }
  }, [])
  return { toasts, toast, dismiss }
}