import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import app from "../app";

// Mock the auth middleware
vi.mock("../middlewares/auth", () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.user = { id: "test-user-123", name: "Test User" };
    next();
  },
}));

// Mock the DB
vi.mock("@workspace/db", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([{ id: "test-user-123", name: "Test User", phone: "1234567890", avatarColor: "#8B0000", createdAt: new Date() }]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([{ id: "test-user-123", name: "Test User", phone: "1234567890", avatarColor: "#8B0000", createdAt: new Date() }]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  },
  usersTable: { id: "id", name: "name", phone: "phone", avatarColor: "avatarColor" },
  relationshipLedgerTable: { userId: "userId", contactId: "contactId" },
  transactionsTable: { senderId: "senderId", receiverId: "receiverId" },
  eventsTable: { hostId: "hostId" },
}));

describe("User Routes", () => {
  it("should return user profile on GET /api/users/:userId", async () => {
    const res = await request(app).get("/api/users/test-user-123");
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Test User");
  });

  it("should return 403 when accessing another user's profile", async () => {
    const res = await request(app).get("/api/users/other-user");
    expect(res.status).toBe(403);
  });
});
