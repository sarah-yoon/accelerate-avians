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

      <main className="hidden md:flex flex-col items-center min-h-screen bg-pixel-black p-4">
        {/* Header */}
        <div className="w-full max-w-[960px] flex justify-between items-center mb-4">
          <Link
            href="/"
            className="font-heading text-pixel-bird-yellow text-xs hover:text-pixel-bird-orange"
          >
            Accelerate Avians
          </Link>
          <div className="flex gap-4">
            {user ? (
              <Link
                href="/profile"
                className="font-heading text-[10px] text-pixel-text-white hover:text-pixel-bird-yellow"
              >
                Profile
              </Link>
            ) : (
              <Link
                href="/sign-in"
                className="font-heading text-[10px] text-pixel-text-white hover:text-pixel-bird-yellow"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>

        {/* Race area */}
        <div className="w-full max-w-[960px]">
          {/* Canvas */}
          {race.passage && (
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
          )}

          {/* Typing area */}
          {race.passage && (
            <div className="mt-4">
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

          {/* Idle state — settings + start button */}
          {race.phase === "idle" && !race.isLoading && !race.result && (
            <div className="flex flex-col items-center mt-8">
              {/* Passage length selector */}
              <div className="mb-6">
                <p className="font-heading text-[8px] text-pixel-text-dim mb-2 text-center">
                  PASSAGE LENGTH
                </p>
                <div className="flex gap-2">
                  {(["short", "medium", "long"] as const).map((d) => (
                    <button
                      key={d}
                      onClick={() => setSelectedLength(d)}
                      className={`font-heading text-[8px] px-4 py-2 border ${
                        selectedLength === d
                          ? "border-pixel-bird-yellow text-pixel-bird-yellow bg-pixel-navy"
                          : "border-pixel-text-dim text-pixel-text-dim hover:text-pixel-text-white"
                      }`}
                    >
                      {d.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Bot difficulty selector */}
              <div className="mb-8">
                <p className="font-heading text-[8px] text-pixel-text-dim mb-2 text-center">
                  BOT DIFFICULTY
                </p>
                <div className="flex gap-2">
                  {(["easy", "medium", "hard"] as const).map((d) => (
                    <button
                      key={d}
                      onClick={() => setSelectedBotDifficulty(d)}
                      className={`font-heading text-[8px] px-4 py-2 border ${
                        selectedBotDifficulty === d
                          ? d === "easy"
                            ? "border-pixel-text-green text-pixel-text-green bg-pixel-navy"
                            : d === "medium"
                            ? "border-pixel-bird-yellow text-pixel-bird-yellow bg-pixel-navy"
                            : "border-pixel-bird-red text-pixel-bird-red bg-pixel-navy"
                          : "border-pixel-text-dim text-pixel-text-dim hover:text-pixel-text-white"
                      }`}
                    >
                      {d.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Start button */}
              <button
                onClick={() => race.startRace(selectedLength, false, selectedBotDifficulty)}
                className="bg-pixel-grass text-pixel-black font-heading text-sm px-8 py-4 hover:bg-pixel-text-green"
              >
                Start Race
              </button>
            </div>
          )}

          {/* Loading state */}
          {race.isLoading && (
            <div className="flex justify-center mt-8">
              <p className="font-heading text-pixel-text-dim text-xs animate-pulse">
                Finding a passage...
              </p>
            </div>
          )}

          {/* Results */}
          {race.result && (
            <div className="bg-pixel-panel border-2 border-pixel-text-dim p-6 mt-4">
              <h2 className="font-heading text-pixel-bird-yellow text-sm mb-4 text-center">
                Race Complete!
              </h2>
              <div className="grid grid-cols-2 gap-4 text-center mb-6">
                <div>
                  <p className="font-heading text-[10px] text-pixel-text-dim mb-1">WPM</p>
                  <p className="font-heading text-lg text-pixel-text-green">{race.result.wpm}</p>
                </div>
                <div>
                  <p className="font-heading text-[10px] text-pixel-text-dim mb-1">Accuracy</p>
                  <p className="font-heading text-lg text-pixel-text-white">
                    {Math.round(race.result.accuracy * 100)}%
                  </p>
                </div>
                <div>
                  <p className="font-heading text-[10px] text-pixel-text-dim mb-1">Placement</p>
                  <p className="font-heading text-lg text-pixel-bird-yellow">
                    {race.result.placement}/{race.result.totalRacers}
                  </p>
                </div>
                <div>
                  <p className="font-heading text-[10px] text-pixel-text-dim mb-1">Status</p>
                  <p className="font-heading text-sm text-pixel-text-white">
                    {!user && "Sign in to save"}
                    {user && (race.result.isPersonalBest ? "New PB!" : "Saved")}
                  </p>
                </div>
              </div>
              <div className="flex gap-4 justify-center">
                <button
                  onClick={() => race.startRace(selectedLength, true, selectedBotDifficulty)}
                  className="bg-pixel-grass text-pixel-black font-heading text-[10px] px-6 py-3 hover:bg-pixel-text-green"
                >
                  Race Again
                </button>
                <button
                  onClick={() => race.startRace(selectedLength, false, selectedBotDifficulty)}
                  className="bg-pixel-panel border border-pixel-text-dim text-pixel-text-white font-heading text-[10px] px-6 py-3 hover:border-pixel-bird-yellow"
                >
                  New Bird
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
