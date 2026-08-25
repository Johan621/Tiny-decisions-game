"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { evaluateBadges } from "@/lib/decisions/badges";
import { todayKey } from "@/lib/decisions/generator";
import type { RunSummary } from "@/lib/decisions/run";
import { loadProfile, saveProfile, type Profile } from "@/lib/decisions/storage";
import { getTheme, THEMES } from "@/lib/decisions/themes";
import HomeScreen from "./HomeScreen";
import PlayScreen from "./PlayScreen";
import ResultScreen from "./ResultScreen";
import { BadgesSheet, LeaderboardSheet, ThemesSheet } from "./sheets";
import { AdModal } from "./ui";

type Screen = "home" | "play" | "result";
type SheetKind = "leaderboard" | "themes" | "badges" | null;

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
  const profileRef = useRef<Profile | null>(null);

  useEffect(() => {
    const p = loadProfile();
    profileRef.current = p;
    setProfile(p);
    setSessionThemeId(p.activeTheme);
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
          coins: p.coins + s.coinsEarned,
          streak,
          dailyBest,
          dailyLast,
          runs: [{ s: s.score, d: todayKey(), m: s.mode, c: s.choices }, ...p.runs].slice(0, 30),
        };

        earned = evaluateBadges(
          {
            score: s.score,
            choices: s.choices,
            bestCombo: s.bestCombo,
            fastestMs: s.fastestMs,
            eventsSeen: s.eventsSeen,
            dailyCompleted: s.dailyCompleted,
          },
          np
        );
        if (earned.length > 0) {
          np.badges = [...np.badges, ...earned];
          if (!np.title && earned[0]) np.title = earned[0];
        }
        return np;
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

  const adModalOpen = adOpen || adUnlockTheme !== null;

  if (!profile) {
    return (
      <div className="grid min-h-dvh place-items-center" style={{ background: "#7c2ae8" }}>
        <motion.div
          animate={{ scale: [0.9, 1.05, 0.9], rotate: [0, 6, -6, 0] }}
          transition={{ repeat: Infinity, duration: 1.6 }}
          className="grid h-20 w-20 place-items-center rounded-full bg-white text-4xl shadow-2xl"
        >
          🤔
        </motion.div>
      </div>
    );
  }

  const activeThemeDef =
    screen === "play" ? getTheme(sessionThemeId) : getTheme(profile.activeTheme);

  return (
    <div className="relative min-h-dvh w-full overflow-hidden" style={{ background: activeThemeDef.bg }}>
      <AnimatePresence mode="wait">
        {screen === "home" && (
          <motion.div key="home" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}>
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
          <motion.div key={`play-${runNonce}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <PlayScreen
              mode={runMode}
              theme={activeThemeDef}
              soundOn={profile.sound}
              onFinish={finishRun}
              onQuit={() => setScreen("home")}
            />
          </motion.div>
        )}

        {screen === "result" && lastRun && (
          <motion.div key="result" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <ResultScreen
              run={lastRun}
              newBadgeIds={newBadges}
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
