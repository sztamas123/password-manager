import { describe, expect, it } from "vitest";
import type { IdentitySummary } from "../lib/types";
import { identitiesForFillMode } from "./identity-options";

const identities: IdentitySummary[] = [
  {
    email: "personal@example.com",
    entryId: "identity-1",
    name: "Personal",
    vaultId: "vault-1",
  },
  {
    email: "work@example.com",
    entryId: "identity-2",
    name: "Work",
    vaultId: "vault-1",
  },
  {
    email: "",
    entryId: "identity-3",
    name: "Shipping only",
    vaultId: "vault-1",
  },
  {
    email: "PERSONAL@example.com",
    entryId: "identity-4",
    name: "Duplicate",
    vaultId: "vault-1",
  },
];

describe("identity fill options", () => {
  it("offers a selector when multiple email addresses are available", () => {
    const available = identitiesForFillMode(identities, "email");

    expect(available.map(({ email }) => email)).toEqual([
      "personal@example.com",
      "work@example.com",
    ]);
  });

  it("keeps a single address available without a fill label", () => {
    const available = identitiesForFillMode([identities[0]!], "email");

    expect(available[0]?.email).toBe("personal@example.com");
  });

  it("excludes email-less profiles from checkout identity suggestions", () => {
    const available = identitiesForFillMode(identities, "identity");

    expect(available.map(({ name }) => name)).toEqual([
      "Personal",
      "Work",
      "Duplicate",
    ]);
  });
});
