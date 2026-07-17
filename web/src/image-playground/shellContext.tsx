import { createContext, useContext, type ReactNode } from 'react'

export type PlaygroundVariant = 'default' | 'create-shell'

const PlaygroundShellContext = createContext<PlaygroundVariant>('default')

export function PlaygroundShellProvider({
  variant,
  children,
}: {
  variant: PlaygroundVariant
  children: ReactNode
}) {
  return (
    <PlaygroundShellContext.Provider value={variant}>{children}</PlaygroundShellContext.Provider>
  )
}

export function usePlaygroundShell(): PlaygroundVariant {
  return useContext(PlaygroundShellContext)
}

export function useIsCreateShell(): boolean {
  return useContext(PlaygroundShellContext) === 'create-shell'
}
