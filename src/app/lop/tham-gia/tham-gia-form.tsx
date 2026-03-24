'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'
import { StudentBirthDateSelects } from '@/components/student-birth-date-selects'
import { buildDob, isValidStudentDobIso } from '@/lib/student-dob'
import { joinClass } from '../actions'
import type { Dictionary } from '@/lib/i18n/dictionaries'

export default function ThamGiaForm({ t }: { t: Dictionary['classes'] }) {
  const [code, setCode] = useState('')
  const [studentName, setStudentName] = useState('')
  const [dobDay, setDobDay] = useState('')
  const [dobMonth, setDobMonth] = useState('')
  const [dobYear, setDobYear] = useState('')
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
    const name = studentName.replace(/\s+/g, ' ').trim()
    if (name.length < 2) {
      toast({ variant: 'destructive', description: t.joinNameTooShort })
      return
    }
    const birthDate = buildDob(dobDay, dobMonth, dobYear)
    if (!birthDate || !isValidStudentDobIso(birthDate)) {
      toast({ variant: 'destructive', description: t.joinBirthRequired })
      return
    }
    setLoading(true)
    const res = await joinClass({
      joinCode: code.trim(),
      studentDisplayName: name,
      birthDate,
    })
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
        <div>
          <label htmlFor="studentName" className="block text-sm font-medium text-foreground mb-2">
            {t.joinStudentDisplayName} <span className="text-destructive">*</span>
          </label>
          <Input
            id="studentName"
            value={studentName}
            onChange={(e) => setStudentName(e.target.value)}
            placeholder={t.joinStudentDisplayName}
            autoComplete="name"
            required
            minLength={2}
            maxLength={120}
            disabled={loading}
            className="w-full"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            {t.joinStudentBirthDate} <span className="text-destructive">*</span>
          </label>
          <StudentBirthDateSelects
            idPrefix="join-class-dob"
            dobDay={dobDay}
            dobMonth={dobMonth}
            dobYear={dobYear}
            onDayChange={setDobDay}
            onMonthChange={setDobMonth}
            onYearChange={setDobYear}
            disabled={loading}
            labels={{
              day: t.joinDobDayPlaceholder,
              month: t.joinDobMonthPlaceholder,
              year: t.joinDobYearPlaceholder,
            }}
          />
        </div>
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? '...' : t.join}
        </Button>
      </form>
    </>
  )
}
