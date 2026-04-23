-- CreateEnum
CREATE TYPE "CheatAction" AS ENUM ('LOG', 'INVALIDATE', 'KICK');

-- CreateTable
CREATE TABLE "cheat_violations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "matchId" TEXT,
    "scoreId" TEXT,
    "check" TEXT NOT NULL,
    "severity" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "numericValue" DOUBLE PRECISION NOT NULL,
    "action" "CheatAction" NOT NULL DEFAULT 'LOG',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cheat_violations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cheat_violations_userId_createdAt_idx" ON "cheat_violations"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "cheat_violations_check_createdAt_idx" ON "cheat_violations"("check", "createdAt" DESC);
