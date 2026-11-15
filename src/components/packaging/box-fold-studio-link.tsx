'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import type { WebLocale } from '@/lib/i18n/config'

const FOLD_STUDIO_STEPS = new Set([
  'box_net_2d',
  'box_mockup_3d',
  'box_dieline_pdf',
  'product_label',
  'seal_sticker',
  'barcode_label',
])

const COPY: Record<WebLocale, { title: string; hint: string; open: string }> = {
  vi: {
    title: 'Chọn kiểu gấp hộp',
    hint: 'Mở trang dàn tờ trải và mockup 3D. Chọn kiểu nào thì tờ trải đổi theo kiểu đó. Sửa lại được cả sau các bước sau.',
    open: 'Mở trang dàn hộp',
  },
  en: {
    title: 'Choose the box fold',
    hint: 'Open the net page and the 3D mockup. Picking a fold relayouts the net. You can edit it again after later steps.',
    open: 'Open the box layout',
  },
  zh: {
    title: '选择盒型',
    hint: '打开展开页和 3D 样机。选中盒型后展开图立即重排。之后的步骤仍可回来修改。',
    open: '打开盒型展开',
  },
  ja: {
    title: '折り方を選ぶ',
    hint: '展開ページと3Dを開きます。折り方を選ぶと展開が変わります。後の工程から戻って直せます。',
    open: '展開ページを開く',
  },
  ko: {
    title: '접기 방식 선택',
    hint: '전개 페이지와 3D를 엽니다. 방식을 고르면 전개가 바뀝니다. 이후 단계에서도 다시 고칠 수 있습니다.',
    open: '전개 페이지 열기',
  },
}

export function boxFoldStudioPath(threadId: string): string {
  return `/thiet-ke-hop/${encodeURIComponent(threadId)}`
}

export function packagingFoldStudioStep(stepKey: string | null | undefined): boolean {
  return Boolean(stepKey && FOLD_STUDIO_STEPS.has(stepKey))
}

export function BoxFoldStudioLink({ locale, threadId }: { locale: WebLocale; threadId: string }) {
  const t = COPY[locale]
  return (
    <div className="mb-2 rounded-md border border-emerald-200 bg-emerald-50/80 px-3 py-3 text-xs text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-50">
      <p className="text-sm font-semibold">{t.title}</p>
      <p className="mt-1 text-emerald-900/80 dark:text-emerald-100/80">{t.hint}</p>
      <Button asChild size="sm" className="mt-2 h-8 bg-emerald-700 text-white hover:bg-emerald-800">
        <Link href={boxFoldStudioPath(threadId)}>{t.open}</Link>
      </Button>
    </div>
  )
}
