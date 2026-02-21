import type { Metadata } from 'next'

const SITE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://nanoai.vn'
const SITE_NAME = 'NanoAI'
const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.png`

/** 10 điểm chuẩn SEO */
export interface PageSEOConfig {
  /** 1. Title - 50-60 ký tự, unique */
  title: string
  /** 2. Meta description - 150-160 ký tự */
  description: string
  /** 3. Canonical path */
  path: string
  /** 4. Keywords */
  keywords?: string[]
  /** 5. noIndex - trang nội bộ (dashboard, admin, auth) */
  noIndex?: boolean
  /** 6. OG image tùy chỉnh */
  ogImage?: string
  /** 7. Locale - mặc định vi_VN */
  locale?: string
  /** 8. Type - website hoặc article */
  type?: 'website' | 'article'
}

export function buildMetadata(config: PageSEOConfig): Metadata {
  const {
    title,
    description,
    path,
    keywords = [],
    noIndex = false,
    ogImage = DEFAULT_OG_IMAGE,
    locale = 'vi_VN',
    type = 'website',
  } = config

  const url = `${SITE_URL}${path}`
  const fullTitle = `${title} | ${SITE_NAME}`
  const keywordsStr = keywords.length > 0 ? keywords.join(', ') : undefined

  return {
    title: fullTitle,
    description,
    keywords: keywordsStr,
    authors: [{ name: SITE_NAME, url: SITE_URL }],
    creator: SITE_NAME,
    publisher: SITE_NAME,
    metadataBase: new URL(SITE_URL),
    alternates: {
      canonical: url,
    },
    robots: noIndex
      ? { index: false, follow: false }
      : { index: true, follow: true, googleBot: { index: true, follow: true } },
    openGraph: {
      type,
      locale,
      url,
      siteName: SITE_NAME,
      title: fullTitle,
      description,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
      images: [ogImage],
    },
  }
}

export function buildJsonLdWebApplication(name: string, description: string, url: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name,
    description,
    url,
    applicationCategory: 'MultimediaApplication',
    operatingSystem: 'Web',
  }
}

export function buildJsonLdService(name: string, description: string, url: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name,
    description,
    url,
    provider: {
      '@type': 'Organization',
      name: SITE_NAME,
    },
  }
}

/** JSON-LD Organization - dùng ở layout gốc */
export function buildJsonLdOrganization() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: SITE_URL,
  }
}

export { SITE_URL, SITE_NAME }
