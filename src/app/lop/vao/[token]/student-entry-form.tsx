'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import { fillAnswerCardText } from '@/lib/lop/answer-card'

export function StudentEntryForm({
  token,
  className,
  classId,
  rememberedName,
  returnPath = null,
  t,
}: {
  token: string
  className: string
  classId: string
  rememberedName: string | null
  returnPath?: string | null
  t: Dictionary['classes']
}) {
  const [studentCode, setStudentCode] = useState('')
  const [password, setPassword] = useState('')
  const [showForm, setShowForm] = useState(!rememberedName)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/lop/vao/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentCode, password }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setError(data?.error === 'locked' ? t.entryLocked : data?.error === 'not_ready' ? t.entryNotReady : t.entryFailed)
        return
      }
      window.location.assign(returnPath || `/lop/${data.classId || classId}`)
    } catch {
      setError(t.entryFailed)
    } finally {
      setBusy(false)
    }
  }

  async function switchStudent() {
    setBusy(true)
    await fetch(`/api/lop/vao/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ switchStudent: true }),
    }).catch(() => undefined)
    setShowForm(true)
    setBusy(false)
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-foreground">{fillAnswerCardText(t.entryPageTitle, { name: className })}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.entryPageLead}</p>
      </div>
      {rememberedName && !showForm ? (
        <div className="space-y-3">
          <Button type="button" className="w-full" onClick={() => window.location.assign(returnPath || `/lop/${classId}`)}>
            {fillAnswerCardText(t.entryContinue, { name: rememberedName })}
          </Button>
          <Button type="button" variant="outline" className="w-full" disabled={busy} onClick={() => void switchStudent()}>
            {t.entryOtherStudent}
          </Button>
        </div>
      ) : (
        <form className="space-y-4" onSubmit={(event) => void submit(event)}>
          <div className="space-y-1">
            <label htmlFor="entry-code" className="text-sm font-medium text-foreground">
              {t.entryCodeLabel}
            </label>
            <Input
              id="entry-code"
              value={studentCode}
              onChange={(event) => setStudentCode(event.target.value.toUpperCase())}
              autoComplete="off"
              spellCheck={false}
              className="font-mono"
              required
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="entry-password" className="text-sm font-medium text-foreground">
              {t.entryPasswordLabel}
            </label>
            <Input
              id="entry-password"
              inputMode="numeric"
              value={password}
              onChange={(event) => setPassword(event.target.value.replace(/\D/g, '').slice(0, 6))}
              autoComplete="off"
              className="font-mono tracking-widest"
              required
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? t.entrySubmitting : t.entrySubmit}
          </Button>
        </form>
      )}
    </div>
  )
}
