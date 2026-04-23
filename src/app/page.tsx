import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { AuthMenu } from "@/components/AuthMenu";

async function getLeaderboardPreview() {
  try {
    const scores = await prisma.score.findMany({
      where: {
        user: { clerkId: { not: { startsWith: "bot_" } } },
        flagged: false,
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

async function getTotals() {
  try {
    const [races, scoresWithPassage] = await Promise.all([
      prisma.score.count({ where: { flagged: false } }),
      prisma.score.findMany({
        where: { flagged: false },
        select: { passage: { select: { wordCount: true } } },
      }),
    ]);
    const words = scoresWithPassage.reduce(
      (sum, s) => sum + (s.passage?.wordCount ?? 0),
      0
    );
    return { races, words };
  } catch {
    return null;
  }
}

function formatTotal(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M+`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}k+`;
  return String(n);
}

export default async function LandingPage() {
  const [topScores, totals] = await Promise.all([
    getLeaderboardPreview(),
    getTotals(),
  ]);

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

        {/* Tagline — spec § 3.3 committed hero copy */}
        <p className="font-heading text-pixel-text-dim text-[9px] md:text-[10px] text-center mt-2 mb-6 tracking-wider">
          Race the flock. Type fast.
        </p>

        {/* Menu */}
        <nav className="w-56 mb-10 mt-4">
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

        {/* Live counter — appears only if the query succeeded */}
        {totals && totals.races > 0 && (
          <p className="font-heading text-pixel-text-dim text-[7px] tracking-wider mt-8 opacity-60">
            {formatTotal(totals.races)} RACES · {formatTotal(totals.words)} WORDS TYPED
          </p>
        )}
      </div>
    </main>
  );
}
