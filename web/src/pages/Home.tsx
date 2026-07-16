import { Link } from 'react-router-dom'
import {
  BRAND_DEFAULT_SUBTITLE,
  BRAND_HERO_LINE1,
  BRAND_HERO_LINE2,
  BRAND_LOGO_SVG,
  BRAND_NAME,
  BRAND_PLATFORM_BADGE,
} from '@/lib/brand'

export function Home() {
  return (
    <div className="mx-auto max-w-6xl px-4 pb-20 pt-16 sm:pt-24">
      <div className="text-center">
        <p className="mb-4 inline-flex items-center rounded-full border border-[var(--bx-border)] px-3 py-1 text-xs font-medium text-[var(--bx-teal)]">
          {BRAND_PLATFORM_BADGE}
        </p>
        <img src={BRAND_LOGO_SVG} alt={BRAND_NAME} className="mx-auto h-16 w-16" />
        <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-6xl">
          <span className="bx-gradient-text">{BRAND_HERO_LINE1}</span>
          <br />
          {BRAND_HERO_LINE2}
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-[var(--bx-text-muted)]">
          {BRAND_DEFAULT_SUBTITLE}. Chat, image, and video generation in the browser — plus a desktop Studio for agents.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link to="/create" className="bx-btn bx-btn-primary">
            Open Creator
          </Link>
          <Link to="/download" className="bx-btn bx-btn-ghost">
            Download Desktop
          </Link>
          <Link to="/studio" className="bx-btn bx-btn-ghost">
            Meet Studio
          </Link>
        </div>
      </div>

      <div className="mt-20 grid gap-4 sm:grid-cols-3">
        {[
          {
            title: 'Creator',
            body: 'Stream chat, generate images and video via the same gateway your keys already use.',
            to: '/create/chat',
          },
          {
            title: 'Studio Desktop',
            body: 'Run agents on your machine with BoxAI account sign-in and local tooling.',
            to: '/studio',
          },
          {
            title: 'Console',
            body: 'Billing, API keys, groups, and admin — deep-linked with secure PKCE SSO.',
            to: '/account',
          },
        ].map((card) => (
          <Link key={card.title} to={card.to} className="bx-card block p-6 transition hover:border-[var(--bx-border-strong)]">
            <h2 className="text-lg font-semibold text-[var(--bx-teal)]">{card.title}</h2>
            <p className="mt-2 text-sm text-[var(--bx-text-muted)]">{card.body}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
