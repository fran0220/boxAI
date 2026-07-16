<!-- BOXAI: Console-side Web SSO authorize (PKCE).
     The console is the identity host: the marketing origin (you-box.com) opens
     /boxai/sso/authorize?code_challenge=...&redirect_uri=...&state=... with a
     locally minted PKCE pair. The route requires auth, so a cold session is
     routed through /login (or /register) first and returns here. We then mint
     a one-time code and redirect to redirect_uri with #code=&state= in the
     fragment (never the query, so intermediaries cannot see it). The backend
     enforces the redirect_uri allowlist. -->
<template>
  <div class="bx-page min-h-screen px-4 py-10">
    <div class="mx-auto max-w-lg">
      <div v-if="status === 'working'" class="card p-6 text-center">
        <div
          class="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary-500 border-t-transparent"
        ></div>
        <h1 class="mt-4 text-lg font-semibold text-[color:var(--bx-text)]">Authorizing</h1>
        <p class="mt-2 text-sm text-[color:var(--bx-text-muted)]">
          Linking your BoxAI session…
        </p>
      </div>
      <div v-else class="card p-6 text-center">
        <h1 class="text-lg font-semibold text-[color:var(--bx-text)]">Authorization failed</h1>
        <p class="mt-2 text-sm text-[color:var(--bx-text-muted)]">{{ errorMessage }}</p>
        <button class="btn btn-primary mt-6" type="button" @click="router.replace('/dashboard')">
          Back to console
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { authorizeWebSso } from '@/api/auth'

const route = useRoute()
const router = useRouter()

const status = ref<'working' | 'error'>('working')
const errorMessage = ref('')

function firstQueryValue(value: unknown): string {
  if (Array.isArray(value)) return typeof value[0] === 'string' ? value[0] : ''
  return typeof value === 'string' ? value : ''
}

onMounted(async () => {
  const codeChallenge = firstQueryValue(route.query.code_challenge)
  const redirectUri = firstQueryValue(route.query.redirect_uri)
  const state = firstQueryValue(route.query.state)

  if (!codeChallenge || !redirectUri) {
    status.value = 'error'
    errorMessage.value = 'Missing code_challenge or redirect_uri.'
    return
  }

  try {
    const { code } = await authorizeWebSso({ codeChallenge, redirectUri })
    const hash = new URLSearchParams()
    hash.set('code', code)
    if (state) hash.set('state', state)
    window.location.replace(`${redirectUri}#${hash.toString()}`)
  } catch (error) {
    status.value = 'error'
    errorMessage.value =
      error instanceof Error && error.message
        ? error.message
        : 'Could not authorize. Please try again.'
  }
})
</script>
