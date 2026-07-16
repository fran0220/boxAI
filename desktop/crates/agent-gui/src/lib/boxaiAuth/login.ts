// BOXAI: desktop browser-login orchestration.
//
// Flow: generate PKCE, open the system browser at <server>/desktop-auth, and
// wait for the boxAI web app to redirect back to our custom scheme
// (boxai-desktop://auth/callback?code=...&state=...). The redirect is delivered
// to the app either through the OS deep-link plugin (emitted to the frontend as
// DEEP_LINK_EVENT) or, as a fallback, pasted manually by the user.

import { openUrl } from "@tauri-apps/plugin-opener";
import { deriveCodeChallenge, generateCodeVerifier, generateState } from "./pkce";

export const DESKTOP_REDIRECT_URI = "boxai-desktop://auth/callback";
export const DEEP_LINK_EVENT = "boxai://auth-callback";

export type DesktopLoginRequest = {
  state: string;
  codeVerifier: string;
};

export type DesktopCallback = {
  code: string;
  state: string;
};

function buildAuthorizeUrl(serverUrl: string, state: string, codeChallenge: string): string {
  const params = new URLSearchParams({
    state,
    code_challenge: codeChallenge,
    redirect_uri: DESKTOP_REDIRECT_URI,
  });
  return `${serverUrl}/desktop-auth?${params.toString()}`;
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
