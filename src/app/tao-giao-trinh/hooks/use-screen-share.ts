'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

const SCREEN_SHARE_CHANNEL = 'tao-giao-trinh-screen-share'

export type ScreenShareRole = 'teacher' | 'student'

export interface UseScreenShareOptions {
  role: ScreenShareRole
  /** Teacher: gửi message đến student window */
  sendToStudent?: (msg: Record<string, unknown>) => void
  /** Student: window.opener để gửi answer về teacher */
  openerWindow?: Window | null
  /** Student: callback khi nhận được stream */
  onStreamReceived?: (stream: MediaStream) => void
  /** Callback khi stream kết thúc */
  onStreamEnded?: () => void
}

export interface UseScreenShareReturn {
  isSharing: boolean
  isReceiving: boolean
  error: string | null
  startShare: () => Promise<void>
  stopShare: () => void
  /** Student: stream đang nhận (để hiển thị video) */
  receivedStream: MediaStream | null
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

export function useScreenShare(options: UseScreenShareOptions): UseScreenShareReturn {
  const { role, sendToStudent, openerWindow, onStreamReceived, onStreamEnded } = options
  const [isSharing, setIsSharing] = useState(false)
  const [isReceiving, setIsReceiving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [receivedStream, setReceivedStream] = useState<MediaStream | null>(null)

  const pcRef = useRef<RTCPeerConnection | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const channelRef = useRef<BroadcastChannel | null>(null)
  const sessionIdRef = useRef<string | null>(null)

  const postToChannel = useCallback((msg: Record<string, unknown>) => {
    channelRef.current?.postMessage(msg)
  }, [])

  const postToStudent = useCallback(
    (msg: Record<string, unknown>) => {
      sendToStudent?.(msg)
    },
    [sendToStudent]
  )

  const postToOpener = useCallback(
    (msg: Record<string, unknown>) => {
      try {
        openerWindow?.postMessage(msg, window.location.origin)
      } catch {
        /* ignore */
      }
    },
    [openerWindow]
  )

  const stopShare = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    pcRef.current?.close()
    pcRef.current = null
    sessionIdRef.current = null
    setIsSharing(false)
    if (role === 'teacher') {
      postToChannel({ type: 'screen-share-stop' })
      postToStudent({ type: 'screen-share-stop' })
    }
  }, [role, postToChannel, postToStudent])

  const startShare = useCallback(async () => {
    if (role !== 'teacher') return
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
        preferCurrentTab: true,
      } as DisplayMediaStreamOptions)
      streamRef.current = stream
      stream.getVideoTracks()[0].onended = () => {
        stopShare()
        onStreamEnded?.()
      }

      const sessionId = crypto.randomUUID()
      sessionIdRef.current = sessionId

      const pc = createPeerConnection(
        () => {},
        (candidate) => {
          postToChannel({ type: 'screen-share-ice', sessionId, candidate: candidate.toJSON() })
          postToStudent({ type: 'screen-share-ice', sessionId, candidate: candidate.toJSON() })
        }
      )
      pcRef.current = pc

