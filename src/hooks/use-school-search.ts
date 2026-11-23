'use client'

import { useEffect, useState } from 'react'

export type SchoolSearchHit = { id: string; name: string; choice: 'original' | 'edited' | null }

function readSchoolHits(data: { items?: unknown }): SchoolSearchHit[] {
  if (!Array.isArray(data?.items)) return []
  return data.items
    .map((item) => {
      const row = item as { id?: unknown; name?: unknown; choice?: unknown }
      let choice: 'original' | 'edited' | null = null
      if (row.choice === 'original' || row.choice === 'edited') choice = row.choice
      return { id: String(row.id ?? ''), name: String(row.name ?? '').trim(), choice }
    })
    .filter((item) => item.id.length > 0 && item.name.length > 0)
}

/** Ngừng gõ khoảng 1 giây rồi mới tìm trường và nhờ DeepSeek gợi ý. */
const SCHOOL_NAME_IDLE_MS = 1000

/** Tìm trường trong DB trước. Không có dòng nào thì hỏi DeepSeek, chưa ghi DB. */
export function useSchoolSearch(query: string, suspended = false) {
  const [items, setItems] = useState<SchoolSearchHit[]>([])
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [canCreate, setCanCreate] = useState(false)
  const [loading, setLoading] = useState(false)
  const [suggesting, setSuggesting] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)
  const [trackedQuery, setTrackedQuery] = useState(query)
  const [trackedSuspended, setTrackedSuspended] = useState(suspended)

  if (query !== trackedQuery || suspended !== trackedSuspended) {
    setTrackedQuery(query)
    setTrackedSuspended(suspended)
    setItems([])
    setSuggestions([])
    setCanCreate(false)
    setLoading(false)
    setSuggesting(false)
  }

  useEffect(() => {
    const needle = query.trim()
    if (suspended || needle.length < 2) return
    let cancelled = false
    const ac = new AbortController()
    const timer = window.setTimeout(async () => {
      setLoading(true)
      setSuggesting(false)
      setSuggestions([])
      try {
        const res = await fetch(`/api/schools/search?q=${encodeURIComponent(needle)}`, {
          cache: 'no-store',
          signal: ac.signal,
        })
        const data = await res.json().catch(() => ({}))
        if (cancelled) return
        if (!res.ok) {
          setItems([])
          setCanCreate(false)
          return
        }
        const found = readSchoolHits(data)
        setItems(found)
        setCanCreate(Boolean(data?.canCreate))
        setLoading(false)
        if (found.length > 0 || needle.length < 3) return
        setSuggesting(true)
        const sugRes = await fetch(`/api/schools/search?q=${encodeURIComponent(needle)}&suggest=1`, {
          cache: 'no-store',
          signal: ac.signal,
        })
        const sug = await sugRes.json().catch(() => ({}))
        if (cancelled) return
        const again = readSchoolHits(sug)
        if (again.length > 0) {
          setItems(again)
          setSuggestions([])
          setCanCreate(Boolean(sug?.canCreate))
          return
        }
        const names = Array.isArray(sug?.suggestions)
          ? sug.suggestions.map((item: unknown) => String(item ?? '').trim()).filter((item: string) => item.length >= 3)
          : []
        setSuggestions(names)
        setCanCreate(Boolean(sug?.canCreate) || needle.length >= 3)
      } catch {
        if (!cancelled) {
          setItems([])
          setSuggestions([])
          setCanCreate(false)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
          setSuggesting(false)
        }
      }
    }, SCHOOL_NAME_IDLE_MS)
    return () => {
      cancelled = true
      ac.abort()
      window.clearTimeout(timer)
    }
  }, [query, reloadToken, suspended])

  return { items, suggestions, canCreate, loading, suggesting, reload: () => setReloadToken((n) => n + 1) }
}

export async function savePickedSchool(input: {
  name: string
  siblingNames?: string[]
  query: string
  setAsDefault: boolean
}): Promise<{ ok: true; schoolId: string; canonicalName: string } | { ok: false; error: string }> {
  const res = await fetch('/api/schools/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: input.name,
      siblingNames: input.siblingNames ?? [],
      query: input.query,
      setAsDefault: input.setAsDefault,
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data?.schoolId) {
    return { ok: false, error: typeof data?.error === 'string' ? data.error : '' }
  }
  return {
    ok: true,
    schoolId: String(data.schoolId),
    canonicalName: String(data.canonicalName ?? input.name).trim(),
  }
}

export async function voteSavedSchool(input: {
  schoolId: string
  choice: 'original' | 'edited' | null
  setAsDefault: boolean
}): Promise<{ ok: true; schoolId: string; canonicalName: string } | { ok: false; error: string }> {
  const res = await fetch('/api/schools/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      schoolId: input.schoolId,
      choice: input.choice,
      setAsDefault: input.setAsDefault,
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data?.schoolId) {
    return { ok: false, error: typeof data?.error === 'string' ? data.error : '' }
  }
  return {
    ok: true,
    schoolId: String(data.schoolId),
    canonicalName: String(data.canonicalName ?? '').trim(),
  }
}

export async function renameSavedSchool(input: {
  schoolId: string
  name: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await fetch('/api/schools/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'rename', schoolId: input.schoolId, name: input.name }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) return { ok: false, error: typeof data?.error === 'string' ? data.error : '' }
  return { ok: true }
}
