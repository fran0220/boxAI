<!-- BOXAI: Console-side Web SSO callback.
     Reads code from URL fragment (preferred) or query, exchanges with PKCE
     verifier from sessionStorage, applies tokens via authStore. -->
<template>
  <div class="bx-page min-h-screen px-4 py-10">
    <div class="mx-auto max-w-lg">
      <div v-if="status === 'working'" class="card p-6 text-center">
        <div
          class="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary-500 border-t-transparent"
        ></div>
        <h1 class="mt-4 text-lg font-semibold text-[color:var(--bx-text)]">Completing SSO</h1>
        <p class="mt-2 text-sm text-[color:var(--bx-text-muted)]">Exchanging authorization code…</p>
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
import { useRouter } from 'vue-router'
import { exchangeWebSsoToken } from '@/api/auth'
import { useAuthStore } from '@/stores/auth'
import { safeReturnPath } from '@/utils/safeReturnPath'

const router = useRouter()
const authStore = useAuthStore()

const SSO_VERIFIER_KEY = 'boxai_sso_verifier'
const SSO_STATE_KEY = 'boxai_sso_state'
const SSO_RETURN_KEY = 'boxai_sso_return'

const status = ref<'working' | 'error'>('working')
const errorMessage = ref('')

function parseCodeState(): { code: string; state: string } {
  const hash = window.location.hash.replace(/^#/, '')
  const fromHash = new URLSearchParams(hash)
  const fromQuery = new URLSearchParams(window.location.search)
  return {
    code: fromHash.get('code') || fromQuery.get('code') || '',
    state: fromHash.get('state') || fromQuery.get('state') || ''
  }
}

onMounted(async () => {
  try {
    const { code, state } = parseCodeState()
    const verifier = sessionStorage.getItem(SSO_VERIFIER_KEY) || ''
    const expectedState = sessionStorage.getItem(SSO_STATE_KEY) || ''
    const returnToRaw = sessionStorage.getItem(SSO_RETURN_KEY) || '/'

    sessionStorage.removeItem(SSO_VERIFIER_KEY)
    sessionStorage.removeItem(SSO_STATE_KEY)
    sessionStorage.removeItem(SSO_RETURN_KEY)

    if (!code) {
      status.value = 'error'
      errorMessage.value = 'Missing authorization code.'
      return
    }
    if (!verifier) {
      status.value = 'error'
      errorMessage.value = 'Missing PKCE verifier. Restart SSO from Console → SSO start.'
      return
    }
    // Fail closed: expected state must be present and match callback state.
    if (!expectedState || !state || expectedState !== state) {
      status.value = 'error'
      errorMessage.value = 'SSO state mismatch.'
      return
    }

    const redirectUri = `${window.location.origin}/boxai/sso/callback`
    const data = await exchangeWebSsoToken({
      code,
      codeVerifier: verifier,
      redirectUri
    })

    authStore.setAuthFromResponse(data)
    window.history.replaceState(null, '', window.location.pathname)
    await router.replace(safeReturnPath(returnToRaw, '/'))
  } catch (error) {
    status.value = 'error'
    errorMessage.value =
      error instanceof Error && error.message
        ? error.message
        : 'Could not complete SSO token exchange.'
  }
})
</script>
