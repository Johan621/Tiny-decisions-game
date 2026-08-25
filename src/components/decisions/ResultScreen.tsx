"use client";

import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { badgeById } from "@/lib/decisions/badges";
import type { RunSummary } from "@/lib/decisions/run";
import { Burst, Floaters, GlassCard, GradientButton } from "./kit";

export default function ResultScreen({
  run,
  newBadgeIds,
  xpGain,
  levelsGained,
  newLevel,
  streakBonus,
  isNewBest,
  adAvailable,
  onPlayAgain,
  onHome,
  onWatchAd,
  onLeaderboard,
}: {
  run: RunSummary;
  newBadgeIds: string[];
  xpGain: number;
  levelsGained: number;
  newLevel: number;
  streakBonus: number;
  isNewBest: boolean;
  adAvailable: boolean;
  onPlayAgain: () => void;
  onHome: () => void;
  onWatchAd: () => void;
  onLeaderboard: () => void;
}) {
  const [shown, setShown] = useState(0);
  const [burstKey, setBurstKey] = useState<number | null>(
    isNewBest || levelsGained > 0 ? Date.now() : null
  );
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
    <div className="relative flex min-h-dvh flex-col overflow-hidden px-5 pb-[max(env(safe-area-inset-bottom),16px)] pt-[max(env(safe-area-inset-top),18px)] text-white">
      <Floaters count={6} />
      {burstKey != null && (
        <Burst key={burstKey} x={50} y={22} count={22} spread={150} onDone={() => setBurstKey(null)} />
      )}

      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", damping: 18 }}
        className="relative z-10 mt-3 text-center"
      >
        <p className="text-xs font-black uppercase tracking-[0.28em] opacity-75">
          {run.mode === "daily"
            ? run.dailyCompleted
              ? "Daily complete!"
              : "Daily attempt"
            : "Run over"}
        </p>
        {isNewBest && run.score > 0 && (
          <motion.div
            initial={{ scale: 0, rotate: -8 }}
            animate={{ scale: 1, rotate: [-2, 2, -1, 0] }}
            transition={{ delay: 0.35, type: "spring", damping: 12 }}
            className="mx-auto mt-2 w-fit rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-4 py-1 text-[11px] font-black uppercase tracking-widest text-white shadow-lg shadow-orange-500/40"
          >
            ✨ New personal best!
          </motion.div>
        )}
        <p className="text-outline mt-1 bg-gradient-to-b from-white via-yellow-100 to-yellow-300 bg-clip-text text-[64px] font-black leading-none tabular-nums text-transparent">
          {shown.toLocaleString("en-IN")}
        </p>
        <p className="-mt-1 text-[10px] font-black uppercase tracking-[0.32em] opacity-70">
          points
        </p>
      </motion.div>

      {/* level up */}
      {levelsGained > 0 && (
        <motion.div
          initial={{ scale: 0.6, rotate: -5, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ delay: 0.55, type: "spring", damping: 12 }}
          className="relative z-10 mx-auto mt-3 rounded-2xl bg-gradient-to-r from-yellow-300 to-amber-500 px-6 py-2 text-center shadow-xl shadow-amber-500/40"
        >
          <p className="text-base font-black text-yellow-950">🎉 LEVEL UP · Lv {newLevel}</p>
          {levelsGained > 1 && (
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-yellow-800">
              +{levelsGained} levels at once!
            </p>
          )}
        </motion.div>
      )}

      {/* stats */}
      <StaggerWrap className="relative z-10 mt-4 grid grid-cols-2 gap-2">
        <Stat icon="🎯" label="Choices" value={`${run.choices}`} />
        <Stat icon="🔥" label="Best streak" value={`×${run.bestCombo}`} />
        <Stat
          icon="⚡"
          label="Fastest tap"
          value={run.fastestMs !== null ? `${(run.fastestMs / 1000).toFixed(2)}s` : "—"}
        />
        <Stat icon="⭐" label="XP earned" value={`+${xpGain}`} />
        <Stat icon="🪙" label="Coins earned" value={`+${run.coinsEarned + streakBonus}`} color="#ffe066" />
        {run.legendaries > 0 ? (
          <Stat icon="🟡" label="Legendaries" value={`×${run.legendaries}`} color="#ffd54f" />
        ) : (
          <Stat icon="🗓️" label="Streak bonus" value={streakBonus > 0 ? `+${streakBonus}` : "—"} />
        )}
      </StaggerWrap>

      {/* daily note */}
      {run.mode === "daily" && (
        <div className="glass relative z-10 mt-3 rounded-2xl border border-white/25 px-4 py-2.5 text-center text-sm font-bold">
          {run.dailyCompleted
            ? "✅ Logged — come back tomorrow to grow your streak!"
            : "⏱️ Time beat you. Tomorrow is a fresh shot."}
        </div>
      )}

      {/* achievements */}
      {newBadgeIds.length > 0 && (
        <div className="relative z-10 mt-3 flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-yellow-200/50 bg-gradient-to-r from-yellow-400/25 via-amber-300/15 to-transparent px-4 py-2.5">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-yellow-200">
            Unlocked
          </span>
          {newBadgeIds.map((id) => {
            const b = badgeById(id);
            if (!b) return null;
            return (
              <span key={id} className="rounded-full bg-white/20 px-3 py-1 text-xs font-extrabold">
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
          className="glass relative z-10 mt-3 w-full rounded-2xl border border-emerald-200/60 px-4 py-3.5 text-left active:scale-[0.98] transition"
        >
          <p className="text-sm font-black">
            🎬 Watch a tiny ad →{" "}
            <span className="text-emerald-200">+{bonus.toLocaleString("en-IN")} pts</span>
          </p>
          <p className="text-xs font-semibold opacity-70">Simulated rewarded ad · no pay-to-win</p>
        </motion.button>
      )}

      {/* actions */}
      <div className="relative z-10 mt-auto space-y-2.5 pt-5">
        <GradientButton
          onClick={() => {
            setBurstKey(Date.now());
            window.setTimeout(onPlayAgain, 140);
          }}
        >
          <span className="text-xl leading-none">↻</span>
          <span className="text-lg font-black uppercase tracking-wide">Play Again</span>
        </GradientButton>
        <div className="grid grid-cols-2 gap-2.5">
          <GlassBtn onClick={onHome}>🏠 Home</GlassBtn>
          <GlassBtn onClick={onLeaderboard}>🏆 Ranks</GlassBtn>
        </div>
      </div>
    </div>
  );
}

function StaggerWrap({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05, delayChildren: 0.15 } } }}
    >
      {children}
    </motion.div>
  );
}

const statVariants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, damping: 22, stiffness: 260 } },
};

function GlassBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="glass rounded-2xl border border-white/25 py-3.5 text-base font-extrabold active:scale-[0.98] transition"
    >
      {children}
    </button>
  );
}

function Stat({
  icon,
  label,
  value,
  color,
}: {
  icon: string;
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <motion.div variants={statVariants}>
      <GlassCard className="flex items-center gap-2.5 rounded-2xl px-3 py-2.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/15 text-lg">
          {icon}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[9px] font-bold uppercase tracking-widest opacity-65">
            {label}
          </span>
          <span
            className="block truncate text-base font-black tabular-nums leading-tight"
            style={{ color }}
          >
            {value}
          </span>
        </span>
      </GlassCard>
    </motion.div>
  );
}
