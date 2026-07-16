<!-- BOXAI: BoxAI Desktop browser-login handshake page.
     The desktop app opens <server>/desktop-auth?state=...&code_challenge=...&redirect_uri=boxai-desktop://...
     in the system browser. This route requires auth, so unauthenticated users are
     sent through /login first and returned here. Once authenticated, we mint a
     one-time PKCE code and redirect the browser to the desktop's custom scheme. -->
<template>
  <div class="bx-page min-h-screen px-4 py-10">
    <div class="mx-auto max-w-lg">
      <div v-if="status === 'working'" class="card p-6 text-center">
        <div class="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary-500 border-t-transparent"></div>
        <h1 class="mt-4 text-lg font-semibold text-[color:var(--bx-text)]">
          Connecting BoxAI Desktop
        </h1>
        <p class="mt-2 text-sm text-[color:var(--bx-text-muted)]">
          Authorizing your desktop app, please wait…
        </p>
      </div>

      <div v-else-if="status === 'redirecting'" class="card p-6 text-center">
        <h1 class="text-lg font-semibold text-[color:var(--bx-text)]">
          Returning to BoxAI Desktop
        </h1>
        <p class="mt-2 text-sm text-[color:var(--bx-text-muted)]">
          If the app did not reopen automatically, use the button below.
        </p>
        <a class="btn btn-primary mt-6 inline-block" :href="redirectTarget">Open BoxAI Desktop</a>
      </div>

      <div v-else class="card p-6 text-center">
        <h1 class="text-lg font-semibold text-[color:var(--bx-text)]">
          Desktop sign-in failed
        </h1>
        <p class="mt-2 text-sm text-[color:var(--bx-text-muted)]">
          {{ errorMessage }}
        </p>
        <button class="btn btn-primary mt-6" type="button" @click="router.replace('/login')">
          Back to sign in
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { authorizeDesktopLogin } from '@/api/auth'

const route = useRoute()
const router = useRouter()

const DESKTOP_SCHEME_PREFIX = 'boxai-desktop://'

const status = ref<'working' | 'redirecting' | 'error'>('working')
const errorMessage = ref('')
const redirectTarget = ref('')

function firstQueryValue(value: unknown): string {
  if (Array.isArray(value)) return typeof value[0] === 'string' ? value[0] : ''
  return typeof value === 'string' ? value : ''
}

function buildRedirectTarget(redirectUri: string, code: string, state: string): string {
  const separator = redirectUri.includes('?') ? '&' : '?'
  const params = new URLSearchParams()
  params.set('code', code)
  if (state) params.set('state', state)
  return `${redirectUri}${separator}${params.toString()}`
}

onMounted(async () => {
  const codeChallenge = firstQueryValue(route.query.code_challenge)
  const redirectUri = firstQueryValue(route.query.redirect_uri)
  const state = firstQueryValue(route.query.state)

  if (!codeChallenge || !redirectUri) {
    status.value = 'error'
    errorMessage.value = 'This desktop sign-in link is missing required parameters.'
    return
  }
  if (!redirectUri.toLowerCase().startsWith(DESKTOP_SCHEME_PREFIX)) {
    status.value = 'error'
    errorMessage.value = 'This desktop sign-in link has an unexpected redirect target.'
    return
  }

  try {
    const { code } = await authorizeDesktopLogin({ codeChallenge, redirectUri })
    redirectTarget.value = buildRedirectTarget(redirectUri, code, state)
    status.value = 'redirecting'
    window.location.href = redirectTarget.value
  } catch (error) {
    status.value = 'error'
    errorMessage.value =
      error instanceof Error && error.message
        ? error.message
        : 'Could not authorize the desktop app. Please try again.'
  }
})
</script>
