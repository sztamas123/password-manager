import {
  createEncryptionContext,
  createResourceId,
  decryptJson,
  encryptJson,
} from "@password-manager/crypto";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/auth-context";
import type {
  DecryptedEntry,
  DecryptedFolder,
  DecryptedVault,
  EntryData,
  FolderData,
  StoredEntry,
  StoredFolder,
  StoredVault,
  VaultData,
} from "../lib/types";

export function useVaultData() {
  const { api, getVaultKey } = useAuth();
  const [vaults, setVaults] = useState<DecryptedVault[]>([]);
  const [selectedVaultId, setSelectedVaultId] = useState<string | null>(null);
  const [folders, setFolders] = useState<DecryptedFolder[]>([]);
  const [entries, setEntries] = useState<DecryptedEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const contentRequestIdRef = useRef(0);

  const loadVaults = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const stored = await api.request<StoredVault[]>("/vaults");
      const decrypted = await Promise.all(
        stored.map((vault) => decryptVault(vault, getVaultKey())),
      );
      setVaults(decrypted);
      setSelectedVaultId((current) => {
        if (current && decrypted.some((vault) => vault.id === current)) {
          return current;
        }
        return decrypted[0]?.id ?? null;
      });
    } catch {
      setError(
        "Unable to decrypt your vault list. The data may be unavailable or modified.",
      );
    } finally {
      setLoading(false);
    }
  }, [api, getVaultKey]);

  const loadVaultContents = useCallback(
    async (vaultId: string) => {
      const requestId = contentRequestIdRef.current + 1;
      contentRequestIdRef.current = requestId;
      setLoading(true);
      setError("");

      try {
        const [storedFolders, storedEntries] = await Promise.all([
          api.request<StoredFolder[]>(`/vaults/${vaultId}/folders`),
          api.request<StoredEntry[]>(`/vaults/${vaultId}/entries`),
        ]);
        const vaultKey = getVaultKey();
        const [decryptedFolders, decryptedEntries] = await Promise.all([
          Promise.all(
            storedFolders.map((folder) => decryptFolder(folder, vaultKey)),
          ),
          Promise.all(
            storedEntries.map((entry) => decryptEntry(entry, vaultKey)),
          ),
        ]);
        if (contentRequestIdRef.current !== requestId) return;
        setFolders(decryptedFolders);
        setEntries(decryptedEntries);
      } catch {
        if (contentRequestIdRef.current !== requestId) return;
        setError(
          "Unable to decrypt this vault. Its ciphertext may have been changed.",
        );
        setFolders([]);
        setEntries([]);
      } finally {
        if (contentRequestIdRef.current === requestId) {
          setLoading(false);
        }
      }
    },
    [api, getVaultKey],
  );

  useEffect(() => {
    void loadVaults();
  }, [loadVaults]);

  useEffect(() => {
    if (selectedVaultId) {
      void loadVaultContents(selectedVaultId);
    } else {
      contentRequestIdRef.current += 1;
      setFolders([]);
      setEntries([]);
    }
  }, [loadVaultContents, selectedVaultId]);

  const createVault = useCallback(
    async (name: string): Promise<void> => {
      const id = createResourceId();
      const encryptedData = await encryptJson(
        getVaultKey(),
        createEncryptionContext("vault", id, id),
        { name } satisfies VaultData,
      );
      const stored = await api.request<StoredVault>("/vaults", {
        method: "POST",
        body: JSON.stringify({ id, encryptedData }),
      });
      const vault = await decryptVault(stored, getVaultKey());
      setVaults((current) => [...current, vault]);
      setSelectedVaultId(vault.id);
    },
    [api, getVaultKey],
  );

  const renameVault = useCallback(
    async (vaultId: string, name: string): Promise<void> => {
      const encryptedData = await encryptJson(
        getVaultKey(),
        createEncryptionContext("vault", vaultId, vaultId),
        { name } satisfies VaultData,
      );
      const stored = await api.request<StoredVault>(`/vaults/${vaultId}`, {
        method: "PATCH",
        body: JSON.stringify({ encryptedData }),
      });
      const updated = await decryptVault(stored, getVaultKey());
      setVaults((current) =>
        current.map((vault) => (vault.id === vaultId ? updated : vault)),
      );
    },
    [api, getVaultKey],
  );

  const deleteVault = useCallback(
    async (vaultId: string): Promise<void> => {
      await api.request<void>(`/vaults/${vaultId}`, { method: "DELETE" });
      const remaining = vaults.filter((vault) => vault.id !== vaultId);
      setVaults(remaining);
      setSelectedVaultId(remaining[0]?.id ?? null);
    },
    [api, vaults],
  );

  const createFolder = useCallback(
    async (name: string): Promise<void> => {
      if (!selectedVaultId) return;
      const id = createResourceId();
      const encryptedData = await encryptJson(
        getVaultKey(),
        createEncryptionContext("folder", id, selectedVaultId),
        { name } satisfies FolderData,
      );
      const stored = await api.request<StoredFolder>(
        `/vaults/${selectedVaultId}/folders`,
        {
          method: "POST",
          body: JSON.stringify({ id, encryptedData }),
        },
      );
      const folder = await decryptFolder(stored, getVaultKey());
      setFolders((current) => [...current, folder]);
    },
    [api, getVaultKey, selectedVaultId],
  );

  const saveEntry = useCallback(
    async (
      data: EntryData,
      folderId: string | null,
      entryId?: string,
    ): Promise<void> => {
      if (!selectedVaultId) return;
      const id = entryId ?? createResourceId();
      const encryptedData = await encryptJson(
        getVaultKey(),
        createEncryptionContext("entry", id, selectedVaultId),
        data,
      );

      if (entryId) {
        const stored = await api.request<StoredEntry>(
          `/vaults/${selectedVaultId}/entries/${entryId}`,
          {
            method: "PATCH",
            body: JSON.stringify({ encryptedData, folderId }),
          },
        );
        const updated = await decryptEntry(stored, getVaultKey());
        setEntries((current) =>
          current.map((entry) => (entry.id === entryId ? updated : entry)),
        );
        return;
      }

      const stored = await api.request<StoredEntry>(
        `/vaults/${selectedVaultId}/entries`,
        {
          method: "POST",
          body: JSON.stringify({ id, encryptedData, folderId }),
        },
      );
      const created = await decryptEntry(stored, getVaultKey());
      setEntries((current) => [created, ...current]);
    },
    [api, getVaultKey, selectedVaultId],
  );

  const deleteEntry = useCallback(
    async (entryId: string): Promise<void> => {
      if (!selectedVaultId) return;
      await api.request<void>(`/vaults/${selectedVaultId}/entries/${entryId}`, {
        method: "DELETE",
      });
      setEntries((current) => current.filter((entry) => entry.id !== entryId));
    },
    [api, selectedVaultId],
  );

  return {
    createFolder,
    createVault,
    deleteEntry,
    deleteVault,
    entries,
    error,
    folders,
    loading,
    renameVault,
    saveEntry,
    selectedVaultId,
    setSelectedVaultId,
    vaults,
  };
}

async function decryptVault(
  stored: StoredVault,
  vaultKey: Uint8Array,
): Promise<DecryptedVault> {
  const data = await decryptJson<VaultData>(
    vaultKey,
    createEncryptionContext("vault", stored.id, stored.id),
    stored.encryptedData,
  );
  return { ...stored, data };
}

async function decryptFolder(
  stored: StoredFolder,
  vaultKey: Uint8Array,
): Promise<DecryptedFolder> {
  const data = await decryptJson<FolderData>(
    vaultKey,
    createEncryptionContext("folder", stored.id, stored.vaultId),
    stored.encryptedData,
  );
  return { ...stored, data };
}

async function decryptEntry(
  stored: StoredEntry,
  vaultKey: Uint8Array,
): Promise<DecryptedEntry> {
  const data = await decryptJson<EntryData>(
    vaultKey,
    createEncryptionContext("entry", stored.id, stored.vaultId),
    stored.encryptedData,
  );
  return { ...stored, data };
}
