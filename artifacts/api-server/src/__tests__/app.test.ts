import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../app";

describe("API Basic Tests", () => {
  it("should have a health check or 404 on root", async () => {
    const res = await request(app).get("/");
    expect(res.status).toBe(404); // Or 200 if you add a health check
  });

  it("should return 401 for unauthorized /api/events", async () => {
    const res = await request(app).get("/api/events");
    expect(res.status).toBe(401);
  });
});
