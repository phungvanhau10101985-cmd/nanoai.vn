'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { applyRemoteWhiteboard } from '../components/teacher-whiteboard-canvas'
import { createPhoneCommandQueue, phoneOpenableUrl } from '../lib/phone-remote-client'
import {
  emptyWhiteboardState,
  isWhiteboardWireType,
  sanitizeWhiteboardCamera,
  sanitizeWhiteboardObjects,
  type WhiteboardState,
} from '../lib/teacher-whiteboard'

const PHONE_STORAGE_KEY = 'nano-teacher-phone-remote-review'

type Tr = (vi: string, en: string, zh: string, ja: string, ko: string) => string

export function asBoolRecord(value: unknown): Record<string, boolean> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const out: Record<string, boolean> = {}
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === 'boolean') out[k] = v
  }
  return out
}

export function asNumberRecord(value: unknown): Record<string, number> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const out: Record<string, number> = {}
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = v
  }
  return out
}

export function mergeReviewTypingReveal(
  prev: Record<string, number>,
  incoming: Record<string, number>,
  exact: boolean,
): Record<string, number> {
  if (exact) return { ...incoming }
  if (Object.keys(incoming).length === 0) return prev
  const next = { ...prev }
  for (const key of Object.keys(incoming)) {
    next[key] = Math.max(prev[key] ?? 0, incoming[key] ?? 0)
  }
  return next
}

export function isReviewTypingHeartbeat(msg: Record<string, unknown>): boolean {
  return msg.type === 'worksheet-answer-reveal' && msg.control !== true
}

/** Lệnh phiên chữa bài: học sinh và máy giáo viên kia cùng nhận. */
export function reviewSessionReachesOtherTeacher(type: string): boolean {
  return type.startsWith('whiteboard-') || (
    type === 'slide-go' ||
    type === 'set-auto-play' ||
    type === 'set-auto-play-interval' ||
    type === 'teacher-timer-start' ||
    type === 'teacher-timer-stop' ||
    type === 'teacher-timer-reset' ||
    type === 'teacher-timer-sync' ||
    type === 'sand-timer-start' ||
    type === 'student-curriculum-left-pane' ||
    type === 'worksheet-answer-reveal' ||
    type === 'visual-fullscreen-open' ||
    type === 'visual-fullscreen-close' ||
    type === 'quiz-popup-open' ||
    type === 'quiz-session-reset-slide' ||
    type === 'mouse-pos' ||
    type === 'mouse-click' ||
    type === 'chain-pane-scroll' ||
    type === 'answer-card-show' ||
    type === 'phone-remote-bind'
  )
}

type SlideHold = { index: number; until: number }

/**
 * Phiên điện thoại + bảng trắng cho slide chữa bài tập và chữa bài thi.
 * Máy vừa thao tác là máy chủ. Máy kia và màn học sinh áp lệnh đó.
 */
