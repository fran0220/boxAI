import { useCallback, useEffect, useRef, useState } from "react";

import { normalizeGatewayAccessToken, verifyGatewayAccessToken } from "@/lib/gatewayAuth";
import { resetGatewayWebSocketClient } from "@/lib/gatewaySocket";
import {
  configuredAgentParentOrigin,
  isTrustedAgentParentAuthMessage,
  resolveAgentParentAuthMessage,
  type AgentAuthRequestMessage,
} from "@/lib/parentAuthHandoff";
import { clearToken, loadToken, saveToken } from "@/lib/storage";

import { asErrorMessage } from "../chatEventUtils";

export function useGatewaySession(historyShareToken: string | null) {
  const parentOrigin = configuredAgentParentOrigin(
    import.meta.env.VITE_BOXAI_PARENT_ORIGIN as string | undefined,
  );
  const acceptsParentHandoff = Boolean(
    !historyShareToken && parentOrigin && window.parent !== window,
  );
  const initialStoredTokenRef = useRef(
    historyShareToken ?? (acceptsParentHandoff ? "" : loadToken()),
  );
  const [token, setToken] = useState("");
  const [loginToken, setLoginToken] = useState(initialStoredTokenRef.current);
  const [authSubmitting, setAuthSubmitting] = useState(
    () => acceptsParentHandoff || normalizeGatewayAccessToken(initialStoredTokenRef.current) !== "",
  );
  const [authError, setAuthError] = useState<string | null>(null);
  const injectedTokenEpochRef = useRef(0);

  useEffect(() => {
    if (!parentOrigin || !acceptsParentHandoff) return;

    const receiveToken = (event: MessageEvent<unknown>) => {
      // Reject synchronously before advancing the epoch: an unrelated window
      // must not be able to invalidate an in-flight trusted verification.
      if (!isTrustedAgentParentAuthMessage(event, window.parent, parentOrigin)) return;

      const epoch = ++injectedTokenEpochRef.current;
      void resolveAgentParentAuthMessage(
        event,
        window.parent,
        parentOrigin,
        normalizeGatewayAccessToken,
        verifyGatewayAccessToken,
      )
        .then((result) => {
          if (injectedTokenEpochRef.current !== epoch) return;
          if (result.kind === "ignored") return;
          resetGatewayWebSocketClient();
          if (result.kind === "clear") {
            setToken("");
            setAuthSubmitting(false);
            setAuthError(null);
            return;
          }
          // Parent-injected credentials intentionally remain in React memory only.
          setLoginToken("");
          setToken(result.token);
        })
        .catch((error) => {
          if (injectedTokenEpochRef.current !== epoch) return;
          resetGatewayWebSocketClient();
          setToken("");
          setAuthError(asErrorMessage(error, "Access Token 验证失败。"));
        })
        .finally(() => {
          if (injectedTokenEpochRef.current === epoch) setAuthSubmitting(false);
        });

      setAuthSubmitting(true);
      setAuthError(null);
    };

    window.addEventListener("message", receiveToken);
    const request: AgentAuthRequestMessage = { type: "boxai.agent.auth.request", version: 1 };
    window.parent.postMessage(request, parentOrigin);
    return () => window.removeEventListener("message", receiveToken);
  }, [acceptsParentHandoff, parentOrigin]);

  useEffect(() => {
    const storedToken = normalizeGatewayAccessToken(initialStoredTokenRef.current);
    if (!storedToken) {
      return;
    }

    let cancelled = false;
    setAuthError(null);
    resetGatewayWebSocketClient();

    void verifyGatewayAccessToken(storedToken)
      .then((verifiedToken) => {
        if (cancelled) {
          return;
        }
        initialStoredTokenRef.current = verifiedToken;
        saveToken(verifiedToken);
        setLoginToken(verifiedToken);
        setToken(verifiedToken);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        initialStoredTokenRef.current = "";
        clearToken();
        resetGatewayWebSocketClient();
        setToken("");
        setAuthError(asErrorMessage(error, "Access Token 验证失败。"));
        setLoginToken(storedToken);
      })
      .finally(() => {
        if (!cancelled) {
          setAuthSubmitting(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async () => {
    const draftToken = loginToken;
    const normalizedToken = normalizeGatewayAccessToken(draftToken);
    if (!normalizedToken) {
      setAuthError("请输入 Access Token。");
      return;
    }

    setAuthSubmitting(true);
    setAuthError(null);
    resetGatewayWebSocketClient();

    try {
      const verifiedToken = await verifyGatewayAccessToken(draftToken);
      initialStoredTokenRef.current = verifiedToken;
      saveToken(verifiedToken);
      setLoginToken(verifiedToken);
      setToken(verifiedToken);
    } catch (error) {
      initialStoredTokenRef.current = "";
      clearToken();
      resetGatewayWebSocketClient();
      setToken("");
      setAuthError(asErrorMessage(error, "Access Token 验证失败。"));
    } finally {
      setAuthSubmitting(false);
    }
  }, [loginToken]);

  const clearSession = useCallback(() => {
    clearToken();
    resetGatewayWebSocketClient();
    initialStoredTokenRef.current = "";
    setAuthSubmitting(false);
    setAuthError(null);
    setLoginToken("");
    setToken("");
  }, []);

  return {
    token,
    loginToken,
    authSubmitting,
    authError,
    setToken,
    setLoginToken,
    setAuthError,
    login,
    clearSession,
  };
}
