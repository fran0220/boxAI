import { Link } from 'react-router-dom'
import { useI18n } from '@/i18n'
import { usePageMeta } from '@/lib/meta'

/** Simplified Batch Image guide on apex (full Vue guide was console-only). */
export function AccountBatchImage() {
  const { d } = useI18n()
  const t = d.accountBatchImage
  usePageMeta(t.metaTitle)

  return (
    <div className="max-w-xl">
      <h2 className="bx-display text-2xl font-bold tracking-tight">{t.title}</h2>
      <p className="mt-2 text-sm text-[var(--bx-text-muted)]">{t.subtitle}</p>
      <ol className="mt-6 list-decimal space-y-3 pl-5 text-sm text-[var(--bx-text-soft)]">
        <li>{t.step1}</li>
        <li>{t.step2}</li>
        <li>{t.step3}</li>
      </ol>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link to="/account/keys" className="bx-btn bx-btn-primary bx-btn-sm">
          {t.openKeys}
        </Link>
        <Link to="/create/image" className="bx-btn bx-btn-ghost bx-btn-sm">
          {t.openCreator}
        </Link>
      </div>
    </div>
  )
}
