/** Nền có màu cho chỗ bấm ở danh sách lớp và trong lớp. Nền trắng trùng trang nên không thấy chỗ bấm. */
export const classTapTone = {
  violet:
    'border-violet-300 bg-violet-50 hover:bg-violet-100 dark:border-violet-400/45 dark:bg-violet-950/45 dark:hover:bg-violet-950/70',
  sky: 'border-sky-300 bg-sky-50 hover:bg-sky-100 dark:border-sky-400/45 dark:bg-sky-950/45 dark:hover:bg-sky-950/70',
  indigo:
    'border-indigo-300 bg-indigo-50 hover:bg-indigo-100 dark:border-indigo-400/45 dark:bg-indigo-950/45 dark:hover:bg-indigo-950/70',
  teal: 'border-teal-300 bg-teal-50 hover:bg-teal-100 dark:border-teal-400/45 dark:bg-teal-950/45 dark:hover:bg-teal-950/70',
  emerald:
    'border-emerald-300 bg-emerald-50 hover:bg-emerald-100 dark:border-emerald-400/45 dark:bg-emerald-950/45 dark:hover:bg-emerald-950/70',
  amber:
    'border-amber-300 bg-amber-50 hover:bg-amber-100 dark:border-amber-400/45 dark:bg-amber-950/40 dark:hover:bg-amber-950/70',
  rose: 'border-rose-300 bg-rose-50 hover:bg-rose-100 dark:border-rose-400/45 dark:bg-rose-950/40 dark:hover:bg-rose-950/70',
} as const

export type ClassTapTone = keyof typeof classTapTone

export const classTapCard =
  'flex flex-col gap-2 overflow-hidden rounded-2xl border p-4 shadow-sm ring-1 ring-black/[0.04] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:ring-white/[0.06]'

export const classTapRow =
  'flex items-center justify-between gap-2 rounded-lg border px-3 py-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
