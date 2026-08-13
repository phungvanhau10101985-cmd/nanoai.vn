'use client'

/** Upload shop images (logo, visual-editor replace). */
export async function uploadPartnerImageFile(partnerId: string, file: File): Promise<string> {
  const fd = new FormData()
  fd.set('partnerId', partnerId)
  fd.set('file', file)
  const res = await fetch('/api/messaging/partner/image', {
    method: 'POST',
    credentials: 'same-origin',
    body: fd,
  })
  const data = (await res.json().catch(() => null)) as { publicUrl?: string; error?: string } | null
  if (!res.ok || !data?.publicUrl) {
    throw new Error(data?.error || 'Upload failed')
  }
  return data.publicUrl
}
