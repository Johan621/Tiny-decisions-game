"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CATEGORY_META, PROMPTS, REVEAL_QUIPS } from "@/lib/decisions/content";
import {
  dailySeed,
  mulberry32,
  nextQuestion,
  questionRun,
  trimRecent,
  type Question,
  type Rng,
} from "@/lib/decisions/generator";
import {
  blip,
  buzz,
  clamp,
  coinsFor,
  EVENTS,
  multiplierFor,
  pickEvent,
  pointsFor,
  RARITIES,
  timeLimitMs,
  type EventId,
  type RunSummary,
} from "@/lib/decisions/run";
import type { ThemeDef } from "@/lib/decisions/themes";

const DAILY_LENGTH = 20;

interface ActiveEvent {
  double: number; // answers remaining
  mirror: number; // rounds remaining
  shield: boolean;
  freezeNext: boolean;
}

export default function PlayScreen({
  mode,
  theme,
  soundOn,
  recentInit,
  onFinish,
  onRecent,
  onQuit,
}: {
  mode: "endless" | "daily";
  theme: ThemeDef;
  soundOn: boolean;
  recentInit: string[];
  onFinish: (s: RunSummary) => void;
  onRecent: (seenKeys: string[]) => void;
  onQuit: () => void;
}) {
  const rngRef = useRef<Rng>(mulberry32(mode === "daily" ? dailySeed() : (Math.random() * 2 ** 31) | 0));
  const recentRef = useRef<Set<string>>(new Set(recentInit));
  const seenOrderRef = useRef<string[]>([]);
  const queueRef = useRef<Question[]>([]);
  const dailyAllRef = useRef<Question[] | null>(null);
  const dailyIdxRef = useRef(0);

  const [index, setIndex] = useState(0);
  const [question, setQuestion] = useState<Question | null>(null);
  const [phase, setPhase] = useState<"ask" | "reveal">("ask");
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [fastestMs, setFastestMs] = useState<number | null>(null);
  const [eventsSeen, setEventsSeen] = useState(0);
  const [bonusCoins, setBonusCoins] = useState(0);
  const [banner, setBanner] = useState<EventId | null>(null);
  const [revealInfo, setRevealInfo] = useState<{ quip: string; pts: number; side: "a" | "b" } | null>(null);
  const [mirrorSwap, setMirrorSwap] = useState(false);

  const activeRef = useRef<ActiveEvent>({ double: 0, mirror: 0, shield: false, freezeNext: false });
  const lastEventRef = useRef<EventId | null>(null);
  const deadlineRef = useRef(0);
  const durRef = useRef(5000);
  const startRef = useRef(0);
  const finishedRef = useRef(false);
  const statsRef = useRef({
    score: 0,
    bestCombo: 0,
    fastestMs: null as number | null,
    legendaries: 0,
    tally: { common: 0, rare: 0, epic: 0, legendary: 0 },
  });
  const barRef = useRef<HTMLDivElement>(null);

  const prompt = useMemo(() => PROMPTS[index % PROMPTS.length]!, [index]);
  const mult = multiplierFor(combo);

  const refillQueue = useCallback(() => {
    if (mode === "daily") {
      if (!dailyAllRef.current) dailyAllRef.current = questionRun(dailySeed(), DAILY_LENGTH);
      while (
        queueRef.current.length < 3 &&
        dailyIdxRef.current < DAILY_LENGTH
      ) {
        queueRef.current.push(dailyAllRef.current[dailyIdxRef.current++]!);
      }
      return;
    }
    while (queueRef.current.length < 3) {
      queueRef.current.push(nextQuestion(rngRef.current, recentRef.current));
    }
    trimRecent(recentRef.current, 150);
  }, [mode]);

  const beginRound = useCallback(() => {
    refillQueue();
    const q = queueRef.current.shift() ?? nextQuestion(rngRef.current, recentRef.current);
    seenOrderRef.current.push(q.key);
    setQuestion(q);
    setIndex((i) => i + 1);
    setPhase("ask");
    if (barRef.current) {
      barRef.current.style.transform = "scaleX(1)";
      barRef.current.style.background = theme.timer;
    }
    setMirrorSwap(activeRef.current.mirror > 0 ? !mirrorSwap : mirrorSwap);

    let dur = timeLimitMs(index);
    if (activeRef.current.freezeNext) {
      dur = Math.round(dur * 1.6);
      activeRef.current.freezeNext = false;
    }
    durRef.current = dur;
    deadlineRef.current = performance.now() + dur;
    startRef.current = performance.now();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, refillQueue, mirrorSwap, theme.timer]);

  // Kick off first round
  useEffect(() => {
    beginRound();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finishRun = useCallback(
    (dailyCompleted: boolean) => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      blip("bad", soundOn);
      buzz([40, 60, 90], soundOn);
      const s = statsRef.current;
      onRecent(seenOrderRef.current);
      onFinish({
        mode,
        score: s.score,
        choices: index - 1 < 0 ? 0 : mode === "daily" ? Math.min(index - 1, DAILY_LENGTH) : index - 1,
        bestCombo: s.bestCombo,
        fastestMs: s.fastestMs,
        eventsSeen,
        coinsEarned: coinsFor(s.score) + bonusCoins,
        dailyCompleted,
        legendaries: s.legendaries,
        rarityTally: s.tally,
      });
    },
    [eventsSeen, bonusCoins, index, mode, onFinish, onRecent, soundOn]
  );

  const maybeTriggerEvent = useCallback(
    (nextChoices: number): boolean => {
      if (mode === "daily") return false;
      if (nextChoices > 0 && nextChoices % 15 === 0) {
        const ev = pickEvent(rngRef.current, lastEventRef.current);
        lastEventRef.current = ev;
        setBanner(ev);
        blip("event", soundOn);
        setEventsSeen((n) => n + 1);
        const a = activeRef.current;
        switch (ev) {
          case "double":
            a.double = 5;
            break;
          case "freeze":
            a.freezeNext = true;
            break;
          case "shield":
            a.shield = true;
            break;
          case "rain":
            setBonusCoins((c) => c + 20);
            break;
          case "mirror":
            a.mirror = 5;
            break;
        }
        return true;
      }
      return false;
    },
    [mode, soundOn]
  );

  const answer = useCallback(
    (side: "a" | "b") => {
      if (phase !== "ask" || !question) return;
      const elapsed = performance.now() - startRef.current;
      const fracLeft = clamp((deadlineRef.current - performance.now()) / durRef.current, 0, 1);
      const fast = elapsed < durRef.current * 0.55;
      const a = activeRef.current;

      let nextCombo = combo;
      if (fast) nextCombo = combo + 1;
      else if (a.shield) a.shield = false;
      else nextCombo = 0;

      const eventMult = a.double > 0 ? 2 : 1;
      if (a.double > 0) a.double -= 1;
      if (a.mirror > 0) a.mirror -= 1;

      const rarityMeta = RARITIES[question.rarity];
      const pts = pointsFor(fracLeft, multiplierFor(nextCombo), eventMult, rarityMeta.mult);
      const newScore = score + pts;
      const newBest = Math.max(bestCombo, nextCombo);
      const newFast =
        fastestMs === null ? elapsed : Math.min(fastestMs, Math.round(elapsed));
      const newLeg = question.rarity === "legendary" ? statsRef.current.legendaries + 1 : statsRef.current.legendaries;

      statsRef.current = {
        score: newScore,
        bestCombo: newBest,
        fastestMs: newFast,
        legendaries: newLeg,
        tally: {
          ...statsRef.current.tally,
          [question.rarity]: statsRef.current.tally[question.rarity] + 1,
        },
      };
      setScore(newScore);
      setCombo(nextCombo);
      setBestCombo(newBest);
      setFastestMs(newFast);
      if (question.rarity === "legendary") {
        setBonusCoins((c) => c + 5);
        blip("event", soundOn);
      }
      setRevealInfo({
        quip:
          question.rarity === "legendary"
            ? `${rarityMeta.emoji} LEGENDARY! +5 🪙`
            : REVEAL_QUIPS[Math.floor(Math.random() * REVEAL_QUIPS.length)]!,
        pts,
        side,
      });
      setPhase("reveal");

      if (nextCombo > combo && nextCombo % 4 === 0) blip("combo", soundOn);
      else blip("good", soundOn);
      buzz(fast ? 12 : 25, soundOn);

      const nextChoices = index;
      const evTriggered = maybeTriggerEvent(nextChoices);

      // Daily complete?
      if (mode === "daily" && index >= DAILY_LENGTH) {
        window.setTimeout(() => finishRun(true), 650);
        return;
      }

      window.setTimeout(
        () => {
          setBanner(null);
          setRevealInfo(null);
          beginRound();
        },
        evTriggered ? 1250 : 430
      );
    },
    [
      phase, question, combo, score, bestCombo, fastestMs, index,
      beginRound, finishRun, maybeTriggerEvent, mode, soundOn,
    ]
  );

  // rAF timer loop (paused during reveal so events/daily completion resolve first)
  useEffect(() => {
    if (!question || finishedRef.current || phase !== "ask") return;
    let raf = 0;
    const tick = () => {
      const f = clamp((deadlineRef.current - performance.now()) / durRef.current, 0, 1);
      // Direct DOM writes — no React re-render per frame (low-end friendly)
      const el = barRef.current;
      if (el) {
        el.style.transform = `scaleX(${f})`;
        el.style.background = f < 0.35 ? "#ff3d3d" : theme.timer;
      }
      if (f <= 0) {
        setRevealInfo(null);
        finishRun(false);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [question, phase, finishRun, theme.timer]);

  // Keyboard support for desktop testing
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") answer(mirrorSwap ? "b" : "a");
      if (e.key === "ArrowRight") answer(mirrorSwap ? "a" : "b");
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [answer, mirrorSwap]);

  const cat = question ? CATEGORY_META[question.category as keyof typeof CATEGORY_META] : null;
  const leftQ = question ? (mirrorSwap ? question.b : question.a) : "";
  const rightQ = question ? (mirrorSwap ? question.a : question.b) : "";

  return (
    <div className="relative flex h-dvh w-full flex-col overflow-hidden px-4 pt-[max(env(safe-area-inset-top),12px)]">
      {/* HUD */}
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => {
            if (!finishedRef.current) onRecent(seenOrderRef.current);
            onQuit();
          }}
          className="grid h-10 w-10 place-items-center rounded-full text-lg font-bold active:scale-90 transition-transform"
          style={{ background: theme.card, color: theme.text }}
          aria-label="Quit run"
        >
          ✕
        </button>
        <motion.div
          key={score}
          initial={{ scale: 1.18 }}
          animate={{ scale: 1 }}
          className="rounded-full px-4 py-1.5 text-lg font-black tabular-nums"
          style={{ background: theme.card, color: theme.text }}
        >
          {score.toLocaleString("en-IN")}
        </motion.div>
      </div>

      {/* Prompt + category */}
      <div className="mt-3 text-center">
        <AnimatePresence mode="wait">
          {cat && (
            <motion.div
              key={question?.key}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="text-xs font-bold uppercase tracking-[0.18em]"
              style={{ color: theme.sub }}
            >
              {cat.emoji} {cat.label}
              {mode === "daily" ? ` · ${Math.min(index, DAILY_LENGTH)}/${DAILY_LENGTH}` : ` · Q${index}`}
              {question && (
                <>
                  {" · "}
                  <span style={{ color: RARITIES[question.rarity].color }}>
                    {RARITIES[question.rarity].emoji} {RARITIES[question.rarity].label}
                    {question.rarity !== "common" ? ` ×${RARITIES[question.rarity].mult}` : ""}
                  </span>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
        <h1
          className="mt-1 text-2xl font-black tracking-tight"
          style={{ color: theme.text }}
        >
          {prompt}
        </h1>
      </div>

      {/* Combo */}
      <div className="mt-2 flex justify-center">
        <AnimatePresence>
          {combo > 0 && (
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.6, opacity: 0 }}
              className="rounded-full bg-white/85 px-4 py-1 text-sm font-black shadow"
              style={{ color: "#c2410c" }}
            >
              🔥 ×{mult} · {combo} streak
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Timer bar */}
      <div
        className="mx-auto mt-4 w-full max-w-md overflow-hidden rounded-full"
        style={{ background: theme.card, height: 10 }}
      >
        <div
          ref={barRef}
          className="h-full w-full origin-left rounded-full will-change-transform"
          style={{
            transform: "scaleX(1)",
            background: theme.timer,
          }}
        />
      </div>

      {/* Choices */}
      <div className="relative mt-auto mb-[max(env(safe-area-inset-bottom),14px)] grid grid-cols-2 gap-3">
        {[leftQ, rightQ].map((txt, i) => (
          <motion.button
            key={`${question?.key}-${i}`}
            initial={{ opacity: 0, y: 24, rotate: i === 0 ? -1.5 : 1.5 }}
            animate={{ opacity: 1, y: 0, rotate: 0 }}
            whileTap={{ scale: 0.955 }}
            onClick={() => answer(i === 0 ? "a" : "b")}
            disabled={phase !== "ask"}
            className="flex min-h-[34dvh] select-none items-center justify-center rounded-[28px] border p-4 text-center shadow-lg"
            style={{
              background:
                revealInfo?.side === (i === 0 ? "a" : "b")
                  ? theme.accent
                  : theme.cardSolid,
              borderColor:
                question && question.rarity !== "common"
                  ? RARITIES[question.rarity].color
                  : "rgba(255,255,255,0.35)",
              borderWidth: question && question.rarity === "legendary" ? 3 : 1,
              boxShadow:
                question && question.rarity === "legendary"
                  ? `0 0 18px ${RARITIES.legendary.color}66`
                  : undefined,
              color:
                revealInfo?.side === (i === 0 ? "a" : "b") ? theme.accentText : theme.text,
            }}
          >
            <span className="text-balance text-lg font-extrabold leading-snug">{txt}</span>
          </motion.button>
        ))}

        {/* Floating points */}
        <AnimatePresence>
          {revealInfo && (
            <motion.div
              key={question?.key}
              initial={{ opacity: 0, y: 10, scale: 0.8 }}
              animate={{ opacity: 1, y: -30, scale: 1.05 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="pointer-events-none absolute left-1/2 top-[-8px] z-10 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/80 px-4 py-1.5 text-sm font-black text-white shadow-xl"
            >
              {revealInfo.quip} +{revealInfo.pts}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Surprise event banner */}
      <AnimatePresence>
        {banner && (
          <motion.div
            initial={{ y: -80, opacity: 0, rotate: -3 }}
            animate={{ y: 0, opacity: 1, rotate: 0 }}
            exit={{ y: -80, opacity: 0 }}
            className="pointer-events-none absolute left-1/2 top-[22%] z-20 -translate-x-1/2 rounded-3xl bg-black/85 px-6 py-4 text-center shadow-2xl"
          >
            <p className="text-3xl">{EVENTS[banner].emoji}</p>
            <p className="text-base font-black text-yellow-300">{EVENTS[banner].name}</p>
            <p className="text-xs font-semibold text-white/80">{EVENTS[banner].blurb}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
