'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'
import { RefreshCw } from 'lucide-react'
import { createClass } from '../actions'
import type { Dictionary } from '@/lib/i18n/dictionaries'

export default function TaoLopForm({ t }: { t: Dictionary['classes'] }) {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ classId: string; joinCode: string } | null>(null)
  const [schoolSearch, setSchoolSearch] = useState('')
  const [schoolDropdownOpen, setSchoolDropdownOpen] = useState(false)
  const [schoolSearchLoading, setSchoolSearchLoading] = useState(false)
  const [schoolSearchItems, setSchoolSearchItems] = useState<Array<{ id: string; name: string }>>([])
  const [canCreateSchool, setCanCreateSchool] = useState(false)
  const [selectedSchoolId, setSelectedSchoolId] = useState('')
  const [selectedSchoolName, setSelectedSchoolName] = useState('')
  const [addingSchool, setAddingSchool] = useState(false)
  const [subjectFacing, setSubjectFacing] = useState('')
  const [teacherFacing, setTeacherFacing] = useState('')
  const { toast } = useToast()

  useEffect(() => {
    let cancelled = false
    fetch('/api/classes/mine', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        const ds = data?.defaultSchool
        if (ds?.id) {
          setSelectedSchoolId(String(ds.id))
          setSelectedSchoolName(String(ds.name ?? ''))
          setSchoolSearch(String(ds.name ?? ''))
        }
        const dsl = String(ds?.defaultSubjectLabel ?? '').trim()
        const dtn = String(ds?.teacherDisplayName ?? '').trim()
        if (dsl)
          setSubjectFacing((prev) => (prev.trim() ? prev : dsl))
        if (dtn)
          setTeacherFacing((prev) => (prev.trim() ? prev : dtn))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const needle = schoolSearch.trim()
    if (needle.length < 2) {
      setSchoolSearchItems([])
      setCanCreateSchool(false)
      return
    }
    let cancelled = false
    const timer = window.setTimeout(async () => {
      setSchoolSearchLoading(true)
      try {
        const res = await fetch(`/api/schools/search?q=${encodeURIComponent(needle)}`, { cache: 'no-store' })
        const data = await res.json().catch(() => ({}))
        if (cancelled) return
        if (!res.ok) {
          setSchoolSearchItems([])
          setCanCreateSchool(false)
          return
        }
        setSchoolSearchItems(Array.isArray(data?.items) ? data.items : [])
        setCanCreateSchool(Boolean(data?.canCreate))
      } catch {
        if (!cancelled) {
          setSchoolSearchItems([])
          setCanCreateSchool(false)
        }
      } finally {
        if (!cancelled) setSchoolSearchLoading(false)
      }
    }, 250)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [schoolSearch])

  const addSchoolFromSearch = useCallback(async () => {
    const raw = schoolSearch.trim()
    if (raw.length < 3) return
    setAddingSchool(true)
    try {
      const res = await fetch('/api/schools/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: raw, useAi: false, setAsDefault: true }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.schoolId) {
        toast({
          variant: 'destructive',
          description: typeof data?.error === 'string' ? data.error : t.createClassSchoolNotFound,
        })
        return
      }
      const sid = String(data.schoolId)
      const label = String(data.canonicalName ?? raw).trim()
      setSelectedSchoolId(sid)
      setSelectedSchoolName(label)
      setSchoolSearch(label)
      setSchoolDropdownOpen(false)
      setSchoolSearchItems((prev) => {
        const rest = prev.filter((x) => x.id !== sid)
        return [{ id: sid, name: label }, ...rest]
      })
    } catch (e) {
      toast({
        variant: 'destructive',
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setAddingSchool(false)
    }
  }, [schoolSearch, toast, t.createClassSchoolNotFound])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    if (!selectedSchoolId) {
      toast({ variant: 'destructive', description: t.createClassSchoolRequired })
      return
    }
    setLoading(true)
    const formData = new FormData()
    formData.set('name', name.trim())
    formData.set('schoolId', selectedSchoolId)
    formData.set('subjectLabel', subjectFacing.trim())
    formData.set('teacherDisplayName', teacherFacing.trim())
    const res = await createClass(formData)
    setLoading(false)
    if (res.error) {
      toast({ variant: 'destructive', description: res.error })
      return
    }
    if (res.success && res.classId && res.joinCode) {
      setResult({ classId: res.classId, joinCode: res.joinCode })
      toast({ description: t.created })
    }
  }

  function copyCode() {
    if (!result?.joinCode) return
    navigator.clipboard.writeText(result.joinCode)
    toast({ description: t.copied })
  }

  if (result) {
    return (
      <>
        <Toaster />
        <div className="rounded-xl border border-input bg-card p-6 space-y-4">
          <p className="text-sm text-muted-foreground">{t.created}</p>
          <div>
            <label className="text-sm font-medium text-muted-foreground">{t.joinCode}</label>
            <div className="mt-2 flex items-center gap-2">
              <code className="flex-1 px-3 py-2 rounded-lg bg-muted font-mono text-lg tracking-wider">
                {result.joinCode}
              </code>
              <Button variant="outline" size="sm" onClick={copyCode}>
                {t.copyCode}
              </Button>
            </div>
          </div>
          <div className="flex gap-2 pt-4">
            <Button asChild>
              <a href={`/lop/${result.classId}`}>{t.backToList}</a>
            </Button>
            <Button variant="outline" asChild>
              <a href="/lop">{t.myClasses}</a>
            </Button>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Toaster />
      <p className="text-sm text-muted-foreground mb-4 leading-relaxed">{t.createClassSchoolHint}</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2 rounded-xl border border-input bg-muted/20 p-4">
          <label htmlFor="school" className="block text-sm font-medium text-foreground">
            {t.schoolLabel} <span className="text-destructive">*</span>
          </label>
          <div className="relative">
            <Input
              id="school"
              value={schoolSearch}
              onChange={(e) => {
                setSchoolSearch(e.target.value)
                setSchoolDropdownOpen(true)
              }}
              onFocus={() => setSchoolDropdownOpen(true)}
              onBlur={() => window.setTimeout(() => setSchoolDropdownOpen(false), 150)}
              placeholder={t.createClassSchoolPlaceholder}
              disabled={loading}
              className="w-full"
              autoComplete="off"
            />
            {schoolDropdownOpen && schoolSearch.trim().length >= 2 && (
              <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-52 overflow-y-auto rounded-md border bg-background p-1 shadow-md">
                {schoolSearchLoading ? (
                  <div className="flex items-center gap-2 px-2 py-2 text-xs text-muted-foreground">
                    <RefreshCw className="h-3.5 w-3.5 animate-spin shrink-0" aria-hidden />
                    {t.createClassSchoolSearching}
                  </div>
                ) : (
                  <>
                    {schoolSearchItems.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className={`w-full rounded px-2 py-2 text-left text-sm hover:bg-muted ${
                          selectedSchoolId === item.id ? 'bg-muted font-medium' : ''
                        }`}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setSelectedSchoolId(item.id)
                          setSelectedSchoolName(item.name)
                          setSchoolSearch(item.name)
                          setSchoolDropdownOpen(false)
                        }}
                      >
                        {item.name}
                      </button>
                    ))}
                    {schoolSearchItems.length === 0 && !schoolSearchLoading && (
                      <p className="px-2 py-2 text-xs text-muted-foreground">{t.createClassSchoolTryOther}</p>
                    )}
                    {canCreateSchool && schoolSearch.trim().length >= 3 && (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="mt-1 w-full"
                        disabled={addingSchool}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => void addSchoolFromSearch()}
                      >
                        {addingSchool ? '…' : `${t.createClassSchoolAddNew}: “${schoolSearch.trim()}”`}
                      </Button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
          {selectedSchoolId ? (
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{t.createClassSchoolSelected}:</span>{' '}
              {selectedSchoolName || schoolSearch}
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor="name" className="block text-sm font-medium text-foreground mb-2">
            {t.className}
          </label>
          <Input
            id="name"
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="VD: 12A6"
            required
            disabled={loading}
            className="w-full"
          />
        </div>
        <p className="text-xs text-muted-foreground -mt-2">{t.createClassFacingFieldsHint}</p>
        <div>
          <label htmlFor="facing-subject" className="block text-sm font-medium text-foreground mb-2">
            {t.createClassFacingSubjectLabel}
          </label>
          <Input
            id="facing-subject"
            value={subjectFacing}
            onChange={(e) => setSubjectFacing(e.target.value)}
            placeholder={t.createClassFacingSubjectPlaceholder}
            maxLength={120}
            disabled={loading}
            className="w-full"
          />
        </div>
        <div>
          <label htmlFor="facing-teacher" className="block text-sm font-medium text-foreground mb-2">
            {t.createClassFacingTeacherLabel}
          </label>
          <Input
            id="facing-teacher"
            value={teacherFacing}
            onChange={(e) => setTeacherFacing(e.target.value)}
            placeholder={t.createClassFacingTeacherPlaceholder}
            maxLength={120}
            disabled={loading}
            className="w-full"
          />
        </div>
        <Button type="submit" disabled={loading || !selectedSchoolId} className="w-full">
          {loading ? '...' : t.createClass}
        </Button>
      </form>
    </>
  )
}
