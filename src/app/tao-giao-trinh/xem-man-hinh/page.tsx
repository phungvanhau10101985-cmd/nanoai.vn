'use client'

import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { RotateCw } from 'lucide-react'

function getWebLocale(): 'vi' | 'en' | 'zh' | 'ja' | 'ko' {
  if (typeof document === 'undefined') return 'vi'
  const cookieValue = document.cookie
    .split(';')
    .map((x) => x.trim())
    .find((x) => x.startsWith('nanoai_locale='))
    ?.split('=')[1]
    ?.trim()
    .toLowerCase()
  if (cookieValue === 'en' || cookieValue === 'zh' || cookieValue === 'ja' || cookieValue === 'ko') return cookieValue
  return 'vi'
}

function tr(locale: string, vi: string, en: string, zh: string, ja: string, ko: string) {
  if (locale === 'en') return en
  if (locale === 'zh') return zh
  if (locale === 'ja') return ja
  if (locale === 'ko') return ko
  return vi
}

/** Trang xem màn hình livestream – học sinh chia sẻ, người khác quét QR mở link xem trực tiếp */
export default function XemManHinhPage() {
  const searchParams = useSearchParams()
  const shareCode = searchParams.get('share')
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [status, setStatus] = useState<'connecting' | 'connected' | 'error' | 'no-code'>('no-code')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [locale, setLocale] = useState<'vi' | 'en' | 'zh' | 'ja' | 'ko'>('vi')
  const [isPortrait, setIsPortrait] = useState(false)
  const [dims, setDims] = useState({ w: 0, h: 0 })
  const videoRef = useRef<HTMLVideoElement>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const pcRef = useRef<RTCPeerConnection | null>(null)

  useEffect(() => {
    setLocale(getWebLocale())
  }, [])

  useEffect(() => {
    const mq = window.matchMedia('(orientation: portrait)')
    const updateLayout = () => {
      const w = window.innerWidth
      const h = window.visualViewport?.height ?? window.innerHeight
      setDims({ w, h })
      setIsPortrait(w < 768 && mq.matches)
    }
    const onOrientationChange = () => {
      updateLayout()
      setTimeout(updateLayout, 150)
    }
    updateLayout()
    mq.addEventListener('change', onOrientationChange)
    window.addEventListener('resize', updateLayout)
    window.addEventListener('orientationchange', onOrientationChange)
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', updateLayout)
    }
    return () => {
      mq.removeEventListener('change', onOrientationChange)
      window.removeEventListener('resize', updateLayout)
      window.removeEventListener('orientationchange', onOrientationChange)
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', updateLayout)
      }
    }
  }, [])

  useEffect(() => {
    if (!shareCode?.trim()) {
      setStatus('no-code')
      return
    }

    setStatus('connecting')
    setErrorMsg(null)

    const supabase = createClient()
    const channelName = `screen-live-${shareCode.trim()}`
    const channel = supabase.channel(channelName)
    channelRef.current = channel

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    })
    pcRef.current = pc

    pc.ontrack = (e) => {
      if (e.streams[0]) {
        setStream(e.streams[0])
        setStatus('connected')
      }
    }

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        channel.send({
          type: 'broadcast',
          event: 'ice',
          payload: { from: 'viewer', candidate: e.candidate.toJSON() },
        })
      }
    }

    channel
      .on('broadcast', { event: 'offer' }, async ({ payload }) => {
        if (payload?.from !== 'sharer' || !payload?.sdp) return
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp))
          const answer = await pc.createAnswer()
          await pc.setLocalDescription(answer)
          channel.send({
            type: 'broadcast',
            event: 'answer',
            payload: {
              from: 'viewer',
              sdp: pc.localDescription?.toJSON(),
            },
          })
        } catch (err) {
          setErrorMsg(err instanceof Error ? err.message : String(err))
          setStatus('error')
        }
      })
      .on('broadcast', { event: 'ice' }, async ({ payload }) => {
        if (payload?.from === 'sharer' && payload?.candidate && pcRef.current) {
          try {
            await pcRef.current.addIceCandidate(new RTCIceCandidate(payload.candidate))
          } catch {
            /* ignore */
          }
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          channel.send({ type: 'broadcast', event: 'request-offer', payload: { from: 'viewer' } })
        } else if (status === 'CHANNEL_ERROR') {
          setStatus('error')
          setErrorMsg(tr(locale, 'Không kết nối được. Kiểm tra mã chia sẻ.', 'Connection failed. Check share code.', '连接失败。请检查分享码。', '接続できません。共有コードを確認。', '연결 실패. 공유 코드 확인.'))
        }
      })

    return () => {
      channel.unsubscribe()
      channelRef.current = null
      pc.close()
      pcRef.current = null
    }
  }, [shareCode, locale])

  useEffect(() => {
    const v = videoRef.current
    if (!v || !stream) return
    v.srcObject = stream
    v.play().catch(() => {})
  }, [stream])

  if (!shareCode?.trim()) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
        <p className="text-slate-400 text-center">
          {tr(locale, 'Thiếu mã chia sẻ. Mở link từ QR hoặc link chia sẻ màn hình.', 'Missing share code. Open link from QR or screen share link.', '缺少分享码。请从二维码或屏幕分享链接打开。', '共有コードがありません。QRまたは画面共有リンクから開いてください。', '공유 코드가 없습니다. QR 또는 화면 공유 링크에서 열어주세요.')}
        </p>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
        <p className="text-red-400 text-center">{errorMsg}</p>
      </div>
    )
  }

  if (status === 'connecting') {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 rounded-full border-2 border-white/30 border-t-white animate-spin" />
          <p className="text-slate-400">
            {tr(locale, 'Đang kết nối... Chờ học sinh chia sẻ màn hình.', 'Connecting... Waiting for student to share screen.', '正在连接... 等待学生共享屏幕。', '接続中... 生徒の画面共有を待機中。', '연결 중... 학생 화면 공유 대기 중.')}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black flex flex-col overflow-hidden"
      style={dims.w && dims.h ? { width: dims.w, height: dims.h } : undefined}
    >
      {isPortrait && (
        <div className="shrink-0 flex items-center justify-center gap-2 py-2 px-3 bg-amber-500/20 border-b border-amber-400/30">
          <RotateCw className="h-4 w-4 text-amber-300 shrink-0" />
          <p className="text-amber-200 text-xs text-center">
            {tr(locale, 'Xoay ngang màn hình để xem rộng hơn', 'Rotate to landscape for wider view', '横屏观看更宽', '横向きで広く表示', '가로 모드로 넓게 보기')}
          </p>
        </div>
      )}
      <div className="h-12 shrink-0 flex items-center justify-center bg-black/80 border-b border-white/10">
        <span className="text-white/90 text-sm font-medium">
          {tr(locale, 'Đang xem màn hình trực tiếp', 'Viewing screen live', '正在实时观看屏幕', '画面をリアルタイム表示中', '화면 실시간 보는 중')}
        </span>
      </div>
      <div className="flex-1 min-h-0 relative overflow-hidden w-full">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-contain"
          style={{ touchAction: 'none' }}
        />
      </div>
    </div>
  )
}
