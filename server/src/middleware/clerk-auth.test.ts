import { createClerkAuthMiddleware } from "./clerk-auth.js";

vi.mock("@clerk/backend", () => ({
  verifyToken: vi.fn(),
}));

import { verifyToken } from "@clerk/backend";
const mockVerifyToken = vi.mocked(verifyToken);

function createMockSocket(overrides = {}) {
  return {
    id: "sock-test",
    data: {} as Record<string, unknown>,
    handshake: { auth: { token: "valid-token" } },
    ...overrides,
  } as any;
}

describe("createClerkAuthMiddleware", () => {
  const middleware = createClerkAuthMiddleware("sk_test_secret", "pk_test_pub");

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("rejects when token is missing", async () => {
    const socket = createMockSocket({ handshake: { auth: {} } });
    const next = vi.fn();

    await middleware(socket, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(next.mock.calls[0][0].message).toBe("Authentication required");
  });

  it("rejects when token is not a string", async () => {
    const socket = createMockSocket({ handshake: { auth: { token: 123 } } });
    const next = vi.fn();

    await middleware(socket, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(next.mock.calls[0][0].message).toBe("Authentication required");
  });

  it("rejects when handshake.auth is undefined", async () => {
    const socket = createMockSocket({ handshake: {} });
    const next = vi.fn();

    await middleware(socket, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(next.mock.calls[0][0].message).toBe("Authentication required");
  });

  it("rejects when verifyToken throws", async () => {
    mockVerifyToken.mockRejectedValue(new Error("expired"));
    const socket = createMockSocket();
    const next = vi.fn();

    await middleware(socket, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(next.mock.calls[0][0].message).toBe("Invalid or expired token");
  });

  it("rejects when payload has no sub", async () => {
    mockVerifyToken.mockResolvedValue({ sub: "" } as any);
    const socket = createMockSocket();
    const next = vi.fn();

    await middleware(socket, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(next.mock.calls[0][0].message).toBe("Invalid token: no subject");
  });

  it("accepts valid token and sets socket.data", async () => {
    mockVerifyToken.mockResolvedValue({
      sub: "user_abc",
      username: "alice",
      displayBird: "eagle",
    } as any);
    const socket = createMockSocket();
    const next = vi.fn();

    await middleware(socket, next);

    expect(next).toHaveBeenCalledWith();
    expect(socket.data.userId).toBe("user_abc");
    expect(socket.data.username).toBe("alice");
    expect(socket.data.displayBird).toBe("eagle");
    expect(socket.data.roomCode).toBeNull();
  });

  it("defaults username and displayBird when not in payload", async () => {
    mockVerifyToken.mockResolvedValue({ sub: "user_xyz" } as any);
    const socket = createMockSocket();
    const next = vi.fn();

    await middleware(socket, next);

    expect(next).toHaveBeenCalledWith();
    expect(socket.data.username).toBe("Unknown");
    expect(socket.data.displayBird).toBe("robin");
  });

  it("passes correct options to verifyToken", async () => {
    mockVerifyToken.mockResolvedValue({ sub: "user_1" } as any);
    const socket = createMockSocket();
    const next = vi.fn();

    await middleware(socket, next);

    expect(mockVerifyToken).toHaveBeenCalledWith("valid-token", {
      secretKey: "sk_test_secret",
      authorizedParties: undefined,
    });
  });
});
