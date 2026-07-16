<!-- BOXAI: Console-side Web SSO start (PKCE).
     Generates verifier/challenge, stores verifier in sessionStorage, then:
     - If authenticated here: call authorize, redirect to callback fragment.
     - If not: open marketing /sso/authorize with challenge so you-box.com mints
       the code after login, then returns to this origin's callback. -->
<template>
  <div class="bx-page min-h-screen px-4 py-10">
    <div class="mx-auto max-w-lg">
      <div v-if="status === 'working'" class="card p-6 text-center">
        <div
          class="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary-500 border-t-transparent"
        ></div>
        <h1 class="mt-4 text-lg font-semibold text-[color:var(--bx-text)]">Starting SSO</h1>
        <p class="mt-2 text-sm text-[color:var(--bx-text-muted)]">
          Linking your BoxAI session…
        </p>
      </div>
      <div v-else class="card p-6 text-center">
        <h1 class="text-lg font-semibold text-[color:var(--bx-text)]">SSO failed</h1>
        <p class="mt-2 text-sm text-[color:var(--bx-text-muted)]">{{ errorMessage }}</p>
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
import { authorizeWebSso } from '@/api/auth'
import { useAuthStore } from '@/stores/auth'
import { safeReturnPath } from '@/utils/safeReturnPath'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const SSO_VERIFIER_KEY = 'boxai_sso_verifier'
const SSO_STATE_KEY = 'boxai_sso_state'
const SSO_RETURN_KEY = 'boxai_sso_return'

const status = ref<'working' | 'error'>('working')
const errorMessage = ref('')

function firstQueryValue(value: unknown): string {
  if (Array.isArray(value)) return typeof value[0] === 'string' ? value[0] : ''
  return typeof value === 'string' ? value : ''
}

function base64Url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let str = ''
  for (let i = 0; i < arr.length; i++) str += String.fromCharCode(arr[i]!)
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function createPkce(): Promise<{ verifier: string; challenge: string; state: string }> {
  const raw = new Uint8Array(64)
  crypto.getRandomValues(raw)
  const verifier = base64Url(raw).slice(0, 96)
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  const challenge = base64Url(digest)
  const stateRaw = new Uint8Array(16)
  crypto.getRandomValues(stateRaw)
  return { verifier, challenge, state: base64Url(stateRaw) }
}

function marketingAuthorizeUrl(challenge: string, state: string, redirectUri: string): string {
  const origin =
    (import.meta.env.VITE_MARKETING_ORIGIN as string | undefined)?.trim() ||
    (typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
      ? 'http://localhost:5173'
      : 'https://you-box.com')
  const url = new URL('/sso/authorize', origin)
  url.searchParams.set('code_challenge', challenge)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('state', state)
  return url.toString()
}

onMounted(async () => {
  try {
    const returnTo = safeReturnPath(firstQueryValue(route.query.return_to) || '/', '/')
    const { verifier, challenge, state } = await createPkce()
    const redirectUri = `${window.location.origin}/boxai/sso/callback`

    sessionStorage.setItem(SSO_VERIFIER_KEY, verifier)
    sessionStorage.setItem(SSO_STATE_KEY, state)
    sessionStorage.setItem(SSO_RETURN_KEY, returnTo)

    if (!authStore.isAuthenticated) {
      // Prefer marketing as identity host when console is cold.
      window.location.href = marketingAuthorizeUrl(challenge, state, redirectUri)
      return
    }

    const { code } = await authorizeWebSso({ codeChallenge: challenge, redirectUri })
    const hash = new URLSearchParams({ code, state }).toString()
    window.location.replace(`${redirectUri}#${hash}`)
  } catch (error) {
    status.value = 'error'
    errorMessage.value =
      error instanceof Error && error.message
        ? error.message
        : 'Could not start SSO. Please try again.'
  }
})
</script>
