export default function PartnerSiteAccountChromeLoading() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8" role="status" aria-busy="true">
      <div className="h-8 w-48 max-w-full animate-pulse rounded bg-[var(--pw-surface)]" />
      <div className="mt-6 h-40 animate-pulse rounded bg-[var(--pw-surface)]" />
      <div className="mt-4 h-24 animate-pulse rounded bg-[var(--pw-surface)]" />
    </div>
  )
}
