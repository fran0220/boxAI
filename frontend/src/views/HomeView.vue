<template>
  <!-- Custom Home Content: Full Page Mode -->
  <div v-if="homeContent" class="min-h-screen">
    <iframe
      v-if="isHomeContentUrl"
      :src="homeContent.trim()"
      class="h-screen w-full border-0"
      allowfullscreen
    ></iframe>
    <div v-else v-html="homeContent"></div>
  </div>

  <!-- Platform homepage (north-star design) -->
  <!-- overflow-x only: vertical overflow-hidden clipped language dropdown -->
  <div v-else class="bx-home relative min-h-screen overflow-x-hidden">
    <!-- Ambient background -->
    <div class="bx-ambient pointer-events-none absolute inset-0 z-0" aria-hidden="true">
      <div class="bx-aurora bx-aurora-1"></div>
      <div class="bx-aurora bx-aurora-2"></div>
      <div class="bx-aurora bx-aurora-3"></div>
      <div class="bx-grid"></div>
    </div>

    <div class="relative z-10 mx-auto max-w-[1200px] px-5 sm:px-8 lg:px-10">
      <!-- Nav -->
      <nav class="relative z-30 flex items-center justify-between py-5 sm:py-[22px]">
        <div class="flex items-center gap-3">
          <img
            :src="siteLogo || brandLogo"
            :alt="siteName"
            class="h-[34px] w-[34px] object-contain"
          />
          <span class="text-[21px] font-bold tracking-tight text-[color:var(--bx-text)]">{{
            siteName
          }}</span>
        </div>

        <div class="flex items-center gap-2 sm:gap-4">
          <div
            class="hidden items-center gap-[30px] text-sm font-medium text-[color:var(--bx-text-soft)] md:flex"
          >
            <a href="#pillars" class="transition hover:text-[color:var(--bx-teal-bright)]">{{
              t('home.nav.gateway')
            }}</a>
            <a href="#pillars" class="transition hover:text-[color:var(--bx-teal-bright)]">{{
              t('home.nav.chat')
            }}</a>
            <a href="#pillars" class="transition hover:text-[color:var(--bx-teal-bright)]">{{
              t('home.nav.generate')
            }}</a>
            <a href="#pillars" class="transition hover:text-[color:var(--bx-teal-bright)]">{{
              t('home.nav.client')
            }}</a>
          </div>

          <LocaleSwitcher />

          <button
            type="button"
            class="flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-[color:var(--bx-hover)]"
            style="color: var(--bx-text-muted)"
            :title="isDark ? t('home.switchToLight') : t('home.switchToDark')"
            :aria-label="isDark ? t('home.switchToLight') : t('home.switchToDark')"
            @click="toggleTheme"
          >
            <Icon v-if="isDark" name="sun" size="md" />
            <Icon v-else name="moon" size="md" />
          </button>

          <router-link
            v-if="isAuthenticated"
            :to="dashboardPath"
            class="bx-btn-primary inline-flex items-center rounded-[10px] px-4 py-2 text-sm font-bold"
          >
            {{ t('home.dashboard') }} →
          </router-link>
          <router-link
            v-else
            to="/login"
            class="bx-btn-primary inline-flex items-center rounded-[10px] px-4 py-2 text-sm font-bold sm:px-5"
          >
            {{ t('home.nav.enter') }} →
          </router-link>
        </div>
      </nav>

      <!-- Hero -->
      <header
        class="relative grid min-h-[min(90vh,820px)] grid-cols-1 items-center gap-10 overflow-hidden py-10 md:gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:py-16"
      >
        <div class="text-center lg:text-left">
          <div
            class="mb-7 inline-flex items-center gap-2 rounded-lg border border-[color:rgba(45,212,191,0.25)] bg-[color:var(--bx-bg-elevated)] px-3.5 py-1.5 text-xs font-medium tracking-[0.1em] text-[color:var(--bx-teal-bright)] backdrop-blur-sm"
          >
            {{ t('home.heroSubtitle') }}
          </div>
          <h1 class="mb-6 font-extrabold tracking-tight">
            <span
              class="mb-1 block text-[clamp(1.75rem,4vw,2.5rem)] font-bold tracking-tight text-[color:var(--bx-text)]"
            >
              {{ t('home.heroLine1') }}
            </span>
            <span
              class="bx-hero-gradient block text-[clamp(2.75rem,8vw,5.25rem)] font-extrabold leading-[0.96] tracking-tighter"
            >
              {{ t('home.heroLine2') }}
            </span>
          </h1>
          <p
            class="mx-auto mb-10 max-w-[420px] text-lg leading-relaxed text-[color:var(--bx-text-muted)] lg:mx-0"
          >
            {{ siteSubtitle || t('home.heroDescription') }}
          </p>
          <div class="flex flex-col items-center gap-3 sm:flex-row lg:justify-start">
            <router-link
              :to="isAuthenticated ? dashboardPath : '/login'"
              class="bx-btn-primary inline-flex items-center rounded-[10px] px-11 py-4 text-base font-bold shadow-[var(--bx-shadow-cta)] transition hover:-translate-y-0.5"
            >
              {{ isAuthenticated ? t('home.goToDashboard') : t('home.getStarted') }} →
            </router-link>
            <router-link
              v-if="!isAuthenticated"
              to="/register"
              class="inline-flex items-center rounded-[10px] border border-[color:var(--bx-border-strong)] bg-white/[0.04] px-6 py-3.5 text-sm font-semibold text-[color:var(--bx-text-soft)] transition hover:border-[color:rgba(45,212,191,0.4)] hover:text-[color:var(--bx-teal-bright)]"
            >
              {{ t('home.cta.button') }}
            </router-link>
          </div>
        </div>

        <!-- Exploded logo animation -->
        <div class="relative flex items-center justify-center">
          <div class="bx-logo-glow absolute"></div>
          <svg
            viewBox="0 0 128 128"
            class="relative h-auto w-full max-w-[460px]"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="bx-face" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#14b8a6" />
                <stop offset="100%" stop-color="#06b6d4" />
              </linearGradient>
              <linearGradient id="bx-top" x1="0%" y1="100%" x2="100%" y2="0%">
                <stop offset="0%" stop-color="#2dd4bf" />
                <stop offset="100%" stop-color="#22d3ee" />
              </linearGradient>
              <linearGradient id="bx-sparkg" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#5eead4" />
                <stop offset="100%" stop-color="#67e8f9" />
              </linearGradient>
              <filter id="bx-glowf" x="-40%" y="-40%" width="180%" height="180%">
                <feGaussianBlur stdDeviation="1.6" result="b" />
                <feMerge>
                  <feMergeNode in="b" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <path
              class="bx-face-l"
              d="M36 52 L64 68 L64 100 L36 84 Z"
              fill="url(#bx-face)"
              opacity="0.94"
            />
            <path
              class="bx-face-r"
              d="M64 68 L92 52 L92 84 L64 100 Z"
              fill="#0d9488"
              opacity="0.96"
            />
            <path
              class="bx-face-top"
              d="M36 52 L64 36 L92 52 L64 68 Z"
              fill="url(#bx-top)"
              opacity="0.9"
            />
            <path
              class="bx-face-top"
              d="M44 54 L64 42 L84 54 L64 66 Z"
              fill="#042f2e"
              opacity="0.4"
            />
            <g filter="url(#bx-glowf)">
              <path
                class="bx-line"
                d="M64 50 L48 30"
                stroke="#14b8a6"
                stroke-width="2.5"
                stroke-linecap="round"
              />
              <path
                class="bx-line bx-line-d1"
                d="M64 50 L64 22"
                stroke="#06b6d4"
                stroke-width="2.5"
                stroke-linecap="round"
              />
              <path
                class="bx-line bx-line-d2"
                d="M64 50 L80 30"
                stroke="#14b8a6"
                stroke-width="2.5"
                stroke-linecap="round"
              />
              <circle class="bx-node" cx="48" cy="30" r="3.5" fill="#14b8a6" />
              <circle class="bx-node bx-node-d1" cx="64" cy="22" r="3.5" fill="#06b6d4" />
              <circle class="bx-node bx-node-d2" cx="80" cy="30" r="3.5" fill="#14b8a6" />
              <circle class="bx-spark" cx="64" cy="50" r="5" fill="url(#bx-sparkg)" />
            </g>
          </svg>
        </div>
      </header>

      <!-- Pillars -->
      <section id="pillars" class="pb-10 pt-[78px]">
        <div class="mb-8 flex flex-col gap-2 sm:mb-[34px] sm:flex-row sm:items-baseline sm:justify-between">
          <h2 class="m-0 text-[clamp(1.75rem,4vw,2.5rem)] font-extrabold tracking-tight">
            {{ t('home.pillars.title') }}
          </h2>
          <span class="text-xs tracking-[0.1em] text-[color:var(--bx-text-dim)]">{{
            t('home.pillars.subtitle')
          }}</span>
        </div>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <article
            v-for="(p, i) in pillars"
            :key="p.key"
            class="bx-card group rounded-xl border border-[color:var(--bx-border)] bg-[color:var(--bx-bg-card)] p-7 backdrop-blur-md transition duration-250 hover:-translate-y-1 hover:border-[color:rgba(45,212,191,0.4)] hover:bg-[color:var(--bx-bg-card-hover)]"
          >
            <div
              class="mb-5 h-[46px] w-[46px] rounded-[11px] shadow-[0_0_26px_-6px_var(--bx-teal)]"
              :class="pillarGradients[i % pillarGradients.length]"
            ></div>
            <h3 class="mb-2 text-xl font-bold">{{ p.title }}</h3>
            <p class="m-0 text-sm leading-relaxed text-[color:var(--bx-text-muted)]">
              {{ p.desc }}
            </p>
          </article>
        </div>
      </section>

      <!-- Models marquee -->
      <section class="py-10 sm:py-12">
        <div
          class="mb-6 text-center text-xs tracking-[0.12em] text-[color:var(--bx-text-dim)]"
        >
          {{ t('home.modelsSupported') }}
        </div>
        <div class="bx-marquee-mask relative overflow-hidden">
          <div class="bx-marquee-track flex w-max gap-3.5">
            <span
              v-for="(m, idx) in modelChipsDouble"
              :key="`${m}-${idx}`"
              class="whitespace-nowrap rounded-lg border border-[color:var(--bx-border-strong)] bg-white/[0.05] px-6 py-2.5 text-[15px] font-semibold"
              :class="m === '+ more' ? 'border-dashed text-[color:var(--bx-text-dim)]' : ''"
            >
              {{ m }}
            </span>
          </div>
        </div>
      </section>

      <!-- CTA band -->
      <section id="cta" class="pb-16 pt-12 sm:pb-[72px] sm:pt-[60px]">
        <div class="bx-cta-ring rounded-2xl p-[2px]">
          <div
            class="relative overflow-hidden rounded-[14px] bg-[color:var(--bx-bg-elevated)] px-6 py-12 text-center sm:px-12 sm:py-14"
          >
            <div class="bx-cta-glow pointer-events-none absolute inset-0"></div>
            <h2
              class="relative mb-3.5 text-[clamp(1.75rem,4vw,2.375rem)] font-extrabold tracking-tight text-[color:var(--bx-text)]"
            >
              {{ t('home.cta.title') }}
            </h2>
            <p
              class="relative mx-auto mb-8 max-w-[520px] text-base text-[color:var(--bx-text-muted)]"
            >
              {{ t('home.cta.description') }}
            </p>
            <router-link
              :to="isAuthenticated ? dashboardPath : '/register'"
              class="bx-btn-primary relative inline-flex items-center rounded-[10px] px-8 py-3.5 text-[15px] font-bold shadow-[var(--bx-shadow-cta)] transition hover:-translate-y-0.5"
            >
              {{ isAuthenticated ? t('home.goToDashboard') : t('home.cta.button') }} →
            </router-link>
          </div>
        </div>
      </section>

      <!-- Footer -->
      <footer
        class="flex flex-wrap items-center justify-between gap-4 border-t border-[color:var(--bx-border)] py-7 pb-10"
      >
        <div class="flex items-center gap-2.5">
          <img :src="siteLogo || brandLogo" :alt="siteName" class="h-6 w-6 object-contain" />
          <span class="text-sm text-[color:var(--bx-text-dim)]">
            © {{ currentYear }} {{ siteName }} · {{ t('home.footer.allRightsReserved') }}
          </span>
        </div>
        <div class="flex gap-6 text-sm text-[color:var(--bx-text-dim)]">
          <a
            v-if="docUrl"
            :href="docUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="transition hover:text-[color:var(--bx-teal-bright)]"
          >
            {{ t('home.docs') }}
          </a>
          <a
            :href="githubUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="transition hover:text-[color:var(--bx-teal-bright)]"
          >
            GitHub
          </a>
        </div>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore, useAppStore } from '@/stores'
