import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import i18n, { initI18n } from './i18n'
import { useAppStore } from '@/stores/app'
import './style.css'
import { BRAND_NAME, BRAND_TAGLINE } from '@/constants/brand'

// BOXAI: product default is dark (homepage design language); only light when user chose it
function initThemeClass() {
  const savedTheme = localStorage.getItem('theme')
  const shouldUseDark = savedTheme !== 'light'
  document.documentElement.classList.toggle('dark', shouldUseDark)
}

async function bootstrap() {
  // Apply theme class globally before app mount to keep all routes consistent.
  initThemeClass()

  const app = createApp(App)
  const pinia = createPinia()
  app.use(pinia)

  // Initialize settings from injected config BEFORE mounting (prevents flash)
  // This must happen after pinia is installed but before router and i18n
  const appStore = useAppStore()
  appStore.initFromInjectedConfig()

  // Set document title immediately after config is loaded
  if (appStore.siteName && appStore.siteName !== BRAND_NAME) {
    document.title = `${appStore.siteName} - ${BRAND_TAGLINE}`
  }

  await initI18n()

  app.use(router)
  app.use(i18n)

  // 等待路由器完成初始导航后再挂载，避免竞态条件导致的空白渲染
  await router.isReady()
  app.mount('#app')

  // BOXAI: dev-only Agentation toolbar for visual feedback → AI agents
  // https://github.com/benjitaylor/agentation  (React island; not in production build)
  if (import.meta.env.DEV) {
    void import('./dev/mountAgentation')
      .then(({ mountAgentation }) => mountAgentation())
      .catch((err) => console.warn('[agentation] failed to mount', err))
  }
}

bootstrap()
