import { describe, expect, it } from "vitest";
import type { DecryptedEntry } from "../lib/types";
import { filterEntries } from "./search";

const entries: DecryptedEntry[] = [
  createEntry("email", "folder-one", {
    name: "Personal Email",
    username: "me@example.com",
    password: "secret",
    url: "https://mail.example.com",
    notes: "Recovery codes are offline",
  }),
  createEntry("hosting", null, {
    name: "Hosting",
    username: "admin",
    password: "secret",
    url: "https://host.example.net",
    notes: "",
  }),
];

describe("filterEntries", () => {
  it("searches decrypted names, usernames, URLs, and notes", () => {
    expect(
      filterEntries(entries, "recovery", null).map(({ id }) => id),
    ).toEqual(["email"]);
    expect(
      filterEntries(entries, "EXAMPLE.NET", null).map(({ id }) => id),
    ).toEqual(["hosting"]);
  });

  it("combines search with the selected folder", () => {
    expect(
      filterEntries(entries, "example", "folder-one").map(({ id }) => id),
    ).toEqual(["email"]);
  });
});

function createEntry(
  id: string,
  folderId: string | null,
  data: DecryptedEntry["data"],
): DecryptedEntry {
  return {
    id,
    folderId,
    data,
    encryptedData: "ciphertext",
    vaultId: "vault-id",
    createdAt: "2026-07-28T00:00:00.000Z",
    updatedAt: "2026-07-28T00:00:00.000Z",
  };
}
