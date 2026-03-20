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
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
  },
  relationshipLedgerTable: { id: "id", userId: "userId", contactId: "contactId", totalGiven: "totalGiven", totalReceived: "totalReceived" },
  transactionsTable: { id: "id", senderId: "senderId", receiverId: "receiverId", amount: "amount" },
  eventsTable: { id: "id", title: "title" },
}));

describe("Ledger Routes", () => {
  it("should return ledger entries on GET /api/ledger/:userId", async () => {
    const res = await request(app).get("/api/ledger/test-user-123");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("should return 403 when accessing another user's ledger", async () => {
    const res = await request(app).get("/api/ledger/other-user");
    expect(res.status).toBe(403);
  });
});
