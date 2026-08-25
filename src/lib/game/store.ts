import { QUESTIONS } from "./questions"

export type Phase = "lobby" | "question" | "suspicion" | "scores" | "gameover"

export interface Player {
  id: string
  name: string
  score: number
  joinedAt: number
  lastSeen: number
  isBot?: boolean
}

export interface Round {
  q: { text: string; options: string[]; correctIndex: number }
  insiderId: string
  answerVotes: Record<string, number>
  suspectVotes: Record<string, string>
  gains: Record<string, Gain> | null
  startedAt: number
  botAnswerAt: Record<string, number>
  botSuspectAt: Record<string, number>
}

export interface Gain {
  answer: number
  guess: number
  edge: number
}

export interface Room {
  code: string
  createdAt: number
  players: Map<string, Player>
  joinOrder: string[]
  phase: Phase
  roundNum: number
  totalRounds: number
  rounds: Round[]
  insiderQueue: string[]
  usedQuestions: Set<number>
}

const CONNECTED_MS = 15_000
const MAX_PLAYERS = 12
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"

const g = globalThis as unknown as { __riggedRooms?: Map<string, Room> }
if (!g.__riggedRooms) g.__riggedRooms = new Map()
const rooms = g.__riggedRooms

function randomCode(): string {
  let s = ""
  for (let i = 0; i < 4; i++) s += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
  return s
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4)
}

function sweepOldRooms() {
  const now = Date.now()
  for (const [code, room] of rooms) {
    if (now - room.createdAt > 6 * 60 * 60 * 1000) rooms.delete(code)
  }
}

export function createRoom(hostName: string): { room: Room; playerId: string } {
  sweepOldRooms()
  let code = randomCode()
  while (rooms.has(code)) code = randomCode()
  const now = Date.now()
  const hostId = crypto.randomUUID()
  const player: Player = { id: hostId, name: hostName, score: 0, joinedAt: now, lastSeen: now }
  const room: Room = {
    code,
    createdAt: now,
    players: new Map([[hostId, player]]),
    joinOrder: [hostId],
    phase: "lobby",
    roundNum: 0,
    totalRounds: 5,
    rounds: [],
    insiderQueue: [],
    usedQuestions: new Set(),
  }
  rooms.set(code, room)
  return { room, playerId: hostId }
}

export function getRoom(codeRaw: string): Room | undefined {
  return rooms.get(normalizeCode(codeRaw))
}

export function joinRoom(codeRaw: string, name: string): { ok: true; pid: string } | { ok: false; error: string } {
  sweepOldRooms()
  const room = getRoom(codeRaw)
  if (!room) return { ok: false, error: "ROOM_NOT_FOUND" }
  if (room.players.size >= MAX_PLAYERS) return { ok: false, error: "ROOM_FULL" }
  let finalName = name.trim().slice(0, 16)
  if (!finalName) finalName = "Player"
  const existingNames = new Set([...room.players.values()].map((p) => p.name))
  if (existingNames.has(finalName)) {
    let n = 2
    while (existingNames.has(`${finalName} ${n}`)) n++
    finalName = `${finalName} ${n}`
  }
  // Reconnect support: same device rejoining with same name in lobby picks old identity back up
  const now = Date.now()
  const pid = crypto.randomUUID()
  room.players.set(pid, { id: pid, name: finalName, score: 0, joinedAt: now, lastSeen: now })
  room.joinOrder.push(pid)
  return { ok: true, pid }
}

function buildInsiderQueue(room: Room) {
  const ids = room.joinOrder.filter((id) => room.players.has(id))
  // keep leftover queue entries first so everyone gets a turn before repeats
  const remaining = room.insiderQueue.filter((id) => room.players.has(id))
  const rest = shuffle(ids.filter((id) => !remaining.includes(id)))
  room.insiderQueue = [...remaining, ...rest]
}

function nextInsider(room: Room): string {
  const liveIds = new Set(room.players.keys())
  while (room.insiderQueue.length) {
    const id = room.insiderQueue.shift()!
    if (liveIds.has(id)) return id
  }
  buildInsiderQueue(room)
  return room.insiderQueue.shift()!
}

