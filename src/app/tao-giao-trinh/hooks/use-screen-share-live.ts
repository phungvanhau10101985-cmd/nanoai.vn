'use client'

import { useCallback, useRef, useState } from 'react'
import { ScreenLiveChannel } from '../lib/screen-live-channel'

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

async function getDisplayMediaWithTimeout(timeoutMs = 15000): Promise<MediaStream> {
  return (await Promise.race([
    navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: false,
    }),
    new Promise<never>((_, reject) =>
      setTimeout(
        () =>
          reject(
            new Error(
              'Không mở được hộp chọn màn hình. Hãy bấm lại nút chia sẻ và chọn tab/cửa sổ cần chia sẻ.'
            )
          ),
        timeoutMs
      )
    ),
  ])) as MediaStream
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
  const offerInFlightRef = useRef<Set<string>>(new Set())
  const streamRef = useRef<MediaStream | null>(null)
  const channelRef = useRef<ScreenLiveChannel | null>(null)

  const stopShare = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    pcMapRef.current.forEach((pc) => pc.close())
    pcMapRef.current.clear()
    offerInFlightRef.current.clear()
    channelRef.current?.unsubscribe()
    channelRef.current = null
    setShareCode(null)
    setShareUrl(null)
    setIsSharing(false)
  }, [])

  const startShare = useCallback(async () => {
    setError(null)
    try {
      const stream = await getDisplayMediaWithTimeout(15000)
      if (!stream || stream.getTracks().length === 0 || stream.getVideoTracks().length === 0) {
        stream?.getTracks?.().forEach((t) => t.stop())
        throw new Error('Không lấy được luồng video chia sẻ màn hình.')
      }
      streamRef.current = stream
      stream.getVideoTracks()[0].onended = () => stopShare()

      const code = generateShareCode()
      setShareCode(code)
      const baseUrl = getShareBaseUrl()
      const url = `${baseUrl}/giao-trinh/xem-man-hinh?share=${code}`
      setShareUrl(url)

      const channel = new ScreenLiveChannel(code)
      channelRef.current = channel

      const sendOfferToViewer = async (viewerId: string, options?: { forceNew?: boolean }) => {
        const key = String(viewerId || '').trim()
        if (!key) return
        if (offerInFlightRef.current.has(key)) return
        let pc = pcMapRef.current.get(key)
        const forceNew = options?.forceNew === true
        if (forceNew && pc) {
          try {
            pc.close()
          } catch {
            /* ignore */
          }
          pcMapRef.current.delete(key)
          pc = undefined
        }
        const state = pc?.connectionState
        if (
          pc &&
          (state === 'connected' || state === 'connecting' || state === 'new')
        ) {
          const local = pc.localDescription?.toJSON()
          if (local) {
            channel.send({
              type: 'broadcast',
              event: 'offer',
              payload: {
                from: 'sharer',
                viewerId: key,
                sdp: local,
              },
            })
          }
          return
        }
        if (pc) {
          try {
            pc.close()
          } catch {
            /* ignore */
          }
          pcMapRef.current.delete(key)
        }
        offerInFlightRef.current.add(key)
        try {
          const newPc = createPeerConnection(
            () => {},
            (candidate) => {
              channel.send({
                type: 'broadcast',
                event: 'ice',
                payload: { from: 'sharer', viewerId: key, candidate: candidate.toJSON() },
              })
            }
          )
          newPc.onconnectionstatechange = () => {
            const cs = newPc.connectionState
            if (!cs) return
            if (cs === 'failed' || cs === 'closed' || cs === 'disconnected') {
              pcMapRef.current.delete(key)
              offerInFlightRef.current.delete(key)
              try {
                newPc.close()
              } catch {
                /* ignore */
              }
            }
          }
          pc = newPc
          pcMapRef.current.set(key, newPc)
          stream.getTracks().forEach((t) => newPc.addTrack(t, stream))
          const offer = await newPc.createOffer()
          await newPc.setLocalDescription(offer)
          channel.send({
            type: 'broadcast',
            event: 'offer',
            payload: {
              from: 'sharer',
              viewerId: key,
              sdp: newPc.localDescription?.toJSON(),
            },
          })
        } finally {
          offerInFlightRef.current.delete(key)
        }
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
          void sendOfferToViewer(viewerId, { forceNew: payload?.forceNew === true })
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
