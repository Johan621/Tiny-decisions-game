import type { Rarity, Rng } from "./generator";

export interface RunSummary {
  mode: "endless" | "daily";
  score: number;
  choices: number;
  bestCombo: number;
  fastestMs: number | null;
  eventsSeen: number;
  coinsEarned: number;
  dailyCompleted: boolean;
  legendaries: number;
  rarityTally: Record<"common" | "rare" | "epic" | "legendary", number>;
}

export interface RarityMeta {
  id: Rarity;
  label: string;
  emoji: string;
  mult: number;
  color: string;
}

export const RARITIES: Record<Rarity, RarityMeta> = {
  common: { id: "common", label: "Common", emoji: "⚪", mult: 1, color: "#dcdce6" },
  rare: { id: "rare", label: "Rare", emoji: "🔵", mult: 1.5, color: "#57b0ff" },
  epic: { id: "epic", label: "Epic", emoji: "🟣", mult: 2, color: "#c46bff" },
  legendary: { id: "legendary", label: "Legendary", emoji: "🟡", mult: 3, color: "#ffd54f" },
};

export type EventId = "double" | "freeze" | "shield" | "rain" | "mirror";

export const EVENTS: Record<EventId, { name: string; emoji: string; blurb: string }> = {
  double: { name: "Double Trouble", emoji: "✨", blurb: "×2 points for 5 answers!" },
  freeze: { name: "Time Freeze", emoji: "❄️", blurb: "Next question: +60% time!" },
  shield: { name: "Combo Shield", emoji: "🛡️", blurb: "Your combo survives one slow tap!" },
  rain: { name: "Coin Rain", emoji: "🪙", blurb: "+20 coins, instantly!" },
  mirror: { name: "Mirror Mode", emoji: "🌀", blurb: "Sides shuffle for 5 rounds!" },
};

const EVENT_IDS = Object.keys(EVENTS) as EventId[];

export function pickEvent(rng: Rng, exclude: EventId | null): EventId {
  const pool = EVENT_IDS.filter((e) => e !== exclude);
  return pool[Math.floor(rng() * pool.length)]!;
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/** Timer shrinks as the run goes: 5.0s → 2.3s floor. */
export function timeLimitMs(choices: number): number {
  return clamp(5000 - choices * 55, 2300, 5000);
}

export function multiplierFor(combo: number): number {
  return Math.min(8, 1 + Math.floor(combo / 4));
}

export function pointsFor(
  frac: number,
  mult: number,
  eventMult: number,
  rarityMult: number
): number {
  return Math.max(1, Math.round((10 + 15 * clamp(frac, 0, 1)) * mult * eventMult * rarityMult));
}

export function coinsFor(score: number): number {
  return Math.floor(score / 120);
}

/* ---------- progression ---------- */

/** XP earned from a finished run. */
export function xpForRun(score: number, choices: number, dailyCompleted: boolean): number {
  return Math.max(10, Math.round(score / 40) + choices) + (dailyCompleted ? 80 : 0);
}

export interface LevelInfo {
  lvl: number;
  into: number; // xp into current level
  need: number; // xp needed for next level
}

const BASE_LEVEL_XP = 150;

export function levelFromXp(xp: number): LevelInfo {
  let lvl = 1;
  let rest = Math.max(0, xp);
  let need = BASE_LEVEL_XP;
  while (rest >= need && lvl < 999) {
    rest -= need;
    lvl += 1;
    need = Math.round(need * 1.15);
  }
  return { lvl, into: rest, need };
}

/** Daily-challenge streak multiplies coin payouts (capped at +10). */
export function streakCoinBonus(streak: number): number {
  return Math.min(10, streak);
}

/** Login-reward ladder, day 1 → 7 (then cycles). */
export const LOGIN_REWARDS = [20, 30, 40, 60, 80, 100, 150] as const;

/**
 * Position in the login ladder for the NEXT claim.
 * Continues the cycle if yesterday was claimed; resets to day 1 otherwise.
 */
export function nextLoginRewardPos(loginLast: string | null, loginStreak: number, today: string, yesterday: string): number {
  if (loginLast === today) return -1; // already claimed today
  if (loginLast === yesterday && loginStreak > 0) return loginStreak % LOGIN_REWARDS.length;
  return 0;
}

/* ---------- tiny feedback helpers (no assets, works offline) ---------- */

let audioCtx: AudioContext | null = null;

type SoundKind = "tap" | "good" | "combo" | "bad" | "event";

export function blip(kind: SoundKind, enabled: boolean): void {
  if (!enabled) return;
  try {
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return;
    if (!audioCtx) audioCtx = new AC();
    if (audioCtx.state === "suspended") void audioCtx.resume();
    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    switch (kind) {
      case "tap":
        osc.frequency.value = 660;
        gain.gain.setValueAtTime(0.06, t);
        break;
      case "good":
        osc.frequency.setValueAtTime(520, t);
        osc.frequency.exponentialRampToValueAtTime(880, t + 0.08);
        gain.gain.setValueAtTime(0.07, t);
        break;
      case "combo":
        osc.type = "triangle";
        osc.frequency.setValueAtTime(700, t);
        osc.frequency.exponentialRampToValueAtTime(1400, t + 0.12);
        gain.gain.setValueAtTime(0.08, t);
        break;
      case "bad":
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(220, t);
        osc.frequency.exponentialRampToValueAtTime(90, t + 0.25);
        gain.gain.setValueAtTime(0.08, t);
        break;
      case "event":
        osc.type = "square";
        osc.frequency.setValueAtTime(500, t);
        osc.frequency.exponentialRampToValueAtTime(1000, t + 0.18);
        gain.gain.setValueAtTime(0.05, t);
        break;
    }
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    osc.start(t);
    osc.stop(t + 0.24);
  } catch {
    // audio unsupported — silent fallback
  }
}

export function buzz(pattern: number | number[], enabled: boolean): void {
  if (!enabled) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // unsupported
  }
}
