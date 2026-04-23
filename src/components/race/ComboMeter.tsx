"use client";
import { tierFor, type TierName } from "@/hooks/useCombo";
import { useReducedMotion } from "@/hooks/useReducedMotion";

const TIER_COLOR: Record<TierName, string> = {
  Fledgling: "text-stone-400",
  Flapping:  "text-sky-300",
  Soaring:   "text-emerald-300",
  Migrating: "text-amber-300",
  Skyborne:  "text-fuchsia-300",
};

const TIER_MULTIPLIER: Record<TierName, string> = {
  Fledgling: "×1",
  Flapping:  "×2",
  Soaring:   "×3",
  Migrating: "×5",
  Skyborne:  "×10",
};

interface ComboMeterProps {
  count: number;
  paused: boolean;
}

export function ComboMeter({ count, paused }: ComboMeterProps) {
  const tier = tierFor(count);
  const reducedMotion = useReducedMotion();
  if (count === 0) return null;

  const glow = reducedMotion
    ? ""
    : "drop-shadow-[0_0_6px_currentColor] transition-all duration-150";

  return (
    <div
      className={`fixed top-4 right-4 z-20 text-right leading-tight pointer-events-none select-none ${TIER_COLOR[tier]}`}
      aria-live="polite"
      aria-label={`Combo tier ${tier}, ${TIER_MULTIPLIER[tier]} multiplier, ${count} correct in a row`}
    >
      <div className="font-[family-name:var(--font-press-start)] text-[10px] tracking-widest uppercase opacity-80">
        {tier}
      </div>
      <div
        className={`font-[family-name:var(--font-press-start)] text-2xl md:text-3xl font-bold ${glow}`}
      >
        {TIER_MULTIPLIER[tier]}
      </div>
      <div className="text-[10px] tracking-wider opacity-60">
        {paused ? "…" : `${count} streak`}
      </div>
    </div>
  );
}
