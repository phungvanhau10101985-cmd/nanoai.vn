import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { redisDel, redisGet, redisSetEx } from '@/lib/cache/redis'

/** Giữ Redis lâu. Màn đóng hoặc bị ẩn không xóa phiên của các màn còn lại. */
const STORE_TTL_SEC = 30 * 24 * 60 * 60
const MAX_COMMANDS = 250
const MAX_SNAPSHOT_CHARS = 1_500_000

export type PhoneRemoteCommand = Record<string, unknown>

type PhoneRemoteRow = {
  userId: string
  email: string
  secretHash: string
  snapshot: Record<string, unknown>
  index: number
  /** Tăng mỗi lần một màn đang hiện đổi slide. Bản ghi cũ hơn bị bỏ. */
  indexGen: number
  revision: number
  /** Chỉ tăng khi bảng trắng đổi. Bản slide không kéo lại nút chạy đã tắt. */
  whiteboardGen: number
  commands: Array<{ n: number; msg: PhoneRemoteCommand }>
  nextN: number
  expiresAt: number
  /** Đã đóng slide học sinh. */
  closed?: boolean
  /** Mốc xóa sau khi slide học sinh đóng. Heartbeat mới sẽ hủy mốc này. */
  closingAt?: number | null
  /** Điện thoại đã tải xong giao diện giáo viên. */
  phoneReady?: boolean
}

type StoreBag = {
  rows: Map<string, PhoneRemoteRow>
  tails: Map<string, Promise<unknown>>
}

function bag(): StoreBag {
  const g = globalThis as typeof globalThis & { __nanoPhoneRemote?: StoreBag }
  if (!g.__nanoPhoneRemote) g.__nanoPhoneRemote = { rows: new Map(), tails: new Map() }
  return g.__nanoPhoneRemote
}

function phoneKey(id: string): string {
  return `gtr:phone-remote:${id}`
}

function isClosed(row: PhoneRemoteRow, now = Date.now()): boolean {
  if (row.closed) return true
  return typeof row.closingAt === 'number' && row.closingAt > 0 && now >= row.closingAt
}

function hashSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex')
}

function secretMatches(secret: string, secretHash: string): boolean {
  const a = Buffer.from(hashSecret(secret))
  const b = Buffer.from(secretHash)
  return a.length === b.length && timingSafeEqual(a, b)
}

export function splitPhoneLoginKey(raw: string): { id: string; secret: string } | null {
  const key = raw.trim()
  const dot = key.indexOf('.')
  if (dot <= 0 || dot >= key.length - 1) return null
  const id = key.slice(0, dot)
  const secret = key.slice(dot + 1)
  if (!/^[A-Za-z0-9_-]{6,40}$/.test(id)) return null
  if (!/^[A-Za-z0-9_-]{16,80}$/.test(secret)) return null
  return { id, secret }
}

/** Gộp chuột di chuyển liên tiếp, bỏ lệnh không phải object. */
export function collapsePhoneCommands(list: PhoneRemoteCommand[]): PhoneRemoteCommand[] {
  const out: PhoneRemoteCommand[] = []
  for (const msg of list) {
    if (!msg || typeof msg !== 'object' || Array.isArray(msg)) continue
    const type = typeof msg.type === 'string' ? msg.type : ''
    if (!/^[a-z0-9-]{1,80}$/.test(type)) continue
    const clean: PhoneRemoteCommand = {}
    for (const [k, v] of Object.entries(msg)) {
      if (k.startsWith('__')) continue
      clean[k] = v
    }
    const prev = out.length > 0 ? out[out.length - 1] : null
    const sameType = Boolean(prev && prev.type === type)
    const collapseMove = type === 'mouse-pos' || type === 'chain-pane-scroll'
    const collapseTyping =
      type === 'worksheet-answer-reveal' &&
      sameType &&
      (prev?.control === true) === (clean.control === true)
    const collapseTimer = type === 'teacher-timer-sync' && sameType
    const collapseSim = type === 'whiteboard-sim' && sameType
    const collapseDrawSync = type === 'infographic-draw-sync' && sameType
    const prevPoints = Array.isArray(prev?.points) ? prev.points as unknown[] : []
    const nextPoints = Array.isArray(clean.points) ? clean.points as unknown[] : []
    const collapseDrawPoints = type === 'infographic-draw-points'
      && sameType
      && prev?.strokeId === clean.strokeId
      && prev?.slideIndex === clean.slideIndex
      && prevPoints.length + nextPoints.length <= 300
    if (collapseDrawPoints && prev) {
      out[out.length - 1] = { ...clean, points: [...prevPoints, ...nextPoints] }
      continue
    }
    if (sameType && (collapseMove || collapseTyping || collapseTimer || collapseDrawSync || collapseSim)) {
      out[out.length - 1] = clean
      continue
    }
    out.push(clean)
  }
  return out.slice(-40)
}

