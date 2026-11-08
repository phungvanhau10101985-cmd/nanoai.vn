'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'
import { StudentIdentityForm, studentIdentityLabels } from '@/components/lop/student-identity-form'
import { formatDobDisplay } from '@/lib/student-dob'
import { joinClass } from '../actions'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { TeacherGender } from '@/lib/lop/teacher-public-name'

export default function ThamGiaForm({
  t,
  initialCode = '',
  givenName,
  birthDate,
  gender,
}: {
  t: Dictionary['classes']
  initialCode?: string
  givenName: string
  birthDate: string
  gender: TeacherGender
}) {
  const [code, setCode] = useState(initialCode)
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewSummary, setPreviewSummary] = useState<string | null>(null)
  const [previewError, setPreviewError] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  useEffect(() => {
    const raw = code.trim().toUpperCase()
    if (raw.length < 4) {
      setPreviewSummary(null)
      setPreviewError(false)
      setPreviewLoading(false)
      return
    }
    let cancelled = false
    setPreviewLoading(true)
    setPreviewError(false)
    const tmr = window.setTimeout(() => {
      void fetch(`/api/lop/join-preview?code=${encodeURIComponent(raw)}`, { cache: 'no-store' })
        .then(async (r) => {
          const data = await r.json().catch(() => ({}))
          if (cancelled) return
          if (!r.ok || data?.error) {
            setPreviewSummary(null)
            setPreviewError(true)
            return
          }
          if (!data?.found) {
            setPreviewSummary(null)
            setPreviewError(data?.reason === 'not_found')
            return
          }
          const parts = [String(data.className ?? '').trim()].filter(Boolean)
          const sub = String(data.subjectLabel ?? '').trim()
          const te = String(data.teacherDisplayName ?? '').trim()
          if (sub) parts.push(sub)
          if (te) parts.push(te)
          setPreviewSummary(parts.join(' — '))
          setPreviewError(false)
        })
        .catch(() => {
          if (!cancelled) {
            setPreviewSummary(null)
            setPreviewError(true)
          }
        })
        .finally(() => {
          if (!cancelled) setPreviewLoading(false)
        })
    }, 400)
    return () => {
      cancelled = true
      window.clearTimeout(tmr)
    }
  }, [code])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!code.trim()) return
    setLoading(true)
    const res = await joinClass({ joinCode: code.trim() })
    setLoading(false)
    if (res.error) {
      toast({ variant: 'destructive', description: res.error })
      return
    }
    if (res.success && res.classId) {
      toast({ description: t.join })
      router.push(`/lop/${res.classId}`)
      router.refresh()
    }
  }

  return (
    <>
      <Toaster />
      <p className="text-sm text-muted-foreground mb-4 leading-relaxed">{t.joinClassRoleHint}</p>
      {editing ? (
        <div className="mb-4">
          <StudentIdentityForm
            initialName={givenName}
            initialGender={gender}
            initialBirthDate={birthDate}
            labels={studentIdentityLabels(t)}
            onSaved={() => {
              toast({ description: t.studentIdentitySaved })
              setEditing(false)
              router.refresh()
            }}
          />
        </div>
      ) : (
        <div className="mb-4 space-y-2 rounded-xl border border-border/70 bg-background/60 p-4">
          <p className="text-sm text-foreground">
            {t.studentIdentityShownAs
              .replace('{name}', givenName)
              .replace('{birth}', formatDobDisplay(birthDate))
              .replace('{gender}', gender === 'male' ? t.teacherIdentityMale : t.teacherIdentityFemale)}
          </p>
          <p className="text-xs text-muted-foreground">{t.studentIdentityAccountNote}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>
            {t.studentIdentityEdit}
          </Button>
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="code" className="block text-sm font-medium text-foreground mb-2">
            {t.enterCode}
          </label>
          <Input
            id="code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="VD: ABC123"
            maxLength={12}
            required
            disabled={loading}
            className="w-full font-mono tracking-wider"
          />
          {code.trim().length >= 4 ? (
            <div className="mt-2 rounded-lg border border-input bg-muted/30 px-3 py-2 text-sm" aria-live="polite">
              {previewLoading ? (
                <p className="text-muted-foreground">{t.joinClassPreviewLoading}</p>
              ) : previewSummary ? (
                <>
                  <p className="font-medium text-foreground">{t.joinClassPreviewTitle}</p>
                  <p className="mt-1 text-foreground">{previewSummary}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{t.joinClassPreviewCheckHint}</p>
                </>
              ) : previewError ? (
                <p className="text-destructive">{t.joinClassPreviewNotFound}</p>
              ) : (
                <p className="text-muted-foreground">{t.joinClassPreviewNeedCode}</p>
              )}
            </div>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">{t.joinClassPreviewNeedCode}</p>
          )}
        </div>
        <Button type="submit" disabled={loading || editing} className="w-full">
          {loading ? '...' : t.join}
        </Button>
      </form>
    </>
  )
}
