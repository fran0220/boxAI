// BOXAI: desktop browser-login orchestration.
//
// Flow: generate PKCE, open the system browser at the customer-shell
// desktop-auth page (production: https://you-box.com/desktop-auth), and
// wait for the boxAI web app to redirect back to our custom scheme
// (boxai-desktop://auth/callback?code=...&state=...). The redirect is delivered
// to the app either through the OS deep-link plugin (emitted to the frontend as
// DEEP_LINK_EVENT) or, as a fallback, pasted manually by the user.
//
// Token exchange and /v1 inference still use the configured serverUrl
// (api/console/self-host). Only the browser authorize page is remapped to apex
// for known production hosts. Console `/desktop-auth` remains for old clients.

import { openUrl } from "@tauri-apps/plugin-opener";
import { deriveCodeChallenge, generateCodeVerifier, generateState } from "./pkce";

export const DESKTOP_REDIRECT_URI = "boxai-desktop://auth/callback";
export const DEEP_LINK_EVENT = "boxai://auth-callback";

/** Production customer shell (apex) — preferred browser PKCE page host. */
export const PRODUCTION_BROWSER_AUTH_ORIGIN = "https://you-box.com";

export type DesktopLoginRequest = {
  state: string;
  codeVerifier: string;
};

export type DesktopCallback = {
  code: string;
  state: string;
};

/**
 * Map API/console production hosts to apex for the browser authorize page.
 * Self-hosted and unknown hosts keep serverUrl (page at {server}/desktop-auth).
 * Old clients that open console.you-box.com/desktop-auth directly still work.
 */
export function resolveDesktopBrowserAuthOrigin(serverUrl: string): string {
  try {
    const url = new URL(serverUrl);
    const host = url.hostname.toLowerCase();
    if (host === "api.you-box.com" || host === "console.you-box.com" || host === "you-box.com" || host === "www.you-box.com") {
      return PRODUCTION_BROWSER_AUTH_ORIGIN;
    }
  } catch {
    /* fall through */
  }
  return serverUrl.replace(/\/+$/, "");
}

function buildAuthorizeUrl(serverUrl: string, state: string, codeChallenge: string): string {
  const params = new URLSearchParams({
    state,
    code_challenge: codeChallenge,
    redirect_uri: DESKTOP_REDIRECT_URI,
  });
  const origin = resolveDesktopBrowserAuthOrigin(serverUrl);
  return `${origin}/desktop-auth?${params.toString()}`;
}

// Kick off login: open the browser and return the pending state/verifier that
// the caller must retain to validate and complete the callback.
export async function startDesktopLogin(serverUrl: string): Promise<DesktopLoginRequest> {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await deriveCodeChallenge(codeVerifier);
  const state = generateState();
  await openUrl(buildAuthorizeUrl(serverUrl, state, codeChallenge));
  return { state, codeVerifier };
}

// Parse a callback URL (from the deep link or a manual paste) into its parts.
export function parseCallbackUrl(raw: string): DesktopCallback | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    const code = url.searchParams.get("code") ?? "";
    const state = url.searchParams.get("state") ?? "";
    if (!code) return null;
    return { code, state };
  } catch {
    return null;
  }
}
