<!-- BOXAI: public download page for the BoxAI Desktop app.
     Lists the assets of the newest desktop-v* GitHub release. The release
     repository can be overridden with VITE_DESKTOP_RELEASE_REPO. -->
<template>
  <div class="bx-page min-h-screen px-4 py-10">
    <div class="mx-auto max-w-3xl">
      <div class="text-center">
        <img :src="BRAND_LOGO_SVG" :alt="BRAND_NAME" class="mx-auto h-14 w-14" />
        <h1 class="mt-4 text-2xl font-semibold text-[color:var(--bx-text)]">
          Download {{ BRAND_NAME }} Desktop
        </h1>
        <p class="mt-2 text-sm text-[color:var(--bx-text-muted)]">
          Sign in with your {{ BRAND_NAME }} account and run AI agents on your own computer.
        </p>
        <p v-if="version" class="mt-2 text-xs text-[color:var(--bx-text-muted)]">
          Latest version: {{ version }}
        </p>
      </div>

      <div v-if="status === 'loading'" class="card mt-8 p-6 text-center">
        <div class="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary-500 border-t-transparent"></div>
        <p class="mt-4 text-sm text-[color:var(--bx-text-muted)]">Looking up the latest release…</p>
      </div>

      <template v-else-if="status === 'ready'">
        <div v-for="section in sections" :key="section.title" class="card mt-6 p-6">
          <h2 class="text-lg font-semibold text-[color:var(--bx-text)]">{{ section.title }}</h2>
          <div class="mt-4 flex flex-wrap gap-3">
            <a
              v-for="item in section.items"
              :key="item.url"
              :href="item.url"
              class="btn btn-primary"
              rel="noopener"
            >
              {{ item.label }}
            </a>
          </div>
        </div>
        <p class="mt-6 text-center text-xs text-[color:var(--bx-text-muted)]">
          All builds are published on
          <a :href="releasesPageUrl" class="underline" target="_blank" rel="noopener">GitHub Releases</a>.
        </p>
      </template>

      <div v-else class="card mt-8 p-6 text-center">
        <h2 class="text-lg font-semibold text-[color:var(--bx-text)]">Release lookup failed</h2>
        <p class="mt-2 text-sm text-[color:var(--bx-text-muted)]">
          We could not load the latest desktop release automatically.
        </p>
        <a class="btn btn-primary mt-6 inline-block" :href="releasesPageUrl" target="_blank" rel="noopener">
          Browse releases on GitHub
        </a>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { BRAND_LOGO_SVG, BRAND_NAME } from '@/constants/brand'

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

interface DownloadSection {
  title: string
  items: DownloadItem[]
}

const RELEASE_REPO =
  (import.meta.env.VITE_DESKTOP_RELEASE_REPO as string | undefined)?.trim() || 'fran0220/boxAI'
const DESKTOP_TAG_PREFIX = 'desktop-v'

const status = ref<'loading' | 'ready' | 'error'>('loading')
const version = ref('')
const sections = ref<DownloadSection[]>([])

const releasesPageUrl = computed(() => `https://github.com/${RELEASE_REPO}/releases`)

const ASSET_LABELS: Array<{ suffix: string; section: string; label: string }> = [
  { suffix: '-macOS-aarch64.dmg', section: 'macOS', label: 'Apple Silicon (.dmg)' },
  { suffix: '-macOS-x64.dmg', section: 'macOS', label: 'Intel (.dmg)' },
  { suffix: '-Windows-x64-Setup.exe', section: 'Windows', label: 'Installer (.exe)' },
  { suffix: '-Windows-x64.msi', section: 'Windows', label: 'MSI package (.msi)' },
  { suffix: '-Windows-x64-portable.zip', section: 'Windows', label: 'Portable (.zip)' },
  { suffix: '-Linux-x86_64.AppImage', section: 'Linux', label: 'AppImage' },
  { suffix: '-Linux-x86_64.deb', section: 'Linux', label: 'Debian / Ubuntu (.deb)' },
  { suffix: '-Linux-x86_64.rpm', section: 'Linux', label: 'Fedora / RHEL (.rpm)' }
]

function buildSections(assets: ReleaseAsset[]): DownloadSection[] {
  const grouped = new Map<string, DownloadItem[]>()
  for (const mapping of ASSET_LABELS) {
    const asset = assets.find((candidate) => candidate.name.endsWith(mapping.suffix))
    if (!asset) continue
    const items = grouped.get(mapping.section) ?? []
    items.push({ label: mapping.label, url: asset.browser_download_url })
    grouped.set(mapping.section, items)
  }
  return Array.from(grouped.entries()).map(([title, items]) => ({ title, items }))
}

onMounted(async () => {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${RELEASE_REPO}/releases?per_page=30`,
      { headers: { Accept: 'application/vnd.github+json' } }
    )
    if (!response.ok) throw new Error(`release lookup failed with status ${response.status}`)
    const releases = (await response.json()) as Release[]
    const release = releases.find(
      (candidate) =>
        !candidate.draft &&
        !candidate.prerelease &&
        candidate.tag_name.startsWith(DESKTOP_TAG_PREFIX)
    )
    if (!release) throw new Error('no desktop release found')

    const builtSections = buildSections(release.assets)
    if (builtSections.length === 0) throw new Error('desktop release has no known assets')

    version.value = release.tag_name.slice(DESKTOP_TAG_PREFIX.length)
    sections.value = builtSections
    status.value = 'ready'
  } catch {
    status.value = 'error'
  }
})
</script>
