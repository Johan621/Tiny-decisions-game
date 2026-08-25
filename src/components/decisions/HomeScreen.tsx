"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { badgeById } from "@/lib/decisions/badges";
import { combinationCount } from "@/lib/decisions/generator";
import { levelFromXp } from "@/lib/decisions/run";
import type { Profile } from "@/lib/decisions/storage";

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
  onOpenSheet: (s: "leaderboard" | "themes" | "badges" | "rewards") => void;
  onToggleSound: () => void;
  onRename: (name: string) => void;
}) {
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(profile.name);
  const title = profile.title ? badgeById(profile.title)?.title : null;
  const dailyDone = profile.dailyLast === todayKeyStr();
  const lvl = levelFromXp(profile.xp);
  const rewardReady = profile.loginLast !== todayKeyStr();
  const comboCount = combinationCount();

  return (
    <div className="flex min-h-dvh flex-col px-5 pb-[max(env(safe-area-inset-bottom),18px)] pt-[max(env(safe-area-inset-top),16px)] text-white">
      {/* top bar */}
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => {
            setNameDraft(profile.name);
            setEditingName(true);
          }}
          className="min-w-0 flex-1 rounded-2xl bg-white/15 px-4 py-2 text-left active:scale-[0.98] transition"
        >
          <p className="truncate text-sm font-extrabold leading-tight">
            {profile.name} <span className="opacity-60">✏️</span>
          </p>
          {title && (
            <p className="truncate text-[11px] font-semibold uppercase tracking-wider opacity-80">
              {title}
            </p>
          )}
        </button>
        <button
          onClick={onToggleSound}
          aria-label="Toggle sound"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/15 text-lg active:scale-90 transition"
        >
          {profile.sound ? "🔊" : "🔇"}
        </button>
        {rewardReady && (
          <motion.button
            animate={{ scale: [1, 1.12, 1] }}
            transition={{ repeat: Infinity, duration: 1.4 }}
            onClick={() => onOpenSheet("rewards")}
            aria-label="Claim daily reward"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-yellow-300 text-lg shadow-lg"
          >
            🎁
          </motion.button>
        )}
      </div>

      {/* logo */}
      <div className="mt-6 select-none">
        <Logo />
        <h1 className="mt-4 text-[32px] font-black uppercase leading-none tracking-tight drop-shadow">
          Endless
          <br />
          Tiny Decisions
        </h1>
        <p className="mt-2 text-sm font-medium opacity-85">
          Two options. Five seconds. Zero wrong answers.
        </p>
      </div>

      {/* level bar */}
      <div className="mt-4 rounded-2xl border border-white/25 bg-white/12 px-4 py-2.5">
        <div className="flex items-baseline justify-between text-xs font-extrabold uppercase tracking-widest opacity-85">
          <span>Level {lvl.lvl}</span>
          <span className="tabular-nums">
            {lvl.into}/{lvl.need} XP
          </span>
        </div>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-black/25">
          <div
            className="h-full rounded-full bg-yellow-300 transition-[width] duration-500"
            style={{ width: `${Math.min(100, (lvl.into / lvl.need) * 100)}%` }}
          />
        </div>
      </div>

      {/* stats */}
      <div className="mt-3 grid grid-cols-3 gap-2.5">
        <StatCard label="Best" value={fmt(profile.best)} />
        <StatCard label="Coins" value={`🪙 ${profile.coins}`} />
        <StatCard label="Streak" value={`🔥 ${profile.streak}d`} />
      </div>

      {/* actions */}
      <div className="mt-auto space-y-3 pt-6">
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={onPlay}
          className="w-full rounded-[26px] bg-white py-5 text-center text-2xl font-black tracking-tight shadow-xl"
          style={{ color: "#7c2ae8" }}
        >
          ▶ PLAY ENDLESS
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={onDaily}
          className="flex w-full items-center justify-between rounded-[22px] border border-white/30 bg-white/15 px-5 py-4 active:scale-[0.98] transition"
        >
          <span className="text-left">
            <span className="block text-base font-extrabold">📅 Daily Challenge</span>
            <span className="block text-xs font-semibold opacity-75">
              {dailyDone ? `Done today · best ${fmt(profile.dailyBest)}` : "20 fixed picks · one shot"}
            </span>
          </span>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-violet-700">
            {dailyDone ? "✓" : "GO"}
          </span>
        </motion.button>

        <div className="grid grid-cols-4 gap-2">
          <NavChip emoji="🏆" label="Ranks" onClick={() => onOpenSheet("leaderboard")} />
          <NavChip emoji="🎨" label="Themes" onClick={() => onOpenSheet("themes")} />
          <NavChip emoji="🏅" label="Badges" onClick={() => onOpenSheet("badges")} />
          <NavChip emoji="🎁" label="Gifts" dot={rewardReady} onClick={() => onOpenSheet("rewards")} />
        </div>

        <p className="pt-1 text-center text-[11px] font-semibold uppercase tracking-widest opacity-60">
          {comboCount.toLocaleString("en-IN")} dilemmas · no repeats · offline ready
        </p>
      </div>

      {/* rename dialog */}
      {editingName && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 px-6">
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            className="w-full max-w-xs rounded-3xl bg-slate-900 p-5 text-white shadow-2xl"
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
                className="flex-1 rounded-2xl bg-violet-600 py-3 font-bold active:scale-[0.98]"
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

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/25 bg-white/12 px-3 py-2.5 text-center">
      <p className="text-[10px] font-bold uppercase tracking-widest opacity-70">{label}</p>
      <p className="mt-0.5 truncate text-base font-black tabular-nums">{value}</p>
    </div>
  );
}

function NavChip({
  emoji,
  label,
  dot,
  onClick,
}: {
  emoji: string;
  label: string;
  dot?: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className="relative rounded-2xl border border-white/25 bg-white/12 py-3 active:bg-white/20 transition"
    >
      <span className="block text-xl">{emoji}</span>
      <span className="mt-0.5 block text-[11px] font-extrabold">{label}</span>
      {dot && (
        <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-yellow-300 shadow" />
      )}
    </motion.button>
  );
}

function Logo() {
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden>
      <circle cx="32" cy="32" r="30" fill="#fff" />
      <path d="M32 2a30 30 0 0 1 0 60z" fill="#7c2ae8" />
      <circle cx="24" cy="32" r="9" fill="#ff5f6d" />
      <rect x="38" y="23" width="18" height="18" rx="5" fill="#36d1dc" />
    </svg>
  );
}
