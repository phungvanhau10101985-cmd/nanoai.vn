import Link from 'next/link'
import { FeatureCatalogPriceLine } from '@/components/catalog/feature-catalog-price-line'
import { catalogOfferForPath } from '@/lib/catalog/nanoai-facebook-catalog'
import { getServerDictionary } from '@/lib/i18n/server'

type Props = {
  path: string
  title?: string
  overview?: string
  withSchema?: boolean
}

/** Trang bán công khai: cùng HTML cho khách chưa đăng nhập và Googlebot. */
export function FeatureCatalogPublicOffer({ path, title, overview, withSchema = true }: Props) {
  const { t } = getServerDictionary()
  const offer = catalogOfferForPath(path)
  const heading = title || offer?.title || ''
  const body = overview || offer?.description || ''
  const nextPath = offer?.linkPath || (path.startsWith('/') ? path : `/${path}`)
  const loginHref = `/auth/login?next=${encodeURIComponent(nextPath)}`

  return (
    <section className="mx-auto max-w-4xl px-4 py-10 lg:max-w-5xl lg:py-14">
      <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{heading}</h1>
      {body ? <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">{body}</p> : null}
      <FeatureCatalogPriceLine path={path} title={heading} description={body} withSchema={withSchema} />
      <Link
        href={loginHref}
        className="mt-6 inline-flex h-11 items-center justify-center rounded-md bg-primary px-6 text-sm font-semibold text-primary-foreground"
      >
        {t.featureCatalogOffer.cta}
      </Link>
    </section>
  )
}
