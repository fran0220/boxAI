import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'
import { BRAND_DOCUMENT_TITLE } from './lib/brand'
import { I18nProvider } from './i18n'
import { ThemeProvider, initThemeClass } from './lib/theme'
import { bootstrapSession } from './lib/session'

document.title = BRAND_DOCUMENT_TITLE
// Match Vue console: default dark; only light when localStorage.theme === 'light'
initThemeClass()
void bootstrapSession()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <I18nProvider>
          <App />
        </I18nProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>,
)
