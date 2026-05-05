'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { Heart, Loader2, MapPin, Music, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Toaster } from '@/components/ui/toaster'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import type { WeddingCard, WeddingWish } from '@/lib/db/wedding-cards-pg'
import { submitWeddingGuestResponse } from './actions'
import { WeddingAlbumLightbox } from './wedding-album-lightbox'
import { WeddingInvitationAudio, type WeddingInvitationAudioHandle } from '@/components/wedding/wedding-invitation-audio'
import { WeddingMusicFabVisual } from '@/components/wedding/wedding-music-fab-visual'
import { WeddingMapEmbed } from '@/components/wedding/wedding-map-embed'
import { WeddingEventCalendarBlock } from '@/components/wedding/wedding-event-calendar-block'
import { WeddingGiftEnvelopeBlock } from '@/components/wedding/wedding-gift-envelope-block'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { readWebLocaleFromDocumentCookie } from '@/lib/i18n/read-web-locale-cookie'
import { shouldShowPublicGiftBox } from '@/lib/wedding/wedding-gift-vietqr'

export default function WeddingPublicClient({ card, wishes }: { card: WeddingCard; wishes: WeddingWish[] }) {
  const { toast } = useToast()
  const uiLocale = readWebLocaleFromDocumentCookie()
  const txMusic = useMemo(() => getDictionary(uiLocale).weddingCardAiMusic, [uiLocale])
  const txCal = useMemo(() => getDictionary(uiLocale).weddingCardCalendar, [uiLocale])
  const txGift = useMemo(() => getDictionary(uiLocale).weddingGiftBox, [uiLocale])
  const [musicLoadFailed, setMusicLoadFailed] = useState(false)
  const [musicFabPlaying, setMusicFabPlaying] = useState(false)
  const [guestName, setGuestName] = useState('')
  const [attending, setAttending] = useState(true)
  const [guestCount, setGuestCount] = useState('1')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [opened, setOpened] = useState(false)
  const [albumOpen, setAlbumOpen] = useState(false)
  const [activeAlbumIndex, setActiveAlbumIndex] = useState<number | null>(null)
  const weddingMusicAudioRef = useRef<WeddingInvitationAudioHandle>(null)
  const reportMusicPlaying = useCallback((playing: boolean) => {
    setMusicFabPlaying(playing)
  }, [])
  useEffect(() => {
    setMusicLoadFailed(false)
    setMusicFabPlaying(false)
  }, [card.musicUrl])

  const guestDisplayName = useMemo(() => {
    if (typeof window === 'undefined') return card.guestName
    const fromUrl = new URLSearchParams(window.location.search).get('guest')
    return fromUrl?.trim() || card.guestName
  }, [card.guestName])

  const submit = async () => {
    setSubmitting(true)
    const formData = new FormData()
    formData.append('guestName', guestName)
    formData.append('attending', String(attending))
    formData.append('guestCount', guestCount)
    formData.append('message', message)
    const result = await submitWeddingGuestResponse(card.slug, formData)
    setSubmitting(false)
    if ('error' in result) {
      toast({ title: 'Chưa gửi được', description: result.error, variant: 'destructive' })
      return
    }
    toast({ title: 'Cảm ơn bạn!', description: 'Phản hồi đã được ghi nhận.' })
    setGuestName('')
    setMessage('')
  }

  return (
    <>
      <Toaster />
      <main className="min-h-screen bg-rose-50">
        {!opened && (
          <section
            className="fixed inset-0 z-50 flex items-center justify-center bg-cover bg-center px-4"
            style={{
              backgroundImage: card.masterImageUrl
                ? `linear-gradient(to bottom, rgba(255,255,255,.15), rgba(255,244,244,.75)), url(${card.masterImageUrl})`
                : 'linear-gradient(135deg, #fff7ed, #fff1f2, #fef3c7)',
            }}
          >
            <div className="w-full max-w-md rounded-[2rem] bg-white/80 p-8 text-center shadow-2xl backdrop-blur">
              <p className="text-xs uppercase tracking-[0.35em] text-rose-700">Thiệp mời / Invitation</p>
              <h1 className="mt-6 font-serif text-5xl italic text-slate-950">
                {card.groomName} & {card.brideName}
              </h1>
              <div className="my-6 text-3xl text-rose-500">❦</div>
              <p className="text-sm text-slate-700">{card.weddingDate || 'Ngày cưới'}</p>
              {guestDisplayName && (
                <p className="mt-5 text-lg font-semibold text-slate-900">
                  Thân mời / Cordially invites<br />{guestDisplayName}
                </p>
              )}
              <Button
                className="mt-8 rounded-full px-8"
                onClick={() => {
                  flushSync(() => {
                    setOpened(true)
                  })
                  void weddingMusicAudioRef.current?.playFromUserGesture()
                }}
              >
                Mở thiệp / Open
              </Button>
            </div>
          </section>
        )}
        <nav className="sticky top-0 z-30 flex justify-center gap-2 bg-white/80 px-3 py-2 text-sm shadow-sm backdrop-blur">
          <a className="rounded-full px-3 py-1 hover:bg-rose-50" href="#cover">Thiệp</a>
          <a className="rounded-full px-3 py-1 hover:bg-rose-50" href="#event">Sự kiện</a>
          <a className="rounded-full px-3 py-1 hover:bg-rose-50" href="#guest">Khách mời</a>
        </nav>
        <section
          id="cover"
          className="relative flex min-h-screen items-center justify-center bg-cover bg-center px-4 py-10"
          style={{
            backgroundImage: card.masterImageUrl
              ? `linear-gradient(to bottom, rgba(255,255,255,.35), rgba(255,244,244,.82)), url(${card.masterImageUrl})`
              : 'linear-gradient(135deg, #fff7ed, #fff1f2, #fef3c7)',
          }}
        >
          <div className="w-full max-w-2xl rounded-[2rem] bg-white/75 p-6 text-center shadow-2xl ring-1 ring-white/80 backdrop-blur md:p-10">
            <p className="text-xs uppercase tracking-[0.4em] text-rose-700">Wedding Invitation</p>
            <Heart className="mx-auto mt-6 h-10 w-10 fill-rose-200 text-rose-500" />
            <h1 className="mt-6 font-serif text-5xl italic text-slate-950 md:text-7xl">
              {card.groomName} & {card.brideName}
            </h1>
            <p className="mx-auto mt-6 max-w-xl whitespace-pre-line text-base leading-8 text-slate-700">
              {card.invitationText || 'Trân trọng kính mời quý khách đến dự lễ thành hôn của chúng tôi.'}
            </p>
            {card.invitationTextEn && (
              <p className="mx-auto mt-3 max-w-xl whitespace-pre-line text-sm leading-7 text-slate-600">
                {card.invitationTextEn}
              </p>
            )}
            {guestDisplayName && (
              <div className="mx-auto mt-6 max-w-md rounded-3xl bg-white/80 p-4 shadow-sm">
                <p className="text-sm text-slate-600">Thân mời / Cordially invites</p>
                <p className="mt-1 text-xl font-semibold text-slate-950">{guestDisplayName}</p>
              </div>
            )}
            <div className="mx-auto mt-8 max-w-md rounded-3xl bg-white/80 p-5 shadow-sm">
              <div id="event" />
              {card.weddingDate ? (
                <WeddingEventCalendarBlock
                  weddingDateIso={card.weddingDate}
                  weddingTimeText={card.weddingTime}
                  locale={uiLocale}
                  tx={txCal}
                  className="mb-4"
                />
              ) : (
                <p className="text-lg font-semibold text-slate-900">
                  Ngày cưới · {card.weddingTime || 'Giờ cưới'}
                </p>
              )}
              {card.weddingDate && (
                <p className="sr-only">
                  {card.weddingDate} · {card.weddingTime}
                </p>
              )}
              <p className="mt-2 flex items-center justify-center gap-2 text-slate-700">
                <MapPin className="h-5 w-5 text-rose-500" />
                {card.venue}
              </p>
              {card.mapUrl && (
                <>
                  <WeddingMapEmbed
                    mapUrl={card.mapUrl}
                    title={txMusic.publicMapEmbedTitle}
                    className="mt-4"
                  />
                  <Button asChild className="mt-3">
                    <a href={card.mapUrl} target="_blank" rel="noreferrer">Mở Google Maps</a>
                  </Button>
                </>
              )}
            </div>
            {card.musicUrl && (
              <div className="mx-auto mt-5 max-w-md rounded-3xl bg-white/80 p-4 text-left shadow-sm">
                <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <Music className="h-4 w-4 text-rose-500" />
                  Nhạc nền thiệp
                </p>
                <WeddingInvitationAudio
                  ref={weddingMusicAudioRef}
                  src={card.musicUrl}
                  loop
                  playStartSec={card.musicPlayStartSec}
                  playEndSec={card.musicPlayEndSec}
                  preload="auto"
                  className="w-full"
                  onSourceError={() => setMusicLoadFailed(true)}
                  onPlayingChange={reportMusicPlaying}
                  aria-label={
                    uiLocale === 'en'
                      ? 'Play invitation background music'
                      : uiLocale === 'zh'
                        ? '播放请柬背景音乐'
                        : uiLocale === 'ja'
                          ? '招待状のBGMを再生'
                          : uiLocale === 'ko'
                            ? '청첩장 배경음악 재생'
                            : 'Phát nhạc nền thiệp'
                  }
                />
                {musicLoadFailed && (
                  <p className="mt-2 text-xs text-destructive">{txMusic.playbackLoadFailed}</p>
                )}
              </div>
            )}
          </div>
        </section>

        {shouldShowPublicGiftBox(card) && (
          <div className="border-y border-amber-200/50 bg-[#fdfaf6]">
            <WeddingGiftEnvelopeBlock card={card} tx={txGift} />
          </div>
        )}

        <section className="mx-auto grid max-w-5xl gap-6 px-4 py-10 md:grid-cols-2">
          {card.storyText && (
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Album / Story</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-line leading-8 text-slate-700">{card.storyText}</p>
              </CardContent>
            </Card>
          )}
          {card.albumImageUrls.length > 0 && (
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Album ảnh</CardTitle>
              </CardHeader>
              <CardContent>
                <button
                  type="button"
                  onClick={() => {
                    setAlbumOpen(true)
                    setActiveAlbumIndex(0)
                  }}
                  className="group grid w-full grid-cols-2 gap-3 text-left"
                >
                  {card.albumImageUrls.slice(0, 2).map((url, index) => (
                    <div key={url} className="relative overflow-hidden rounded-2xl shadow-sm">
                      <img src={url} alt="Ảnh đại diện album" className="h-56 w-full object-cover transition duration-300 group-hover:scale-105" />
                      {index === 1 && card.albumImageUrls.length > 2 && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/35 text-2xl font-bold text-white">
                          +{card.albumImageUrls.length - 2}
                        </div>
                      )}
                    </div>
                  ))}
                </button>
                <p className="mt-3 text-center text-sm text-muted-foreground">
                  Bấm vào ảnh để mở album và xem đầy đủ.
                </p>
              </CardContent>
            </Card>
          )}
          {card.rsvpEnabled && (
            <Card id="guest">
              <CardHeader>
                <CardTitle>Xác nhận tham dự</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Họ tên</Label>
                  <Input value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder="Tên của bạn" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Button variant={attending ? 'default' : 'outline'} onClick={() => setAttending(true)}>Sẽ tham dự</Button>
                  <Button variant={!attending ? 'default' : 'outline'} onClick={() => setAttending(false)}>Không tham dự</Button>
                </div>
                <div className="space-y-2">
                  <Label>Số khách</Label>
                  <Input type="number" min="0" max="20" value={guestCount} onChange={(e) => setGuestCount(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Lời chúc</Label>
                  <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Gửi lời chúc đến cô dâu chú rể..." />
                </div>
                <Button onClick={submit} disabled={submitting} className="w-full">
                  {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                  Gửi phản hồi
                </Button>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Lời chúc</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {wishes.length === 0 && <p className="text-sm text-muted-foreground">Chưa có lời chúc nào.</p>}
              {wishes.map((wish) => (
                <div key={wish.id} className="rounded-2xl bg-rose-50 p-4">
                  <p className="font-semibold">{wish.guestName}</p>
                  <p className="mt-1 text-sm text-slate-700">{wish.message}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
        {albumOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 px-4 py-6">
            <div className="mx-auto max-w-5xl">
              <div className="mb-4 flex items-center justify-between rounded-2xl bg-white p-3 shadow">
                <p className="font-semibold">Album ảnh cô dâu chú rể</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setAlbumOpen(false)
                    setActiveAlbumIndex(null)
                  }}
                >
                  {uiLocale === 'en'
                    ? 'Close · back to invitation'
                    : uiLocale === 'zh'
                      ? '关闭 · 返回请柬'
                      : uiLocale === 'ja'
                        ? '閉じる · 招待状へ'
                        : uiLocale === 'ko'
                          ? '닫기 · 청첩장으로'
                          : 'Đóng · về thiệp'}
                </Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                {card.albumImageUrls.map((url, index) => (
                  <button key={url} type="button" onClick={() => setActiveAlbumIndex(index)} className="overflow-hidden rounded-2xl">
                    <img src={url} alt="Album cô dâu chú rể" className="max-h-[75vh] w-full object-cover shadow-lg transition duration-300 hover:scale-105" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        {activeAlbumIndex !== null && (
          <WeddingAlbumLightbox
            urls={card.albumImageUrls}
            index={activeAlbumIndex}
            onIndexChange={setActiveAlbumIndex}
            onCloseToInvitation={() => {
              setActiveAlbumIndex(null)
              setAlbumOpen(false)
            }}
            onOpenGallery={() => setActiveAlbumIndex(null)}
          />
        )}
        {opened && card.musicUrl && !musicLoadFailed && (
          <button
            type="button"
            className={cn(
              'fixed bottom-4 right-4 z-40 flex h-[52px] w-[52px] items-center justify-center rounded-full shadow-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
              musicFabPlaying
                ? 'border border-white/25 bg-rose-700 text-white ring-2 ring-white/15 hover:bg-rose-800 focus-visible:ring-white/50'
                : 'border border-rose-200/90 bg-white/95 text-rose-600 backdrop-blur-md hover:bg-rose-50 focus-visible:ring-rose-400',
            )}
            aria-label={musicFabPlaying ? txMusic.publicFabPauseAria : txMusic.publicFabPlayAria}
            aria-pressed={musicFabPlaying}
            onClick={() => weddingMusicAudioRef.current?.togglePlayback()}
          >
            <WeddingMusicFabVisual playing={musicFabPlaying} className={musicFabPlaying ? undefined : 'text-rose-600'} />
          </button>
        )}
      </main>
    </>
  )
}
