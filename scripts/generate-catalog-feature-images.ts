import dotenv from 'dotenv'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } from '@google/generative-ai'
import { listNanoAiFacebookCatalogItems } from '../src/lib/catalog/nanoai-facebook-catalog'
import { uploadTryOnImagePublic } from '../src/lib/storage/try-on-public-upload'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })
dotenv.config({ path: path.resolve(process.cwd(), '.env') })

type CliOptions = {
  dryRun: boolean
  limit: number | null
  only: Set<string>
  size: '2K' | '4K'
  aspect: string
  overwrite: boolean
  retries: number
  delayMs: number
  timeoutMs: number
}

const GENERATED_OVERRIDES_PATH = path.resolve(
  process.cwd(),
  'src/lib/catalog/nanoai-catalog-feature-image-overrides.json'
)
const PROMPT_MANIFEST_PATH = path.resolve(
  process.cwd(),
  'src/lib/catalog/nanoai-catalog-feature-prompts.json'
)
const FAILURE_REPORT_PATH = path.resolve(
  process.cwd(),
  'src/lib/catalog/nanoai-catalog-feature-image-failures.json'
)

type PromptManifestRow = {
  order: number
  linkPath: string
  title: string
  prompt: string
  imageUrl: string
  error?: string
}

function parseOptions(argv: string[]): CliOptions {
  const opts: CliOptions = {
    dryRun: false,
    limit: null,
    only: new Set<string>(),
    size: '2K',
    aspect: '1:1',
    overwrite: false,
    retries: 2,
    delayMs: 1200,
    timeoutMs: 120000,
  }
  for (const token of argv) {
    if (token === '--dry-run') {
      opts.dryRun = true
      continue
    }
    if (token === '--overwrite') {
      opts.overwrite = true
      continue
    }
    if (token.startsWith('--limit=')) {
      const n = Number.parseInt(token.slice('--limit='.length), 10)
      if (Number.isFinite(n) && n > 0) opts.limit = n
      continue
    }
    if (token.startsWith('--size=')) {
      const v = token.slice('--size='.length).trim().toUpperCase()
      if (v === '2K' || v === '4K') opts.size = v
      continue
    }
    if (token.startsWith('--aspect=')) {
      const v = token.slice('--aspect='.length).trim()
      if (v) opts.aspect = v
      continue
    }
    if (token.startsWith('--only=')) {
      const values = token
        .slice('--only='.length)
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean)
      for (const v of values) opts.only.add(v)
      continue
    }
    if (token.startsWith('--retries=')) {
      const n = Number.parseInt(token.slice('--retries='.length), 10)
      if (Number.isFinite(n) && n >= 0) opts.retries = n
      continue
    }
    if (token.startsWith('--delay=')) {
      const n = Number.parseInt(token.slice('--delay='.length), 10)
      if (Number.isFinite(n) && n >= 0) opts.delayMs = n
      continue
    }
    if (token.startsWith('--timeout=')) {
      const n = Number.parseInt(token.slice('--timeout='.length), 10)
      if (Number.isFinite(n) && n > 0) opts.timeoutMs = n
      continue
    }
  }
  return opts
}

function safeSlug(input: string): string {
  return input
    .trim()
    .replace(/^\/+/, '')
    .replace(/\/+/g, '-')
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'feature'
}

function sceneInstructionByFeature(input: { title: string; linkPath: string }): string {
  const p = input.linkPath
  if (p === '/thu-do-online') {
    return 'Bố cục 3 phần trực quan: (1) người mẫu gốc, (2) ảnh sản phẩm trang phục, (3) người mẫu sau thử đồ bằng NanoAI; giữ gương mặt và vóc dáng nhất quán.'
  }
  if (p === '/phuc-dung-anh') {
    return 'Bố cục before/after phục dựng ảnh cũ: ảnh cũ xuống cấp ở một bên, ảnh đã phục dựng rõ nét tự nhiên ở bên còn lại.'
  }
  if (/^\/(lam-net-anh|lam-dep-anh|xoa-nen-png|xoa-vat-the|ghep-anh|thay-nen-san-pham|hoan-doi-khuon-mat|mo-rong-khung-hinh|sua-anh-theo-yeu-cau)/.test(p)) {
    return 'Bố cục before/after rõ ràng, nhấn mạnh đầu vào và kết quả sau xử lý AI, khác biệt trực quan nhưng vẫn tự nhiên.'
  }
  if (/^\/(tao-banner|tao-anh-tu-chu|du-anh-tu-phac-thao|tao-anh-the|thiet-ke-logo|tao-nhan-gian|tao-nhan-gioi-thieu-san-pham|tao-tem-niem-phong-bao-hanh|thiet-ke-con-dau|thiet-ke-bao-bi|tao-ma-vach|che-anh)/.test(p)) {
    return 'Thể hiện kết quả đầu ra sáng tạo của tính năng, bố cục như ảnh hero sản phẩm số, gọn và bắt mắt.'
  }
  if (/^\/(tao-anh-3d|tao-mo-hinh-3d-tu-anh|thiet-ke-noi-ngoai-that|xay-nha-tu-dat-nen|tao-anh-chain-dung)/.test(p)) {
    return 'Nhấn mạnh chiều sâu không gian và chi tiết vật liệu, cảm giác ảnh chụp thật chuyên nghiệp.'
  }
  if (/^\/(tao-giao-trinh|giao-trinh|tao-bai-thi|tao-bai-tap-ve-nha|lop|hoc-tieng-anh-ai|ghi-am-bao-cao-cuoc-hop|tao-infographic-tu-sach|ke-chuyen-bang-hinh-anh|dich-anh-tai-lieu|tao-bai-hat-lyria-3)/.test(p)) {
    return 'Dùng visual mô phỏng tình huống sử dụng thực tế trên màn hình laptop/điện thoại để người xem hiểu ngay tính năng.'
  }
  return 'Thể hiện trực quan tình huống sử dụng tính năng và kết quả tạo ra, theo phong cách ảnh quảng cáo sản phẩm số.'
}

