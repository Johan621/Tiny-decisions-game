"use client"

export interface Session {
  code: string
  pid: string
  name: string
}

const SESSION_KEY = "rigged.session"
const NAME_KEY = "rigged.name"

export function saveSession(s: Session) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(s))
    localStorage.setItem(NAME_KEY, s.name)
  } catch {}
}

export function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const s = JSON.parse(raw) as Session
    if (!s.code || !s.pid) return null
    return s
  } catch {
    return null
  }
}

export function loadSavedName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? ""
  } catch {
    return ""
  }
}

export function playerColor(id: string): string {
  const palette = [
    "#a3e635",
    "#f472b6",
    "#60a5fa",
    "#fbbf24",
    "#34d399",
    "#f87171",
    "#c084fc",
    "#38bdf8",
    "#fb923c",
    "#4ade80",
    "#e879f9",
    "#facc15",
  ]
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return palette[h % palette.length]
}

export async function postAction(body: Record<string, unknown>) {
  const res = await fetch("/api/game/action", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  return { status: res.status, data: (await res.json()) as Record<string, unknown> }
}
