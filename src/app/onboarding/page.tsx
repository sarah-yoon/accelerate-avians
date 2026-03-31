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
    <main className="flex min-h-screen flex-col items-center justify-center bg-pixel-black p-4">
      <h1 className="font-heading text-pixel-bird-yellow text-lg mb-8">
        Welcome, Avian!
      </h1>
      <form onSubmit={handleSubmit} className="bg-pixel-panel border-2 border-pixel-text-dim p-8 max-w-md w-full">
        <label className="block font-heading text-xs text-pixel-text-white mb-2">Username</label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full bg-pixel-black border-2 border-pixel-text-dim text-pixel-text-white font-typing p-2 mb-6 focus:border-pixel-bird-yellow outline-none"
          placeholder="cool_birder"
          minLength={3}
          maxLength={20}
          pattern="[a-zA-Z0-9_]+"
          required
        />

        <label className="block font-heading text-xs text-pixel-text-white mb-2">Choose Your Bird</label>
        <div className="flex gap-4 mb-6">
          {BIRDS.map((bird) => (
            <button
              key={bird.id}
              type="button"
              onClick={() => setSelectedBird(bird.id)}
              className={`p-2 border-2 ${selectedBird === bird.id ? bird.color + " bg-pixel-navy" : "border-pixel-text-dim"}`}
              style={{ imageRendering: "pixelated" }}
            >
              <Image src={`/sprites/${bird.id}.png`} alt={bird.label} width={32} height={32} className="block" style={{ imageRendering: "pixelated" }} />
              <span className="font-heading text-[8px] text-pixel-text-white mt-1 block text-center">{bird.label}</span>
            </button>
          ))}
        </div>

        {error && <p className="text-pixel-bird-red font-typing text-sm mb-4">{error}</p>}

        <button type="submit" disabled={submitting} className="w-full bg-pixel-grass text-pixel-black font-heading text-xs py-3 hover:bg-pixel-text-green disabled:opacity-50">
          {submitting ? "Saving..." : "Let's Race!"}
        </button>
      </form>
    </main>
  );
}
