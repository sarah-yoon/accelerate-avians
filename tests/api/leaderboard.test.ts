import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    score: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: "score_1",
          wpm: 120,
          accuracy: 0.98,
          createdAt: new Date("2026-03-30"),
          user: { id: "user_1", username: "speedbird", displayBird: "bluebird" },
        },
        {
          id: "score_2",
          wpm: 100,
          accuracy: 0.95,
          createdAt: new Date("2026-03-29"),
          user: { id: "user_2", username: "typehawk", displayBird: "robin" },
        },
      ]),
    },
  },
}));

import { GET } from "@/app/api/leaderboard/route";

describe("GET /api/leaderboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns top scores", async () => {
    const request = new Request("http://localhost/api/leaderboard");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty("entries");
    expect(data.entries.length).toBe(2);
    expect(data.entries[0].wpm).toBe(120);
  });
});