function buildPrompt(input: { title: string; description: string; linkPath: string; aspect: string }): string {
  const title = input.title.trim()
  const desc = input.description.trim()
  const sceneInstruction = sceneInstructionByFeature(input)

  return [
    `Tạo ảnh quảng cáo catalog cho tính năng "${title}" của NanoAI.`,
    `Tỷ lệ ảnh bắt buộc ${input.aspect} (chuẩn ảnh danh mục sản phẩm).`,
    'Phong cách bắt buộc: Ảnh thật photorealistic, commercial ad quality, ánh sáng studio mềm, màu tự nhiên, bố cục sạch hiện đại.',
    sceneInstruction,
    `Mô tả tính năng: ${desc}`,
    'Bổ sung khung thiết bị (điện thoại/laptop) tinh gọn để gợi ý tính năng AI web/app NanoAI.',
    'Ưu tiên không chèn chữ overlay để tránh lỗi chữ khi hiển thị catalog.',
    'Không watermark, không logo thương hiệu khác, không chữ rác, không CGI giả, không méo hình, không dị dạng cơ thể.',
    'Ảnh phải trực quan đúng tính năng, tạo cảm giác tin cậy và dễ hiểu ngay khi nhìn thumbnail catalog.',
  ].join('\n')
}

function parseInlineImageBase64(response: unknown): string | null {
  const r = response as {
    candidates?: Array<{
      content?: { parts?: Array<{ inlineData?: { data?: string } }> }
    }>
  }
  const parts = r.candidates?.[0]?.content?.parts || []
  for (const part of parts) {
    const data = part?.inlineData?.data
    if (typeof data === 'string' && data.length > 0) return data
  }
  return null
}

async function readOverrides(): Promise<Record<string, string>> {
  try {
    const mod = await import('../src/lib/catalog/nanoai-catalog-feature-image-overrides.json')
    const json = mod?.default
    if (json && typeof json === 'object') return json as Record<string, string>
    return {}
  } catch {
    return {}
  }
}

async function writeOverrides(overrides: Record<string, string>): Promise<void> {
  const sorted = Object.fromEntries(Object.entries(overrides).sort(([a], [b]) => a.localeCompare(b)))
  await writeFile(GENERATED_OVERRIDES_PATH, `${JSON.stringify(sorted, null, 2)}\n`, 'utf8')
}

async function writePromptManifest(rows: PromptManifestRow[]): Promise<void> {
  const sorted = [...rows].sort((a, b) => a.order - b.order)
  await writeFile(PROMPT_MANIFEST_PATH, `${JSON.stringify(sorted, null, 2)}\n`, 'utf8')
}

async function writeFailureReport(rows: PromptManifestRow[]): Promise<void> {
  const failures = rows
    .filter((row) => row.error)
    .map((row) => ({
      order: row.order,
      linkPath: row.linkPath,
      title: row.title,
      error: row.error!,
    }))
  await writeFile(FAILURE_REPORT_PATH, `${JSON.stringify(failures, null, 2)}\n`, 'utf8')
}

async function sleep(ms: number): Promise<void> {
  if (ms <= 0) return
  await new Promise((resolve) => setTimeout(resolve, ms))
}

