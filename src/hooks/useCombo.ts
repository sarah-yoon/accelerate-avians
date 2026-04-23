"use client";
import { useCallback, useReducer } from "react";

export type TierName = "Fledgling" | "Flapping" | "Soaring" | "Migrating" | "Skyborne";

export const TIER_THRESHOLDS: Record<TierName, number> = {
  Fledgling: 0,
  Flapping: 5,
  Soaring: 15,
  Migrating: 35,
  Skyborne: 75,
};

export function tierFor(count: number): TierName {
  if (count >= TIER_THRESHOLDS.Skyborne) return "Skyborne";
  if (count >= TIER_THRESHOLDS.Migrating) return "Migrating";
  if (count >= TIER_THRESHOLDS.Soaring) return "Soaring";
  if (count >= TIER_THRESHOLDS.Flapping) return "Flapping";
  return "Fledgling";
}

export interface ComboState {
  count: number;
  paused: boolean;
  pausedAtCharIndex: number;
}

export type ComboEvent =
  | { kind: "correct"; charIndex: number }
  | { kind: "incorrect"; charIndex: number }
  | { kind: "backspace"; charIndex: number }
  | { kind: "reset" };

export function computeCombo(state: ComboState, event: ComboEvent): ComboState {
  switch (event.kind) {
    case "correct": {
      if (state.paused) {
        if (event.charIndex > state.pausedAtCharIndex) {
          return { count: state.count + 1, paused: false, pausedAtCharIndex: 0 };
        }
        return state;
      }
      return { count: state.count + 1, paused: false, pausedAtCharIndex: 0 };
    }
    case "incorrect":
      return { count: 0, paused: false, pausedAtCharIndex: 0 };
    case "backspace":
      if (state.paused) return state;
      // Pause at the index just BEFORE the backspace — so the player has to
      // re-type past that point to resume (spec § 3.5).
      return {
        count: state.count,
        paused: true,
        pausedAtCharIndex: event.charIndex + 1,
      };
    case "reset":
      return { count: 0, paused: false, pausedAtCharIndex: 0 };
  }
}

const INITIAL: ComboState = { count: 0, paused: false, pausedAtCharIndex: 0 };

export function useCombo() {
  const [state, dispatch] = useReducer(computeCombo, INITIAL);
  const record = useCallback((event: ComboEvent) => dispatch(event), []);
  return { state, record, tier: tierFor(state.count) };
}
