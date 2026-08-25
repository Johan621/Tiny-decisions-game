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
            className="absolute inset-0 bg-black/60"
            onClick={onClose}
          />
          <motion.div
            className="sheet-dark relative flex w-full max-w-md flex-col rounded-t-[30px] border-t border-white/25 px-5 pb-10 pt-3 text-white shadow-[0_-12px_48px_-12px_rgba(0,0,0,0.6)]"
            style={{ maxHeight: "82dvh" }}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 32, stiffness: 340 }}
          >
            <div className="mx-auto mb-2.5 h-1.5 w-12 rounded-full bg-white/30" />
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-xl font-black tracking-tight">{title}</h2>
              <motion.button
                whileTap={{ scale: 0.85 }}
                onClick={onClose}
                className="grid h-9 w-9 place-items-center rounded-full bg-white/12 text-lg font-bold ring-1 ring-white/25"
                aria-label="Close sheet"
              >
                ✕
              </motion.button>
            </div>
            <div className="no-scrollbar flex-1 overflow-y-auto">{children}</div>
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
          className="fixed inset-0 z-[60] grid place-items-center bg-black/75 px-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            initial={{ scale: 0.85, y: 30 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", damping: 24, stiffness: 300 }}
            className="w-full max-w-xs rounded-3xl bg-slate-900 p-5 text-white shadow-2xl ring-1 ring-white/15"
          >
            <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-widest text-white/40">
              <span>Sponsored · simulated</span>
              <span>{t > 0 ? `${t}s` : "done"}</span>
            </div>
            <div className="shine relative mt-3 overflow-hidden rounded-2xl bg-gradient-to-br from-fuchsia-500 via-violet-500 to-orange-400 p-4">
              <p className="text-lg font-black">{sponsor.name}</p>
              <p className="text-sm opacity-90">{sponsor.tag}</p>
              <div className="mt-3 grid h-16 place-items-center text-4xl">🛸</div>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-400 transition-all duration-1000 ease-linear"
                style={{ width: `${((4 - t) / 4) * 100}%` }}
              />
            </div>
            <button
              disabled={t > 0}
              onClick={() => {
                if (t === 0) onReward();
              }}
              className="btn-glossy relative mt-4 w-full overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 py-3 font-black text-white shadow-lg shadow-emerald-500/30 disabled:opacity-40 active:scale-[0.98] transition"
            >
              {t > 0 ? `Keep watching… ${t}s` : "Claim reward 🎉"}
            </button>
            <button
              onClick={onClose}
              className="mt-2 w-full py-2 text-sm font-bold text-white/50"
            >
              No thanks
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
