import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    passage: {
      count: vi.fn().mockResolvedValue(10),
      findMany: vi.fn().mockResolvedValue([
        {
          id: "passage_1",
          text: "The robin sings at dawn.",
          source: "Robin",
          wordCount: 5,
          charCount: 24,
          difficulty: "short",
        },
      ]),
    },
  },
}));

import { GET } from "@/app/api/passages/random/route";

describe("GET /api/passages/random", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a random passage", async () => {
    const request = new Request("http://localhost/api/passages/random");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty("id");
    expect(data).toHaveProperty("text");
  });

  it("filters by difficulty query param", async () => {
    const { prisma } = await import("@/lib/prisma");
    const request = new Request(
      "http://localhost/api/passages/random?difficulty=medium"
    );
    await GET(request);

    expect(prisma.passage.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { difficulty: "medium" },
      })
    );
  });
});
