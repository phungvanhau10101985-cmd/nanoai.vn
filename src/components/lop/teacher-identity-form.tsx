'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { TeacherGender } from '@/lib/lop/teacher-public-name'

export type TeacherIdentityLabels = {
  title: string
  lead: string
  nameLabel: string
  namePlaceholder: string
  genderLabel: string
  male: string
  female: string
  save: string
  required: string
  saved: string
}

export function TeacherIdentityForm({
  initialName = '',
  initialGender = null,
  labels,
  onSaved,
}: {
  initialName?: string
  initialGender?: TeacherGender | null
  labels: TeacherIdentityLabels
  onSaved?: (publicName: string) => void
}) {
  const [name, setName] = useState(initialName)
  const [gender, setGender] = useState<TeacherGender | null>(initialGender)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  return (
    <form
      className="space-y-4 rounded-xl border border-border/70 bg-background/60 p-4"
      onSubmit={async (e) => {
        e.preventDefault()
        if (saving) return
        if (!name.trim() || !gender) {
          setError(labels.required)
          return
        }
        setSaving(true)
        setError('')
        try {
          const res = await fetch('/api/profile/teacher-identity', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fullName: name, gender }),
          })
          const data = await res.json().catch(() => ({}))
          if (!res.ok) {
            setError(String(data?.error || labels.required))
            return
          }
          onSaved?.(String(data?.publicName ?? ''))
        } finally {
          setSaving(false)
        }
      }}
    >
      <div>
        <h2 className="text-base font-semibold text-foreground">{labels.title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{labels.lead}</p>
      </div>
      <div className="space-y-1">
        <label htmlFor="teacher-identity-name" className="text-sm font-medium text-foreground">
          {labels.nameLabel}
        </label>
        <Input
          id="teacher-identity-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={labels.namePlaceholder}
          maxLength={80}
          autoComplete="name"
        />
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-foreground">{labels.genderLabel}</legend>
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant={gender === 'male' ? 'default' : 'outline'}
            onClick={() => setGender('male')}
          >
            {labels.male}
          </Button>
          <Button
            type="button"
            variant={gender === 'female' ? 'default' : 'outline'}
            onClick={() => setGender('female')}
          >
            {labels.female}
          </Button>
        </div>
      </fieldset>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" disabled={saving}>
        {saving ? '...' : labels.save}
      </Button>
    </form>
  )
}

export function TeacherIdentityGate({
  t,
  initialName,
  initialGender,
}: {
  t: Dictionary['classes']
  initialName: string
  initialGender: TeacherGender | null
}) {
  const router = useRouter()
  return (
    <TeacherIdentityForm
      initialName={initialName}
      initialGender={initialGender}
      labels={{
        title: t.teacherIdentityTitle,
        lead: t.teacherIdentityLead,
        nameLabel: t.teacherIdentityNameLabel,
        namePlaceholder: t.teacherIdentityNamePlaceholder,
        genderLabel: t.teacherIdentityGenderLabel,
        male: t.teacherIdentityMale,
        female: t.teacherIdentityFemale,
        save: t.teacherIdentitySave,
        required: t.teacherIdentityRequired,
        saved: t.teacherIdentitySaved,
      }}
      onSaved={() => router.refresh()}
    />
  )
}
