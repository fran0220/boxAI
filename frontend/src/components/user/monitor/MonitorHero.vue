<template>
  <section class="py-4 md:py-6">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p class="text-xs font-medium tracking-[0.14em] uppercase text-[color:var(--bx-text-dim)]">
          {{ t('channelStatus.eyebrow') }}
        </p>
        <h1 class="mt-1 text-2xl font-bold tracking-tight text-[color:var(--bx-text)] sm:text-3xl">
          {{ t('channelStatus.title') }}
        </h1>
        <p class="mt-1 max-w-xl text-sm text-[color:var(--bx-text-muted)]">
          {{ t('channelStatus.description') }}
        </p>
      </div>

      <div class="flex items-center justify-end gap-3 flex-wrap">
        <div class="bx-status-period" role="tablist">
          <button
            v-for="opt in windowOptions"
            :key="opt.value"
            type="button"
            role="tab"
            :aria-selected="window === opt.value"
            :class="window === opt.value ? 'is-active' : ''"
            @click="emit('update:window', opt.value)"
          >
            {{ opt.label }}
          </button>
        </div>

        <span
          class="bx-status-overall"
          :class="overallStatus === 'operational' ? 'bx-status-overall--ok' : 'bx-status-overall--degraded'"
        >
          <span class="bx-status-overall__dot"></span>
          {{ overallLabel }}
        </span>

        <button
          type="button"
          class="h-8 w-8 rounded-lg flex items-center justify-center text-[color:var(--bx-text-dim)] hover:text-gray-700 hover:bg-[color:var(--bx-hover)] dark:hover:text-gray-200 transition-colors disabled:opacity-50"
          :disabled="loading"
          :title="t('common.refresh')"
          @click="emit('refresh')"
        >
          <Icon name="refresh" size="md" :class="loading ? 'animate-spin' : ''" />
        </button>

        <AutoRefreshButton
          v-if="autoRefresh"
          :enabled="autoRefresh.enabled.value"
          :interval-seconds="autoRefresh.intervalSeconds.value"
          :countdown="autoRefresh.countdown.value"
          :intervals="autoRefresh.intervals"
          @update:enabled="autoRefresh.setEnabled"
          @update:interval="autoRefresh.setInterval"
        />
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'
import AutoRefreshButton from '@/components/common/AutoRefreshButton.vue'
export type MonitorWindow = '7d' | '15d' | '30d'
export type OverallStatus = 'operational' | 'degraded'

const props = defineProps<{
  overallStatus: OverallStatus
  intervalSeconds: number
  window: MonitorWindow
  loading: boolean
  autoRefresh?: {
    enabled: { value: boolean }
    intervalSeconds: { value: number }
    countdown: { value: number }
    intervals: readonly number[]
    setEnabled: (v: boolean) => void
    setInterval: (v: number) => void
  }
}>()

const emit = defineEmits<{
  (e: 'update:window', value: MonitorWindow): void
  (e: 'refresh'): void
}>()

const { t } = useI18n()

const windowOptions = computed<{ value: MonitorWindow; label: string }[]>(() => [
  { value: '7d', label: t('channelStatus.windowTab.7d') },
  { value: '15d', label: t('channelStatus.windowTab.15d') },
  { value: '30d', label: t('channelStatus.windowTab.30d') },
])

const overallLabel = computed(() => t(`channelStatus.overall.${props.overallStatus}`))
</script>
