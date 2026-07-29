import type { EncryptionProfile } from "@password-manager/crypto";

export interface User {
  id: string;
  email: string;
}

export interface AuthResponse {
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
  tokenType: "Bearer";
  user: User;
}

export interface StoredEncryptionProfile extends EncryptionProfile {
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface StoredVault {
  id: string;
  encryptedData: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface StoredEntry {
  id: string;
  encryptedData: string;
  vaultId: string;
  folderId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VaultData {
  name: string;
}

export interface LoginData {
  type?: "login";
  name: string;
  username: string;
  password: string;
  url: string;
  notes: string;
}

export interface IdentityData {
  type: "identity";
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  country: string;
  addressLine1: string;
  addressLine2: string;
  region: string;
  city: string;
  postalCode: string;
  notes: string;
}

export type EntryData = LoginData | IdentityData;

export interface DecryptedVault extends StoredVault {
  data: VaultData;
}

export interface DecryptedEntry<
  T extends EntryData = EntryData,
> extends StoredEntry {
  data: T;
}

export function isIdentityData(data: EntryData): data is IdentityData {
  return data.type === "identity";
}

export function isLoginEntry(
  entry: DecryptedEntry,
): entry is DecryptedEntry<LoginData> {
  return !isIdentityData(entry.data);
}

export type ExtensionStage =
  "signed-out" | "setup-required" | "locked" | "unlocked";

export interface ExtensionStatus {
  serverUrl: string;
  stage: ExtensionStage;
  user: User | null;
}

export interface CredentialSummary {
  entryId: string;
  name: string;
  username: string;
  vaultId: string;
}

export interface IdentitySummary {
  email: string;
  entryId: string;
  name: string;
  vaultId: string;
}

export type IdentityFillMode = "email" | "identity";

export interface CapturedCredential {
  pageTitle: string;
  password: string;
  url: string;
  username: string;
}

export interface PendingCredentialSummary {
  action: "link" | "save" | "update";
  id: string;
  siteName: string;
  username: string;
}

export type RuntimeRequest =
  | { type: "GET_STATUS" }
  | {
      type: "LOGIN";
      email: string;
      password: string;
      serverUrl: string;
    }
  | { type: "UNLOCK"; masterPassword: string }
  | { type: "LOCK" }
  | { type: "LOGOUT" }
  | { type: "GET_MATCHES"; url: string; usernameHint?: string }
  | { type: "GET_IDENTITIES" }
  | {
      type: "FILL_CREDENTIAL";
      entryId: string;
      tabId?: number;
      url: string;
      usernameHint?: string;
      vaultId: string;
    }
  | {
      type: "FILL_GENERATED_PASSWORD";
      password: string;
      tabId: number;
    }
  | {
      type: "FILL_IDENTITY";
      entryId: string;
      mode: IdentityFillMode;
      tabId?: number;
      vaultId: string;
    }
  | { type: "USERNAME_STEP_SUBMITTED"; username: string; url: string }
  | { type: "CREDENTIAL_SUBMITTED"; credential: CapturedCredential }
  | { type: "GET_PENDING_CREDENTIAL" }
  | { type: "CONFIRM_PENDING_CREDENTIAL"; pendingId: string }
  | { type: "DISMISS_PENDING_CREDENTIAL"; pendingId: string };

export type RuntimeResponse<T = unknown> =
  { ok: true; data: T } | { ok: false; error: string };

export interface ApplyCredentialMessage {
  password: string;
  type: "APPLY_CREDENTIAL";
  username: string;
}

export interface ApplyGeneratedPasswordMessage {
  password: string;
  type: "APPLY_GENERATED_PASSWORD";
}

export interface GetPageUsernameHintMessage {
  type: "GET_PAGE_USERNAME_HINT";
}

export interface ApplyIdentityMessage {
  identity: IdentityData;
  mode: IdentityFillMode;
  type: "APPLY_IDENTITY";
}

export interface GetIdentityFormStatusMessage {
  type: "GET_IDENTITY_FORM_STATUS";
}

export type ContentMessage =
  | ApplyCredentialMessage
  | ApplyGeneratedPasswordMessage
  | GetPageUsernameHintMessage
  | ApplyIdentityMessage
  | GetIdentityFormStatusMessage;
