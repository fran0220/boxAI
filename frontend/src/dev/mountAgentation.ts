/**
 * Dev-only visual annotation toolbar (Agentation).
 * React component mounted beside the Vue app — never loaded in production builds.
 *
 * Docs: https://github.com/benjitaylor/agentation
 * MCP sync (optional): pnpm agentation:mcp  →  http://localhost:4747
 */
import { createElement, type ComponentType } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import {
  Agentation,
  type AgentationProps,
  type Annotation
} from 'agentation'

const ROOT_ID = 'agentation-root'

let reactRoot: Root | null = null

export function mountAgentation(): void {
  if (typeof document === 'undefined') return
  if (document.getElementById(ROOT_ID)) return

  const host = document.createElement('div')
  host.id = ROOT_ID
  // Keep out of Vue #app so router remounts never wipe the toolbar
  document.body.appendChild(host)

  const endpoint =
    (import.meta.env.VITE_AGENTATION_ENDPOINT as string | undefined)?.trim() ||
    'http://localhost:4747'

  const props: AgentationProps = {
    // Sync with agentation-mcp when the local server is running; toolbar still works offline.
    endpoint,
    onAnnotationAdd: (annotation: Annotation) => {
      console.info('[agentation] annotation added', annotation)
    },
    onCopy: (markdown: string) => {
      console.info('[agentation] copied markdown for agent:\n', markdown)
    }
  }

  // Agentation is a React function component; cast keeps createElement props typed under vue-tsc.
  const Toolbar = Agentation as ComponentType<AgentationProps>

  reactRoot = createRoot(host)
  reactRoot.render(createElement(Toolbar, props))

  console.info(
    `[agentation] toolbar ready (endpoint=${endpoint}). Optional MCP: pnpm agentation:mcp`
  )
}

export function unmountAgentation(): void {
  if (reactRoot) {
    reactRoot.unmount()
    reactRoot = null
  }
  document.getElementById(ROOT_ID)?.remove()
}
