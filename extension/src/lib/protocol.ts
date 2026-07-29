import type { RuntimeRequest, RuntimeResponse } from "./types";

export function isRuntimeRequest(value: unknown): value is RuntimeRequest {
  if (!isRecord(value) || typeof value.type !== "string") return false;

  switch (value.type) {
    case "GET_STATUS":
    case "LOCK":
    case "LOGOUT":
    case "GET_PENDING_CREDENTIAL":
    case "GET_IDENTITIES":
      return true;
    case "LOGIN":
      return (
        typeof value.email === "string" &&
        typeof value.password === "string" &&
        typeof value.serverUrl === "string"
      );
    case "UNLOCK":
      return typeof value.masterPassword === "string";
    case "GET_MATCHES":
      return (
        typeof value.url === "string" &&
        (value.usernameHint === undefined ||
          typeof value.usernameHint === "string")
      );
    case "FILL_CREDENTIAL":
      return (
        typeof value.entryId === "string" &&
        typeof value.vaultId === "string" &&
        typeof value.url === "string" &&
        (value.usernameHint === undefined ||
          typeof value.usernameHint === "string") &&
        (value.tabId === undefined || Number.isInteger(value.tabId))
      );
    case "FILL_GENERATED_PASSWORD":
      return (
        typeof value.password === "string" && Number.isInteger(value.tabId)
      );
    case "FILL_IDENTITY":
      return (
        typeof value.entryId === "string" &&
        typeof value.vaultId === "string" &&
        (value.mode === "email" || value.mode === "identity") &&
        (value.tabId === undefined || Number.isInteger(value.tabId))
      );
    case "USERNAME_STEP_SUBMITTED":
      return (
        typeof value.username === "string" && typeof value.url === "string"
      );
    case "CREDENTIAL_SUBMITTED":
      return (
        isRecord(value.credential) &&
        typeof value.credential.pageTitle === "string" &&
        typeof value.credential.password === "string" &&
        typeof value.credential.url === "string" &&
        typeof value.credential.username === "string"
      );
    case "CONFIRM_PENDING_CREDENTIAL":
    case "DISMISS_PENDING_CREDENTIAL":
      return typeof value.pendingId === "string";
    default:
      return false;
  }
}

export function success<T>(data: T): RuntimeResponse<T> {
  return { ok: true, data };
}

export function failure(error: unknown): RuntimeResponse<never> {
  return {
    ok: false,
    error:
      error instanceof Error ? error.message : "Unexpected extension error",
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
