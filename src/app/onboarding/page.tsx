"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function OnboardingPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
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
        body: JSON.stringify({ username }),
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
    <main className="game-screen">
      <div className="w-full max-w-sm animate-slide-up">
        <h1 className="font-heading text-pixel-bird-yellow text-sm text-center mb-1 text-glow-yellow">
          WELCOME
        </h1>
        <p className="text-pixel-text-dim text-[8px] text-center mb-8 font-heading tracking-wider">
          — CHOOSE A USERNAME —
        </p>

        <form onSubmit={handleSubmit}>
          <div className="pixel-panel p-6 mb-6">
            <label className="block font-heading text-[8px] text-pixel-text-dim mb-3 text-center tracking-wider">
              ENTER YOUR NAME
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-heading text-pixel-bird-yellow text-[10px] animate-blink">
                ▶
              </span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-pixel-black border-2 border-pixel-text-dim text-pixel-text-white p-3 pl-8 focus:border-pixel-bird-yellow outline-none text-sm font-mono tracking-wider"
                placeholder="cool_birder"
                minLength={3}
                maxLength={20}
                pattern="[a-zA-Z0-9_]+"
                required
              />
            </div>
            <p className="font-heading text-[6px] text-pixel-text-dim mt-2 text-center">
              3-20 CHARS • LETTERS, NUMBERS, UNDERSCORES
            </p>
          </div>

          {error && (
            <p className="text-pixel-bird-red text-xs mb-4 text-center font-heading text-[8px]">{error}</p>
          )}

          <div className="text-center">
            <button
              type="submit"
              disabled={submitting}
              className="pixel-btn font-heading text-[10px] px-12 py-3 text-pixel-black disabled:opacity-50 animate-pulse-glow"
            >
              {submitting ? "CHECKING..." : "READY!"}
            </button>
          </div>
        </form>

        <p className="font-heading text-[6px] text-pixel-text-dim text-center mt-6 animate-blink">
          PRESS READY TO CONTINUE
        </p>
      </div>
    </main>
  );
}
