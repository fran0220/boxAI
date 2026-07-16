import { useEffect, useState } from 'react'
import { BRAND_LOGO_SVG, BRAND_NAME } from '@/lib/brand'

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

interface DownloadItem {
  label: string
  url: string
}

interface Section {
  title: string
  items: DownloadItem[]
}

const RELEASE_REPO =
  (import.meta.env.VITE_DESKTOP_RELEASE_REPO as string | undefined)?.trim() || 'fran0220/boxAI'
const DESKTOP_TAG_PREFIX = 'desktop-v'

const ASSET_LABELS: Array<{ suffix: string; section: string; label: string }> = [
  { suffix: '-macOS-aarch64.dmg', section: 'macOS', label: 'Apple Silicon (.dmg)' },
  { suffix: '-macOS-x64.dmg', section: 'macOS', label: 'Intel (.dmg)' },
  { suffix: '-Windows-x64-Setup.exe', section: 'Windows', label: 'Installer (.exe)' },
  { suffix: '-Windows-x64.msi', section: 'Windows', label: 'MSI package (.msi)' },
  { suffix: '-Windows-x64-portable.zip', section: 'Windows', label: 'Portable (.zip)' },
  { suffix: '-Linux-x86_64.AppImage', section: 'Linux', label: 'AppImage' },
  { suffix: '-Linux-x86_64.deb', section: 'Linux', label: 'Debian / Ubuntu (.deb)' },
  { suffix: '-Linux-x86_64.rpm', section: 'Linux', label: 'Fedora / RHEL (.rpm)' },
]

function buildSections(assets: ReleaseAsset[]): Section[] {
  const grouped = new Map<string, DownloadItem[]>()
  for (const mapping of ASSET_LABELS) {
    const asset = assets.find((c) => c.name.endsWith(mapping.suffix))
    if (!asset) continue
    const items = grouped.get(mapping.section) ?? []
    items.push({ label: mapping.label, url: asset.browser_download_url })
    grouped.set(mapping.section, items)
  }
  return Array.from(grouped.entries()).map(([title, items]) => ({ title, items }))
}

export function Download() {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [version, setVersion] = useState('')
  const [sections, setSections] = useState<Section[]>([])
  const releasesPageUrl = `https://github.com/${RELEASE_REPO}/releases`

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(
          `https://api.github.com/repos/${RELEASE_REPO}/releases?per_page=20`,
          { headers: { Accept: 'application/vnd.github+json' } },
        )
        if (!res.ok) throw new Error('lookup failed')
        const releases = (await res.json()) as Release[]
        const desktop = releases.find(
          (r) => !r.draft && !r.prerelease && r.tag_name.startsWith(DESKTOP_TAG_PREFIX),
        )
        if (!desktop) throw new Error('no desktop release')
        if (cancelled) return
        setVersion(desktop.tag_name.replace(DESKTOP_TAG_PREFIX, 'v'))
        setSections(buildSections(desktop.assets || []))
        setStatus('ready')
      } catch {
        if (!cancelled) setStatus('error')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <div className="text-center">
        <img src={BRAND_LOGO_SVG} alt="" className="mx-auto h-14 w-14" />
        <h1 className="mt-4 text-2xl font-semibold">Download {BRAND_NAME} Desktop</h1>
        <p className="mt-2 text-sm text-[var(--bx-text-muted)]">
          Sign in with your {BRAND_NAME} account and run AI agents on your own computer.
        </p>
        {version ? (
          <p className="mt-2 text-xs text-[var(--bx-text-dim)]">Latest version: {version}</p>
        ) : null}
      </div>

      {status === 'loading' && (
        <div className="bx-card mt-8 p-6 text-center text-sm text-[var(--bx-text-muted)]">
          Looking up the latest release…
        </div>
      )}

      {status === 'ready' &&
        sections.map((section) => (
          <div key={section.title} className="bx-card mt-6 p-6">
            <h2 className="text-lg font-semibold">{section.title}</h2>
            <div className="mt-4 flex flex-wrap gap-3">
              {section.items.map((item) => (
                <a key={item.url} href={item.url} className="bx-btn bx-btn-primary" rel="noopener">
                  {item.label}
                </a>
              ))}
            </div>
          </div>
        ))}

      {status === 'error' && (
        <div className="bx-card mt-8 p-6 text-center">
          <h2 className="text-lg font-semibold">Release lookup failed</h2>
          <p className="mt-2 text-sm text-[var(--bx-text-muted)]">
            We could not load the latest desktop release automatically.
          </p>
          <a className="bx-btn bx-btn-primary mt-6 inline-flex" href={releasesPageUrl} target="_blank" rel="noopener">
            Browse releases on GitHub
          </a>
        </div>
      )}

      {status === 'ready' && (
        <p className="mt-6 text-center text-xs text-[var(--bx-text-dim)]">
          All builds are published on{' '}
          <a href={releasesPageUrl} className="underline" target="_blank" rel="noopener">
            GitHub Releases
          </a>
          .
        </p>
      )}
    </div>
  )
}
