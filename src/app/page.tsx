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
    <main className="relative min-h-screen overflow-hidden">
      {/* === SKY BACKGROUND === */}
      <div className="absolute inset-0 sky-bg" />

      {/* === ANIMATED CLOUDS === */}
      <div className="pixel-cloud pixel-cloud-lg animate-cloud-1" style={{ top: "8%", left: "-100px" }} />
      <div className="pixel-cloud animate-cloud-2" style={{ top: "15%", right: "-100px" }} />
      <div className="pixel-cloud pixel-cloud-lg animate-cloud-3" style={{ top: "22%", left: "-100px" }} />
      <div className="pixel-cloud animate-cloud-1" style={{ top: "5%", left: "-100px", animationDelay: "12s" }} />

      {/* === ANIMATED BIRD === */}
      <div className="absolute animate-fly-across z-10" style={{ top: "30%" }}>
        <div className="animate-float" style={{ animationDuration: "0.6s" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/sprites/robin.png"
            alt="Flying bird"
            className="w-10 h-10"
            style={{ imageRendering: "pixelated" }}
          />
        </div>
      </div>

      {/* === GRASS GROUND === */}
      <div className="pixel-grass-strip z-[1]" />

      {/* === CONTENT === */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen p-4 pb-24">
        {/* Title */}
        <div className="animate-bounce-in mb-2">
          <h1 className="font-heading text-pixel-bird-yellow text-2xl md:text-4xl text-center text-glow-yellow leading-relaxed">
            Accelerate
          </h1>
          <h1 className="font-heading text-pixel-text-white text-2xl md:text-4xl text-center text-shadow-hard leading-relaxed">
            Avians
          </h1>
        </div>

        {/* Subtitle */}
        <p className="font-mono text-pixel-navy text-sm md:text-base mb-10 text-shadow-hard opacity-80">
          Type fast. Fly faster.
        </p>

        {/* Animated bird sprites row */}
        <div className="flex gap-4 mb-8">
          {["robin", "canary", "bluebird"].map((bird, i) => (
            <div key={bird} className="animate-float" style={{ animationDelay: `${i * 0.4}s` }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/sprites/${bird}.png`}
                alt={bird}
                className="w-10 h-10 md:w-12 md:h-12"
                style={{ imageRendering: "pixelated" }}
              />
            </div>
          ))}
        </div>

        {/* Play button - BIG and pulsing */}
        <Link
          href="/play"
          className="pixel-btn animate-pulse-glow font-heading text-base md:text-lg px-12 py-5 md:px-16 md:py-6 mb-12 inline-block text-pixel-black tracking-wider"
        >
          Play Solo
        </Link>

        {/* Leaderboard preview in arcade cabinet panel */}
        {topScores.length > 0 && (
          <div className="w-full max-w-md animate-slide-up">
            {/* Cabinet top */}
            <div className="bg-pixel-navy border-x-4 border-t-4 border-pixel-bird-yellow px-4 py-2 text-center">
              <h2 className="font-heading text-pixel-bird-yellow text-xs text-glow-yellow">
                HIGH SCORES
              </h2>
            </div>
            {/* Cabinet screen */}
            <div className="pixel-panel-gold p-4">
              {topScores.map((score, i) => {
                const rankColor =
                  i === 0
                    ? "text-pixel-gold"
                    : i === 1
                    ? "text-pixel-silver"
                    : i === 2
                    ? "text-pixel-bronze"
                    : "text-pixel-text-dim";
                const rankIcon =
                  i === 0 ? "★" : i === 1 ? "☆" : i === 2 ? "◆" : "·";
                return (
                  <div
                    key={score.id}
                    className={`flex justify-between items-center py-2 border-b border-pixel-text-dim/20 last:border-b-0 ${
                      i < 3 ? "animate-slide-up" : ""
                    }`}
                    style={{ animationDelay: `${i * 0.1}s` }}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`font-heading text-sm ${rankColor}`}>
                        {rankIcon}
                      </span>
                      <span className={`font-heading text-[10px] ${rankColor} w-4`}>
                        {i + 1}
                      </span>
                      <span className="font-mono text-pixel-text-white text-sm">
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
            <div className="text-center mt-4">
              <Link
                href="/leaderboard"
                className="font-heading text-[10px] text-pixel-deep-sky hover:text-pixel-bird-yellow transition-colors"
              >
                View Full Leaderboard →
              </Link>
            </div>
          </div>
        )}

        {/* Footer nav */}
        <nav className="flex gap-6 mt-10">
          <Link
            href="/sign-in"
            className="pixel-select px-4 py-2 font-heading text-[10px] text-pixel-text-white hover:text-pixel-bird-yellow"
          >
            Sign In
          </Link>
          <Link
            href="/leaderboard"
            className="pixel-select px-4 py-2 font-heading text-[10px] text-pixel-text-white hover:text-pixel-bird-yellow"
          >
            Leaderboard
          </Link>
        </nav>
      </div>
    </main>
  );
}
