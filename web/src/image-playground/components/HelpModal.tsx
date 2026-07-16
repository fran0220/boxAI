import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { AppMode } from '../types'
import { useCloseOnEscape } from '../hooks/useCloseOnEscape'
import { usePreventBackgroundScroll } from '../hooks/usePreventBackgroundScroll'
import { usePg } from '../lib/pgI18n'

interface HelpModalProps {
  appMode: AppMode
  isFavoriteCollectionOverview?: boolean
  onClose: () => void
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640)
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 640)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return isMobile
}

const kbd = (label: string) => (
  <kbd className="px-1.5 py-0.5 rounded-md bg-gray-100 dark:bg-[var(--bx-bg-elevated)] border border-gray-200 dark:border-gray-700 text-xs font-sans">
    {label}
  </kbd>
)

export default function HelpModal({ appMode, isFavoriteCollectionOverview = false, onClose }: HelpModalProps) {
  const { pg } = usePg()
  const isMobile = useIsMobile()
  const modalRef = useRef<HTMLDivElement>(null)
  const isAgentMode = appMode === 'agent'
  useCloseOnEscape(true, onClose)
  usePreventBackgroundScroll(true, modalRef)

  return createPortal(
    <div
      data-no-drag-select
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm animate-overlay-in" />
      <div
        ref={modalRef}
        className="relative z-10 w-full max-w-md rounded-[var(--bx-radius-xl)] border border-white/50 bg-white/95 p-5 shadow-2xl ring-1 ring-black/5 animate-modal-in dark:border-white/[0.08] dark:bg-[var(--bx-bg-elevated)]/95 dark:ring-white/10 flex flex-col max-h-[85vh] custom-scrollbar"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between gap-4">
          <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <svg className="w-5 h-5 text-teal-500" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" />
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
              <path d="M12 17h.01" />
            </svg>
            {pg.helpTitle}
          </h3>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="rounded-full p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-white/[0.06] dark:hover:text-gray-200"
              aria-label={pg.close}
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain mb-6 text-sm text-gray-600 dark:text-gray-300 space-y-6 custom-scrollbar pr-2">
          {isAgentMode ? (
            <section>
              <h4 className="mb-4 text-sm font-medium text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                <svg className="w-4 h-4 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
                {pg.helpAgent}
              </h4>
              <ul className="list-disc pl-4 space-y-2">
                <li>{pg.helpAgentLi1}</li>
                <li>{pg.helpAgentLi2}</li>
                <li>
                  {pg.helpAgentLi3.split('@')[0]}
                  <strong className="text-teal-500 dark:text-teal-400 font-medium">@</strong>
                  {pg.helpAgentLi3.split('@').slice(1).join('@')}
                </li>
                <li>{pg.helpAgentLi4}</li>
                <li>{pg.helpAgentLi5}</li>
              </ul>
            </section>
          ) : isFavoriteCollectionOverview ? (
            <>
              <section>
                <h4 className="mb-4 text-sm font-medium text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                  </svg>
                  {pg.helpSelect}
                </h4>
                <p className="mb-3 text-xs text-gray-400 dark:text-gray-500">{pg.multiSelectCollections}</p>
                <div className="space-y-4">
                  {isMobile ? (
                    <p>{pg.helpSwipeSelectCollections}</p>
                  ) : (
                    <ul className="list-disc pl-4 space-y-2">
                      <li>{pg.helpDragSelectCollections}</li>
                      <li>
                        {kbd('Ctrl')} / {kbd('⌘')} — {pg.helpCtrlClickKbd}
                      </li>
                      <li>{pg.helpReboxDeselect}</li>
                      <li>{pg.helpClickOutside}</li>
                    </ul>
                  )}
                </div>
              </section>
              <section>
                <h4 className="mb-4 text-sm font-medium text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {pg.batchActions}
                </h4>
                <p>{pg.helpBatchBarCollections}</p>
              </section>
            </>
          ) : isMobile ? (
            <>
              <section>
                <h4 className="mb-4 text-sm font-medium text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                  {pg.helpGallery}
                </h4>
                <p className="mb-4 text-xs text-gray-400 dark:text-gray-500">{pg.multiSelectTasks}</p>
                <h4 className="mb-3 text-sm font-medium text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                  </svg>
                  {pg.helpSelect}
                </h4>
                <p>{pg.helpSwipeSelect}</p>
                <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">{pg.helpSwipeSelectTasks}</p>
              </section>
              <section>
                <h4 className="mb-4 text-sm font-medium text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {pg.batchActions}
                </h4>
                <p>{pg.helpBatchBarTasks}</p>
              </section>
            </>
          ) : (
            <>
              <section>
                <h4 className="mb-4 text-sm font-medium text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                  {pg.helpGallery}
                </h4>
                <p className="mb-4 text-xs text-gray-400 dark:text-gray-500">{pg.multiSelectTasks}</p>
                <h4 className="mb-3 text-sm font-medium text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                  </svg>
                  {pg.helpSelect}
                </h4>
                <ul className="list-disc pl-4 space-y-2">
                  <li>{pg.helpDragSelect}</li>
                  <li>{pg.helpCtrlClickKbd}</li>
                  <li>{pg.helpReboxDeselect}</li>
                  <li>{pg.helpClickOutside}</li>
                </ul>
              </section>
              <section>
                <h4 className="mb-4 text-sm font-medium text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                  </svg>
                  {pg.helpShortcuts}
                </h4>
                <ul className="list-disc pl-4 space-y-2">
                  <li>
                    {kbd('Ctrl')} / {kbd('⌘')} — {pg.helpCtrlClick}
                  </li>
                  <li>{pg.helpReboxDeselect}</li>
                  <li>{pg.helpClickOutside}</li>
                </ul>
              </section>
              <section>
                <h4 className="mb-4 text-sm font-medium text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {pg.batchActions}
                </h4>
                <p>{pg.helpBatchBarTasks}</p>
              </section>
            </>
          )}
        </div>

        <div className="pt-4 border-t border-gray-200 dark:border-white/[0.08] flex justify-center">
          <a
            href="https://github.com/CookSleep/gpt_image_playground"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors group"
          >
            <svg className="w-5 h-5 group-hover:scale-110 transition-transform" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
            @CookSleep
          </a>
        </div>
      </div>
    </div>,
    document.body,
  )
}
