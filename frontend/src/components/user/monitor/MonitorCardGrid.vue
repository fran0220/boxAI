<template>
  <div>
    <div
      v-if="loading && items.length === 0"
      class="grid gap-5 grid-cols-1 md:grid-cols-2 xl:grid-cols-3"
    >
      <div
        v-for="i in 6"
        :key="i"
        class="bx-status-card p-5 animate-pulse"
      >
        <div class="flex items-start gap-3">
          <div class="w-9 h-9 rounded-xl bg-[color:var(--bx-bg-muted)]"></div>
          <div class="flex-1 space-y-2">
            <div class="h-4 w-2/3 rounded bg-[color:var(--bx-bg-muted)]"></div>
            <div class="h-3 w-1/2 rounded bg-[color:var(--bx-bg-muted)]"></div>
          </div>
          <div class="h-6 w-16 rounded-full bg-[color:var(--bx-bg-muted)]"></div>
        </div>
        <div class="mt-5 grid grid-cols-2 gap-2">
          <div class="h-16 rounded-xl bg-[color:var(--bx-bg-muted)]"></div>
          <div class="h-16 rounded-xl bg-[color:var(--bx-bg-muted)]"></div>
        </div>
        <div class="mt-6 h-5 w-full rounded bg-[color:var(--bx-bg-muted)]"></div>
      </div>
    </div>

    <EmptyState
      v-else-if="items.length === 0"
      :title="t('channelStatus.empty.title')"
      :description="t('channelStatus.empty.description')"
    />

    <div v-else class="space-y-2">
      <!-- Ungrouped -->
      <div
        v-if="ungrouped.length"
        class="grid gap-5 grid-cols-1 md:grid-cols-2 xl:grid-cols-3"
      >
        <MonitorCard
          v-for="item in ungrouped"
          :key="item.id"
          :item="item"
          :window="window"
          :availability-value="resolveAvailability(item)"
          :countdown-seconds="countdownSeconds"
          @click="emit('cardClick', item)"
        />
      </div>

      <!-- Group panels -->
      <section
        v-for="group in groups"
        :key="group.name"
        class="bx-status-group"
      >
        <h2 class="bx-status-group__title">{{ group.name }}</h2>
        <div class="grid gap-5 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
          <MonitorCard
            v-for="item in group.items"
            :key="item.id"
            :item="item"
            :window="window"
            :availability-value="resolveAvailability(item)"
            :countdown-seconds="countdownSeconds"
            @click="emit('cardClick', item)"
          />
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { UserMonitorView, UserMonitorDetail } from '@/api/channelMonitor'
import EmptyState from '@/components/common/EmptyState.vue'
import MonitorCard from './MonitorCard.vue'

const props = defineProps<{
  items: UserMonitorView[]
  window: '7d' | '15d' | '30d'
  countdownSeconds: number
  loading: boolean
  detailCache: Record<number, UserMonitorDetail>
}>()

const emit = defineEmits<{
  (e: 'cardClick', item: UserMonitorView): void
}>()

const { t } = useI18n()

const ungrouped = computed(() =>
  props.items.filter((it) => !(it.group_name || '').trim()),
)

const groups = computed(() => {
  const map = new Map<string, UserMonitorView[]>()
  for (const it of props.items) {
    const name = (it.group_name || '').trim()
    if (!name) continue
    const list = map.get(name) || []
    list.push(it)
    map.set(name, list)
  }
  return [...map.entries()].map(([name, items]) => ({ name, items }))
})

function resolveAvailability(item: UserMonitorView): number | null {
  if (props.window === '7d') {
    return item.availability_7d ?? null
  }
  const detail = props.detailCache[item.id]
  if (!detail) return null
  const primary = detail.models.find(m => m.model === item.primary_model)
  if (!primary) return null
  return props.window === '15d' ? primary.availability_15d ?? null : primary.availability_30d ?? null
}
</script>
