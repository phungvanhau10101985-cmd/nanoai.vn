import Redis from 'ioredis'

let client: Redis | null | undefined

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
      console.warn('[redis] client error', err instanceof Error ? err.message : err)
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
  const redis = getRedis()
  if (!redis) return null
  try {
    if (redis.status === 'wait') await redis.connect()
    return await redis.get(key)
  } catch (e) {
    console.warn('[redis] get failed', key, e instanceof Error ? e.message : e)
    return null
  }
}

export async function redisSetEx(key: string, ttlSec: number, value: string): Promise<void> {
  const redis = getRedis()
  if (!redis) return
  try {
    if (redis.status === 'wait') await redis.connect()
    await redis.set(key, value, 'EX', Math.max(1, Math.floor(ttlSec)))
  } catch (e) {
    console.warn('[redis] set failed', key, e instanceof Error ? e.message : e)
  }
}

export async function redisIncr(key: string): Promise<number | null> {
  const redis = getRedis()
  if (!redis) return null
  try {
    if (redis.status === 'wait') await redis.connect()
    return await redis.incr(key)
  } catch (e) {
    console.warn('[redis] incr failed', key, e instanceof Error ? e.message : e)
    return null
  }
}

export async function redisGetInt(key: string): Promise<number> {
  const raw = await redisGet(key)
  const n = raw ? Number(raw) : 0
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
}