async function persist(id: string, row: PhoneRemoteRow) {
  bag().rows.set(id, row)
  await redisSetEx(phoneKey(id), STORE_TTL_SEC, JSON.stringify(row))
}

async function forget(id: string) {
  bag().rows.delete(id)
  await redisDel(phoneKey(id))
}

async function load(id: string): Promise<PhoneRemoteRow | null> {
  const hit = bag().rows.get(id)
  if (hit) {
    if (isClosed(hit)) {
      await forget(id)
      return null
    }
    return hit
  }
  const raw = await redisGet(phoneKey(id))
  if (!raw) return null
  try {
    const row = JSON.parse(raw) as PhoneRemoteRow
    if (!row || typeof row.userId !== 'string' || isClosed(row)) {
      await forget(id)
      return null
    }
    if (!Array.isArray(row.commands)) row.commands = []
    bag().rows.set(id, row)
    return row
  } catch {
    return null
  }
}

function runLocked<T>(id: string, fn: () => Promise<T>): Promise<T> {
  const tails = bag().tails
  const prev = tails.get(id) ?? Promise.resolve()
  const next = prev.then(fn, fn)
  tails.set(id, next.then(() => undefined, () => undefined))
  return next
}

export async function createPhoneRemoteSession(input: {
  userId: string
  email: string
  snapshot: Record<string, unknown>
  index: number
}): Promise<{ id: string; secret: string } | { error: 'too_large' }> {
  const snapshotText = JSON.stringify(input.snapshot)
  if (snapshotText.length > MAX_SNAPSHOT_CHARS) return { error: 'too_large' }
  const id = randomBytes(9).toString('base64url')
  const secret = randomBytes(24).toString('base64url')
  const row: PhoneRemoteRow = {
    userId: input.userId,
    email: input.email,
    secretHash: hashSecret(secret),
    snapshot: input.snapshot,
    index: Math.max(0, Math.floor(input.index) || 0),
    indexGen: 1,
    revision: 1,
    whiteboardGen: 0,
    commands: [],
    nextN: 1,
    expiresAt: Date.now() + STORE_TTL_SEC * 1000,
    closed: false,
    closingAt: null,
    phoneReady: false,
  }
  await persist(id, row)
  return { id, secret }
}

export async function redeemPhoneRemoteLogin(rawKey: string): Promise<{ id: string; userId: string; email: string; snapshot: Record<string, unknown> } | null> {
  const parsed = splitPhoneLoginKey(rawKey)
  if (!parsed) return null
  const row = await load(parsed.id)
  if (!row || !secretMatches(parsed.secret, row.secretHash)) return null
  return { id: parsed.id, userId: row.userId, email: row.email, snapshot: row.snapshot }
}

function phoneQueryToken(value: unknown): string {
  if (typeof value !== 'string') return ''
  const trimmed = value.trim()
  return /^[A-Za-z0-9_-]{1,80}$/.test(trimmed) ? trimmed : ''
}

/** Điện thoại mở đúng màn giáo viên của phiên. Giáo trình giữ đường cũ. */
export function phoneTeacherReturnPath(snapshot: Record<string, unknown> | null | undefined, phoneId: string): string {
  const params = new URLSearchParams()
  params.set('phone', phoneId)
  const surface = snapshot && typeof snapshot.phoneSurface === 'string' ? snapshot.phoneSurface : ''
  const worksheetId = phoneQueryToken(snapshot?.worksheetId)
  const examCode = phoneQueryToken(snapshot?.examCode).toUpperCase()
  if (surface === 'exam' && examCode) params.set('examCode', examCode)
  else if (surface === 'worksheet' && worksheetId) params.set('worksheetId', worksheetId)
  return `/giao-trinh/giao-vien?${params.toString()}`
}

export async function readPhoneRemoteForUser(id: string, userId: string): Promise<PhoneRemoteRow | null> {
  if (!/^[A-Za-z0-9_-]{6,40}$/.test(id)) return null
  const row = await load(id)
  if (!row || row.userId !== userId) return null
  return row
}

