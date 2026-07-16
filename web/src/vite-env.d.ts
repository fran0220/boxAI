/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE?: string
  readonly VITE_CONSOLE_ORIGIN?: string
  readonly VITE_DEV_PROXY_TARGET?: string
  readonly VITE_DEV_PORT?: string
  readonly VITE_DESKTOP_RELEASE_REPO?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
