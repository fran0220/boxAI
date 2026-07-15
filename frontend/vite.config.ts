import { defineConfig, loadEnv, Plugin, type ProxyOptions } from 'vite'
import vue from '@vitejs/plugin-vue'
import checker from 'vite-plugin-checker'
import { resolve } from 'path'

/**
 * Vite 插件：开发模式下注入公开配置到 index.html
 * 与生产模式的后端注入行为保持一致，消除闪烁
 */
function injectPublicSettings(backendUrl: string): Plugin {
  return {
    name: 'inject-public-settings',
    apply: 'serve',
    transformIndexHtml: {
      order: 'pre',
      async handler(html) {
        try {
          const response = await fetch(`${backendUrl}/api/v1/settings/public`, {
            signal: AbortSignal.timeout(4000)
          })
          if (response.ok) {
            const data = await response.json()
            if (data.code === 0 && data.data) {
              const script = `<script>window.__APP_CONFIG__=${JSON.stringify(data.data)};</script>`
              return html.replace('</head>', `${script}\n</head>`)
            }
          }
        } catch (e) {
          console.warn('[vite] 无法获取公开配置，将回退到 API 调用:', (e as Error).message)
        }
        return html
      }
    }
  }
}

/**
 * Shared proxy options for local FE → remote (or local) backend.
 * Auth uses Bearer tokens in localStorage; cookie rewrite helps optional cookie flows.
 */
function createApiProxy(backendUrl: string): ProxyOptions {
  const isRemote = /^https?:\/\//i.test(backendUrl) && !/localhost|127\.0\.0\.1/i.test(backendUrl)
  return {
    target: backendUrl,
    changeOrigin: true,
    secure: backendUrl.startsWith('https'),
    // Map production cookie Domain to host-only cookies on localhost
    cookieDomainRewrite: '',
    cookiePathRewrite: '/',
    // Preserve session across redirects from remote API
    configure: (proxy) => {
      proxy.on('error', (err) => {
        console.warn(`[vite proxy] → ${backendUrl}:`, err.message)
      })
      if (isRemote) {
        proxy.on('proxyReq', (proxyReq) => {
          // Help backends that key off X-Forwarded-* for public URL generation
          proxyReq.setHeader('X-Forwarded-Proto', 'http')
        })
      }
    }
  }
}

export default defineConfig(({ mode }) => {
  // 加载环境变量（.env, .env.local, .env.[mode], .env.[mode].local）
  const env = loadEnv(mode, process.cwd(), '')
  const backendUrl = (env.VITE_DEV_PROXY_TARGET || 'http://localhost:8080').replace(/\/+$/, '')
  const devPort = Number(env.VITE_DEV_PORT || 3000)
  const isRemoteBackend =
    /^https?:\/\//i.test(backendUrl) && !/localhost|127\.0\.0\.1/i.test(backendUrl)

  if (mode === 'development') {
    console.log(
      `[vite] API proxy → ${backendUrl}${isRemoteBackend ? ' (remote prod backend + DB)' : ' (local backend)'}`
    )
  }

  const apiProxy = createApiProxy(backendUrl)

  return {
    plugins: [
      vue(),
      checker({
        vueTsc: true
      }),
      injectPublicSettings(backendUrl)
    ],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
        // 使用 vue-i18n 运行时版本，避免 CSP unsafe-eval 问题
        'vue-i18n': 'vue-i18n/dist/vue-i18n.runtime.esm-bundler.js'
      }
    },
    define: {
      // 启用 vue-i18n JIT 编译，在 CSP 环境下处理消息插值
      // JIT 编译器生成 AST 对象而非 JS 代码，无需 unsafe-eval
      __INTLIFY_JIT_COMPILATION__: true
    },
    build: {
      outDir: '../backend/internal/web/dist',
      emptyOutDir: true,
      rollupOptions: {
        output: {
          /**
           * 手动分包配置
           * 分离第三方库并按功能合并应用代码，避免循环依赖
           */
          manualChunks(id: string) {
            if (id.includes('node_modules')) {
              // Vue 核心库
              if (
                id.includes('/vue/') ||
                id.includes('/vue-router/') ||
                id.includes('/pinia/') ||
                id.includes('/@vue/')
              ) {
                return 'vendor-vue'
              }

              // UI 工具库（较大，单独分离）
              if (id.includes('/@vueuse/') || id.includes('/xlsx/')) {
                return 'vendor-ui'
              }

              // 图表库
              if (id.includes('/chart.js/') || id.includes('/vue-chartjs/')) {
                return 'vendor-chart'
              }

              // 国际化
              if (id.includes('/vue-i18n/') || id.includes('/@intlify/')) {
                return 'vendor-i18n'
              }

              // 其他小型第三方库合并
              return 'vendor-misc'
            }

            // 应用代码：按入口点自动分包，不手动干预
            // 这样可以避免循环依赖，同时保持合理的 chunk 数量
          }
        }
      }
    },
    server: {
      host: '0.0.0.0',
      port: devPort,
      // Fail fast if port busy (easier when juggling multiple modes)
      strictPort: false,
      proxy: {
        // App REST API
        '/api': apiProxy,
        // OpenAI-compatible gateway (API keys)
        '/v1': apiProxy,
        // First-run setup wizard endpoints
        '/setup': apiProxy,
        // Health probe (optional; useful when debugging remote target)
        '/health': apiProxy
      }
    }
  }
})
