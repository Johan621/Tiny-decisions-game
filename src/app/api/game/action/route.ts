import { NextResponse } from "next/server"
import {
  addBot,
  advance,
  buildView,
  createRoom,
  dayVote,
  getRoom,
  joinRoom,
  kickBot,
  nightAction,
  tickBots,
} from "@/lib/game/store"

export const dynamic = "force-dynamic"

interface ActionBody {
  type?: string
  code?: string
  name?: string
  pid?: string
  kind?: "kill" | "inspect" | "protect"
  targetId?: string
}

export async function POST(request: Request) {
  let body: ActionBody
  try {
    body = (await request.json()) as ActionBody
  } catch {
    return NextResponse.json({ ok: false, error: "BAD_REQUEST" }, { status: 400 })
  }

  switch (body.type) {
    case "create": {
      const name = (body.name ?? "").trim().slice(0, 16)
      if (!name) return NextResponse.json({ ok: false, error: "NAME_REQUIRED" }, { status: 400 })
      const { room, playerId } = createRoom(name)
      return NextResponse.json({ ok: true, code: room.code, pid: playerId })
    }
    case "join": {
      const name = (body.name ?? "").trim().slice(0, 16)
      if (!name) return NextResponse.json({ ok: false, error: "NAME_REQUIRED" }, { status: 400 })
      const result = joinRoom(body.code ?? "", name)
      if (!result.ok) {
        const status = result.error === "ROOM_NOT_FOUND" ? 404 : 409
        return NextResponse.json({ ok: false, error: result.error }, { status })
      }
      return NextResponse.json({ ok: true, pid: result.pid })
    }
    case "add-bot":
    case "kick-bot": {
      const room = getRoom(body.code ?? "")
      if (!room) return NextResponse.json({ ok: false, error: "ROOM_NOT_FOUND" }, { status: 404 })
      const result = body.type === "add-bot" ? addBot(room) : kickBot(room, body.pid ?? "")
      if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 409 })
      return NextResponse.json({ ok: true })
    }
    case "night-action":
    case "day-vote":
    case "advance": {
      const room = getRoom(body.code ?? "")
      if (!room) return NextResponse.json({ ok: false, error: "ROOM_NOT_FOUND" }, { status: 404 })
      const pid = body.pid ?? ""
      const me = room.players.get(pid)
      if (!me) return NextResponse.json({ ok: false, error: "PLAYER_NOT_FOUND" }, { status: 404 })
      me.lastSeen = Date.now()
      tickBots(room)

      let result: { ok: true } | { ok: false; error: string }
      if (body.type === "night-action") {
        if (!body.kind || !body.targetId) return NextResponse.json({ ok: false, error: "BAD_REQUEST" }, { status: 400 })
        result = nightAction(room, pid, body.kind, body.targetId)
      } else if (body.type === "day-vote") {
        if (!body.targetId) return NextResponse.json({ ok: false, error: "BAD_REQUEST" }, { status: 400 })
        result = dayVote(room, pid, body.targetId)
      } else {
        result = advance(room)
      }
      if (!result.ok) {
        return NextResponse.json({ ok: false, error: result.error }, { status: 409 })
      }
      return NextResponse.json({ ok: true, view: buildView(room, pid) })
    }
    default:
      return NextResponse.json({ ok: false, error: "BAD_REQUEST" }, { status: 400 })
  }
}
