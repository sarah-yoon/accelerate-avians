import "dotenv/config";
import { PrismaClient, Difficulty } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import fallbackPassages from "./fallback-passages.json";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

function classifyDifficulty(wordCount: number): Difficulty {
  if (wordCount < 20) return "short";
  if (wordCount <= 45) return "medium";
  return "long";
}

function isAsciiOnly(text: string): boolean {
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code < 0x20 || code > 0x7e) return false;
  }
  return true;
}

interface RawPassage { text: string; source: string; }

function processPassage(raw: RawPassage) {
  const { text, source } = raw;
  if (text.length < 30 || text.length > 700) return null;
  if (!isAsciiOnly(text)) return null;
  const wordCount = text.split(/\s+/).length;
  const charCount = text.length;
  const difficulty = classifyDifficulty(wordCount);
  return { text, source, wordCount, charCount, difficulty };
}

function generateBotGhostData(charCount: number, targetWpm: number, wordCount: number) {
  const totalTimeMs = (wordCount / targetWpm) * 60000;
  const msPerChar = totalTimeMs / charCount;
  const points: { charIndex: number; ms: number }[] = [];

  for (let i = 0; i < charCount; i++) {
    const jitter = (Math.random() - 0.5) * msPerChar * 0.3;
    points.push({ charIndex: i, ms: Math.round(msPerChar * i + jitter) });
  }

  for (let i = 1; i < points.length; i++) {
    if (points[i].ms <= points[i - 1].ms) {
      points[i].ms = points[i - 1].ms + 1;
    }
  }

  return points;
}

async function main() {
  console.log("Seeding database...");

  const passages = (fallbackPassages as RawPassage[]).map(processPassage).filter((p): p is NonNullable<typeof p> => p !== null);

  console.log(`Processing ${passages.length} passages...`);

  for (const passage of passages) {
    const created = await prisma.passage.create({ data: passage });
    const botWpms = [20, 25, 30, 40, 55, 70, 85, 100];

    for (const wpm of botWpms) {
      const botUser = await prisma.user.upsert({
        where: { clerkId: `bot_${wpm}` },
        update: { displayBird: "robot" },
        create: { clerkId: `bot_${wpm}`, username: `bot_${wpm}wpm`, displayBird: "robot" },
      });

      const ghostData = generateBotGhostData(passage.charCount, wpm, passage.wordCount);
      await prisma.score.create({
        data: { userId: botUser.id, passageId: created.id, wpm, accuracy: 0.95 + Math.random() * 0.05, ghostData },
      });
    }
  }

  console.log(`Seeded ${passages.length} passages with bot ghosts.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
