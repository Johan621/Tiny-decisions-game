"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { Dices, LogIn, EyeOff, Vote, Search, Trophy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { loadSavedName, loadSession, postAction, saveSession } from "./shared"

export default function HomeClient() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [code, setCode] = useState("")
  const [joinName, setJoinName] = useState("")
  const [busy, setBusy] = useState<"create" | "join" | null>(null)
  const [error, setError] = useState("")
  const [resume, setResume] = useState<{ code: string; name: string } | null>(null)

  useEffect(() => {
    setName(loadSavedName())
    setJoinName(loadSavedName())
    const s = loadSession()
    if (s) setResume({ code: s.code, name: s.name })
  }, [])

  async function handleCreate() {
    if (!name.trim() || busy) return
    setBusy("create")
    setError("")
    const { data } = await postAction({ type: "create", name })
    if (data.ok && data.code && data.pid) {
      saveSession({ code: data.code as string, pid: data.pid as string, name })
      router.push(`/play/${data.code}`)
    } else {
      setError("Could not create room. Try again.")
      setBusy(null)
    }
  }

  async function handleJoin() {
    const c = code.trim().toUpperCase()
    if (!c || !joinName.trim() || busy) return
    setBusy("join")
    setError("")
    const { data } = await postAction({ type: "join", code: c, name: joinName.trim() })
    if (data.ok && data.pid) {
      saveSession({ code: c, pid: data.pid as string, name: joinName.trim() })
      router.push(`/play/${c}`)
    } else {
      const err = data.error as string
      setError(
        err === "ROOM_NOT_FOUND"
          ? "No room with that code."
          : err === "ROOM_FULL"
            ? "That room is full (12 max)."
            : "Could not join. Try again."
      )
      setBusy(null)
    }
  }

  return (
    <main className="relative min-h-dvh overflow-hidden bg-[#07080d] text-zinc-100">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-48 -left-48 h-[560px] w-[560px] rounded-full bg-lime-400/[0.13] blur-[130px]" />
        <div className="absolute -bottom-64 -right-40 h-[620px] w-[620px] rounded-full bg-violet-500/[0.14] blur-[140px]" />
        <div className="absolute left-1/2 top-1/3 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-sky-500/[0.07] blur-[120px]" />
        <div className="absolute inset-x-0 top-0 h-56 bg-gradient-to-b from-lime-400/[0.05] to-transparent" />
      </div>

      <div className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-10 pt-12">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.25em] text-lime-300">
            <EyeOff className="h-3 w-3" /> secret advantage quiz
          </div>
          <h1 className="bg-gradient-to-br from-white via-white to-zinc-500 bg-clip-text font-mono text-6xl font-black tracking-tighter text-transparent">
            RIGGED
          </h1>
          <p className="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-zinc-300">
            One player secretly sees the answers. Everyone else has to catch them before they win.
          </p>
        </motion.div>

        {resume && (
          <button
            onClick={() => router.push(`/play/${resume.code}`)}
            className="mt-6 flex items-center justify-between rounded-xl border border-lime-400/30 bg-lime-400/10 px-4 py-3 text-left text-sm transition hover:bg-lime-400/15"
          >
            <span>
              Rejoin room <span className="font-mono font-bold tracking-widest text-lime-300">{resume.code}</span>
              <span className="text-zinc-400"> as {resume.name}</span>
            </span>
            <LogIn className="h-4 w-4 text-lime-300" />
          </button>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mt-6 space-y-4"
        >
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur">
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-zinc-300">
              <Dices className="h-4 w-4 text-lime-300" /> Start a new room
            </h2>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="Your nickname"
              maxLength={16}
              className="mt-3 h-12 border-white/10 bg-black/30 text-base"
            />
            <Button
              onClick={handleCreate}
              disabled={!name.trim() || busy !== null}
              className="mt-3 h-12 w-full rounded-xl bg-lime-400 text-base font-bold text-black hover:bg-lime-300"
            >
              {busy === "create" ? "Creating…" : "Create room"}
            </Button>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur">
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-zinc-300">
              <LogIn className="h-4 w-4 text-violet-300" /> Join a friend
            </h2>
            <div className="mt-3 flex gap-2">
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4))}
                onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                placeholder="CODE"
                maxLength={4}
                className="h-12 w-28 border-white/10 bg-black/30 text-center font-mono text-xl font-bold tracking-[0.3em]"
              />
              <Input
                value={joinName}
                onChange={(e) => setJoinName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                placeholder="Nickname"
                maxLength={16}
                className="h-12 flex-1 border-white/10 bg-black/30 text-base"
              />
            </div>
            <Button
              onClick={handleJoin}
              disabled={code.length < 4 || !joinName.trim() || busy !== null}
              variant="secondary"
              className="mt-3 h-12 w-full rounded-xl bg-white/10 text-base font-bold hover:bg-white/15"
            >
              {busy === "join" ? "Joining…" : "Join room"}
            </Button>
          </div>

          {error && <p className="text-center text-sm font-medium text-rose-400">{error}</p>}
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35 }}
          className="mt-auto space-y-3 pt-10"
        >
          <p className="text-center font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-500">how it works</p>
          {[
            { icon: Vote, title: "Everyone answers", body: "A trivia question drops. All players lock an answer in private." },
            { icon: Search, title: "Someone's cheating", body: "One random player already saw the right answer. Blend in or get burned." },
            { icon: Trophy, title: "Unmask & score", body: "Spot the cheat for +150. The cheat scores big only if they escape." },
          ].map((s) => (
            <div key={s.title} className="flex items-start gap-3 rounded-xl border border-white/5 bg-white/[0.03] p-3">
              <div className="rounded-lg bg-white/5 p-2">
                <s.icon className="h-4 w-4 text-lime-300" />
              </div>
              <div>
                <p className="text-sm font-semibold text-zinc-100">{s.title}</p>
                <p className="text-xs leading-relaxed text-zinc-400">{s.body}</p>
              </div>
            </div>
          ))}
          <p className="pt-2 text-center text-[11px] text-zinc-400">3–12 players · one phone each · 5 rounds</p>
        </motion.div>
      </div>
    </main>
  )
}
