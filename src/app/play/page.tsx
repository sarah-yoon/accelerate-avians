"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useRace } from "@/hooks/useRace";
import { RaceCanvas } from "@/components/race/RaceCanvas";
import { ComboMeter } from "@/components/race/ComboMeter";
import { LiveAnnouncer } from "@/components/race/LiveAnnouncer";
import { TypingArea } from "@/components/typing/TypingArea";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { MobileChoice } from "@/components/MobileChoice";
import { setRacePhase } from "@/lib/race-phase-signal";
import { RaceResultsPanel } from "@/components/RaceResultsPanel";
import Link from "next/link";
import type { Difficulty } from "@/types";

export default function PlayPage() {
  const { user } = useUser();
  const race = useRace(user?.id);
  const reducedMotion = useReducedMotion();
  const [selectedLength, setSelectedLength] = useState<Difficulty>("medium");
  const [resultOverlay, setResultOverlay] = useState(true);
  const [playerBird, setPlayerBird] = useState("sparrow");
  const [playerName, setPlayerName] = useState("Guest");

  // Fetch player's profile (bird + username)
  useEffect(() => {
    if (!user) return;
    async function fetchProfile() {
      try {
        const res = await fetch(`/api/profile/${user!.id}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data?.displayBird) setPlayerBird(data.displayBird);
        if (data?.username) setPlayerName(data.username);
      } catch { /* profile may not exist yet */ }
    }
    fetchProfile();
  }, [user]);

  // Reset overlay when a new result appears
  useEffect(() => {
    if (race.result) setResultOverlay(true);
  }, [race.result]);

  // Publish race phase so SettingsPopover can disable itself mid-race.
  useEffect(() => {
    setRacePhase(race.phase);
    return () => setRacePhase("idle");
  }, [race.phase]);

  return (
    <>
      <MobileChoice />

      {race.phase === "racing" && (
        <ComboMeter count={race.comboState.count} paused={race.comboState.paused} />
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
        {/* Game HUD header */}
        <div className="w-full max-w-[900px] game-hud flex justify-between items-center px-4 py-3 mb-6">
          <Link href="/" className="game-menu-item !p-0 !pl-5 text-[8px]">
            HOME
          </Link>
          <span className="font-heading text-pixel-bird-yellow text-[9px] text-glow-yellow">
            ACCELERATE, AVIANS
          </span>
          <div>
            {user ? (
              <Link href="/profile" className="game-menu-item !p-0 !pl-5 text-[8px]">
                PROFILE
              </Link>
            ) : (
              <Link href="/sign-in" className="game-menu-item !p-0 !pl-5 text-[8px]">
                SIGN IN
              </Link>
            )}
          </div>
        </div>

        {/* Race area */}
        <div className="w-full max-w-[900px]">
          {/* Canvas + overlay container */}
          {race.passage && (
            <div className="mb-4 relative">
              <RaceCanvas
                phase={race.phase}
                countdownValue={race.countdownValue}
                playerProgress={race.playerProgress}
                playerBird={playerBird}
                playerUsername={playerName}
                ghosts={race.ghosts}
                totalChars={race.passage.charCount}
                raceStartTime={race.raceStartTime}
                wpm={race.wpm}
                wordFlashKey={race.wordsCompleted}
                reducedMotion={reducedMotion}
              />

              {/* Results overlay on top of canvas */}
              {race.result && resultOverlay && (
                <div className="absolute inset-0 flex items-center justify-center z-20 animate-bounce-in" style={{ top: "40px" }}>
                  <RaceResultsPanel
                    result={race.result}
                    isSignedIn={!!user}
                    onRaceAgain={() => race.startRace(selectedLength, true)}
                    onNewRace={() => race.startRace(selectedLength, false)}
                    onClose={() => setResultOverlay(false)}
                  />
                </div>
              )}
            </div>
          )}

          {/* Typing area */}
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

          {/* Race setup — game menu style */}
          {race.phase === "idle" && !race.isLoading && !race.result && (
            <div className="flex flex-col items-center mt-6 animate-slide-up">
              <div className="pixel-panel p-8 w-full max-w-md">
                <h2 className="font-heading text-pixel-bird-yellow text-[10px] text-center mb-2 text-glow-yellow">
                  RACE SETUP
                </h2>
                <div className="game-divider mb-6" />

                {/* Passage length */}
                <div className="mb-6">
                  <p className="font-heading text-[7px] text-pixel-text-dim mb-3 text-center tracking-wider">
                    PASSAGE LENGTH
                  </p>
                  <div className="flex gap-2 justify-center">
                    {(["short", "medium", "long"] as const).map((d) => (
                      <button
                        key={d}
                        onClick={() => setSelectedLength(d)}
                        className={`font-heading text-[7px] px-4 py-2 transition-all ${
                          selectedLength === d
                            ? "pixel-select-active"
                            : "pixel-select"
                        }`}
                      >
                        {d.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Start button — arcade style */}
                <div className="text-center">
                  <button
                    onClick={() => race.startRace(selectedLength, false)}
                    className="pixel-btn font-heading text-[10px] px-10 py-3 text-pixel-black animate-pulse-glow"
                  >
                    ▶ START RACE
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Loading */}
          {race.isLoading && (
            <div className="flex flex-col items-center mt-12">
              <p className="font-heading text-pixel-bird-yellow text-[10px] animate-pulse text-glow-yellow">
                LOADING RACE...
              </p>
              <div className="mt-4 w-48 h-2 bg-pixel-navy overflow-hidden">
                <div className="h-full bg-pixel-text-green animate-pulse" style={{ width: "60%" }} />
              </div>
            </div>
          )}

          {/* Results — below canvas when overlay is dismissed */}
          {race.result && !resultOverlay && (
            <div className="mt-4 max-w-md mx-auto">
              <RaceResultsPanel
                result={race.result}
                isSignedIn={!!user}
                onRaceAgain={() => race.startRace(selectedLength, true)}
                onNewRace={() => race.startRace(selectedLength, false)}
              />
            </div>
          )}
        </div>
      </main>
    </>
  );
}
