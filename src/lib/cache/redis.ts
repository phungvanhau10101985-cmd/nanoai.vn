import Redis from 'ioredis'

let client: Redis | null | undefined
let redisSkipUntil = 0
/** After a real Redis failure, skip Redis long enough that the next page does not pay another miss. */
const REDIS_DOWN_COOLDOWN_MS = 20_000
/**
 * Redis answers GET in ~10µs on the VPS. A 200ms budget fired on tiny `:ver` keys
 * whenever the Node event loop stalled, then the cooldown sent every page to Postgres.
 */
export const REDIS_COMMAND_TIMEOUT_MS = 1000
/** Event-loop lag above this means a timeout was ours, not Redis. */
export const REDIS_LOCAL_STALL_MS = 250
const LAG_SAMPLE_MS = 100
const LAG_MEMORY_MS = 5000

let lagTimer: ReturnType<typeof setInterval> | null = null
let lastLagTickAt = 0
let lastStallAt = 0

function startLagSampler(): void {
  if (lagTimer) return
  lastLagTickAt = Date.now()
  lagTimer = setInterval(() => {
    const now = Date.now()
    if (now - lastLagTickAt - LAG_SAMPLE_MS >= REDIS_LOCAL_STALL_MS) lastStallAt = now
    lastLagTickAt = now
  }, LAG_SAMPLE_MS)
  lagTimer.unref?.()
}

function eventLoopStalledRecently(now = Date.now()): boolean {
  if (now - lastLagTickAt - LAG_SAMPLE_MS >= REDIS_LOCAL_STALL_MS) return true
  return lastStallAt > 0 && now - lastStallAt <= LAG_MEMORY_MS
}

function isCommandTimeout(err: unknown): boolean {
  return err instanceof Error && /command timed out/i.test(err.message)
}

/** A timeout during a local stall is not Redis being down; keep using it. */
export function redisFailureTriggersCooldown(err: unknown, localStall: boolean): boolean {
  return !(isCommandTimeout(err) && localStall)
}

function redisCoolingDown(): boolean {
  return Date.now() < redisSkipUntil
}

let lastStallWarnAt = 0

function noteRedisDown(op: string, key: string, err: unknown): void {
  const now = Date.now()
  if (!redisFailureTriggersCooldown(err, eventLoopStalledRecently(now))) {
    if (now - lastStallWarnAt < 60_000) return
    lastStallWarnAt = now
    console.warn('[redis]', op, 'timed out during a Node event-loop stall, Redis kept on', key)
    return
  }
  const fresh = now >= redisSkipUntil
  redisSkipUntil = now + REDIS_DOWN_COOLDOWN_MS
  if (!fresh) return
  console.warn('[redis]', op, 'failed', key, err instanceof Error ? err.message : err)
}

function redisUrl(): string {
  return String(process.env.REDIS_URL ?? '').trim()
}

/** Fail-open: no REDIS_URL or connect error → callers use Postgres only. */
export function getRedis(): Redis | null {
  if (client !== undefined) return client
  const url = redisUrl()
  if (!url) {
    client = null
    return null
  }
  try {
    const redis = new Redis(url, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      connectTimeout: 250,
      commandTimeout: REDIS_COMMAND_TIMEOUT_MS,
    })
    startLagSampler()
    redis.on('error', (err) => {
      noteRedisDown('client', 'redis', err)
    })
    client = redis
    return redis
  } catch (e) {
    console.warn('[redis] init failed', e)
    client = null
    return null
  }
}

export function isRedisConfigured(): boolean {
  return Boolean(redisUrl())
}

export async function redisGet(key: string): Promise<string | null> {
  if (redisCoolingDown()) return null
  const redis = getRedis()
  if (!redis) return null
  try {
    if (redis.status === 'wait') await redis.connect()
    return await redis.get(key)
  } catch (e) {
    noteRedisDown('get', key, e)
    return null
  }
}

export async function redisSetEx(key: string, ttlSec: number, value: string): Promise<void> {
  if (redisCoolingDown()) return
  const redis = getRedis()
  if (!redis) return
  try {
    if (redis.status === 'wait') await redis.connect()
    await redis.set(key, value, 'EX', Math.max(1, Math.floor(ttlSec)))
  } catch (e) {
    noteRedisDown('set', key, e)
  }
}

export async function redisIncr(key: string): Promise<number | null> {
  if (redisCoolingDown()) return null
  const redis = getRedis()
  if (!redis) return null
  try {
    if (redis.status === 'wait') await redis.connect()
    return await redis.incr(key)
  } catch (e) {
    noteRedisDown('incr', key, e)
    return null
  }
}

export async function redisGetInt(key: string): Promise<number> {
  const raw = await redisGet(key)
  const n = raw ? Number(raw) : 0
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
}

export async function redisDel(key: string): Promise<void> {
  if (redisCoolingDown()) return
  const redis = getRedis()
  if (!redis) return
  try {
    if (redis.status === 'wait') await redis.connect()
    await redis.del(key)
  } catch (e) {
    noteRedisDown('del', key, e)
  }
}

/** SET key NX EX — true if this caller won the slot. */
export async function redisSetNxEx(key: string, ttlSec: number, value: string): Promise<boolean | null> {
  if (redisCoolingDown()) return null
  const redis = getRedis()
  if (!redis) return null
  try {
    if (redis.status === 'wait') await redis.connect()
    const ok = await redis.set(key, value, 'EX', Math.max(1, Math.floor(ttlSec)), 'NX')
    return ok === 'OK'
  } catch (e) {
    noteRedisDown('setnx', key, e)
    return null
  }
}
