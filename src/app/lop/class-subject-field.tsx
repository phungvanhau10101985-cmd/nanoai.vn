'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { SchoolNameOptions } from '@/components/school/school-name-options'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import type { SchoolSearchHit } from '@/hooks/use-school-search'
import { directExistingClassSubject, foldSubjectLabel, matchingClassSubjects } from '@/lib/lop/class-subject'
import type { Dictionary } from '@/lib/i18n/dictionaries'

type SubjectOption = {
  id: string
  labelVi: string
  labelEn: string
  choice: 'original' | 'edited' | null
}

export default function ClassSubjectField({
  t,
  locale,
  value,
  onChange,
  disabled = false,
  id = 'enter-subject',
  compact = false,
}: {
  t: Dictionary['classes']
  locale: string
  value: string
  onChange: (subjectId: string) => void
  disabled?: boolean
  id?: string
  compact?: boolean
}) {
  const { toast } = useToast()
  const [items, setItems] = useState<SubjectOption[]>([])
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loadingList, setLoadingList] = useState(true)
  const rootRef = useRef<HTMLDivElement>(null)
  const touchedRef = useRef(false)

  const loadSubjects = useCallback(async () => {
    const res = await fetch('/api/classes/subjects', { cache: 'no-store' })
    const data = await res.json().catch(() => ({}))
    if (!Array.isArray(data?.items)) return
    setItems(
      data.items
        .map((item: { id?: string; labelVi?: string; labelEn?: string; choice?: string }) => ({
          id: String(item?.id ?? ''),
          labelVi: String(item?.labelVi ?? '').trim(),
          labelEn: String(item?.labelEn ?? '').trim(),
          choice: item?.choice === 'original' || item?.choice === 'edited' ? item.choice : null,
        }))
        .filter((item: SubjectOption) => item.id && item.id !== 'khac' && item.labelVi)
    )
  }, [])

  useEffect(() => {
    let cancelled = false
    loadSubjects()
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingList(false)
      })
    return () => {
      cancelled = true
    }
  }, [loadSubjects])

  const labelOf = (item: SubjectOption) => (locale === 'vi' ? item.labelVi : item.labelEn || item.labelVi)

  useEffect(() => {
    if (touchedRef.current || !value) return
    const found = items.find((item) => item.id === value)
    if (!found) return
    setQuery(locale === 'vi' ? found.labelVi : found.labelEn || found.labelVi)
  }, [value, items, locale])

  const hits = useMemo(() => {
    const q = query.trim()
    if (foldSubjectLabel(q).length < 2) return []
    const matchedIds = new Set(matchingClassSubjects(items, q).map((item) => item.id))
    return items
      .filter((item) => matchedIds.has(item.id))
      .map(
        (item): SchoolSearchHit => ({
          id: item.id,
          name: locale === 'vi' ? item.labelVi : item.labelEn || item.labelVi,
          choice: item.choice,
        })
      )
  }, [items, locale, query])

  const typedExisting = directExistingClassSubject(items, query)

  async function pickExisting(item: SubjectOption) {
    if (item.choice) {
      setSaving(true)
      try {
        const res = await fetch('/api/classes/subjects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subjectId: item.id, choice: item.choice }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          toast({ variant: 'destructive', description: data?.error || t.enterClassAddSubjectFailed })
          return
        }
        if (data?.resolved) await loadSubjects()
      } catch (err) {
        toast({
          variant: 'destructive',
          description: err instanceof Error ? err.message : t.enterClassAddSubjectFailed,
        })
        return
      } finally {
        setSaving(false)
      }
    }
    onChange(item.id)
    setQuery(labelOf(item))
    setOpen(false)
  }

  async function renameSubject(subjectId: string, name: string) {
    setSaving(true)
    try {
      const res = await fetch('/api/classes/subjects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'rename', subjectId, name }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast({ variant: 'destructive', description: data?.error || t.enterClassAddSubjectFailed })
        return false
      }
      await loadSubjects()
      return true
    } catch (err) {
      toast({
        variant: 'destructive',
        description: err instanceof Error ? err.message : t.enterClassAddSubjectFailed,
      })
      return false
    } finally {
      setSaving(false)
    }
  }

  function onQueryChange(next: string) {
    touchedRef.current = true
    setQuery(next)
    setOpen(true)
    const existing = directExistingClassSubject(items, next)
    if (existing) {
      if (existing.id !== value) onChange(existing.id)
      return
    }
    if (value) onChange('')
  }

  async function saveSubject(rawName?: string) {
    const name = (rawName ?? query).trim()
    if (name.length < 2 || saving) return
    const existing = directExistingClassSubject(items, name)
    if (existing) {
      pickExisting(existing)
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/classes/subjects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.item?.id) {
        toast({ variant: 'destructive', description: data?.error || t.enterClassAddSubjectFailed })
        return
      }
      const next: SubjectOption = {
        id: String(data.item.id),
        labelVi: String(data.item.labelVi ?? name),
        labelEn: String(data.item.labelEn ?? data.item.labelVi ?? name),
      }
      setItems((prev) => (prev.some((item) => item.id === next.id) ? prev : [...prev, next]))
      onChange(next.id)
      setQuery(labelOf(next))
      setOpen(false)
    } catch (err) {
      toast({
        variant: 'destructive',
        description: err instanceof Error ? err.message : t.enterClassAddSubjectFailed,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-1">
      <div className="relative" ref={rootRef}>
        <Input
          id={id}
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            window.setTimeout(() => {
              if (rootRef.current?.contains(document.activeElement)) return
              setOpen(false)
              const existing = directExistingClassSubject(items, query)
              if (!existing) return
              setQuery(labelOf(existing))
              if (value !== existing.id) onChange(existing.id)
            }, 180)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setOpen(false)
              return
            }
            if (e.key !== 'Enter') return
            const existing = directExistingClassSubject(items, query)
            if (existing) {
              if (value !== existing.id) {
                e.preventDefault()
                pickExisting(existing)
              }
              return
            }
            if (query.trim().length >= 2) {
              e.preventDefault()
              void saveSubject()
            }
          }}
          placeholder={t.enterClassAddSubjectPlaceholder}
          maxLength={80}
          disabled={disabled || saving}
          required
          className={compact ? 'h-8 text-sm' : 'h-10'}
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-existing`}
          aria-autocomplete="list"
          autoComplete="off"
        />
        {open && !disabled && query.trim().length >= 2 ? (
          <div
            id={`${id}-existing`}
            className="absolute left-0 right-0 top-full z-20 mt-1 max-h-80 overflow-y-auto rounded-md border bg-background p-1 shadow-md"
            onMouseDown={(e) => {
              const target = e.target as HTMLElement
              if (target.closest('input, textarea')) return
              e.preventDefault()
            }}
          >
            <SchoolNameOptions
              items={hits}
              suggestions={[]}
              loading={loadingList}
              suggesting={false}
              query={query.trim()}
              selectedId={value}
              selectedName={query}
              busy={saving || disabled}
              typeOwnMinLength={2}
              labels={{
                searching: t.enterClassAddSubjectSaving,
                suggesting: '',
                suggestions: '',
                edit: t.createClassSchoolEdit,
                save: t.createClassSchoolEditSave,
                typeOwn: t.createClassSchoolTypeOwn,
                typeOwnPlaceholder: t.enterClassAddSubjectPlaceholder,
              }}
              onPickSaved={(item) => {
                const found =
                  items.find((row) => row.id === item.id && row.choice === item.choice && labelOf(row) === item.name) ??
                  items.find((row) => row.id === item.id && labelOf(row) === item.name)
                if (found) void pickExisting(found)
              }}
              onPickSuggestion={() => {}}
              onTypeOwn={(name) => {
                void saveSubject(name)
              }}
              onRename={renameSubject}
            />
          </div>
        ) : null}
      </div>
      {saving ? <p className="text-xs text-muted-foreground">{t.enterClassAddSubjectSaving}</p> : null}
    </div>
  )
}
