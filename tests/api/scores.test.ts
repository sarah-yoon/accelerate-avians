import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn().mockResolvedValue({ userId: "clerk_user_1" }),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi
        .fn()
        .mockResolvedValue({ id: "user_1", clerkId: "clerk_user_1" }),
    },
    passage: {
      findUnique: vi.fn().mockResolvedValue({
        id: "passage_1",
        wordCount: 30,
        charCount: 150,
      }),
    },
    score: {
      create: vi.fn().mockResolvedValue({
        id: "score_new",
        wpm: 60,
        accuracy: 0.95,
      }),
    },
  },
}));

import { POST } from "@/app/api/scores/route";

describe("POST /api/scores", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("saves a valid score and returns computed WPM/accuracy", async () => {
    const ghostData = Array.from({ length: 50 }, (_, i) => ({
      charIndex: i,
      ms: i * 600,
    }));

    const request = new Request("http://localhost/api/scores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        passageId: "passage_1",
        ghostData,
        totalKeystrokes: 155,
        correctKeystrokes: 150,
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(201);
  });

  it("rejects unauthenticated requests", async () => {
    const { auth } = await import("@clerk/nextjs/server");
    vi.mocked(auth).mockResolvedValueOnce({ userId: null } as ReturnType<typeof auth> extends Promise<infer T> ? T : never);

    const request = new Request("http://localhost/api/scores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        passageId: "passage_1",
        ghostData: [],
        totalKeystrokes: 10,
        correctKeystrokes: 10,
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });
});
