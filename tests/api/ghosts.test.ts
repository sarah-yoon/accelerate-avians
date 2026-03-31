import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn().mockResolvedValue({ id: "user_1", clerkId: "clerk_1" }),
    },
    score: {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([
        {
          id: "score_1",
          wpm: 60,
          ghostData: [{ charIndex: 0, ms: 0 }],
          user: { id: "user_1", username: "bot_60wpm", displayBird: "robin" },
        },
        {
          id: "score_2",
          wpm: 80,
          ghostData: [{ charIndex: 0, ms: 0 }],
          user: { id: "user_2", username: "bot_80wpm", displayBird: "canary" },
        },
      ]),
      aggregate: vi.fn().mockResolvedValue({ _avg: { wpm: 70 } }),
    },
  },
}));

import { GET } from "@/app/api/passages/[id]/ghosts/route";

describe("GET /api/passages/[id]/ghosts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns ghost racers for a passage", async () => {
    const request = new Request(
      "http://localhost/api/passages/passage_1/ghosts"
    );
    const response = await GET(request, {
      params: Promise.resolve({ id: "passage_1" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty("ghosts");
    expect(Array.isArray(data.ghosts)).toBe(true);
  });
});
