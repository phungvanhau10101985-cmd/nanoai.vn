'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Copy, QrCode } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'
import {
  renameSavedSchool,
  savePickedSchool,
  useSchoolSearch,
  voteSavedSchool,
  type SchoolSearchHit,
} from '@/hooks/use-school-search'
import { SchoolNameOptions } from '@/components/school/school-name-options'
import ClassSubjectField from './class-subject-field'
import { subjectIdFromFreeLabel } from '@/lib/lop/class-subject'
import type { Dictionary } from '@/lib/i18n/dictionaries'

type SchoolClassOption = { id: string; name: string; choice: 'original' | 'edited' | null }

function foldClassKey(raw: string) {
  return raw.toLowerCase().replace(/\s+/g, '')
}

/** Khớp cách server so tên lớp trong một trường: bỏ khoảng trắng đầu cuối, gộp khoảng trắng, không phân biệt hoa thường. */
function classNameKey(raw: string) {
  return raw.trim().replace(/\s+/g, ' ').toLowerCase()
}

function findSchoolClass(name: string, classes: SchoolClassOption[]) {
  const key = classNameKey(name)
  if (!key) return null
  return classes.find((item) => classNameKey(item.name) === key) ?? null
}

type EnterResult = {
  status: 'created' | 'attached' | 'already'
  classId: string
  className: string
  joinCode: string
}

