import { describe, it, expect } from "vitest";
import { SendShagunBody } from "../index";

describe("Validators", () => {
  it("should validate a correct shagun body", () => {
    const data = {
      eventId: "event-123",
      amount: 501,
      message: "Happy Wedding!",
    };
    const result = SendShagunBody.safeParse(data);
    expect(result.success).toBe(true);
  });

  it("should fail validation for negative amount", () => {
    const data = {
      eventId: "event-123",
      amount: -100,
      message: "Test",
    };
    const result = SendShagunBody.safeParse(data);
    expect(result.success).toBe(false);
  });

  it("should fail validation for missing fields", () => {
    const data = {
      amount: 501,
    };
    const result = SendShagunBody.safeParse(data);
    expect(result.success).toBe(false);
  });
});
