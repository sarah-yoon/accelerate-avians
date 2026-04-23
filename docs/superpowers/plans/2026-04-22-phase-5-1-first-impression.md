# Phase 5.1 — Recruiter-First-Impression Polish

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or inline execution. This plan targets the first 30 seconds of a recruiter's visit to https://accelerate-avians.vercel.app. The rest of spec § 3 (audio, full a11y, 9 error states, lobby rework, feather trails) is Phase 5.2+.

**Goal:** A cold visitor can be playing a typing race within 15 seconds of landing on the page, without signing up. The game visibly rewards them during the race (combo meter + word flash + dynamic bird animation).

**Architecture:** New `/play/guest/page.tsx` route that renders the existing solo race engine with a hardcoded 45-second passage, no auth. Landing page (`/`) rewritten with a tight hero pointing at `/play/guest`. Live counter ("X races played") via Next.js 16 `use cache` directive with 60s revalidation. Combo meter is a new `ComboMeter` component reading from typing-engine state; word flash and dynamic flap rate are additions to the existing `RaceCanvas`.

**Tech Stack:** Next.js 16 App Router + Cache Components (per `AGENTS.md`), React 19, Tailwind CSS, existing typing-engine + bird-sprite stack.

**Spec sections:** § 3.1 (combo + juice), § 3.3 (guest mode + landing), § 3.5 (combo mechanics), § 3.6 (reduced-motion consolidated).

**Explicit scope cuts (deferred to 5.2):**
- Audio / `useAudio` hook / 6 SFX
- Feather particle trail
- Full ARIA live regions + focus traps
- 9 themed error-state illustrations
- Lobby rework (host transfer, ready indicators, Copy code fallback)
- Mobile soft-block UI
- Shortcuts overlay / `F1` key
- High-contrast toggle

Keeping scope focused on what a recruiter sees in the first 30 seconds of a cold visit.

---

## File structure

| Path | Change | Responsibility |
|------|--------|----------------|
| `src/app/play/guest/page.tsx` | **new** | 45-second solo race, no auth, scripted bot ghost |
| `src/app/api/stats/totals/route.ts` | **new** | GET — returns `{ races, words }` totals with `use cache` |
| `src/app/page.tsx` | modify | Landing-page rewrite with committed hero + live counter + Play Now |
| `src/components/race/ComboMeter.tsx` | **new** | HUD top-right tier label (Fledgling/Flapping/Soaring/Migrating/Skyborne) |
| `src/hooks/useCombo.ts` | **new** | Combo state machine — rules per spec § 3.5 |
| `src/hooks/useCurrentWPM.ts` | **new** | 3-second rolling WPM from typing events |
| `src/hooks/useReducedMotion.ts` | **new** | Combines OS `prefers-reduced-motion` with a localStorage override |
| `src/components/race/race-renderer.ts` | modify | Word-complete flash (white overlay + 2px screen shake, 80ms) gated on reduced-motion; dynamic flap fps for local player |
| `src/components/race/RaceCanvas.tsx` | modify | Wire `useCombo` + `useCurrentWPM` + word-flash emit |
| `tests/hooks/useCombo.test.ts` | **new** | Combo state-machine unit tests (per § 3.5) |
| `tests/hooks/useCurrentWPM.test.ts` | **new** | Rolling-window math unit tests |

No new Prisma schema changes. No server-side changes. No new deps.

---

## Task 1: `useCombo` + `useCurrentWPM` hooks

**Spec:** § 3.5 combo mechanics (visual-only; tier thresholds 5 / 15 / 35 / 75 for Flapping / Soaring / Migrating / Skyborne).

**Files:**
- Create: `src/hooks/useCombo.ts`, `src/hooks/useCurrentWPM.ts`
- Test: `tests/hooks/useCombo.test.ts`, `tests/hooks/useCurrentWPM.test.ts`

### Step 1: Write `useCombo` tests

