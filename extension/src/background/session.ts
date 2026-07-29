import { clearVaultKey, unlockVaultKey } from "@password-manager/crypto";
import { browser } from "wxt/browser";
import type { ExtensionStatus, StoredEncryptionProfile } from "../lib/types";
import {
  ApiError,
  apiRequest,
  authenticate,
  clearAuthSession,
  getAuthSession,
  getServerUrl,
} from "./api-client";

const PROFILE_KEY = "pm.encryption-profile";
const VAULT_KEY = "pm.vault-key";
const LAST_VAULT_ID_KEY = "pm.last-vault-id";

export async function getStatus(): Promise<ExtensionStatus> {
  const [serverUrl, authSession, profile, vaultKey] = await Promise.all([
    getServerUrl(),
    getAuthSession(),
    getEncryptionProfile(),
    getStoredVaultKey(),
  ]);

  if (!authSession) {
    return { serverUrl, stage: "signed-out", user: null };
  }
  if (!profile) {
    return { serverUrl, stage: "setup-required", user: authSession.user };
  }
  if (!vaultKey) {
    return { serverUrl, stage: "locked", user: authSession.user };
  }

  clearVaultKey(vaultKey);
  return { serverUrl, stage: "unlocked", user: authSession.user };
}

export async function login(
  email: string,
  password: string,
  serverUrl: string,
): Promise<ExtensionStatus> {
  await clearUnlockedState();
  await authenticate(email.trim(), password, serverUrl);

  try {
    const profile = await apiRequest<StoredEncryptionProfile>(
      "/encryption/profile",
    );
    await browser.storage.session.set({ [PROFILE_KEY]: profile });
  } catch (error: unknown) {
    if (!(error instanceof ApiError) || error.status !== 404) {
      await logout();
      throw error;
    }
  }

  return getStatus();
}

export async function unlock(masterPassword: string): Promise<ExtensionStatus> {
  const profile = await getEncryptionProfile();
  if (!profile) {
    throw new Error("Set up a master password in the web app first");
  }

  const vaultKey = await unlockVaultKey(masterPassword, profile);
  try {
    await browser.storage.session.set({
      [VAULT_KEY]: Array.from(vaultKey),
    });
  } finally {
    clearVaultKey(vaultKey);
  }

  return getStatus();
}

export async function getVaultKey(): Promise<Uint8Array> {
  const vaultKey = await getStoredVaultKey();
  if (!vaultKey) throw new Error("Unlock the extension to continue");
  return vaultKey;
}

export async function lock(): Promise<ExtensionStatus> {
  await browser.storage.session.remove([VAULT_KEY, LAST_VAULT_ID_KEY]);
  return getStatus();
}

export async function logout(): Promise<ExtensionStatus> {
  await Promise.all([clearAuthSession(), clearUnlockedState()]);
  return getStatus();
}

export async function getLastVaultId(): Promise<string | null> {
  const stored = await browser.storage.session.get(LAST_VAULT_ID_KEY);
  const value = stored[LAST_VAULT_ID_KEY];
  return typeof value === "string" ? value : null;
}

export async function setLastVaultId(vaultId: string): Promise<void> {
  await browser.storage.session.set({ [LAST_VAULT_ID_KEY]: vaultId });
}

async function clearUnlockedState(): Promise<void> {
  await browser.storage.session.remove([
    PROFILE_KEY,
    VAULT_KEY,
    LAST_VAULT_ID_KEY,
  ]);
}

async function getEncryptionProfile(): Promise<StoredEncryptionProfile | null> {
  const stored = await browser.storage.session.get(PROFILE_KEY);
  const value = stored[PROFILE_KEY];

  if (isEncryptionProfile(value)) return value;

  if (!(await getAuthSession())) return null;

  try {
    const profile = await apiRequest<StoredEncryptionProfile>(
      "/encryption/profile",
    );
    await browser.storage.session.set({ [PROFILE_KEY]: profile });
    return profile;
  } catch (error: unknown) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

async function getStoredVaultKey(): Promise<Uint8Array | null> {
  const stored = await browser.storage.session.get(VAULT_KEY);
  const value = stored[VAULT_KEY];

  if (
    !Array.isArray(value) ||
    value.length !== 32 ||
    !value.every((byte) => Number.isInteger(byte) && byte >= 0 && byte <= 255)
  ) {
    return null;
  }

  return new Uint8Array(value as number[]);
}

function isEncryptionProfile(value: unknown): value is StoredEncryptionProfile {
  if (typeof value !== "object" || value === null) return false;
  const profile = value as Partial<StoredEncryptionProfile>;
  return (
    profile.version === 1 &&
    profile.kdfAlgorithm === "argon2id" &&
    typeof profile.kdfSalt === "string" &&
    typeof profile.wrappedVaultKey === "string"
  );
}