      stream.getTracks().forEach((t) => pc.addTrack(t, stream))
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      const payload = {
        type: 'screen-share-offer',
        sessionId,
        sdp: pc.localDescription?.toJSON(),
      }
      postToChannel(payload)
      postToStudent(payload)
      setIsSharing(true)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
      stopShare()
    }
  }, [role, stopShare, postToChannel, postToStudent, onStreamEnded])

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return
    const channel = new BroadcastChannel(SCREEN_SHARE_CHANNEL)
    channelRef.current = channel

    const handleMessage = async (e: MessageEvent) => {
      const d = e.data
      if (!d?.type) return

      if (d.type === 'screen-share-stop') {
        pcRef.current?.close()
        pcRef.current = null
        streamRef.current?.getTracks().forEach((t) => t.stop())
        streamRef.current = null
        setReceivedStream(null)
        setIsSharing(false)
        setIsReceiving(false)
        onStreamEnded?.()
        return
      }

      if (role === 'student') {
        if (d.type === 'screen-share-offer' && d.sessionId && d.sdp) {
          if (sessionIdRef.current === d.sessionId && pcRef.current) return
          pcRef.current?.close()
          sessionIdRef.current = d.sessionId
          const pc = createPeerConnection(
            (stream) => {
              setReceivedStream(stream)
              setIsReceiving(true)
              onStreamReceived?.(stream)
            },
            (candidate) => {
              if (sessionIdRef.current === d.sessionId) {
                postToChannel({ type: 'screen-share-ice', sessionId: d.sessionId, candidate: candidate.toJSON() })
                postToOpener({ type: 'screen-share-ice', sessionId: d.sessionId, candidate: candidate.toJSON() })
              }
            }
          )
          pcRef.current = pc
          await pc.setRemoteDescription(new RTCSessionDescription(d.sdp))
          const answer = await pc.createAnswer()
          await pc.setLocalDescription(answer)
          const payload = { type: 'screen-share-answer', sessionId: d.sessionId, sdp: pc.localDescription?.toJSON() }
          postToChannel(payload)
          postToOpener(payload)
        } else if (d.type === 'screen-share-ice' && d.sessionId === sessionIdRef.current && d.candidate) {
          await pcRef.current?.addIceCandidate(new RTCIceCandidate(d.candidate))
        }
      }

      if (role === 'teacher') {
        if (d.type === 'screen-share-answer' && d.sessionId === sessionIdRef.current && d.sdp) {
          await pcRef.current?.setRemoteDescription(new RTCSessionDescription(d.sdp))
        } else if (d.type === 'screen-share-ice' && d.sessionId === sessionIdRef.current && d.candidate) {
          await pcRef.current?.addIceCandidate(new RTCIceCandidate(d.candidate))
        }
      }
    }

    channel.addEventListener('message', handleMessage)
    return () => {
      channel.removeEventListener('message', handleMessage)
      channel.close()
      channelRef.current = null
    }
  }, [role, postToChannel, postToOpener, onStreamReceived, onStreamEnded])

  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return
      const d = e.data
      if (!d?.type) return

      if (d.type === 'screen-share-stop') {
        pcRef.current?.close()
        pcRef.current = null
        streamRef.current?.getTracks().forEach((t) => t.stop())
        streamRef.current = null
        setReceivedStream(null)
        setIsSharing(false)
        setIsReceiving(false)
        onStreamEnded?.()
        return
      }

      if (role === 'student') {
        if (d.type === 'screen-share-offer' && d.sessionId && d.sdp) {
          if (sessionIdRef.current === d.sessionId && pcRef.current) return
          pcRef.current?.close()
          sessionIdRef.current = d.sessionId
          const pc = createPeerConnection(
            (stream) => {
              setReceivedStream(stream)
              setIsReceiving(true)
              onStreamReceived?.(stream)
            },
            (candidate) => {
              if (sessionIdRef.current === d.sessionId) {
                postToChannel({ type: 'screen-share-ice', sessionId: d.sessionId, candidate: candidate.toJSON() })
                const src = e.source as Window
                src?.postMessage({ type: 'screen-share-ice', sessionId: d.sessionId, candidate: candidate.toJSON() }, window.location.origin)
              }
            }
          )
          pcRef.current = pc
          pc.setRemoteDescription(new RTCSessionDescription(d.sdp)).then(() => {
            return pc.createAnswer()
          }).then((answer) => {
            return pc.setLocalDescription(answer)
          }).then(() => {
            const payload = { type: 'screen-share-answer', sessionId: d.sessionId, sdp: pc.localDescription?.toJSON() }
            postToChannel(payload)
            const src = e.source as Window
            src?.postMessage(payload, window.location.origin)
          })
        } else if (d.type === 'screen-share-ice' && d.sessionId === sessionIdRef.current && d.candidate) {
          pcRef.current?.addIceCandidate(new RTCIceCandidate(d.candidate))
        }
      }

      if (role === 'teacher') {
        if (d.type === 'screen-share-answer' && d.sessionId === sessionIdRef.current && d.sdp) {
          pcRef.current?.setRemoteDescription(new RTCSessionDescription(d.sdp))
        } else if (d.type === 'screen-share-ice' && d.sessionId === sessionIdRef.current && d.candidate) {
          pcRef.current?.addIceCandidate(new RTCIceCandidate(d.candidate))
        }
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [role, postToChannel, onStreamReceived, onStreamEnded])

  return {
    isSharing,
    isReceiving,
    error,
    startShare,
    stopShare,
    receivedStream,
  }
}
