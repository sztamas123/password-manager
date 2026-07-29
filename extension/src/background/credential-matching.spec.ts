import { describe, expect, it } from "vitest";
import type { DecryptedEntry, LoginData } from "../lib/types";
import {
  credentialIsUnchanged,
  credentialSiteKey,
  credentialSitesMatch,
  deriveSiteName,
  entryWithoutWebsiteToUpdate,
  entryToUpdate,
  matchingEntries,
  normalizePageOrigin,
} from "./credential-matching";

describe("credential website matching", () => {
  it("matches paths and a conventional www prefix on the same host", () => {
    expect(credentialSiteKey("https://www.example.com/login")).toBe(
      "https://example.com",
    );
    expect(credentialSiteKey("https://example.com/register?source=home")).toBe(
      "https://example.com",
    );
  });

  it("does not match deceptive suffixes, sibling subdomains, or HTTP downgrades", () => {
    expect(credentialSiteKey("https://example.com.evil.test")).not.toBe(
      credentialSiteKey("https://example.com"),
    );
    expect(credentialSiteKey("https://accounts.example.com")).not.toBe(
      credentialSiteKey("https://example.com"),
    );
    expect(credentialSiteKey("http://example.com")).not.toBe(
      credentialSiteKey("https://example.com"),
    );
  });

  it("includes ports when matching localhost applications", () => {
    expect(credentialSiteKey("http://localhost:3000/login")).toBe(
      "http://localhost:3000",
    );
    expect(credentialSiteKey("http://localhost:8080")).not.toBe(
      credentialSiteKey("http://localhost:3000"),
    );
  });

  it("matches only the explicit HTTPS Google sign-in affiliation", () => {
    expect(
      credentialSitesMatch(
        "https://mail.google.com/mail/u/0",
        "https://accounts.google.com/signin",
      ),
    ).toBe(true);
    expect(
      credentialSitesMatch(
        "https://gmail.com",
        "https://accounts.google.com/signin",
      ),
    ).toBe(true);
    expect(
      credentialSitesMatch(
        "https://www.google.com",
        "https://accounts.google.com/signin",
      ),
    ).toBe(true);
    expect(
      credentialSitesMatch(
        "http://gmail.com",
        "https://accounts.google.com/signin",
      ),
    ).toBe(false);
    expect(
      credentialSitesMatch(
        "https://evil-google.com",
        "https://accounts.google.com/signin",
      ),
    ).toBe(false);
  });

  it("returns matching entries newest first", () => {
    const entries = [
      entry("old", "https://example.com", "2026-01-01T00:00:00.000Z"),
      entry("other", "https://other.test", "2026-03-01T00:00:00.000Z"),
      entry(
        "new",
        "https://www.example.com/sign-in",
        "2026-02-01T00:00:00.000Z",
      ),
    ];

    expect(
      matchingEntries(entries, "https://example.com/login").map(
        (candidate) => candidate.id,
      ),
    ).toEqual(["new", "old"]);
  });

  it("derives an item name and stores only the page origin", () => {
    expect(
      deriveSiteName("GitHub · Build and ship software", "https://github.com"),
    ).toBe("GitHub");
    expect(
      deriveSiteName("Sign in", "https://accounts.example.com/login"),
    ).toBe("accounts.example.com");
    expect(
      normalizePageOrigin("https://example.com/register?campaign=one"),
    ).toBe("https://example.com");
  });

  it("updates only an unambiguous username match", () => {
    const entries = [
      entry("alice", "https://example.com", "2026-01-01T00:00:00.000Z"),
      entry("bob", "https://example.com", "2026-02-01T00:00:00.000Z"),
    ];
    entries[0]!.data.username = "Alice@Example.com";
    entries[1]!.data.username = "bob@example.com";

    expect(entryToUpdate(entries, "alice@example.com")?.id).toBe("alice");
    expect(entryToUpdate(entries, "")).toBeNull();
    expect(entryToUpdate([entries[0]!], "")?.id).toBe("alice");
  });

  it("recognizes an unchanged submitted credential", () => {
    const existing = entry(
      "github",
      "https://github.com",
      "2026-01-01T00:00:00.000Z",
    );
    existing.data.username = "Tamas";
    existing.data.password = "same-password";

    expect(
      credentialIsUnchanged(existing, {
        pageTitle: "GitHub",
        password: "same-password",
        url: "https://github.com",
        username: " tamas ",
      }),
    ).toBe(true);
    expect(
      credentialIsUnchanged(existing, {
        pageTitle: "GitHub",
        password: "new-password",
        url: "https://github.com",
        username: "tamas",
      }),
    ).toBe(false);
  });

  it("claims only one URL-less entry with the submitted username", () => {
    const urlLess = entry("url-less", "", "2026-01-01T00:00:00.000Z");
    urlLess.data.username = "user@gmail.com";
    const unrelated = entry("other", "", "2026-01-01T00:00:00.000Z");
    unrelated.data.username = "other@gmail.com";

    expect(
      entryWithoutWebsiteToUpdate([urlLess, unrelated], " USER@gmail.com ")?.id,
    ).toBe("url-less");
    expect(
      entryWithoutWebsiteToUpdate(
        [urlLess, { ...urlLess, id: "duplicate" }],
        "user@gmail.com",
      ),
    ).toBeNull();
  });
});

function entry(
  id: string,
  url: string,
  updatedAt: string,
): DecryptedEntry<LoginData> {
  return {
    createdAt: updatedAt,
    data: {
      name: id,
      notes: "",
      password: "password",
      url,
      username: "user",
    },
    encryptedData: "ciphertext",
    folderId: null,
    id,
    updatedAt,
    vaultId: "vault-id",
  };
}
