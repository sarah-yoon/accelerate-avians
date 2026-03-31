import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      upsert: vi.fn().mockResolvedValue({ id: "test-id", clerkId: "clerk_123" }),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  },
}));

vi.mock("svix", () => ({
  Webhook: vi.fn().mockImplementation(function () {
    return {
      verify: vi.fn().mockReturnValue({
        type: "user.created",
        data: {
          id: "clerk_123",
          username: "testbird",
          first_name: "Test",
        },
      }),
    };
  }),
}));

import { POST } from "@/app/api/webhooks/clerk/route";
import { prisma } from "@/lib/prisma";

describe("POST /api/webhooks/clerk", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CLERK_WEBHOOK_SECRET = "whsec_test123";
  });

  it("upserts a user on user.created event", async () => {
    const request = new Request("http://localhost/api/webhooks/clerk", {
      method: "POST",
      headers: {
        "svix-id": "msg_123",
        "svix-timestamp": "1234567890",
        "svix-signature": "v1,test",
        "content-type": "application/json",
      },
      body: JSON.stringify({ type: "user.created", data: { id: "clerk_123" } }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(prisma.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { clerkId: "clerk_123" },
      })
    );
  });
});