function buildRoundQuestion(room: Room) {
  let idx = Math.floor(Math.random() * QUESTIONS.length)
  let guard = 0
  while (room.usedQuestions.has(idx) && guard++ < 200) {
    idx = Math.floor(Math.random() * QUESTIONS.length)
  }
  if (room.usedQuestions.size >= QUESTIONS.length - 2) room.usedQuestions.clear()
  room.usedQuestions.add(idx)
  const raw = QUESTIONS[idx]
  const perm = shuffle([0, 1, 2, 3])
  const options = perm.map((i) => raw.options[i])
  const correctIndex = perm.indexOf(raw.correctIndex)
  return { text: raw.text, options, correctIndex }
}

function startNextRound(room: Room) {
  if (room.phase === "lobby") buildInsiderQueue(room)
  const now = Date.now()
  room.roundNum += 1
  const round: Round = {
    q: buildRoundQuestion(room),
    insiderId: nextInsider(room),
    answerVotes: {},
    suspectVotes: {},
    gains: null,
    startedAt: now,
    botAnswerAt: {},
    botSuspectAt: {},
  }
  for (const p of room.players.values()) {
    if (p.isBot) round.botAnswerAt[p.id] = now + 3500 + Math.random() * 9000
  }
  room.rounds.push(round)
  room.phase = "question"
}

export function connectedPlayers(room: Room): Player[] {
  const now = Date.now()
  return room.joinOrder
    .map((id) => room.players.get(id))
    .filter((p): p is Player => !!p && (p.isBot || now - p.lastSeen < CONNECTED_MS))
}

function currentRound(room: Room): Round | undefined {
  return room.rounds[room.rounds.length - 1]
}

function computeGains(round: Round, playerCount: number): Record<string, Gain> {
  const gains: Record<string, Gain> = {}
  const othersCount = playerCount - 1
  const votesAgainstInsider = Object.values(round.suspectVotes).filter((sid) => sid === round.insiderId).length
  const escaped = votesAgainstInsider * 2 < othersCount
  const insiderVote = round.answerVotes[round.insiderId]
  const insiderEdge =
    insiderVote === round.q.correctIndex && escaped ? 250 : 0
  for (const pid of Object.keys(round.answerVotes)) {
    gains[pid] = { answer: 0, guess: 0, edge: 0 }
  }
  for (const [pid, choice] of Object.entries(round.answerVotes)) {
    if (!gains[pid]) gains[pid] = { answer: 0, guess: 0, edge: 0 }
    gains[pid].answer = choice === round.q.correctIndex ? 100 : 0
  }
  for (const [pid, sid] of Object.entries(round.suspectVotes)) {
    if (!gains[pid]) gains[pid] = { answer: 0, guess: 0, edge: 0 }
    gains[pid].guess = sid === round.insiderId ? 150 : 0
  }
  if (!gains[round.insiderId]) gains[round.insiderId] = { answer: 0, guess: 0, edge: 0 }
  gains[round.insiderId].edge = insiderEdge
  return gains
}

export function advance(room: Room, byPid: string): { ok: true } | { ok: false; error: string } {
  const connected = connectedPlayers(room)
  switch (room.phase) {
    case "lobby": {
      if (connected.length < 3) return { ok: false, error: "NEED_3_PLAYERS" }
      startNextRound(room)
      return { ok: true }
    }
    case "question": {
      const round = currentRound(room)!
      const missing = connected.some((p) => round.answerVotes[p.id] === undefined)
      if (missing) return { ok: false, error: "WAITING_FOR_VOTES" }
      room.phase = "suspicion"
      return { ok: true }
    }
    case "suspicion": {
      const round = currentRound(room)!
      const missing = connected.some((p) => round.suspectVotes[p.id] === undefined)
      if (missing) return { ok: false, error: "WAITING_FOR_VOTES" }
      const gains = computeGains(round, room.players.size)
      round.gains = gains
      for (const [pid, gain] of Object.entries(gains)) {
        const p = room.players.get(pid)
        if (p) p.score += gain.answer + gain.guess + gain.edge
      }
      room.phase = "scores"
      return { ok: true }
    }
    case "scores": {
      if (room.roundNum >= room.totalRounds) {
        room.phase = "gameover"
      } else {
        startNextRound(room)
      }
      return { ok: true }
    }
    case "gameover": {
      // fresh game: wipe everything back to a clean lobby
      room.phase = "lobby"
      room.roundNum = 0
      room.totalRounds = 5
      room.rounds = []
      room.usedQuestions.clear()
      for (const p of room.players.values()) p.score = 0
      return { ok: true }
    }
    default:
      void byPid
      return { ok: false, error: "BAD_PHASE" }
  }
}

