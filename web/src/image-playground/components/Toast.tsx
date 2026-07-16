import { useStore } from '../store'

export default function Toast() {
  const toast = useStore((s) => s.toast)

  if (!toast) return null

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return (
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--bx-success-soft)] text-[var(--bx-success)]">
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )
      case 'error':
        return (
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--bx-danger-soft)] text-[var(--bx-danger)]">
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
        )
      default:
        return (
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--bx-active)] text-[var(--bx-teal-bright)]">
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
        )
    }
  }

  return (
    <div className="pointer-events-none fixed bottom-24 left-1/2 z-[120] -translate-x-1/2 toast-enter">
      <div className="flex w-max max-w-[calc(100vw-32px)] items-center gap-2.5 rounded-[var(--bx-radius-lg)] border border-[var(--bx-border)] bg-[var(--bx-bg-elevated)]/95 px-5 py-3.5 text-sm font-medium text-[var(--bx-text-soft)] shadow-[var(--bx-shadow-pop)] backdrop-blur-xl sm:max-w-[min(44rem,80vw)]">
        <span className="flex-shrink-0">{getIcon()}</span>
        <span className="whitespace-pre-line text-center leading-5">{toast.message}</span>
      </div>
    </div>
  )
}
