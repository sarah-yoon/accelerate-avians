import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { AuthMenu } from "@/components/AuthMenu";

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
    <main className="game-screen relative overflow-hidden">
      <div className="relative z-10 flex flex-col items-center">
        {/* Title */}
        <div className="mb-2 animate-bounce-in">
          <h1 className="font-heading text-pixel-bird-yellow text-xl md:text-3xl text-center text-glow-yellow leading-relaxed">
            Accelerate,
          </h1>
          <h1 className="font-heading text-pixel-text-white text-xl md:text-3xl text-center text-shadow-hard">
            Avians
          </h1>
        </div>

        {/* Game menu */}
        <nav className="w-56 mb-12">
          <Link href="/play" className="game-menu-item !py-3 !text-center !pl-0">
            SOLO RACE
          </Link>
          <Link href="/multiplayer" className="game-menu-item !py-3 !text-center !pl-0">
            MULTIPLAYER
          </Link>
          <Link href="/leaderboard" className="game-menu-item !py-3 !text-center !pl-0">
            LEADERBOARD
          </Link>
          <AuthMenu />
        </nav>

        {/* High score ticker */}
        {topScores.length > 0 && (
          <div className="w-full max-w-xs animate-slide-up">
            <div className="game-divider mb-4" />
            <h2 className="font-heading text-pixel-text-dim text-[8px] text-center mb-3 tracking-widest">
              — TOP SCORES —
            </h2>
            <div className="space-y-1">
              {topScores.map((score, i) => {
                const rankColor =
                  i === 0 ? "text-pixel-gold" : i === 1 ? "text-pixel-silver" : i === 2 ? "text-pixel-bronze" : "text-pixel-text-dim";
                return (
                  <div
                    key={score.id}
                    className="flex justify-between items-center px-2 py-1.5"
                  >
                    <div className="flex items-center gap-3">
                      <span className={`font-heading text-[8px] ${rankColor} w-4`}>
                        {i + 1}.
                      </span>
                      <span className="text-pixel-text-white text-xs">
                        {score.user.username}
                      </span>
                    </div>
                    <span className="font-heading text-[8px] text-pixel-text-green">
                      {score.wpm}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Press start prompt */}
        <p className="font-heading text-[7px] text-pixel-text-dim mt-10 animate-blink text-center">
          SELECT AN OPTION
        </p>
      </div>
    </main>
  );
}