export function voteAnswer(
  room: Room,
  pid: string,
  choice: number
): { ok: true } | { ok: false; error: string } {
  if (room.phase !== "question") return { ok: false, error: "BAD_PHASE" }
  const round = currentRound(room)
  if (!round) return { ok: false, error: "BAD_PHASE" }
  if (!room.players.has(pid)) return { ok: false, error: "PLAYER_NOT_FOUND" }
  if (!Number.isInteger(choice) || choice < 0 || choice > 3) return { ok: false, error: "BAD_CHOICE" }
  round.answerVotes[pid] = choice
  return { ok: true }
}

export function voteSuspect(
  room: Room,
  pid: string,
  suspectId: string
): { ok: true } | { ok: false; error: string } {
  if (room.phase !== "suspicion") return { ok: false, error: "BAD_PHASE" }
  const round = currentRound(room)
  if (!round) return { ok: false, error: "BAD_PHASE" }
  if (!room.players.has(pid)) return { ok: false, error: "PLAYER_NOT_FOUND" }
  if (pid === suspectId || !room.players.has(suspectId)) return { ok: false, error: "BAD_SUSPECT" }
  round.suspectVotes[pid] = suspectId
  return { ok: true }
}

/* ---------- bots ---------- */

const BOT_NAMES = ["Nova", "Rex", "Pixel", "Echo", "Juno", "Blitz", "Onyx", "Vega", "Rook", "Milo"]

export function addBot(room: Room): { ok: true } | { ok: false; error: string } {
  if (room.phase !== "lobby") return { ok: false, error: "BAD_PHASE" }
  if (room.players.size >= MAX_PLAYERS) return { ok: false, error: "ROOM_FULL" }
  const used = new Set([...room.players.values()].map((p) => p.name))
  let name = BOT_NAMES.find((n) => !used.has(n)) ?? `Bot ${room.players.size}`
  const now = Date.now()
  const id = `bot-${crypto.randomUUID()}`
  room.players.set(id, { id, name, score: 0, joinedAt: now, lastSeen: now, isBot: true })
  room.joinOrder.push(id)
  room.insiderQueue.push(id)
  return { ok: true }
}

