/**
 * Tải ảnh từ URL với cơ chế vượt chặn cho 1688, alibaba, alicdn.
 * Dùng cho cả server actions và API routes.
 */

const is1688Url = (url: string) => /1688\.com|alibaba\.com|alicdn\.com/i.test(url)

const fetch1688Headers: Record<string, string> = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
  'Referer': 'https://www.1688.com/',
}

export function isImageBuffer(buf: Buffer): boolean {
  if (buf.length < 12) return false
  const h = buf.subarray(0, 12)
  return (
    (h[0] === 0x89 && h[1] === 0x50 && h[2] === 0x4e) ||
    (h[0] === 0xff && h[1] === 0xd8) ||
    (h[0] === 0x47 && h[1] === 0x49 && h[2] === 0x46) ||
    (h[0] === 0x52 && h[1] === 0x49 && h[2] === 0x46 && h[3] === 0x46)
  )
}

export async function fetchImageWith1688Bypass(url: string): Promise<Buffer> {
  const headers: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
  }
  if (is1688Url(url)) Object.assign(headers, fetch1688Headers)

  const res = await fetch(url, {
    signal: AbortSignal.timeout(45000),
    redirect: 'follow',
    headers,
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const blob = await res.blob()
  const contentType = (blob.type || '').toLowerCase()
  const buf = Buffer.from(await blob.arrayBuffer())

  if (contentType.startsWith('image/') || isImageBuffer(buf)) return buf

  if (is1688Url(url) && (contentType.includes('html') || contentType.includes('text') || buf.length > 1000)) {
    const html = buf.toString('utf-8')
    const imgMatch =
      html.match(/https?:\/\/[^"'\s]+\.(?:jpg|jpeg|png|gif|webp)(?:\?[^"'\s]*)?/gi)?.[0] ||
      html.match(/https?:\/\/[^"'\s]*\.alicdn\.com[^"'\s]*/i)?.[0]
    if (imgMatch) {
      const imgUrl = imgMatch.replace(/&amp;/g, '&')
      const imgRes = await fetch(imgUrl, {
        signal: AbortSignal.timeout(45000),
        redirect: 'follow',
        headers: is1688Url(imgUrl) ? { ...headers, ...fetch1688Headers } : headers,
      })
      if (!imgRes.ok) throw new Error(`HTTP ${imgRes.status} khi tải ảnh từ trang`)
      const imgBuf = Buffer.from(await imgRes.arrayBuffer())
      if (!isImageBuffer(imgBuf)) throw new Error('Trang không chứa ảnh hợp lệ')
      return imgBuf
    }
  }
  throw new Error('Không phải ảnh')
}
