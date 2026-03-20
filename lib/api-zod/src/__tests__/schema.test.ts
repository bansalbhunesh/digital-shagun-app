import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// This is a sample integration test for a Zod schema
// It demonstrates how we can verify our API contracts
describe('API Schema Validation', () => {
  const UserSchema = z.object({
    id: z.string().uuid(),
    name: z.string().min(2),
    phone: z.string().regex(/^\+?[1-9]\d{1,14}$/),
  });

  it('should validate a correct user object', () => {
    const validUser = {
      id: '550e8400-e29b-411d-a716-446655440000',
      name: 'John Doe',
      phone: '+919876543210',
    };
    expect(() => UserSchema.parse(validUser)).not.toThrow();
  });

  it('should reject an invalid phone number', () => {
    const invalidUser = {
      id: '550e8400-e29b-411d-a716-446655440000',
      name: 'John Doe',
      phone: '123', // Too short
    };
    expect(() => UserSchema.parse(invalidUser)).toThrow();
  });
});