```ts
import { describe, it, expect } from "vitest";
import { computeCombo, TIER_THRESHOLDS, type ComboState } from "@/hooks/useCombo";

const initial: ComboState = { count: 0, paused: false, pausedAtCharIndex: 0 };

describe("computeCombo", () => {
  it("first keystroke takes combo from 0 to 1", () => {
    const after = computeCombo(initial, { kind: "correct", charIndex: 1 });
    expect(after).toEqual({ count: 1, paused: false, pausedAtCharIndex: 0 });
  });

  it("resets to 0 on typo", () => {
    const s1 = computeCombo(initial, { kind: "correct", charIndex: 1 });
    const s2 = computeCombo(s1, { kind: "correct", charIndex: 2 });
    const s3 = computeCombo(s2, { kind: "incorrect", charIndex: 3 });
    expect(s3.count).toBe(0);
  });

  it("backspace pauses without resetting; further backspaces keep earliest pausedAtCharIndex", () => {
    let s = initial;
    s = computeCombo(s, { kind: "correct", charIndex: 1 });
    s = computeCombo(s, { kind: "correct", charIndex: 2 });
    s = computeCombo(s, { kind: "correct", charIndex: 3 });
    // Backspace from 3 → paused at 3
    s = computeCombo(s, { kind: "backspace", charIndex: 2 });
    expect(s).toEqual({ count: 3, paused: true, pausedAtCharIndex: 3 });
    // Further backspace — keep earliest (3), not new charIndex (1)
    s = computeCombo(s, { kind: "backspace", charIndex: 1 });
    expect(s).toEqual({ count: 3, paused: true, pausedAtCharIndex: 3 });
  });

  it("resumes only after re-typing past pausedAtCharIndex", () => {
    let s: ComboState = { count: 3, paused: true, pausedAtCharIndex: 3 };
    s = computeCombo(s, { kind: "correct", charIndex: 2 });
    expect(s.paused).toBe(true);
    s = computeCombo(s, { kind: "correct", charIndex: 3 });
    expect(s.paused).toBe(true);
    s = computeCombo(s, { kind: "correct", charIndex: 4 });
    expect(s).toEqual({ count: 4, paused: false, pausedAtCharIndex: 0 });
  });

  it("tier thresholds are 5 / 15 / 35 / 75", () => {
    expect(TIER_THRESHOLDS).toEqual({
      Fledgling: 0,
      Flapping: 5,
      Soaring: 15,
      Migrating: 35,
      Skyborne: 75,
    });
  });
});
```

### Step 2: Implement `useCombo`

```ts
// src/hooks/useCombo.ts
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
      if (state.paused) return state; // keep earliest pausedAtCharIndex
      return { count: state.count, paused: true, pausedAtCharIndex: event.charIndex + 1 };
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
```

### Step 3: Write `useCurrentWPM` tests

```ts
import { describe, it, expect } from "vitest";
import { computeWpm } from "@/hooks/useCurrentWPM";

describe("computeWpm", () => {
  it("returns 0 for empty samples", () => {
    expect(computeWpm([], 0)).toBe(0);
  });

  it("computes rolling WPM from keystrokes in window", () => {
    // 50 correct keystrokes = 10 words, over 5000ms = 120 WPM
    const samples = Array.from({ length: 50 }, (_, i) => ({ ms: i * 100 }));
    const now = 5000;
    // window = last 3s, samples from ms=2000..4900 (30 keystrokes = 6 words / 2.9s × 60 ≈ 124)
    const result = computeWpm(samples, now, 3000);
    expect(result).toBeGreaterThan(100);
    expect(result).toBeLessThan(140);
  });
});
```

### Step 4: Implement `useCurrentWPM`

```ts
// src/hooks/useCurrentWPM.ts
import { useEffect, useRef, useState } from "react";

interface KeystrokeSample { ms: number; }

const WINDOW_MS = 3000;
const CHARS_PER_WORD = 5;

export function computeWpm(samples: KeystrokeSample[], nowMs: number, windowMs = WINDOW_MS): number {
  const cutoff = nowMs - windowMs;
  let count = 0;
  for (const s of samples) {
    if (s.ms >= cutoff && s.ms <= nowMs) count++;
  }
  if (count === 0) return 0;
  const words = count / CHARS_PER_WORD;
  return Math.round((words / windowMs) * 60_000);
}

export function useCurrentWPM(samplesRef: React.RefObject<KeystrokeSample[]>): number {
  const [wpm, setWpm] = useState(0);
  const rafRef = useRef<number | null>(null);
  useEffect(() => {
    const tick = () => {
      const now = performance.now();
      const samples = samplesRef.current ?? [];
      setWpm(computeWpm(samples, now));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); };
  }, [samplesRef]);
  return wpm;
}
```

