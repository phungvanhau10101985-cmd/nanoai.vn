'use client'

import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { SchoolSearchHit } from '@/hooks/use-school-search'

type Labels = {
  searching: string
  suggesting: string
  suggestions: string
  edit: string
  save: string
  typeOwn: string
  typeOwnPlaceholder: string
}

export function SchoolNameOptions({
  items,
  suggestions,
  loading,
  suggesting,
  query,
  selectedId,
  selectedName,
  busy,
  labels,
  minCharsHint,
  onPickSaved,
  onPickSuggestion,
  onTypeOwn,
  onRename,
}: {
  items: SchoolSearchHit[]
  suggestions: string[]
  loading: boolean
  suggesting: boolean
  query: string
  selectedId: string
  selectedName: string
  busy: boolean
  labels: Labels
  minCharsHint?: string
  onPickSaved: (item: SchoolSearchHit) => void
  onPickSuggestion: (name: string, siblingNames: string[]) => void
  onTypeOwn: (name: string) => void
  onRename: (schoolId: string, name: string) => Promise<boolean>
}) {
  const [ownName, setOwnName] = useState('')
  const [editingKey, setEditingKey] = useState('')
  const [draft, setDraft] = useState('')

  useEffect(() => {
    setOwnName(items.length === 0 ? query : '')
    setEditingKey('')
  }, [query, items.length])

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-2 py-2 text-xs text-muted-foreground">
        <RefreshCw className="h-3.5 w-3.5 animate-spin shrink-0" aria-hidden />
        {labels.searching}
      </div>
    )
  }

  const showTypeOwn = query.trim().length >= 3 && !suggesting

  return (
    <>
      {items.map((item) => {
        const key = `${item.id}:${item.choice ?? 'saved'}`
        const selected = selectedId === item.id && selectedName.trim() === item.name.trim()
        if (editingKey === key) {
          return (
            <div key={key} className="flex items-center gap-1 px-1 py-1">
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="h-8 text-sm"
                autoFocus
              />
              <Button
                type="button"
                size="sm"
                className="h-8 shrink-0 px-2"
                disabled={busy || draft.trim().length < 3}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  void onRename(item.id, draft.trim()).then((ok) => {
                    if (ok) setEditingKey('')
                  })
                }}
              >
                {labels.save}
              </Button>
            </div>
          )
        }
        return (
          <div key={key} className={`flex items-center gap-1 rounded hover:bg-muted ${selected ? 'bg-muted' : ''}`}>
            <button
              type="button"
              className={`min-w-0 flex-1 rounded px-2 py-2 text-left text-sm ${selected ? 'font-medium' : ''}`}
              disabled={busy}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onPickSaved(item)}
            >
              {item.name}
            </button>
            <button
              type="button"
              className="mr-1 shrink-0 rounded border px-2 py-1 text-xs hover:bg-background"
              disabled={busy}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setEditingKey(key)
                setDraft(item.name)
              }}
            >
              {labels.edit}
            </button>
          </div>
        )
      })}
      {suggesting ? (
        <div className="flex items-center gap-2 px-2 py-2 text-xs text-muted-foreground">
          <RefreshCw className="h-3.5 w-3.5 animate-spin shrink-0" aria-hidden />
          {labels.suggesting}
        </div>
      ) : null}
      {suggestions.length > 0 ? (
        <p className="px-2 pt-1 text-[11px] font-medium text-muted-foreground">{labels.suggestions}</p>
      ) : null}
      {suggestions.map((name) => (
        <button
          key={name}
          type="button"
          className="w-full rounded px-2 py-2 text-left text-sm hover:bg-muted"
          disabled={busy}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onPickSuggestion(name, suggestions)}
        >
          {name}
        </button>
      ))}
      {showTypeOwn ? (
        <div className="mt-1 flex items-center gap-1 border-t px-1 pt-1">
          <Input
            value={ownName}
            onChange={(e) => setOwnName(e.target.value)}
            placeholder={labels.typeOwnPlaceholder}
            className="h-8 text-sm"
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-8 shrink-0 px-2"
            disabled={busy || ownName.trim().length < 3}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onTypeOwn(ownName.trim())}
          >
            {labels.typeOwn}
          </Button>
        </div>
      ) : null}
      {items.length === 0 && suggestions.length === 0 && !suggesting && query.trim().length < 3 && minCharsHint ? (
        <p className="px-2 py-1.5 text-xs text-muted-foreground">{minCharsHint}</p>
      ) : null}
    </>
  )
}
