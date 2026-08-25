"use client";

import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { BADGES, badgeById } from "@/lib/decisions/badges";
import { combinationCount, todayKey, yesterdayKey } from "@/lib/decisions/generator";
import { levelFromXp, LOGIN_REWARDS, nextLoginRewardPos, RARITIES } from "@/lib/decisions/run";
import type { Profile } from "@/lib/decisions/storage";
import { THEMES, type ThemeDef } from "@/lib/decisions/themes";
import { Sheet } from "./ui";

type SheetKind = "leaderboard" | "themes" | "badges";

interface LeaderEntry {
  name: string;
  title: string | null;
  score: number;
  mode: string;
}

export function LeaderboardSheet({
  open,
  onClose,
  profile,
}: {
  open: boolean;
  onClose: () => void;
  profile: Profile;
}) {
  const [tab, setTab] = useState<"global" | "local">("global");
  const [entries, setEntries] = useState<LeaderEntry[] | null>(null);
  const [rank, setRank] = useState<number | null>(null);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if (!open) return;
    setEntries(null);
    setRank(null);
    setOffline(false);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    fetch("/api/leaderboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: profile.name,
        title: profile.title,
        score: profile.best,
        mode: "endless",
      }),
      signal: ctrl.signal,
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          setEntries(d.entries as LeaderEntry[]);
          setRank(d.rank ?? null);
        } else setOffline(true);
      })
      .catch(() => setOffline(true))
      .finally(() => clearTimeout(timer));
    return () => {
      ctrl.abort();
      clearTimeout(timer);
    };
  }, [open, profile.best, profile.name, profile.title]);

  const local = useMemo(
    () =>
      [...profile.runs]
        .sort((a, b) => b.s - a.s)
        .slice(0, 10),
    [profile.runs]
  );

  return (
    <Sheet open={open} onClose={onClose} title="🏆 Leaderboard">
      <div className="mb-4 grid grid-cols-2 gap-1 rounded-2xl bg-white/10 p-1">
        {(["global", "local"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-xl py-2 text-sm font-extrabold capitalize transition ${
              tab === t ? "bg-white text-slate-900" : "text-white/70"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "global" ? (
        offline || entries === null ? (
          <div className="py-10 text-center text-sm font-semibold opacity-70">
            {entries === null && !offline ? "Loading ranks…" : "📡 Offline — showing local scores"}
          </div>
        ) : (
          <>
            <p className="mb-3 rounded-xl bg-emerald-400/15 px-3 py-2 text-center text-xs font-extrabold text-emerald-300">
              Your best rank right now: #{rank ?? "?"}
            </p>
            <ol className="space-y-1.5 pb-2">
              {entries!.map((e, i) => (
                <li
                  key={`${e.name}-${i}`}
                  className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 ${
                    e.name.toLowerCase() === profile.name.toLowerCase()
                      ? "bg-violet-500/35 ring-1 ring-violet-300/50"
                      : i % 2 === 0
                        ? "bg-white/6"
                        : ""
                  }`}
                >
                  <span className="w-8 text-center text-sm font-black tabular-nums">
                    {medal(i)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-extrabold">{e.name}</span>
                    {e.title && (
                      <span className="block truncate text-[11px] font-semibold opacity-60">
                        {e.title} · {e.mode}
                      </span>
                    )}
                  </span>
                  <span className="text-base font-black tabular-nums">
                    {e.score.toLocaleString("en-IN")}
                  </span>
                </li>
              ))}
            </ol>
          </>
        )
      ) : local.length === 0 ? (
        <p className="py-10 text-center text-sm font-semibold opacity-70">
          Play a run to fill your history!
        </p>
      ) : (
        <ol className="space-y-1.5 pb-2">
          {local.map((r, i) => (
            <li key={i} className={`flex items-center justify-between rounded-2xl px-3 py-2.5 ${i % 2 === 0 ? "bg-white/6" : ""}`}>
              <span className="flex items-center gap-3">
                <span className="w-6 text-sm font-black tabular-nums">{medal(i)}</span>
                <span className="text-xs font-bold uppercase tracking-wider opacity-70">
                  {r.m} · {r.d}
                </span>
              </span>
              <span className="text-base font-black tabular-nums">
                {r.s.toLocaleString("en-IN")}
              </span>
            </li>
          ))}
        </ol>
      )}
    </Sheet>
  );
}

function medal(i: number): string {
  return i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`;
}

export function DailyRewardsSheet({
  open,
  onClose,
  profile,
  onClaim,
}: {
  open: boolean;
  onClose: () => void;
  profile: Profile;
  onClaim: (coins: number) => void;
}) {
  const pos = nextLoginRewardPos(
    profile.loginLast,
    profile.loginStreak,
    todayKey(),
    yesterdayKey()
  );
  const claimed = pos === -1;
  const dayNum = claimed ? ((profile.loginStreak - 1) % LOGIN_REWARDS.length) + 1 : pos + 1;

  return (
    <Sheet open={open} onClose={onClose} title="🎁 Daily Rewards">
      <p className="mb-4 text-xs font-semibold opacity-60">
        Log in and claim daily. Miss a day and the ladder resets — day 7 pays the most!
      </p>
      <div className="grid grid-cols-4 gap-2">
        {LOGIN_REWARDS.map((reward, i) => {
          const done = i + 1 < dayNum || (claimed && i + 1 === dayNum);
          const isToday = i + 1 === dayNum;
          return (
            <div
              key={i}
              className={`rounded-2xl border px-2 py-3 text-center transition ${
                isToday
                  ? "border-yellow-300 bg-yellow-300/20 shadow-lg"
                  : done
                    ? "border-emerald-300/40 bg-emerald-400/10"
                    : "border-white/15 bg-white/5"
              }`}
            >
              <p className="text-[10px] font-black uppercase tracking-wider opacity-70">
                Day {i + 1}
              </p>
              <p className="mt-1 text-base font-black tabular-nums">{done ? "✓" : `🪙${reward}`}</p>
            </div>
          );
        })}
        <div className="grid place-items-center rounded-2xl border border-white/10 bg-white/5 px-2 py-3 text-center opacity-60">
          <span className="text-[10px] font-bold uppercase leading-tight">then loops ↻</span>
        </div>
      </div>

      <button
        disabled={claimed}
        onClick={() => onClaim(LOGIN_REWARDS[pos]!)}
        className={`mt-5 w-full rounded-2xl py-4 text-lg font-black transition active:scale-[0.98] ${
          claimed
            ? "bg-white/10 text-white/50"
            : "bg-yellow-300 text-yellow-950 shadow-xl"
        }`}
      >
        {claimed ? "Come back tomorrow ✓" : `Claim Day ${dayNum} · 🪙 ${LOGIN_REWARDS[pos]}`}
      </button>
      <p className="mt-3 pb-2 text-center text-xs font-semibold opacity-55">
        Login streak: 🔥 {profile.loginStreak} day{profile.loginStreak === 1 ? "" : "s"}
      </p>
    </Sheet>
  );
}

export function StatsSheet({
  open,
  onClose,
  profile,
}: {
  open: boolean;
  onClose: () => void;
  profile: Profile;
}) {
  const lvl = levelFromXp(profile.xp);
  const total = combinationCount();
  const explored = Math.min(100, (profile.totalChoices / total) * 100);
  const rc = profile.rarityCounts;
  const avg =
    profile.runs.length > 0
      ? Math.round(profile.runs.reduce((s, r) => s + r.s, 0) / profile.runs.length)
      : 0;

  return (
    <Sheet open={open} onClose={onClose} title="📊 Statistics">
      <Section title="Progression">
        <Cell label="Level" value={`${lvl.lvl}`} />
        <Cell label="Total XP" value={`⭐ ${profile.xp.toLocaleString("en-IN")}`} />
        <Cell label="Coins" value={`🪙 ${profile.coins}`} />
        <Cell label="Games" value={`${profile.games}`} />
      </Section>

      <Section title="Records">
        <Cell label="Best score" value={profile.best.toLocaleString("en-IN")} />
        <Cell label="Daily best" value={profile.dailyBest.toLocaleString("en-IN")} />
        <Cell label="Best combo" value={`🔥 ×${profile.bestCombo}`} />
        <Cell
          label="Fastest tap"
          value={profile.fastestMs !== null ? `${(profile.fastestMs / 1000).toFixed(2)}s` : "—"}
        />
      </Section>

      <Section title="Lifetime">
        <Cell label="Choices made" value={profile.totalChoices.toLocaleString("en-IN")} />
        <Cell label="Events triggered" value={`🎁 ${profile.eventsTotal}`} />
        <Cell label="Dailies done" value={`📅 ${profile.dailyCompletions}`} />
        <Cell label="Login streak" value={`🔥 ${profile.loginStreak}d`} />
      </Section>

      <Section title="Rarity sightings">
        {(["common", "rare", "epic", "legendary"] as const).map((r) => (
          <Cell key={r} label={`${RARITIES[r].emoji} ${RARITIES[r].label}`} value={`${rc[r]}`} color={RARITIES[r].color} />
        ))}
      </Section>

      <div className="mt-4 rounded-2xl border border-white/15 bg-white/5 p-4">
        <p className="text-xs font-bold uppercase tracking-widest opacity-70">Dilemma explorer</p>
        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-black/30">
          <div className="h-full rounded-full bg-violet-400" style={{ width: `${Math.max(1, explored)}%` }} />
        </div>
        <p className="mt-2 text-xs font-semibold opacity-65">
          You have faced{" "}
          <b>{profile.totalChoices.toLocaleString("en-IN")}</b> of{" "}
          <b>{total.toLocaleString("en-IN")}</b> possible dilemmas ({explored.toFixed(explored < 1 && explored > 0 ? 2 : 1)}%)
        </p>
      </div>

      <div className="mt-3 mb-2 rounded-2xl border border-white/15 bg-white/5 p-4 text-xs font-semibold opacity-75">
        Recent average score: <b className="text-white">{avg.toLocaleString("en-IN")}</b> · Runs recorded:{" "}
        <b className="text-white">{profile.runs.length}</b>
      </div>
    </Sheet>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <p className="mb-2 text-[11px] font-black uppercase tracking-[0.18em] opacity-55">{title}</p>
      <div className="grid grid-cols-2 gap-2">{children}</div>
    </div>
  );
}

function Cell({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-2xl border border-white/12 bg-white/6 px-3 py-2.5">
      <p className="truncate text-[10px] font-bold uppercase tracking-widest opacity-60">{label}</p>
      <p className="mt-0.5 truncate text-base font-black tabular-nums" style={{ color }}>
        {value}
      </p>
    </div>
  );
}

export function ThemesSheet({
  open,
  onClose,
  profile,
  onActivate,
  onBuyCoins,
  onUnlockAd,
}: {
  open: boolean;
  onClose: () => void;
  profile: Profile;
  onActivate: (id: string) => void;
  onBuyCoins: (themeId: string, cost: number) => void;
  onUnlockAd: (themeId: string) => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} title={`🎨 Themes · 🪙 ${profile.coins}`}>
      <p className="mb-4 text-xs font-semibold opacity-60">
        Cosmetic only. Earn coins by playing — never pay to win.
      </p>
      <div className="grid grid-cols-2 gap-3 pb-2">
        {THEMES.map((t) => (
          <ThemeCard
            key={t.id}
            theme={t}
            owned={profile.themes.includes(t.id)}
            active={profile.activeTheme === t.id}
            coins={profile.coins}
            onActivate={() => onActivate(t.id)}
            onBuy={() => onBuyCoins(t.id, t.cost)}
            onAd={() => onUnlockAd(t.id)}
          />
        ))}
      </div>
    </Sheet>
  );
}

function ThemeCard({
  theme,
  owned,
  active,
  coins,
  onActivate,
  onBuy,
  onAd,
}: {
  theme: ThemeDef;
  owned: boolean;
  active: boolean;
  coins: number;
  onActivate: () => void;
  onBuy: () => void;
  onAd: () => void;
}) {
  return (
    <motion.div
      whileTap={{ scale: 0.97 }}
      className={`overflow-hidden rounded-3xl border bg-white/5 ${
        active ? "border-emerald-300/70 ring-2 ring-emerald-300/40" : "border-white/15"
      }`}
    >
      {/* mini scene preview */}
      <div className="relative h-28 w-full overflow-hidden" style={{ background: theme.bg }}>
        <div
          className="absolute left-3 right-10 top-3 rounded-lg px-2 py-1.5"
          style={{ background: theme.card, border: "1px solid rgba(255,255,255,0.25)" }}
        >
          <div className="mx-auto mb-1 h-0.5 w-8 rounded-full" style={{ background: theme.sub }} />
          <div className="mx-auto h-1 w-4/5 rounded-full" style={{ background: theme.text, opacity: 0.55 }} />
        </div>
        <div className="absolute bottom-2.5 left-3 right-3 flex gap-1.5">
          <div
            className="h-5 flex-1 rounded-md shadow"
            style={{ background: `linear-gradient(135deg, ${theme.btnFrom}, ${theme.btnTo})` }}
          />
          <div
            className="h-5 flex-1 rounded-md"
            style={{ background: theme.cardSolid, border: `1.5px solid ${theme.accent}` }}
          />
        </div>
        <div
          className="absolute bottom-[26px] left-6 right-6 h-1 overflow-hidden rounded-full"
          style={{ background: theme.card }}
        >
          <div className="h-full w-2/3 rounded-full" style={{ background: theme.timer }} />
        </div>
        {active && (
          <span className="absolute right-2 top-2 rounded-full bg-emerald-400 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-emerald-950">
            Active
          </span>
        )}
      </div>
      <div className="p-3">
        <p className="truncate text-sm font-extrabold text-white">
          {theme.premium && "👑 "} {theme.name}
        </p>
        {owned ? (
          <button
            disabled={active}
            onClick={onActivate}
            className={`mt-2 w-full rounded-xl py-2 text-xs font-black transition ${
              active
                ? "bg-emerald-400/30 text-emerald-200"
                : "bg-white text-slate-900 active:scale-[0.97]"
            }`}
          >
            {active ? "✓ Active" : "Use theme"}
          </button>
        ) : (
          <div className="mt-2 space-y-1.5">
            <button
              disabled={coins < theme.cost}
              onClick={onBuy}
              className="w-full rounded-xl bg-yellow-400 py-2 text-xs font-black text-yellow-950 disabled:opacity-40 active:scale-[0.97] transition"
            >
              🪙 {theme.cost}
            </button>
            <button
              onClick={onAd}
              className="w-full rounded-xl bg-white/15 py-2 text-xs font-bold text-white active:scale-[0.97] transition"
            >
              🎬 Watch ad
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export function BadgesSheet({
  open,
  onClose,
  profile,
  onSelectTitle,
}: {
  open: boolean;
  onClose: () => void;
  profile: Profile;
  onSelectTitle: (badgeId: string | null) => void;
}) {
  const owned = new Set(profile.badges);
  return (
    <Sheet open={open} onClose={onClose} title="🏅 Badges & Titles">
      <p className="mb-4 text-xs font-semibold opacity-60">
        Tap an earned badge to wear its title. Current:{" "}
        <b>{profile.title ? badgeById(profile.title)?.title ?? "None" : "None"}</b>
      </p>
      <div className="space-y-2 pb-2">
        {BADGES.map((b) => {
          const has = owned.has(b.id);
          const isTitle = b.title !== b.name;
          return (
            <button
              key={b.id}
              onClick={() => has && isTitle && onSelectTitle(profile.title === b.id ? null : b.id)}
              className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition ${
                has ? "bg-white/12 active:scale-[0.98]" : "bg-white/5"
              } ${profile.title === b.id ? "ring-2 ring-violet-300/60" : ""}`}
            >
              <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-2xl ${has ? "bg-white/15" : "grayscale opacity-40"}`}>
                {has ? b.emoji : "🔒"}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-extrabold text-white">{b.name}</span>
                <span className="block text-xs font-semibold opacity-65">{b.desc}</span>
              </span>
              {has && isTitle && (
                <span className="shrink-0 rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-white/80">
                  {profile.title === b.id ? "Worn" : "Wear"}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}
