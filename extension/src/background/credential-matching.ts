import {
  type DecryptedEntry,
  isLoginEntry,
  type LoginData,
} from "../lib/types";
import type { CapturedCredential } from "../lib/types";

const GENERIC_TITLES =
  /^(?:account|create account|log ?in|register|sign ?in|sign ?up|welcome)$/iu;
const AFFILIATED_HTTPS_HOST_GROUPS = [
  new Set([
    "accounts.google.com",
    "gmail.com",
    "google.com",
    "mail.google.com",
  ]),
];

export function credentialSiteKey(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;

    const hostname = url.hostname
      .toLocaleLowerCase()
      .replace(/\.$/u, "")
      .replace(/^www\./u, "");
    const port = url.port ? `:${url.port}` : "";
    return `${url.protocol}//${hostname}${port}`;
  } catch {
    return null;
  }
}

export function matchingEntries(
  entries: DecryptedEntry[],
  pageUrl: string,
): DecryptedEntry<LoginData>[] {
  const pageKey = credentialSiteKey(pageUrl);
  if (!pageKey) return [];

  return entries
    .filter(isLoginEntry)
    .filter((entry) => credentialSitesMatch(entry.data.url, pageUrl))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export function credentialSitesMatch(
  storedUrl: string,
  pageUrl: string,
): boolean {
  const storedKey = credentialSiteKey(storedUrl);
  const pageKey = credentialSiteKey(pageUrl);
  if (!storedKey || !pageKey) return false;
  if (storedKey === pageKey) return true;

  const stored = new URL(storedKey);
  const page = new URL(pageKey);
  if (
    stored.protocol !== "https:" ||
    page.protocol !== "https:" ||
    stored.port ||
    page.port
  ) {
    return false;
  }

  return AFFILIATED_HTTPS_HOST_GROUPS.some(
    (group) => group.has(stored.hostname) && group.has(page.hostname),
  );
}

export function entryToUpdate(
  siteMatches: DecryptedEntry<LoginData>[],
  username: string,
): DecryptedEntry<LoginData> | null {
  const normalizedUsername = username.trim().toLocaleLowerCase();
  if (normalizedUsername) {
    return (
      siteMatches.find(
        (entry) =>
          entry.data.username.trim().toLocaleLowerCase() === normalizedUsername,
      ) ?? null
    );
  }

  return siteMatches.length === 1 ? (siteMatches[0] ?? null) : null;
}

export function entryWithoutWebsiteToUpdate(
  entries: DecryptedEntry[],
  username: string,
): DecryptedEntry<LoginData> | null {
  const normalizedUsername = username.trim().toLocaleLowerCase();
  if (!normalizedUsername) return null;

  const candidates = entries
    .filter(isLoginEntry)
    .filter(
      (entry) =>
        credentialSiteKey(entry.data.url) === null &&
        entry.data.username.trim().toLocaleLowerCase() === normalizedUsername,
    );
  return candidates.length === 1 ? (candidates[0] ?? null) : null;
}

export function credentialIsUnchanged(
  existing: DecryptedEntry<LoginData>,
  captured: CapturedCredential,
): boolean {
  return (
    existing.data.password === captured.password &&
    existing.data.username.trim().toLocaleLowerCase() ===
      captured.username.trim().toLocaleLowerCase()
  );
}

export function deriveSiteName(pageTitle: string, pageUrl: string): string {
  const title = pageTitle
    .split(/\s(?:[|·•—]|-{1,2})\s/u)[0]
    ?.trim()
    .slice(0, 200);

  if (title && !GENERIC_TITLES.test(title)) return title;

  try {
    return new URL(pageUrl).hostname.replace(/^www\./u, "") || "Website login";
  } catch {
    return "Website login";
  }
}

export function normalizePageOrigin(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Credentials can only be saved for HTTP or HTTPS pages");
  }
  return url.origin;
}
