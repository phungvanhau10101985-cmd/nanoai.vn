'use client'

import Link from 'next/link'
import { getDictionary } from '@/lib/i18n/dictionaries'
import type { WebLocale } from '@/lib/i18n/config'
import { presetTitle } from '@/lib/hub-chat/hub-studio-presets'

type LocaleKey = 'vi' | 'en' | 'zh' | 'ja' | 'ko'

function text(locale: string, copy: Record<LocaleKey, string>): string {
  if (locale === 'en' || locale === 'zh' || locale === 'ja' || locale === 'ko') return copy[locale]
  return copy.vi
}

const EMPTY_COPY = {
  lead: {
    vi: 'Thiết kế, thử đồ, chỉnh ảnh hoặc soạn giáo trình — mô tả bằng lời, hoặc chọn một gợi ý.',
    en: 'Design, try on clothes, edit a photo, or draft a lesson — describe it, or pick a suggestion.',
    zh: '设计、试衣、修图或编写教案 — 直接描述，或选一个建议。',
    ja: 'デザイン、試着、写真編集、教案づくり。文章で伝えるか、提案を選んでください。',
    ko: '디자인, 피팅, 사진 편집, 교안 작성. 말로 설명하거나 제안을 고르세요.',
  },
  helloBefore: {
    vi: 'Hôm nay bạn muốn',
    en: 'What do you want to do',
    zh: '今天你想',
    ja: '今日は何を',
    ko: '오늘은 무엇을',
  },
  helloAfter: {
    vi: 'làm gì cùng NanoAI?',
    en: 'with NanoAI today?',
    zh: '和 NanoAI 一起做？',
    ja: 'NanoAI と一緒にしますか？',
    ko: 'NanoAI와 함께할까요?',
  },
  helloEm: {
    vi: 'cùng NanoAI',
    en: 'with NanoAI',
    zh: '和 NanoAI',
    ja: 'NanoAI と',
    ko: 'NanoAI와',
  },
  frequent: {
    vi: 'Thường dùng',
    en: 'Often used',
    zh: '常用',
    ja: 'よく使う',
    ko: '자주 사용',
  },
  allTools: {
    vi: 'Tất cả công cụ',
    en: 'All tools',
    zh: '全部工具',
    ja: 'すべてのツール',
    ko: '모든 도구',
  },
  openTools: {
    vi: 'Mở công cụ',
    en: 'Open tools',
    zh: '打开工具',
    ja: 'ツールを開く',
    ko: '도구 열기',
  },
  send: {
    vi: 'Gửi',
    en: 'Send',
    zh: '发送',
    ja: '送信',
    ko: '보내기',
  },
  enterHint: {
    vi: 'Enter để gửi',
    en: 'Enter to send',
    zh: '按 Enter 发送',
    ja: 'Enter で送信',
    ko: 'Enter로 보내기',
  },
} as const

const SUGGESTIONS: Array<{
  key: string
  title: Record<LocaleKey, string>
  desc: Record<LocaleKey, string>
}> = [
  {
    key: 'tool:/thu-do-online',
    title: {
      vi: 'Thử đồ 1 người',
      en: 'Try on for 1 person',
      zh: '单人试衣',
      ja: '1人の試着',
      ko: '1인 피팅',
    },
    desc: {
      vi: 'Tải ảnh của bạn và ảnh sản phẩm',
      en: 'Upload your photo and the product photo',
      zh: '上传你的照片和商品图',
      ja: '自分の写真と商品写真をアップロード',
      ko: '본인 사진과 상품 사진을 올리세요',
    },
  },
  {
    key: 'tool:/thiet-ke-logo',
    title: {
      vi: 'Tạo logo thương hiệu',
      en: 'Create a brand logo',
      zh: '做品牌标志',
      ja: 'ブランドロゴを作る',
      ko: '브랜드 로고 만들기',
    },
    desc: {
      vi: '1,5 credit · khoảng 15–45 giây',
      en: '1.5 credits · about 15–45 seconds',
      zh: '1.5 积分 · 大约 15–45 秒',
      ja: '1.5 クレジット · およそ 15–45 秒',
      ko: '1.5 크레딧 · 약 15–45초',
    },
  },
  {
    key: 'tool:/tao-giao-trinh',
    title: {
      vi: 'Soạn giáo trình',
      en: 'Draft a lesson',
      zh: '编写教案',
      ja: '教案を作る',
      ko: '교안 만들기',
    },
    desc: {
      vi: 'Hai màn giáo viên / học sinh, slide theo tiết',
      en: 'Teacher and student views, slides by period',
      zh: '教师/学生两个界面，按课时出幻灯片',
      ja: '教員と生徒の2画面、時限ごとのスライド',
      ko: '교사/학생 두 화면, 차시별 슬라이드',
    },
  },
  {
    key: 'tool:/xoa-nen-png',
    title: {
      vi: 'Xóa nền hoặc làm nét ảnh',
      en: 'Remove a background or sharpen a photo',
      zh: '去背景或让照片更清晰',
      ja: '背景を消す、または写真を鮮明に',
      ko: '배경 제거 또는 사진 선명화',
    },
    desc: {
      vi: 'Tải ảnh lên, mô tả phần cần sửa',
      en: 'Upload a photo and describe the edit',
      zh: '上传照片，说明要改的部分',
      ja: '写真を上げて、直したいところを書く',
      ko: '사진을 올리고 고칠 부분을 적으세요',
    },
  },
]

