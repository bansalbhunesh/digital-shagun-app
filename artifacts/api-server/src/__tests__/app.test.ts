import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../app";
import { vi } from "vitest";

// Mock the DB for health check
vi.mock("@workspace/db", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([{ now: new Date() }]),
  },
  usersTable: {},
}));

// Mock sql from drizzle-orm if needed, but the select().from() chain is enough
vi.mock("drizzle-orm", () => ({
  sql: vi.fn(),
}));


describe("API Basic Tests", () => {
  it("should have a health check on /health", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("healthy");
  });

  it("should return 401 for unauthorized /api/events", async () => {
    const res = await request(app).get("/api/events");
    expect(res.status).toBe(401);
  });
});
