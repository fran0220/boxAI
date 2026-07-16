import { useEffect } from 'react'
import { BRAND_NAME } from './brand'

export function usePageMeta(title: string, description?: string): void {
  useEffect(() => {
    document.title = title ? `${title} · ${BRAND_NAME}` : BRAND_NAME
    if (description) {
      let el = document.querySelector<HTMLMetaElement>('meta[name="description"]')
      if (!el) {
        el = document.createElement('meta')
        el.name = 'description'
        document.head.appendChild(el)
      }
      el.content = description
    }
  }, [title, description])
}
