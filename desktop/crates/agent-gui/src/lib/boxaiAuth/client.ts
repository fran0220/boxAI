// BOXAI: HTTP client for the boxAI account API used by desktop login/session.

import type { BoxAISessionUser } from "./session";

const API_PREFIX = "/api/v1";

export type TokenBundle = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  user: BoxAISessionUser;
};

type RawUser = {
  id?: unknown;
  email?: unknown;
  username?: unknown;
  role?: unknown;
};

type RawAuthPayload = {
  access_token?: unknown;
  refresh_token?: unknown;
  expires_in?: unknown;
  user?: RawUser;
};

function unwrapEnvelope<T>(body: unknown): T {
  if (body && typeof body === "object" && "data" in (body as Record<string, unknown>)) {
    return (body as { data: T }).data;
  }
  return body as T;
}

function toSessionUser(raw: RawUser | undefined): BoxAISessionUser {
  const id = typeof raw?.id === "number" ? raw.id : Number(raw?.id ?? 0);
  return {
    id: Number.isFinite(id) ? id : 0,
    email: typeof raw?.email === "string" ? raw.email : undefined,
    username: typeof raw?.username === "string" ? raw.username : undefined,
    role: typeof raw?.role === "string" ? raw.role : undefined,
  };
}

function expiresAtFrom(expiresIn: unknown): number {
  const seconds = typeof expiresIn === "number" ? expiresIn : Number(expiresIn ?? 0);
  return Number.isFinite(seconds) && seconds > 0 ? Date.now() + seconds * 1000 : 0;
}

async function postJson(serverUrl: string, path: string, body: unknown): Promise<unknown> {
  const response = await fetch(`${serverUrl}${API_PREFIX}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let parsed: unknown;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = undefined;
    }
  }
  if (!response.ok) {
    const message =
      parsed &&
      typeof parsed === "object" &&
      typeof (parsed as { message?: unknown }).message === "string"
        ? (parsed as { message: string }).message
        : `Request failed with status ${response.status}`;
    throw new Error(message);
  }
  return parsed;
}

function toTokenBundle(payload: RawAuthPayload): TokenBundle {
  const accessToken = typeof payload.access_token === "string" ? payload.access_token : "";
  if (!accessToken) {
    throw new Error("Server did not return an access token");
  }
  return {
    accessToken,
    refreshToken: typeof payload.refresh_token === "string" ? payload.refresh_token : "",
    expiresAt: expiresAtFrom(payload.expires_in),
    user: toSessionUser(payload.user),
  };
}

// Exchange a one-time desktop auth code + PKCE verifier for a token pair.
export async function exchangeDesktopCode(
  serverUrl: string,
  params: { code: string; codeVerifier: string },
): Promise<TokenBundle> {
  const body = await postJson(serverUrl, "/auth/boxai/desktop/token", {
    code: params.code,
    code_verifier: params.codeVerifier,
  });
  return toTokenBundle(unwrapEnvelope<RawAuthPayload>(body));
}

// List the model IDs the gateway serves for this account. The JWT is accepted
// directly by /v1/* thanks to the backend's desktop JWT-as-credential bridge.
export async function fetchGatewayModels(
  serverUrl: string,
  accessToken: string,
): Promise<string[]> {
  const response = await fetch(`${serverUrl}/v1/models`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new Error(`Failed to list models (status ${response.status})`);
  }
  const body = (await response.json()) as { data?: unknown };
  const data = Array.isArray(body?.data) ? body.data : [];
  const ids = data
    .map((item) => (item && typeof item === "object" ? (item as { id?: unknown }).id : undefined))
    .filter((id): id is string => typeof id === "string" && id.trim().length > 0);
  return [...new Set(ids)];
}

// Refresh an access token using the stored refresh token.
export async function refreshSessionTokens(
  serverUrl: string,
  refreshToken: string,
): Promise<{ accessToken: string; refreshToken: string; expiresAt: number }> {
  const body = await postJson(serverUrl, "/auth/refresh", { refresh_token: refreshToken });
  const payload = unwrapEnvelope<RawAuthPayload>(body);
  const accessToken = typeof payload.access_token === "string" ? payload.access_token : "";
  if (!accessToken) {
    throw new Error("Server did not return an access token");
  }
  return {
    accessToken,
    refreshToken: typeof payload.refresh_token === "string" ? payload.refresh_token : refreshToken,
    expiresAt: expiresAtFrom(payload.expires_in),
  };
}
