"use client";

import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";

/* ---------- glass & cards ---------- */

export function GlassCard({
  children,
  className = "",
  style,
  strong = false,
}: {
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  strong?: boolean;
}) {
  return (
    <div
      className={`rounded-3xl border border-white/20 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.45)] ${
        strong ? "glass-strong" : "glass"
      } ${className}`}
      style={style}
    >
      {children}
    </div>
  );
}

/* ---------- buttons ---------- */

export function GradientButton({
  children,
  onClick,
  from = "#a855f7",
  via = "#7c2ae8",
  to = "#4f46e5",
  glow = "rgba(124,42,232,0.65)",
  className = "",
  burstKey,
  onBurstDone,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  from?: string;
  via?: string;
  to?: string;
  glow?: string;
  className?: string;
  burstKey?: number | null;
  onBurstDone?: () => void;
}) {
  return (
    <div className={`relative ${className}`}>
      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={onClick}
        className="relative w-full overflow-hidden rounded-[22px] px-6 py-4 text-white btn-glossy"
        style={{
          background: `linear-gradient(135deg, ${from} 0%, ${via} 55%, ${to} 100%)`,
          boxShadow: `0 10px 26px -10px ${glow}, inset 0 -3px 0 rgba(0,0,0,0.18)`,
        }}
      >
        <span className="pointer-events-none absolute inset-x-0 top-0 h-1/2 rounded-t-[22px] bg-white/25" />
        <span className="relative z-10 flex items-center justify-center gap-2">{children}</span>
      </motion.button>
      {burstKey != null && (
        <Burst key={burstKey} onDone={onBurstDone} colors={["#fff", "#ffe066", "#ff9de2"]} />
      )}
    </div>
  );
}

export function Chip({
  children,
  onClick,
  active = false,
  dot = false,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
  dot?: boolean;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.93 }}
      onClick={onClick}
      className={`relative rounded-2xl border py-2.5 transition-colors ${
        active ? "border-white/70 bg-white/30" : "border-white/20 bg-white/12"
      }`}
    >
      {children}
      {dot && (
        <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-yellow-300 shadow-[0_0_6px_rgba(253,224,71,0.9)]" />
      )}
    </motion.button>
  );
}

/* ---------- particles ---------- */

const BURST_COLORS = ["#ffd54f", "#ff6b9d", "#7cd4ff", "#b49aff", "#8affc1"];

/** One-shot radial particle burst (transform/opacity only). */
export function Burst({
  x = 50,
  y = 50,
  count = 14,
  colors = BURST_COLORS,
  spread = 90,
  onDone,
}: {
  x?: number; // percent
  y?: number;
  count?: number;
  colors?: string[];
  spread?: number;
  onDone?: () => void;
}) {
  const parts = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const ang = (i / count) * Math.PI * 2 + Math.random() * 0.8;
        const dist = spread * (0.5 + Math.random() * 0.7);
        return {
          dx: Math.cos(ang) * dist,
          dy: Math.sin(ang) * dist,
          s: 3 + Math.random() * 5,
          c: colors[i % colors.length]!,
          d: 0.45 + Math.random() * 0.35,
        };
      }),
    [count, colors, spread]
  );
  return (
    <div
      className="pointer-events-none absolute z-30"
      style={{ left: `${x}%`, top: `${y}%` }}
      aria-hidden
    >
      {parts.map((p, i) => (
        <motion.span
          key={i}
          className="absolute rounded-full will-change-transform"
          style={{ width: p.s, height: p.s, background: p.c }}
          initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
          animate={{ x: p.dx, y: p.dy, opacity: 0, scale: 0.35 }}
          transition={{ duration: p.d, ease: "easeOut" }}
          onAnimationEnd={i === 0 ? onDone : undefined}
        />
      ))}
    </div>
  );
}