### Step 5: Run tests — expect all pass

```bash
npx vitest run tests/hooks/useCombo.test.ts tests/hooks/useCurrentWPM.test.ts
```

### Step 6: Commit

```bash
git add src/hooks/useCombo.ts src/hooks/useCurrentWPM.ts tests/hooks/useCombo.test.ts tests/hooks/useCurrentWPM.test.ts
git commit -m "feat(p5.1): combo state machine + rolling-window WPM hook"
```

---

## Task 2: `useReducedMotion` hook

**Files:** Create `src/hooks/useReducedMotion.ts` (no test — trivial, visual-only).

```ts
// src/hooks/useReducedMotion.ts
"use client";
import { useEffect, useState } from "react";

const STORAGE_KEY = "aa.motion.reduced";

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const osPref = window.matchMedia("(prefers-reduced-motion: reduce)");
    const override = window.localStorage.getItem(STORAGE_KEY);
    const initial = override === "true" ? true : override === "false" ? false : osPref.matches;
    setReduced(initial);
    const handler = () => {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === null) setReduced(osPref.matches);
    };
    osPref.addEventListener("change", handler);
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      if (e.newValue === null) setReduced(osPref.matches);
      else setReduced(e.newValue === "true");
    };
    window.addEventListener("storage", onStorage);
    return () => {
      osPref.removeEventListener("change", handler);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  return reduced;
}
```

Commit: `feat(p5.1): useReducedMotion hook combining OS pref + localStorage override`.

---

## Task 3: `ComboMeter` HUD component

**Files:** Create `src/components/race/ComboMeter.tsx`.

```tsx
// src/components/race/ComboMeter.tsx
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

export function ComboMeter({ count, paused }: { count: number; paused: boolean }) {
  const tier = tierFor(count);
  const reducedMotion = useReducedMotion();
  if (count === 0) return null;
  return (
    <div
      className={`fixed top-4 right-4 z-20 font-[family-name:var(--font-press-start)] text-right leading-tight pointer-events-none select-none ${TIER_COLOR[tier]}`}
      aria-live="polite"
      aria-label={`Combo: ${tier}, multiplier ${TIER_MULTIPLIER[tier]}, streak ${count}`}
    >
      <div className="text-xs tracking-widest uppercase">{tier}</div>
      <div className={`text-3xl font-bold ${reducedMotion ? "" : "drop-shadow-[0_0_6px_currentColor]"}`}>
        {TIER_MULTIPLIER[tier]}
      </div>
      <div className="text-[10px] tracking-wider opacity-60">{paused ? "…" : `${count} streak`}</div>
    </div>
  );
}
```

No unit test — pure presentation. Commit.

---

## Task 4: Wire `useCombo` + `useCurrentWPM` into the solo race

Discovery pass first — read `src/hooks/useTyping.ts` and `src/components/race/RaceCanvas.tsx` to locate the keystroke event hook points. Expected current shape: `useTyping` returns cursorPos / accuracy / some keystroke event.

**Add to** `useTyping.ts` (or the typing engine it wraps): an `onKeystroke` callback that fires `{ kind: "correct" | "incorrect" | "backspace", charIndex }`. If no such callback exists today, add it as an optional prop — don't break solo or multiplayer paths.

