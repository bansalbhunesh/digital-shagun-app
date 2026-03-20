import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../app";

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