import LocaleSwitcher from '@/components/common/LocaleSwitcher.vue'
import Icon from '@/components/icons/Icon.vue'
import { sanitizeUrl } from '@/utils/url'
import {
  BRAND_NAME,
  BRAND_DEFAULT_SUBTITLE,
  BRAND_LOGO_SVG
} from '@/constants/brand'
import '@/styles/home-platform.css'

const { t } = useI18n()
const authStore = useAuthStore()
const appStore = useAppStore()

// BOXAI: homepage theme toggle (default dark; light when user chooses)
const isDark = ref(
  typeof document !== 'undefined'
    ? document.documentElement.classList.contains('dark')
    : true
)

function toggleTheme() {
  isDark.value = !isDark.value
  document.documentElement.classList.toggle('dark', isDark.value)
  localStorage.setItem('theme', isDark.value ? 'dark' : 'light')
}

const brandLogo = BRAND_LOGO_SVG

const siteName = computed(
  () => appStore.cachedPublicSettings?.site_name || appStore.siteName || BRAND_NAME
)
const siteLogo = computed(() =>
  sanitizeUrl(appStore.cachedPublicSettings?.site_logo || appStore.siteLogo || BRAND_LOGO_SVG, {
    allowRelative: true,
    allowDataUrl: true
  })
)
const siteSubtitle = computed(
  () => appStore.cachedPublicSettings?.site_subtitle || BRAND_DEFAULT_SUBTITLE
)
const docUrl = computed(() =>
  sanitizeUrl(appStore.cachedPublicSettings?.doc_url || appStore.docUrl || '')
)
const homeContent = computed(() => appStore.cachedPublicSettings?.home_content || '')
const isHomeContentUrl = computed(() => {
  const content = homeContent.value.trim()
  return content.startsWith('http://') || content.startsWith('https://')
})

