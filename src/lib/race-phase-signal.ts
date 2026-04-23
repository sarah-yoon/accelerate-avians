/**
 * Lightweight cross-component race-phase signal. SettingsPopover lives in
 * the root layout; the race pages need to tell it "a race is active"
 * without React-level context plumbing. A localStorage + storage-event
 * bridge is overkill, so we use a tiny in-module singleton with a
 * subscriber list.
 */

type Phase = "idle" | "countdown" | "racing" | "finished";
type Listener = (phase: Phase) => void;

let currentPhase: Phase = "idle";
const listeners = new Set<Listener>();

export function setRacePhase(phase: Phase): void {
  if (phase === currentPhase) return;
  currentPhase = phase;
  for (const l of listeners) l(phase);
}

export function getRacePhase(): Phase {
  return currentPhase;
}

export function subscribeRacePhase(l: Listener): () => void {
  listeners.add(l);
  l(currentPhase);
  return () => listeners.delete(l);
}
