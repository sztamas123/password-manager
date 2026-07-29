import { customAlphabet } from "nanoid";

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 128;
export const GENERATED_PASSWORD_LENGTH = 20;

export type PasswordGeneratorOptions = {
  length: number;
  uppercase: boolean;
  lowercase: boolean;
  numbers: boolean;
  symbols: boolean;
};

export type PasswordStrength = {
  label: "Weak" | "Fair" | "Strong" | "Very strong";
  level: 1 | 2 | 3 | 4;
};

export const DEFAULT_PASSWORD_OPTIONS: PasswordGeneratorOptions = {
  length: GENERATED_PASSWORD_LENGTH,
  uppercase: true,
  lowercase: true,
  numbers: true,
  symbols: true,
};

const CHARACTER_SETS = {
  uppercase: "ABCDEFGHJKLMNPQRSTUVWXYZ",
  lowercase: "abcdefghijkmnopqrstuvwxyz",
  numbers: "23456789",
  symbols: "!@#$%^&*()-_=+",
} as const;

type CharacterSetName = keyof typeof CHARACTER_SETS;

function enabledCharacterSets(options: PasswordGeneratorOptions): string[] {
  return (Object.keys(CHARACTER_SETS) as CharacterSetName[])
    .filter((name) => options[name])
    .map((name) => CHARACTER_SETS[name]);
}

function validateOptions(options: PasswordGeneratorOptions): string[] {
  if (
    !Number.isInteger(options.length) ||
    options.length < MIN_PASSWORD_LENGTH ||
    options.length > MAX_PASSWORD_LENGTH
  ) {
    throw new RangeError(
      `Password length must be an integer between ${MIN_PASSWORD_LENGTH} and ${MAX_PASSWORD_LENGTH}`,
    );
  }

  const characterSets = enabledCharacterSets(options);
  if (characterSets.length === 0) {
    throw new Error("Select at least one character type");
  }

  return characterSets;
}

function containsEveryCharacterSet(
  password: string,
  characterSets: string[],
): boolean {
  return characterSets.every((characterSet) =>
    Array.from(password).some((character) => characterSet.includes(character)),
  );
}

export function generatePassword(
  options: PasswordGeneratorOptions = DEFAULT_PASSWORD_OPTIONS,
): string {
  const characterSets = validateOptions(options);
  const alphabet = characterSets.join("");
  const createPassword = customAlphabet(alphabet, options.length);

  // Rejection sampling keeps every valid password equally likely while also
  // ensuring that every selected character type occurs at least once.
  let password = createPassword();
  while (!containsEveryCharacterSet(password, characterSets)) {
    password = createPassword();
  }

  return password;
}

export function calculatePasswordEntropy(
  options: PasswordGeneratorOptions,
): number {
  const characterSets = validateOptions(options);
  const stateCount = 1 << characterSets.length;
  let counts = Array<number>(stateCount).fill(0);
  counts[0] = 1;

  for (let position = 0; position < options.length; position += 1) {
    const nextCounts = Array<number>(stateCount).fill(0);

    for (let mask = 0; mask < stateCount; mask += 1) {
      const currentCount = counts[mask] ?? 0;

      for (let setIndex = 0; setIndex < characterSets.length; setIndex += 1) {
        const characterSet = characterSets[setIndex];
        if (!characterSet) continue;

        const nextMask = mask | (1 << setIndex);
        nextCounts[nextMask] =
          (nextCounts[nextMask] ?? 0) + currentCount * characterSet.length;
      }
    }

    counts = nextCounts;
  }

  return Math.log2(counts[stateCount - 1] ?? 0);
}

export function getPasswordStrength(entropy: number): PasswordStrength {
  if (entropy < 40) return { label: "Weak", level: 1 };
  if (entropy < 60) return { label: "Fair", level: 2 };
  if (entropy < 80) return { label: "Strong", level: 3 };
  return { label: "Very strong", level: 4 };
}
