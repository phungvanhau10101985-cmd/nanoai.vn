'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import type { WebLocale } from '@/lib/i18n/config'
import { aiTutorCopy } from '@/lib/ai-tutor/ai-tutor-copy'
import type { TutorAnswer, TutorThreadMessage } from '@/lib/ai-tutor/ai-tutor-types'
import { loadTutorThread, openTutorLabelAction, sendTutorQuestion } from '@/app/gia-su-ai/actions'

type Props = {
  locale: WebLocale
}

function localId(): string {
  return `local-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export default function GiaSuAiClient({ locale }: Props) {
  const copy = aiTutorCopy(locale)
  const [messages, setMessages] = useState<TutorThreadMessage[]>([])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)
  const endRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    let cancelled = false
    void loadTutorThread(locale).then((result) => {
      if (cancelled) return
      if (result.ok) setMessages(result.data)
      else setError(copy.errors[result.code])
      setReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [copy.errors, locale])

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [messages, busy])

  function pushTurn(question: string, kind: 'question' | 'label', answer: TutorAnswer) {
    const now = new Date().toISOString()
    setMessages((current) => [
      ...current,
      {
        id: localId(),
        role: 'user',
        body: question,
        topicKey: answer.topicKey,
        kind,
        answer: null,
        createdAt: now,
      },
      {
        id: localId(),
        role: 'tutor',
        body: answer.explanation,
        topicKey: answer.topicKey,
        kind: 'answer',
        answer,
        createdAt: now,
      },
    ])
  }

  async function send() {
    const question = text.trim()
    if (!question || busy) {
      if (!question) setError(copy.errors.missing_text)
      return
    }
    setBusy(true)
    setError('')
    setText('')
    const result = await sendTutorQuestion({ locale, text: question })
    setBusy(false)
    if (!result.ok) {
      setText(question)
      setError(copy.errors[result.code])
      return
    }
    pushTurn(question, 'question', result.data)
  }

  async function openLabel(labelKey: string, title: string) {
    if (busy) return
    setBusy(true)
    setError('')
    const result = await openTutorLabelAction({ locale, labelKey, title })
    setBusy(false)
    if (!result.ok) {
      setError(copy.errors[result.code])
      return
    }
    pushTurn(title, 'label', result.data)
  }

  return (
    <div className="space-y-4">
      <p className="text-sm leading-6 text-muted-foreground">{copy.intro}</p>
      <div className="flex min-h-[480px] flex-col rounded-xl border bg-card shadow-sm">
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {ready && messages.length === 0 ? (
            <p className="text-sm leading-6 text-muted-foreground">{copy.empty}</p>
          ) : null}
          {messages.map((message) =>
            message.role === 'user' ? (
              <p
                key={message.id}
                className="ml-auto max-w-[85%] rounded-2xl bg-primary/10 px-3 py-2 text-sm leading-6"
              >
                {message.body}
              </p>
            ) : (
              <article key={message.id} className="max-w-[92%] space-y-3 rounded-xl border bg-background p-4">
                {message.answer?.title ? <h2 className="text-base font-semibold">{message.answer.title}</h2> : null}
                <section className="space-y-1">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {copy.explain}
                  </h3>
                  <p className="whitespace-pre-wrap text-sm leading-6">{message.answer?.explanation || message.body}</p>
                </section>
                {message.answer?.practice ? (
                  <section className="space-y-1 rounded-lg bg-muted p-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {copy.practice}
                    </h3>
                    <p className="whitespace-pre-wrap text-sm leading-6">{message.answer.practice}</p>
                  </section>
                ) : null}
                {message.answer ? (
                  <p className="text-xs leading-5 text-muted-foreground">{copy.share[message.answer.share]}</p>
                ) : null}
                {message.answer && message.answer.labels.length > 0 ? (
                  <section className="space-y-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {copy.related}
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {message.answer.labels.map((label) => (
                        <Button
                          key={`${message.id}-${label.key}`}
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={busy}
                          onClick={() => void openLabel(label.key, label.title)}
                        >
                          {label.title}
                        </Button>
                      ))}
                    </div>
                  </section>
                ) : null}
              </article>
            )
          )}
          {busy ? <p className="text-sm text-muted-foreground">{copy.sending}</p> : null}
          <div ref={endRef} />
        </div>
        <form
          className="flex items-end gap-2 border-t p-3"
          onSubmit={(event) => {
            event.preventDefault()
            void send()
          }}
        >
          <Textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={copy.placeholder}
            rows={2}
            disabled={busy}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                void send()
              }
            }}
          />
          <Button type="submit" disabled={busy}>
            {busy ? copy.sending : copy.send}
          </Button>
        </form>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  )
}
