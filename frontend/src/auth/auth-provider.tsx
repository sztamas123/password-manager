import {
  clearVaultKey,
  createEncryptionProfile,
  unlockVaultKey,
  type EncryptionProfile,
} from "@password-manager/crypto";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ApiClient, ApiError } from "../lib/api-client";
import type { AuthResponse, StoredEncryptionProfile, User } from "../lib/types";
import {
  AuthContext,
  type AuthContextValue,
  type AuthStage,
} from "./auth-context";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [stage, setStage] = useState<AuthStage>("signed-out");
  const [user, setUser] = useState<User | null>(null);
  const profileRef = useRef<EncryptionProfile | null>(null);
  const vaultKeyRef = useRef<Uint8Array | null>(null);
  const [api] = useState(() => new ApiClient());

  useEffect(
    () =>
      api.subscribe((session: AuthResponse | null) => {
        setUser(session?.user ?? null);
        if (!session) {
          clearKey(vaultKeyRef);
          profileRef.current = null;
          setStage("signed-out");
        }
      }),
    [api],
  );

  const authenticate = useCallback(
    async (
      action: "login" | "register",
      email: string,
      password: string,
    ): Promise<void> => {
      await api.authenticate(action, { email, password });

      if (action === "register") {
        profileRef.current = null;
        setStage("setup");
        return;
      }

      try {
        profileRef.current = await api.request<StoredEncryptionProfile>(
          "/encryption/profile",
        );
        setStage("locked");
      } catch (error: unknown) {
        if (error instanceof ApiError && error.status === 404) {
          profileRef.current = null;
          setStage("setup");
          return;
        }

        api.clearSession();
        throw error;
      }
    },
    [api],
  );

  const setupMasterPassword = useCallback(
    async (masterPassword: string): Promise<void> => {
      const created = await createEncryptionProfile(masterPassword);

      try {
        const stored = await api.request<StoredEncryptionProfile>(
          "/encryption/profile",
          {
            method: "POST",
            body: JSON.stringify(created.profile),
          },
        );
        profileRef.current = stored;
        clearKey(vaultKeyRef);
        vaultKeyRef.current = created.vaultKey;
        setStage("unlocked");
      } catch (error: unknown) {
        clearVaultKey(created.vaultKey);
        throw error;
      }
    },
    [api],
  );

  const unlock = useCallback(async (masterPassword: string): Promise<void> => {
    if (!profileRef.current) {
      throw new Error("Your encryption profile is unavailable");
    }

    const vaultKey = await unlockVaultKey(masterPassword, profileRef.current);
    clearKey(vaultKeyRef);
    vaultKeyRef.current = vaultKey;
    setStage("unlocked");
  }, []);

  const getVaultKey = useCallback((): Uint8Array => {
    if (!vaultKeyRef.current) {
      throw new Error("The vault is locked");
    }

    return vaultKeyRef.current;
  }, []);

  const lock = useCallback((): void => {
    clearKey(vaultKeyRef);
    setStage("locked");
  }, []);

  const logout = useCallback((): void => {
    clearKey(vaultKeyRef);
    profileRef.current = null;
    api.clearSession();
  }, [api]);

  const value = useMemo<AuthContextValue>(
    () => ({
      api,
      stage,
      user,
      authenticate,
      setupMasterPassword,
      unlock,
      getVaultKey,
      lock,
      logout,
    }),
    [
      api,
      stage,
      user,
      authenticate,
      setupMasterPassword,
      unlock,
      getVaultKey,
      lock,
      logout,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function clearKey(reference: { current: Uint8Array | null }): void {
  if (reference.current) {
    clearVaultKey(reference.current);
    reference.current = null;
  }
}
