import Redis from 'ioredis'

let client: Redis | null | undefined
let redisSkipUntil = 0
const REDIS_DOWN_COOLDOWN_MS = 3000

function redisCoolingDown(): boolean {
  return Date.now() < redisSkipUntil
}

function noteRedisDown(op: string, key: string, err: unknown): void {
  const fresh = Date.now() >= redisSkipUntil
  redisSkipUntil = Date.now() + REDIS_DOWN_COOLDOWN_MS
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
      commandTimeout: 200,
    })
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
