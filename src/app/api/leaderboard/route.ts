import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export interface LeaderEntry {
  name: string;
  title: string | null;
  score: number;
  mode: "endless" | "daily";
}

interface StoreState {
  entries: Map<string, LeaderEntry>;
  seeded: boolean;
}

// Module-level in-memory store (per server process).
const g = globalThis as unknown as { __etdLeaderboard?: StoreState };

function state(): StoreState {
  if (!g.__etdLeaderboard) {
    g.__etdLeaderboard = { entries: new Map(), seeded: false };
  }
  return g.__etdLeaderboard;
}

const SEEDS: Array<[string, string, number]> = [
  ["DragonDad", "Chaos Tamer", 18420],
  ["MarsMomi", "Grand Champion", 15980],
  ["SleeplessSam", "Speed Demon", 14210],
  ["ChaiGuzzler", "Combo Artist", 12760],
  ["QuokkaQueen", "Streak Legend", 11345],
  ["BunkMaster", "Marathon Mind", 9980],
  ["NeonNinja", "Theme Hound", 8630],
  ["PickleRickshaw", "Score Machine", 7420],
  ["UfoUsha", "Daily Devotee", 6180],
  ["CoconutKid", "Tiny Tycoon", 5240],
  ["LlamaLLama", "The Decider", 4115],
  ["GhostPepper", "Combo Artist", 3390],
  ["SirSnoresALot", "Marathon Mind", 2760],
  ["TurboChappal", "Quick Draw", 1985],
  ["BananaBandit", "Rookie Decider", 1240],
];

function seed() {
  const s = state();
  if (s.seeded) return;
  for (const [name, title, score] of SEEDS) {
    s.entries.set(name.toLowerCase(), { name, title, score, mode: "endless" });
  }
  s.seeded = true;
}

function sortedTop(limit = 25) {
  seed();
  const s = state();
  return Array.from(s.entries.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export async function GET() {
  try {
    return NextResponse.json({ ok: true, entries: sortedTop(25) });
  } catch {
    return NextResponse.json({ ok: false, entries: [] }, { status: 500 });
  }
}

interface PostBody {
  name?: string;
  title?: string | null;
  score?: number;
  mode?: "endless" | "daily";
}

export async function POST(request: Request) {
  let body: PostBody;
  try {
    body = (await request.json()) as PostBody;
  } catch {
    return NextResponse.json({ ok: false, error: "BAD_REQUEST" }, { status: 400 });
  }

  const name = (body.name ?? "").trim().slice(0, 16) || "Anonymous";
  const rawScore = Math.floor(Number(body.score));
  if (!Number.isFinite(rawScore) || rawScore < 0) {
    return NextResponse.json({ ok: false, error: "BAD_SCORE" }, { status: 400 });
  }
  // Server-side sanity cap keeps the board believable.
  const score = Math.min(rawScore, 250_000);

  const s = state();
  seed();
  const key = `${body.mode === "daily" ? "d" : "e"}:${name.toLowerCase()}`;
  const prev = s.entries.get(key);
  if (!prev || score > prev.score) {
    s.entries.set(key, {
      name,
      title: body.title ?? null,
      score,
      mode: body.mode === "daily" ? "daily" : "endless",
    });
  }

  const top = sortedTop(25);
  const mine = top.findIndex(
    (e) =>
      e.name.toLowerCase() === name.toLowerCase() && e.score <= score
  );
  const rank = mine >= 0 ? mine + 1 : top.length + 1;

  return NextResponse.json({ ok: true, entries: top, rank });
}
