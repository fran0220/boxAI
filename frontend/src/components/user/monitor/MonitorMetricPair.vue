<template>
  <div class="mt-5 grid grid-cols-2 gap-2">
    <div
      class="rounded-xl p-3 bg-[color:var(--bx-bg-muted)]  border border-[color:var(--bx-border)]"
    >
      <div
        class="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400"
      >
        <Icon :name="primaryIcon" size="xs" />
        <span>{{ primaryLabel }}</span>
      </div>
      <div class="bx-status-metric-value mt-1.5 text-lg text-[color:var(--bx-text)]">
        {{ primaryValue }}<span class="text-xs font-normal text-gray-400 ml-0.5">{{ primaryUnit }}</span>
      </div>
    </div>
    <div
      class="rounded-xl p-3 bg-[color:var(--bx-bg-muted)]  border border-[color:var(--bx-border)]"
    >
      <div
        class="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400"
      >
        <Icon :name="secondaryIcon" size="xs" />
        <span>{{ secondaryLabel }}</span>
      </div>
      <div class="bx-status-metric-value mt-1.5 text-lg text-[color:var(--bx-text)]">
        {{ secondaryValue }}<span class="text-xs font-normal text-gray-400 ml-0.5">{{ secondaryUnit }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import Icon from '@/components/icons/Icon.vue'

defineProps<{
  primaryLabel: string
  primaryValue: string
  primaryUnit: string
  primaryIcon: 'bolt' | 'globe' | 'clock' | 'link'
  secondaryLabel: string
  secondaryValue: string
  secondaryUnit: string
  secondaryIcon: 'bolt' | 'globe' | 'clock' | 'link'
}>()
</script>
