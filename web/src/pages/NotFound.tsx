import { Link } from 'react-router-dom'
import { usePageMeta } from '@/lib/meta'
import { useI18n } from '@/i18n'
import { Reveal } from '@/components/motion/Reveal'

export function NotFound() {
  const { d } = useI18n()
  usePageMeta(d.notFound.metaTitle)

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 py-20 text-center">
      <Reveal>
        <p className="bx-display bx-gradient-text text-7xl font-bold tracking-tighter">404</p>
        <h1 className="bx-display mt-4 text-2xl font-semibold tracking-tight">{d.notFound.title}</h1>
        <p className="mt-3 text-sm text-[var(--bx-text-muted)]">{d.notFound.body}</p>
        <Link to="/" className="bx-btn bx-btn-primary mt-8 inline-flex">
          {d.notFound.back}
        </Link>
      </Reveal>
    </div>
  )
}