export function homeChatUiText(locale: string, key: keyof typeof EMPTY_COPY): string {
  return text(locale, EMPTY_COPY[key])
}

function EmptyHeading({ locale }: { locale: string }) {
  if (locale === 'en') {
    return (
      <>
        What do you want
        <br />
        to do <span className="text-primary">with NanoAI</span>?
      </>
    )
  }
  if (locale === 'zh') {
    return (
      <>
        今天你想
        <br />
        和 <span className="text-primary">NanoAI</span> 一起做什么？
      </>
    )
  }
  if (locale === 'ja') {
    return (
      <>
        今日は何を
        <br />
        <span className="text-primary">NanoAI</span> と一緒にしますか？
      </>
    )
  }
  if (locale === 'ko') {
    return (
      <>
        오늘은 무엇을
        <br />
        <span className="text-primary">NanoAI</span>와 함께할까요?
      </>
    )
  }
  return (
    <>
      Hôm nay bạn muốn
      <br />
      làm gì <span className="text-primary">cùng NanoAI</span>?
    </>
  )
}

export function HomeChatEmpty({
  locale,
  disabled,
  onPick,
}: {
  locale: WebLocale
  disabled?: boolean
  onPick: (featureKey: string) => void
}) {
  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-1 flex-col justify-center px-4 py-8 sm:px-0 sm:py-10">
      <h1 className="text-2xl font-semibold leading-tight tracking-tight text-slate-900 dark:text-slate-50 sm:text-[32px]">
        <EmptyHeading locale={locale} />
      </h1>
      <p className="mt-2.5 max-w-[34em] text-base text-muted-foreground">{text(locale, EMPTY_COPY.lead)}</p>
      <div className="mt-7 grid grid-cols-2 gap-2.5">
        {SUGGESTIONS.map((item) => (
          <button
            key={item.key}
            type="button"
            disabled={disabled}
            onClick={() => onPick(item.key)}
            className="rounded-2xl border border-border/70 bg-background p-3.5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md disabled:opacity-50 sm:p-4"
          >
            <span className="block text-sm font-semibold">{text(locale, item.title)}</span>
            <span className="mt-0.5 block text-sm text-muted-foreground">{text(locale, item.desc)}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

const DESIGN_PRESETS = ['mobile_shop', 'packaging_kit', 'bag_kit', 'food_menu'] as const
const FREQUENT_TOOLS: Array<{ key: string; labelKey: 'try_on' | 'design_logo' | 'create_banner' | 'remove_bg_png' | 'create_curriculum' }> = [
  { key: 'tool:/thu-do-online', labelKey: 'try_on' },
  { key: 'tool:/thiet-ke-logo', labelKey: 'design_logo' },
  { key: 'tool:/tao-banner', labelKey: 'create_banner' },
  { key: 'tool:/xoa-nen-png', labelKey: 'remove_bg_png' },
  { key: 'tool:/tao-giao-trinh', labelKey: 'create_curriculum' },
]

export function HomeChatToolsPopover({
  locale,
  disabled,
  onPick,
}: {
  locale: WebLocale
  disabled?: boolean
  onPick: (featureKey: string) => void
}) {
  const t = getDictionary(locale)
  return (
    <div
      className="mb-2.5 rounded-[18px] border border-border/70 bg-background p-3 shadow-[0_8px_28px_rgba(15,23,42,0.06)]"
      aria-label={homeChatUiText(locale, 'openTools')}
    >
      <h2 className="mb-2 px-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
        {t.hubChat.featureGroupStudioInline}
      </h2>
      <div className="flex flex-wrap gap-2">
        {DESIGN_PRESETS.map((presetId) => (
          <button
            key={presetId}
            type="button"
            disabled={disabled}
            onClick={() => onPick(`studio:${presetId}`)}
            className="inline-flex h-9 items-center rounded-full bg-violet-50 px-3 text-sm font-semibold text-violet-800 disabled:opacity-50 dark:bg-violet-950/40 dark:text-violet-100"
          >
            {presetTitle(locale, presetId)}
          </button>
        ))}
      </div>
      <h2 className="mb-2 mt-3 px-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
        {text(locale, EMPTY_COPY.frequent)}
      </h2>
      <div className="flex flex-wrap gap-2">
        {FREQUENT_TOOLS.map((tool) => (
          <button
            key={tool.key}
            type="button"
            disabled={disabled}
            onClick={() => onPick(tool.key)}
            className="inline-flex h-9 items-center rounded-full bg-violet-50 px-3 text-sm font-semibold text-violet-800 disabled:opacity-50 dark:bg-violet-950/40 dark:text-violet-100"
          >
            {t.tool[tool.labelKey]}
          </button>
        ))}
        <Link
          href="/#cong-cu"
          className="inline-flex h-9 items-center rounded-full bg-violet-50 px-3 text-sm font-semibold text-violet-800 dark:bg-violet-950/40 dark:text-violet-100"
        >
          {text(locale, EMPTY_COPY.allTools)}
        </Link>
      </div>
    </div>
  )
}
