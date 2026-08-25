export type Phase = "lobby" | "night" | "dawn" | "day" | "verdict" | "gameover"
export type Role = "villager" | "seer" | "guardian" | "umbral"

export interface Player {
  id: string
  name: string
  wins: number
  joinedAt: number
  lastSeen: number
  isBot?: boolean
}

export interface Game {
  roundNum: number
  roles: Record<string, Role>
  alive: Record<string, boolean>
  seerKnowledge: Record<string, Role>
  lastProtected: string | null
  wolfVotes: Record<string, string>
  guardTarget: string | null
  seerTarget: string | null
  dayVotes: Record<string, string>
  lastNight: { victim: string | null; savedBy: string | null } | null
  lastBanished: { playerId: string; role: Role } | null
  botActAt: Record<string, number>
}

export interface Room {
  code: string
  createdAt: number
  players: Map<string, Player>
  joinOrder: string[]
  phase: Phase
  game: Game | null
}

const CONNECTED_MS = 15_000
const MAX_PLAYERS = 12
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"

const g = globalThis as unknown as { __shadowfellRooms?: Map<string, Room> }
if (!g.__shadowfellRooms) g.__shadowfellRooms = new Map()
const rooms = g.__shadowfellRooms

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

export function setupFor(count: number): { umbrals: number; seer: boolean; guardian: boolean } {
  const umbrals = count <= 5 ? 1 : count <= 8 ? 2 : 3
  return { umbrals, seer: true, guardian: count >= 6 }
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
  const player: Player = { id: hostId, name: hostName, wins: 0, joinedAt: now, lastSeen: now }
  const room: Room = {
    code,
    createdAt: now,
    players: new Map([[hostId, player]]),
    joinOrder: [hostId],
    phase: "lobby",
    game: null,
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
  if (!finalName) finalName = "Wanderer"
  const existingNames = new Set([...room.players.values()].map((p) => p.name))
  if (existingNames.has(finalName)) {
    let n = 2
    while (existingNames.has(`${finalName} ${n}`)) n++
    finalName = `${finalName} ${n}`
  }
  const now = Date.now()
  const pid = crypto.randomUUID()
  room.players.set(pid, { id: pid, name: finalName, wins: 0, joinedAt: now, lastSeen: now })
  room.joinOrder.push(pid)
  return { ok: true, pid }
}

export function connectedPlayers(room: Room): Player[] {
  const now = Date.now()
  return room.joinOrder
    .map((id) => room.players.get(id))
    .filter((p): p is Player => !!p && (p.isBot || now - p.lastSeen < CONNECTED_MS))
}

/* ---------- bots ---------- */

const BOT_NAMES = ["Thorne", "Mira", "Fenwick", "Sable", "Orrin", "Wren", "Grimm", "Elara", "Duskar", "Lyra"]

export function addBot(room: Room): { ok: true } | { ok: false; error: string } {
  if (room.phase !== "lobby") return { ok: false, error: "BAD_PHASE" }
  if (room.players.size >= MAX_PLAYERS) return { ok: false, error: "ROOM_FULL" }
  const used = new Set([...room.players.values()].map((p) => p.name))
  const name = BOT_NAMES.find((n) => !used.has(n)) ?? `Bot ${room.players.size}`
  const now = Date.now()
  const id = `bot-${crypto.randomUUID()}`
  room.players.set(id, { id, name, wins: 0, joinedAt: now, lastSeen: now, isBot: true })
  room.joinOrder.push(id)
  return { ok: true }
}

export function kickBot(room: Room, botId: string): { ok: true } | { ok: false; error: string } {
  if (room.phase !== "lobby") return { ok: false, error: "BAD_PHASE" }
  if (!room.players.get(botId)?.isBot) return { ok: false, error: "NOT_A_BOT" }
  room.players.delete(botId)
  room.joinOrder = room.joinOrder.filter((id) => id !== botId)
  return { ok: true }
}

/* ---------- game setup & flow ---------- */

function livingIds(room: Room): string[] {
  const game = room.game!
  return room.joinOrder.filter((id) => room.players.has(id) && game.alive[id])
}

function startGame(room: Room) {
  const ids = room.joinOrder.filter((id) => room.players.has(id))
  const setup = setupFor(ids.length)
  const deck: Role[] = []
  for (let i = 0; i < setup.umbrals; i++) deck.push("umbral")
  deck.push("seer")
  if (setup.guardian) deck.push("guardian")
  while (deck.length < ids.length) deck.push("villager")
  const shuffled = shuffle(deck)
  const roles: Record<string, Role> = {}
  const alive: Record<string, boolean> = {}
  ids.forEach((id, i) => {
    roles[id] = shuffled[i]
    alive[id] = true
  })
  room.game = {
    roundNum: 1,
    roles,
    alive,
    seerKnowledge: {},
    lastProtected: null,
    wolfVotes: {},
    guardTarget: null,
    seerTarget: null,
    dayVotes: {},
    lastNight: null,
    lastBanished: null,
    botActAt: {},
  }
  scheduleBotActs(room)
}

function scheduleBotActs(room: Room) {
  const game = room.game!
  const now = Date.now()
  game.botActAt = {}
  for (const id of livingIds(room)) {
    const role = game.roles[id]
    const actsTonight = role === "umbral" || role === "seer" || role === "guardian" || room.phase === "day"
    if (room.players.get(id)?.isBot && actsTonight) {
      game.botActAt[id] = now + 3000 + Math.random() * 9000
    }
  }
}

export function advance(room: Room): { ok: true } | { ok: false; error: string } {
  switch (room.phase) {
    case "lobby": {
      const connected = connectedPlayers(room)
      if (connected.length < 4 || connected.length > MAX_PLAYERS) return { ok: false, error: "NEED_4_PLAYERS" }
      startGame(room)
      room.phase = "night"
      return { ok: true }
    }
    case "night": {
      const game = room.game!
      const connectedLiving = connectedPlayers(room).filter((p) => game.alive[p.id])
      for (const p of connectedLiving) {
        const role = game.roles[p.id]
        if (role === "umbral" && !game.wolfVotes[p.id]) return { ok: false, error: "WAITING_FOR_ACTS" }
        if (role === "seer" && !game.seerTarget) return { ok: false, error: "WAITING_FOR_ACTS" }
        if (role === "guardian" && !game.guardTarget) return { ok: false, error: "WAITING_FOR_ACTS" }
      }
      resolveNight(room)
      room.phase = "dawn"
      return { ok: true }
    }
    case "dawn": {
      if (!room.game) return { ok: false, error: "BAD_PHASE" }
      room.phase = "day"
      room.game.dayVotes = {}
      scheduleBotActs(room)
      return { ok: true }
    }
    case "day": {
      const game = room.game!
      const connectedLiving = connectedPlayers(room).filter((p) => game.alive[p.id])
      if (connectedLiving.some((p) => !game.dayVotes[p.id])) return { ok: false, error: "WAITING_FOR_VOTES" }
      resolveDay(room)
      if (checkWin(room)) {
        room.phase = "gameover"
      } else {
        room.game.roundNum += 1
        room.game.wolfVotes = {}
        room.game.guardTarget = null
        room.game.seerTarget = null
        room.game.botActAt = {}
        scheduleBotActs(room)
        room.phase = "night"
      }
      return { ok: true }
    }
    case "verdict":
      return { ok: false, error: "BAD_PHASE" }
    case "scores":
      return { ok: false, error: "BAD_PHASE" }
    case "gameover": {
      room.phase = "lobby"
      room.game = null
      return { ok: true }
    }
  }
}

function majorityVote(votes: Record<string, string>, validTargets: Set<string>): string | null {
  const tally: Record<string, number> = {}
  for (const target of Object.values(votes)) {
    if (validTargets.has(target)) tally[target] = (tally[target] ?? 0) + 1
  }
  let best: string | null = null
  let bestCount = 0
  let tie = false
  for (const [target, count] of Object.entries(tally)) {
    if (count > bestCount) {
      best = target
      bestCount = count
      tie = false
    } else if (count === bestCount) tie = true
  }
  return tie ? null : best
}

function resolveNight(room: Room) {
  const game = room.game!
  const prey = new Set(livingIds(room).filter((id) => game.roles[id] !== "umbral"))
  const victim = majorityVote(game.wolfVotes, prey)
  const saved = victim !== null && game.guardTarget === victim
  if (victim && !saved) game.alive[victim] = false
  game.lastNight = { victim: saved ? null : victim, savedBy: saved ? game.guardTarget : null }
  game.wolfVotes = {}
  game.seerTarget = null
  game.guardTarget = null
}

function resolveDay(room: Room) {
  const game = room.game!
  const candidates = new Set(livingIds(room))
  const condemned = majorityVote(game.dayVotes, candidates)
  game.lastBanished = null
  if (condemned) {
    game.alive[condemned] = false
    game.lastBanished = { playerId: condemned, role: game.roles[condemned] }
  }
  game.dayVotes = {}
}

function winnerOf(room: Room): "dawn" | "umbra" | null {
  const game = room.game!
  const living = livingIds(room)
  const wolves = living.filter((id) => game.roles[id] === "umbral").length
  const dawn = living.length - wolves
  if (wolves === 0) return "dawn"
  if (wolves >= dawn) return "umbra"
  return null
}

function checkWin(room: Room): boolean {
  const win = winnerOf(room)
  if (!win) return false
  const game = room.game!
  for (const [id, role] of Object.entries(game.roles)) {
    const p = room.players.get(id)
    if (p && (win === "umbra") === (role === "umbral")) p.wins += 1
  }
  return true
}

/* ---------- player actions ---------- */

function validateTarget(room: Room, pid: string, targetId: string): { ok: true; target: string } | { ok: false; error: string } {
  const game = room.game!
  if (!room.players.has(pid)) return { ok: false, error: "PLAYER_NOT_FOUND" }
  if (pid === targetId) return { ok: false, error: "BAD_TARGET" }
  if (!room.players.has(targetId) || !game.alive[targetId]) return { ok: false, error: "BAD_TARGET" }
  return { ok: true, target: targetId }
}

export function nightAction(
  room: Room,
  pid: string,
  kind: "kill" | "inspect" | "protect",
  targetId: string
): { ok: true } | { ok: false; error: string } {
  if (room.phase !== "night" || !room.game) return { ok: false, error: "BAD_PHASE" }
  const me = room.players.get(pid)
  if (!me || !room.game.alive[pid]) return { ok: false, error: "NOT_ALIVE" }
  const check = validateTarget(room, pid, targetId)
  if (!check.ok) return check
  const game = room.game
  const role = game.roles[pid]

  if (kind === "kill") {
    if (role !== "umbral") return { ok: false, error: "WRONG_ROLE" }
    if (game.roles[targetId] === "umbral") return { ok: false, error: "BAD_TARGET" }
    game.wolfVotes[pid] = targetId
    return { ok: true }
  }
  if (kind === "inspect") {
    if (role !== "seer") return { ok: false, error: "WRONG_ROLE" }
    game.seerTarget = targetId
    game.seerKnowledge[targetId] = game.roles[targetId]
    return { ok: true }
  }
  if (kind === "protect") {
    if (role !== "guardian") return { ok: false, error: "WRONG_ROLE" }
    if (targetId === game.lastProtected) return { ok: false, error: "SAME_AS_LAST_NIGHT" }
    game.guardTarget = targetId
    return { ok: true }
  }
  return { ok: false, error: "BAD_REQUEST" }
}

export function dayVote(room: Room, pid: string, targetId: string): { ok: true } | { ok: false; error: string } {
  if (room.phase !== "day" || !room.game) return { ok: false, error: "BAD_PHASE" }
  const me = room.players.get(pid)
  if (!me || !room.game.alive[pid]) return { ok: false, error: "NOT_ALIVE" }
  const check = validateTarget(room, pid, targetId)
  if (!check.ok) return check
  room.game.dayVotes[pid] = targetId
  return { ok: true }
}

/* ---------- bot brains ---------- */

function botNightAct(room: Room, botId: string) {
  const game = room.game!
  const role = game.roles[botId]
  const living = livingIds(room)
  if (role === "umbral") {
    const prey = living.filter((id) => game.roles[id] !== "umbral")
    if (prey.length && !game.wolfVotes[botId]) game.wolfVotes[botId] = pick(prey)
  } else if (role === "seer") {
    const unknown = living.filter((id) => id !== botId && game.seerKnowledge[id] === undefined)
    const target = unknown.length ? pick(unknown) : living.find((id) => id !== botId)
    if (target) {
      game.seerTarget = target
      game.seerKnowledge[target] = game.roles[target]
    }
  } else if (role === "guardian") {
    const options = living.filter((id) => id !== botId && id !== game.lastProtected)
    if (options.length) {
      game.guardTarget = pick(options)
      game.lastProtected = game.guardTarget
    }
  }
}

function botDayVote(room: Room, botId: string) {
  const game = room.game!
  const living = livingIds(room).filter((id) => id !== botId)
  if (!living.length || game.dayVotes[botId]) return
  const role = game.roles[botId]
  if (role === "seer") {
    const knownWolf = living.find((id) => game.seerKnowledge[id] === "umbral")
    if (knownWolf) {
      game.dayVotes[botId] = knownWolf
      return
    }
  }
  if (role === "umbral") {
    const innocents = living.filter((id) => game.roles[id] !== "umbral")
    if (innocents.length) {
      game.dayVotes[botId] = pick(innocents)
      return
    }
  }
  game.dayVotes[botId] = pick(living)
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

export function tickBots(room: Room) {
  const game = room.game
  if (!game) return
  if (room.phase !== "night" && room.phase !== "day") return
  const now = Date.now()
  for (const [bid, at] of Object.entries(game.botActAt)) {
    if (now < at || !game.alive[bid] || !room.players.get(bid)?.isBot) continue
    if (room.phase === "night") botNightAct(room, bid)
    else botDayVote(room, bid)
  }
}

/* ---------- view ---------- */

export interface PlayerView {
  code: string
  phase: Phase
  roundNum: number
  meId: string
  players: Array<{ id: string; name: string; wins: number; alive: boolean; connected: boolean; isBot: boolean }>
  myRole: Role | null
  fellowUmbrels: string[]
  seerKnowledge: Record<string, Role> | null
  needsMyAction: boolean
  votesLocked: number
  votesNeeded: number
  lastNight: { victim: string | null; victimName: string | null; savedBy: string | null; savedByName: string | null } | null
  lastBanished: { playerId: string; name: string; role: Role } | null
  ghost: boolean
  revealedRoles: Record<string, Role> | null
  winner: "dawn" | "umbra" | null
  setup: { umbrals: number; seer: boolean; guardian: boolean }
}

export function buildView(room: Room, pid: string): PlayerView {
  const now = Date.now()
  const players = room.joinOrder
    .map((id) => room.players.get(id))
    .filter((p): p is Player => !!p)
    .map((p) => ({
      id: p.id,
      name: p.name,
      wins: p.wins,
      alive: room.game ? !!room.game.alive[p.id] : true,
      connected: p.isBot || now - p.lastSeen < CONNECTED_MS,
      isBot: !!p.isBot,
    }))
  const game = room.game

  const view: PlayerView = {
    code: room.code,
    phase: room.phase,
    roundNum: game?.roundNum ?? 0,
    meId: pid,
    players,
    myRole: null,
    fellowUmbrels: [],
    seerKnowledge: null,
    needsMyAction: false,
    votesLocked: 0,
    votesNeeded: 0,
    lastNight: null,
    lastBanished: null,
    ghost: false,
    revealedRoles: null,
    winner: null,
    setup: setupFor(players.length),
  }

  if (!game) return view

  view.roundNum = game.roundNum
  view.myRole = game.roles[pid] ?? null
  view.ghost = !game.alive[pid]

  if (view.myRole === "umbral") {
    view.fellowUmbrels = Object.entries(game.roles)
      .filter(([id, role]) => role === "umbral" && id !== pid)
      .map(([id]) => id)
  }
  if (view.myRole === "seer") {
    view.seerKnowledge = { ...game.seerKnowledge }
  }

  const connectedLiving = connectedPlayers(room).filter((p) => game.alive[p.id])

  if (room.phase === "night" && !view.ghost) {
    const role = game.roles[pid]
    view.needsMyAction =
      (role === "umbral" && !game.wolfVotes[pid]) ||
      (role === "seer" && !game.seerTarget) ||
      (role === "guardian" && !game.guardTarget)
  }

  if (room.phase === "day") {
    view.votesLocked = Object.keys(game.dayVotes).length
    view.votesNeeded = connectedLiving.length
    view.needsMyAction = !view.ghost && !game.dayVotes[pid]
  }

  const nameOf = (id: string | null) => (id ? room.players.get(id)?.name ?? null : null)

  if ((room.phase === "dawn" || room.phase === "day" || room.phase === "verdict" || room.phase === "gameover") && game.lastNight) {
    view.lastNight = {
      victim: game.lastNight.victim,
      victimName: nameOf(game.lastNight.victim),
      savedBy: game.lastNight.savedBy,
      savedByName: nameOf(game.lastNight.savedBy),
    }
  }
  if (room.phase === "verdict" || room.phase === "gameover") {
    view.lastBanished = game.lastBanished
      ? { playerId: game.lastBanished.playerId, name: nameOf(game.lastBanished.playerId) ?? "?", role: game.lastBanished.role }
      : null
  }

  // dead players haunt the village and see every role; everyone sees all at gameover
  if (view.ghost || room.phase === "gameover") {
    view.revealedRoles = { ...game.roles }
  }
  if (room.phase === "gameover") {
    view.winner = winnerOf(room)
  }

  return view
}
