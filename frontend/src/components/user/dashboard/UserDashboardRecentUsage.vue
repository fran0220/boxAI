<template>
  <div class="card">
    <div class="flex items-center justify-between border-b border-[color:var(--bx-border)] px-6 py-4 ">
      <h2 class="text-lg font-semibold text-[color:var(--bx-text)]">{{ t('dashboard.recentUsage') }}</h2>
      <span class="badge badge-gray">{{ t('dashboard.last7Days') }}</span>
    </div>
    <div class="p-6">
      <div v-if="loading" class="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
      <div v-else-if="data.length === 0" class="py-8">
        <EmptyState :title="t('dashboard.noUsageRecords')" :description="t('dashboard.startUsingApi')" />
      </div>
      <div v-else class="space-y-3">
        <div v-for="log in data" :key="log.id" class="flex items-center justify-between rounded-xl bg-gray-50 p-4 transition-colors hover:bg-[color:var(--bx-bg-muted)] dark:hover:bg-dark-800">
          <div class="flex items-center gap-4">
            <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-900/30">
              <Icon name="beaker" size="md" class="text-primary-400" />
            </div>
            <div>
              <p class="text-sm font-medium text-[color:var(--bx-text)]">{{ log.model }}</p>
              <p class="text-xs text-[color:var(--bx-text-dim)]">{{ formatDateTime(log.created_at) }}</p>
            </div>
          </div>
          <div class="text-right">
            <p class="text-sm font-semibold">
              <span class="text-green-600 dark:text-green-400" :title="t('dashboard.actual')">${{ formatCost(log.actual_cost) }}</span>
              <span class="font-normal text-[color:var(--bx-text-dim)]" :title="t('dashboard.standard')"> / ${{ formatCost(log.total_cost) }}</span>
            </p>
            <p class="text-xs text-[color:var(--bx-text-dim)]">{{ (log.input_tokens + log.output_tokens).toLocaleString() }} tokens</p>
          </div>
        </div>

        <router-link to="/usage" class="flex items-center justify-center gap-2 py-3 text-sm font-medium text-primary-600 transition-colors hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300">
          {{ t('dashboard.viewAllUsage') }}
          <Icon name="arrowRight" size="sm" />
        </router-link>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import Icon from '@/components/icons/Icon.vue'
import { formatDateTime } from '@/utils/format'
import type { UsageLog } from '@/types'

defineProps<{
  data: UsageLog[]
  loading: boolean
}>()
const { t } = useI18n()
const formatCost = (c: number) => c.toFixed(4)
</script>