**Add to** `RaceCanvas.tsx` (or wherever HUD elements live): instantiate `useCombo`, forward `state.count` + `state.paused` to the new `<ComboMeter>`. Wire `useCurrentWPM` (if it's not already plumbed) and pass the local-player WPM into the renderer so the flap fps can become dynamic.

**Dynamic flap fps** — edit `race-renderer.ts` where the player bird's sprite is updated: `racer.sprite.setFps(clamp(currentWpm / 10, 4, 12))` for the LOCAL player only. Opponent flap stays at 8 (comment already present from P2-11 flagging this for Phase 5).

### Verification

- Run `npm run dev`, navigate to a solo race, type a word → combo meter appears in top-right, tier animates up.
- Type fast (100+ WPM) → bird flap visibly faster.
- Backspace → meter pauses with "…" indicator.

Commit: `feat(p5.1): wire combo meter + dynamic local-player flap fps`.

---

## Task 5: Word-complete flash + screen shake

**Files:** modify `src/components/race/race-renderer.ts`, `src/components/race/RaceCanvas.tsx`.

Add a `flashUntilMs: number` field to the renderer. When the typing engine emits a word-complete event (accuracy ≥ 95% on the just-finished word), the React side calls a renderer method `flashWordComplete()` which sets `flashUntilMs = performance.now() + 180`.

In the render loop, after drawing the scene, draw a white rectangle covering the passage area with alpha = `clamp((flashUntilMs - now) / 180 * 0.15, 0, 0.15)`. Gate the entire effect on `!reducedMotion` (pass a boolean ref into the renderer).

Screen shake: when flash fires, also set `shakeUntilMs = now + 80` and `shakeAmp = 2`. Apply a tiny camera offset `sin((now - shakeStart) * 0.1) * amp` to all drawn elements until the window ends.

**Rate limit** — if `flashUntilMs > now` when a new flash is requested, coalesce: queue the request and fire the NEWEST one at the window boundary. Ensures back-to-back short words don't strobe.

Run `npm run dev` and verify: typing a word produces a brief white flash + tiny shake; typing an erroneous word produces no flash; `prefers-reduced-motion: reduce` set in the browser disables both.

Commit: `feat(p5.1): word-complete flash + screen shake (reduced-motion gated)`.

---

## Task 6: Live-counter API + SSR cache

**Files:**
- Create: `src/app/api/stats/totals/route.ts`
- Modify: `src/app/page.tsx`

### Step 1: API route

```ts
// src/app/api/stats/totals/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const revalidate = 300; // 5 minutes

export async function GET() {
  try {
    const [races, passages] = await Promise.all([
      prisma.score.count({ where: { flagged: false } }),
      prisma.score.findMany({
        where: { flagged: false },
        select: { passage: { select: { wordCount: true } } },
      }),
    ]);
    const words = passages.reduce((sum, s) => sum + (s.passage?.wordCount ?? 0), 0);
    return NextResponse.json({ races, words });
  } catch {
    return NextResponse.json({ races: null, words: null }, { status: 200 });
  }
}
```

Per `AGENTS.md`, verify against `node_modules/next/dist/docs/` whether `use cache` directive is preferred over `export const revalidate`. If the project uses the Cache Components style, switch to that — otherwise stick with `revalidate`.

### Step 2: Landing-page rewrite

Compact hero:

```tsx
// src/app/page.tsx
import Link from "next/link";

async function fetchTotals() {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ""}/api/stats/totals`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    return (await res.json()) as { races: number | null; words: number | null };
  } catch {
    return null;
  }
}

