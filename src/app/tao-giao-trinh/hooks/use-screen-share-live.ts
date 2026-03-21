'use client'

import { useCallback, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { RealtimeChannel } from '@supabase/supabase-js'

function generateShareCode(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 8)
}

function createPeerConnection(
  onTrack: (stream: MediaStream) => void,
  onIceCandidate: (candidate: RTCIceCandidate) => void
): RTCPeerConnection {
  const pc = new RTCPeerConnection({
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
  })
  pc.ontrack = (e) => {
    if (e.streams[0]) onTrack(e.streams[0])
  }
  pc.onicecandidate = (e) => {
    if (e.candidate) onIceCandidate(e.candidate)
  }
  return pc
}

/** URL chia sẻ luôn dùng domain chính để link mở được từ mọi trình duyệt/thiết bị */
function getShareBaseUrl(): string {
  if (typeof window === 'undefined') return ''
  const env = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '')
  if (env) return env
  return `${window.location.protocol}//${window.location.host}`
}

export interface UseScreenShareLiveReturn {
  isSharing: boolean
  shareCode: string | null
  shareUrl: string | null
  error: string | null
  startShare: () => Promise<void>
  stopShare: () => void
}

/** Học sinh chia sẻ màn hình livestream – tạo link + QR cho người khác xem trực tiếp. Hỗ trợ nhiều viewer (mỗi người 1 PC riêng). */
export function useScreenShareLive(): UseScreenShareLiveReturn {
  const [isSharing, setIsSharing] = useState(false)
  const [shareCode, setShareCode] = useState<string | null>(null)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const pcMapRef = useRef<Map<string, RTCPeerConnection>>(new Map())
  const streamRef = useRef<MediaStream | null>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)

  const stopShare = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    pcMapRef.current.forEach((pc) => pc.close())
    pcMapRef.current.clear()
    channelRef.current?.unsubscribe()
    channelRef.current = null
    setShareCode(null)
    setShareUrl(null)
    setIsSharing(false)
  }, [])

  const startShare = useCallback(async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      })
      streamRef.current = stream
      stream.getVideoTracks()[0].onended = () => stopShare()

      const code = generateShareCode()
      setShareCode(code)
      const baseUrl = getShareBaseUrl()
      const url = `${baseUrl}/tao-giao-trinh/xem-man-hinh?share=${code}`
      setShareUrl(url)

      const supabase = createClient()
      const channelName = `screen-live-${code}`
      const channel = supabase.channel(channelName, { config: { private: false } })
      channelRef.current = channel

      const sendOfferToViewer = async (viewerId: string) => {
        const pc = createPeerConnection(
          () => {},
          (candidate) => {
            channel.send({
              type: 'broadcast',
              event: 'ice',
              payload: { from: 'sharer', viewerId, candidate: candidate.toJSON() },
            })
          }
        )
        pcMapRef.current.set(viewerId, pc)
        stream.getTracks().forEach((t) => pc.addTrack(t, stream))
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        channel.send({
          type: 'broadcast',
          event: 'offer',
          payload: {
            from: 'sharer',
            viewerId,
            sdp: pc.localDescription?.toJSON(),
          },
        })
      }

      channel
        .on('broadcast', { event: 'answer' }, async ({ payload }) => {
          const viewerId = payload?.viewerId
          if (payload?.from !== 'viewer' || !payload?.sdp || !viewerId) return
          const pc = pcMapRef.current.get(viewerId)
          if (pc) {
            try {
              await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp))
            } catch {
              pc.close()
              pcMapRef.current.delete(viewerId)
            }
          }
        })
        .on('broadcast', { event: 'ice' }, async ({ payload }) => {
          if (payload?.from !== 'viewer' || !payload?.candidate || !payload?.viewerId) return
          const pc = pcMapRef.current.get(payload.viewerId)
          if (pc) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(payload.candidate))
            } catch {
              /* ignore */
            }
          }
        })
        .on('broadcast', { event: 'request-offer' }, ({ payload }) => {
          const viewerId = payload?.viewerId ?? payload?.viewer_id ?? crypto.randomUUID()
          void sendOfferToViewer(viewerId)
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            setIsSharing(true)
          }
        })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
      stopShare()
    }
  }, [stopShare])

  return {
    isSharing,
    shareCode,
    shareUrl,
    error,
    startShare,
    stopShare,
  }
}
