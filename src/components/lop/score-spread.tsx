export const SCORE_BANDS = [
  { label: '0–20', color: '#e11d48', text: 'text-rose-600' },
  { label: '21–40', color: '#ea580c', text: 'text-orange-600' },
  { label: '41–60', color: '#ca8a04', text: 'text-amber-600' },
  { label: '61–80', color: '#16a34a', text: 'text-emerald-600' },
  { label: '81–100', color: '#0f766e', text: 'text-teal-700' },
] as const

export function scoreOn100(points: number, total: number): number {
  if (total <= 0) return 0
  return Math.max(0, Math.min(100, Math.round((points / total) * 100)))
}

export function bandOf(score: number): number {
  if (score <= 20) return 0
  if (score <= 40) return 1
  if (score <= 60) return 2
  if (score <= 80) return 3
  return 4
}

export function ScoreSpread({
  grades,
  title,
  scaleLabel,
  bandLabel,
  countLabel,
  shareLabel,
  notDone = 0,
  notDoneLabel = '',
}: {
  grades: number[]
  title: string
  scaleLabel: string
  bandLabel: string
  countLabel: string
  shareLabel: string
  notDone?: number
  notDoneLabel?: string
}) {
  const counts = [0, 0, 0, 0, 0]
  for (const grade of grades) counts[bandOf(grade)] += 1
  const total = grades.length
  const average = total > 0 ? grades.reduce((sum, grade) => sum + grade, 0) / total : 0
  const radius = 28
  const circumference = 2 * Math.PI * radius
  let drawn = 0
  const slices = SCORE_BANDS.map((band, index) => {
    const share = total > 0 ? counts[index] / total : 0
    const length = share * circumference
    const slice = { band, count: counts[index], share, length, offset: drawn }
    drawn += length
    return slice
  })
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5">
      <div className="relative h-[4.5rem] w-[4.5rem] shrink-0">
        <svg viewBox="0 0 72 72" className="h-full w-full" aria-hidden>
          <g transform="rotate(-90 36 36)">
            <circle cx="36" cy="36" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="10" />
            {slices.map((slice) =>
              slice.length > 0 ? (
                <circle
                  key={slice.band.label}
                  cx="36"
                  cy="36"
                  r={radius}
                  fill="none"
                  stroke={slice.band.color}
                  strokeWidth="10"
                  strokeDasharray={slice.share >= 1 ? undefined : `${slice.length} ${circumference - slice.length}`}
                  strokeDashoffset={slice.share >= 1 ? undefined : -slice.offset}
                />
              ) : null
            )}
          </g>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-sm font-semibold tabular-nums leading-none text-slate-900">
            {total > 0 ? Math.round(average) : '—'}
          </span>
          <span className="mt-0.5 text-[9px] leading-none text-slate-500">{scaleLabel}</span>
        </div>
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold text-slate-700">{title}</p>
        <table className="mt-1 border-collapse text-[11px] leading-tight">
          <thead>
            <tr className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
              <th className="pr-3 text-left font-medium">{bandLabel}</th>
              <th className="px-2 text-right font-medium">{countLabel}</th>
              <th className="pl-2 text-right font-medium">{shareLabel}</th>
            </tr>
          </thead>
          <tbody>
            {slices.map((slice) => (
              <tr key={slice.band.label}>
                <td className="pr-3">
                  <span className="inline-flex items-center gap-1.5 tabular-nums text-slate-600">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: slice.band.color }} />
                    {slice.band.label}
                  </span>
                </td>
                <td className="px-2 text-right font-semibold tabular-nums text-slate-900">{slice.count}</td>
                <td className="pl-2 text-right tabular-nums text-slate-500">{total > 0 ? Math.round(slice.share * 100) : 0}%</td>
              </tr>
            ))}
            {notDone > 0 ? (
              <tr>
                <td className="pr-3 pt-1 text-slate-500">{notDoneLabel}</td>
                <td className="px-2 pt-1 text-right font-semibold tabular-nums text-slate-700">{notDone}</td>
                <td className="pl-2 pt-1 text-right text-slate-400">—</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}
