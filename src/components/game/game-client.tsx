"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"
import {
  Check,
  ChevronLeft,
  Copy,
  Crown,
  Eye,
  EyeOff,
  Fingerprint,
  HelpCircle,
  Search,
  Sparkles,
  Target,
  Trophy,
  Zap,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import type { Gain, PlayerView } from "@/lib/game/store"
import { loadSavedName, loadSession, playerColor, postAction, saveSession } from "./shared"

type View = PlayerView

export default function GameClient() {
  const params = useParams<{ code: string }>()
  const code = (params.code ?? "").toUpperCase()

  const [pid, setPid] = useState<string | null>(null)
  const [gateOpen, setGateOpen] = useState(false)
  const [gateName, setGateName] = useState("")
  const [gateError, setGateError] = useState("")
  const [roomGone, setRoomGone] = useState(false)

  const [view, setView] = useState<View | null>(null)
  const [showInsiderSplash, setShowInsiderSplash] = useState(false)
  const lastInsiderRound = useRef(0)
  const splashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const s = loadSession()
    if (s && s.code === code && s.pid) {
      setPid(s.pid)
    } else {
      setGateName(loadSavedName())
      setGateOpen(true)
    }
  }, [code])

  const poll = useCallback(async () => {
    if (!pid) return
    try {
      const res = await fetch(`/api/game?code=${code}&pid=${pid}`, { cache: "no-store" })
      if (res.status === 404) {
        const data = await res.json()
        if (data.error === "ROOM_NOT_FOUND") {
          setRoomGone(true)
          return
        }
        // server lost our seat — rejoin gate
        setPid(null)
        setGateName(loadSavedName())
        setGateOpen(true)
        return
      }
      const data = await res.json()
      if (data.ok) setView(data.view as View)
    } catch {
      /* transient network error — next tick retries */
    }
  }, [code, pid])

  useEffect(() => {
    if (!pid) return
    poll()
    const t = setInterval(poll, 1200)
    return () => clearInterval(t)
  }, [poll, pid])

  const act = useCallback(
    async (body: Record<string, unknown>) => {
      if (!pid) return
      const { data } = await postAction({ ...body, code, pid })
      if (data.ok && data.view) {
        setView(data.view as View)
      } else if (!data.ok) {
        const err = data.error as string
        if (err === "WAITING_FOR_VOTES") console.log("still waiting for votes")
        else if (err === "NEED_3_PLAYERS") alert("You need at least 3 players to start.")
      }
    },
    [code, pid]
  )

  // insider splash when a new round starts and I'm the cheat
  useEffect(() => {
    if (!view) return
    if (view.phase === "question" && view.iAmInsider && view.roundNum > lastInsiderRound.current) {
      lastInsiderRound.current = view.roundNum
      setShowInsiderSplash(true)
      if (splashTimer.current) clearTimeout(splashTimer.current)
      splashTimer.current = setTimeout(() => setShowInsiderSplash(false), 2800)
    }
    if (view.phase !== "question") setShowInsiderSplash(false)
  }, [view])

  function handleJoinGate() {
    const name = gateName.trim()
    if (!name) return
    postAction({ type: "join", code, name }).then(({ data }) => {
      if (data.ok && data.pid) {
        saveSession({ code, pid: data.pid as string, name })
        setPid(data.pid as string)
        setGateOpen(false)
        setGateError("")
      } else {
        const err = data.error as string
        setGateError(
          err === "ROOM_NOT_FOUND"
            ? "Room not found — it may have expired."
            : err === "ROOM_FULL"
              ? "Room is full."
              : "Could not join."
        )
      }
    })
  }

  if (roomGone) {
    return (
      <Centered>
        <p className="font-mono text-4xl font-black tracking-tight text-zinc-300">RIP ROOM</p>
        <p className="mt-2 text-sm text-zinc-500">This room closed or the server restarted.</p>
        <Link href="/" className="mt-6">
          <Button className="rounded-xl bg-lime-400 font-bold text-black hover:bg-lime-300">Back home</Button>
        </Link>
      </Centered>
    )
  }

  if (!view || !pid) {
    return (
      <>
        <Centered>
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-lime-300/30 border-t-lime-300" />
          <p className="mt-4 font-mono text-xs uppercase tracking-[0.3em] text-zinc-500">entering room {code}</p>
        </Centered>
        <AnimatePresence>
          {gateOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6 backdrop-blur"
            >
              <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-zinc-900 p-6">
                <div className="mx-auto mb-1 w-fit rounded-lg bg-white/5 p-2">
                  <Fingerprint className="h-5 w-5 text-lime-300" />
                </div>
                <h2 className="text-center text-lg font-bold">Join room {code}</h2>
                <Input
                  autoFocus
                  value={gateName}
                  onChange={(e) => setGateName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleJoinGate()}
                  placeholder="Your nickname"
                  maxLength={16}
                  className="mt-4 h-12 border-white/10 bg-black/40 text-center text-base"
                />
                {gateError && <p className="mt-2 text-center text-sm text-rose-400">{gateError}</p>}
                <Button
                  onClick={handleJoinGate}
                  disabled={!gateName.trim()}
                  className="mt-3 h-12 w-full rounded-xl bg-lime-400 font-bold text-black hover:bg-lime-300"
                >
                  Take a seat
                </Button>
                <Link href="/" className="mt-3 block text-center text-xs text-zinc-500 hover:text-zinc-300">
                  Back home
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </>
    )
  }

  return (
    <main className="relative min-h-dvh overflow-hidden text-zinc-100">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/4 h-[420px] w-[420px] rounded-full bg-lime-400/[0.07] blur-[120px]" />
        <div className="absolute -bottom-52 right-0 h-[480px] w-[480px] rounded-full bg-violet-500/[0.08] blur-[130px]" />
      </div>

      <div className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pb-28 pt-4">
        <TopBar view={view} />

        <div className="flex-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={view.phase + view.roundNum}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -14 }}
              transition={{ duration: 0.25 }}
            >
              {view.phase === "lobby" && <Lobby view={view} act={act} />}
              {view.phase === "question" && <QuestionPhase view={view} act={act} />}
              {view.phase === "suspicion" && <SuspicionPhase view={view} act={act} />}
              {view.phase === "scores" && <ScoresPhase view={view} act={act} />}
              {view.phase === "gameover" && <GameOver view={view} act={act} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <AnimatePresence>
        {showInsiderSplash && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowInsiderSplash(false)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md"
          >
            <div className="px-8 text-center">
              <motion.div
                initial={{ scale: 0.6, rotate: -8 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 200, damping: 14 }}
                className="mx-auto w-fit rounded-3xl border border-amber-300/30 bg-amber-400/10 p-6"
              >
                <Eye className="h-12 w-12 text-amber-300" />
              </motion.div>
              <motion.h2
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="mt-6 font-mono text-3xl font-black tracking-tight text-amber-200"
              >
                THE FIX IS IN
              </motion.h2>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.45 }}
                className="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-zinc-400"
              >
                You secretly see the right answer this round. Vote for it like you earned it —{" "}
                <span className="text-amber-200">don&apos;t get caught.</span>
              </motion.p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  )
}

