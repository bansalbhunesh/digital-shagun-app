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
    limit: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([{ id: "event-123", title: "Test Event" }]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  },
  eventsTable: { id: "id", hostId: "hostId", title: "title" },
  eventGuestsTable: { eventId: "eventId", userId: "userId" },
}));

describe("Event Routes", () => {
  it("should return 404 for non-existent event", async () => {
    const res = await request(app).get("/api/events/non-existent");
    expect(res.status).toBe(404);
  });

  it("should create a new event on POST /api/events", async () => {
    const res = await request(app)
      .post("/api/events")
      .send({
        title: "Wedding",
        type: "wedding",
        date: "2026-05-20T00:00:00.000Z",
        venue: "Palace",
      });
    expect(res.status).toBe(201);
    expect(res.body.title).toBe("Test Event"); // From mock
  });
});
