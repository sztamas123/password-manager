import { browser } from "wxt/browser";
import type { AuthResponse } from "../lib/types";

const AUTH_SESSION_KEY = "pm.auth-session";
const SERVER_URL_KEY = "pm.server-url";
const DEFAULT_SERVER_URL =
  import.meta.env.WXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

interface ErrorResponse {
  message?: string | string[];
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

let refreshPromise: Promise<AuthResponse> | null = null;

export async function getServerUrl(): Promise<string> {
  const stored = await browser.storage.local.get(SERVER_URL_KEY);
  const value = stored[SERVER_URL_KEY];
  return typeof value === "string"
    ? normalizeServerUrl(value)
    : normalizeServerUrl(DEFAULT_SERVER_URL);
}

export async function authenticate(
  email: string,
  password: string,
  serverUrl: string,
): Promise<AuthResponse> {
  const normalizedServerUrl = normalizeServerUrl(serverUrl);
  const response = await send<AuthResponse>(
    normalizedServerUrl,
    "/auth/login",
    {
      method: "POST",
      body: JSON.stringify({ email, password }),
    },
    null,
  );

  await Promise.all([
    browser.storage.local.set({ [SERVER_URL_KEY]: normalizedServerUrl }),
    setAuthSession(response),
  ]);
  return response;
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const serverUrl = await getServerUrl();
  const session = await getAuthSession();
  if (!session) throw new ApiError("Sign in to continue", 401);

  try {
    return await send<T>(serverUrl, path, init, session.accessToken);
  } catch (error: unknown) {
    if (!(error instanceof ApiError) || error.status !== 401) throw error;

    const refreshed = await refreshAuthSession(serverUrl);
    return send<T>(serverUrl, path, init, refreshed.accessToken);
  }
}

export async function getAuthSession(): Promise<AuthResponse | null> {
  const stored = await browser.storage.session.get(AUTH_SESSION_KEY);
  const value = stored[AUTH_SESSION_KEY];
  return isAuthResponse(value) ? value : null;
}

export async function clearAuthSession(): Promise<void> {
  await browser.storage.session.remove(AUTH_SESSION_KEY);
}

async function refreshAuthSession(serverUrl: string): Promise<AuthResponse> {
  refreshPromise ??= performRefresh(serverUrl).finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

async function performRefresh(serverUrl: string): Promise<AuthResponse> {
  const session = await getAuthSession();
  if (!session) throw new ApiError("Your session has expired", 401);

  try {
    const refreshed = await send<AuthResponse>(
      serverUrl,
      "/auth/refresh",
      {
        method: "POST",
        body: JSON.stringify({ refreshToken: session.refreshToken }),
      },
      null,
    );
    await setAuthSession(refreshed);
    return refreshed;
  } catch (error: unknown) {
    await clearAuthSession();
    throw error;
  }
}

async function setAuthSession(session: AuthResponse): Promise<void> {
  await browser.storage.session.set({ [AUTH_SESSION_KEY]: session });
}

async function send<T>(
  serverUrl: string,
  path: string,
  init: RequestInit,
  accessToken: string | null,
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");

  if (init.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  const response = await fetch(`${serverUrl}${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) throw await createError(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

async function createError(response: Response): Promise<ApiError> {
  let message = `Request failed with status ${response.status}`;

  try {
    const body = (await response.json()) as ErrorResponse;
    if (Array.isArray(body.message)) {
      message = body.message.join(". ");
    } else if (body.message) {
      message = body.message;
    }
  } catch {
    // Do not expose an unexpected response body.
  }

  return new ApiError(message, response.status);
}

function normalizeServerUrl(value: string): string {
  let parsed: URL;

  try {
    parsed = new URL(value.trim());
  } catch {
    throw new Error("Enter a valid server URL");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("The server URL must use HTTP or HTTPS");
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error("The server URL cannot contain credentials or parameters");
  }

  return parsed.toString().replace(/\/$/u, "");
}

function isAuthResponse(value: unknown): value is AuthResponse {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<AuthResponse>;
  return (
    typeof candidate.accessToken === "string" &&
    typeof candidate.refreshToken === "string" &&
    typeof candidate.user?.id === "string" &&
    typeof candidate.user.email === "string"
  );
}
