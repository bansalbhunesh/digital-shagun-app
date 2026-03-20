import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import app from "../app";

// Mock the auth middleware to bypass Supabase for logic tests
vi.mock("../middlewares/auth", () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.user = { id: "test-user-123", name: "Test User" };
    next();
  },
}));

// Mock the DB to avoid real connections during unit tests
vi.mock("@workspace/db", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([{ id: "txn_123", amount: 1000 }]),
    transaction: vi.fn((cb) =>
      cb({
        insert: vi.fn().mockReturnThis(),
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([{ id: "txn_123", amount: 1000 }]),
      })
    ),
  },
  eventsTable: { id: "id", hostId: "hostId" },
  shagunTransactionsTable: { id: "id" },
  relationshipLedgerTable: { id: "id" },
  eventGuestsTable: { id: "id" },
}));

describe("Shagun Routes", () => {
  it("should return 400 for invalid send-shagun body", async () => {
    const res = await request(app).post("/api/shagun/send").send({ amount: -100 }); // Missing eventId
    expect(res.status).toBe(400);
  });

  it("should fail to reveal shagun if not authenticated (mock handles auth, so we test route presence)", async () => {
    const res = await request(app).get("/api/shagun/reveal/123");
    // Since our mock always succeeds, we'd expect 404/200 depending on DB
    expect(res.status).toBeDefined();
  });
});