const githubUrl = 'https://github.com/fran0220/boxAI'

const isAuthenticated = computed(() => authStore.isAuthenticated)
const isAdmin = computed(() => authStore.isAdmin)
const dashboardPath = computed(() => (isAdmin.value ? '/admin/dashboard' : '/dashboard'))
const currentYear = computed(() => new Date().getFullYear())

const pillars = computed(() =>
  (['gateway', 'chat', 'desktop', 'image', 'video', 'audio'] as const).map((key) => ({
    key,
    title: t(`home.pillars.${key}.title`),
    desc: t(`home.pillars.${key}.desc`)
  }))
)

const pillarGradients = [
  'bg-gradient-to-br from-[#2dd4bf] to-[#0d9488]',
  'bg-gradient-to-br from-[#22d3ee] to-[#2dd4bf]',
  'bg-gradient-to-br from-[#38bdf8] to-[#22d3ee]',
  'bg-gradient-to-br from-[#2dd4bf] to-[#22d3ee]',
  'bg-gradient-to-br from-[#22d3ee] to-[#38bdf8]',
  'bg-gradient-to-br from-[#2dd4bf] to-[#0d9488]'
]

const modelChips = [
  'Claude',
  'GPT',
  'Gemini',
  'Grok',
  'Antigravity',
  'DeepSeek',
  'Qwen',
  '+ more'
]
const modelChipsDouble = [...modelChips, ...modelChips]

