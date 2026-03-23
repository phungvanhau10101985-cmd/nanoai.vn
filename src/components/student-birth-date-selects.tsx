'use client'

import { useEffect } from 'react'
import { daysInMonth } from '@/lib/student-dob'

export type StudentBirthDateSelectLabels = {
  day: string
  month: string
  year: string
}

type Props = {
  dobDay: string
  dobMonth: string
  dobYear: string
  onDayChange: (v: string) => void
  onMonthChange: (v: string) => void
  onYearChange: (v: string) => void
  labels: StudentBirthDateSelectLabels
  disabled?: boolean
  idPrefix?: string
  selectClassName?: string
}

/**
 * Ba ô chọn ngày / tháng / năm — cùng kiểu với màn nhập thông tin trước khi làm bài thi (lam-bai).
 */
export function StudentBirthDateSelects({
  dobDay,
  dobMonth,
  dobYear,
  onDayChange,
  onMonthChange,
  onYearChange,
  labels,
  disabled,
  idPrefix = 'student-dob',
  selectClassName = 'w-full h-10 rounded-md border border-input bg-background px-3 py-1 text-sm',
}: Props) {
  const currentYear = new Date().getFullYear()
  const yearOptions = Array.from({ length: 100 }, (_, i) => String(currentYear - i))
  const monthOptions = Array.from({ length: 12 }, (_, i) => String(i + 1))
  const selectedYear = Number(dobYear || String(currentYear))
  const selectedMonth = Number(dobMonth || '1')
  const maxDay = daysInMonth(selectedYear, selectedMonth)
  const dayOptions = Array.from({ length: maxDay }, (_, i) => String(i + 1))

  useEffect(() => {
    if (!dobDay || !dobMonth || !dobYear) return
    const max = daysInMonth(Number(dobYear), Number(dobMonth))
    if (Number(dobDay) > max) onDayChange(String(max))
  }, [dobDay, dobMonth, dobYear, onDayChange])

  return (
    <div className="grid grid-cols-3 gap-2">
      <select
        id={`${idPrefix}-day`}
        value={dobDay}
        onChange={(e) => onDayChange(e.target.value)}
        disabled={disabled}
        className={selectClassName}
        aria-label={labels.day}
      >
        <option value="">{labels.day}</option>
        {dayOptions.map((d) => (
          <option key={`d-${d}`} value={d}>
            {d}
          </option>
        ))}
      </select>
      <select
        id={`${idPrefix}-month`}
        value={dobMonth}
        onChange={(e) => onMonthChange(e.target.value)}
        disabled={disabled}
        className={selectClassName}
        aria-label={labels.month}
      >
        <option value="">{labels.month}</option>
        {monthOptions.map((m) => (
          <option key={`m-${m}`} value={m}>
            {m}
          </option>
        ))}
      </select>
      <select
        id={`${idPrefix}-year`}
        value={dobYear}
        onChange={(e) => onYearChange(e.target.value)}
        disabled={disabled}
        className={selectClassName}
        aria-label={labels.year}
      >
        <option value="">{labels.year}</option>
        {yearOptions.map((y) => (
          <option key={`y-${y}`} value={y}>
            {y}
          </option>
        ))}
      </select>
    </div>
  )
}
