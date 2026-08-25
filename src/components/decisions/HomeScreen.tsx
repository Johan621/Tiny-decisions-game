"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { badgeById } from "@/lib/decisions/badges";
import { combinationCount } from "@/lib/decisions/generator";
import { levelFromXp } from "@/lib/decisions/run";
import type { Profile } from "@/lib/decisions/storage";
import {
  Burst,
  Chip,
  DragonMascot,
  Floaters,
  GlassCard,
  GradientButton,
  RobotMascot,
  SpeechBubble,
  Stagger,
  StaggerItem,
} from "./kit";

export default function HomeScreen({
  profile,
  onPlay,
  onDaily,
  onOpenSheet,
  onToggleSound,
  onRename,
}: {
  profile: Profile;
  onPlay: () => void;
  onDaily: () => void;
  onOpenSheet: (s: "leaderboard" | "themes" | "badges" | "rewards" | "stats") => void;
  onToggleSound: () => void;
  onRename: (name: string) => void;
}) {
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(profile.name);
  const [burst, setBurst] = useState<number | null>(null);

  const title = profile.title ? badgeById(profile.title)?.title : null;
  const dailyDone = profile.dailyLast === todayKeyStr();
  const lvl = levelFromXp(profile.xp);
  const rewardReady = profile.loginLast !== todayKeyStr();
  const comboCount = combinationCount();
  const recentBadges = profile.badges.slice(-3);
  const xpPct = Math.min(100, (lvl.into / lvl.need) * 100);

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden px-4 pb-[max(env(safe-area-inset-bottom),14px)] pt-[max(env(safe-area-inset-top),12px)] text-white">
      <Floaters count={8} />

      {/* top bar */}
      <Stagger className="relative z-10 flex items-center gap-2">
        <StaggerItem className="min-w-0 flex-1">
          <button
            onClick={() => {
              setNameDraft(profile.name);
              setEditingName(true);
            }}
            className="glass w-full rounded-2xl border border-white/25 px-3.5 py-2 text-left active:scale-[0.98] transition"
          >
            <div className="flex items-center gap-2">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gradient-to-br from-fuchsia-400 to-violet-600 text-sm shadow">
                {profile.name.slice(0, 1).toUpperCase()}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-extrabold leading-tight">
                  {profile.name}
                  {title && <span className="ml-1.5 text-[10px] font-bold uppercase tracking-wide text-yellow-200">{title}</span>}
                </span>
                {recentBadges.length > 0 && (
                  <span className="block truncate text-[10px] font-semibold opacity-75">
                    {recentBadges.map((id) => badgeById(id)?.emoji ?? "").join(" ")}
                    {profile.badges.length > 3 && ` +${profile.badges.length - 3}`}
                  </span>
                )}
              </span>
            </div>
          </button>
        </StaggerItem>
        <StaggerItem className="flex shrink-0 gap-2">
          <IconBtn label={profile.sound ? "🔊" : "🔇"} onClick={onToggleSound} />
          <IconBtn
            label="🎁"
            dot={rewardReady}
            pulse={rewardReady}
            onClick={() => onOpenSheet("rewards")}
          />
        </StaggerItem>
      </Stagger>

      {/* hero stage */}
      <Stagger className="relative z-10 mt-3" delay={0.05}>
        <StaggerItem>
          <GlassCard className="relative px-4 pb-3 pt-3">
            <div className="shine pointer-events-none absolute inset-0 overflow-hidden rounded-3xl" />
            <Floaters count={5} />
            <div className="relative z-10 mx-auto -mt-1 mb-1 w-fit max-w-[240px]">
              <SpeechBubble />
            </div>
            <div className="relative z-10 flex items-end justify-between gap-1">
              <DragonMascot size={86} />
              <div className="min-w-0 flex-1 text-center">
                <h1 className="text-outline text-[30px] font-black uppercase leading-[0.95] tracking-tight">
                  <span className="block bg-gradient-to-b from-white via-yellow-100 to-yellow-300 bg-clip-text text-transparent">
                    Endless
                  </span>
                  <span className="block bg-gradient-to-r from-fuchsia-300 via-pink-200 to-cyan-200 bg-clip-text text-transparent">
                    Tiny Decisions
                  </span>
                </h1>
                <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.14em] opacity-80">
                  Two options · Five seconds
                </p>
              </div>
              <RobotMascot size={78} />
            </div>
          </GlassCard>
        </StaggerItem>

        {/* level strip */}
        <StaggerItem className="mt-2.5">
          <GlassCard className="flex items-center gap-3 rounded-2xl px-3.5 py-2">
            <motion.span
              animate={{ rotate: [0, 14, -8, 0], scale: [1, 1.18, 1] }}
              transition={{ repeat: Infinity, duration: 2.8 }}
              className="text-xl"
            >
              ⭐
            </motion.span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between text-[10px] font-black uppercase tracking-[0.16em]">
                <span>Level {lvl.lvl}</span>
                <span className="tabular-nums opacity-70">
                  {lvl.into}/{lvl.need} XP
                </span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-black/25">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${xpPct}%` }}
                  transition={{ duration: 0.7, ease: "easeOut", delay: 0.25 }}
                  className="h-full rounded-full bg-gradient-to-r from-yellow-300 to-amber-500"
                />
              </div>
            </div>
          </GlassCard>
        </StaggerItem>

        {/* stats */}
        <StaggerItem className="mt-2.5 grid grid-cols-3 gap-2">
          <StatPill icon="🏆" value={fmt(profile.best)} label="Best" />
          <StatPill icon="🪙" value={fmt(profile.coins)} label="Coins" />
          <StatPill icon="🔥" value={`${profile.streak}d`} label="Streak" />
        </StaggerItem>

        {/* play */}
        <StaggerItem className="mt-3">
          <GradientButton
            className="btn-pulse"
            onClick={() => {
              setBurst(Date.now());
              window.setTimeout(onPlay, 160);
            }}
            burstKey={burst}
            onBurstDone={() => setBurst(null)}
            from="#d946ef"
            via="#7c2ae8"
            to="#4f46e5"
          >
            <span className="text-2xl leading-none">▶</span>
            <span className="text-xl font-black uppercase tracking-wide">Play Endless</span>
          </GradientButton>
        </StaggerItem>

        {/* daily */}
        <StaggerItem className="mt-2.5">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={onDaily}
            className="glass relative w-full overflow-hidden rounded-2xl border border-white/25 px-4 py-3 text-left active:border-white/50 transition"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-sky-400 to-blue-600 text-lg shadow">
                📅
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-extrabold">Daily Challenge</span>
                <span className="block text-[11px] font-semibold opacity-75">
                  {dailyDone
                    ? `Done today · best ${fmt(profile.dailyBest)}`
                    : "20 fixed picks · one shot"}
                </span>
              </span>
              <span
                className={`rounded-full px-3 py-1 text-xs font-black ${
                  dailyDone ? "bg-white/15 text-white/60" : "bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow"
                }`}
              >
                {dailyDone ? "✓" : "GO"}
              </span>
            </div>
          </motion.button>
        </StaggerItem>

        {/* nav */}
        <StaggerItem className="mt-2.5 grid grid-cols-5 gap-1.5">
          <Chip onClick={() => onOpenSheet("leaderboard")}>
            <NavFace emoji="🏆" label="Ranks" />
          </Chip>
          <Chip onClick={() => onOpenSheet("themes")}>
            <NavFace emoji="🎨" label="Themes" />
          </Chip>
          <Chip onClick={() => onOpenSheet("badges")}>
            <NavFace emoji="🏅" label="Badges" />
          </Chip>
          <Chip onClick={() => onOpenSheet("stats")}>
            <NavFace emoji="📊" label="Stats" />
          </Chip>
          <Chip dot={rewardReady} onClick={() => onOpenSheet("rewards")}>
            <NavFace emoji="🎁" label="Gifts" />
          </Chip>
        </StaggerItem>

        <StaggerItem className="mt-2 pb-1 text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] opacity-55">
            {comboCount.toLocaleString("en-IN")} dilemmas · offline ready
          </p>
        </StaggerItem>
      </Stagger>

      {/* rename dialog */}
      {editingName && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/65 px-6">
          <motion.div
            initial={{ scale: 0.88, y: 24 }}
            animate={{ scale: 1, y: 0 }}
            transition={{ type: "spring", damping: 24 }}
            className="w-full max-w-xs rounded-3xl bg-slate-900 p-5 text-white shadow-2xl ring-1 ring-white/15"
          >
            <p className="text-lg font-black">Your name</p>
            <input
              value={nameDraft}
              maxLength={14}
              onChange={(e) => setNameDraft(e.target.value)}
              className="mt-3 w-full rounded-2xl border border-white/15 bg-white/10 px-4 py-3 font-bold outline-none placeholder:text-white/40 focus:border-violet-400"
              placeholder="Player"
            />
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setEditingName(false)}
                className="flex-1 rounded-2xl bg-white/10 py-3 font-bold active:scale-[0.98]"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onRename(nameDraft.trim().slice(0, 14) || "Player");
                  setEditingName(false);
                }}
                className="flex-1 rounded-2xl bg-gradient-to-r from-fuchsia-500 to-violet-600 py-3 font-bold shadow-lg active:scale-[0.98]"
              >
                Save
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