export async function updatePhoneRemoteFromDesktop(input: {
  id: string
  userId: string
  index?: number
  /** Thế hệ slide mà màn này đã thấy. Khác thế hệ trên server thì bỏ, tránh ghi đè slide mới. */
  seenGen?: number
  snapshot?: Record<string, unknown>
  seenRevision?: number
  /** Thế hệ bảng trắng đã thấy. Bản slide làm tăng revision không được chặn lần tắt chạy. */
  seenWhiteboardGen?: number
  /** Chỉ bảng trắng. Không ghi đè slide. Bản slide cũng không ghi đè bảng đã có. */
  whiteboard?: Record<string, unknown>
  phoneReady?: boolean
}): Promise<{ index: number; indexGen: number; revision: number; whiteboardGen: number; whiteboardApplied: boolean } | null> {
  return runLocked(input.id, async () => {
    const row = await load(input.id)
    if (!row || row.userId !== input.userId) return null
    if (typeof row.indexGen !== 'number') row.indexGen = 0
    if (typeof row.whiteboardGen !== 'number') row.whiteboardGen = 0
    let changed = false
    let whiteboardApplied = false
    if (input.snapshot && typeof input.seenRevision === 'number' && input.seenRevision === row.revision) {
      const prevWb = row.snapshot && typeof row.snapshot.whiteboard === 'object' && row.snapshot.whiteboard
        ? row.snapshot.whiteboard as Record<string, unknown>
        : null
      const nextSnap = prevWb ? { ...input.snapshot, whiteboard: prevWb } : input.snapshot
      const text = JSON.stringify(nextSnap)
      if (text.length > MAX_SNAPSHOT_CHARS) return null
      row.snapshot = nextSnap
      row.revision += 1
      changed = true
    }
    const boardMatches = typeof input.seenWhiteboardGen === 'number'
      ? input.seenWhiteboardGen === row.whiteboardGen
      : typeof input.seenRevision === 'number' && input.seenRevision === row.revision
    if (input.whiteboard && boardMatches) {
      const prev = row.snapshot && typeof row.snapshot === 'object' ? row.snapshot : {}
      const nextSnap = { ...prev, whiteboard: input.whiteboard }
      const text = JSON.stringify(nextSnap)
      if (text.length > MAX_SNAPSHOT_CHARS) return null
      row.snapshot = nextSnap
      row.revision += 1
      row.whiteboardGen += 1
      whiteboardApplied = true
      changed = true
    }
    if (typeof input.index === 'number' && Number.isFinite(input.index) && input.seenGen === row.indexGen) {
      row.index = Math.max(0, Math.floor(input.index))
      row.indexGen += 1
      changed = true
    }
    if (input.phoneReady) {
      row.phoneReady = true
      changed = true
    }
    if (changed) await persist(input.id, row)
    return { index: row.index, indexGen: row.indexGen, revision: row.revision, whiteboardGen: row.whiteboardGen, whiteboardApplied }
  })
}

export async function pushPhoneRemoteCommands(input: {
  id: string
  userId: string
  commands: PhoneRemoteCommand[]
}): Promise<number> {
  const batch = collapsePhoneCommands(input.commands)
  if (batch.length === 0) return 0
  return runLocked(input.id, async () => {
    const row = await load(input.id)
    if (!row || row.userId !== input.userId) return 0
    for (const msg of batch) {
      const last = row.commands[row.commands.length - 1]
      if (last && last.msg.type === 'whiteboard-sim' && msg.type === 'whiteboard-sim') {
        last.msg = msg
        last.n = row.nextN
        row.nextN += 1
        continue
      }
      row.commands.push({ n: row.nextN, msg })
      row.nextN += 1
      if (msg.type === 'slide-go' && typeof msg.index === 'number' && Number.isFinite(msg.index)) {
        row.index = Math.max(0, Math.floor(msg.index))
        row.indexGen = (typeof row.indexGen === 'number' ? row.indexGen : 0) + 1
      }
    }
    if (row.commands.length > MAX_COMMANDS) {
      row.commands = row.commands.slice(row.commands.length - MAX_COMMANDS)
    }
    await persist(input.id, row)
    return batch.length
  })
}

/** Màn đóng hoặc bị ẩn không được xóa phiên của hai màn còn lại. */
export async function setPhoneRemoteStudentOpen(input: { id: string; userId: string; alive: boolean }): Promise<boolean> {
  return runLocked(input.id, async () => {
    const row = await load(input.id)
    if (!row || row.userId !== input.userId) return false
    if (input.alive) {
      row.closingAt = null
      row.closed = false
      await persist(input.id, row)
    }
    return true
  })
}

export async function pullPhoneRemoteCommands(input: {
  id: string
  userId: string
  after: number
}): Promise<Array<{ n: number; msg: PhoneRemoteCommand }> | null> {
  const row = await load(input.id)
  if (!row || row.userId !== input.userId) return null
  const after = Number.isFinite(input.after) ? input.after : 0
  return row.commands.filter((c) => c.n > after).slice(0, 40)
}
