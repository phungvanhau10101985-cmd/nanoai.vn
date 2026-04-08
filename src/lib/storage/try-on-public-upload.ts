import type { SupabaseClient } from '@supabase/supabase-js'

const TRY_ON_BUCKET = 'try-on-images'

/** Đường dẫn object trên Bunny / URL public (từng segment encode). */
export function buildTryOnEncodedPath(path: string): string {
  return path
    .split('/')
    .filter(Boolean)
    .map((s) => encodeURIComponent(s))
    .join('/')
}

function bunnyStorageConfigured(): boolean {
  return Boolean(
    process.env.BUNNY_STORAGE_ZONE?.trim() &&
      process.env.BUNNY_STORAGE_API_KEY?.trim() &&
      process.env.BUNNY_STORAGE_PUBLIC_BASE_URL?.trim()
  )
}

async function bodyToBuffer(body: File | Blob | Buffer): Promise<Buffer> {
  if (Buffer.isBuffer(body)) return body
  return Buffer.from(await body.arrayBuffer())
}

async function uploadToBunny(
  path: string,
  buffer: Buffer,
  contentType: string
): Promise<{ publicUrl: string }> {
  const zone = process.env.BUNNY_STORAGE_ZONE!.trim()
  const accessKey = process.env.BUNNY_STORAGE_API_KEY!.trim()
  const publicBase = process.env.BUNNY_STORAGE_PUBLIC_BASE_URL!.trim().replace(/\/$/, '')
  const remotePath = buildTryOnEncodedPath(path)
  const putUrl = `https://storage.bunnycdn.com/${encodeURIComponent(zone)}/${remotePath}`
  const res = await fetch(putUrl, {
    method: 'PUT',
    headers: {
      AccessKey: accessKey,
      'Content-Type': contentType || 'application/octet-stream',
    },
    body: new Uint8Array(buffer),
  })
  if (!res.ok) {
    const hint = await res.text().catch(() => '')
    throw new Error(`Bunny Storage upload failed (${res.status}): ${hint.slice(0, 240)}`)
  }
  const publicUrl = `${publicBase}/${remotePath}`
  return { publicUrl }
}

/** URL public cho object (Supabase hoặc Bunny theo env). */
export function getTryOnPublicUrl(supabase: SupabaseClient, path: string): string {
  if (bunnyStorageConfigured()) {
    const publicBase = process.env.BUNNY_STORAGE_PUBLIC_BASE_URL!.trim().replace(/\/$/, '')
    return `${publicBase}/${buildTryOnEncodedPath(path)}`
  }
  return supabase.storage.from(TRY_ON_BUCKET).getPublicUrl(path).data.publicUrl
}

export async function downloadTryOnObject(supabase: SupabaseClient, path: string): Promise<Buffer | null> {
  if (bunnyStorageConfigured()) {
    const url = getTryOnPublicUrl(supabase, path)
    const res = await fetch(url)
    if (!res.ok) return null
    return Buffer.from(await res.arrayBuffer())
  }
  const { data, error } = await supabase.storage.from(TRY_ON_BUCKET).download(path)
  if (error || !data) return null
  return Buffer.from(await data.arrayBuffer())
}

export async function tryOnObjectExists(supabase: SupabaseClient, path: string): Promise<boolean> {
  if (bunnyStorageConfigured()) {
    const url = getTryOnPublicUrl(supabase, path)
    const res = await fetch(url, { method: 'HEAD' })
    return res.ok
  }
  const { error } = await supabase.storage.from(TRY_ON_BUCKET).download(path)
  return !error
}

type UploadOptions = { contentType?: string; upsert?: boolean }

/**
 * Upload file công khai vào bucket `try-on-images` (Supabase) hoặc zone Bunny khi đã cấu hình env.
 * Dùng để tách dần media khỏi Supabase Storage; DB/metadata vẫn có thể ở Supabase cho tới khi migrate xong.
 */
export async function uploadTryOnImagePublic(
  supabase: SupabaseClient,
  path: string,
  body: File | Blob | Buffer,
  options?: UploadOptions
): Promise<{ publicUrl: string }> {
  const contentType = options?.contentType || 'application/octet-stream'

  if (bunnyStorageConfigured()) {
    const buffer = await bodyToBuffer(body)
    return uploadToBunny(path, buffer, contentType)
  }

  const upsert = options?.upsert ?? false
  const { error } = await supabase.storage.from(TRY_ON_BUCKET).upload(path, body, {
    contentType,
    upsert,
  })
  if (error) throw error
  const { data } = supabase.storage.from(TRY_ON_BUCKET).getPublicUrl(path)
  return { publicUrl: data.publicUrl }
}
