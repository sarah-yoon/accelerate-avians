"use client";

import type { RaceResult } from "@/types";

interface RaceResultsPanelProps {
  result: RaceResult;
  isSignedIn: boolean;
  onRaceAgain: () => void;
  onNewRace: () => void;
  onClose?: () => void;
}

export function RaceResultsPanel({
  result,
  isSignedIn,
  onRaceAgain,
  onNewRace,
  onClose,
}: RaceResultsPanelProps) {
  return (
    <div className="pixel-panel-gold p-6 max-w-sm w-full relative">
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-2 right-3 font-heading text-[10px] text-pixel-text-dim hover:text-pixel-bird-yellow"
        >
          ✕
        </button>
      )}
      <h2 className="font-heading text-pixel-bird-yellow text-xs mb-2 text-center text-glow-yellow">
        RACE COMPLETE!
      </h2>
      <div className="game-divider mb-4" />

      <div className="grid grid-cols-2 gap-4 text-center mb-6">
        <div className="bg-pixel-navy p-3">
          <p className="font-heading text-[7px] text-pixel-text-dim mb-2">WPM</p>
          <p className="font-heading text-2xl text-pixel-text-green text-glow-green">{result.wpm}</p>
        </div>
        <div className="bg-pixel-navy p-3">
          <p className="font-heading text-[7px] text-pixel-text-dim mb-2">ACCURACY</p>
          <p className="font-heading text-2xl text-pixel-text-white">
            {Math.round(result.accuracy * 100)}%
          </p>
        </div>
        <div className="bg-pixel-navy p-3">
          <p className="font-heading text-[7px] text-pixel-text-dim mb-2">PLACE</p>
          <p className="font-heading text-2xl text-pixel-bird-yellow">
            {result.placement}/{result.totalRacers}
          </p>
        </div>
        <div className="bg-pixel-navy p-3">
          <p className="font-heading text-[7px] text-pixel-text-dim mb-2">STATUS</p>
          <p className={`font-heading text-sm ${result.isPersonalBest ? "text-pixel-bird-yellow text-glow-yellow" : "text-pixel-text-white"}`}>
            {!isSignedIn && "Sign in to save"}
            {isSignedIn && (result.isPersonalBest ? "NEW PB!" : "Saved")}
          </p>
        </div>
      </div>

      <div className="flex gap-3 justify-center">
        <button
          onClick={onRaceAgain}
          className="pixel-btn font-heading text-[8px] px-6 py-2 text-pixel-black"
        >
          RACE AGAIN
        </button>
        <button
          onClick={onNewRace}
          className="pixel-btn-yellow pixel-btn font-heading text-[8px] px-6 py-2 text-pixel-black"
        >
          NEW RACE
        </button>
      </div>
    </div>
  );
}
