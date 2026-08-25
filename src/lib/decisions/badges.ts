import { levelFromXp } from "./run";
import type { Profile } from "./storage";

export interface BadgeDef {
  id: string;
  emoji: string;
  name: string;
  title: string;
  desc: string;
}

export const BADGES: BadgeDef[] = [
  {
    id: "first_pick",
    emoji: "🐣",
    name: "First Pick",
    title: "The Decider",
    desc: "Finish your first run",
  },
  {
    id: "quick_fingers",
    emoji: "⚡",
    name: "Quick Fingers",
    title: "Speed Demon",
    desc: "Answer in under 1 second",
  },
  {
    id: "combo_10",
    emoji: "🔥",
    name: "On Fire",
    title: "Combo Artist",
    desc: "Reach a 10x fast-answer streak",
  },
  {
    id: "combo_20",
    emoji: "🌋",
    name: "Unstoppable",
    title: "Streak Legend",
    desc: "Reach a 20x fast-answer streak",
  },
  {
    id: "century",
    emoji: "💯",
    name: "Century Club",
    title: "Marathon Mind",
    desc: "Make 100 choices in one run",
  },
  {
    id: "score_2500",
    emoji: "🏆",
    name: "High Roller",
    title: "Score Machine",
    desc: "Score 2,500+ in one run",
  },
  {
    id: "score_6000",
    emoji: "👑",
    name: "Decision Royalty",
    title: "Grand Champion",
    desc: "Score 6,000+ in one run",
  },
  {
    id: "event_survivor",
    emoji: "🎁",
    name: "Event Survivor",
    title: "Chaos Tamer",
    desc: "Trigger 3 surprise events in one run",
  },
  {
    id: "daily_done",
    emoji: "📅",
    name: "Daily Devotee",
    title: "Daily Devotee",
    desc: "Complete a Daily Challenge",
  },
  {
    id: "streak_3",
    emoji: "🗓️",
    name: "Habit Forming",
    title: "Streak Keeper",
    desc: "3-day Daily Challenge streak",
  },
  {
    id: "rich",
    emoji: "🪙",
    name: "Coin Collector",
    title: "Tiny Tycoon",
    desc: "Hold 300 coins at once",
  },
  {
    id: "theme_hound",
    emoji: "🎨",
    name: "Style Icon",
    title: "Theme Hound",
    desc: "Own 5 themes",
  },
  {
    id: "level_5",
    emoji: "⭐",
    name: "Rising Star",
    title: "Level Master",
    desc: "Reach level 5",
  },
  {
    id: "level_10",
    emoji: "🌟",
    name: "Veteran Decider",
    title: "Grandmaster",
    desc: "Reach level 10",
  },
  {
    id: "login_7",
    emoji: "🎁",
    name: "Loyal Picker",
    title: "Gift Guardian",
    desc: "7-day login streak",
  },
];

export function badgeById(id: string): BadgeDef | undefined {
  return BADGES.find((b) => b.id === id);
}

export interface RunStatsInput {
  score: number;
  choices: number;
  bestCombo: number;
  fastestMs: number | null;
  eventsSeen: number;
  dailyCompleted: boolean;
}

/** Returns ids of newly earned badges given a finished run + updated profile. */
export function evaluateBadges(run: RunStatsInput, profileAfter: Profile): string[] {
  const owned = new Set(profileAfter.badges);
  const earned: string[] = [];
  const grant = (id: string) => {
    if (!owned.has(id)) {
      owned.add(id);
      earned.push(id);
    }
  };

  grant("first_pick");
  if (run.fastestMs !== null && run.fastestMs < 1000) grant("quick_fingers");
  if (run.bestCombo >= 10) grant("combo_10");
  if (run.bestCombo >= 20) grant("combo_20");
  if (run.choices >= 100) grant("century");
  if (run.score >= 2500) grant("score_2500");
  if (run.score >= 6000) grant("score_6000");
  if (run.eventsSeen >= 3) grant("event_survivor");
  if (run.dailyCompleted) grant("daily_done");
  if (profileAfter.streak >= 3) grant("streak_3");
  if (profileAfter.coins >= 300) grant("rich");
  if (profileAfter.themes.length >= 5) grant("theme_hound");
  if (levelFromXp(profileAfter.xp).lvl >= 5) grant("level_5");
  if (levelFromXp(profileAfter.xp).lvl >= 10) grant("level_10");
  if (profileAfter.loginStreak >= 7) grant("login_7");

  return earned;
}
