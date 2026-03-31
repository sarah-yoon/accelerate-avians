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
    <main className="flex flex-col items-center justify-center min-h-screen bg-pixel-black p-4">
      {/* Title */}
      <h1 className="font-heading text-pixel-bird-yellow text-xl md:text-2xl text-center mb-2">
        Accelerate Avians
      </h1>
      <p className="font-typing text-pixel-text-dim text-sm mb-12">
        A pixel art bird typing racer
      </p>

      {/* Play button */}
      <Link
        href="/play"
        className="bg-pixel-grass text-pixel-black font-heading text-sm md:text-base px-10 py-5 hover:bg-pixel-text-green mb-12 inline-block"
      >
        Play Solo
      </Link>

      {/* Leaderboard preview */}
      {topScores.length > 0 && (
        <div className="w-full max-w-md">
          <h2 className="font-heading text-pixel-text-white text-xs mb-4 text-center">
            Top Typists
          </h2>
          <div className="bg-pixel-panel border-2 border-pixel-text-dim p-4">
            {topScores.map((score, i) => (
              <div
                key={score.id}
                className="flex justify-between items-center py-2 border-b border-pixel-text-dim/30 last:border-b-0"
              >
                <div className="flex items-center gap-3">
                  <span className="font-heading text-[10px] text-pixel-bird-yellow w-4">
                    {i + 1}
                  </span>
                  <span className="font-typing text-pixel-text-white text-sm">
                    {score.user.username}
                  </span>
                </div>
                <span className="font-heading text-[10px] text-pixel-text-green">
                  {score.wpm} WPM
                </span>
              </div>
            ))}
          </div>
          <div className="text-center mt-4">
            <Link
              href="/leaderboard"
              className="font-heading text-[10px] text-pixel-text-dim hover:text-pixel-bird-yellow"
            >
              View Full Leaderboard
            </Link>
          </div>
        </div>
      )}

      {/* Footer nav */}
      <nav className="flex gap-6 mt-12">
        <Link
          href="/sign-in"
          className="font-heading text-[10px] text-pixel-text-dim hover:text-pixel-text-white"
        >
          Sign In
        </Link>
        <Link
          href="/leaderboard"
          className="font-heading text-[10px] text-pixel-text-dim hover:text-pixel-text-white"
        >
          Leaderboard
        </Link>
      </nav>
    </main>
  );
}