function todayKeyStr(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function fmt(n: number): string {
  return n.toLocaleString("en-IN");
}

function IconBtn({
  label,
  onClick,
  dot = false,
  pulse = false,
}: {
  label: string;
  onClick: () => void;
  dot?: boolean;
  pulse?: boolean;
}) {
  return (
    <motion.button
      animate={pulse ? { scale: [1, 1.12, 1] } : undefined}
      transition={pulse ? { repeat: Infinity, duration: 1.4 } : undefined}
      whileTap={{ scale: 0.88 }}
      onClick={onClick}
      aria-label={label}
      className={`glass relative grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-white/25 text-lg ${
        pulse ? "bg-yellow-300/90" : ""
      }`}
    >
      {label}
      {dot && !pulse && (
        <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-yellow-300 shadow" />
      )}
    </motion.button>
  );
}

function StatPill({ icon, value, label }: { icon: string; value: string; label: string }) {
  return (
    <div className="glass flex items-center gap-2 rounded-2xl border border-white/20 px-2.5 py-2">
      <span className="text-lg leading-none">{icon}</span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-black tabular-nums leading-tight">{value}</span>
        <span className="block text-[9px] font-bold uppercase tracking-widest opacity-65">{label}</span>
      </span>
    </div>
  );
}

function NavFace({ emoji, label }: { emoji: string; label: string }) {
  return (
    <>
      <span className="block text-xl">{emoji}</span>
      <span className="mt-0.5 block text-[10px] font-extrabold">{label}</span>
    </>
  );
}
