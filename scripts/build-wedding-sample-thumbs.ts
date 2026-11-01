/**
 * Ảnh lưới chủ đề: một file webp nhỏ mỗi mẫu.
 * Một id: npx tsx scripts/build-wedding-sample-thumbs.ts doi-anh-nau
 * Nguồn là ảnh đang hiện trên thẻ (nền kho hoặc ảnh bìa), không phải bộ 5 ảnh demo.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { WEDDING_SAMPLE_CARDS } from '../src/lib/wedding/wedding-sample-cards'

const root = process.cwd()
const outDir = path.join(root, 'public', 'wedding', 'sample-thumbs')
const only = process.argv[2]?.trim()

async function loadSource(sample: (typeof WEDDING_SAMPLE_CARDS)[number]): Promise<Buffer> {
  const remote = sample.libraryImageUrl?.trim() || ''
  if (remote.startsWith('http')) {
    const res = await fetch(remote)
    if (res.ok) return Buffer.from(await res.arrayBuffer())
  }
  const local = sample.coverPhotoUrl.replace(/^\//, '')
  return readFile(path.join(root, 'public', local))
}

async function main() {
  await mkdir(outDir, { recursive: true })
  const samples = only ? WEDDING_SAMPLE_CARDS.filter((sample) => sample.id === only) : WEDDING_SAMPLE_CARDS
  if (samples.length === 0) throw new Error(`Không có mẫu ${only}`)
  let bytes = 0
  for (const sample of samples) {
    const input = await loadSource(sample)
    const webp = await sharp(input).rotate().resize({ width: 480, withoutEnlargement: true }).webp({ quality: 62 }).toBuffer()
    await writeFile(path.join(outDir, `${sample.id}.webp`), webp)
    bytes += webp.length
    console.log(`${sample.id} ${Math.round(webp.length / 1024)}KB`)
  }
  console.log(`thumbs ${samples.length} total ${Math.round(bytes / 1024)}KB`)
}

void main()