export function kickBot(room: Room, botId: string): { ok: true } | { ok: false; error: string } {
  if (room.phase !== "lobby") return { ok: false, error: "BAD_PHASE" }
  const bot = room.players.get(botId)
  if (!bot?.isBot) return { ok: false, error: "NOT_A_BOT" }
  room.players.delete(botId)
  room.joinOrder = room.joinOrder.filter((id) => id !== botId)
  room.insiderQueue = room.insiderQueue.filter((id) => id !== botId)
  return { ok: true }
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function botAnswerChoice(round: Round, botId: string): number {
  if (round.insiderId === botId) return round.q.correctIndex
  if (Math.random() < 0.45) return round.q.correctIndex
  const wrong = [0, 1, 2, 3].filter((i) => i !== round.q.correctIndex)
  return pick(wrong)
}

function botSuspectChoice(room: Room, round: Round, botId: string): string {
  const candidates = room.joinOrder.filter((id) => id !== botId && room.players.has(id))
  if (!candidates.length) return botId // should never happen with >=3 players
  const correctOthers = candidates.filter((id) => round.answerVotes[id] === round.q.correctIndex)
  if (round.insiderId === botId) {
    // the cheat deflects onto someone who looks confident
    return correctOthers.length ? pick(correctOthers) : pick(candidates)
  }
  // honest bots mostly grow suspicious of anyone who nailed the answer
  if (correctOthers.length && Math.random() < 0.65) return pick(correctOthers)
  return pick(candidates)
}

export function tickBots(room: Room) {
  const now = Date.now()
  const round = currentRound(room)
  if (!round) return
  if (room.phase === "question") {
    for (const [bid, at] of Object.entries(round.botAnswerAt)) {
      if (now >= at && round.answerVotes[bid] === undefined && room.players.get(bid)?.isBot) {
        round.answerVotes[bid] = botAnswerChoice(round, bid)
      }
    }
  } else if (room.phase === "suspicion") {
    if (!Object.keys(round.botSuspectAt).length) {
      for (const p of room.players.values()) {
        if (p.isBot) round.botSuspectAt[p.id] = now + 3000 + Math.random() * 9000
      }
    }
    for (const [bid, at] of Object.entries(round.botSuspectAt)) {
      if (now >= at && round.suspectVotes[bid] === undefined && room.players.get(bid)?.isBot) {
        round.suspectVotes[bid] = botSuspectChoice(room, round, bid)
      }
    }
  }
}

export interface PlayerView {
  code: string
  phase: Phase
  roundNum: number
  totalRounds: number
  meId: string
  players: Array<{ id: string; name: string; score: number; connected: boolean; isBot: boolean }>
  question: { text: string; options: string[] } | null
  myAnswer: number | null
  mySuspect: string | null
  correctIndex: number | null
  answerVotesPublic: Record<string, number> | null
  suspectVotesPublic: Record<string, string> | null
  insiderId: string | null
  gains: Record<string, Gain> | null
  iAmInsider: boolean
  votesLocked: number
  votesNeeded: number
  suspectsLocked: number
  suspectsNeeded: number
  winnerIds: string[] | null
}

export function buildView(room: Room, pid: string): PlayerView {
  const now = Date.now()
  const me = room.players.get(pid)
  const players = room.joinOrder
    .map((id) => room.players.get(id))
    .filter((p): p is Player => !!p)
    .map((p) => ({
      id: p.id,
      name: p.name,
      score: p.score,
      connected: p.isBot || now - p.lastSeen < CONNECTED_MS,
      isBot: !!p.isBot,
    }))
  const connected = players.filter((p) => p.connected)

  const view: PlayerView = {
    code: room.code,
    phase: room.phase,
    roundNum: room.roundNum,
    totalRounds: room.totalRounds,
    meId: pid,
    players,
    question: null,
    myAnswer: null,
    mySuspect: null,
    correctIndex: null,
    answerVotesPublic: null,
    suspectVotesPublic: null,
    insiderId: null,
    gains: null,
    iAmInsider: false,
    votesLocked: 0,
    votesNeeded: connected.length,
    suspectsLocked: 0,
    suspectsNeeded: connected.length,
    winnerIds: null,
  }

  if (room.phase === "gameover") {
    const top = Math.max(...players.map((p) => p.score), 0)
    view.winnerIds = players.filter((p) => p.score === top && top > 0).map((p) => p.id)
  }

  const round = currentRound(room)
  if (!round || room.phase === "lobby") return view

  view.question = { text: round.q.text, options: round.q.options }

  if (room.phase === "question") {
    view.iAmInsider = round.insiderId === pid
    // the edge: only the insider's own view ever carries this during voting
    if (view.iAmInsider) view.correctIndex = round.q.correctIndex
    view.myAnswer = round.answerVotes[pid] ?? null
    view.votesLocked = Object.keys(round.answerVotes).length
  }

  if (room.phase === "suspicion") {
    // answer votes become public knowledge here; insider identity stays secret
    view.correctIndex = round.q.correctIndex
    view.answerVotesPublic = { ...round.answerVotes }
    view.myAnswer = round.answerVotes[pid] ?? null
    view.mySuspect = round.suspectVotes[pid] ?? null
    view.iAmInsider = round.insiderId === pid
    view.votesLocked = Object.keys(round.answerVotes).length
    view.suspectsLocked = Object.keys(round.suspectVotes).length
  }

  if (room.phase === "scores" || room.phase === "gameover") {
    view.correctIndex = round.q.correctIndex
    view.answerVotesPublic = { ...round.answerVotes }
    view.suspectVotesPublic = { ...round.suspectVotes }
    view.insiderId = round.insiderId
    view.iAmInsider = round.insiderId === pid
    view.gains = round.gains
  }

  return view
}
