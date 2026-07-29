import {
  clearVaultKey,
  createEncryptionContext,
  createResourceId,
  decryptJson,
  encryptJson,
} from "@password-manager/crypto";
import { browser } from "wxt/browser";
import { isIdentityData, isLoginEntry } from "../lib/types";
import type {
  CapturedCredential,
  CredentialSummary,
  DecryptedEntry,
  DecryptedVault,
  EntryData,
  IdentityData,
  IdentitySummary,
  LoginData,
  PendingCredentialSummary,
  StoredEntry,
  StoredVault,
  VaultData,
} from "../lib/types";
import { apiRequest } from "./api-client";
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
import { getLastVaultId, getVaultKey, setLastVaultId } from "./session";

const CACHE_TTL_MS = 30_000;
const PENDING_TTL_MS = 120_000;
const PENDING_KEY_PREFIX = "pm.pending.";
const USERNAME_STEP_KEY_PREFIX = "pm.username-step.";

interface VaultSnapshot {
  entries: DecryptedEntry[];
  loadedAt: number;
  vaults: DecryptedVault[];
}

interface PendingCredential {
  action: "link" | "save" | "update";
  credential: CapturedCredential;
  existingEntryId: string | null;
  expiresAt: number;
  id: string;
  siteName: string;
  tabId: number;
  vaultId: string;
}

interface RememberedUsername {
  expiresAt: number;
  pageUrl: string;
  username: string;
}

let cachedSnapshot: VaultSnapshot | null = null;

export function clearVaultCache(): void {
  cachedSnapshot = null;
}

export async function clearPendingCredentials(): Promise<void> {
  const stored = await browser.storage.session.get(null);
  const pendingKeys = Object.keys(stored).filter((key) =>
    [PENDING_KEY_PREFIX, USERNAME_STEP_KEY_PREFIX].some((prefix) =>
      key.startsWith(prefix),
    ),
  );
  if (pendingKeys.length > 0) {
    await browser.storage.session.remove(pendingKeys);
  }
}

export async function getCredentialMatches(
  pageUrl: string,
  usernameHint = "",
): Promise<CredentialSummary[]> {
  const snapshot = await loadVaultSnapshot();
  const siteMatches = matchingEntries(snapshot.entries, pageUrl);
  if (siteMatches.length > 0) return siteMatches.map(toSummary);

  const urlLess = urlLessEntryForPage(snapshot.entries, pageUrl, usernameHint);
  return urlLess ? [toSummary(urlLess)] : [];
}

export async function getCredentialForFill(
  vaultId: string,
  entryId: string,
  pageUrl: string,
  usernameHint = "",
): Promise<{ password: string; username: string }> {
  const snapshot = await loadVaultSnapshot();
  const strictMatch = matchingEntries(snapshot.entries, pageUrl).find(
    (candidate) => candidate.id === entryId && candidate.vaultId === vaultId,
  );
  const urlLess = urlLessEntryForPage(snapshot.entries, pageUrl, usernameHint);
  const entry =
    strictMatch ??
    (urlLess?.id === entryId && urlLess.vaultId === vaultId ? urlLess : null);

  if (!entry) {
    throw new Error("That login is not available for this website");
  }

  if (!credentialSiteKey(entry.data.url)) {
    await linkCredentialWebsite(entry, pageUrl);
  }
  await setLastVaultId(entry.vaultId);
  return {
    password: entry.data.password,
    username: entry.data.username,
  };
}

