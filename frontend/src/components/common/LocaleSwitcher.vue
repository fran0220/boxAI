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
      <transition name="locale-dropdown">
        <div
          v-if="isOpen"
          ref="menuRef"
          class="locale-menu fixed z-[200] w-36 overflow-hidden rounded-lg border py-1 shadow-lg"
          :style="menuStyle"
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
            class="locale-option flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors"
            :class="item.code === currentLocaleCode ? 'locale-option-active' : ''"
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
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'
import { setLocale, availableLocales, type LocaleCode } from '@/i18n'

const MENU_WIDTH = 144 // w-36

const { locale } = useI18n()

const isOpen = ref(false)
const dropdownRef = ref<HTMLElement | null>(null)
const menuRef = ref<HTMLElement | null>(null)
const switching = ref(false)
/** Set before open so first paint is already at the trigger (no mid-screen jump). */
const menuTop = ref(0)
const menuLeft = ref(0)

const currentLocaleCode = computed(() => String(locale.value))
const currentLocale = computed(() => availableLocales.find((l) => l.code === locale.value))

const menuStyle = computed(() => ({
  top: `${menuTop.value}px`,
  left: `${menuLeft.value}px`,
  background: 'var(--bx-bg-elevated)',
  borderColor: 'var(--bx-border-strong)',
  color: 'var(--bx-text)'
}))

/** Position relative to trigger — works before menu is mounted (uses fixed width). */
function calcMenuPosition(actualWidth?: number) {
  const trigger = dropdownRef.value
  if (!trigger) return { top: 0, left: 0 }
  const rect = trigger.getBoundingClientRect()
  const width = actualWidth && actualWidth > 0 ? actualWidth : MENU_WIDTH
  const left = Math.min(
    Math.max(8, rect.right - width),
    Math.max(8, window.innerWidth - width - 8)
  )
  const top = rect.bottom + 6
  return { top, left }
}

function applyMenuPosition() {
  const pos = calcMenuPosition(menuRef.value?.offsetWidth)
  menuTop.value = pos.top
  menuLeft.value = pos.left
}

function toggleDropdown() {
  if (isOpen.value) {
    isOpen.value = false
    return
  }
  // Pre-position using trigger rect so enter animation never starts at (0,0)
  applyMenuPosition()
  isOpen.value = true
  // Refine after mount in case real width differs
  requestAnimationFrame(() => {
    applyMenuPosition()
  })
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

function handleReposition() {
  if (isOpen.value) applyMenuPosition()
}

onMounted(() => {
  document.addEventListener('pointerdown', handlePointerDown, true)
  window.addEventListener('resize', handleReposition)
  window.addEventListener('scroll', handleReposition, true)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handlePointerDown, true)
  window.removeEventListener('resize', handleReposition)
  window.removeEventListener('scroll', handleReposition, true)
})
</script>

<style scoped>
.locale-option {
  color: var(--bx-text-soft);
  background: transparent;
}
.locale-option:hover {
  background: var(--bx-hover);
  color: var(--bx-text);
}
.locale-option-active {
  color: var(--bx-teal-bright);
  background: var(--bx-active);
}
.locale-option-active:hover {
  background: var(--bx-active);
  color: var(--bx-teal-bright);
}

/* Origin at top-right (menu anchors under the language button) */
.locale-dropdown-enter-active,
.locale-dropdown-leave-active {
  transition:
    opacity 0.14s ease,
    transform 0.14s ease;
  transform-origin: top right;
}

.locale-dropdown-enter-from,
.locale-dropdown-leave-to {
  opacity: 0;
  transform: scale(0.96) translateY(-4px);
  transform-origin: top right;
}
</style>
