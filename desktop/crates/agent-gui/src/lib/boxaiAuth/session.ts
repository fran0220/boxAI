// BOXAI: BoxAI Desktop account session (persisted locally).
//
// The desktop authenticates against a self-hosted boxAI server; the session
// holds the server URL plus the account token pair used both for /api/v1 calls
// and, via the gateway JWT bridge, as the model-gateway credential.

export type BoxAISessionUser = {
  id: number;
  email?: string;
  username?: string;
  role?: string;
};

export type BoxAISession = {
  serverUrl: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  user: BoxAISessionUser;
};

const SESSION_STORAGE_KEY = "boxai_desktop_session_v1";

export function normalizeServerUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withScheme);
    const normalized = `${url.protocol}//${url.host}${url.pathname}`.replace(/\/+$/, "");
    return normalized;
  } catch {
    return "";
  }
}

function isSessionUser(value: unknown): value is BoxAISessionUser {
  if (!value || typeof value !== "object") return false;
  const user = value as Record<string, unknown>;
  return typeof user.id === "number";
}

export function loadSession(): BoxAISession | null {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const serverUrl = typeof parsed.serverUrl === "string" ? parsed.serverUrl : "";
    const accessToken = typeof parsed.accessToken === "string" ? parsed.accessToken : "";
    const refreshToken = typeof parsed.refreshToken === "string" ? parsed.refreshToken : "";
    const expiresAt = typeof parsed.expiresAt === "number" ? parsed.expiresAt : 0;
    if (!serverUrl || !accessToken || !isSessionUser(parsed.user)) return null;
    return { serverUrl, accessToken, refreshToken, expiresAt, user: parsed.user };
  } catch {
    return null;
  }
}

export function saveSession(session: BoxAISession): void {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_STORAGE_KEY);
}

export function isAccessTokenExpired(session: BoxAISession, skewMs = 60_000): boolean {
  if (!session.expiresAt) return false;
  return Date.now() >= session.expiresAt - skewMs;
}
