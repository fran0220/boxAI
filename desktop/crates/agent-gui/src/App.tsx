import type { Context } from "@earendil-works/pi-ai";
import { listen } from "@tauri-apps/api/event";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppErrorBoundary } from "./components/AppErrorBoundary";
import { BoxAILogin } from "./components/BoxAILogin";
import { CronPromptRunner } from "./components/cron/CronPromptRunner";
import { MemoryOrganizerHost } from "./components/memory/useMemoryOrganizer";
import { WindowsTitleBar } from "./components/WindowsTitleBar";
import { LocaleContext, t as translate } from "./i18n";
import { type AppUpdateController, useAppUpdateController } from "./lib/appUpdates";
import { initAutomation } from "./lib/automation";
import { fetchGatewayModels, refreshSessionTokens } from "./lib/boxaiAuth/client";
import {
  type BoxAIModelCatalog,
  clearCachedCatalog,
  loadCachedCatalog,
  saveCachedCatalog,
} from "./lib/boxaiAuth/models";
import { buildBoxAIProviders, providersMatchSession } from "./lib/boxaiAuth/provider";
import {
  type BoxAISession,
  clearSession,
  isAccessTokenExpired,
  loadSession,
  saveSession,
} from "./lib/boxaiAuth/session";
import {
  type AppSettings,
  getDefaultSettings,
  getNextTheme,
  normalizeSettings,
  resolveEffectiveTheme,
  resolveWorkspaceProjects,
  subscribeToSystemThemePreference,
} from "./lib/settings";
import {
  loadPersistedSettingsWithDefaults,
  persistSettings,
  publishGatewaySettingsSync,
  type SettingsSaveState,
} from "./lib/settings/storage";
import {
  applyGatewaySettingsSyncPayload,
  buildGatewaySettingsSyncPayload,
  type GatewaySettingsSyncPayload,
} from "./lib/settings/sync";
import { ChatPage } from "./pages/ChatPage";
import { SettingsPage } from "./pages/SettingsPage";
import type { SectionId } from "./pages/settings/types";

function getDefaultContext(): Context {
  return {
    messages: [],
  };
}

function asErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  const text = String(error ?? "").trim();
  return text || fallback;
}

const GATEWAY_SETTINGS_SYNC_EVENT = "gateway:settings-sync";

function AppChrome(props: { children: ReactNode; appUpdate?: AppUpdateController }) {
  return (
    <div
      className="relative flex h-full w-full flex-col overflow-hidden bg-background"
      onContextMenu={(event) => {
        event.preventDefault();
      }}
    >
      <WindowsTitleBar appUpdate={props.appUpdate} />
      <div className="relative min-h-0 flex-1 overflow-hidden bg-background">{props.children}</div>
    </div>
  );
}

function hasSettingsSyncChanged(prev: AppSettings, next: AppSettings) {
  return (
    JSON.stringify(buildGatewaySettingsSyncPayload(prev)) !==
    JSON.stringify(buildGatewaySettingsSyncPayload(next))
  );
}

function hasSensitiveSettingsUpdates(settings: AppSettings) {
  return (
    settings.customProviders.some((provider) => provider.apiKey.trim().length > 0) ||
    settings.ssh.hosts.some(
      (host) => host.password.trim().length > 0 || host.privateKey.trim().length > 0,
    )
  );
}

function hasSensitiveSettingsUpdatesPayload(payload: unknown) {
  const source =
    payload && typeof payload === "object" && !Array.isArray(payload)
      ? (payload as { providerApiKeyUpdates?: unknown; sshSecretUpdates?: unknown })
      : {};
  const providerUpdates = source.providerApiKeyUpdates;
  if (
    providerUpdates &&
    typeof providerUpdates === "object" &&
    !Array.isArray(providerUpdates) &&
    Object.values(providerUpdates).some(
      (value) => typeof value === "string" && value.trim().length > 0,
    )
  ) {
    return true;
  }
  const sshUpdates = source.sshSecretUpdates;
  return Boolean(
    sshUpdates &&
      typeof sshUpdates === "object" &&
      !Array.isArray(sshUpdates) &&
      Object.values(sshUpdates).some((value) => {
        if (!value || typeof value !== "object" || Array.isArray(value)) return false;
        const update = value as { password?: unknown; privateKey?: unknown };
        return (
          (typeof update.password === "string" && update.password.trim().length > 0) ||
          (typeof update.privateKey === "string" && update.privateKey.trim().length > 0)
        );
      }),
  );
}

function applyRuntimeSystemDefaults(settings: AppSettings, defaultWorkdir: string): AppSettings {
  const normalizedDefaultWorkdir = defaultWorkdir.trim();
  const system =
    !normalizedDefaultWorkdir || settings.system.workdir.trim()
      ? settings.system
      : {
          ...settings.system,
          workdir: normalizedDefaultWorkdir,
        };
  return normalizeSettings({
    ...settings,
    system: resolveWorkspaceProjects(system, normalizedDefaultWorkdir),
  });
}

