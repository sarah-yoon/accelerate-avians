# Phase 5.3 — Remainder

Ship the remaining spec § 3 items that Phases 5.1 and 5.2 deferred. Where the spec calls for art assets (9 themed sprites, bundled audio files), ship procedural fallbacks — honest about the "engineer, not designer" constraint.

## Tasks

1. **Settings disabled during race.** Wire `disabled` prop from a race-phase context into SettingsPopover.
2. **Audio — 4 synth SFX + mute toggle.** Web Audio API; no asset files. Tones for correct key, typo, countdown beep, race finish. `useAudio` hook with `localStorage["aa.audio.muted"]`. Mute toggle in SettingsPopover (default muted).
3. **Shortcuts overlay.** F1 opens a modal listing keyboard shortcuts. Esc closes.
4. **ErrorOverlay infrastructure.** Themed copy + simple CSS illustration per error. Four paths: `room-not-found`, `passage-load-failed`, `server-unreachable`, `signin-required`. Others deferred (their server-side trigger paths don't exist yet, e.g. `kicked-for-cheating` is LOG-only in Phase 4).
5. **Guest-to-account claim.** FIFO localStorage stash (cap 3) + boot hook in a client-only `ClaimBoundary` component that reads on authenticated mount and POSTs to `/api/scores/claim`.
6. **Focus traps.** Minimal custom trap for SettingsPopover, MobileChoice, and ErrorOverlay. No dep.
7. **Lobby rework.** Visible `Start Race` only for host, `Copy Code` button with clipboard fallback, ready indicators per player. Keep scope tight — host transfer on disconnect is existing server behaviour (just needs UI).
8. **Verify + tag.**
