'use client'

import { readWebLocaleFromDocumentCookie } from '@/lib/i18n/read-web-locale-cookie'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { ScreenLiveChannel } from '../lib/screen-live-channel'
import { RotateCw } from 'lucide-react'

function getWebLocale(): 'vi' | 'en' | 'zh' | 'ja' | 'ko' {
  if (typeof document === 'undefined') return 'vi'
  const cookieValue = readWebLocaleFromDocumentCookie()
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
function XemManHinhInner() {
  const searchParams = useSearchParams()
  const shareCode = searchParams.get('share')
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [status, setStatus] = useState<'connecting' | 'connected' | 'error' | 'no-code'>('no-code')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [locale, setLocale] = useState<'vi' | 'en' | 'zh' | 'ja' | 'ko'>('vi')
  const [isPortrait, setIsPortrait] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const channelRef = useRef<ScreenLiveChannel | null>(null)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const connectedRef = useRef(false)

  useEffect(() => {
    setLocale(getWebLocale())
  }, [])

  useEffect(() => {
    const mq = window.matchMedia('(orientation: portrait)')
    const updateLayout = () => {
      const w = window.innerWidth
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
    connectedRef.current = false

    const viewerId = crypto.randomUUID()
    let reconnectAttempt = 0
    const channel = new ScreenLiveChannel(shareCode.trim())
    channelRef.current = channel

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    })
    pcRef.current = pc

    pc.ontrack = (e) => {
      if (e.streams[0]) {
        setStream(e.streams[0])
      }
    }

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        channel.send({
          type: 'broadcast',
          event: 'ice',
          payload: { from: 'viewer', viewerId, candidate: e.candidate.toJSON() },
        })
      }
    }

    const requestOffer = async (opts?: { forceNew?: boolean }) => {
      try {
        await channel.send({
          type: 'broadcast',
          event: 'request-offer',
          payload: { from: 'viewer', viewerId, ...(opts?.forceNew ? { forceNew: true } : {}) },
        })
      } catch {
        // keep retrying while still connecting
      }
    }

    channel
      .on('broadcast', { event: 'offer' }, async ({ payload }) => {
        if (payload?.from !== 'sharer' || !payload?.sdp || payload?.viewerId !== viewerId) return
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp))
          const answer = await pc.createAnswer()
          await pc.setLocalDescription(answer)
          channel.send({
            type: 'broadcast',
            event: 'answer',
            payload: {
              from: 'viewer',
              viewerId,
              sdp: pc.localDescription?.toJSON(),
            },
          })
        } catch (err) {
          setErrorMsg(err instanceof Error ? err.message : String(err))
          setStatus('error')
        }
      })
      .on('broadcast', { event: 'ice' }, async ({ payload }) => {
        if (payload?.from !== 'sharer' || !payload?.candidate || payload?.viewerId !== viewerId || !pcRef.current) return
        try {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(payload.candidate))
        } catch {
          /* ignore */
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          void requestOffer()
        } else if (status === 'CHANNEL_ERROR') {
          setStatus('error')
          setErrorMsg(tr(locale, 'Không kết nối được. Kiểm tra mã chia sẻ.', 'Connection failed. Check share code.', '连接失败。请检查分享码。', '接続できません。共有コードを確認。', '연결 실패. 공유 코드 확인.'))
        }
      })

    // Mobile networks can drop first signaling message; retry until stream arrives.
    const retryTimer = window.setInterval(() => {
      if (connectedRef.current) return
      reconnectAttempt += 1
      // Every few retries, force sharer to rebuild peer for this viewer (unsticks ICE states).
      void requestOffer({ forceNew: reconnectAttempt % 6 === 0 })
    }, 1500)
    const timeoutTimer = window.setTimeout(() => {
      if (connectedRef.current) return
      setStatus('error')
      setErrorMsg(
        tr(
          locale,
          'Không nhận được tín hiệu chia sẻ. Kiểm tra bên chia sẻ còn đang bật và mở lại link QR.',
          'No sharing signal received. Ensure the sharer is still active and reopen the QR link.',
          '未收到共享信号。请确认分享端仍在共享并重新打开二维码链接。',
          '共有シグナルを受信できません。共有側が継続中か確認し、QRリンクを再度開いてください。',
          '공유 신호를 받지 못했습니다. 공유 중인지 확인 후 QR 링크를 다시 열어 주세요.'
        )
      )
    }, 25000)

    return () => {
      window.clearInterval(retryTimer)
      window.clearTimeout(timeoutTimer)
      connectedRef.current = false
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
    const markConnected = () => {
      connectedRef.current = true
      setStatus('connected')
    }
    const onLoaded = () => {
      // First decoded frame means viewer is truly receiving media.
      if ((v.videoWidth || 0) > 0 && (v.videoHeight || 0) > 0) {
        markConnected()
      }
    }
    const onPlaying = () => markConnected()
    const onTimeUpdate = () => {
      if ((v.currentTime || 0) > 0) markConnected()
    }
    v.addEventListener('loadeddata', onLoaded)
    v.addEventListener('playing', onPlaying)
    v.addEventListener('timeupdate', onTimeUpdate)
    v.play().catch(() => {})
    return () => {
      v.removeEventListener('loadeddata', onLoaded)
      v.removeEventListener('playing', onPlaying)
      v.removeEventListener('timeupdate', onTimeUpdate)
    }
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

export default function XemManHinhPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
          <div className="h-10 w-10 rounded-full border-2 border-white/30 border-t-white animate-spin" />
        </div>
      }
    >
      <XemManHinhInner />
    </Suspense>
  )
}
