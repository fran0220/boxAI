/**
 * BOXAI embed: disable upstream GitHub release polling.
 */
export interface LatestRelease {
  tag: string
  url: string
}

export function useVersionCheck(): {
  hasUpdate: boolean
  latestRelease: LatestRelease | null
  dismiss: () => void
} {
  return {
    hasUpdate: false,
    latestRelease: null,
    dismiss: () => {},
  }
}