export default function App() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState<SectionId>("system");
  const [settingsReady, setSettingsReady] = useState(false);
  const [settings, setSettingsState] = useState<AppSettings>(() => getDefaultSettings());
  const [settingsSaveState, setSettingsSaveState] = useState<SettingsSaveState>({
    status: "idle",
  });
  const [context, setContext] = useState<Context>(() => getDefaultContext());
  const [overlay, setOverlay] = useState<"closed" | "entering" | "open" | "leaving">("closed");
  // BOXAI: BoxAI account session gates the app; null renders the login screen.
  const [session, setSession] = useState<BoxAISession | null>(() => loadSession());
  // BOXAI: gateway-advertised model catalog (cached; curated lists as fallback).
  const [modelCatalog, setModelCatalog] = useState<BoxAIModelCatalog | null>(null);

  const saveSequenceRef = useRef(0);
  const saveChainRef = useRef<Promise<unknown>>(Promise.resolve());
  const defaultWorkdirRef = useRef("");
  // Mirrors `settings` so setSettings/queueSettingsSave can read the latest value
  // synchronously without passing a (side-effecting) function into setSettingsState —
  // React 18 StrictMode double-invokes functional state updaters in development,
  // which would otherwise run those side effects (and any non-idempotent work like
  // crypto.randomUUID() inside caller updaters) twice per call.
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const [systemThemeVersion, setSystemThemeVersion] = useState(0);
  const effectiveTheme = useMemo(
    () => resolveEffectiveTheme(settings.theme),
    [settings.theme, systemThemeVersion],
  );

  useEffect(() => {
    if (settings.theme !== "system") return;
    return subscribeToSystemThemePreference(() => {
      setSystemThemeVersion((version) => version + 1);
    });
  }, [settings.theme]);

  // 同步主题 class 到 <html> 根节点
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", effectiveTheme === "dark");
  }, [effectiveTheme]);

  // BOXAI: keep the access token fresh for the whole app session (it doubles as
  // the gateway credential). Schedules a refresh shortly before expiry; transient
  // failures retry each minute, and an unusable token drops back to the login.
  useEffect(() => {
    if (!session) return;
    if (!session.refreshToken) {
      if (isAccessTokenExpired(session)) {
        clearSession();
        setSession(null);
      }
      return;
    }
    if (!session.expiresAt) return;

    const REFRESH_SKEW_MS = 5 * 60_000;
    const RETRY_MS = 60_000;
    let cancelled = false;
    let timer: number | undefined;

    const refresh = async () => {
      try {
        const refreshed = await refreshSessionTokens(session.serverUrl, session.refreshToken);
        if (cancelled) return;
        const next: BoxAISession = {
          ...session,
          accessToken: refreshed.accessToken,
          refreshToken: refreshed.refreshToken,
          expiresAt: refreshed.expiresAt,
        };
        saveSession(next);
        setSession(next);
      } catch {
        if (cancelled) return;
        if (isAccessTokenExpired(session)) {
          clearSession();
          setSession(null);
        } else {
          timer = window.setTimeout(() => void refresh(), RETRY_MS);
        }
      }
    };

    const delay = Math.max(session.expiresAt - REFRESH_SKEW_MS - Date.now(), 0);
    timer = window.setTimeout(() => void refresh(), delay);
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [session]);

  // BOXAI: hydrate the model catalog from cache, then refresh it from the
  // gateway (/v1/models via the JWT bridge); failures keep cache/fallback.
  useEffect(() => {
    if (!session) {
      setModelCatalog(null);
      return;
    }
    const cached = loadCachedCatalog(session.serverUrl);
    setModelCatalog((prev) => (JSON.stringify(prev) === JSON.stringify(cached) ? prev : cached));
    let cancelled = false;
    void (async () => {
      try {
        const models = await fetchGatewayModels(session.serverUrl, session.accessToken);
        if (cancelled || models.length === 0) return;
        saveCachedCatalog(session.serverUrl, models);
        setModelCatalog((prev) =>
          JSON.stringify(prev) === JSON.stringify(models) ? prev : models,
        );
      } catch {
        // Offline or unauthorized: keep the cached/curated catalog.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session]);

  useEffect(() => {
    let cancelled = false;

    async function hydrateSettings() {
      try {
        const { settings: loaded, defaultWorkdir } = await loadPersistedSettingsWithDefaults();
        if (!cancelled) {
          defaultWorkdirRef.current = defaultWorkdir;
          const loadedWithDefaults = applyRuntimeSystemDefaults(loaded, defaultWorkdir);
          settingsRef.current = loadedWithDefaults;
          setSettingsState(loadedWithDefaults);
          setSettingsSaveState({ status: "saved" });
          void publishGatewaySettingsSync(loadedWithDefaults).catch((error) => {
            console.error("publish gateway settings sync failed", error);
          });
        }
      } catch (error) {
        if (!cancelled) {
          const fallback = getDefaultSettings();
          settingsRef.current = fallback;
          setSettingsState(fallback);
          setSettingsSaveState({
            status: "error",
            message: asErrorMessage(error, "加载设置失败，已回退到默认配置。"),
          });
        }
      } finally {
        if (!cancelled) {
          setSettingsReady(true);
        }
      }
    }

    void hydrateSettings();
    return () => {
      cancelled = true;
    };
  }, []);

  const queueSettingsSave = useCallback(
    (prev: AppSettings, next: AppSettings, fallback: string, publishSync: boolean) => {
      const saveSequence = ++saveSequenceRef.current;
      setSettingsSaveState({ status: "saving" });

      saveChainRef.current = saveChainRef.current
        .catch(() => undefined)
        .then(() => persistSettings(prev, next))
        .then(async (persistResult) => {
          const publishTarget = persistResult.ssh
            ? normalizeSettings({
                ...next,
                ssh: persistResult.ssh,
              })
            : next;
          if (persistResult.ssh && saveSequenceRef.current === saveSequence) {
            const merged = normalizeSettings({
              ...settingsRef.current,
              ssh: persistResult.ssh,
            });
            settingsRef.current = merged;
            setSettingsState(merged);
          }
          if (persistResult.conflict) {
            throw new Error(persistResult.conflict);
          }
          if (publishSync) {
            await publishGatewaySettingsSync(publishTarget);
          }
        })
        .then(() => {
          if (saveSequenceRef.current === saveSequence) {
            setSettingsSaveState({ status: "saved" });
          }
        })
        .catch((error) => {
          if (saveSequenceRef.current === saveSequence) {
            setSettingsSaveState({
              status: "error",
              message: asErrorMessage(error, fallback),
            });
          }
        });
    },
    [],
  );

  const setSettings = useCallback(
    (updater: (prev: AppSettings) => AppSettings) => {
      const prev = settingsRef.current;
      const updated = updater(prev);
      if (updated === prev) return;
      const next = applyRuntimeSystemDefaults(
        normalizeSettings(updated),
        defaultWorkdirRef.current,
      );
      settingsRef.current = next;
      setSettingsState(next);
      queueSettingsSave(
        prev,
        next,
        "保存设置失败。",
        hasSettingsSyncChanged(prev, next) || hasSensitiveSettingsUpdates(next),
      );
    },
    [queueSettingsSave],
  );

  // Authoritative live read for tool write paths: settingsRef is updated
  // synchronously by setSettings, so read-modify-write sequences that stay in
  // one synchronous segment can never observe a stale snapshot.
  const getMcpSettings = useCallback(() => settingsRef.current.mcp, []);

  const reloadPersistedSettings = useCallback(async () => {
    await saveChainRef.current.catch(() => undefined);
    const { settings: loaded, defaultWorkdir } = await loadPersistedSettingsWithDefaults();
    defaultWorkdirRef.current = defaultWorkdir;
    const loadedWithDefaults = applyRuntimeSystemDefaults(loaded, defaultWorkdir);
    settingsRef.current = loadedWithDefaults;
    setSettingsState(loadedWithDefaults);
    setSettingsSaveState({ status: "saved" });
  }, []);

  const toggleTheme = useCallback(() => {
    setSettings((prev) => ({
      ...prev,
      theme: getNextTheme(prev.theme),
    }));
  }, [setSettings]);

  const openSettings = useCallback(
    (section: SectionId = "system") => {
      setSettingsSection(section);
      setSettingsOpen(true);
      setOverlay("entering");
      requestAnimationFrame(() => requestAnimationFrame(() => setOverlay("open")));
      void reloadPersistedSettings().catch((error) => {
        setSettingsSaveState({
          status: "error",
          message: asErrorMessage(error, "重新加载设置失败，当前显示的是旧配置。"),
        });
      });
    },
    [reloadPersistedSettings],
  );

  const closeSettings = useCallback(() => {
    setOverlay("leaving");
  }, []);

  // BOXAI: sign out of the BoxAI account and return to the login screen.
  const handleLogout = useCallback(() => {
    clearSession();
    clearCachedCatalog();
    setSession(null);
    setSettingsOpen(false);
    setOverlay("closed");
  }, []);

  const handleTransitionEnd = useCallback(() => {
    if (overlay === "leaving") {
      setSettingsOpen(false);
      setOverlay("closed");
    }
  }, [overlay]);

  // 构建 locale context value，避免每次渲染重新创建
  const localeContextValue = useMemo(
    () => ({
      locale: settings.locale,
      t: (key: string) => translate(key, settings.locale),
    }),
    [settings.locale],
  );

  const appUpdateMessages = useMemo(
    () => ({
      checkFailed: translate("settings.aboutUpdateCheckFailed", settings.locale),
      installFailed: translate("settings.aboutUpdateInstallFailed", settings.locale),
      restartFailed: translate("settings.aboutRestartFailed", settings.locale),
    }),
    [settings.locale],
  );

  const appUpdate = useAppUpdateController({
    enabled: settingsReady,
    includePrereleases: settings.updates.includePrereleases,
    messages: appUpdateMessages,
  });

  useEffect(() => {
    if (!settingsReady) return;
    void initAutomation().catch((error) => {
      console.warn("Failed to initialize automation store", error);
    });
  }, [settingsReady]);

  // BOXAI: reconcile the two locked BoxAI providers (and a valid selected model)
  // from the account session. Runs only when the session or ready state changes;
  // no-ops once the persisted providers already match (see providersMatchSession).
  useEffect(() => {
    if (!settingsReady || !session) return;
    setSettings((prev) => {
      const desired = buildBoxAIProviders(session, modelCatalog);
      const providersOk = providersMatchSession(prev.customProviders, session, modelCatalog);
      const selection = prev.selectedModel;
      const selectionValid =
        !!selection &&
        desired.some(
          (provider) =>
            provider.id === selection.customProviderId &&
            provider.activeModels.includes(selection.model),
        );
      if (providersOk && selectionValid) return prev;
      const selectedModel = selectionValid
        ? selection
        : { customProviderId: desired[0].id, model: desired[0].activeModels[0] };
      return { ...prev, customProviders: desired, selectedModel };
    });
  }, [session, settingsReady, setSettings, modelCatalog]);

  useEffect(() => {
    if (!settingsReady) {
      return;
    }

    let cancelled = false;
    const unlistenPromise = listen<GatewaySettingsSyncPayload>(
      GATEWAY_SETTINGS_SYNC_EVENT,
      (event) => {
        if (cancelled) {
          return;
        }

        const prev = settingsRef.current;
        const next = applyRuntimeSystemDefaults(
          applyGatewaySettingsSyncPayload(prev, event.payload),
          defaultWorkdirRef.current,
        );
        const publicChanged = hasSettingsSyncChanged(prev, next);
        if (!publicChanged && !hasSensitiveSettingsUpdatesPayload(event.payload)) {
          return;
        }
        settingsRef.current = next;
        setSettingsState(next);
        queueSettingsSave(prev, next, "同步 WebUI 设置失败。", publicChanged);
      },
    );

    return () => {
      cancelled = true;
      void unlistenPromise.then((unlisten) => unlisten());
    };
  }, [queueSettingsSave, settingsReady]);

  if (!session) {
    return (
      <LocaleContext.Provider value={localeContextValue}>
        <AppChrome appUpdate={appUpdate}>
          <BoxAILogin onAuthenticated={setSession} />
        </AppChrome>
      </LocaleContext.Provider>
    );
  }

  if (!settingsReady) {
    return (
      <LocaleContext.Provider value={localeContextValue}>
        <AppChrome appUpdate={appUpdate}>
          <div className="flex h-full w-full items-center justify-center bg-background text-sm text-muted-foreground">
            {translate("chat.loading", settings.locale)}
          </div>
        </AppChrome>
      </LocaleContext.Provider>
    );
  }

  const visible = settingsOpen;
  const active = overlay === "open";

  return (
    <LocaleContext.Provider value={localeContextValue}>
      <AppChrome appUpdate={appUpdate}>
        <CronPromptRunner settings={settings} />
        <MemoryOrganizerHost settings={settings} setSettings={setSettings} />
        <AppErrorBoundary>
          <ChatPage
            settings={settings}
            setSettings={setSettings}
            getMcpSettings={getMcpSettings}
            context={context}
            setContext={setContext}
            onOpenSettings={openSettings}
            onToggleTheme={toggleTheme}
            appUpdate={appUpdate}
          />
        </AppErrorBoundary>
        {visible && (
          <div
            className={`absolute inset-0 z-50 transition-all duration-300 ease-out ${
              active ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
            }`}
            onTransitionEnd={handleTransitionEnd}
          >
            <AppErrorBoundary>
              <SettingsPage
                settings={settings}
                setSettings={setSettings}
                saveState={settingsSaveState}
                onBack={closeSettings}
                initialSection={settingsSection}
                hiddenSections={["providers"]}
                account={{
                  serverUrl: session.serverUrl,
                  user: session.user,
                  onLogout: handleLogout,
                }}
                appUpdate={appUpdate}
              />
            </AppErrorBoundary>
          </div>
        )}
      </AppChrome>
    </LocaleContext.Provider>
  );
}
