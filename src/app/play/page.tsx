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
  const [selectedBotDifficulty, setSelectedBotDifficulty] =
    useState<BotDifficulty>("easy");

  return (
    <>
      <MobileInterstitial />

      <main className="hidden md:flex flex-col items-center min-h-screen relative overflow-hidden">
        {/* Sky background */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, #1A1A2E 0%, #2A2A3E 40%, #3a3a5e 100%)",
          }}
        />

        {/* Subtle stars */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-pixel-text-white rounded-none animate-sparkle"
              style={{
                top: `${5 + (i * 37) % 60}%`,
                left: `${(i * 53) % 100}%`,
                animationDelay: `${(i * 0.3) % 3}s`,
                opacity: 0.4,
              }}
            />
          ))}
        </div>

        <div className="relative z-10 w-full p-4">
          {/* HUD Header */}
          <div className="w-full max-w-[960px] mx-auto game-hud px-4 py-3 mb-6 flex justify-between items-center">
            <Link
              href="/"
              className="font-heading text-pixel-bird-yellow text-xs hover:text-pixel-bird-orange text-glow-yellow"
            >
              Accelerate Avians
            </Link>
            <div className="flex gap-4 items-center">
              <Link
                href="/leaderboard"
                className="font-heading text-[10px] text-pixel-text-dim hover:text-pixel-bird-yellow"
              >
                Scores
              </Link>
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
          <div className="w-full max-w-[960px] mx-auto">
            {/* Canvas */}
            {race.passage && (
              <div className="pixel-panel p-2 mb-4">
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
              <div className="mt-4 pixel-panel p-4">
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

            {/* Idle state — game menu style settings */}
            {race.phase === "idle" && !race.isLoading && !race.result && (
              <div className="flex flex-col items-center mt-8 animate-slide-up">
                {/* Menu panel */}
                <div className="pixel-panel-gold p-8 w-full max-w-lg">
                  <h2 className="font-heading text-pixel-bird-yellow text-sm text-center mb-6 text-glow-yellow">
                    RACE SETUP
                  </h2>

                  {/* Passage length selector */}
                  <div className="mb-6">
                    <p className="font-heading text-[8px] text-pixel-text-dim mb-3 text-center tracking-widest">
                      PASSAGE LENGTH
                    </p>
                    <div className="flex gap-3 justify-center">
                      {(["short", "medium", "long"] as const).map((d) => (
                        <button
                          key={d}
                          onClick={() => setSelectedLength(d)}
                          className={`font-heading text-[8px] px-5 py-3 transition-all ${
                            selectedLength === d
                              ? "pixel-select-active text-pixel-bird-yellow"
                              : "pixel-select text-pixel-text-dim hover:text-pixel-text-white"
                          }`}
                        >
                          {d.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Bot difficulty selector */}
                  <div className="mb-8">
                    <p className="font-heading text-[8px] text-pixel-text-dim mb-3 text-center tracking-widest">
                      BOT DIFFICULTY
                    </p>
                    <div className="flex gap-3 justify-center">
                      {(["easy", "medium", "hard"] as const).map((d) => {
                        const activeColor =
                          d === "easy"
                            ? "text-pixel-text-green"
                            : d === "medium"
                            ? "text-pixel-bird-yellow"
                            : "text-pixel-bird-red";
                        const activeBorder =
                          d === "easy"
                            ? "border-pixel-text-green"
                            : d === "medium"
                            ? "border-pixel-bird-yellow"
                            : "border-pixel-bird-red";
                        const activeGlow =
                          d === "easy"
                            ? "text-glow-green"
                            : d === "medium"
                            ? "text-glow-yellow"
                            : "text-glow-red";
                        return (
                          <button
                            key={d}
                            onClick={() => setSelectedBotDifficulty(d)}
                            className={`font-heading text-[8px] px-5 py-3 transition-all ${
                              selectedBotDifficulty === d
                                ? `pixel-select-active ${activeBorder} ${activeColor} ${activeGlow}`
                                : "pixel-select text-pixel-text-dim hover:text-pixel-text-white"
                            }`}
                            style={
                              selectedBotDifficulty === d
                                ? {
                                    borderColor:
                                      d === "easy"
                                        ? "#66BB6A"
                                        : d === "medium"
                                        ? "#FFD700"
                                        : "#E74C3C",
                                  }
                                : undefined
                            }
                          >
                            {d.toUpperCase()}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Start button - large arcade style */}
                  <div className="flex justify-center">
                    <button
                      onClick={() =>
                        race.startRace(
                          selectedLength,
                          false,
                          selectedBotDifficulty
                        )
                      }
                      className="pixel-btn animate-pulse-glow font-heading text-sm md:text-base px-10 py-4 text-pixel-black tracking-wider"
                    >
                      START RACE
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Loading state */}
            {race.isLoading && (
              <div className="flex flex-col items-center justify-center mt-8">
                <div className="pixel-panel p-8 text-center">
                  <div className="animate-float mb-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/sprites/robin.png"
                      alt="Loading"
                      className="w-10 h-10 mx-auto"
                      style={{ imageRendering: "pixelated" }}
                    />
                  </div>
                  <p className="font-heading text-pixel-text-dim text-xs animate-pulse">
                    Finding a passage...
                  </p>
                </div>
              </div>
            )}

            {/* Results — Victory/Defeat screen */}
            {race.result && (
              <div className="mt-4 animate-bounce-in">
                <div className="pixel-panel-gold p-8">
                  {/* Victory header */}
                  <div className="text-center mb-6">
                    <h2 className="font-heading text-pixel-bird-yellow text-lg mb-2 text-glow-yellow">
                      {race.result.placement === 1
                        ? "VICTORY!"
                        : "RACE COMPLETE!"}
                    </h2>
                    {race.result.placement === 1 && (
                      <div className="flex justify-center gap-2">
                        <span className="animate-sparkle text-xl">★</span>
                        <span
                          className="animate-sparkle text-xl"
                          style={{ animationDelay: "0.3s" }}
                        >
                          ★
                        </span>
                        <span
                          className="animate-sparkle text-xl"
                          style={{ animationDelay: "0.6s" }}
                        >
                          ★
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Stats grid */}
                  <div className="grid grid-cols-2 gap-4 text-center mb-6">
                    <div className="pixel-panel p-4">
                      <p className="font-heading text-[8px] text-pixel-text-dim mb-2">
                        WPM
                      </p>
                      <p className="font-heading text-2xl text-pixel-text-green text-glow-green">
                        {race.result.wpm}
                      </p>
                    </div>
                    <div className="pixel-panel p-4">
                      <p className="font-heading text-[8px] text-pixel-text-dim mb-2">
                        ACCURACY
                      </p>
                      <p className="font-heading text-2xl text-pixel-text-white">
                        {Math.round(race.result.accuracy * 100)}%
                      </p>
                    </div>
                    <div className="pixel-panel p-4">
                      <p className="font-heading text-[8px] text-pixel-text-dim mb-2">
                        PLACEMENT
                      </p>
                      <p className="font-heading text-2xl text-pixel-bird-yellow text-glow-yellow">
                        {race.result.placement}/{race.result.totalRacers}
                      </p>
                    </div>
                    <div className="pixel-panel p-4">
                      <p className="font-heading text-[8px] text-pixel-text-dim mb-2">
                        STATUS
                      </p>
                      <p className="font-heading text-sm text-pixel-text-white mt-2">
                        {!user && "Sign in to save"}
                        {user &&
                          (race.result.isPersonalBest ? (
                            <span className="text-pixel-bird-yellow text-glow-yellow animate-pulse">
                              NEW PB!
                            </span>
                          ) : (
                            "Saved"
                          ))}
                      </p>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-4 justify-center">
                    <button
                      onClick={() =>
                        race.startRace(
                          selectedLength,
                          true,
                          selectedBotDifficulty
                        )
                      }
                      className="pixel-btn font-heading text-[10px] px-8 py-3 text-pixel-black"
                    >
                      Race Again
                    </button>
                    <button
                      onClick={() =>
                        race.startRace(
                          selectedLength,
                          false,
                          selectedBotDifficulty
                        )
                      }
                      className="pixel-btn pixel-btn-yellow font-heading text-[10px] px-8 py-3 text-pixel-black"
                    >
                      New Passage
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
