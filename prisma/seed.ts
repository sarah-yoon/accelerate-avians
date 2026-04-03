import "dotenv/config";
import { PrismaClient, Difficulty } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import fallbackPassages from "./fallback-passages.json";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const EBIRD_API_KEY = process.env.EBIRD_API_KEY;
const EBIRD_BASE = "https://api.ebird.org/v2";

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

// Fetch bird species descriptions from eBird API
async function fetchEbirdPassages(): Promise<RawPassage[]> {
  if (!EBIRD_API_KEY) {
    console.log("No EBIRD_API_KEY set, skipping eBird fetch.");
    return [];
  }

  console.log("Fetching species from eBird API...");
  const passages: RawPassage[] = [];

  try {
    // Get recent notable observations to find interesting species
    const regionsRes = await fetch(`${EBIRD_BASE}/ref/region/list/subnational1/US`, {
      headers: { "X-eBirdApiToken": EBIRD_API_KEY },
    });

    if (!regionsRes.ok) {
      console.warn("Failed to fetch eBird regions:", regionsRes.status);
      return [];
    }

    // Fetch taxonomy for species descriptions
    const taxRes = await fetch(`${EBIRD_BASE}/ref/taxonomy/ebird?fmt=json&cat=species`, {
      headers: { "X-eBirdApiToken": EBIRD_API_KEY },
    });

    if (!taxRes.ok) {
      console.warn("Failed to fetch eBird taxonomy:", taxRes.status);
      return [];
    }

    const taxonomy = await taxRes.json() as { comName: string; sciName: string; familyComName: string; order: string }[];

    // Pick a random sample of species and generate typing passages from their info
    const sampled = taxonomy.sort(() => Math.random() - 0.5).slice(0, 200);

    for (const species of sampled) {
      // Build a passage from the taxonomic info
      const facts = [
        `The ${species.comName} (${species.sciName}) belongs to the ${species.familyComName} family.`,
        `The ${species.comName} is classified in the order ${species.order}. Its scientific name is ${species.sciName}, and it is part of the ${species.familyComName} family.`,
        `Among the ${species.familyComName}, the ${species.comName} stands out. Known scientifically as ${species.sciName}, this bird belongs to the order ${species.order}.`,
      ];

      const text = facts[Math.floor(Math.random() * facts.length)];
      if (text.length >= 30 && text.length <= 700 && isAsciiOnly(text)) {
        passages.push({ text, source: species.comName });
      }
    }

    console.log(`Fetched ${passages.length} passages from eBird API.`);
  } catch (err) {
    console.warn("eBird API error, using fallback:", err);
  }

  return passages;
}

async function main() {
  console.log("Seeding database...");

  // Try eBird API first, fall back to local JSON
  const ebirdPassages = await fetchEbirdPassages();
  const allRaw: RawPassage[] = [...ebirdPassages, ...fallbackPassages];

  // Deduplicate by text
  const seen = new Set<string>();
  const uniqueRaw = allRaw.filter((p) => {
    if (seen.has(p.text)) return false;
    seen.add(p.text);
    return true;
  });

  const passages = uniqueRaw.map(processPassage).filter((p): p is NonNullable<typeof p> => p !== null);

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
