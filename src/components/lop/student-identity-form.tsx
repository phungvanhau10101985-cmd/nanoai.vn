'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { StudentBirthDateSelects } from '@/components/student-birth-date-selects'
import { buildDob, splitDob } from '@/lib/student-dob'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { TeacherGender } from '@/lib/lop/teacher-public-name'

export type StudentIdentityValue = {
  givenName: string
  gender: TeacherGender | null
  birthDate: string
}

export function StudentIdentityForm({
  initialName = '',
  initialGender = null,
  initialBirthDate = '',
  labels,
  onSaved,
}: {
  initialName?: string
  initialGender?: TeacherGender | null
  initialBirthDate?: string
  labels: {
    title: string
    lead: string
    nameLabel: string
    namePlaceholder: string
    birthLabel: string
    day: string
    month: string
    year: string
    genderLabel: string
    male: string
    female: string
    save: string
    required: string
  }
  onSaved?: (value: StudentIdentityValue) => void
}) {
  const initialDob = splitDob(initialBirthDate)
  const [name, setName] = useState(initialName)
  const [gender, setGender] = useState<TeacherGender | null>(initialGender)
  const [dobDay, setDobDay] = useState(initialDob.day)
  const [dobMonth, setDobMonth] = useState(initialDob.month)
  const [dobYear, setDobYear] = useState(initialDob.year)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  return (
    <form
      className="space-y-4 rounded-xl border border-border/70 bg-background/60 p-4"
      onSubmit={async (e) => {
        e.preventDefault()
        if (saving) return
        const birthDate = buildDob(dobDay, dobMonth, dobYear)
        if (name.trim().length < 2 || !gender || !birthDate) {
          setError(labels.required)
          return
        }
        setSaving(true)
        setError('')
        try {
          const res = await fetch('/api/profile/student-identity', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fullName: name, gender, birthDate }),
          })
          const data = await res.json().catch(() => ({}))
          if (!res.ok) {
            setError(String(data?.error || labels.required))
            return
          }
          onSaved?.({
            givenName: String(data?.givenName ?? name.trim()),
            gender,
            birthDate: String(data?.birthDate ?? birthDate),
          })
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
        <label htmlFor="student-identity-name" className="text-sm font-medium text-foreground">
          {labels.nameLabel} <span className="text-destructive">*</span>
        </label>
        <Input
          id="student-identity-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={labels.namePlaceholder}
          maxLength={120}
          autoComplete="name"
        />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">
          {labels.birthLabel} <span className="text-destructive">*</span>
        </p>
        <StudentBirthDateSelects
          idPrefix="student-identity-dob"
          dobDay={dobDay}
          dobMonth={dobMonth}
          dobYear={dobYear}
          onDayChange={setDobDay}
          onMonthChange={setDobMonth}
          onYearChange={setDobYear}
          disabled={saving}
          labels={{ day: labels.day, month: labels.month, year: labels.year }}
        />
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-foreground">
          {labels.genderLabel} <span className="text-destructive">*</span>
        </legend>
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant={gender === 'male' ? 'default' : 'outline'} onClick={() => setGender('male')}>
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
      <Button type="submit" className="w-full" disabled={saving}>
        {saving ? '...' : labels.save}
      </Button>
    </form>
  )
}

export function studentIdentityLabels(t: Dictionary['classes']) {
  return {
    title: t.studentIdentityTitle,
    lead: t.studentIdentityLead,
    nameLabel: t.joinStudentDisplayName,
    namePlaceholder: t.teacherIdentityNamePlaceholder,
    birthLabel: t.joinStudentBirthDate,
    day: t.joinDobDayPlaceholder,
    month: t.joinDobMonthPlaceholder,
    year: t.joinDobYearPlaceholder,
    genderLabel: t.teacherIdentityGenderLabel,
    male: t.teacherIdentityMale,
    female: t.teacherIdentityFemale,
    save: t.teacherIdentitySave,
    required: t.studentIdentityRequired,
  }
}

export function StudentIdentityGate({
  t,
  initialName,
  initialGender,
  initialBirthDate,
}: {
  t: Dictionary['classes']
  initialName: string
  initialGender: TeacherGender | null
  initialBirthDate: string
}) {
  const router = useRouter()
  return (
    <StudentIdentityForm
      initialName={initialName}
      initialGender={initialGender}
      initialBirthDate={initialBirthDate}
      labels={studentIdentityLabels(t)}
      onSaved={() => router.refresh()}
    />
  )
}
