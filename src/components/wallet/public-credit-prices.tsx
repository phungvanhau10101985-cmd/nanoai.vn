import Link from 'next/link'
import { CREDIT_UNIT_PRICE_VND } from '@/lib/credit-unit-price'
import { getServerDictionary } from '@/lib/i18n/server'

type LocaleKey = 'vi' | 'en' | 'zh' | 'ja' | 'ko'

function text(locale: string, copy: Record<LocaleKey, string>): string {
  if (locale === 'en' || locale === 'zh' || locale === 'ja' || locale === 'ko') return copy[locale]
  return copy.vi
}

const COPY = {
  title: {
    vi: 'Bảng giá credit',
    en: 'Credit prices',
    zh: '积分价格',
    ja: 'クレジット料金',
    ko: '크레딧 요금',
  },
  lead: {
    vi: 'Giá hiển thị trước khi đăng nhập. 1 credit dùng cho mọi nhóm công cụ.',
    en: 'Prices are visible before you sign in. 1 credit works across every tool group.',
    zh: '登录前即可看到价格。1 积分适用于全部工具。',
    ja: 'ログイン前に料金を確認できます。1 クレジットは全ツール共通です。',
    ko: '로그인 전에 가격을 볼 수 있습니다. 1 크레딧은 모든 도구에 씁니다.',
  },
  unit: {
    vi: '1 credit',
    en: '1 credit',
    zh: '1 积分',
    ja: '1 クレジット',
    ko: '1 크레딧',
  },
  rows: {
    vi: [
      'Tin đầu mỗi hội thoại: miễn phí',
      'Chat sau đó: 0,1 credit / lượt',
      'Thử đồ 1 người: 1 credit',
      'Ảnh NanoAI 2K: 1,5 credit · Ảnh 4K: 3 credit',
      'Giáo trình: 2 bài mới mỗi ngày không trừ credit. Bài thứ ba mới trừ',
    ],
    en: [
      'First message in each chat: free',
      'Later chat turns: 0.1 credit each',
      'Try-on for 1 person: 1 credit',
      'NanoAI 2K image: 1.5 credits · 4K image: 3 credits',
      'Lessons: 2 new lessons each day are free. The third lesson uses credit',
    ],
    zh: [
      '每个对话的第一条消息：免费',
      '之后的对话：每轮 0.1 积分',
      '单人试衣：1 积分',
      'NanoAI 2K 图片：1.5 积分 · 4K 图片：3 积分',
      '教案：每天 2 篇新教案不扣积分，第 3 篇才扣',
    ],
    ja: [
      '各会話の最初のメッセージ：無料',
      'その後のチャット：1 回 0.1 クレジット',
      '1人の試着：1 クレジット',
      'NanoAI 2K 画像：1.5 クレジット · 4K 画像：3 クレジット',
      '教案：1日2本まで無料。3本目からクレジット',
    ],
    ko: [
      '대화의 첫 메시지: 무료',
      '이후 채팅: 회당 0.1 크레딧',
      '1인 피팅: 1 크레딧',
      'NanoAI 2K 이미지: 1.5 크레딧 · 4K 이미지: 3 크레딧',
      '교안: 하루 2개까지 무료. 세 번째부터 크레딧',
    ],
  },
  hours: {
    vi: 'Hỗ trợ: 08:30–17:30, Thứ 2–Thứ 7',
    en: 'Support: 08:30–17:30, Monday–Saturday',
    zh: '支持时间：08:30–17:30，周一至周六',
    ja: 'サポート: 08:30–17:30、月–土',
    ko: '지원: 08:30–17:30, 월–토',
  },
  cta: {
    vi: 'Nạp credit',
    en: 'Add credits',
    zh: '充值积分',
    ja: 'クレジットをチャージ',
    ko: '크레딧 충전',
  },
} as const

export function PublicCreditPrices() {
  const { locale } = getServerDictionary()
  const price = new Intl.NumberFormat(locale === 'vi' ? 'vi-VN' : 'en-US').format(CREDIT_UNIT_PRICE_VND)
  const rows = COPY.rows[locale === 'en' || locale === 'zh' || locale === 'ja' || locale === 'ko' ? locale : 'vi']

  return (
    <section className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:py-14">
      <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">{text(locale, COPY.title)}</h1>
      <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">{text(locale, COPY.lead)}</p>
      <p className="mt-8 text-sm text-muted-foreground">{text(locale, COPY.unit)}</p>
      <p className="text-4xl font-semibold tracking-tight text-foreground">{price}₫</p>
      <ul className="mt-6 space-y-2 text-base leading-7 text-foreground">
        {rows.map((row) => (
          <li key={row} className="rounded-2xl border border-border/70 bg-background px-4 py-3">
            {row}
          </li>
        ))}
      </ul>
      <p className="mt-4 text-sm text-muted-foreground">{text(locale, COPY.hours)}</p>
      <Link
        href="/auth/login?next=%2Fwallet"
        className="mt-6 inline-flex h-11 items-center justify-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground"
      >
        {text(locale, COPY.cta)}
      </Link>
    </section>
  )
}

