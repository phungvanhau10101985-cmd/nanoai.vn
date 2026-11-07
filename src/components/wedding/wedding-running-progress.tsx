'use client'

/** Thanh tiến trình luôn chuyển động, kể cả khi ảnh đầu chưa xong. */
export function WeddingRunningProgress(props: {
  label: string
  done: number
  total: number
  hint?: string
  indeterminate?: boolean
}) {
  const total = Math.max(0, props.total)
  const done = Math.max(0, Math.min(props.done, total || props.done))
  const indeterminate = props.indeterminate || total <= 0 || done <= 0
  const width = total > 0 ? Math.max(8, Math.round((done / total) * 100)) : 8
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="space-y-2">
      <style>{`@keyframes wedding-job-slide{0%{transform:translateX(-130%)}100%{transform:translateX(280%)}}`}</style>
      <div className="flex items-center justify-between gap-3 text-sm font-semibold text-[#3f2a12]">
        <span className="inline-flex min-w-0 items-center gap-2">
          <span className="inline-block size-2 shrink-0 animate-pulse rounded-full bg-[#c4a15a]" aria-hidden />
          <span className="min-w-0">{props.label}</span>
        </span>
        {total > 0 ? <span className="shrink-0 tabular-nums">{done}/{total}</span> : null}
      </div>
      {indeterminate ? (
        <div className="relative h-2.5 overflow-hidden rounded-full bg-[#eadfce]">
          <div
            className="absolute inset-y-0 w-2/5 rounded-full bg-[#c4a15a]"
            style={{ animation: 'wedding-job-slide 1.15s ease-in-out infinite' }}
          />
        </div>
      ) : (
        <div
          className="h-2.5 overflow-hidden rounded-full bg-[#eadfce]"
          role="progressbar"
          aria-valuenow={done}
          aria-valuemin={0}
          aria-valuemax={total}
        >
          <div className="h-full rounded-full bg-[#c4a15a] transition-[width] duration-300" style={{ width: `${width}%` }}>
            <span className="block h-full w-full animate-pulse bg-white/35" />
          </div>
        </div>
      )}
      {props.hint ? <p className="text-xs leading-5 text-[#6b5344]">{props.hint}</p> : null}
    </div>
  )
}
