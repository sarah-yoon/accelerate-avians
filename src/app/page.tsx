import Link from "next/link";
import { prisma } from "@/lib/prisma";

async function getLeaderboardPreview() {
  try {
    const scores = await prisma.score.findMany({
      where: {
        user: { clerkId: { not: { startsWith: "bot_" } } },
      },
      orderBy: { wpm: "desc" },
      take: 5,
      distinct: ["userId"],
      include: {
        user: { select: { username: true, displayBird: true } },
      },
    });
    return scores;
  } catch {
    return [];
  }
}

export default async function LandingPage() {
  const topScores = await getLeaderboardPreview();

  return (
    <main className="relative min-h-screen overflow-hidden sky-bg">
      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6 py-16">

        {/* Title */}
        <h1 className="font-heading text-pixel-bird-yellow text-xl md:text-3xl text-center text-glow-yellow mb-1">
          Accelerate
        </h1>
        <h1 className="font-heading text-pixel-text-white text-xl md:text-3xl text-center text-shadow-hard mb-4">
          Avians
        </h1>

        <p className="text-pixel-navy text-sm mb-12 text-shadow-hard opacity-70">
          Type fast. Fly faster.
        </p>

        {/* Bird sprites */}
        <div className="flex gap-6 mb-10">
          {["robin", "canary", "bluebird"].map((bird, i) => (
            <div key={bird} className="animate-float" style={{ animationDelay: `${i * 0.4}s` }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/sprites/${bird}.png`}
                alt={bird}
                className="w-12 h-12"
                style={{ imageRendering: "pixelated" }}
              />
            </div>
          ))}
        </div>

        {/* Play button */}
        <Link
          href="/play"
          className="pixel-btn font-heading text-sm px-12 py-4 mb-16 inline-block text-pixel-black tracking-wider animate-pulse-glow"
        >
          PLAY
        </Link>

        {/* Leaderboard preview */}
        {topScores.length > 0 && (
          <div className="w-full max-w-sm">
            <h2 className="font-heading text-pixel-bird-yellow text-[10px] text-center mb-3">
              HIGH SCORES
            </h2>
            <div className="pixel-panel p-4">
              {topScores.map((score, i) => {
                const rankColor =
                  i === 0 ? "text-pixel-gold" : i === 1 ? "text-pixel-silver" : i === 2 ? "text-pixel-bronze" : "text-pixel-text-dim";
                return (
                  <div
                    key={score.id}
                    className="flex justify-between items-center py-2 border-b border-pixel-text-dim/20 last:border-b-0"
                  >
                    <div className="flex items-center gap-3">
                      <span className={`font-heading text-[10px] ${rankColor} w-4`}>
                        {i + 1}
                      </span>
                      <span className="text-pixel-text-white text-sm">
                        {score.user.username}
                      </span>
                    </div>
                    <span className="font-heading text-[10px] text-pixel-text-green">
                      {score.wpm} WPM
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="text-center mt-3">
              <Link
                href="/leaderboard"
                className="font-heading text-[8px] text-pixel-text-dim hover:text-pixel-bird-yellow"
              >
                View Full Leaderboard
              </Link>
            </div>
          </div>
        )}

        {/* Nav */}
        <nav className="flex gap-6 mt-10">
          <Link href="/sign-in" className="font-heading text-[8px] text-pixel-text-dim hover:text-pixel-text-white">
            Sign In
          </Link>
          <Link href="/leaderboard" className="font-heading text-[8px] text-pixel-text-dim hover:text-pixel-text-white">
            Leaderboard
          </Link>
        </nav>
      </div>
    </main>
  );
}