/** Slow ambient floaters — cheap CSS-driven ambience for backgrounds. */
export function Floaters({ count = 7 }: { count?: number }) {
  const items = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        left: (i * 37 + 13) % 100,
        top: (i * 53 + 29) % 100,
        size: 10 + ((i * 17) % 26),
        dur: 7 + ((i * 13) % 8),
        delay: (i * 0.7) % 5,
        round: i % 3 === 0,
      })),
    [count]
  );
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {items.map((f, i) => (
        <motion.span
          key={i}
          className={`absolute ${f.round ? "rounded-full bg-white/15" : "rounded-lg bg-white/10 rotate-12"}`}
          style={{ left: `${f.left}%`, top: `${f.top}%`, width: f.size, height: f.size }}
          animate={{ y: [0, -22, 0], opacity: [0.35, 0.75, 0.35], rotate: f.round ? 0 : [0, 18, 0] }}
          transition={{ repeat: Infinity, duration: f.dur, delay: f.delay, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

/* ---------- mascots ---------- */

const MASCOT_LINES = [
  "Pick one for me!",
  "So many choices!",
  "Legend hunt? 👀",
  "Tap tap tap!",
  "Be bold!",
  "Trust your gut!",
  "I'm rooting for you!",
];

function useMascotLine(intervalMs = 3600): string {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setIdx((i) => (i + 1) % MASCOT_LINES.length), intervalMs);
    return () => clearInterval(iv);
  }, [intervalMs]);
  return MASCOT_LINES[idx]!;
}

export function SpeechBubble({ text }: { text?: string }) {
  const line = useMascotLine();
  return (
    <motion.div
      key={text ?? line}
      initial={{ opacity: 0, y: 6, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className="glass-strong relative rounded-2xl border border-white/30 px-3 py-1.5 text-center text-xs font-extrabold text-slate-800 shadow-lg"
    >
      {text ?? line}
      <span className="absolute -bottom-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-b border-r border-white/40 bg-white/85" />
    </motion.div>
  );
}

export function DragonMascot({ size = 84 }: { size?: number }) {
  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      animate={{ y: [0, -5, 0], rotate: [-3, 2, -3] }}
      transition={{ repeat: Infinity, duration: 2.6, ease: "easeInOut" }}
      style={{ filter: "drop-shadow(0 6px 10px rgba(0,0,0,0.28))" }}
      aria-hidden
    >
      {/* wings */}
      <path d="M12 34 Q2 24 8 16 Q16 20 18 30 Z" fill="#34d399" opacity="0.9" />
      <path d="M52 34 Q62 24 56 16 Q48 20 46 30 Z" fill="#34d399" opacity="0.9" />
      {/* horns */}
      <path d="M22 14 L19 5 L28 11 Z" fill="#fbbf24" />
      <path d="M42 14 L45 5 L36 11 Z" fill="#fbbf24" />
      {/* body */}
      <ellipse cx="32" cy="38" rx="20" ry="18" fill="#6ee7a0" />
      <ellipse cx="32" cy="44" rx="12" ry="10" fill="#eafff3" />
      {/* eyes */}
      <circle cx="25" cy="32" r="5.5" fill="#fff" />
      <circle cx="39" cy="32" r="5.5" fill="#fff" />
      <circle cx="26.5" cy="33" r="2.6" fill="#173" />
      <circle cx="37.5" cy="33" r="2.6" fill="#173" />
      <circle cx="27.4" cy="31.8" r="0.9" fill="#fff" />
      <circle cx="38.4" cy="31.8" r="0.9" fill="#fff" />
      {/* cheeks + smile */}
      <circle cx="19" cy="39" r="2.6" fill="#fb7185" opacity="0.75" />
      <circle cx="45" cy="39" r="2.6" fill="#fb7185" opacity="0.75" />
      <path d="M27 41 Q32 45 37 41" stroke="#134e4a" strokeWidth="2" strokeLinecap="round" fill="none" />
      {/* nostrils */}
      <circle cx="30" cy="37.5" r="0.8" fill="#134e4a" opacity="0.6" />
      <circle cx="34" cy="37.5" r="0.8" fill="#134e4a" opacity="0.6" />
    </motion.svg>
  );
}

export function RobotMascot({ size = 78 }: { size?: number }) {
  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      animate={{ y: [0, -4, 0], rotate: [2, -2, 2] }}
      transition={{ repeat: Infinity, duration: 3.1, ease: "easeInOut", delay: 0.4 }}
      style={{ filter: "drop-shadow(0 6px 10px rgba(0,0,0,0.28))" }}
      aria-hidden
    >
      {/* antenna */}
      <line x1="32" y1="10" x2="32" y2="4" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="32" cy="4" r="3.4" fill="#f472b6">
        <animate attributeName="opacity" values="1;0.45;1" dur="1.6s" repeatCount="indefinite" />
      </circle>
      {/* ears */}
      <rect x="8" y="24" width="6" height="12" rx="3" fill="#94a3b8" />
      <rect x="50" y="24" width="6" height="12" rx="3" fill="#94a3b8" />
      {/* head */}
      <rect x="14" y="10" width="36" height="34" rx="11" fill="#dbe3ff" />
      {/* visor */}
      <rect x="20" y="19" width="24" height="15" rx="7.5" fill="#1e293b" />
      <circle cx="27.5" cy="26.5" r="3.4" fill="#67e8f9">
        <animate attributeName="r" values="3.4;2.6;3.4" dur="2.2s" repeatCount="indefinite" />
      </circle>
      <circle cx="36.5" cy="26.5" r="3.4" fill="#67e8f9">
        <animate attributeName="r" values="3.4;2.6;3.4" dur="2.2s" repeatCount="indefinite" begin="0.3s" />
      </circle>
      {/* mouth grille */}
      <rect x="26" y="38" width="12" height="2.6" rx="1.3" fill="#94a3b8" />
      {/* body hint */}
      <rect x="20" y="46" width="24" height="12" rx="6" fill="#c7d2fe" />
      <circle cx="32" cy="52" r="3" fill="#818cf8" />
    </motion.svg>
  );
}

/** Staggered entrance helper for lists of children. */
export function Stagger({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="show"
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: 0.055, delayChildren: delay } },
      }}
    >
      {children}
    </motion.div>
  );
}

export const staggerItem = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, damping: 22, stiffness: 260 } },
};

export function StaggerItem({ children, className = "", style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <motion.div className={className} style={style} variants={staggerItem}>
      {children}
    </motion.div>
  );
}
