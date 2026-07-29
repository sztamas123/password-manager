import type { AuthResponse } from "./types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api";

type SessionListener = (session: AuthResponse | null) => void;

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

export class ApiClient {
  private session: AuthResponse | null = null;
  private refreshPromise: Promise<void> | null = null;
  private sessionListener: SessionListener = () => undefined;

  subscribe(listener: SessionListener): () => void {
    this.sessionListener = listener;
    return () => {
      this.sessionListener = () => undefined;
    };
  }

  async authenticate(
    action: "login" | "register",
    credentials: { email: string; password: string },
  ): Promise<AuthResponse> {
    const session = await this.send<AuthResponse>(
      `/auth/${action}`,
      {
        method: "POST",
        body: JSON.stringify(credentials),
      },
      false,
    );

    this.setSession(session);
    return session;
  }

  request<T>(path: string, init: RequestInit = {}): Promise<T> {
    return this.send<T>(path, init, true);
  }

  clearSession(): void {
    this.setSession(null);
  }

  private async send<T>(
    path: string,
    init: RequestInit,
    allowRefresh: boolean,
  ): Promise<T> {
    const requestAccessToken = this.session?.accessToken;
    const headers = new Headers(init.headers);
    headers.set("Accept", "application/json");

    if (init.body !== undefined) {
      headers.set("Content-Type", "application/json");
    }

    if (this.session) {
      headers.set("Authorization", `Bearer ${this.session.accessToken}`);
    }

    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers,
    });

    if (response.status === 401 && allowRefresh && this.session) {
      if (requestAccessToken !== this.session.accessToken) {
        return this.send<T>(path, init, false);
      }
      await this.refreshSession();
      return this.send<T>(path, init, false);
    }

    if (!response.ok) {
      throw await this.createError(response);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }

  private async refreshSession(): Promise<void> {
    this.refreshPromise ??= this.performRefresh().finally(() => {
      this.refreshPromise = null;
    });

    return this.refreshPromise;
  }

  private async performRefresh(): Promise<void> {
    const refreshToken = this.session?.refreshToken;
    if (!refreshToken) {
      throw new ApiError("Your session has expired", 401);
    }

    try {
      const session = await this.send<AuthResponse>(
        "/auth/refresh",
        {
          method: "POST",
          body: JSON.stringify({ refreshToken }),
        },
        false,
      );
      this.setSession(session);
    } catch (error: unknown) {
      this.clearSession();
      throw error;
    }
  }

  private setSession(session: AuthResponse | null): void {
    this.session = session;
    this.sessionListener(session);
  }

  private async createError(response: Response): Promise<ApiError> {
    let message = `Request failed with status ${response.status}`;

    try {
      const body = (await response.json()) as ErrorResponse;
      if (Array.isArray(body.message)) {
        message = body.message.join(". ");
      } else if (body.message) {
        message = body.message;
      }
    } catch {
      // A generic message is safer than exposing an unexpected response body.
    }

    return new ApiError(message, response.status);
  }
}
