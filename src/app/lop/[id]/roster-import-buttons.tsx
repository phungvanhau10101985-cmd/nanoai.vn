'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import { fillAnswerCardText } from '@/lib/lop/answer-card'
import type { RosterImportErrorCode } from '@/lib/lop/class-roster'

export function RosterImportButtons({ classId, t }: { classId: string; t: Dictionary['classes'] }) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  function rowMessage(code: RosterImportErrorCode) {
    if (code === 'missing_code' || code === 'missing_code_column') return t.rosterCodeRequired
    if (code === 'bad_code') return t.rosterCodeInvalid
    if (code === 'missing_name') return t.rosterNameInvalid
    return t.rosterBirthInvalid
  }

  async function onFile(file: File) {
    setBusy(true)
    setMessage('')
    setError('')
    try {
      const body = new FormData()
      body.set('file', file)
      const res = await fetch(`/api/lop/${classId}/roster/import`, { method: 'POST', body })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setError(
          data?.error === 'missing_code_column'
            ? t.rosterCodeRequired
            : typeof data?.error === 'string' && data.error !== 'file' && data.error !== 'save' && data.error !== 'forbidden'
              ? data.error
              : t.rosterImportFailed
        )
        const issues = Array.isArray(data?.errors) ? data.errors : []
        if (issues.length > 0) {
          setMessage(
            issues
              .map((item: { row?: number; code?: RosterImportErrorCode }) =>
                fillAnswerCardText(t.rosterRowError, { row: item.row ?? '', message: rowMessage(item.code ?? 'bad_birth') })
              )
              .join('\n')
          )
        }
        return
      }
      setMessage(fillAnswerCardText(t.rosterImportDone, { updated: data?.updated ?? 0, inserted: data?.inserted ?? 0 }))
      const issues = Array.isArray(data?.errors) ? data.errors : []
      if (issues.length > 0) {
        setError(
          issues
            .map((item: { row?: number; code?: RosterImportErrorCode }) =>
              fillAnswerCardText(t.rosterRowError, { row: item.row ?? '', message: rowMessage(item.code ?? 'bad_birth') })
            )
            .join('\n')
        )
      }
      router.refresh()
    } catch {
      setError(t.rosterImportFailed)
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">{t.rosterImportHint}</p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" asChild>
          <a href={`/api/lop/${classId}/roster/template`}>{t.rosterTemplate}</a>
        </Button>
        <Button type="button" size="sm" disabled={busy} onClick={() => inputRef.current?.click()}>
          {busy ? t.rosterImporting : t.rosterImport}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void onFile(file)
          }}
        />
      </div>
      {message ? <p className="whitespace-pre-line text-sm text-foreground">{message}</p> : null}
      {error ? <p className="whitespace-pre-line text-sm text-destructive">{error}</p> : null}
    </div>
  )
}
