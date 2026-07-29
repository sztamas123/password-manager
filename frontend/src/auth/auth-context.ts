import { createContext, useContext } from "react";
import type { ApiClient } from "../lib/api-client";
import type { User } from "../lib/types";

export type AuthStage = "signed-out" | "setup" | "locked" | "unlocked";

export interface AuthContextValue {
  api: ApiClient;
  stage: AuthStage;
  user: User | null;
  authenticate: (
    action: "login" | "register",
    email: string,
    password: string,
  ) => Promise<void>;
  setupMasterPassword: (masterPassword: string) => Promise<void>;
  unlock: (masterPassword: string) => Promise<void>;
  getVaultKey: () => Uint8Array;
  lock: () => void;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}
