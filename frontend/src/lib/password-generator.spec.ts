import { describe, expect, it } from "vitest";
import {
  GENERATED_PASSWORD_LENGTH,
  generatePassword,
} from "./password-generator";

describe("generatePassword", () => {
  it("uses the fixed Phase 5 length and supported alphabet", () => {
    const password = generatePassword();

    expect(password).toHaveLength(GENERATED_PASSWORD_LENGTH);
    expect(password).toMatch(
      /^[ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*()\-_=+]+$/,
    );
  });

  it("does not produce a repeated deterministic value", () => {
    const values = new Set(
      Array.from({ length: 32 }, () => generatePassword()),
    );

    expect(values.size).toBe(32);
  });
});
