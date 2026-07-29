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

export interface StoredFolder {
  id: string;
  encryptedData: string;
  vaultId: string;
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

export interface FolderData {
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

export interface DecryptedFolder extends StoredFolder {
  data: FolderData;
}

export interface DecryptedEntry<
  T extends EntryData = EntryData,
> extends StoredEntry {
  data: T;
}

export function isIdentityData(data: EntryData): data is IdentityData {
  return data.type === "identity";
}

export function isIdentityEntry(
  entry: DecryptedEntry,
): entry is DecryptedEntry<IdentityData> {
  return isIdentityData(entry.data);
}

export function isLoginEntry(
  entry: DecryptedEntry,
): entry is DecryptedEntry<LoginData> {
  return !isIdentityData(entry.data);
}