export async function getIdentitySummaries(): Promise<IdentitySummary[]> {
  const snapshot = await loadVaultSnapshot();
  return snapshot.entries
    .filter((entry): entry is DecryptedEntry<IdentityData> =>
      isIdentityData(entry.data),
    )
    .map((entry) => ({
      email: entry.data.email,
      entryId: entry.id,
      name: entry.data.name,
      vaultId: entry.vaultId,
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

export async function getIdentityForFill(
  vaultId: string,
  entryId: string,
): Promise<IdentityData> {
  const snapshot = await loadVaultSnapshot();
  const entry = snapshot.entries.find(
    (candidate) =>
      candidate.id === entryId &&
      candidate.vaultId === vaultId &&
      isIdentityData(candidate.data),
  );
  if (!entry || !isIdentityData(entry.data)) {
    throw new Error("That identity is no longer available");
  }
  await setLastVaultId(entry.vaultId);
  return entry.data;
}

export async function rememberUsernameStep(
  username: string,
  tabId: number,
  trustedPageUrl: string,
): Promise<void> {
  const normalizedUsername = username.trim();
  if (!normalizedUsername || normalizedUsername.length > 1_000) return;

  await browser.storage.session.set({
    [usernameStepKey(tabId)]: {
      expiresAt: Date.now() + PENDING_TTL_MS,
      pageUrl: normalizePageOrigin(trustedPageUrl),
      username: normalizedUsername,
    } satisfies RememberedUsername,
  });
}

export async function preparePendingCredential(
  captured: CapturedCredential,
  tabId: number,
  trustedPageUrl: string,
): Promise<PendingCredentialSummary | null> {
  const rememberedUsername = captured.username.trim()
    ? null
    : await readRememberedUsername(tabId, trustedPageUrl);
  const credential = validateCapturedCredential(
    {
      ...captured,
      username: captured.username.trim() || rememberedUsername || "",
    },
    trustedPageUrl,
  );
  const snapshot = await loadVaultSnapshot();
  if (snapshot.vaults.length === 0) {
    throw new Error("Create a vault in the web app before saving logins");
  }

  const siteMatches = matchingEntries(snapshot.entries, credential.url);
  const existing =
    entryToUpdate(siteMatches, credential.username) ??
    entryWithoutWebsiteToUpdate(snapshot.entries, credential.username);
  if (
    existing &&
    credentialSitesMatch(existing.data.url, credential.url) &&
    credentialIsUnchanged(existing, credential)
  ) {
    await browser.storage.session.remove([
      pendingKey(tabId),
      usernameStepKey(tabId),
    ]);
    return null;
  }

  const lastVaultId = await getLastVaultId();
  const preferredVault =
    snapshot.vaults.find((vault) => vault.id === lastVaultId) ??
    snapshot.vaults[0];

  if (!preferredVault) {
    throw new Error("Create a vault in the web app before saving logins");
  }

  const pending: PendingCredential = {
    action: existing
      ? credentialSiteKey(existing.data.url)
        ? "update"
        : "link"
      : "save",
    credential,
    existingEntryId: existing?.id ?? null,
    expiresAt: Date.now() + PENDING_TTL_MS,
    id: crypto.randomUUID(),
    siteName:
      existing?.data.name || deriveSiteName(captured.pageTitle, credential.url),
    tabId,
    vaultId: existing?.vaultId ?? preferredVault.id,
  };

  await browser.storage.session.set({
    [pendingKey(tabId)]: pending,
  });
  await browser.storage.session.remove(usernameStepKey(tabId));
  return toPendingSummary(pending);
}

export async function getPendingCredential(
  tabId: number,
): Promise<PendingCredentialSummary | null> {
  const pending = await readPending(tabId);
  return pending ? toPendingSummary(pending) : null;
}

export async function confirmPendingCredential(
  tabId: number,
  pendingId: string,
): Promise<void> {
  const pending = await readPending(tabId);
  if (!pending || pending.id !== pendingId) {
    throw new Error("This save request has expired");
  }

  const vaultKey = await getVaultKey();
  try {
    if (pending.action !== "save" && pending.existingEntryId) {
      await updateCredential(pending, vaultKey);
    } else {
      await createCredential(pending, vaultKey);
    }
  } finally {
    clearVaultKey(vaultKey);
  }

  await Promise.all([
    browser.storage.session.remove(pendingKey(tabId)),
    setLastVaultId(pending.vaultId),
  ]);
  clearVaultCache();
}

export async function dismissPendingCredential(
  tabId: number,
  pendingId: string,
): Promise<void> {
  const pending = await readPending(tabId);
  if (pending?.id === pendingId) {
    await browser.storage.session.remove(pendingKey(tabId));
  }
}

async function loadVaultSnapshot(): Promise<VaultSnapshot> {
  if (cachedSnapshot && Date.now() - cachedSnapshot.loadedAt < CACHE_TTL_MS) {
    return cachedSnapshot;
  }

  const vaultKey = await getVaultKey();
  try {
    const storedVaults = await apiRequest<StoredVault[]>("/vaults");
    const vaults = await Promise.all(
      storedVaults.map(async (vault) => ({
        ...vault,
        data: await decryptJson<VaultData>(
          vaultKey,
          createEncryptionContext("vault", vault.id, vault.id),
          vault.encryptedData,
        ),
      })),
    );
    const storedEntryGroups = await Promise.all(
      vaults.map((vault) =>
        apiRequest<StoredEntry[]>(`/vaults/${vault.id}/entries`),
      ),
    );
    const entries = await Promise.all(
      storedEntryGroups.flat().map(async (entry) => ({
        ...entry,
        data: await decryptJson<EntryData>(
          vaultKey,
          createEncryptionContext("entry", entry.id, entry.vaultId),
          entry.encryptedData,
        ),
      })),
    );

    cachedSnapshot = { entries, loadedAt: Date.now(), vaults };
    return cachedSnapshot;
  } finally {
    clearVaultKey(vaultKey);
  }
}

async function createCredential(
  pending: PendingCredential,
  vaultKey: Uint8Array,
): Promise<void> {
  const id = createResourceId();
  const data: LoginData = {
    type: "login",
    name: pending.siteName,
    notes: "",
    password: pending.credential.password,
    url: pending.credential.url,
    username: pending.credential.username,
  };
  const encryptedData = await encryptJson(
    vaultKey,
    createEncryptionContext("entry", id, pending.vaultId),
    data,
  );

  await apiRequest<StoredEntry>(`/vaults/${pending.vaultId}/entries`, {
    method: "POST",
    body: JSON.stringify({ encryptedData, folderId: null, id }),
  });
}

async function updateCredential(
  pending: PendingCredential,
  vaultKey: Uint8Array,
): Promise<void> {
  const snapshot = await loadVaultSnapshot();
  const existing = snapshot.entries.find(
    (entry) =>
      entry.id === pending.existingEntryId && entry.vaultId === pending.vaultId,
  );
  if (!existing || !isLoginEntry(existing)) {
    throw new Error("The login being updated no longer exists");
  }

  const encryptedData = await encryptJson(
    vaultKey,
    createEncryptionContext("entry", existing.id, existing.vaultId),
    {
      ...existing.data,
      password: pending.credential.password,
      url: credentialSiteKey(existing.data.url)
        ? existing.data.url
        : pending.credential.url,
      username: pending.credential.username,
    } satisfies LoginData,
  );

  await apiRequest<StoredEntry>(
    `/vaults/${existing.vaultId}/entries/${existing.id}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        encryptedData,
        folderId: existing.folderId,
      }),
    },
  );
}

async function linkCredentialWebsite(
  entry: DecryptedEntry<LoginData>,
  pageUrl: string,
): Promise<void> {
  const vaultKey = await getVaultKey();
  try {
    const encryptedData = await encryptJson(
      vaultKey,
      createEncryptionContext("entry", entry.id, entry.vaultId),
      {
        ...entry.data,
        url: normalizePageOrigin(pageUrl),
      } satisfies LoginData,
    );
    await apiRequest<StoredEntry>(
      `/vaults/${entry.vaultId}/entries/${entry.id}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          encryptedData,
          folderId: entry.folderId,
        }),
      },
    );
    clearVaultCache();
  } finally {
    clearVaultKey(vaultKey);
  }
}

