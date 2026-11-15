'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Images } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { deleteGuestCreations, listGuestCreations, type GuestCreationRecord } from '@/lib/guest-creations/browser-store'
import { isGuestCreationAudioUrl, isGuestCreationImageUrl } from '@/lib/guest-creations/extract-guest-creation'
import { readWebLocaleFromDocumentCookie } from '@/lib/i18n/read-web-locale-cookie'
import type { WebLocale } from '@/lib/i18n/config'

const COPY: Record<WebLocale, {
  title: string
  body: string
  emptyTitle: string
  emptyBody: string
  signIn: string
  remove: string
  open: string
  audio: string
}> = {
  vi: {
    title: 'Bản tạo trên trình duyệt này',
    body: 'Khi chưa đăng nhập, ảnh và bản tạo được giữ trên trình duyệt. Sau khi đăng nhập, chúng được chuyển vào tài khoản.',
    emptyTitle: 'Chưa có bản tạo nào',
    emptyBody: 'Ảnh và bản tạo lúc chưa đăng nhập sẽ hiện ở đây, rồi chuyển vào tài khoản sau khi đăng nhập.',
    signIn: 'Đăng nhập để lưu vào tài khoản',
    remove: 'Xóa khỏi trình duyệt',
    open: 'Mở',
    audio: 'Âm thanh',
  },
  en: {
    title: 'Creations saved in this browser',
    body: 'While you are signed out, images and creations stay in this browser. After you sign in, they move to your account.',
    emptyTitle: 'Nothing saved yet',
    emptyBody: 'Images and creations made before sign-in show up here, then move to your account after you sign in.',
    signIn: 'Sign in to save to your account',
    remove: 'Remove from this browser',
    open: 'Open',
    audio: 'Audio',
  },
  zh: {
    title: '保存在此浏览器中的创作',
    body: '未登录时，图片和创作保存在此浏览器。登录后会转入你的账户。',
    emptyTitle: '还没有创作',
    emptyBody: '未登录时生成的图片和创作会显示在这里，登录后转入账户。',
    signIn: '登录并保存到账户',
    remove: '从浏览器中删除',
    open: '打开',
    audio: '音频',
  },
  ja: {
    title: 'このブラウザに保存した作品',
    body: 'ログイン前の画像と作品はこのブラウザに残ります。ログイン後、アカウントへ移します。',
    emptyTitle: 'まだ作品がありません',
    emptyBody: 'ログイン前に作った画像と作品はここに表示され、ログイン後にアカウントへ移ります。',
    signIn: 'ログインしてアカウントに保存',
    remove: 'ブラウザから削除',
    open: '開く',
    audio: '音声',
  },
  ko: {
    title: '이 브라우저에 저장된 작업',
    body: '로그인 전에는 이미지와 작업이 이 브라우저에 남습니다. 로그인하면 계정으로 옮깁니다.',
    emptyTitle: '아직 작업이 없습니다',
    emptyBody: '로그인 전에 만든 이미지와 작업이 여기에 보이고, 로그인 후 계정으로 옮겨집니다.',
    signIn: '로그인해서 계정에 저장',
    remove: '브라우저에서 삭제',
    open: '열기',
    audio: '오디오',
  },
}

export function GuestCreationLibrary() {
  const [locale, setLocale] = useState<WebLocale>('vi')
  const [items, setItems] = useState<GuestCreationRecord[] | null>(null)
  const copy = COPY[locale]

  useEffect(() => {
    setLocale(readWebLocaleFromDocumentCookie() || 'vi')
    let live = true
    const load = () => {
      void listGuestCreations()
        .then((rows) => {
          if (live) setItems(rows)
        })
        .catch(() => {
          if (live) setItems([])
        })
    }
    load()
    window.addEventListener('guest-creations-updated', load)
    return () => {
      live = false
      window.removeEventListener('guest-creations-updated', load)
    }
  }, [])

  async function remove(id: string) {
    await deleteGuestCreations([id]).catch(() => undefined)
    setItems((prev) => (prev || []).filter((row) => row.id !== id))
  }

  return (
    <div className="app-shell space-y-6">
      <div className="section-surface space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">{copy.title}</h1>
        <p className="text-muted-foreground">{copy.body}</p>
        <Button asChild>
          <Link href="/auth/login?next=%2Fdashboard%2Fhistory">{copy.signIn}</Link>
        </Button>
      </div>
      {items == null ? null : items.length === 0 ? (
        <div className="section-surface text-center py-12 border-2 border-dashed rounded-lg">
          <Images className="mx-auto mb-3 h-10 w-10 text-muted-foreground" aria-hidden />
          <h2 className="text-lg font-medium">{copy.emptyTitle}</h2>
          <p className="text-muted-foreground mt-1">{copy.emptyBody}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {items.map((item) => {
            const preview = item.resultUrls.find(isGuestCreationImageUrl) || item.resultUrls[0] || ''
            const audio = isGuestCreationAudioUrl(preview)
            return (
              <article key={item.id} className="tool-tile overflow-hidden flex flex-col rounded-lg border bg-card">
                <div className="p-4 space-y-3">
                  <h2 className="font-semibold leading-tight">{item.route || item.feature}</h2>
                  {preview && !audio ? (
                    // CDN kết quả không đi qua next/image.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={preview} alt="" className="aspect-[4/3] w-full rounded-md border object-contain bg-muted" />
                  ) : null}
                  {preview && audio ? (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">{copy.audio}</p>
                      <audio controls src={preview} className="w-full" preload="none" />
                    </div>
                  ) : null}
                  {!preview ? <p className="text-sm text-muted-foreground">{item.feature}</p> : null}
                  <div className="flex gap-2">
                    {item.route ? (
                      <Button variant="outline" size="sm" className="flex-1" asChild>
                        <Link href={item.route}>{copy.open}</Link>
                      </Button>
                    ) : null}
                    <Button variant="outline" size="sm" onClick={() => void remove(item.id)}>
                      {copy.remove}
                    </Button>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
