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
  const activeViewerIdRef = useRef<string | null>(null)

  const stopShare = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    pcRef.current?.close()
    pcRef.current = null
    sessionIdRef.current = null
    activeViewerIdRef.current = null
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
      const sendCurrentOffer = () => {
        const currentPc = pcRef.current
        const sessionId = sessionIdRef.current
        const viewerId = activeViewerIdRef.current
        if (!currentPc?.localDescription || !sessionId || !viewerId) return
        channel.send({
          type: 'broadcast',
          event: 'offer',
          payload: {
            from: 'sharer',
            viewerId,
            sessionId,
            sdp: currentPc.localDescription.toJSON(),
          },
        })
      }
      const createOfferForViewer = async (viewerId: string) => {
        const currentStream = streamRef.current
        if (!currentStream) return
        activeViewerIdRef.current = viewerId
        const sessionId = crypto.randomUUID()
        sessionIdRef.current = sessionId
        pcRef.current?.close()
        const pc = createPeerConnection(
          () => {},
          (candidate) => {
            channel.send({
              type: 'broadcast',
              event: 'ice',
              payload: { from: 'sharer', viewerId, sessionId, candidate: candidate.toJSON() },
            })
          }
        )
        pcRef.current = pc
        currentStream.getTracks().forEach((t) => pc.addTrack(t, currentStream))
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        sendCurrentOffer()
      }

      channel
        .on('broadcast', { event: 'answer' }, ({ payload }) => {
          if (
            payload?.from === 'viewer'
            && payload?.sdp
            && payload?.sessionId
            && payload?.viewerId
            && payload.viewerId === activeViewerIdRef.current
            && payload.sessionId === sessionIdRef.current
          ) {
            pcRef.current?.setRemoteDescription(new RTCSessionDescription(payload.sdp))
          }
        })
        .on('broadcast', { event: 'ice' }, async ({ payload }) => {
          if (
            payload?.from === 'viewer'
            && payload?.candidate
            && payload?.sessionId
            && payload?.viewerId
            && payload.viewerId === activeViewerIdRef.current
            && payload.sessionId === sessionIdRef.current
            && pcRef.current
          ) {
            await pcRef.current.addIceCandidate(new RTCIceCandidate(payload.candidate))
          }
        })
        .on('broadcast', { event: 'request-offer' }, ({ payload }) => {
          const viewerId = typeof payload?.viewerId === 'string' ? payload.viewerId : null
          if (!viewerId) return
          // Viewer cũ yêu cầu lại: gửi lại offer hiện tại.
          if (viewerId === activeViewerIdRef.current && pcRef.current?.localDescription) {
            sendCurrentOffer()
            return
          }
          // Viewer mới vào lại/đổi thiết bị: tạo phiên WebRTC mới sạch.
          void createOfferForViewer(viewerId)
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