export function useReviewSlidePhoneBoard(input: {
  phoneFollowerId: string
  tr: Tr
  deliverRef: { current: (msg: Record<string, unknown>) => void }
  applyRef: { current: (msg: Record<string, unknown>) => void }
  snapshotRef: { current: () => Record<string, unknown> }
  onSnapshotRef: { current: (snap: Record<string, unknown>, index: number, takeBoard: boolean) => void }
  onIndexRef: { current: (index: number) => void }
  snapshotKey: string
}) {
  const { phoneFollowerId, tr, deliverRef, applyRef, snapshotRef, onSnapshotRef, onIndexRef, snapshotKey } = input
  const clientIdRef = useRef(`review-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`)
  const [phoneRemoteOpen, setPhoneRemoteOpen] = useState(false)
  const [phoneSessionId, setPhoneSessionId] = useState<string | null>(null)
  const phoneSessionIdRef = useRef(phoneSessionId)
  phoneSessionIdRef.current = phoneSessionId
  const phoneFollowerIdRef = useRef(phoneFollowerId)
  phoneFollowerIdRef.current = phoneFollowerId
  const [phoneLoginUrl, setPhoneLoginUrl] = useState<string | null>(null)
  const [phoneRemoteBusy, setPhoneRemoteBusy] = useState(false)
  const [phoneRemoteError, setPhoneRemoteError] = useState('')
  const phoneQueueRef = useRef<ReturnType<typeof createPhoneCommandQueue> | null>(null)
  const [whiteboardState, setWhiteboardState] = useState<WhiteboardState>(() => emptyWhiteboardState())
  const whiteboardStateRef = useRef(whiteboardState)
  whiteboardStateRef.current = whiteboardState
  const whiteboardRemoteApplyRef = useRef(false)
  const whiteboardDirtyRef = useRef(false)
  const whiteboardPostSigRef = useRef('')
  const whiteboardLinkReadyRef = useRef(false)
  const [whiteboardLinkReady, setWhiteboardLinkReady] = useState(false)
  const [whiteboardSyncTick, setWhiteboardSyncTick] = useState(0)
  const seenRevisionRef = useRef(0)
  const seenGenRef = useRef(0)
  const seenWhiteboardGenRef = useRef(0)
  const applyingSharedRef = useRef(false)
  const slideHoldRef = useRef<SlideHold | null>(null)
  const figureSimHostRef = useRef(!phoneFollowerId)
  const followedFigureSimRef = useRef<number | null>(null)
  const [figureSimHost, setFigureSimHost] = useState(!phoneFollowerId)

  const holdSlide = useCallback((index: number) => {
    slideHoldRef.current = { index, until: Date.now() + 900 }
  }, [])

  const indexBlocked = useCallback((index: number) => {
    const held = slideHoldRef.current
    return Boolean(held && Date.now() < held.until && index !== held.index)
  }, [])

  const markApplyingShared = useCallback(() => {
    applyingSharedRef.current = true
  }, [])

  const commitWhiteboard = useCallback((next: WhiteboardState) => {
    whiteboardStateRef.current = next
    if (!whiteboardRemoteApplyRef.current && whiteboardLinkReadyRef.current) whiteboardDirtyRef.current = true
    setWhiteboardState(next)
  }, [])

  const applyRemoteBoard = useCallback((msg: Record<string, unknown>) => {
    if (msg.type === 'whiteboard-sync' && whiteboardDirtyRef.current) return
    whiteboardRemoteApplyRef.current = true
    const next = applyRemoteWhiteboard(whiteboardStateRef.current, msg)
    if (!whiteboardDirtyRef.current) {
      try {
        whiteboardPostSigRef.current = JSON.stringify({
          objects: next.objects,
          camera: next.camera,
          grid: next.grid,
        })
      } catch {
        whiteboardPostSigRef.current = ''
      }
    }
    commitWhiteboard(next)
  }, [commitWhiteboard])

  const applySharedWhiteboard = useCallback((raw: unknown) => {
    if (whiteboardDirtyRef.current) return
    if (!raw || typeof raw !== 'object') return
    const src = raw as { objects?: unknown; camera?: unknown; grid?: unknown }
    const objects = sanitizeWhiteboardObjects(src.objects)
    const camera = sanitizeWhiteboardCamera(src.camera)
    const grid = typeof src.grid === 'boolean' ? src.grid : whiteboardStateRef.current.grid
    let sig = ''
    try {
      sig = JSON.stringify({ objects, camera, grid })
    } catch {
      return
    }
    if (sig === whiteboardPostSigRef.current) return
    whiteboardRemoteApplyRef.current = true
    whiteboardPostSigRef.current = sig
    commitWhiteboard({
      ...whiteboardStateRef.current,
      objects,
      camera,
      grid,
      draft: whiteboardStateRef.current.draft,
    })
  }, [commitWhiteboard])

  const boardSnapshot = useCallback(() => {
    const live = whiteboardStateRef.current
    return { objects: live.objects, camera: live.camera, grid: live.grid }
  }, [])

  const routeOutgoing = useCallback((msg: Record<string, unknown>) => {
    const payload: Record<string, unknown> = {
      ...msg,
      typingSource: typeof msg.typingSource === 'string' && msg.typingSource ? msg.typingSource : clientIdRef.current,
    }
    if (phoneFollowerIdRef.current) {
      phoneQueueRef.current?.push(payload)
      return
    }
    deliverRef.current(payload)
    const type = typeof payload.type === 'string' ? payload.type : ''
    if (phoneSessionIdRef.current && reviewSessionReachesOtherTeacher(type)) {
      phoneQueueRef.current?.push(payload)
    }
  }, [deliverRef])

  const queueOtherTeacher = useCallback((msg: Record<string, unknown>) => {
    if (!phoneSessionIdRef.current && !phoneFollowerIdRef.current) return
    phoneQueueRef.current?.push({
      ...msg,
      typingSource: clientIdRef.current,
    })
  }, [])

  const claimFigureSim = useCallback(() => {
    figureSimHostRef.current = true
    setFigureSimHost(true)
  }, [])

  const publishFigureSim = useCallback((sim: number) => {
    if (!figureSimHostRef.current) return
    routeOutgoing({ type: 'whiteboard-sim', sim })
  }, [routeOutgoing])

  const followFigureSim = useCallback((sim: number) => {
    figureSimHostRef.current = false
    followedFigureSimRef.current = sim
    setFigureSimHost(false)
  }, [])

  useEffect(() => {
    const id = phoneFollowerId || phoneSessionId
    if (!id) return
    const queue = createPhoneCommandQueue(id)
    phoneQueueRef.current = queue
    return () => {
      queue.stop()
      if (phoneQueueRef.current === queue) phoneQueueRef.current = null
    }
  }, [phoneFollowerId, phoneSessionId])

  useEffect(() => {
    if (phoneFollowerId || typeof window === 'undefined') return
    try {
      const raw = window.sessionStorage.getItem(PHONE_STORAGE_KEY)
      if (!raw) return
      const saved = JSON.parse(raw) as { id?: string; loginUrl?: string }
      if (typeof saved.id === 'string' && /^[A-Za-z0-9_-]{6,40}$/.test(saved.id)) setPhoneSessionId(saved.id)
      if (typeof saved.loginUrl === 'string' && saved.loginUrl.includes('/giao-trinh/dien-thoai?k=')) {
        void phoneOpenableUrl(saved.loginUrl).then((url) => setPhoneLoginUrl(url))
      }
    } catch {
      /* bỏ bản nhớ hỏng */
    }
  }, [phoneFollowerId])

  useEffect(() => {
    if (phoneFollowerId || typeof window === 'undefined' || !phoneSessionId) return
    try {
      window.sessionStorage.setItem(PHONE_STORAGE_KEY, JSON.stringify({
        id: phoneSessionId,
        loginUrl: phoneLoginUrl ?? '',
      }))
    } catch {
      /* tab không lưu được */
    }
  }, [phoneFollowerId, phoneSessionId, phoneLoginUrl])

  useEffect(() => {
    if (!phoneRemoteOpen || phoneLoginUrl || phoneFollowerId) return
    let cancel = false
    setPhoneRemoteBusy(true)
    setPhoneRemoteError('')
    void (async () => {
      try {
        const snap = snapshotRef.current()
        const index = typeof snap.currentIndex === 'number' ? snap.currentIndex : 0
        const res = await fetch('/api/giao-trinh/phone-remote', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ snapshot: snap, index }),
        })
        const data = await res.json().catch(() => null)
        if (cancel) return
        if (!res.ok || !data?.ok || typeof data.id !== 'string' || typeof data.secret !== 'string') {
          setPhoneRemoteError(res.status === 401
            ? tr('Đăng nhập tài khoản giáo viên rồi tạo mã.', 'Sign in as the teacher, then create the code.', '请先登录教师账号再生成二维码。', '教師アカウントでログインしてからコードを作成してください。', '교사 계정으로 로그인한 뒤 코드를 만드세요.')
            : tr('Không tạo được mã.', 'Could not create the code.', '无法生成二维码。', 'コードを作成できません。', '코드를 만들지 못했습니다.'))
          return
        }
        setPhoneSessionId(data.id)
        const loginUrl = await phoneOpenableUrl(`/giao-trinh/dien-thoai?k=${data.id}.${data.secret}`)
        if (cancel) return
        if (!loginUrl.startsWith('https://')) {
          setPhoneRemoteError(tr('Chưa đọc được đường Cloudflare.', 'The Cloudflare tunnel is not available.', '还没读到 Cloudflare 通道。', 'Cloudflare のトンネルを読めません。', 'Cloudflare 터널을 읽지 못했습니다.'))
          return
        }
        setPhoneLoginUrl(loginUrl)
      } catch {
        if (!cancel) {
          setPhoneRemoteError(tr('Không tạo được mã.', 'Could not create the code.', '无法生成二维码。', 'コードを作成できません。', '코드를 만들지 못했습니다.'))
        }
      } finally {
        if (!cancel) setPhoneRemoteBusy(false)
      }
    })()
    return () => { cancel = true }
  }, [phoneRemoteOpen, phoneLoginUrl, phoneFollowerId, tr, snapshotRef])

  useEffect(() => {
    if (!phoneRemoteOpen || !phoneSessionId || phoneFollowerId) return
    let stop = false
    const tick = async () => {
      try {
        const res = await fetch(`/api/giao-trinh/phone-remote?id=${encodeURIComponent(phoneSessionId)}&live=1`, { credentials: 'same-origin' })
        if (!res.ok || stop) return
        const data = await res.json().catch(() => null)
        if (data?.phoneReady) setPhoneRemoteOpen(false)
      } catch {
        /* lần sau */
      }
    }
    void tick()
    const id = window.setInterval(() => { void tick() }, 500)
    return () => {
      stop = true
      window.clearInterval(id)
    }
  }, [phoneRemoteOpen, phoneSessionId, phoneFollowerId])

  useEffect(() => {
    if (!phoneSessionId || phoneFollowerId) return
    const send = () => routeOutgoing({ type: 'phone-remote-bind', id: phoneSessionId })
    send()
    const id = window.setInterval(send, 2000)
    return () => window.clearInterval(id)
  }, [phoneSessionId, phoneFollowerId, routeOutgoing])

  useEffect(() => {
    const remoteId = phoneSessionId || phoneFollowerId
    if (!remoteId) return
    let after = 0
    let stop = false
    let priming = true
    let busy = false
    const primedState = new Map<string, Record<string, unknown>>()
    let primedSlide: Record<string, unknown> | null = null
    const remember = (record: Record<string, unknown>) => {
      const commandType = typeof record.type === 'string' ? record.type : ''
      const key = commandType.startsWith('teacher-timer-') ? 'teacher-timer' : commandType
      if (
        key === 'teacher-timer' ||
        key === 'set-auto-play' ||
        key === 'set-auto-play-interval' ||
        key === 'student-curriculum-left-pane' ||
        key === 'answer-card-show'
      ) primedState.set(key, record)
    }
    const tick = async () => {
      if (busy || stop) return
      busy = true
      try {
        const res = await fetch(`/api/giao-trinh/phone-remote/command?id=${encodeURIComponent(remoteId)}&after=${after}`, { credentials: 'same-origin' })
        if (!res.ok) return
        const data = await res.json().catch(() => null)
        const list = Array.isArray(data?.commands) ? data.commands : []
        let lastSlide: Record<string, unknown> | null = null
        let lastTyping: Record<string, unknown> | null = null
        let lastTypingControl: Record<string, unknown> | null = null
        const fresh: Record<string, unknown>[] = []
        for (const item of list) {
          if (stop || !item || typeof item !== 'object') continue
          const n = Number((item as { n?: unknown }).n)
          if (Number.isFinite(n)) after = Math.max(after, n)
          const msg = (item as { msg?: unknown }).msg
          if (!msg || typeof msg !== 'object' || Array.isArray(msg)) continue
          const record = msg as Record<string, unknown>
          if (record.type === 'slide-go' && typeof record.index === 'number') lastSlide = record
          else if (record.type === 'worksheet-answer-reveal' && record.control === true) lastTypingControl = record
          else if (record.type === 'worksheet-answer-reveal') lastTyping = record
          else fresh.push(record)
        }
        const boardMsgs: Record<string, unknown>[] = []
        const restMsgs: Record<string, unknown>[] = []
        for (const msg of fresh) {
          const freshType = typeof msg.type === 'string' ? msg.type : ''
          if (isWhiteboardWireType(freshType) || freshType === 'whiteboard-sim') boardMsgs.push(msg)
          else restMsgs.push(msg)
        }
        for (const msg of boardMsgs) applyRef.current(msg)
        if (priming) {
          for (const msg of restMsgs) remember(msg)
          if (lastSlide) primedSlide = lastSlide
          if (list.length >= 40) return
          priming = false
          for (const msg of primedState.values()) applyRef.current(msg)
          if (primedSlide) applyRef.current(primedSlide)
          if (lastTyping) applyRef.current(lastTyping)
          if (lastTypingControl) applyRef.current(lastTypingControl)
          return
        }
        for (const msg of restMsgs) applyRef.current(msg)
        if (lastSlide) applyRef.current(lastSlide)
        if (lastTyping) applyRef.current(lastTyping)
        if (lastTypingControl) applyRef.current(lastTypingControl)
      } catch {
        /* mạng chập chờn */
      } finally {
        busy = false
      }
    }
    void tick()
    const id = window.setInterval(() => { void tick() }, 280)
    return () => {
      stop = true
      window.clearInterval(id)
    }
  }, [phoneSessionId, phoneFollowerId, applyRef])

  useEffect(() => {
    if (phoneFollowerId) return
    const id = phoneSessionId
    if (!id) return
    if (applyingSharedRef.current) {
      applyingSharedRef.current = false
      return
    }
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
    const handle = window.setTimeout(() => {
      void fetch('/api/giao-trinh/phone-remote', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          id,
          snapshot: snapshotRef.current(),
          seenRevision: seenRevisionRef.current,
          index: Number((snapshotRef.current().currentIndex as number) ?? 0),
          seenGen: seenGenRef.current,
        }),
      }).then(async (res) => {
        const data = await res.json().catch(() => null)
        if (!data?.ok) return
        if (typeof data.revision === 'number') seenRevisionRef.current = data.revision
        const gen = typeof data.indexGen === 'number' ? data.indexGen : 0
        if (gen > seenGenRef.current && typeof data.index === 'number') {
          if (indexBlocked(data.index)) return
          seenGenRef.current = gen
          applyingSharedRef.current = true
          onIndexRef.current(data.index)
        }
      }).catch(() => { /* lần sau */ })
    }, 500)
    return () => window.clearTimeout(handle)
  }, [phoneFollowerId, phoneSessionId, snapshotKey, snapshotRef, onIndexRef, indexBlocked])

  useEffect(() => {
    if (phoneFollowerId || !phoneSessionId) return
    let cancel = false
    const pull = async () => {
      try {
        const res = await fetch(`/api/giao-trinh/phone-remote?id=${encodeURIComponent(phoneSessionId)}&live=1`, { credentials: 'same-origin' })
        if (!res.ok || cancel) {
          if (!cancel && res.status === 404) {
            try { window.sessionStorage.removeItem(PHONE_STORAGE_KEY) } catch { /* ignore */ }
            setPhoneSessionId(null)
            setPhoneLoginUrl(null)
          }
          return
        }
        const data = await res.json().catch(() => null)
        if (!data?.ok || cancel) return
        const gen = typeof data.indexGen === 'number' ? data.indexGen : 0
        const revision = typeof data.revision === 'number' ? data.revision : 0
        const whiteboardGen = typeof data.whiteboardGen === 'number' ? data.whiteboardGen : 0
        if (typeof data.index === 'number' && gen > seenGenRef.current && !indexBlocked(data.index)) {
          seenGenRef.current = gen
          applyingSharedRef.current = true
          onIndexRef.current(data.index)
        }
        if (revision > seenRevisionRef.current || whiteboardGen > seenWhiteboardGenRef.current) {
          const full = await fetch(`/api/giao-trinh/phone-remote?id=${encodeURIComponent(phoneSessionId)}`, { credentials: 'same-origin' })
          const body = await full.json().catch(() => null)
          if (cancel || !body?.ok || !body.snapshot) return
          seenRevisionRef.current = typeof body.revision === 'number' ? body.revision : revision
          const bodyGen = typeof body.indexGen === 'number' ? body.indexGen : seenGenRef.current
          if (bodyGen > seenGenRef.current) seenGenRef.current = bodyGen
          const incomingBoardGen = typeof body.whiteboardGen === 'number' ? body.whiteboardGen : whiteboardGen
          if (incomingBoardGen > seenWhiteboardGenRef.current) {
            seenWhiteboardGenRef.current = incomingBoardGen
            applySharedWhiteboard((body.snapshot as { whiteboard?: unknown }).whiteboard)
          }
          whiteboardLinkReadyRef.current = true
          setWhiteboardLinkReady(true)
        } else {
          whiteboardLinkReadyRef.current = true
          setWhiteboardLinkReady(true)
        }
      } catch {
        /* lần sau */
      }
    }
    void pull()
    const id = window.setInterval(() => { void pull() }, 700)
    return () => {
      cancel = true
      window.clearInterval(id)
    }
  }, [phoneSessionId, phoneFollowerId, applySharedWhiteboard, indexBlocked, onIndexRef])

  useEffect(() => {
    whiteboardLinkReadyRef.current = false
    whiteboardDirtyRef.current = false
    whiteboardPostSigRef.current = ''
    seenWhiteboardGenRef.current = 0
    whiteboardRemoteApplyRef.current = false
    setWhiteboardLinkReady(false)
  }, [phoneSessionId, phoneFollowerId])

  useEffect(() => {
    const remoteId = phoneSessionId || phoneFollowerId
    if (!remoteId || !whiteboardLinkReady) return
    if (whiteboardRemoteApplyRef.current) {
      whiteboardRemoteApplyRef.current = false
      if (!whiteboardDirtyRef.current) return
    }
    if (!whiteboardDirtyRef.current) return
    const liveNow = whiteboardStateRef.current
    let sig = ''
    try {
      sig = JSON.stringify({ objects: liveNow.objects, camera: liveNow.camera, grid: liveNow.grid })
    } catch {
      return
    }
    if (sig === whiteboardPostSigRef.current) return
    let cancel = false
    const handle = window.setTimeout(() => {
      const live = whiteboardStateRef.current
      const body = { objects: live.objects, camera: live.camera, grid: live.grid }
      let liveSig = ''
      try { liveSig = JSON.stringify(body) } catch { return }
      void fetch('/api/giao-trinh/phone-remote', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        keepalive: true,
        body: JSON.stringify({
          id: remoteId,
          whiteboard: body,
          seenRevision: seenRevisionRef.current,
          seenWhiteboardGen: seenWhiteboardGenRef.current,
        }),
      }).then(async (res) => {
        if (cancel) return
        const data = await res.json().catch(() => null)
        if (!data?.ok) return
        if (data.whiteboardApplied === true) {
          if (typeof data.revision === 'number') seenRevisionRef.current = data.revision
          if (typeof data.whiteboardGen === 'number') seenWhiteboardGenRef.current = data.whiteboardGen
          whiteboardPostSigRef.current = liveSig
          whiteboardDirtyRef.current = false
          return
        }
        if (typeof data.revision === 'number' && data.revision > seenRevisionRef.current) {
          seenRevisionRef.current = data.revision
          setWhiteboardSyncTick((n) => n + 1)
        }
      }).catch(() => { /* lần sau */ })
    }, 220)
    return () => {
      cancel = true
      window.clearTimeout(handle)
    }
  }, [phoneSessionId, phoneFollowerId, whiteboardLinkReady, whiteboardSyncTick, whiteboardState])

  useEffect(() => {
    if (!phoneFollowerId) return
    let cancel = false
    const revisionRef = { current: 0 }
    const load = async (live: boolean) => {
      const res = await fetch(
        `/api/giao-trinh/phone-remote?id=${encodeURIComponent(phoneFollowerId)}${live ? '&live=1' : ''}`,
        { credentials: 'same-origin' },
      )
      if (!res.ok) {
        if (!live && !cancel) {
          setPhoneRemoteError(tr(
            'Không mở được bảng điều khiển. Quét lại mã trên máy giáo viên.',
            'Could not open the remote. Scan the code on the teacher computer again.',
            '无法打开操控页。请在教师电脑上重新扫码。',
            '操作画面を開けません。教師のパソコンでコードを読み直してください。',
            '조작 화면을 열 수 없습니다. 교사 컴퓨터에서 코드를 다시 스캔하세요.',
          ))
        }
        return
      }
      const data = await res.json().catch(() => null)
      if (cancel || !data?.ok) return
      setPhoneRemoteError('')
      if (!live && data.snapshot && typeof data.snapshot === 'object') {
        const gen = Number(data.indexGen) || 0
        const rawIndex = Number(data.index) || 0
        const snapIndex = gen < seenGenRef.current || indexBlocked(rawIndex) ? rawIndex : rawIndex
        if (gen > seenGenRef.current && !indexBlocked(rawIndex)) seenGenRef.current = gen
        const firstLoad = revisionRef.current === 0
        revisionRef.current = Number(data.revision) || 1
        seenRevisionRef.current = revisionRef.current
        const boardGen = Number(data.whiteboardGen) || 0
        const takeBoard = firstLoad || boardGen > seenWhiteboardGenRef.current
        if (boardGen > seenWhiteboardGenRef.current) seenWhiteboardGenRef.current = boardGen
        onSnapshotRef.current(data.snapshot as Record<string, unknown>, snapIndex, takeBoard)
        if (takeBoard) applySharedWhiteboard((data.snapshot as { whiteboard?: unknown }).whiteboard)
        whiteboardLinkReadyRef.current = true
        setWhiteboardLinkReady(true)
        window.requestAnimationFrame(() => {
          void fetch('/api/giao-trinh/phone-remote', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ id: phoneFollowerId, phoneReady: true }),
          })
        })
        return
      }
      if (
        live && revisionRef.current > 0 && (
          (typeof data.revision === 'number' && data.revision !== revisionRef.current) ||
          (typeof data.whiteboardGen === 'number' && data.whiteboardGen > seenWhiteboardGenRef.current)
        )
      ) {
        revisionRef.current = typeof data.revision === 'number' ? data.revision : revisionRef.current
        void load(false)
        return
      }
      if (live && typeof data.indexGen === 'number' && data.indexGen > seenGenRef.current && typeof data.index === 'number' && !indexBlocked(data.index)) {
        seenGenRef.current = data.indexGen
        markApplyingShared()
        onIndexRef.current(data.index)
      }
    }
    void load(false)
    const id = window.setInterval(() => { void load(true) }, 700)
    return () => {
      cancel = true
      window.clearInterval(id)
    }
  }, [phoneFollowerId, tr, onSnapshotRef, onIndexRef, applySharedWhiteboard, indexBlocked, markApplyingShared])

  return {
    clientIdRef,
    phoneRemoteOpen,
    setPhoneRemoteOpen,
    phoneLoginUrl,
    phoneRemoteBusy,
    phoneRemoteError,
    phoneSessionId,
    phoneSessionIdRef,
    whiteboardState,
    whiteboardStateRef,
    commitWhiteboard,
    applyRemoteBoard,
    boardSnapshot,
    routeOutgoing,
    queueOtherTeacher,
    holdSlide,
    markApplyingShared,
    figureSimHost,
    figureSimHostRef,
    followedFigureSimRef,
    claimFigureSim,
    publishFigureSim,
    followFigureSim,
  }
}
