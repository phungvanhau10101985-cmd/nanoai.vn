'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { RealtimeChannel } from '@supabase/supabase-js'

function generateShareCode(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 8)
}

function isLoopbackHost(hostname: string): boolean {
  const h = hostname.trim().toLowerCase()
  return h === 'localhost' || h === '127.0.0.1' || h === '::1'
}

function resolveShareBaseUrl(): string {
  if (typeof window === 'undefined') return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || ''

  const currentOrigin = `${window.location.protocol}//${window.location.host}`.replace(/\/$/, '')
  const envUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || ''
  if (!envUrl) return currentOrigin

  try {
    const currentHost = window.location.hostname
    const envHost = new URL(envUrl).hostname
    // Nếu đang truy cập bằng localhost thì ưu tiên domain/IP public từ env.
    if (isLoopbackHost(currentHost) && !isLoopbackHost(envHost)) return envUrl
    // Nếu đang truy cập bằng domain/IP khả dụng thì dùng origin hiện tại (tránh env localhost sai).
    return currentOrigin
  } catch {
    return currentOrigin
  }
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
  const answerAppliedRef = useRef(false)
  const lastOfferSentAtRef = useRef(0)

  const stopShare = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    pcRef.current?.close()
    pcRef.current = null
    sessionIdRef.current = null
    answerAppliedRef.current = false
    lastOfferSentAtRef.current = 0
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

      const baseUrl = resolveShareBaseUrl()
      const url = `${baseUrl}/tao-giao-trinh/xem-man-hinh?share=${code}`
      setShareUrl(url)

      const supabase = createClient()
      const channelName = `screen-live-${code}`
      const channel = supabase.channel(channelName)
      channelRef.current = channel
      const sendCurrentOffer = () => {
        const currentChannel = channelRef.current
        const currentPc = pcRef.current
        const currentSessionId = sessionIdRef.current
        if (!currentChannel || !currentPc?.localDescription || !currentSessionId) return
        lastOfferSentAtRef.current = Date.now()
        currentChannel.send({
          type: 'broadcast',
          event: 'offer',
          payload: {
            from: 'sharer',
            sessionId: currentSessionId,
            sdp: currentPc.localDescription.toJSON(),
          },
        })
      }
      const createAndSendOffer = async () => {
        const currentStream = streamRef.current
        const currentChannel = channelRef.current
        if (!currentStream || !currentChannel) return
        const sessionId = crypto.randomUUID()
        sessionIdRef.current = sessionId
        answerAppliedRef.current = false
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
        sendCurrentOffer()
      }

      channel
        .on('broadcast', { event: 'answer' }, ({ payload }) => {
          if (payload?.from === 'viewer' && payload?.sdp && payload?.sessionId === sessionIdRef.current) {
            pcRef.current
              ?.setRemoteDescription(new RTCSessionDescription(payload.sdp))
              .then(() => {
                answerAppliedRef.current = true
              })
              .catch(() => {
                // Khi viewer vào lại, remoteDescription cũ có thể ở state không hợp lệ.
                // Tạo offer mới để renegotiate sạch.
                void createAndSendOffer()
              })
          }
        })
        .on('broadcast', { event: 'ice' }, async ({ payload }) => {
          if (payload?.from === 'viewer' && payload?.candidate && payload?.sessionId === sessionIdRef.current && pcRef.current) {
            await pcRef.current.addIceCandidate(new RTCIceCandidate(payload.candidate))
          }
        })
        .on('broadcast', { event: 'request-offer' }, () => {
          if (answerAppliedRef.current) {
            const elapsed = Date.now() - lastOfferSentAtRef.current
            if (elapsed > 1200) {
              void createAndSendOffer()
            } else {
              sendCurrentOffer()
            }
            return
          }
          if (pcRef.current?.localDescription && sessionIdRef.current) {
            sendCurrentOffer()
            return
          }
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
