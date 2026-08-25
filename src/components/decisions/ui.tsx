"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            aria-label="Close"
            className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
            onClick={onClose}
          />
          <motion.div
            className="relative w-full max-w-md rounded-t-[28px] px-5 pt-4 pb-10 flex flex-col"
            style={{
              background: "rgba(12,8,24,0.92)",
              color: "#fff",
              maxHeight: "82dvh",
            }}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
          >
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-white/25" />
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xl font-extrabold tracking-tight">{title}</h2>
              <button
                onClick={onClose}
                className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-lg active:scale-90 transition-transform"
                aria-label="Close sheet"
              >
                ✕
              </button>
            </div>
            <div className="overflow-y-auto no-scrollbar flex-1">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const SPONSORS = [
  { name: "DragonChow™", tag: "Feed your tiny dragon. Any size dragon." },
  { name: "MarsMart", tag: "Oxygen refills, 2-for-1 this week." },
  { name: "ChaiCloud", tag: "Infinite chai. Zero kitchen fires." },
  { name: "RoboRentals", tag: "Clone yourself a weekend." },
];

export function AdModal({
  open,
  onReward,
  onClose,
}: {
  open: boolean;
  onReward: () => void;
  onClose: () => void;
}) {
  const [t, setT] = useState(4);
  const sponsor = SPONSORS[Math.floor(Math.random() * SPONSORS.length)]!;

  useEffect(() => {
    if (!open) return;
    setT(4);
    const iv = setInterval(() => {
      setT((v) => {
        if (v <= 1) {
          clearInterval(iv);
          return 0;
        }
        return v - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] grid place-items-center bg-black/70 backdrop-blur-sm px-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            initial={{ scale: 0.85, y: 30 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="w-full max-w-xs rounded-3xl bg-white p-5 text-slate-900 shadow-2xl"
          >
            <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-widest text-slate-400">
              <span>Sponsored · simulated</span>
              <span>{t > 0 ? `${t}s` : "done"}</span>
            </div>
            <div className="mt-3 rounded-2xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-orange-400 p-4 text-white">
              <p className="text-lg font-black">{sponsor.name}</p>
              <p className="text-sm opacity-90">{sponsor.tag}</p>
              <div className="mt-3 h-16 grid place-items-center text-4xl">🛸</div>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-1000 ease-linear"
                style={{ width: `${((4 - t) / 4) * 100}%` }}
              />
            </div>
            <button
              disabled={t > 0}
              onClick={() => {
                if (t === 0) onReward();
              }}
              className="mt-4 w-full rounded-2xl bg-slate-900 py-3 font-bold text-white disabled:opacity-40 active:scale-[0.98] transition"
            >
              {t > 0 ? "Keep watching…" : "Claim reward 🎉"}
            </button>
            <button
              onClick={onClose}
              className="mt-2 w-full py-2 text-sm font-medium text-slate-500"
            >
              No thanks
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
