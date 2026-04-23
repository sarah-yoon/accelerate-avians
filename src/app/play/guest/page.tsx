"use client";

import { useEffect, useRef, useState } from "react";
import { useRace } from "@/hooks/useRace";
import { RaceCanvas } from "@/components/race/RaceCanvas";
import { ComboMeter } from "@/components/race/ComboMeter";
import { LiveAnnouncer } from "@/components/race/LiveAnnouncer";
import { TypingArea } from "@/components/typing/TypingArea";
import { MobileChoice } from "@/components/MobileChoice";
import { ErrorOverlay } from "@/components/ErrorOverlay";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { setRacePhase } from "@/lib/race-phase-signal";
import { stashResult } from "@/lib/claim-result";
import { fnv1a } from "@/lib/string-hash";
import { RaceResultsPanel } from "@/components/RaceResultsPanel";
import Link from "next/link";

/**
 * Guest mode — spec § 3.3. Anonymous play, no auth, no score persistence,
 * auto-starts on mount. Passes undefined clerkId to useRace so the
 * /api/scores POST is skipped. Paste is blocked on the typing input.
 */
export default function GuestPlayPage() {
  const race = useRace(undefined);
  const reducedMotion = useReducedMotion();
  const [resultOverlay, setResultOverlay] = useState(true);
  const hasAutoStartedRef = useRef(false);

  // Auto-start a short race within ~500ms of mount so the recruiter is
  // playing within seconds of landing on the page.
  useEffect(() => {
    if (hasAutoStartedRef.current) return;
    hasAutoStartedRef.current = true;
    race.startRace("short", false).catch(() => {
      // swallow — idle state is still usable via Try Again below
    });
  }, [race]);

  useEffect(() => {
    if (race.result) setResultOverlay(true);
  }, [race.result]);

  useEffect(() => {
    setRacePhase(race.phase);
    return () => setRacePhase("idle");
  }, [race.phase]);

  // Spec § 3.7 — stash the guest result when the race finishes so a
  // post-signup boot hook can POST it to /api/scores within 30 min.
  const stashedRef = useRef(false);
  useEffect(() => {
    if (!race.result || !race.passage || stashedRef.current) return;
    stashedRef.current = true;
    stashResult({
      passageId: race.passage.id,
      clientGhostData: race.typingSummary.clientGhostData,
      totalKeystrokes: race.typingSummary.totalKeystrokes,
      correctKeystrokes: race.typingSummary.correctKeystrokes,
      completedAt: Date.now(),
    });
  }, [race.result, race.passage, race.typingSummary]);

  return (
    <>
      <MobileChoice />

      {race.phase === "racing" && (
        <ComboMeter count={race.comboState.count} paused={race.comboState.paused} />
      )}

      {race.startError && (
        <ErrorOverlay
          errorKey={race.startError}
          primary={{ label: "Try Again", onClick: () => race.startRace("short", false) }}
          onClose={race.clearStartError}
        />
      )}

      <LiveAnnouncer
        countdownValue={race.phase === "countdown" ? race.countdownValue : null}
        phase={race.phase}
        resultMessage={
          race.result
            ? `Finished ${race.result.placement} of ${race.result.totalRacers} at ${race.result.wpm} WPM`
            : null
        }
      />

      <main className="flex flex-col items-center min-h-screen bg-pixel-black p-6">
        <div className="w-full max-w-[900px] game-hud flex justify-between items-center px-4 py-3 mb-6">
          <Link href="/" className="game-menu-item !p-0 !pl-5 text-[8px]">
            HOME
          </Link>
          <span className="font-heading text-pixel-bird-yellow text-[9px] text-glow-yellow">
            GUEST RACE · NO ACCOUNT
          </span>
          <Link href="/sign-up" className="game-menu-item !p-0 !pl-5 text-[8px]">
            SIGN UP
          </Link>
        </div>

        <div className="w-full max-w-[900px]">
          {race.passage && (
            <div
              className="mb-4 relative"
              onPasteCapture={(e) => {
                // spec § 2.1.2 / § 3.3: paste blocked in guest mode
                e.preventDefault();
              }}
            >
              <RaceCanvas
                phase={race.phase}
                countdownValue={race.countdownValue}
                playerProgress={race.playerProgress}
                playerBird="sparrow"
                playerUsername="Guest"
                ghosts={race.ghosts}
                totalChars={race.passage.charCount}
                raceStartTime={race.raceStartTime}
                wpm={race.wpm}
                wordFlashKey={race.wordsCompleted}
                reducedMotion={reducedMotion}
                backgroundSeed={race.passage ? fnv1a(race.passage.id) : undefined}
              />

              {race.result && resultOverlay && (
                <div
                  className="absolute inset-0 flex items-center justify-center z-20 animate-bounce-in"
                  style={{ top: "40px" }}
                >
                  <RaceResultsPanel
                    result={race.result}
                    isSignedIn={false}
                    onRaceAgain={() => race.startRace("short", true)}
                    onNewRace={() => race.startRace("short", false)}
                    onClose={() => setResultOverlay(false)}
                  />
                </div>
              )}
            </div>
          )}

          {race.passage && (
            <div className="pixel-panel p-4 mb-4">
              <TypingArea
                passage={race.passage.text}
                cursorPos={race.cursorPos}
                hasError={race.hasError}
                wpm={race.wpm}
                accuracy={race.accuracy}
                elapsedMs={race.elapsedMs ?? 0}
                enabled={race.phase === "racing"}
                onKeyDown={race.handleKeyDown}
                onCompositionStart={race.handleCompositionStart}
                onCompositionEnd={race.handleCompositionEnd}
              />
            </div>
          )}

          {race.isLoading && (
            <div className="flex flex-col items-center mt-12">
              <p className="font-heading text-pixel-bird-yellow text-[10px] animate-pulse text-glow-yellow">
                LOADING RACE…
              </p>
            </div>
          )}

          {race.result && !resultOverlay && (
            <div className="mt-4 max-w-md mx-auto">
              <RaceResultsPanel
                result={race.result}
                isSignedIn={false}
                onRaceAgain={() => race.startRace("short", true)}
                onNewRace={() => race.startRace("short", false)}
              />
              <p className="mt-4 text-center text-xs text-stone-400">
                Want to save this race?{" "}
                <Link href="/sign-up" className="underline hover:text-stone-200">
                  Sign up
                </Link>
                .
              </p>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