export default function EnterClassForm({
  t,
  locale,
}: {
  t: Dictionary['classes']
  locale: string
}) {
  const router = useRouter()
  const { toast } = useToast()
  const [className, setClassName] = useState('')
  const [classSearch, setClassSearch] = useState('')
  const [pickedClassId, setPickedClassId] = useState('')
  const [classDropdownOpen, setClassDropdownOpen] = useState(false)
  const [renamingClass, setRenamingClass] = useState(false)
  const classPanelRef = useRef<HTMLDivElement>(null)
  const [subjectId, setSubjectId] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<EnterResult | null>(null)
  const [joinQrOpen, setJoinQrOpen] = useState(false)
  const [joinQrUrl, setJoinQrUrl] = useState('')
  const [joinQrDataUrl, setJoinQrDataUrl] = useState<string | null>(null)
  const [joinQrFailed, setJoinQrFailed] = useState(false)
  const [schoolSearch, setSchoolSearch] = useState('')
  const [schoolDropdownOpen, setSchoolDropdownOpen] = useState(false)
  const {
    items: schoolSearchItems,
    suggestions: schoolSuggestions,
    loading: schoolSearchLoading,
    suggesting: schoolSuggestLoading,
    reload: reloadSchools,
  } = useSchoolSearch(schoolSearch)
  const schoolPanelRef = useRef<HTMLDivElement>(null)
  const [selectedSchoolId, setSelectedSchoolId] = useState('')
  const [selectedSchoolName, setSelectedSchoolName] = useState('')
  const [addingSchool, setAddingSchool] = useState(false)
  const [schoolClasses, setSchoolClasses] = useState<SchoolClassOption[]>([])
  const [classesLoading, setClassesLoading] = useState(false)

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
        const mapped = dsl ? subjectIdFromFreeLabel(dsl) : ''
        if (mapped && mapped !== 'khac') {
          setSubjectId((prev) => (prev ? prev : mapped))
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!joinQrOpen) return
    const code = result?.joinCode.trim() ?? ''
    if (!code || typeof window === 'undefined') {
      setJoinQrDataUrl(null)
      setJoinQrFailed(true)
      return
    }
    const url = `${window.location.origin}/lop/tham-gia?code=${encodeURIComponent(code)}`
    let cancelled = false
    setJoinQrUrl(url)
    setJoinQrDataUrl(null)
    setJoinQrFailed(false)
    void import('qrcode')
      .then((QR) => QR.default.toDataURL(url, { width: 280, margin: 2 }))
      .then((dataUrl) => {
        if (!cancelled) setJoinQrDataUrl(dataUrl)
      })
      .catch(() => {
        if (!cancelled) {
          setJoinQrDataUrl(null)
          setJoinQrFailed(true)
        }
      })
    return () => {
      cancelled = true
    }
  }, [joinQrOpen, result?.joinCode])

  useEffect(() => {
    setClassName('')
    setClassSearch('')
    setPickedClassId('')
    setClassDropdownOpen(false)
    if (!selectedSchoolId) {
      setSchoolClasses([])
      return
    }
    let cancelled = false
    setClassesLoading(true)
    fetch(`/api/classes/by-school?schoolId=${encodeURIComponent(selectedSchoolId)}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        const items = Array.isArray(data?.items) ? data.items : []
        setSchoolClasses(
          items
            .map((item: { id?: string; name?: string; choice?: string }) => ({
              id: String(item?.id ?? ''),
              name: String(item?.name ?? '').trim(),
              choice: item?.choice === 'original' || item?.choice === 'edited' ? item.choice : null,
            }))
            .filter((item: SchoolClassOption) => item.id && item.name)
        )
      })
      .catch(() => {
        if (!cancelled) setSchoolClasses([])
      })
      .finally(() => {
        if (!cancelled) setClassesLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [selectedSchoolId])

  const classHits = useMemo(() => {
    const needle = foldClassKey(classSearch)
    if (needle.length < 2) return []
    const matchedIds = new Set(
      schoolClasses.filter((item) => foldClassKey(item.name).includes(needle)).map((item) => item.id)
    )
    return schoolClasses
      .filter((item) => matchedIds.has(item.id))
      .map((item): SchoolSearchHit => ({ id: item.id, name: item.name, choice: item.choice }))
  }, [classSearch, schoolClasses])

  const chooseSavedSchool = useCallback(
    async (item: SchoolSearchHit) => {
      setAddingSchool(true)
      try {
        const saved = await voteSavedSchool({
          schoolId: item.id,
          choice: item.choice,
          setAsDefault: true,
        })
        if (!saved.ok) {
          toast({
            variant: 'destructive',
            description: saved.error || t.createClassSchoolNotFound,
          })
          return
        }
        const label = saved.canonicalName || item.name
        setSelectedSchoolId(saved.schoolId)
        setSelectedSchoolName(label)
        setSchoolSearch(label)
        setSchoolDropdownOpen(false)
        reloadSchools()
      } catch (e) {
        toast({
          variant: 'destructive',
          description: e instanceof Error ? e.message : String(e),
        })
      } finally {
        setAddingSchool(false)
      }
    },
    [reloadSchools, toast, t.createClassSchoolNotFound]
  )

  const renameSchool = useCallback(
    async (schoolId: string, name: string) => {
      const saved = await renameSavedSchool({ schoolId, name })
      if (!saved.ok) {
        toast({ variant: 'destructive', description: saved.error || t.createClassSchoolNotFound })
        return false
      }
      reloadSchools()
      return true
    },
    [reloadSchools, toast, t.createClassSchoolNotFound]
  )

  const addSchoolFromSearch = useCallback(
    async (rawName?: string, siblingNames?: string[]) => {
      const raw = (rawName ?? schoolSearch).trim()
      if (raw.length < 3) return
      setAddingSchool(true)
      try {
        const saved = await savePickedSchool({
          name: raw,
          siblingNames,
          query: schoolSearch.trim(),
          setAsDefault: true,
        })
        if (!saved.ok) {
          toast({
            variant: 'destructive',
            description: saved.error || t.createClassSchoolNotFound,
          })
          return
        }
        setSelectedSchoolId(saved.schoolId)
        setSelectedSchoolName(saved.canonicalName)
        setSchoolSearch(saved.canonicalName)
        setSchoolDropdownOpen(false)
      } catch (e) {
        toast({
          variant: 'destructive',
          description: e instanceof Error ? e.message : String(e),
        })
      } finally {
        setAddingSchool(false)
      }
    },
    [schoolSearch, toast, t.createClassSchoolNotFound]
  )

  function commitClass(name: string, classId: string) {
    setClassName(name)
    setClassSearch(name)
    setPickedClassId(classId)
    setClassDropdownOpen(false)
  }

  async function reloadClasses(schoolId: string) {
    const res = await fetch(`/api/classes/by-school?schoolId=${encodeURIComponent(schoolId)}`, { cache: 'no-store' })
    const data = await res.json().catch(() => ({}))
    const items = Array.isArray(data?.items) ? data.items : []
    setSchoolClasses(
      items
        .map((item: { id?: string; name?: string; choice?: string }) => ({
          id: String(item?.id ?? ''),
          name: String(item?.name ?? '').trim(),
          choice: item?.choice === 'original' || item?.choice === 'edited' ? item.choice : null,
        }))
        .filter((item: SchoolClassOption) => item.id && item.name)
    )
  }

  async function pickClass(item: SchoolSearchHit) {
    if (item.choice) {
      setRenamingClass(true)
      try {
        const res = await fetch('/api/classes/name-edit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ classId: item.id, choice: item.choice }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          toast({ variant: 'destructive', description: data?.error || t.renameClassFailed })
          return
        }
        if (data?.resolved && selectedSchoolId) await reloadClasses(selectedSchoolId)
      } catch (e) {
        toast({
          variant: 'destructive',
          description: e instanceof Error ? e.message : t.renameClassFailed,
        })
        return
      } finally {
        setRenamingClass(false)
      }
    }
    commitClass(item.name, item.id)
  }

  function typeOwnClass(rawName: string) {
    const raw = rawName.trim()
    if (raw.length < 2) return
    const existing = schoolClasses.find((item) => foldClassKey(item.name) === foldClassKey(raw))
    if (existing) {
      void pickClass({ id: existing.id, name: existing.name, choice: existing.choice })
      return
    }
    commitClass(raw, '')
  }

  const renameClass = useCallback(
    async (classId: string, name: string) => {
      const next = name.trim()
      if (next.length < 2) return false
      setRenamingClass(true)
      try {
        const res = await fetch('/api/classes/name-edit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ classId, name: next }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          toast({ variant: 'destructive', description: data?.error || t.renameClassFailed })
          return false
        }
        if (selectedSchoolId) await reloadClasses(selectedSchoolId)
        return true
      } catch (e) {
        toast({
          variant: 'destructive',
          description: e instanceof Error ? e.message : t.renameClassFailed,
        })
        return false
      } finally {
        setRenamingClass(false)
      }
    },
    [selectedSchoolId, t.renameClassFailed, toast]
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (loading) return
    if (!selectedSchoolId) {
      toast({ variant: 'destructive', description: t.createClassSchoolRequired })
      return
    }
    const typedName = (className || classSearch).trim().replace(/\s+/g, ' ')
    if (!typedName) {
      toast({ variant: 'destructive', description: t.enterClassPickClassPlaceholder })
      return
    }
    const existingAtSchool = findSchoolClass(typedName, schoolClasses)
    const classIdToSend =
      existingAtSchool?.id ||
      (pickedClassId && classNameKey(className) === classNameKey(typedName) ? pickedClassId : '')
    if (!subjectId.trim()) {
      toast({ variant: 'destructive', description: t.enterClassSubject })
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/classes/enter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          className: existingAtSchool?.name || typedName,
          classId: classIdToSend,
          schoolId: selectedSchoolId,
          subjectId,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.item?.id) {
        toast({
          variant: 'destructive',
          description:
            data?.code === 'profile_required' ? t.teacherIdentityRequired : data?.error || t.enterClassFailed,
        })
        return
      }
      const status =
        data.status === 'attached' || data.status === 'already' || data.status === 'created'
          ? data.status
          : 'created'
      setResult({
        status,
        classId: String(data.item.id),
        className: String(data.item.name ?? typedName),
        joinCode: String(data.item.joinCode ?? ''),
      })
      router.refresh()
    } catch (err) {
      toast({
        variant: 'destructive',
        description: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setLoading(false)
    }
  }

  if (result) {
    const message =
      result.status === 'attached'
        ? t.enterClassAttached
        : result.status === 'already'
          ? t.enterClassAlready
          : t.enterClassCreated
    return (
      <>
        <Toaster />
        <div className="mb-8 rounded-xl border border-input bg-card p-5 space-y-4">
          <p className="text-sm text-foreground leading-relaxed">{message}</p>
          {result.joinCode ? (
            <div>
              <label className="text-sm font-medium text-muted-foreground">{t.joinCode}</label>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <code className="flex-1 px-3 py-2 rounded-lg bg-muted font-mono text-lg tracking-wider">
                  {result.joinCode}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(result.joinCode)
                    toast({ description: t.copied })
                  }}
                >
                  {t.copyCode}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  className="gap-1.5"
                  onClick={() => setJoinQrOpen(true)}
                >
                  <QrCode className="h-4 w-4" aria-hidden />
                  {t.joinQrButton}
                </Button>
              </div>
            </div>
          ) : null}
          <Dialog open={joinQrOpen} onOpenChange={setJoinQrOpen}>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>{t.joinQrTitle}</DialogTitle>
                <DialogDescription>{t.joinQrHint}</DialogDescription>
              </DialogHeader>
              <div className="flex flex-col items-center gap-3 py-1">
                <p className="text-sm font-medium text-foreground">
                  {result.className}
                  <span className="ml-2 font-mono tracking-wide text-muted-foreground">{result.joinCode}</span>
                </p>
                {joinQrDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- data URL từ thư viện qrcode
                  <img
                    src={joinQrDataUrl}
                    alt={t.joinQrTitle}
                    width={280}
                    height={280}
                    className="rounded-lg border border-border bg-white p-2"
                  />
                ) : joinQrFailed ? (
                  <p className="text-sm text-destructive">{t.joinQrFailed}</p>
                ) : (
                  <div className="h-[280px] w-[280px] animate-pulse rounded-lg bg-muted" aria-hidden />
                )}
                <div className="flex w-full gap-2">
                  <div className="min-w-0 flex-1 rounded-md border border-input bg-muted/40 px-3 py-2 font-mono text-xs break-all text-foreground">
                    {joinQrUrl}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 shrink-0"
                    aria-label={t.joinQrCopyLink}
                    onClick={() => {
                      if (!joinQrUrl) return
                      void navigator.clipboard.writeText(joinQrUrl)
                      toast({ description: t.copied })
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button asChild>
              <a href={`/lop/${result.classId}`}>{t.classNameTakenOpen}</a>
            </Button>
            <Button variant="outline" type="button" onClick={() => setResult(null)}>
              {t.classNameTakenTryOther}
            </Button>
          </div>
        </div>
      </>
    )
  }

  const typedClassName = (className || classSearch).trim()
  const classAlreadyAtSchool = Boolean(
    findSchoolClass(typedClassName, schoolClasses) ||
      (pickedClassId && classNameKey(className) === classNameKey(typedClassName))
  )

  return (
    <>
      <Toaster />
      <form onSubmit={handleSubmit} className="mb-8 space-y-4 rounded-xl border border-border/80 bg-card p-4 sm:p-5">
        <p className="text-sm text-muted-foreground leading-relaxed">{t.enterClassLead}</p>
        <div className="space-y-2">
          <label htmlFor="enter-school" className="block text-sm font-medium text-foreground">
            {t.schoolLabel} <span className="text-destructive">*</span>
          </label>
          <div className="relative">
            <Input
              id="enter-school"
              value={schoolSearch}
              onChange={(e) => {
                const next = e.target.value
                setSchoolSearch(next)
                setSchoolDropdownOpen(true)
                if (selectedSchoolName && next.trim() !== selectedSchoolName.trim()) {
                  setSelectedSchoolId('')
                  setSelectedSchoolName('')
                }
              }}
              onFocus={() => setSchoolDropdownOpen(true)}
              onBlur={() => {
                window.setTimeout(() => {
                  if (schoolPanelRef.current?.contains(document.activeElement)) return
                  setSchoolDropdownOpen(false)
                }, 180)
              }}
              placeholder={t.createClassSchoolPlaceholder}
              disabled={loading}
              className="w-full"
              autoComplete="off"
            />
            {schoolDropdownOpen && schoolSearch.trim().length >= 2 && (
              <div
                ref={schoolPanelRef}
                className="absolute left-0 right-0 top-full z-20 mt-1 max-h-80 overflow-y-auto rounded-md border bg-background p-1 shadow-md"
                onMouseDown={(e) => {
                  const target = e.target as HTMLElement
                  if (target.closest('input, textarea')) return
                  e.preventDefault()
                }}
              >
                <SchoolNameOptions
                  items={schoolSearchItems}
                  suggestions={schoolSuggestions}
                  loading={schoolSearchLoading}
                  suggesting={schoolSuggestLoading}
                  query={schoolSearch.trim()}
                  selectedId={selectedSchoolId}
                  selectedName={selectedSchoolName}
                  busy={addingSchool}
                  labels={{
                    searching: t.createClassSchoolSearching,
                    suggesting: t.createClassSchoolSuggesting,
                    suggestions: t.createClassSchoolSuggestions,
                    edit: t.createClassSchoolEdit,
                    save: t.createClassSchoolEditSave,
                    typeOwn: t.createClassSchoolTypeOwn,
                    typeOwnPlaceholder: t.createClassSchoolTypeOwnPlaceholder,
                  }}
                  onPickSaved={(item) => void chooseSavedSchool(item)}
                  onPickSuggestion={(name, siblingNames) => void addSchoolFromSearch(name, siblingNames)}
                  onTypeOwn={(name) => void addSchoolFromSearch(name)}
                  onRename={renameSchool}
                />
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

        <div className="space-y-2">
          <label htmlFor="enter-class" className="block text-sm font-medium text-foreground">
            {t.enterClassPickClass}
          </label>
          <div className="relative">
            <Input
              id="enter-class"
              value={classSearch}
              onChange={(e) => {
                const next = e.target.value
                setClassSearch(next)
                setClassDropdownOpen(true)
                if (className && next.trim() !== className.trim()) {
                  setClassName('')
                  setPickedClassId('')
                }
              }}
              onFocus={() => setClassDropdownOpen(true)}
              onBlur={() => {
                window.setTimeout(() => {
                  if (classPanelRef.current?.contains(document.activeElement)) return
                  setClassDropdownOpen(false)
                }, 180)
              }}
              placeholder={t.enterClassSearchPlaceholder}
              disabled={loading || !selectedSchoolId}
              className="w-full"
              autoComplete="off"
            />
            {classDropdownOpen && classSearch.trim().length >= 2 && (
              <div
                ref={classPanelRef}
                className="absolute left-0 right-0 top-full z-20 mt-1 max-h-80 overflow-y-auto rounded-md border bg-background p-1 shadow-md"
                onMouseDown={(e) => {
                  const target = e.target as HTMLElement
                  if (target.closest('input, textarea')) return
                  e.preventDefault()
                }}
              >
                <SchoolNameOptions
                  items={classHits}
                  suggestions={[]}
                  loading={classesLoading}
                  suggesting={false}
                  query={classSearch.trim()}
                  selectedId={pickedClassId}
                  selectedName={className}
                  busy={renamingClass || loading}
                  typeOwnMinLength={2}
                  labels={{
                    searching: t.enterClassSearching,
                    suggesting: '',
                    suggestions: '',
                    edit: t.createClassSchoolEdit,
                    save: t.createClassSchoolEditSave,
                    typeOwn: t.createClassSchoolTypeOwn,
                    typeOwnPlaceholder: t.enterClassTypeOwnPlaceholder,
                  }}
                  onPickSaved={pickClass}
                  onPickSuggestion={() => {}}
                  onTypeOwn={typeOwnClass}
                  onRename={renameClass}
                />
              </div>
            )}
          </div>
          {className ? (
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{t.enterClassSelected}:</span> {className}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <label htmlFor="enter-subject" className="block text-sm font-medium text-foreground">
            {t.enterClassSubject}
          </label>
          <ClassSubjectField
            id="enter-subject"
            t={t}
            locale={locale}
            value={subjectId}
            onChange={setSubjectId}
            disabled={loading}
          />
        </div>

        <p className="text-sm text-muted-foreground">{t.teacherIdentityAccountNote}</p>

        <Button type="submit" disabled={loading || !selectedSchoolId} className="w-full">
          {loading ? '...' : classAlreadyAtSchool ? t.enterClassSubmit : t.createClass}
        </Button>
      </form>
    </>
  )
}