onMounted(() => {
  authStore.checkAuth()
  if (!appStore.publicSettingsLoaded) {
    appStore.fetchPublicSettings()
  }
})
</script>

<style scoped>
.bx-aurora {
  position: absolute;
  border-radius: 50%;
  filter: blur(30px);
  pointer-events: none;
}
.bx-aurora-1 {
  top: -12%;
  left: -8%;
  width: min(60vw, 900px);
  height: min(60vw, 900px);
  background: radial-gradient(circle, rgba(45, 212, 191, 0.2), transparent 62%);
  animation: bx-aurora1 18s ease-in-out infinite;
}
.bx-aurora-2 {
  top: -6%;
  right: -10%;
  width: min(55vw, 820px);
  height: min(55vw, 820px);
  background: radial-gradient(circle, rgba(34, 211, 238, 0.16), transparent 62%);
  animation: bx-aurora2 22s ease-in-out infinite;
}
.bx-aurora-3 {
  bottom: 8%;
  left: 40%;
  width: min(40vw, 620px);
  height: min(40vw, 620px);
  background: radial-gradient(circle, rgba(56, 189, 248, 0.1), transparent 62%);
  animation: bx-aurora1 26s ease-in-out infinite;
}
.bx-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(45, 212, 191, 0.035) 1px, transparent 1px),
    linear-gradient(90deg, rgba(45, 212, 191, 0.035) 1px, transparent 1px);
  background-size: 64px 64px;
  mask-image: radial-gradient(ellipse 80% 60% at 50% 0%, #000 40%, transparent 100%);
  -webkit-mask-image: radial-gradient(ellipse 80% 60% at 50% 0%, #000 40%, transparent 100%);
}

.bx-btn-primary {
  background: var(--bx-grad-cta);
  color: var(--bx-teal-ink);
}
.bx-hero-gradient {
  background: var(--bx-grad-hero);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.bx-logo-glow {
  width: min(380px, 80%);
  height: min(380px, 80%);
  border-radius: 50%;
  background: radial-gradient(circle, rgba(45, 212, 191, 0.2), transparent 62%);
  filter: blur(18px);
  animation: bx-glow 5s ease-in-out infinite;
}

.bx-face-l,
.bx-face-r,
.bx-face-top,
.bx-node,
.bx-spark {
  transform-box: fill-box;
  transform-origin: center;
}
.bx-face-l {
  animation: bx-face-l 5s ease-in-out infinite;
}
.bx-face-r {
  animation: bx-face-r 5s ease-in-out infinite;
}
.bx-face-top {
  animation: bx-face-top 5s ease-in-out infinite;
}
.bx-spark {
  animation: bx-spark 3s ease-in-out infinite;
}
.bx-node {
  animation: bx-node 2.2s ease-in-out infinite;
}
.bx-node-d1 {
  animation-delay: 0.5s;
}
.bx-node-d2 {
  animation-delay: 1s;
}
.bx-line {
  animation: bx-line 3s ease-in-out infinite;
}
.bx-line-d1 {
  animation-delay: 0.4s;
}
.bx-line-d2 {
  animation-delay: 0.8s;
}

.bx-marquee-mask {
  mask-image: linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent);
  -webkit-mask-image: linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent);
}
.bx-marquee-track {
  animation: bx-marquee 26s linear infinite;
}

.bx-cta-ring {
  background: var(--bx-grad-border);
  background-size: 300% auto;
  animation: bx-borderflow 8s linear infinite;
}
.bx-cta-glow {
  background: radial-gradient(60% 120% at 50% 0%, rgba(45, 212, 191, 0.14), transparent 70%);
}
</style>
