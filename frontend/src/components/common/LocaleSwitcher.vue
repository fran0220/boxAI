<template>
  <div class="relative" ref="dropdownRef">
    <button
      type="button"
      @click.stop="toggleDropdown"
      :disabled="switching"
      class="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium transition-colors"
      style="color: var(--bx-text-muted)"
      :class="switching ? 'cursor-wait opacity-60' : 'hover:bg-[color:var(--bx-hover)]'"
      :title="currentLocale?.name"
      :aria-expanded="isOpen"
      aria-haspopup="listbox"
    >
      <span class="text-base leading-none">{{ currentLocale?.flag }}</span>
      <span class="hidden sm:inline">{{ currentLocale?.code.toUpperCase() }}</span>
      <Icon
        name="chevronDown"
        size="xs"
        class="transition-transform duration-200"
        style="color: var(--bx-text-dim)"
        :class="{ 'rotate-180': isOpen }"
      />
    </button>

    <Teleport to="body">
      <transition name="dropdown">
        <div
          v-if="isOpen"
          ref="menuRef"
          class="fixed z-[200] w-36 overflow-hidden rounded-lg border py-1 shadow-lg"
          style="
            background: var(--bx-bg-elevated);
            border-color: var(--bx-border-strong);
            color: var(--bx-text);
            top: var(--bx-locale-top, 0);
            left: var(--bx-locale-left, 0);
          "
          role="listbox"
          @click.stop
        >
          <button
            v-for="item in availableLocales"
            :key="item.code"
            type="button"
            role="option"
            :aria-selected="item.code === currentLocaleCode"
            :disabled="switching"
            class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors"
            :style="{
              color:
                item.code === currentLocaleCode ? 'var(--bx-teal-bright)' : 'var(--bx-text-soft)',
              background:
                item.code === currentLocaleCode ? 'var(--bx-active)' : 'transparent'
            }"
            @mouseenter="($event.target as HTMLElement).style.background = 'var(--bx-hover)'"
            @mouseleave="
              ($event.target as HTMLElement).style.background =
                item.code === currentLocaleCode ? 'var(--bx-active)' : 'transparent'
            "
            @click="selectLocale(item.code)"
          >
            <span class="text-base leading-none">{{ item.flag }}</span>
            <span>{{ item.name }}</span>
            <Icon
              v-if="item.code === currentLocaleCode"
              name="check"
              size="sm"
              class="ml-auto"
              style="color: var(--bx-teal)"
            />
          </button>
        </div>
      </transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'
import { setLocale, availableLocales, type LocaleCode } from '@/i18n'

const { locale } = useI18n()

const isOpen = ref(false)
const dropdownRef = ref<HTMLElement | null>(null)
const menuRef = ref<HTMLElement | null>(null)
const switching = ref(false)

const currentLocaleCode = computed(() => String(locale.value))
const currentLocale = computed(() => availableLocales.find((l) => l.code === locale.value))

function positionMenu() {
  const trigger = dropdownRef.value
  const menu = menuRef.value
  if (!trigger || !menu) return
  const rect = trigger.getBoundingClientRect()
  const menuWidth = menu.offsetWidth || 144
  const left = Math.min(
    Math.max(8, rect.right - menuWidth),
    window.innerWidth - menuWidth - 8
  )
  const top = rect.bottom + 6
  menu.style.setProperty('--bx-locale-top', `${top}px`)
  menu.style.setProperty('--bx-locale-left', `${left}px`)
}

async function toggleDropdown() {
  isOpen.value = !isOpen.value
  if (isOpen.value) {
    await nextTick()
    positionMenu()
  }
}

async function selectLocale(code: string) {
  if (switching.value || code === currentLocaleCode.value) {
    isOpen.value = false
    return
  }
  switching.value = true
  try {
    await setLocale(code as LocaleCode)
    isOpen.value = false
  } catch (err) {
    console.error('Failed to switch locale', err)
  } finally {
    switching.value = false
  }
}

function handlePointerDown(event: MouseEvent | TouchEvent) {
  if (!isOpen.value) return
  const target = event.target as Node
  if (dropdownRef.value?.contains(target) || menuRef.value?.contains(target)) {
    return
  }
  isOpen.value = false
}

function handleResize() {
  if (isOpen.value) positionMenu()
}

watch(isOpen, async (open) => {
  if (open) {
    await nextTick()
    positionMenu()
  }
})

onMounted(() => {
  document.addEventListener('pointerdown', handlePointerDown, true)
  window.addEventListener('resize', handleResize)
  window.addEventListener('scroll', handleResize, true)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handlePointerDown, true)
  window.removeEventListener('resize', handleResize)
  window.removeEventListener('scroll', handleResize, true)
})
</script>

<style scoped>
.dropdown-enter-active,
.dropdown-leave-active {
  transition: all 0.15s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: scale(0.95) translateY(-4px);
}
</style>
