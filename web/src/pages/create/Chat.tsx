import { FormEvent, useRef, useState } from 'react'
import { chatCompletions } from '@/lib/api'
import { addAsset } from '@/lib/assets-db'

interface Msg {
  role: 'user' | 'assistant' | 'system'
  content: string
}

const DEFAULT_MODEL = 'gpt-4o-mini'

export function Chat() {
  const [model, setModel] = useState(DEFAULT_MODEL)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Msg[]>([])
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState('')
  const abortRef = useRef<AbortController | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const text = input.trim()
    if (!text || streaming) return
    setError('')
    setInput('')
    const next: Msg[] = [...messages, { role: 'user', content: text }]
    setMessages([...next, { role: 'assistant', content: '' }])
    setStreaming(true)
    const ac = new AbortController()
    abortRef.current = ac

    try {
      const res = await chatCompletions(
        {
          model,
          stream: true,
          messages: next.map((m) => ({ role: m.role, content: m.content })),
        },
        { signal: ac.signal },
      )
      if (!res.ok) {
        const t = await res.text()
        throw new Error(t || `HTTP ${res.status}`)
      }
      const reader = res.body?.getReader()
      if (!reader) throw new Error('No response body')
      const decoder = new TextDecoder()
      let assistant = ''
      let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        if (ac.signal.aborted) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed.startsWith('data:')) continue
          const data = trimmed.slice(5).trim()
          if (data === '[DONE]') continue
          try {
            const json = JSON.parse(data) as {
              choices?: Array<{ delta?: { content?: string }; message?: { content?: string } }>
            }
            const delta =
              json.choices?.[0]?.delta?.content || json.choices?.[0]?.message?.content || ''
            if (delta) {
              assistant += delta
              setMessages((prev) => {
                const copy = [...prev]
                copy[copy.length - 1] = { role: 'assistant', content: assistant }
                return copy
              })
            }
          } catch {
            // ignore partial JSON
          }
        }
      }
      await addAsset({
        kind: 'chat',
        title: text.slice(0, 80),
        model,
        prompt: text,
        payload: JSON.stringify([
          ...next,
          { role: 'assistant', content: assistant },
        ]),
      })
    } catch (err) {
      if (!ac.signal.aborted) {
        setError(err instanceof Error ? err.message : 'Chat failed')
      }
    } finally {
      setStreaming(false)
      abortRef.current = null
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="bx-label !mb-0">Model</label>
        <input
          className="bx-input max-w-xs"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          list="chat-models"
        />
        <datalist id="chat-models">
          <option value="gpt-4o-mini" />
          <option value="gpt-4o" />
          <option value="claude-sonnet-4-5-20250929" />
        </datalist>
      </div>

      <div className="bx-card flex min-h-[360px] flex-col gap-3 p-4">
        {messages.length === 0 && (
          <p className="m-auto text-sm text-[var(--bx-text-dim)]">
            Start a conversation. Streams via `/v1/chat/completions`.
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`max-w-[90%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap ${
              m.role === 'user'
                ? 'ml-auto bg-[rgba(45,212,191,0.15)]'
                : 'mr-auto bg-[var(--bx-bg-muted)]'
            }`}
          >
            {m.content || (streaming && i === messages.length - 1 ? '…' : '')}
          </div>
        ))}
      </div>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      <form onSubmit={onSubmit} className="flex gap-2">
        <input
          className="bx-input flex-1"
          placeholder="Message…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={streaming}
        />
        {streaming ? (
          <button
            type="button"
            className="bx-btn bx-btn-ghost"
            onClick={() => abortRef.current?.abort()}
          >
            Stop
          </button>
        ) : (
          <button type="submit" className="bx-btn bx-btn-primary">
            Send
          </button>
        )}
      </form>
    </div>
  )
}
