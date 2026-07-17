// BOXAI: BoxAI account sign-in screen shown before the app when no session exists.
//
// The user enters their boxAI server URL and signs in through the system
// browser. The browser hands a one-time code back via the boxai-desktop://
// deep link (or manual paste), which we exchange for a token pair.

import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useRef, useState } from "react";
import { exchangeDesktopCode } from "../lib/boxaiAuth/client";
import {
  DEEP_LINK_EVENT,
  type DesktopLoginRequest,
  parseCallbackUrl,
  startDesktopLogin,
} from "../lib/boxaiAuth/login";
import { type BoxAISession, normalizeServerUrl, saveSession } from "../lib/boxaiAuth/session";

type LoginStatus = "idle" | "awaiting" | "exchanging" | "error";

type PendingLogin = DesktopLoginRequest & { serverUrl: string };

function collectCallbackUrls(payload: unknown): string[] {
  if (typeof payload === "string") return [payload];
  if (Array.isArray(payload))
    return payload.filter((item): item is string => typeof item === "string");
  return [];
}

export function BoxAILogin(props: { onAuthenticated: (session: BoxAISession) => void }) {
  const { onAuthenticated } = props;
  // Default API gateway; browser PKCE page is remapped to you-box.com/desktop-auth.
  const [serverUrl, setServerUrl] = useState("https://api.you-box.com");
  const [status, setStatus] = useState<LoginStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [manualUrl, setManualUrl] = useState("");
  const pendingRef = useRef<PendingLogin | null>(null);

  const completeCallback = useCallback(
    async (rawUrl: string) => {
      const pending = pendingRef.current;
      if (!pending) return;
      const callback = parseCallbackUrl(rawUrl);
      if (!callback) return;
      if (callback.state && pending.state && callback.state !== pending.state) {
        setStatus("error");
        setErrorMessage("Sign-in could not be verified (state mismatch). Please try again.");
        return;
      }
      setStatus("exchanging");
      setErrorMessage("");
      try {
        const bundle = await exchangeDesktopCode(pending.serverUrl, {
          code: callback.code,
          codeVerifier: pending.codeVerifier,
        });
        const session: BoxAISession = {
          serverUrl: pending.serverUrl,
          accessToken: bundle.accessToken,
          refreshToken: bundle.refreshToken,
          expiresAt: bundle.expiresAt,
          user: bundle.user,
        };
        saveSession(session);
        pendingRef.current = null;
        onAuthenticated(session);
      } catch (error) {
        setStatus("error");
        setErrorMessage(
          error instanceof Error && error.message
            ? error.message
            : "Could not complete sign-in. Please try again.",
        );
      }
    },
    [onAuthenticated],
  );

  useEffect(() => {
    let cancelled = false;
    const unlistenPromise = listen(DEEP_LINK_EVENT, (event) => {
      if (cancelled) return;
      for (const url of collectCallbackUrls(event.payload)) {
        void completeCallback(url);
      }
    });
    return () => {
      cancelled = true;
      void unlistenPromise.then((unlisten) => unlisten());
    };
  }, [completeCallback]);

  const handleSignIn = useCallback(async () => {
    const normalized = normalizeServerUrl(serverUrl);
    if (!normalized) {
      setStatus("error");
      setErrorMessage(
        "Enter a valid BoxAI server URL (for example https://api.you-box.com).",
      );
      return;
    }
    setStatus("awaiting");
    setErrorMessage("");
    try {
      const request = await startDesktopLogin(normalized);
      pendingRef.current = { ...request, serverUrl: normalized };
    } catch (error) {
      setStatus("error");
      setErrorMessage(
        error instanceof Error && error.message
          ? error.message
          : "Could not open the browser for sign-in.",
      );
    }
  }, [serverUrl]);

  const busy = status === "awaiting" || status === "exchanging";

  return (
    <div className="flex h-full w-full items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm rounded-xl border border-border/60 bg-background/70 p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-foreground">Sign in to BoxAI</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Connect BoxAI Desktop to your BoxAI account.
        </p>

        <label
          className="mt-5 block text-xs font-medium text-muted-foreground"
          htmlFor="boxai-server-url"
        >
          BoxAI server URL
        </label>
        <input
          id="boxai-server-url"
          className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
          placeholder="https://api.you-box.com"
          autoComplete="off"
          spellCheck={false}
          value={serverUrl}
          disabled={busy}
          onChange={(event) => setServerUrl(event.target.value)}
        />

        <button
          type="button"
          className="mt-4 w-full rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          disabled={busy}
          onClick={() => void handleSignIn()}
        >
          {status === "exchanging"
            ? "Completing sign-in…"
            : status === "awaiting"
              ? "Waiting for browser…"
              : "Sign in with browser"}
        </button>

        {status === "awaiting" && (
          <div className="mt-5 border-t border-border/50 pt-4">
            <p className="text-xs text-muted-foreground">
              After approving in your browser, this app should return automatically. If it does not,
              paste the redirect link below.
            </p>
            <input
              className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs text-foreground outline-none focus:border-primary"
              placeholder="boxai-desktop://auth/callback?code=…"
              value={manualUrl}
              onChange={(event) => setManualUrl(event.target.value)}
            />
            <button
              type="button"
              className="mt-2 w-full rounded-lg border border-border px-3 py-2 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-60"
              disabled={!manualUrl.trim()}
              onClick={() => void completeCallback(manualUrl)}
            >
              Complete sign-in
            </button>
          </div>
        )}

        {status === "error" && errorMessage && (
          <p className="mt-4 text-sm text-red-600 dark:text-red-400">{errorMessage}</p>
        )}
      </div>
    </div>
  );
}