function formatCount(n: number | null): string {
  if (n === null || n === undefined) return "";
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k+`;
  return String(n);
}

export default async function Home() {
  const totals = await fetchTotals();
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-8 px-6 bg-gradient-to-b from-sky-950 to-stone-900 text-stone-100">
      <div className="max-w-2xl text-center space-y-4">
        <h1 className="font-[family-name:var(--font-press-start)] text-4xl md:text-6xl leading-tight">
          Race the flock.
          <br />Type fast.
        </h1>
        <p className="text-sm md:text-base text-stone-300">
          Pixel-bird typing races. Solo, friends, or strangers.
        </p>
      </div>
      <div className="flex flex-col gap-3 items-center">
        <Link
          href="/play/guest"
          className="px-8 py-4 bg-amber-300 text-stone-900 font-[family-name:var(--font-press-start)] text-lg rounded shadow-[0_6px_0_rgb(180_83_9)] hover:translate-y-[1px] hover:shadow-[0_5px_0_rgb(180_83_9)] active:translate-y-[3px] active:shadow-[0_3px_0_rgb(180_83_9)] transition-all"
        >
          Play Now
        </Link>
        <Link href="/sign-up" className="text-xs text-stone-400 hover:text-stone-200 underline">
          Sign up to track progress
        </Link>
      </div>
      {totals && totals.races !== null && totals.words !== null && (
        <div className="text-xs text-stone-400 font-mono">
          {formatCount(totals.races)} races played · {formatCount(totals.words)} words typed
        </div>
      )}
    </main>
  );
}
```

Any existing features grid / leaderboard preview can move below the fold or be deleted in a follow-up — do NOT bring them into 5.1 (scope creep).

### Verify

`npm run dev` → `http://localhost:3000` shows the new hero, Play Now navigates to `/play/guest`, stats render if the DB query succeeds (or are silently omitted if not).

Commit: `feat(p5.1): landing-page rewrite with hero + live counter`.

---

## Task 7: Guest mode route

**File:** Create `src/app/play/guest/page.tsx`.

**Spec:** § 3.3 guest mode — 45-second solo race, no auth, no score persistence, `onPaste` blocked.

Strategy: re-use the existing solo-race component tree but wrap it in a shell that:
- Skips Clerk auth (no `<ClerkProvider>`-required UI)
- Picks a short passage client-side from a small bundled set (no API round-trip)
- Disables score POST at the end
- Adds `onPaste={(e) => e.preventDefault()}` to the typing input
- Shows a results screen with a "Sign up to save this race" CTA (dead-ends for 5.1 — full claim flow is 5.2's `aa.pending-claim` stash)

Start by reading `src/app/race/page.tsx` or equivalent to understand the existing solo shell. If reusing the component tree is straightforward (pass a `guest={true}` prop), do that. If it requires forking the component, COPY a minimal shell into `/play/guest` rather than refactoring the existing solo code (avoid blast radius).

Bundle 3-5 short passages inline in the page file so guest mode has zero DB dependency:

```ts
const GUEST_PASSAGES = [
  { text: "The quick brown fox jumps over the lazy dog.", wordCount: 9 },
  { text: "Every bird knows the shape of wind before it flies.", wordCount: 10 },
  // …3 more short, flavourful lines
];
```

### Verify

- Navigate to `/play/guest` in an incognito window (no Clerk session) → race loads immediately, no auth gates.
- Type the passage, race completes, results show "Sign up to save this race" CTA.
- `Cmd+V` attempting to paste into the typing field is a no-op (onPaste preventDefault).

Commit: `feat(p5.1): guest mode — 45s solo race, no signup, paste blocked`.

---

## Task 8: Verification + tag

- [ ] Run `npm run build` — landing + /play/guest compile clean.
- [ ] Run `npm run dev` and click through the full flow in a fresh incognito window: landing → Play Now → race → results. End-to-end in under 20 seconds with no account.
- [ ] Run `npx vitest run` — frontend suite pass count unchanged (pre-existing 6 failures still there, no regressions).
- [ ] Run `cd server && npx vitest run` — 154/154 still green.
- [ ] Tag:

```bash
git tag -a phase-5-1-first-impression -m "Phase 5.1: guest mode + landing rewrite + combo meter + word flash + dynamic flap"
```

---

## Non-goals for 5.1 (save for 5.2)

- Audio (6 SFX + voice pool)
- Feather particle trail (needs sprite asset + canvas particle pool)
- ARIA live regions + focus traps + shortcuts overlay
- 9 themed error-state sprites
- Lobby roster / host transfer / Copy code fallback
- Mobile soft-block UI
- `aa.pending-claim` full cross-session stash + boot hook (guest-mode results just show a CTA for now)
- High-contrast toggle
- Combo meter backspace edge cases beyond what `useCombo` already handles

If time remains in the session after 5.1 ships, pick one or two of these off the 5.2 queue.

---

## Notes for implementer

- `AGENTS.md` warns Next.js 16 has breaking changes — consult `node_modules/next/dist/docs/` before writing `use cache` directive vs `export const revalidate`.
- `npm run dev` default port is 3000 (frontend). The game server on 3001 is NOT needed for 5.1 (guest mode is solo only).
- The existing Press Start 2P font variable (`--font-press-start`) is already wired via layout.tsx. Don't re-import.
- Existing typing-engine + bird-sprite pipeline is stable; PRESERVE not refactor.
- If a task's discovery phase reveals the existing code is harder to extend than the plan assumes, STOP and report BLOCKED rather than refactoring unrelated code.