async function generateImageBase64WithRetry(params: {
  model: ReturnType<GoogleGenerativeAI['getGenerativeModel']>
  prompt: string
  retries: number
  delayMs: number
  timeoutMs: number
}): Promise<string> {
  const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  ]
  let lastErr: unknown
  for (let attempt = 0; attempt <= params.retries; attempt += 1) {
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Gemini timeout after ${params.timeoutMs}ms`)), params.timeoutMs)
      })
      const result = await Promise.race([
        params.model.generateContent([params.prompt] as never, { safetySettings } as never),
        timeoutPromise,
      ])
      const base64 = parseInlineImageBase64(result.response)
      if (!base64) throw new Error('Gemini returned no image data')
      return base64
    } catch (error) {
      lastErr = error
      if (attempt >= params.retries) break
      await sleep(params.delayMs * (attempt + 1))
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr))
}

async function main() {
  const opts = parseOptions(process.argv.slice(2))
  const apiKey = process.env.GOOGLE_API_KEY?.trim()
  if (!opts.dryRun && !apiKey) {
    throw new Error('Missing GOOGLE_API_KEY. Run with --dry-run to preview prompts only.')
  }

  const allItems = listNanoAiFacebookCatalogItems()
  const featureItems = allItems.filter((item) => item.linkPath !== '/wallet')
  const selected = featureItems
    .filter((item) => (opts.only.size ? opts.only.has(item.linkPath) : true))
    .slice(0, opts.limit ?? featureItems.length)

  if (selected.length === 0) {
    console.log('No features selected.')
    return
  }
  console.log(`Selected ${selected.length} features | style=photorealistic | aspect=${opts.aspect}`)

  const overrides = await readOverrides()
  const promptManifest: PromptManifestRow[] = []
  const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null
  const model = genAI
    ? genAI.getGenerativeModel({
        model: 'gemini-3-pro-image-preview',
        generationConfig: {
          responseModalities: ['TEXT', 'IMAGE'],
          imageConfig: { imageSize: opts.size, aspectRatio: opts.aspect },
        },
      })
    : null

  let generatedCount = 0
  let errorCount = 0
  for (let i = 0; i < selected.length; i += 1) {
    const item = selected[i]
    const prompt = buildPrompt({ ...item, aspect: opts.aspect })
    const indexLabel = `[${i + 1}/${selected.length}]`
    const hasExisting = Boolean(overrides[item.linkPath])
    if (hasExisting && !opts.overwrite) {
      console.log(`${indexLabel} skip ${item.linkPath} (already has override)`)
      promptManifest.push({
        order: i + 1,
        linkPath: item.linkPath,
        title: item.title,
        prompt,
        imageUrl: overrides[item.linkPath] || '',
      })
      if (!opts.dryRun) {
        await writePromptManifest(promptManifest)
        await writeOverrides(overrides)
      }
      continue
    }
    console.log(`${indexLabel} ${item.linkPath}`)
    if (opts.dryRun) {
      console.log(prompt)
      console.log('---')
      promptManifest.push({
        order: i + 1,
        linkPath: item.linkPath,
        title: item.title,
        prompt,
        imageUrl: overrides[item.linkPath] || '',
      })
      continue
    }

    if (!model) throw new Error('Gemini model is not initialized.')
    try {
      const base64 = await generateImageBase64WithRetry({
        model,
        prompt,
        retries: opts.retries,
        delayMs: opts.delayMs,
        timeoutMs: opts.timeoutMs,
      })

      const buffer = Buffer.from(base64, 'base64')
      const filePath = `catalog/feature-ads/${safeSlug(item.linkPath)}_${Date.now()}.png`
      const uploaded = await uploadTryOnImagePublic(filePath, buffer, { contentType: 'image/png', upsert: true })
      overrides[item.linkPath] = uploaded.publicUrl
      promptManifest.push({
        order: i + 1,
        linkPath: item.linkPath,
        title: item.title,
        prompt,
        imageUrl: uploaded.publicUrl,
      })
      generatedCount += 1
      console.log(`  -> ${uploaded.publicUrl}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      errorCount += 1
      promptManifest.push({
        order: i + 1,
        linkPath: item.linkPath,
        title: item.title,
        prompt,
        imageUrl: overrides[item.linkPath] || '',
        error: message,
      })
      console.warn(`  !! failed ${item.linkPath}: ${message}`)
    }
    if (!opts.dryRun) {
      await writePromptManifest(promptManifest)
      await writeOverrides(overrides)
      await writeFailureReport(promptManifest)
    }
    await sleep(opts.delayMs)
  }

  await writePromptManifest(promptManifest)
  console.log(`Saved prompt manifest: ${PROMPT_MANIFEST_PATH}`)
  await writeFailureReport(promptManifest)
  console.log(`Saved failure report: ${FAILURE_REPORT_PATH}`)

  if (!opts.dryRun) {
    await writeOverrides(overrides)
    console.log(`Saved overrides: ${GENERATED_OVERRIDES_PATH}`)
    console.log(`Generated images: ${generatedCount}`)
    console.log(`Failed images: ${errorCount}`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
