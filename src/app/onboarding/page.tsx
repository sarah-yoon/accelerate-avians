"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

const BIRDS = [
  {
    id: "robin",
    label: "Robin",
    color: "#E74C3C",
    desc: "Swift & steady",
  },
  {
    id: "canary",
    label: "Canary",
    color: "#FFD700",
    desc: "Quick & nimble",
  },
  {
    id: "bluebird",
    label: "Bluebird",
    color: "#3498DB",
    desc: "Cool & precise",
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [selectedBird, setSelectedBird] = useState("robin");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const res = await fetch("/api/profile/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, displayBird: selectedBird }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Something went wrong");
        return;
      }

      router.push("/play");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden flex flex-col items-center justify-center">
      {/* Background - fighting game character select vibes */}
      <div className="absolute inset-0 sky-bg" />

      {/* Animated clouds */}
      <div
        className="pixel-cloud animate-cloud-1"
        style={{ top: "10%", left: "-100px" }}
      />
      <div
        className="pixel-cloud pixel-cloud-lg animate-cloud-2"
        style={{ top: "18%", right: "-100px" }}
      />

      {/* Grass ground */}
      <div className="pixel-grass-strip z-[1]" />

      {/* Content */}
      <div className="relative z-10 w-full max-w-xl p-4 pb-24">
        {/* Title */}
        <div className="text-center mb-6 animate-bounce-in">
          <h1 className="font-heading text-pixel-bird-yellow text-lg md:text-xl text-glow-yellow mb-2">
            CHOOSE YOUR AVIAN!
          </h1>
          <p className="font-mono text-pixel-navy text-sm text-shadow-hard">
            Select your racer and enter the skies
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Character select panel */}
          <div className="pixel-panel-gold p-6 mb-6">
            {/* Username input */}
            <div className="mb-6">
              <label className="block font-heading text-[10px] text-pixel-bird-yellow mb-2 tracking-wider">
                PLAYER NAME
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-pixel-black border-4 border-pixel-text-dim text-pixel-text-white font-mono p-3 focus:border-pixel-bird-yellow outline-none text-sm transition-colors"
                placeholder="cool_birder"
                minLength={3}
                maxLength={20}
                pattern="[a-zA-Z0-9_]+"
                required
                style={{
                  boxShadow: "inset 0 2px 4px rgba(0,0,0,0.5)",
                }}
              />
            </div>

            {/* Bird selection — character select cards */}
            <label className="block font-heading text-[10px] text-pixel-bird-yellow mb-4 tracking-wider">
              SELECT YOUR BIRD
            </label>
            <div className="grid grid-cols-3 gap-4 mb-6">
              {BIRDS.map((bird) => {
                const isSelected = selectedBird === bird.id;
                return (
                  <button
                    key={bird.id}
                    type="button"
                    onClick={() => setSelectedBird(bird.id)}
                    className={`relative p-4 transition-all text-center ${
                      isSelected
                        ? "pixel-select-active scale-105"
                        : "pixel-select hover:scale-102"
                    }`}
                    style={
                      isSelected
                        ? {
                            borderColor: bird.color,
                            boxShadow: `inset 0 2px 0 0 rgba(255,255,255,0.1), inset 0 -2px 0 0 rgba(0,0,0,0.2), 0 0 12px ${bird.color}60`,
                          }
                        : undefined
                    }
                  >
                    {/* Selected indicator */}
                    {isSelected && (
                      <div
                        className="absolute -top-2 left-1/2 -translate-x-1/2 font-heading text-[8px] px-2 py-0.5"
                        style={{
                          backgroundColor: bird.color,
                          color: "#0A0A14",
                        }}
                      >
                        ★
                      </div>
                    )}

                    {/* Bird sprite */}
                    <div
                      className={`mx-auto mb-3 ${
                        isSelected ? "animate-float" : ""
                      }`}
                    >
                      <Image
                        src={`/sprites/${bird.id}.png`}
                        alt={bird.label}
                        width={48}
                        height={48}
                        className="block mx-auto"
                        style={{ imageRendering: "pixelated" }}
                      />
                    </div>

                    {/* Bird name */}
                    <span
                      className={`font-heading text-[10px] block mb-1 ${
                        isSelected ? "text-pixel-text-white" : "text-pixel-text-dim"
                      }`}
                      style={isSelected ? { color: bird.color } : undefined}
                    >
                      {bird.label}
                    </span>

                    {/* Bird description */}
                    <span className="font-mono text-[10px] text-pixel-text-dim block">
                      {bird.desc}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Selected bird preview */}
            <div className="text-center mb-4 py-3 bg-pixel-black/30 border-2 border-pixel-text-dim/30">
              <p className="font-heading text-[8px] text-pixel-text-dim mb-2">
                YOUR RACER
              </p>
              <div className="animate-float inline-block">
                <Image
                  src={`/sprites/${selectedBird}.png`}
                  alt={selectedBird}
                  width={64}
                  height={64}
                  className="mx-auto"
                  style={{ imageRendering: "pixelated" }}
                />
              </div>
              <p
                className="font-heading text-sm mt-2"
                style={{
                  color:
                    BIRDS.find((b) => b.id === selectedBird)?.color ?? "#E8E8E8",
                }}
              >
                {BIRDS.find((b) => b.id === selectedBird)?.label}
              </p>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="pixel-panel p-3 mb-4 border-pixel-bird-red text-center">
              <p className="text-pixel-bird-red font-mono text-sm">{error}</p>
            </div>
          )}

          {/* Submit button */}
          <div className="text-center">
            <button
              type="submit"
              disabled={submitting}
              className="pixel-btn animate-pulse-glow font-heading text-sm px-12 py-4 text-pixel-black tracking-wider disabled:opacity-50 disabled:animate-none"
            >
              {submitting ? "SAVING..." : "LET'S RACE!"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
