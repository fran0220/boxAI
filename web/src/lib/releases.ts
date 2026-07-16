/** BoxAI Desktop release lookup on GitHub Releases (`desktop-v*` tags). */

interface ReleaseAsset {
  name: string
  browser_download_url: string
}

interface Release {
  tag_name: string
  draft: boolean
  prerelease: boolean
  assets: ReleaseAsset[]
}

export type PlatformName = 'macOS' | 'Windows' | 'Linux'

export interface DownloadItem {
  label: string
  url: string
}

export interface PlatformSection {
  title: PlatformName
  items: DownloadItem[]
}

export interface DesktopRelease {
  version: string
  sections: PlatformSection[]
}

export const RELEASE_REPO =
  (import.meta.env.VITE_DESKTOP_RELEASE_REPO as string | undefined)?.trim() || 'fran0220/boxAI'

export const RELEASES_PAGE_URL = `https://github.com/${RELEASE_REPO}/releases`

const DESKTOP_TAG_PREFIX = 'desktop-v'

const ASSET_LABELS: Array<{ suffix: string; section: PlatformName; label: string }> = [
  { suffix: '-macOS-aarch64.dmg', section: 'macOS', label: 'Apple Silicon (.dmg)' },
  { suffix: '-macOS-x64.dmg', section: 'macOS', label: 'Intel (.dmg)' },
  { suffix: '-Windows-x64-Setup.exe', section: 'Windows', label: 'Installer (.exe)' },
  { suffix: '-Windows-x64.msi', section: 'Windows', label: 'MSI (.msi)' },
  { suffix: '-Windows-x64-portable.zip', section: 'Windows', label: 'Portable (.zip)' },
  { suffix: '-Linux-x86_64.AppImage', section: 'Linux', label: 'AppImage' },
  { suffix: '-Linux-x86_64.deb', section: 'Linux', label: 'Debian / Ubuntu (.deb)' },
  { suffix: '-Linux-x86_64.rpm', section: 'Linux', label: 'Fedora / RHEL (.rpm)' },
]

function buildSections(assets: ReleaseAsset[]): PlatformSection[] {
  const grouped = new Map<PlatformName, DownloadItem[]>()
  for (const mapping of ASSET_LABELS) {
    const asset = assets.find((a) => a.name.endsWith(mapping.suffix))
    if (!asset) continue
    const items = grouped.get(mapping.section) ?? []
    items.push({ label: mapping.label, url: asset.browser_download_url })
    grouped.set(mapping.section, items)
  }
  return Array.from(grouped.entries()).map(([title, items]) => ({ title, items }))
}

export async function fetchDesktopRelease(): Promise<DesktopRelease> {
  const res = await fetch(`https://api.github.com/repos/${RELEASE_REPO}/releases?per_page=20`, {
    headers: { Accept: 'application/vnd.github+json' },
  })
  if (!res.ok) throw new Error('release lookup failed')
  const releases = (await res.json()) as Release[]
  const desktop = releases.find(
    (r) => !r.draft && !r.prerelease && r.tag_name.startsWith(DESKTOP_TAG_PREFIX),
  )
  if (!desktop) throw new Error('no desktop release')
  return {
    version: desktop.tag_name.replace(DESKTOP_TAG_PREFIX, 'v'),
    sections: buildSections(desktop.assets || []),
  }
}

export function detectPlatform(): PlatformName {
  if (typeof navigator === 'undefined') return 'macOS'
  const ua = navigator.userAgent.toLowerCase()
  if (ua.includes('windows')) return 'Windows'
  if (ua.includes('linux') && !ua.includes('android')) return 'Linux'
  return 'macOS'
}
