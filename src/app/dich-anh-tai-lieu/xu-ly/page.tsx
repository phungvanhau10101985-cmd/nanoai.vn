import { isCatalogShopper } from '@/lib/catalog/catalog-shopper'
import { getUserOrBypass } from '@/lib/auth'
import DichAnhTaiLieuClientPage from '../dich-anh-tai-lieu-client-page'
import { Metadata } from 'next'
import { buildMetadata } from '@/lib/seo'
import { CreationToolPageShell } from '@/components/layout/creation-tool-page-shell'
import { Suspense } from 'react'
import { getCurrentWebLocale } from '@/lib/i18n/server'
import Link from 'next/link'

const toolMeta = buildMetadata({
  title: 'Dịch ảnh tài liệu',
  description: 'Tải ảnh hoặc PDF, chọn ngôn ngữ và mức dịch, rồi tải trang đã dịch.',
  path: '/dich-anh-tai-lieu/xu-ly',
  noIndex: true,
})

export const metadata: Metadata = {
  ...toolMeta,
  title: { absolute: 'Dịch ảnh tài liệu | NanoAI' },
}

export default async function DichAnhTaiLieuToolPage() {
  const locale = getCurrentWebLocale()
  const loadingText =
    locale === 'en'
      ? 'Loading document image translator...'
      : locale === 'zh'
        ? '正在加载文档图片翻译工具...'
        : locale === 'ja'
          ? '文書画像翻訳ツールを読み込み中...'
          : locale === 'ko'
            ? '문서 이미지 번역 도구를 불러오는 중...'
            : 'Đang tải công cụ dịch ảnh tài liệu...'
  const user = await getUserOrBypass()
  if (!isCatalogShopper(user)) {
    const label =
      locale === 'en'
        ? 'Sign in to translate'
        : locale === 'zh'
          ? '登录后翻译'
          : locale === 'ja'
            ? 'ログインして翻訳'
            : locale === 'ko'
              ? '로그인 후 번역'
              : 'Đăng nhập để dịch'
    return (
      <div className="app-shell mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">{label}</h1>
        <Link href="/auth/login?next=%2Fdich-anh-tai-lieu%2Fxu-ly" className="mt-6 inline-flex h-11 items-center rounded-md bg-slate-800 px-5 text-sm font-semibold text-white">
          {label}
        </Link>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <CreationToolPageShell currentHref="/dich-anh-tai-lieu/xu-ly">
        <Suspense fallback={<div className="text-sm text-muted-foreground">{loadingText}</div>}>
          <DichAnhTaiLieuClientPage />
        </Suspense>
      </CreationToolPageShell>
    </div>
  )
}