/* ---------- chrome ---------- */

function TopBar({ view }: { view: View }) {
  const [copied, setCopied] = useState(false)
  return (
    <header className="mb-4 flex items-center justify-between gap-2">
      <Link href="/" className="font-mono text-lg font-black tracking-tighter text-zinc-100">
        RIGGED<span className="text-lime-400">.</span>
      </Link>
      <div className="flex items-center gap-2">
        {(view.phase === "lobby" || view.phase === "gameover") ? null : (
          <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 font-mono text-[11px] tracking-wider text-zinc-400">
            RD {view.roundNum}/{view.totalRounds}
          </span>
        )}
        <button
          onClick={() => {
            navigator.clipboard?.writeText(view.code).catch(() => {})
            setCopied(true)
            setTimeout(() => setCopied(false), 1200)
          }}
          className="flex items-center gap-1.5 rounded-full border border-lime-400/30 bg-lime-400/10 px-2.5 py-1 font-mono text-xs font-bold tracking-[0.2em] text-lime-300 transition hover:bg-lime-400/20"
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {view.code}
        </button>
        <HelpDialog />
      </div>
    </header>
  )
}

function HelpDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="rounded-full border border-white/10 bg-white/5 p-2 text-zinc-400 transition hover:text-zinc-100">
          <HelpCircle className="h-4 w-4" />
        </button>
      </DialogTrigger>
      <DialogContent className="border-white/10 bg-zinc-900 text-zinc-100">
        <DialogHeader>
          <DialogTitle className="font-mono tracking-tight">House rules</DialogTitle>
          <DialogDescription className="text-zinc-400">
            Each round one random player is secretly handed the answers.
          </DialogDescription>
        </DialogHeader>
        <ul className="space-y-2.5 text-sm">
          <Rule icon={<Vote />} pts="+100" label="Vote the correct answer" />
          <Rule icon={<Target />} pts="+150" label="Correctly accuse the cheater" />
          <Rule icon={<Zap />} pts="+250" label="Cheater bonus: right answer AND escapes detection" />
          <li className="flex items-start gap-2.5 rounded-xl border border-amber-300/20 bg-amber-400/5 p-3 text-xs leading-relaxed text-amber-200/80">
            <EyeOff className="mt-0.5 h-4 w-4 shrink-0" />
            The cheat sees a faint gold glow on the correct option — nobody else can see it. Get caught and the bonus burns.
          </li>
        </ul>
      </DialogContent>
    </Dialog>
  )
}

