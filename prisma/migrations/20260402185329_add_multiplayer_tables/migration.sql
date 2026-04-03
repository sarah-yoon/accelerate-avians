-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('waiting', 'racing', 'completed', 'expired');

-- CreateEnum
CREATE TYPE "MatchPlayerStatus" AS ENUM ('racing', 'finished', 'abandoned', 'disconnected');

-- CreateTable
CREATE TABLE "matches" (
    "id" TEXT NOT NULL,
    "roomCode" TEXT NOT NULL,
    "passageId" TEXT NOT NULL,
    "status" "MatchStatus" NOT NULL DEFAULT 'waiting',
    "startedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_players" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "wpm" INTEGER,
    "accuracy" DOUBLE PRECISION,
    "placement" INTEGER,
    "ghostData" JSONB,
    "status" "MatchPlayerStatus" NOT NULL DEFAULT 'racing',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "match_players_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "matches_roomCode_key" ON "matches"("roomCode");

-- CreateIndex
CREATE INDEX "matches_status_idx" ON "matches"("status");

-- CreateIndex
CREATE INDEX "match_players_userId_idx" ON "match_players"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "match_players_matchId_userId_key" ON "match_players"("matchId", "userId");

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_passageId_fkey" FOREIGN KEY ("passageId") REFERENCES "passages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_players" ADD CONSTRAINT "match_players_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "matches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_players" ADD CONSTRAINT "match_players_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
