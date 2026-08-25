"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { evaluateBadges } from "@/lib/decisions/badges";
import { todayKey, yesterdayKey } from "@/lib/decisions/generator";
import {
  levelFromXp,
  LOGIN_REWARDS,
  nextLoginRewardPos,
  streakCoinBonus,
  xpForRun,
  type RunSummary,
} from "@/lib/decisions/run";
import { loadProfile, saveProfile, type Profile } from "@/lib/decisions/storage";
import { getTheme, THEMES } from "@/lib/decisions/themes";
import HomeScreen from "./HomeScreen";
import PlayScreen from "./PlayScreen";
import ResultScreen from "./ResultScreen";
import { BadgesSheet, DailyRewardsSheet, LeaderboardSheet, StatsSheet, ThemesSheet } from "./sheets";
import { AdModal } from "./ui";
import { DragonMascot, RobotMascot } from "./kit";

type Screen = "home" | "play" | "result";
type SheetKind = "leaderboard" | "themes" | "badges" | "rewards" | "stats" | null;

function submitScore(p: Profile, score: number, mode: string): void {
  fetch("/api/leaderboard", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: p.name, title: p.title, score, mode }),
  }).catch(() => undefined);
}

export default function GameApp() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [screen, setScreen] = useState<Screen>("home");
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [runMode, setRunMode] = useState<"endless" | "daily">("endless");
  const [lastRun, setLastRun] = useState<RunSummary | null>(null);
  const [newBadges, setNewBadges] = useState<string[]>([]);
  const [sessionThemeId, setSessionThemeId] = useState("sunset");
  const [runNonce, setRunNonce] = useState(0);
  const [adOpen, setAdOpen] = useState(false);
  const [adUnlockTheme, setAdUnlockTheme] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [lastLevel, setLastLevel] = useState({ gained: 0, level: 1, xpGain: 0, streakBonus: 0 });
  const prevBestRef = useRef(0);
  const profileRef = useRef<Profile | null>(null);

  useEffect(() => {
    const p = loadProfile();
    profileRef.current = p;
    setProfile(p);
    setSessionThemeId(p.activeTheme);
    setOffline(!navigator.onLine);

    // Offline mode: cache the app shell so the game boots with zero network
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  const update = useCallback((fn: (p: Profile) => Profile): Profile => {
    const prev = profileRef.current!;
    const next = fn(prev);
    profileRef.current = next;
    setProfile(next);
    saveProfile(next);
    return next;
  }, []);

  const startRun = useCallback(
    (mode: "endless" | "daily") => {
      const p = profileRef.current!;
      const owned = THEMES.filter((t) => p.themes.includes(t.id));
      setSessionThemeId((owned[Math.floor(Math.random() * owned.length)] ?? getTheme(p.activeTheme)).id);
      setRunMode(mode);
      setNewBadges([]);
      setRunNonce((n) => n + 1);
      setScreen("play");
    },
    []
  );

  const finishRun = useCallback(
    (s: RunSummary) => {
      let earned: string[] = [];
      update((p) => {
        prevBestRef.current = p.best;
        let streak = p.streak;
        let dailyBest = p.dailyBest;
        let dailyLast = p.dailyLast;

        if (s.mode === "daily") {
          const tk = todayKey();
          if (dailyLast !== tk) {
            const y = new Date();
            y.setDate(y.getDate() - 1);
            streak = dailyLast === todayKey(y) ? streak + 1 : 1;
            dailyLast = tk;
          }
          dailyBest = Math.max(dailyBest, s.score);
        }

        const xpGain = xpForRun(s.score, s.choices, s.dailyCompleted);
        const sBonus = streakCoinBonus(p.streak);
        const np: Profile = {
          ...p,
          games: p.games + 1,
          totalChoices: p.totalChoices + s.choices,
          bestCombo: Math.max(p.bestCombo, s.bestCombo),
          fastestMs:
            s.fastestMs !== null
              ? p.fastestMs === null
                ? s.fastestMs
                : Math.min(p.fastestMs, s.fastestMs)
              : p.fastestMs,
          best: Math.max(p.best, s.score),
          coins: p.coins + s.coinsEarned + sBonus,
          xp: p.xp + xpGain,
          streak,
          dailyBest,
          dailyLast,
          runs: [{ s: s.score, d: todayKey(), m: s.mode, c: s.choices }, ...p.runs].slice(0, 30),
        };

        setLastLevel({
          gained: levelFromXp(np.xp).lvl - levelFromXp(p.xp).lvl,
          level: levelFromXp(np.xp).lvl,
          xpGain,
          streakBonus: sBonus,
        });

        earned = evaluateBadges(
          {
            score: s.score,
            choices: s.choices,
            bestCombo: s.bestCombo,
            fastestMs: s.fastestMs,
            eventsSeen: s.eventsSeen,
            dailyCompleted: s.dailyCompleted,
            legendaries: s.legendaries,
          },
          np
        );
        if (earned.length > 0) {
          np.badges = [...np.badges, ...earned];
          if (!np.title && earned[0]) np.title = earned[0];
        }
        return {
          ...np,
          rarityCounts: {
            common: np.rarityCounts.common + s.rarityTally.common,
            rare: np.rarityCounts.rare + s.rarityTally.rare,
            epic: np.rarityCounts.epic + s.rarityTally.epic,
            legendary: np.rarityCounts.legendary + s.rarityTally.legendary,
          },
          eventsTotal: np.eventsTotal + s.eventsSeen,
          dailyCompletions: np.dailyCompletions + (s.dailyCompleted ? 1 : 0),
        };
      });

      submitScore(profileRef.current!, s.score, s.mode);

      setNewBadges(earned);
      setLastRun(s);
      window.setTimeout(() => setScreen("result"), 350);
    },
    [update]
  );

  const claimAdBonus = useCallback(() => {
    if (!lastRun) return;
    const bonus = Math.round(lastRun.score * 0.3);
    const boosted = { ...lastRun, score: lastRun.score + bonus };
    setLastRun(boosted);
    update((p) => ({ ...p, coins: p.coins + 15, best: Math.max(p.best, boosted.score) }));
    submitScore(profileRef.current!, boosted.score, boosted.mode);
  }, [lastRun, update]);

  const claimDailyReward = useCallback(
    (coins: number) => {
      update((p) => {
        const tk = todayKey();
        const yk = yesterdayKey();
        // Streak continues if this is the first claim ever or yesterday was claimed
        const continued = p.loginLast === null || p.loginLast === yk;
        return {
          ...p,
          coins: p.coins + coins,
          loginLast: tk,
          loginStreak: continued ? p.loginStreak + 1 : 1,
        };
      });
    },
    [update]
  );

  const adModalOpen = adOpen || adUnlockTheme !== null;

  if (!profile) {
    return (
      <div className="grid min-h-dvh place-items-center" style={{ background: "#7c2ae8" }}>
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-end gap-4">
            <DragonMascot size={92} />
            <RobotMascot size={84} />
          </div>
          <p className="text-lg font-black uppercase tracking-widest text-white drop-shadow">
            Tiny Decisions
          </p>
          <div className="h-2 w-44 overflow-hidden rounded-full bg-white/25">
            <div className="shine relative h-full w-full rounded-full bg-white/40" />
          </div>
        </div>
      </div>
    );
  }

  const activeThemeDef =
    screen === "play" ? getTheme(sessionThemeId) : getTheme(profile.activeTheme);

  return (
    <div className="relative min-h-dvh w-full overflow-hidden" style={{ background: activeThemeDef.bg }}>
      <AnimatePresence mode="wait">
        {screen === "home" && (
          <motion.div
            key="home"
            initial={{ opacity: 0, y: 26, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.99 }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
          >
            <HomeScreen
              profile={profile}
              onPlay={() => startRun("endless")}
              onDaily={() => startRun("daily")}
              onOpenSheet={(s) => setSheet(s)}
              onToggleSound={() => update((p) => ({ ...p, sound: !p.sound }))}
              onRename={(name) => update((p) => ({ ...p, name }))}
            />
          </motion.div>
        )}

        {screen === "play" && (
          <motion.div
            key={`play-${runNonce}`}
            initial={{ opacity: 0, scale: 1.03 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ type: "spring", damping: 26, stiffness: 300 }}
          >
            <PlayScreen
              mode={runMode}
              theme={activeThemeDef}
              soundOn={profile.sound}
              recentInit={profile.recentKeys}
              onRecent={(keys) =>
                update((p) => ({
                  ...p,
                  recentKeys: Array.from(new Set([...p.recentKeys, ...keys])).slice(-500),
                }))
              }
              onFinish={finishRun}
              onQuit={() => setScreen("home")}
            />
          </motion.div>
        )}

        {screen === "result" && lastRun && (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: 26, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.99 }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
          >
            <ResultScreen
              run={lastRun}
              newBadgeIds={newBadges}
              xpGain={lastLevel.xpGain}
              levelsGained={lastLevel.gained}
              newLevel={lastLevel.level}
              streakBonus={lastLevel.streakBonus}
              isNewBest={prevBestRef.current > 0 && lastRun.score > prevBestRef.current}
              adAvailable={profile.games % 2 === 0}
              onWatchAd={() => setAdOpen(true)}
              onPlayAgain={() => startRun(lastRun.mode)}
              onHome={() => setScreen("home")}
              onLeaderboard={() => setSheet("leaderboard")}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <LeaderboardSheet open={sheet === "leaderboard"} onClose={() => setSheet(null)} profile={profile} />
      <DailyRewardsSheet
        open={sheet === "rewards"}
        onClose={() => setSheet(null)}
        profile={profile}
        onClaim={claimDailyReward}
      />
      <ThemesSheet
        open={sheet === "themes"}
        onClose={() => setSheet(null)}
        profile={profile}
        onActivate={(id) => update((p) => ({ ...p, activeTheme: id }))}
        onBuyCoins={(themeId, cost) =>
          update((p) =>
            p.coins >= cost
              ? { ...p, coins: p.coins - cost, themes: [...new Set([...p.themes, themeId])], activeTheme: themeId }
              : p
          )
        }
        onUnlockAd={(themeId) => setAdUnlockTheme(themeId)}
      />
      <BadgesSheet
        open={sheet === "badges"}
        onClose={() => setSheet(null)}
        profile={profile}
        onSelectTitle={(id) => update((p) => ({ ...p, title: id }))}
      />
      <StatsSheet open={sheet === "stats"} onClose={() => setSheet(null)} profile={profile} />

      {/* offline indicator */}
      {offline && (
        <motion.div
          initial={{ y: 70 }}
          animate={{ y: 0 }}
          className="glass fixed bottom-[max(env(safe-area-inset-bottom),10px)] left-1/2 z-40 -translate-x-1/2 rounded-full border border-white/25 px-4 py-2 text-xs font-bold text-white shadow-xl"
        >
          📡 Offline — playing locally, progress saves on device
        </motion.div>
      )}

      <AdModal
        open={adModalOpen}
        onClose={() => {
          setAdOpen(false);
          setAdUnlockTheme(null);
        }}
        onReward={() => {
          if (adUnlockTheme !== null) {
            const t = adUnlockTheme;
            update((p) => ({
              ...p,
              themes: [...new Set([...p.themes, t])],
              activeTheme: t,
            }));
          } else {
            claimAdBonus();
          }
          setAdOpen(false);
          setAdUnlockTheme(null);
        }}
      />
    </div>
  );
}
