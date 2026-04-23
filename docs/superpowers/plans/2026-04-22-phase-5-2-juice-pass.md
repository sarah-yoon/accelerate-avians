# Phase 5.2 — Juice Pass

**Goal:** Ship the visible-during-a-30s-demo juice that 5.1 deferred. Priority is "what a recruiter sees", not "spec completeness". Audio + 9 themed error-state sprites + full ARIA+focus overhaul + lobby rework + guest-to-account claim + shortcuts overlay are explicitly out of scope; if time remains, those go to 5.3.

**Dependencies:** Phase 5.1 shipped (combo meter, guest mode, landing rewrite). Phase 5.2 layers visual feedback on top of an already-functional demo path.

**Spec sections:** § 3.1 (juice — word flash, particle trail), § 3.3 (mobile soft-block), § 3.4 (settings popover partial), § 3.6 (ARIA live region — just the countdown/race-start announcements).

---

## Tasks

### T1: Word-complete flash + screen shake
- On passing a space character with ≥95% per-word accuracy, flash a white overlay (0.15 → 0 alpha over 180 ms) + 2-3px canvas shake for 80 ms.
- Rate-limit coalesced: within 200ms of a prior flash, queue and fire latest at window end.
- Gated on `useReducedMotion()` — no-op when preferred.
- Implementation: add `flashKey` counter prop to `RaceCanvas`, driven from `useRace` watching word-boundary cursor transitions. Canvas arms a timer on counter bump.

### T2: Feather particle trail
- Pixel-art feather sprite emitted behind the local player.
- Emission interval = `clamp(1000 / max(wpm/20, 0.01), 80, 1200) ms`.
- Concurrent cap: 20 particles across all birds; oldest recycled.
- Canvas-based rendering (not DOM) for performance.
- Gated on `useReducedMotion()` + `useLowEndDevice()` (`deviceMemory ?? hardwareConcurrency ≤ 4`).
- Sprite: a small procedurally-drawn feather (10×6 px) — no asset file required; draw via canvas primitives to keep the PR self-contained.

### T3: Settings popover (minimal)
- Gear icon top-right of every page (new component `SettingsPopover`).
- Two toggles:
  - Reduced motion (`localStorage["aa.motion.reduced"]` — override OS pref)
  - High contrast (stub — just flips a CSS variable on `document.documentElement`; visual polish deferred)
- Disabled during active race ("Settings available between races" tooltip).
- Focus trap + Escape-to-close.

### T4: Mobile soft-block UI
- Replace existing `MobileInterstitial` with themed `MobileChoice`:
  - Detect `matchMedia("(pointer: coarse)") && !matchMedia("(pointer: fine)")` (iPad + keyboard is allowed through).
  - Show "Come back on a laptop — birds need keyboards" message + `Continue Anyway` + `Take Me Home` buttons.
  - Persist "Continue Anyway" choice in localStorage.
- 5s-after-countdown fallback banner if 0 valid keystrokes detected.

### T5: ARIA live region — countdown + race events
- `<LiveAnnouncer>` component, portaled to `document.body`.
- Assertive region (`aria-live="assertive"`) for: countdown ("3, 2, 1"), race start ("Go!"), race end with placement.
- Wire into `useRace` via a callback ref; fire on phase transitions + countdownValue updates.

### T6: Verify + tag + merge
- `npm run dev` → navigate landing → play guest → word-type through a race → verify all juice fires.
- `prefers-reduced-motion: reduce` in Chrome DevTools → verify all juice disables.
- Server suite + frontend suite green (pre-existing failures unchanged).
- Tag `phase-5-2-juice-pass`.

---

## Non-goals (5.3+)

- ❌ Audio (6 SFX + voice pool)
- ❌ 9 themed error-state sprites
- ❌ Lobby rework (host transfer, Copy code fallback, ready indicators)
- ❌ Full ARIA + focus management beyond the countdown announcer
- ❌ Shortcuts overlay (F1/? key)
- ❌ Guest-to-account claim flow + 30-min recency gate
- ❌ High-contrast full visual overhaul (just the toggle stub)
- ❌ `aa.pending-claim` multi-race FIFO stash
