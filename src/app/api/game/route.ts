import { NextResponse } from "next/server"
import { buildView, getRoom, tickBots } from "@/lib/game/store"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get("code") ?? ""
  const pid = searchParams.get("pid") ?? ""

  const room = getRoom(code)
  if (!room) {
    return NextResponse.json({ ok: false, error: "ROOM_NOT_FOUND" }, { status: 404 })
  }
  if (!pid || !room.players.has(pid)) {
    // room exists but caller is not seated — enough info to offer rejoin
    return NextResponse.json(
      { ok: false, error: "PLAYER_NOT_FOUND", playerCount: room.players.size },
      { status: 404 }
    )
  }
  room.players.get(pid)!.lastSeen = Date.now()
  tickBots(room)
  return NextResponse.json({ ok: true, view: buildView(room, pid) })
}
