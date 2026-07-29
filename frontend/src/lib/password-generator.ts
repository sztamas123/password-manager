import { customAlphabet } from "nanoid";

export const GENERATED_PASSWORD_LENGTH = 20;

const PASSWORD_ALPHABET =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*()-_=+";

const createPassword = customAlphabet(
  PASSWORD_ALPHABET,
  GENERATED_PASSWORD_LENGTH,
);

export function generatePassword(): string {
  return createPassword();
}
