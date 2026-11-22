'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import { fillAnswerCardText } from '@/lib/lop/answer-card'
import { phoneOpenableUrl } from '@/app/tao-giao-trinh/lib/phone-remote-client'

export function RosterEntryLink({ path, t }: { path: string; t: Dictionary['classes'] }) {
  const [copied, setCopied] = useState(false)
  const [href, setHref] = useState(path)
  useEffect(() => {
    let cancel = false
    void phoneOpenableUrl(path).then((url) => {
      if (!cancel) setHref(url)
    })
    return () => {
      cancel = true
    }
  }, [path])

  async function copy() {
    const url = await phoneOpenableUrl(path)
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="space-y-2 rounded-xl border border-border/70 bg-background/70 p-3">
      <p className="text-sm font-medium text-foreground">{t.entryLinkTitle}</p>
      <p className="text-sm text-muted-foreground">{t.entryLinkHint}</p>
      <p className="break-all font-mono text-xs text-foreground">{href}</p>
      <Button type="button" variant="outline" size="sm" onClick={() => void copy()}>
        {copied ? t.entryLinkCopied : t.entryLinkCopy}
      </Button>
    </div>
  )
}

export function RosterReissueButton({
  classId,
  studentCode,
  name,
  t,
}: {
  classId: string
  studentCode: string
  name: string
  t: Dictionary['classes']
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function reissue() {
    setBusy(true)
    setMessage('')
    setError('')
    try {
      const res = await fetch(`/api/lop/${classId}/roster/login-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentCode }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || typeof data?.loginCode !== 'string') {
        setError(t.entryReissueFailed)
        return
      }
      setMessage(fillAnswerCardText(t.entryReissueDone, { code: data.loginCode, name }))
      router.refresh()
    } catch {
      setError(t.entryReissueFailed)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button type="button" variant="outline" size="sm" className="h-8" disabled={busy} onClick={() => void reissue()}>
        {busy ? t.entryReissuing : t.entryReissue}
      </Button>
      {message ? <p className="max-w-xs text-right text-xs text-foreground">{message}</p> : null}
      {error ? <p className="max-w-xs text-right text-xs text-destructive">{error}</p> : null}
    </div>
  )
}
