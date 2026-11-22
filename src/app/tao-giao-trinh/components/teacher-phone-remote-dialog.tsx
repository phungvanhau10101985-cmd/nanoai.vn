'use client'

import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { X } from 'lucide-react'
import {
  isPhoneRemoteShareMobile,
  phoneRemoteFacebookShareUrl,
  phoneRemoteMessengerAppShareUrl,
  phoneRemoteQrPayload,
  phoneRemoteZaloShareUrl,
} from '@/lib/curriculum/phone-remote-public-origin'

export function TeacherPhoneRemoteDialog({
  open,
  loginUrl,
  error,
  busy,
  onClose,
  tr,
  title,
  lead,
  layerClassName = 'z-[80]',
}: {
  open: boolean
  loginUrl: string | null
  error: string
  busy: boolean
  onClose: () => void
  tr: (vi: string, en: string, zh: string, ja: string, ko: string) => string
  title?: string
  lead?: string
  layerClassName?: string
}) {
  const [qr, setQr] = useState<string | null>(null)
  const payload = loginUrl ? phoneRemoteQrPayload(loginUrl) : null
  useEffect(() => {
    if (!open || !payload) {
      setQr(null)
      return
    }
    let cancel = false
    const toDataURL =
      typeof QRCode.toDataURL === 'function'
        ? QRCode.toDataURL.bind(QRCode)
        : (QRCode as unknown as { default: typeof QRCode }).default.toDataURL.bind(
            (QRCode as unknown as { default: typeof QRCode }).default
          )
    void toDataURL(payload, {
      errorCorrectionLevel: 'M',
      margin: 4,
      width: 480,
      color: { dark: '#000000', light: '#ffffff' },
    }).then((url: string) => {
      if (!cancel) setQr(url)
    }).catch(() => {
      if (!cancel) setQr(null)
    })
    return () => {
      cancel = true
    }
  }, [open, payload])

  if (!open) return null
  const localHost = !!loginUrl && /\/\/(localhost|127\.0\.0\.1)([:/]|$)/i.test(loginUrl)

  return (
    <div className={`fixed inset-0 ${layerClassName} flex items-center justify-center bg-black/70 p-4`} role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-2xl border border-slate-600 bg-slate-900 p-4 text-slate-100 shadow-2xl">
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2 className="text-base font-semibold text-sky-100">
            {title || tr('Điều khiển ĐT', 'Phone remote', '手机操控', 'スマホ操作', '폰 조작')}
          </h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-300 hover:bg-slate-700" aria-label={tr('Đóng', 'Close', '关闭', '閉じる', '닫기')}>
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-sm leading-relaxed text-slate-300">
          {lead || tr(
            'Quét mã bằng điện thoại. Máy đăng nhập đúng tài khoản giáo viên và mở bảng điều khiển. Bấm slide hoặc chạm trên điện thoại thì màn học sinh trên máy này hiện theo.',
            'Scan with the phone. It signs in as this teacher and opens the remote. Slide changes and taps on the phone show on the student screen here.',
            '用手机扫码。手机会以该教师账号登录并打开操控页。手机上的翻页和点击会显示在这台电脑的学生画面上。',
            'スマホで読み取ります。この教師アカウントでログインし、操作画面が開きます。スマホのスライド送りとタップは、この生徒画面に出ます。',
            '휴대폰으로 스캔하세요. 이 교사 계정으로 로그인되고 조작 화면이 열립니다. 휴대폰의 슬라이드 이동과 탭이 이 학생 화면에 나타납니다.'
          )}
        </p>
        <div className="mt-4 flex min-h-[280px] items-center justify-center rounded-xl bg-white p-4">
          {qr && payload ? (
            // eslint-disable-next-line @next/next/no-img-element -- QR data URL tạo trên máy
            <img src={qr} alt={payload} width={320} height={320} className="h-auto w-full max-w-[320px]" />
          ) : (
            <p className="px-4 text-center text-sm text-slate-500">
              {error || (busy
                ? tr('Đang tạo mã...', 'Creating code...', '正在生成二维码...', 'コードを作成中...', '코드 생성 중...')
                : tr('Chưa có mã.', 'No code yet.', '还没有二维码。', '코드がありません。', '아직 코드가 없습니다.'))}
            </p>
          )}
        </div>
        {payload ? (
          <>
            <p className="mt-3 text-xs font-medium text-slate-300">
              {tr(
                'Gửi link sang điện thoại qua Zalo hoặc Facebook Messenger.',
                'Send the link to the phone via Zalo or Facebook Messenger.',
                '通过 Zalo 或 Facebook Messenger 把链接发到手机。',
                'Zalo または Facebook Messenger でリンクをスマホに送ります。',
                'Zalo 또는 Facebook Messenger로 링크를 휴대폰에 보내세요.'
              )}
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <a
                href={phoneRemoteZaloShareUrl(payload)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#0068FF] px-3 text-sm font-semibold text-white hover:bg-[#0057d6]"
                onClick={() => {
                  void navigator.clipboard.writeText(payload).catch(() => {})
                }}
              >
                <ZaloMark />
                {tr('Zalo', 'Zalo', 'Zalo', 'Zalo', 'Zalo')}
              </a>
              <a
                href={phoneRemoteFacebookShareUrl(payload)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#0084FF] px-3 text-sm font-semibold text-white hover:bg-[#006fd6]"
                onClick={(event) => {
                  void navigator.clipboard.writeText(payload).catch(() => {})
                  if (!isPhoneRemoteShareMobile(navigator.userAgent)) return
                  event.preventDefault()
                  window.location.href = phoneRemoteMessengerAppShareUrl(payload)
                }}
              >
                <MessengerMark />
                {tr('Messenger', 'Messenger', 'Messenger', 'Messenger', 'Messenger')}
              </a>
            </div>
            <a href={payload} className="mt-3 block break-all text-xs leading-relaxed text-sky-300 underline" target="_blank" rel="noreferrer">
              {payload}
            </a>
          </>
        ) : null}
        {localHost ? (
          <p className="mt-3 text-xs leading-relaxed text-amber-200">
            {tr(
              'Điện thoại phải mở được đúng địa chỉ trang này. localhost trên điện thoại không trỏ tới máy giáo viên.',
              'The phone must open this exact site address. localhost on the phone is not this computer.',
              '手机必须能打开这个网址。手机上的 localhost 不是这台电脑。',
              'スマホからこのアドレスを開ける必要があります。スマホの localhost はこのパソコンではありません。',
              '휴대폰에서 이 주소가 열려야 합니다. 휴대폰의 localhost는 이 컴퓨터가 아닙니다.'
            )}
          </p>
        ) : null}
      </div>
    </div>
  )
}

function ZaloMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" aria-hidden>
      <path fill="currentColor" d="M6.4 6.2h11.2v2.2L10.7 15.4h7v2.4H6.4v-2.2l6.9-7H6.4z" />
    </svg>
  )
}

function MessengerMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" aria-hidden>
      <path
        fill="currentColor"
        d="M12 3.2c-4.8 0-8.6 3.5-8.6 7.8 0 2.4 1.2 4.6 3.2 6.1v3.1l3-1.6c.8.2 1.6.3 2.4.3 4.8 0 8.6-3.5 8.6-7.8S16.8 3.2 12 3.2zm.9 10.5-2.2-2.3-4.2 2.3 4.6-4.9 2.3 2.3 4.1-2.3-4.6 4.9z"
      />
    </svg>
  )
}
