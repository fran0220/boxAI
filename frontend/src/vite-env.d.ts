/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string
  /** Dev-only: Vite proxy target for /api /v1 /setup /health */
  readonly VITE_DEV_PROXY_TARGET?: string
  readonly VITE_DEV_PORT?: string
  /** Dev-only: Agentation MCP HTTP endpoint (default http://localhost:4747) */
  readonly VITE_AGENTATION_ENDPOINT?: string
  readonly BASE_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module '*.md?raw' {
  const content: string
  export default content
}
