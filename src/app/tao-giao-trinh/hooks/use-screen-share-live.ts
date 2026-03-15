'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
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

export interface UseScreenShareLiveReturn {
  isSharing: boolean
  shareCode: string | null
  shareUrl: string | null
  error: string | null
  startShare: () => Promise<void>
  stopShare: () => void
}

/** Học sinh chia sẻ màn hình livestream – tạo link + QR cho người khác xem trực tiếp */
export function useScreenShareLive(): UseScreenShareLiveReturn {
  const [isSharing, setIsSharing] = useState(false)
  const [shareCode, setShareCode] = useState<string | null>(null)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const pcRef = useRef<RTCPeerConnection | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const sessionIdRef = useRef<string | null>(null)

  const stopShare = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    pcRef.current?.close()
    pcRef.current = null
    sessionIdRef.current = null
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

      const baseUrl =
        typeof window !== 'undefined'
          ? (process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || `${window.location.protocol}//${window.location.host}`)
          : ''
      const url = `${baseUrl}/tao-giao-trinh/xem-man-hinh?share=${code}`
      setShareUrl(url)

      const supabase = createClient()
      const channelName = `screen-live-${code}`
      const channel = supabase.channel(channelName)
      channelRef.current = channel
      const createAndSendOffer = async () => {
        const currentStream = streamRef.current
        const currentChannel = channelRef.current
        if (!currentStream || !currentChannel) return
        const sessionId = crypto.randomUUID()
        sessionIdRef.current = sessionId
        pcRef.current?.close()
        const pc = createPeerConnection(
          () => {},
          (candidate) => {
            currentChannel.send({
              type: 'broadcast',
              event: 'ice',
              payload: { from: 'sharer', sessionId, candidate: candidate.toJSON() },
            })
          }
        )
        pcRef.current = pc
        currentStream.getTracks().forEach((t) => pc.addTrack(t, currentStream))
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        currentChannel.send({
          type: 'broadcast',
          event: 'offer',
          payload: {
            from: 'sharer',
            sessionId,
            sdp: pc.localDescription?.toJSON(),
          },
        })
      }

      channel
        .on('broadcast', { event: 'answer' }, ({ payload }) => {
          if (payload?.from === 'viewer' && payload?.sdp && payload?.sessionId === sessionIdRef.current) {
            pcRef.current?.setRemoteDescription(new RTCSessionDescription(payload.sdp))
          }
        })
        .on('broadcast', { event: 'ice' }, async ({ payload }) => {
          if (payload?.from === 'viewer' && payload?.candidate && payload?.sessionId === sessionIdRef.current && pcRef.current) {
            await pcRef.current.addIceCandidate(new RTCIceCandidate(payload.candidate))
          }
        })
        .on('broadcast', { event: 'request-offer' }, () => {
          void createAndSendOffer()
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            void createAndSendOffer()
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
