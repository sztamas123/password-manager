import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiClient, ApiError } from "./api-client";
import type { AuthResponse } from "./types";

const initialSession: AuthResponse = {
  accessToken: "access-one",
  expiresIn: 900,
  refreshToken: "refresh-one",
  tokenType: "Bearer",
  user: {
    email: "user@example.com",
    id: "bd1f329a-e9f1-4d57-9c23-7b2a0a791e38",
  },
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ApiClient", () => {
  it("keeps authentication in memory and notifies the session owner", async () => {
    const listener = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(initialSession));
    vi.stubGlobal("fetch", fetchMock);
    const api = new ApiClient();
    api.subscribe(listener);

    await api.authenticate("login", {
      email: "user@example.com",
      password: "account password",
    });

    expect(listener).toHaveBeenCalledWith(initialSession);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/auth/login");
  });

  it("rotates the refresh token and retries one unauthorized request", async () => {
    const rotatedSession = {
      ...initialSession,
      accessToken: "access-two",
      refreshToken: "refresh-two",
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(initialSession))
      .mockResolvedValueOnce(jsonResponse({ message: "expired" }, 401))
      .mockResolvedValueOnce(jsonResponse(rotatedSession))
      .mockResolvedValueOnce(jsonResponse([{ id: "vault-id" }]));
    vi.stubGlobal("fetch", fetchMock);
    const api = new ApiClient();

    await api.authenticate("login", {
      email: "user@example.com",
      password: "account password",
    });
    const vaults = await api.request<Array<{ id: string }>>("/vaults");

    expect(vaults).toEqual([{ id: "vault-id" }]);
    const refreshOptions = fetchMock.mock.calls[2]?.[1] as RequestInit;
    expect(refreshOptions.body).toBe(
      JSON.stringify({ refreshToken: "refresh-one" }),
    );
    const retriedOptions = fetchMock.mock.calls[3]?.[1] as RequestInit;
    expect(new Headers(retriedOptions.headers).get("Authorization")).toBe(
      "Bearer access-two",
    );
  });

  it("clears the session when refresh-token rotation fails", async () => {
    const listener = vi.fn();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(initialSession))
      .mockResolvedValueOnce(jsonResponse({ message: "expired" }, 401))
      .mockResolvedValueOnce(jsonResponse({ message: "invalid token" }, 401));
    vi.stubGlobal("fetch", fetchMock);
    const api = new ApiClient();
    api.subscribe(listener);

    await api.authenticate("login", {
      email: "user@example.com",
      password: "account password",
    });

    await expect(api.request("/vaults")).rejects.toBeInstanceOf(ApiError);
    expect(listener).toHaveBeenLastCalledWith(null);
  });
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