async function readPending(tabId: number): Promise<PendingCredential | null> {
  const key = pendingKey(tabId);
  const stored = await browser.storage.session.get(key);
  const value = stored[key];
  if (!isPendingCredential(value) || value.expiresAt <= Date.now()) {
    await browser.storage.session.remove(key);
    return null;
  }
  return value;
}

function validateCapturedCredential(
  captured: CapturedCredential,
  trustedPageUrl: string,
): CapturedCredential {
  const password = captured.password;
  const username = captured.username.trim();
  const pageTitle = captured.pageTitle.trim();

  if (!password || password.length > 4_096) {
    throw new Error("A valid password was not detected");
  }
  if (username.length > 1_000 || pageTitle.length > 500) {
    throw new Error("The detected credential is too large");
  }

  return {
    pageTitle,
    password,
    url: normalizePageOrigin(trustedPageUrl),
    username,
  };
}

function toSummary(entry: DecryptedEntry<LoginData>): CredentialSummary {
  return {
    entryId: entry.id,
    name: entry.data.name,
    username: entry.data.username,
    vaultId: entry.vaultId,
  };
}

function urlLessEntryForPage(
  entries: DecryptedEntry[],
  pageUrl: string,
  usernameHint: string,
): DecryptedEntry<LoginData> | null {
  try {
    const url = new URL(pageUrl);
    if (url.protocol !== "https:" || url.hostname !== "accounts.google.com") {
      return null;
    }
    return entryWithoutWebsiteToUpdate(entries, usernameHint);
  } catch {
    return null;
  }
}

function toPendingSummary(
  pending: PendingCredential,
): PendingCredentialSummary {
  return {
    action: pending.action,
    id: pending.id,
    siteName: pending.siteName,
    username: pending.credential.username,
  };
}

function pendingKey(tabId: number): string {
  return `${PENDING_KEY_PREFIX}${tabId}`;
}

function usernameStepKey(tabId: number): string {
  return `${USERNAME_STEP_KEY_PREFIX}${tabId}`;
}

async function readRememberedUsername(
  tabId: number,
  pageUrl: string,
): Promise<string | null> {
  const key = usernameStepKey(tabId);
  const stored = await browser.storage.session.get(key);
  const value = stored[key];
  if (
    !isRememberedUsername(value) ||
    value.expiresAt <= Date.now() ||
    !credentialSitesMatch(value.pageUrl, pageUrl)
  ) {
    await browser.storage.session.remove(key);
    return null;
  }
  return value.username;
}

function isPendingCredential(value: unknown): value is PendingCredential {
  if (typeof value !== "object" || value === null) return false;
  const pending = value as Partial<PendingCredential>;
  return (
    ["link", "save", "update"].includes(pending.action ?? "") &&
    typeof pending.id === "string" &&
    typeof pending.tabId === "number" &&
    typeof pending.expiresAt === "number" &&
    typeof pending.vaultId === "string" &&
    typeof pending.siteName === "string" &&
    typeof pending.credential?.password === "string"
  );
}

function isRememberedUsername(value: unknown): value is RememberedUsername {
  if (typeof value !== "object" || value === null) return false;
  const remembered = value as Partial<RememberedUsername>;
  return (
    typeof remembered.username === "string" &&
    typeof remembered.pageUrl === "string" &&
    typeof remembered.expiresAt === "number"
  );
}
