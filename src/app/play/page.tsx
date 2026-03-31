"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useRace } from "@/hooks/useRace";
import { RaceCanvas } from "@/components/race/RaceCanvas";
import { TypingArea } from "@/components/typing/TypingArea";
import { MobileInterstitial } from "@/components/MobileInterstitial";
import Link from "next/link";
import type { Difficulty } from "@/types";

type BotDifficulty = "easy" | "medium" | "hard";

export default function PlayPage() {
  const { user } = useUser();
  const race = useRace(user?.id);
  const [selectedLength, setSelectedLength] = useState<Difficulty>("medium");
  const [selectedBotDifficulty, setSelectedBotDifficulty] = useState<BotDifficulty>("easy");

  return (
    <>
      <MobileInterstitial />

      <main className="hidden md:flex flex-col items-center min-h-screen bg-pixel-black p-6">
        {/* Header */}
        <div className="w-full max-w-[900px] flex justify-between items-center mb-6">
          <Link
            href="/"
            className="font-heading text-pixel-bird-yellow text-[10px] hover:text-pixel-bird-orange"
          >
            ← Home
          </Link>
          <span className="font-heading text-pixel-text-white text-[10px]">
            Accelerate Avians
          </span>
          <div className="flex gap-4">
            {user ? (
              <Link href="/profile" className="font-heading text-[8px] text-pixel-text-dim hover:text-pixel-bird-yellow">
                Profile
              </Link>
            ) : (
              <Link href="/sign-in" className="font-heading text-[8px] text-pixel-text-dim hover:text-pixel-bird-yellow">
                Sign In
              </Link>
            )}
          </div>
        </div>

        {/* Race area */}
        <div className="w-full max-w-[900px]">
          {/* Canvas */}
          {race.passage && (
            <div className="mb-4">
              <RaceCanvas
                phase={race.phase}
                countdownValue={race.countdownValue}
                playerProgress={race.playerProgress}
                playerBird="robin"
                playerUsername={user?.username ?? "Guest"}
                ghosts={race.ghosts}
                totalChars={race.passage.charCount}
                raceStartTime={race.raceStartTime}
              />
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

          {/* Race setup */}
          {race.phase === "idle" && !race.isLoading && !race.result && (
            <div className="flex flex-col items-center mt-6">
              <div className="pixel-panel p-8 w-full max-w-md">
                <h2 className="font-heading text-pixel-bird-yellow text-[10px] text-center mb-8">
                  RACE SETUP
                </h2>

                {/* Passage length */}
                <div className="mb-6">
                  <p className="font-heading text-[7px] text-pixel-text-dim mb-3 text-center">
                    PASSAGE LENGTH
                  </p>
                  <div className="flex gap-2 justify-center">
                    {(["short", "medium", "long"] as const).map((d) => (
                      <button
                        key={d}
                        onClick={() => setSelectedLength(d)}
                        className={`font-heading text-[7px] px-4 py-2 border-2 transition-all ${
                          selectedLength === d
                            ? "border-pixel-bird-yellow text-pixel-bird-yellow bg-pixel-navy"
                            : "border-pixel-text-dim text-pixel-text-dim hover:text-pixel-text-white hover:border-pixel-text-white"
                        }`}
                      >
                        {d.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Bot difficulty */}
                <div className="mb-8">
                  <p className="font-heading text-[7px] text-pixel-text-dim mb-3 text-center">
                    BOT DIFFICULTY
                  </p>
                  <div className="flex gap-2 justify-center">
                    {(["easy", "medium", "hard"] as const).map((d) => {
                      const colors = {
                        easy: { active: "border-pixel-text-green text-pixel-text-green", label: "EASY" },
                        medium: { active: "border-pixel-bird-yellow text-pixel-bird-yellow", label: "MEDIUM" },
                        hard: { active: "border-pixel-bird-red text-pixel-bird-red", label: "HARD" },
                      };
                      return (
                        <button
                          key={d}
                          onClick={() => setSelectedBotDifficulty(d)}
                          className={`font-heading text-[7px] px-4 py-2 border-2 transition-all ${
                            selectedBotDifficulty === d
                              ? `${colors[d].active} bg-pixel-navy`
                              : "border-pixel-text-dim text-pixel-text-dim hover:text-pixel-text-white hover:border-pixel-text-white"
                          }`}
                        >
                          {colors[d].label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Start button */}
                <div className="text-center">
                  <button
                    onClick={() => race.startRace(selectedLength, false, selectedBotDifficulty)}
                    className="pixel-btn font-heading text-[10px] px-10 py-3 text-pixel-black"
                  >
                    START RACE
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Loading */}
          {race.isLoading && (
            <div className="flex justify-center mt-12">
              <p className="font-heading text-pixel-text-dim text-[10px] animate-pulse">
                Finding a passage...
              </p>
            </div>
          )}

          {/* Results */}
          {race.result && (
            <div className="pixel-panel p-6 mt-4 max-w-md mx-auto">
              <h2 className="font-heading text-pixel-bird-yellow text-[10px] mb-6 text-center">
                RACE COMPLETE
              </h2>
              <div className="grid grid-cols-2 gap-6 text-center mb-8">
                <div>
                  <p className="font-heading text-[7px] text-pixel-text-dim mb-2">WPM</p>
                  <p className="font-heading text-xl text-pixel-text-green">{race.result.wpm}</p>
                </div>
                <div>
                  <p className="font-heading text-[7px] text-pixel-text-dim mb-2">ACCURACY</p>
                  <p className="font-heading text-xl text-pixel-text-white">
                    {Math.round(race.result.accuracy * 100)}%
                  </p>
                </div>
                <div>
                  <p className="font-heading text-[7px] text-pixel-text-dim mb-2">PLACE</p>
                  <p className="font-heading text-xl text-pixel-bird-yellow">
                    {race.result.placement}/{race.result.totalRacers}
                  </p>
                </div>
                <div>
                  <p className="font-heading text-[7px] text-pixel-text-dim mb-2">STATUS</p>
                  <p className="font-heading text-sm text-pixel-text-white">
                    {!user && "Sign in to save"}
                    {user && (race.result.isPersonalBest ? "New PB!" : "Saved")}
                  </p>
                </div>
              </div>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => race.startRace(selectedLength, true, selectedBotDifficulty)}
                  className="pixel-btn font-heading text-[8px] px-6 py-2 text-pixel-black"
                >
                  RACE AGAIN
                </button>
                <button
                  onClick={() => race.startRace(selectedLength, false, selectedBotDifficulty)}
                  className="font-heading text-[8px] px-6 py-2 border-2 border-pixel-text-dim text-pixel-text-white hover:border-pixel-bird-yellow"
                >
                  NEW BIRD
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
