import { DEFAULT_THEMES } from "./themes";

export interface RunHistoryItem {
  s: number; // score
  d: string; // date key
  m: "endless" | "daily";
  c: number; // choices
}

export interface Profile {
  v: 1;
  name: string;
  coins: number;
  best: number;
  games: number;
  totalChoices: number;
  bestCombo: number;
  fastestMs: number | null;
  dailyBest: number;
  dailyLast: string | null;
  streak: number;
  themes: string[];
  activeTheme: string;
  title: string | null;
  badges: string[];
  runs: RunHistoryItem[];
  sound: boolean;
}

const KEY = "etd.profile.v1";

export function defaultProfile(): Profile {
  return {
    v: 1,
    name: "Player",
    coins: 40,
    best: 0,
    games: 0,
    totalChoices: 0,
    bestCombo: 0,
    fastestMs: null,
    dailyBest: 0,
    dailyLast: null,
    streak: 0,
    themes: [...DEFAULT_THEMES],
    activeTheme: DEFAULT_THEMES[0] ?? "sunset",
    title: null,
    badges: [],
    runs: [],
    sound: true,
  };
}

export function loadProfile(): Profile {
  if (typeof window === "undefined") return defaultProfile();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return defaultProfile();
    const parsed = JSON.parse(raw) as Partial<Profile>;
    const base = defaultProfile();
    return {
      ...base,
      ...parsed,
      themes:
        Array.isArray(parsed.themes) && parsed.themes.length
          ? Array.from(new Set([...base.themes, ...parsed.themes]))
          : base.themes,
      badges: Array.isArray(parsed.badges) ? parsed.badges : [],
      runs: Array.isArray(parsed.runs) ? parsed.runs.slice(0, 30) : [],
      activeTheme:
        parsed.activeTheme &&
        (parsed.themes ?? base.themes).includes(parsed.activeTheme)
          ? parsed.activeTheme
          : base.activeTheme,
    };
  } catch {
    return defaultProfile();
  }
}

export function saveProfile(p: Profile): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // storage full / private mode — game still playable in-memory
  }
}
