import { describe, expect, it } from "vitest";
import {
  calculatePasswordEntropy,
  DEFAULT_PASSWORD_OPTIONS,
  GENERATED_PASSWORD_LENGTH,
  generatePassword,
  getPasswordStrength,
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
} from "./password-generator";

describe("generatePassword", () => {
  it("uses the secure defaults", () => {
    const password = generatePassword();

    expect(password).toHaveLength(GENERATED_PASSWORD_LENGTH);
    expect(password).toMatch(
      /^[ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*()\-_=+]+$/,
    );
  });

  it("supports configurable length and character types", () => {
    const password = generatePassword({
      ...DEFAULT_PASSWORD_OPTIONS,
      length: 32,
      uppercase: false,
      lowercase: false,
      symbols: false,
    });

    expect(password).toHaveLength(32);
    expect(password).toMatch(/^[2-9]+$/);
  });

  it("includes every enabled character type", () => {
    const password = generatePassword({
      ...DEFAULT_PASSWORD_OPTIONS,
      length: MIN_PASSWORD_LENGTH,
    });

    expect(password).toMatch(/[A-Z]/);
    expect(password).toMatch(/[a-z]/);
    expect(password).toMatch(/[2-9]/);
    expect(password).toMatch(/[!@#$%^&*()\-_=+]/);
  });

  it("rejects invalid configuration", () => {
    expect(() =>
      generatePassword({
        length: MIN_PASSWORD_LENGTH,
        uppercase: false,
        lowercase: false,
        numbers: false,
        symbols: false,
      }),
    ).toThrow("Select at least one character type");

    expect(() =>
      generatePassword({
        ...DEFAULT_PASSWORD_OPTIONS,
        length: MAX_PASSWORD_LENGTH + 1,
      }),
    ).toThrow(RangeError);
  });

  it("does not produce a repeated deterministic value", () => {
    const values = new Set(
      Array.from({ length: 32 }, () => generatePassword()),
    );

    expect(values.size).toBe(32);
  });
});

describe("password entropy", () => {
  it("calculates the exact entropy for a single selected alphabet", () => {
    const options = {
      length: 10,
      uppercase: false,
      lowercase: false,
      numbers: true,
      symbols: false,
    };

    expect(calculatePasswordEntropy(options)).toBeCloseTo(30);
  });

  it("accounts for the requirement that every selected type occurs", () => {
    const options = {
      ...DEFAULT_PASSWORD_OPTIONS,
      length: MIN_PASSWORD_LENGTH,
    };
    const unconstrainedEntropy = options.length * Math.log2(24 + 24 + 8 + 14);

    expect(calculatePasswordEntropy(options)).toBeLessThan(
      unconstrainedEntropy,
    );
  });

  it("maps entropy to four understandable strength levels", () => {
    expect(getPasswordStrength(39)).toEqual({ label: "Weak", level: 1 });
    expect(getPasswordStrength(40)).toEqual({ label: "Fair", level: 2 });
    expect(getPasswordStrength(60)).toEqual({ label: "Strong", level: 3 });
    expect(getPasswordStrength(80)).toEqual({
      label: "Very strong",
      level: 4,
    });
  });
});
