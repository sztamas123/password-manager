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

export interface EntryData {
  name: string;
  username: string;
  password: string;
  url: string;
  notes: string;
}

export interface DecryptedVault extends StoredVault {
  data: VaultData;
}

export interface DecryptedFolder extends StoredFolder {
  data: FolderData;
}

export interface DecryptedEntry extends StoredEntry {
  data: EntryData;
}
