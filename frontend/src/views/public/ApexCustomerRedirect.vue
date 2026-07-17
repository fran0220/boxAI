<!--
  BOXAI: placeholder for removed console customer pages.
  Hard-redirects to the apex React shell (mapConsolePathToApex / /account).
-->
<template>
  <div class="flex min-h-[40vh] items-center justify-center p-8 text-sm text-[color:var(--bx-text-muted)]">
    Redirecting to BoxAI account…
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { apexUrl, mapConsolePathToApex } from '@/utils/apexOrigin'

const route = useRoute()

onMounted(() => {
  const q = route.fullPath.includes('?') ? route.fullPath.slice(route.fullPath.indexOf('?')) : ''
  const target = mapConsolePathToApex(route.path, q) || apexUrl('/account')
  window.location.replace(target)
})
</script>
