type EmptyKind = 'cart' | 'orders' | 'wallet' | 'notifications' | 'addresses' | 'generic'

type EmptyProps = {
  title: string
  actionHref?: string
  actionLabel?: string
  kind?: EmptyKind
  emptyEl?: string
}

function EmptyMark({ kind }: { kind: EmptyKind }) {
  if (kind === 'orders') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h10M7 11h10M7 15h6" />
        <rect x="4" y="4" width="16" height="16" rx="3" />
      </svg>
    )
  }
  if (kind === 'wallet') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <rect x="3" y="6" width="18" height="13" rx="2.5" />
        <path strokeLinecap="round" d="M3 10h18" />
        <circle cx="16.5" cy="14.5" r="1.2" fill="currentColor" stroke="none" />
      </svg>
    )
  }
  if (kind === 'notifications') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 9a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5H4.5S6 13 6 9Z" />
        <path strokeLinecap="round" d="M10 18a2 2 0 0 0 4 0" />
      </svg>
    )
  }
  if (kind === 'addresses') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s7-5.4 7-11a7 7 0 1 0-14 0c0 5.6 7 11 7 11Z" />
        <circle cx="12" cy="10" r="2.2" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 8h15l-1.6 8.2a2 2 0 0 1-2 1.6H9.2a2 2 0 0 1-2-1.6L5.4 6.4A1.5 1.5 0 0 0 3.9 5H3" />
      <circle cx="9" cy="20" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="18" cy="20" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function PartnerSiteShopEmptyState({
  title,
  actionHref,
  actionLabel,
  kind = 'generic',
  emptyEl,
}: EmptyProps) {
  return (
    <div className="pw-shop-empty" data-pw-el={emptyEl}>
      <span className="pw-shop-empty-mark" aria-hidden>
        <EmptyMark kind={kind} />
      </span>
      <p>{title}</p>
      {actionHref && actionLabel ? (
        <a href={actionHref} className="pw-shop-btn">
          {actionLabel}
        </a>
      ) : null}
    </div>
  )
}

export function PartnerSiteShopSkeleton({
  variant = 'list',
  label,
}: {
  variant?: 'list' | 'orders' | 'cart' | 'account'
  label?: string
}) {
  const cards = variant === 'account' ? 1 : 3
  return (
    <div className="pw-shop-skel-stack" aria-busy="true" aria-live="polite" aria-label={label || undefined}>
      {Array.from({ length: cards }, (_, i) => (
        <div key={i} className="pw-shop-skel-card">
          {variant === 'orders' || variant === 'cart' ? (
            <div className="pw-shop-skel-row">
              <div className="pw-shop-skel pw-shop-skel-thumb" />
              <div className="pw-shop-skel-copy">
                <div className="pw-shop-skel pw-shop-skel-line w-60" />
                <div className="pw-shop-skel pw-shop-skel-line" />
                <div className="pw-shop-skel pw-shop-skel-line w-40" />
              </div>
            </div>
          ) : (
            <>
              <div className="pw-shop-skel pw-shop-skel-line w-40" />
              <div className="pw-shop-skel pw-shop-skel-line" />
              <div className="pw-shop-skel pw-shop-skel-line w-60" />
            </>
          )}
        </div>
      ))}
    </div>
  )
}
