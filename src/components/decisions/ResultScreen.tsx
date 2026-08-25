"use client";

import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { badgeById } from "@/lib/decisions/badges";
import type { RunSummary } from "@/lib/decisions/run";

export default function ResultScreen({
  run,
  newBadgeIds,
  adAvailable,
  onPlayAgain,
  onHome,
  onWatchAd,
  onLeaderboard,
}: {
  run: RunSummary;
  newBadgeIds: string[];
  adAvailable: boolean;
  onPlayAgain: () => void;
  onHome: () => void;
  onWatchAd: () => void;
  onLeaderboard: () => void;
}) {
  const [shown, setShown] = useState(0);
  const rafRef = useRef(0);

  useEffect(() => {
    const start = performance.now();
    const dur = 900;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      setShown(Math.round(run.score * (1 - Math.pow(1 - p, 3))));
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [run.score]);

  const bonus = Math.round(run.score * 0.3);

  return (
    <div className="flex min-h-dvh flex-col px-5 pb-[max(env(safe-area-inset-bottom),18px)] pt-[max(env(safe-area-inset-top),20px)] text-white">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", damping: 18 }}
        className="mt-6 text-center"
      >
        <p className="text-xs font-bold uppercase tracking-[0.25em] opacity-75">
          {run.mode === "daily"
            ? run.dailyCompleted
              ? "Daily complete!"
              : "Daily attempt"
            : "Run over"}
        </p>
        <p className="mt-2 text-[64px] font-black leading-none tabular-nums drop-shadow-lg">
          {shown.toLocaleString("en-IN")}
        </p>
        <p className="mt-1 text-sm font-bold uppercase tracking-widest opacity-80">points</p>
      </motion.div>

      {/* stats */}
      <div className="mt-7 grid grid-cols-2 gap-2.5">
        <Stat label="Choices" value={`${run.choices}`} />
        <Stat label="Best streak" value={`🔥 ×${run.bestCombo}`} />
        <Stat
          label="Fastest tap"
          value={run.fastestMs !== null ? `${(run.fastestMs / 1000).toFixed(2)}s` : "—"}
        />
        <Stat label="Coins earned" value={`🪙 +${run.coinsEarned}`} />
      </div>

      {/* daily note */}
      {run.mode === "daily" && (
        <div className="mt-4 rounded-2xl border border-white/25 bg-white/12 px-4 py-3 text-center text-sm font-bold backdrop-blur-md">
          {run.dailyCompleted
            ? "✅ Challenge logged — come back tomorrow to grow your streak!"
            : "⏱️ Time beat you. Try again tomorrow… or now."}
        </div>
      )}

      {/* new badges */}
      {newBadgeIds.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-yellow-200/40 bg-yellow-300/15 px-4 py-3">
          <span className="text-xs font-black uppercase tracking-widest text-yellow-200">
            Unlocked
          </span>
          {newBadgeIds.map((id) => {
            const b = badgeById(id);
            if (!b) return null;
            return (
              <span
                key={id}
                className="rounded-full bg-white/20 px-3 py-1 text-xs font-extrabold backdrop-blur-sm"
              >
                {b.emoji} {b.name}
              </span>
            );
          })}
        </div>
      )}

      {/* rewarded ad offer */}
      {adAvailable && bonus > 0 && (
        <motion.button
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
          onClick={onWatchAd}
          className="mt-4 w-full rounded-2xl border border-emerald-200/50 bg-emerald-400/25 px-4 py-4 text-left backdrop-blur-md active:scale-[0.98] transition"
        >
          <p className="text-sm font-black">
            🎬 Watch a tiny ad → <span className="text-emerald-200">+{bonus.toLocaleString("en-IN")} pts</span>
          </p>
          <p className="text-xs font-semibold opacity-70">Simulated rewarded ad · no pay-to-win</p>
        </motion.button>
      )}

      {/* actions */}
      <div className="mt-auto space-y-3 pt-6">
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={onPlayAgain}
          className="w-full rounded-[24px] bg-white py-4 text-xl font-black shadow-xl"
          style={{ color: "#7c2ae8" }}
        >
          ↻ PLAY AGAIN
        </motion.button>
        <div className="grid grid-cols-2 gap-3">
          <GhostBtn onClick={onHome}>🏠 Home</GhostBtn>
          <GhostBtn onClick={onLeaderboard}>🏆 Ranks</GhostBtn>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/25 bg-white/12 px-3 py-3 text-center backdrop-blur-md">
      <p className="text-[10px] font-bold uppercase tracking-widest opacity-70">{label}</p>
      <p className="mt-0.5 text-lg font-black tabular-nums">{value}</p>
    </div>
  );
}

function GhostBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-2xl border border-white/30 bg-white/15 py-3.5 text-base font-extrabold backdrop-blur-md active:scale-[0.98] transition"
    >
      {children}
    </button>
  );
}
