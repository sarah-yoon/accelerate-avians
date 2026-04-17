-- Rename ghostData -> clientGhostData (preserves existing data)
ALTER TABLE "scores" RENAME COLUMN "ghostData" TO "clientGhostData";
ALTER TABLE "match_players" RENAME COLUMN "ghostData" TO "clientGhostData";

-- Add new columns
ALTER TABLE "scores" ADD COLUMN "serverGhost" jsonb;
ALTER TABLE "scores" ADD COLUMN "flagged" boolean NOT NULL DEFAULT false;

ALTER TABLE "match_players" ADD COLUMN "serverGhost" jsonb;
ALTER TABLE "match_players" ADD COLUMN "flagged" boolean NOT NULL DEFAULT false;
