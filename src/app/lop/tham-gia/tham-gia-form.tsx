'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'
import {
  StudentIdentityForm,
  saveStudentIdentityRequest,
  studentIdentityLabels,
  type StudentIdentityValue,
} from '@/components/lop/student-identity-form'
import { isStudentCode, normalizeStudentCode } from '@/lib/lop/class-roster'
import { joinClass } from '../actions'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { TeacherGender } from '@/lib/lop/teacher-public-name'

export default function ThamGiaForm({
  t,
  initialCode = '',
  givenName,
  birthDate,
  gender,
  studentCode,
  returnPath = null,
}: {
  t: Dictionary['classes']
  initialCode?: string
  givenName: string
  birthDate: string
  gender: TeacherGender | null
  studentCode: string
  returnPath?: string | null
}) {
  const [code, setCode] = useState(initialCode)
  const [loading, setLoading] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewSummary, setPreviewSummary] = useState<string | null>(null)
  const [previewError, setPreviewError] = useState(false)
  const [draft, setDraft] = useState<StudentIdentityValue>({
    givenName,
    gender,
    birthDate,
    studentCode: normalizeStudentCode(studentCode),
  })
  const [draftValid, setDraftValid] = useState(
    givenName.trim().length >= 2 &&
      gender != null &&
      birthDate.length > 0 &&
      isStudentCode(normalizeStudentCode(studentCode))
  )
  const savedKey = useRef('')
  const router = useRouter()
  const { toast } = useToast()

  function profileKey(value: StudentIdentityValue) {
    return `${value.givenName}|${value.gender ?? ''}|${value.birthDate}|${value.studentCode}`
  }

  useEffect(() => {
    if (!draftValid || !draft.gender) return
    const key = profileKey(draft)
    if (savedKey.current === key) return
    let cancelled = false
    const timer = window.setTimeout(() => {
      void saveStudentIdentityRequest(draft).then((saved) => {
        if (cancelled || !saved.ok) return
        savedKey.current = key
      })
    }, 500)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [draft, draftValid])

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
    if (!code.trim() || loading) return
    if (!draftValid || !draft.gender) {
      toast({ variant: 'destructive', description: t.studentIdentityRequired })
      return
    }
    setLoading(true)
    const saved = await saveStudentIdentityRequest(draft)
    if (!saved.ok) {
      setLoading(false)
      toast({ variant: 'destructive', description: saved.error || t.studentIdentityRequired })
      return
    }
    savedKey.current = profileKey(draft)
    const res = await joinClass({ joinCode: code.trim() })
    setLoading(false)
    if (res.error) {
      toast({ variant: 'destructive', description: res.error })
      return
    }
    if (res.success && res.classId) {
      router.push(returnPath || `/lop/${res.classId}`)
      router.refresh()
    }
  }

  return (
    <>
      <Toaster />
      <p className="text-sm text-muted-foreground mb-4 leading-relaxed">{t.joinClassRoleHint}</p>
      <div className="mb-4">
        <StudentIdentityForm
          initialName={givenName}
          initialGender={gender}
          initialBirthDate={birthDate}
          initialStudentCode={studentCode}
          labels={studentIdentityLabels(t)}
          hideSaveButton
          onDraftChange={(value, valid) => {
            setDraft(value)
            setDraftValid(valid)
          }}
        />
        <p className="mt-2 text-xs text-muted-foreground">{t.studentIdentityAccountNote}</p>
      </div>
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
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? '...' : t.join}
        </Button>
      </form>
    </>
  )
}