function Rule({ icon, pts, label }: { icon: React.ReactNode; pts: string; label: string }) {
  return (
    <li className="flex items-center gap-2.5 rounded-xl border border-white/5 bg-white/[0.03] p-3">
      <span className="text-zinc-400">{icon}</span>
      <span className="flex-1">{label}</span>
      <span className="font-mono text-sm font-bold text-lime-300">{pts}</span>
    </li>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return <main className="flex min-h-dvh flex-col items-center justify-center p-6 text-center text-zinc-100">{children}</main>
}

function Avatar({ id, name, size = "md" }: { id: string; name: string; size?: "sm" | "md" | "lg" }) {
  const dims = size === "sm" ? "h-6 w-6 text-[10px]" : size === "lg" ? "h-12 w-12 text-lg" : "h-9 w-9 text-xs"
  return (
    <span
      style={{ backgroundColor: `${playerColor(id)}22`, color: playerColor(id), borderColor: `${playerColor(id)}55` }}
      className={`inline-flex shrink-0 items-center justify-center rounded-full border font-bold ${dims}`}
    >
      {name.slice(0, 2).toUpperCase()}
    </span>
  )
}

/* ---------- lobby ---------- */

function Lobby({ view, act }: { view: View; act: (b: Record<string, unknown>) => void }) {
  const canStart = view.votesNeeded >= 3
  return (
    <div>
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-center backdrop-blur">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-500">room code</p>
        <p className="mt-1 select-all font-mono text-5xl font-black tracking-[0.15em] text-lime-300">{view.code}</p>
        <p className="mt-2 text-xs text-zinc-500">Share it — everyone joins on their own phone.</p>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-500">
          players · {view.players.length}/12
        </p>
        <span className="text-[11px] text-zinc-600">need 3+ to start</span>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {view.players.map((p) => (
          <div
            key={p.id}
            className="flex items-center gap-2.5 rounded-xl border border-white/5 bg-white/[0.03] p-3"
          >
            <Avatar id={p.id} name={p.name} />
            <span className="truncate text-sm font-semibold">{p.name}</span>
          </div>
        ))}
      </div>

      <Button
        onClick={() => act({ type: "advance" })}
        disabled={!canStart}
        className="mt-6 h-14 w-full rounded-2xl bg-lime-400 text-base font-black text-black shadow-[0_0_40px_-8px] shadow-lime-400/50 hover:bg-lime-300 disabled:opacity-40"
      >
        Start Round 1
      </Button>
      {!canStart && <p className="mt-2 text-center text-xs text-zinc-600">Waiting for more players…</p>}
    </div>
  )
}

/* ---------- question ---------- */

function QuestionPhase({
  view,
  act,
}: {
  view: View
  act: (b: Record<string, unknown>) => Promise<void>
}) {
  const locked = view.myAnswer !== null
  const pct = Math.min(100, Math.round((view.votesLocked / Math.max(view.votesNeeded, 1)) * 100))

  return (
    <div>
      <div className="flex items-center justify-between">
        <ProgressPill done={view.votesLocked} total={view.votesNeeded} label="locked in" pct={pct} />
        {view.iAmInsider && <EdgeBadge />}
      </div>

      <h2 className="mt-5 text-balance text-center text-2xl font-bold leading-snug">{view.question?.text}</h2>

      <div className="mt-5 space-y-2.5">
        {view.question?.options.map((opt, i) => {
          const mine = view.myAnswer === i
          const edge = view.iAmInsider && view.correctIndex === i
          return (
            <button
              key={i}
              onClick={() => act({ type: "vote-answer", choice: i })}
              className={[
                "relative flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition active:scale-[0.99]",
                edge
                  ? "border-amber-300/60 bg-gradient-to-r from-amber-400/15 via-amber-400/5 to-transparent shadow-[0_0_30px_-10px] shadow-amber-400/60"
                  : mine
                    ? "border-lime-400/70 bg-lime-400/10"
                    : "border-white/10 bg-white/[0.04] hover:border-white/25",
              ].join(" ")}
            >
              <span
                className={[
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-mono text-sm font-black",
                  edge ? "bg-amber-400/20 text-amber-200" : mine ? "bg-lime-400/20 text-lime-300" : "bg-white/5 text-zinc-400",
                ].join(" ")}
              >
                {"ABCD"[i]}
              </span>
              <span className="flex-1 text-[15px] font-medium leading-snug">{opt}</span>
              {edge && <Sparkles className="h-4 w-4 shrink-0 animate-pulse text-amber-300" />}
              {mine && <Check className="h-4 w-4 shrink-0 text-lime-300" />}
            </button>
          )
        })}
      </div>

      <p className="mt-4 text-center text-xs text-zinc-500">
        {locked ? (
          <>
            Answer locked <span className="text-zinc-600">(hidden from others)</span> — tap another option to change.
          </>
        ) : (
          "Tap an answer to lock it in. You can change until everyone's ready."
        )}
      </p>

      <AdvanceBar
        enabled={view.votesLocked >= view.votesNeeded}
        onClick={() => act({ type: "advance" })}
        label="Reveal votes & accuse"
        hint={view.votesLocked >= view.votesNeeded ? undefined : `Waiting for ${view.votesNeeded - Math.min(view.votesLocked, view.votesNeeded)} vote(s)…`}
      />
    </div>
  )
}

/* ---------- suspicion ---------- */

function SuspicionPhase({ view, act }: { view: View; act: (b: Record<string, unknown>) => Promise<void> }) {
  const byOption: string[][] = [[], [], [], []]
  for (const [voterId, choice] of Object.entries(view.answerVotesPublic ?? {})) {
    byOption[choice]?.push(voterId)
  }
  const pct = Math.min(100, Math.round((view.suspectsLocked / Math.max(view.suspectsNeeded, 1)) * 100))

  return (
    <div>
      <div className="flex items-center justify-between">
        <ProgressPill done={view.suspectsLocked} total={view.suspectsNeeded} label="accused" pct={pct} />
        {view.iAmInsider && <EdgeBadge deflect />}
      </div>

      <h2 className="mt-5 text-center font-mono text-sm uppercase tracking-[0.25em] text-zinc-400">
        the answer was
      </h2>
      <p className="mt-1 text-balance text-center text-xl font-bold text-lime-300">
        {view.correctIndex !== null ? view.question?.options[view.correctIndex] : ""}
      </p>

      <div className="mt-4 space-y-2">
        {view.question?.options.map((opt, i) => {
          const correct = view.correctIndex === i
          const voters = byOption[i] ?? []
          return (
            <div
              key={i}
              className={[
                "flex items-center gap-2.5 rounded-xl border p-2.5",
                correct ? "border-lime-400/40 bg-lime-400/10" : "border-white/5 bg-white/[0.02]",
              ].join(" ")}
            >
              <span className="w-24 shrink-0 truncate text-xs text-zinc-300">{opt}</span>
              <div className="flex flex-wrap gap-1">
                {voters.map((vid) => {
                  const p = view.players.find((x) => x.id === vid)
                  return <Avatar key={vid} id={vid} name={p?.name ?? "??"} size="sm" />
                })}
              </div>
              {correct && <Check className="ml-auto h-4 w-4 shrink-0 text-lime-300" />}
            </div>
          )
        })}
      </div>

      <h2 className="mt-6 flex items-center justify-center gap-2 text-center font-mono text-sm uppercase tracking-[0.25em] text-zinc-300">
        <Search className="h-4 w-4 text-rose-300" /> who cheated?
      </h2>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {view.players
          .filter((p) => p.id !== view.meId)
          .map((p) => {
            const picked = view.mySuspect === p.id
            return (
              <button
                key={p.id}
                onClick={() => act({ type: "vote-suspect", suspectId: p.id })}
                className={[
                  "flex items-center gap-2 rounded-xl border p-3 transition active:scale-[0.98]",
                  picked
                    ? "border-rose-400/70 bg-rose-400/10 shadow-[0_0_25px_-10px] shadow-rose-400/50"
                    : "border-white/10 bg-white/[0.03] hover:border-white/25",
                ].join(" ")}
              >
                <Avatar id={p.id} name={p.name} size="sm" />
                <span className="truncate text-sm font-semibold">{p.name}</span>
              </button>
            )
          })}
      </div>

      <AdvanceBar
        enabled={view.suspectsLocked >= view.suspectsNeeded}
        onClick={() => act({ type: "advance" })}
        label="Unmask the cheat"
        tone="danger"
        hint={
          view.suspectsLocked >= view.suspectsNeeded
            ? undefined
            : `Waiting for ${view.suspectsNeeded - Math.min(view.suspectsLocked, view.suspectsNeeded)} accusation(s)…`
        }
      />
    </div>
  )
}

/* ---------- scores ---------- */

function ScoresPhase({ view, act }: { view: View; act: (b: Record<string, unknown>) => Promise<void> }) {
  const insider = view.players.find((p) => p.id === view.insiderId)
  const standings = [...view.players].sort((a, b) => b.score - a.score)
  const lastRound = view.roundNum >= view.totalRounds

  function gainOf(pid: string): Gain {
    return view.gains?.[pid] ?? { answer: 0, guess: 0, edge: 0 }
  }

  return (
    <div>
      <motion.div
        initial={{ scale: 0.94, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="rounded-2xl border border-rose-400/30 bg-gradient-to-b from-rose-500/15 to-transparent p-5 text-center"
      >
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-rose-300/80">the cheat was</p>
        <div className="mt-3 flex items-center justify-center gap-3">
          {insider && <Avatar id={insider.id} name={insider.name} size="lg" />}
          <span className="text-2xl font-black">{insider?.name ?? "???"}</span>
        </div>
        <p className="mt-2 text-xs text-zinc-400">
          {(Object.values(view.suspectVotesPublic ?? {}).filter((s) => s === view.insiderId).length)} player(s) called
          it
        </p>
      </motion.div>

      <div className="mt-4 space-y-1.5">
        {standings.map((p, rank) => {
          const g = gainOf(p.id)
          const total = g.answer + g.guess + g.edge
          return (
            <div
              key={p.id}
              className={[
                "flex items-center gap-2.5 rounded-xl border p-3",
                p.id === view.meId ? "border-white/25 bg-white/[0.06]" : "border-white/5 bg-white/[0.03]",
              ].join(" ")}
            >
              <span className="w-5 shrink-0 text-center font-mono text-xs text-zinc-500">{rank + 1}</span>
              <Avatar id={p.id} name={p.name} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  {p.name}
                  {p.id === view.insiderId && <span className="ml-1.5 text-[10px] font-bold text-rose-300">CHEAT</span>}
                </p>
                <p className="flex gap-2 font-mono text-[10px] text-zinc-500">
                  <span className={g.answer ? "text-lime-400" : ""}>✓{g.answer}</span>
                  <span className={g.guess ? "text-sky-400" : ""}>🎯{g.guess}</span>
                  <span className={g.edge ? "text-amber-300" : ""}>⚡{g.edge}</span>
                </p>
              </div>
              <div className="text-right">
                <p className="font-mono text-base font-black">+{total}</p>
                <p className="font-mono text-[10px] text-zinc-500">{p.score} pts</p>
              </div>
            </div>
          )
        })}
      </div>

      <AdvanceBar
        enabled
        onClick={() => act({ type: "advance" })}
        label={lastRound ? "See final results" : `Next: Round ${view.roundNum + 1}`}
        primary={!lastRound}
      />
    </div>
  )
}

/* ---------- game over ---------- */

function GameOver({ view, act }: { view: View; act: (b: Record<string, unknown>) => Promise<void> }) {
  const standings = [...view.players].sort((a, b) => b.score - a.score)
  const topScore = standings[0]?.score ?? 0
  return (
    <div>
      <div className="text-center">
        <motion.div
          initial={{ rotate: -20, scale: 0.5 }}
          animate={{ rotate: 0, scale: 1 }}
          transition={{ type: "spring", damping: 10 }}
          className="mx-auto w-fit rounded-3xl border border-amber-300/30 bg-amber-400/10 p-5"
        >
          <Trophy className="h-10 w-10 text-amber-300" />
        </motion.div>
        <h2 className="mt-4 font-mono text-3xl font-black tracking-tight">
          {topScore > 0 ? "CASE CLOSED" : "NO WINNERS"}
        </h2>
        <p className="mt-1 text-sm text-zinc-400">
          {topScore > 0
            ? standings
                .filter((p) => p.score === topScore)
                .map((p) => p.name)
                .join(" & ") + " take the win"
            : "Everyone got played."}
        </p>
      </div>

      <div className="mt-6 space-y-1.5">
        {standings.map((p, rank) => (
          <div
            key={p.id}
            className={[
              "flex items-center gap-3 rounded-xl border p-3.5",
              rank === 0 && p.score === topScore
                ? "border-amber-300/40 bg-amber-400/10"
                : "border-white/5 bg-white/[0.03]",
            ].join(" ")}
          >
            <span className="w-5 text-center font-mono text-sm text-zinc-500">
              {["🥇", "🥈", "🥉"][rank] ?? rank + 1}
            </span>
            <Avatar id={p.id} name={p.name} />
            <span className="flex-1 truncate font-semibold">{p.name}</span>
            {p.score === topScore && topScore > 0 && <Crown className="h-4 w-4 text-amber-300" />}
            <span className="font-mono text-lg font-black">{p.score}</span>
          </div>
        ))}
      </div>

      <AdvanceBar enabled onClick={() => act({ type: "advance" })} label="Play again" />
      <Link href="/" className="mt-3 block text-center text-xs text-zinc-600 hover:text-zinc-400">
        Leave room
      </Link>
    </div>
  )
}

/* ---------- bits ---------- */

function ProgressPill({ done, total, label, pct }: { done: number; total: number; label: string; pct: number }) {
  return (
    <div className="min-w-0 flex-1">
      <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-zinc-500">
        {done}/{total} {label}
      </p>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/10">
        <motion.div
          className="h-full rounded-full bg-lime-400"
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.4 }}
        />
      </div>
    </div>
  )
}

function EdgeBadge({ deflect = false }: { deflect?: boolean }) {
  return (
    <span className="flex shrink-0 items-center gap-1 rounded-full border border-amber-300/30 bg-amber-400/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-amber-300">
      <Sparkles className="h-3 w-3" />
      {deflect ? "deflect!" : "edge active"}
    </span>
  )
}

function AdvanceBar({
  enabled,
  onClick,
  label,
  hint,
  tone = "normal",
  primary = false,
}: {
  enabled: boolean
  onClick: () => void
  label: string
  hint?: string
  tone?: "normal" | "danger"
  primary?: boolean
}) {
  const base =
    tone === "danger"
      ? "bg-rose-400 text-black hover:bg-rose-300 shadow-rose-400/40"
      : primary
        ? "bg-lime-400 text-black hover:bg-lime-300 shadow-lime-400/40"
        : "bg-white/10 text-zinc-100 hover:bg-white/15"
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/5 bg-black/70 p-4 backdrop-blur-md">
      <div className="mx-auto max-w-md">
        <Button
          onClick={onClick}
          disabled={!enabled}
          className={`h-14 w-full rounded-2xl text-base font-black disabled:opacity-35 ${base} shadow-[0_0_36px_-8px]`}
        >
          {label}
        </Button>
        {hint && <p className="mt-1.5 text-center text-[11px] text-zinc-500">{hint}</p>}
      </div>
    </div>
  )
}

function Vote() {
  return <Check className="h-4 w-4" />
}
