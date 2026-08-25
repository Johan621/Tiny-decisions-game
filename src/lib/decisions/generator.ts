import { ABSURD_EXTRA, CATEGORY_LABELS, OPTIONS, type CategoryId } from "./content";

export interface Question {
  key: string;
  category: CategoryId | "absurd";
  a: string;
  b: string;
}

export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let t = seed >>> 0;
  return function () {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: Rng, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)] as T;
}

export function dailySeed(date = new Date()): number {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  return y * 10000 + m * 100 + d;
}

export function todayKey(date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

const ALL_POOLS: Record<CategoryId, string[]> = { ...OPTIONS };

/** Total distinct pair combinations available to the generator. */
export function combinationCount(): number {
  let within = 0;
  for (const cat of CATEGORY_LABELS) {
    const n = ALL_POOLS[cat].length + (cat === "funny" ? ABSURD_EXTRA.length : 0);
    within += (n * (n - 1)) / 2;
  }
  const total =
    CATEGORY_LABELS.reduce((s, c) => s + ALL_POOLS[c].length, 0) +
    ABSURD_EXTRA.length;
  const across = (total * (total - 1)) / 2;
  return within + across;
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`;
}

function randomPairFrom(rng: Rng, pool: readonly string[]): [string, string] {
  const i = Math.floor(rng() * pool.length);
  let j = Math.floor(rng() * pool.length);
  while (j === i) j = Math.floor(rng() * pool.length);
  return [pool[i]!, pool[j]!];
}

/**
 * Generates the next question. ~72% same-category pairs for coherent dilemmas,
 * the rest cross-category chaos. Avoids repeating anything in `recent`.
 */
export function nextQuestion(
  rng: Rng,
  recent: Set<string>
): Question {
  for (let attempt = 0; attempt < 24; attempt++) {
    let cat: CategoryId | "absurd";
    let a: string;
    let b: string;

    if (rng() < 0.16) {
      // Absurd mode: one slot comes from the absurd extras
      cat = "absurd";
      const baseCat = pick(rng, CATEGORY_LABELS);
      if (rng() < 0.5) {
        a = pick(rng, ABSURD_EXTRA);
        b = pick(rng, ALL_POOLS[baseCat]);
      } else {
        a = pick(rng, ALL_POOLS[baseCat]);
        b = pick(rng, ABSURD_EXTRA);
      }
    } else {
      cat = pick(rng, CATEGORY_LABELS);
      if (cat === "funny" && rng() < 0.25) {
        // fold absurd extras into the funny mix
        const mixed = [...ALL_POOLS.funny, ...ABSURD_EXTRA];
        [a, b] = randomPairFrom(rng, mixed);
      } else {
        [a, b] = randomPairFrom(rng, ALL_POOLS[cat]);
      }
    }

    const key = pairKey(a, b);
    if (!recent.has(key)) {
      recent.add(key);
      return { key, category: cat, a, b };
    }
  }
  // Extremely unlikely fallback: force a fresh pair
  const cat = pick(rng, CATEGORY_LABELS);
  const pool = [...ALL_POOLS[cat], ...ABSURD_EXTRA];
  const shuffled = [...pool].sort(() => rng() - 0.5);
  const a = shuffled[0]!;
  const b = shuffled[1]!;
  const key = pairKey(a, b);
  recent.add(key);
  return { key, category: "absurd", a, b };
}

/** Keeps only the newest `keep` keys to bound memory during long sessions. */
export function trimRecent(recent: Set<string>, keep = 150): void {
  if (recent.size <= keep * 2) return;
  const arr = Array.from(recent);
  const tail = arr.slice(-keep);
  recent.clear();
  tail.forEach((k) => recent.add(k));
}

/** Pre-generate a fixed-length run of questions (used by Daily Challenge). */
export function questionRun(seed: number, length: number): Question[] {
  const rng = mulberry32(seed);
  const recent = new Set<string>();
  const out: Question[] = [];
  for (let i = 0; i < length; i++) {
    const q = nextQuestion(rng, recent);
    out.push(q);
    trimRecent(recent, 150);
  }
  return out;
}
