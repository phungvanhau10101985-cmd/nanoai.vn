'use client'
/* eslint-disable @next/next/no-img-element -- bank app icons are external VietQR CDN urls */

import { useEffect, useMemo, useState } from 'react'
import { Smartphone } from 'lucide-react'
import type { WebLocale } from '@/lib/i18n/config'
import { readWebLocaleFromDocumentCookie } from '@/lib/i18n/read-web-locale-cookie'
import {
  QR_PAY_OPEN_APPS,
  buildVietQrAppPayUrl,
  detectQrPayPlatform,
  resolveQrPayTransfer,
  vietQrBankAppIconUrl,
  type QrPayPlatform,
} from '@/lib/sepay-qr'

const PREVIEW_COUNT = 6

type Copy = {
  openBank: string
  foundQr: string
  openApp: string
  open: string
  more: string
  less: string
}

const COPY: Record<WebLocale, Copy> = {
  vi: {
    openBank: 'Mở ngân hàng',
    foundQr: 'Đã tìm thấy mã QR – Chọn phương thức thanh toán',
    openApp: 'Mở ứng dụng',
    open: 'Mở',
    more: 'Xem thêm ngân hàng',
    less: 'Thu gọn',
  },
  en: {
    openBank: 'Open a bank app',
    foundQr: 'QR found — choose how to pay',
    openApp: 'Open an app',
    open: 'Open',
    more: 'More banks',
    less: 'Show less',
  },
  zh: {
    openBank: '打开银行应用',
    foundQr: '已找到二维码 — 选择支付方式',
    openApp: '打开应用',
    open: '打开',
    more: '更多银行',
    less: '收起',
  },
  ja: {
    openBank: '銀行アプリを開く',
    foundQr: 'QRを検出 — 支払い方法を選択',
    openApp: 'アプリを開く',
    open: '開く',
    more: '他の銀行',
    less: '閉じる',
  },
  ko: {
    openBank: '은행 앱 열기',
    foundQr: 'QR을 찾았습니다 — 결제 수단 선택',
    openApp: '앱 열기',
    open: '열기',
    more: '은행 더 보기',
    less: '접기',
  },
}

export type QrPayOpenBankProps = {
  qrUrl?: string | null
  accountNumber?: string | null
  bankCode?: string | null
  amount?: number | null
  description?: string | null
  accountName?: string | null
  locale?: WebLocale | null
  className?: string
}

/**
 * Nút + danh sách app ngân hàng. Bấm «Mở» mở app và điền sẵn STK, số tiền, nội dung CK.
 * Ẩn khi QR không phải chuyển khoản VietQR/SePay (ví dụ QR ví điện tử tĩnh).
 */
export function QrPayOpenBank({
  qrUrl,
  accountNumber,
  bankCode,
  amount,
  description,
  accountName,
  locale,
  className,
}: QrPayOpenBankProps) {
  const [listOpen, setListOpen] = useState(true)
  const [showAll, setShowAll] = useState(false)
  const [platform, setPlatform] = useState<QrPayPlatform>('other')
  const [cookieLocale, setCookieLocale] = useState<WebLocale>('vi')
  useEffect(() => {
    setPlatform(detectQrPayPlatform(navigator.userAgent))
    if (locale) return
    setCookieLocale(readWebLocaleFromDocumentCookie())
  }, [locale])
  const copy = COPY[locale || cookieLocale] || COPY.vi
  const transfer = useMemo(
    () =>
      resolveQrPayTransfer({
        qrUrl,
        accountNumber,
        bankCode,
        amount,
        description,
        accountName,
      }),
    [qrUrl, accountNumber, bankCode, amount, description, accountName],
  )
  if (!transfer) return null
  const apps = showAll ? QR_PAY_OPEN_APPS : QR_PAY_OPEN_APPS.slice(0, PREVIEW_COUNT)

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setListOpen((open) => !open)}
        aria-expanded={listOpen}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
      >
        <Smartphone className="h-4 w-4" aria-hidden />
        {copy.openBank}
      </button>
      {listOpen ? (
        <div className="mt-3 rounded-2xl border border-neutral-200 bg-white p-3 text-neutral-950 shadow-sm">
          <p className="text-sm font-semibold leading-snug">{copy.foundQr}</p>
          <p className="mt-3 text-xs font-medium text-neutral-500">{copy.openApp}</p>
          <ul className="mt-1">
            {apps.map((app) => {
              const href = buildVietQrAppPayUrl(app.appId, transfer, platform)
              if (!href) return null
              return (
                <li key={app.appId} className="flex items-center gap-3 border-b border-neutral-100 py-2 last:border-b-0">
                  <img
                    src={vietQrBankAppIconUrl(app.iconId || app.appId)}
                    alt=""
                    width={36}
                    height={36}
                    className="h-9 w-9 shrink-0 rounded-full bg-neutral-100 object-cover"
                  />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{app.name}</span>
                  <a
                    href={href}
                    className="inline-flex h-8 min-w-14 items-center justify-center rounded-lg bg-neutral-100 px-3 text-sm font-medium text-neutral-900 hover:bg-neutral-200"
                  >
                    {copy.open}
                  </a>
                </li>
              )
            })}
          </ul>
          {QR_PAY_OPEN_APPS.length > PREVIEW_COUNT ? (
            <button
              type="button"
              className="mt-2 w-full text-center text-xs font-medium text-emerald-700"
              onClick={() => setShowAll((value) => !value)}
            >
              {showAll ? copy.less : copy.more}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
