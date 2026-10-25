'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'
import { createClass } from '../actions'
import { renameSavedSchool, savePickedSchool, useSchoolSearch, voteSavedSchool, type SchoolSearchHit } from '@/hooks/use-school-search'
import { SchoolNameOptions } from '@/components/school/school-name-options'
import type { Dictionary } from '@/lib/i18n/dictionaries'

export default function TaoLopForm({ t }: { t: Dictionary['classes'] }) {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ classId: string; joinCode: string } | null>(null)
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

  const chooseSavedSchool = useCallback(async (item: SchoolSearchHit) => {
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
  }, [reloadSchools, toast, t.createClassSchoolNotFound])

  const renameSchool = useCallback(async (schoolId: string, name: string) => {
    const saved = await renameSavedSchool({ schoolId, name })
    if (!saved.ok) {
      toast({ variant: 'destructive', description: saved.error || t.createClassSchoolNotFound })
      return false
    }
    reloadSchools()
    return true
  }, [reloadSchools, toast, t.createClassSchoolNotFound])

  const addSchoolFromSearch = useCallback(async (rawName?: string, siblingNames?: string[]) => {
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
