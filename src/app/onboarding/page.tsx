"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

const BIRDS = [
  { id: "robin", label: "Robin", color: "border-pixel-bird-red" },
  { id: "canary", label: "Canary", color: "border-pixel-bird-yellow" },
  { id: "bluebird", label: "Bluebird", color: "border-pixel-bird-blue" },
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
    <main className="flex min-h-screen flex-col items-center justify-center bg-pixel-black px-6 py-8">
      <h1 className="font-heading text-pixel-bird-yellow text-sm mb-2">
        CHOOSE YOUR BIRD
      </h1>
      <p className="text-pixel-text-dim text-xs mb-8">Pick a name and a bird to race with</p>

      <form onSubmit={handleSubmit} className="pixel-panel p-8 w-full max-w-sm">
        {/* Username */}
        <label className="block font-heading text-[7px] text-pixel-text-dim mb-2">USERNAME</label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full bg-pixel-black border-2 border-pixel-text-dim text-pixel-text-white p-3 mb-6 focus:border-pixel-bird-yellow outline-none text-sm"
          placeholder="cool_birder"
          minLength={3}
          maxLength={20}
          pattern="[a-zA-Z0-9_]+"
          required
        />

        {/* Bird selection */}
        <label className="block font-heading text-[7px] text-pixel-text-dim mb-3">SELECT BIRD</label>
        <div className="flex gap-4 mb-6 justify-center">
          {BIRDS.map((bird) => (
            <button
              key={bird.id}
              type="button"
              onClick={() => setSelectedBird(bird.id)}
              className={`p-3 border-2 transition-all ${
                selectedBird === bird.id
                  ? `${bird.color} bg-pixel-navy scale-110`
                  : "border-pixel-text-dim hover:border-pixel-text-white"
              }`}
              style={{ imageRendering: "pixelated" }}
            >
              <Image
                src={`/sprites/${bird.id}.png`}
                alt={bird.label}
                width={40}
                height={40}
                className="block"
                style={{ imageRendering: "pixelated" }}
              />
              <span className="font-heading text-[6px] text-pixel-text-white mt-2 block text-center">
                {bird.label}
              </span>
            </button>
          ))}
        </div>

        {error && (
          <p className="text-pixel-bird-red text-xs mb-4 text-center">{error}</p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full pixel-btn font-heading text-[8px] py-3 text-pixel-black disabled:opacity-50"
        >
          {submitting ? "SAVING..." : "LET'S RACE!"}
        </button>
      </form>
    </main>
  );
}
