'use server'
import { deleteTryOnHistoryRowAndStorage } from '@/lib/storage/try-on-history-cleanup'
import { getCreditBalanceByUserId } from '@/lib/db/credits-balance'
import { deductUserCredits } from '@/lib/music/deduct-user-credits'


import crypto from 'crypto'
import fs from 'fs'
import os from 'os'
import path from 'path'
import archiver from 'archiver'
import * as XLSX from 'xlsx'
import { getUserForCreditAction, getUserOrBypass } from '@/lib/auth'
import { insertTryOnHistoryProcessingPg, updateTryOnHistoryCompletedPg } from '@/lib/db/try-on-history-pg'
import {
  cancelTranslateBatchPendingPg,
  fetchTryOnHistoryBatchDownloadRowsPg,
  fetchTryOnHistoryBatchProgressRowsPg,
  fetchTryOnHistoryBatchRowsForCancelPg,
  fetchTryOnHistoryIdsByBatchIdAndUserPg,
  insertTranslateJobPendingPg,
  insertTryOnHistoryTranslateCompletedPg,
  insertTryOnHistoryTranslateProcessingPg,
} from '@/lib/db/translate-process-pg'
import { revalidatePath } from 'next/cache'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { translateOneImage } from '@/lib/translate-document-image'
import { applyPostCheckOcr } from '@/lib/translate-post-check'
import { fetchImageWith1688Bypass } from '@/lib/fetch-image-1688'
import { uploadTryOnImagePublic, downloadTryOnObject } from '@/lib/storage/try-on-public-upload'
const TRANSLATE_COSTS = { '2K': 3, '4K': 6 } as const
const MAX_PDF_PAGES = 50
const POPPLER_DPI = 300
const PDF_EXTRACT_CACHE_TTL_MS = 15 * 60 * 1000 // 15 phút

const pdfExtractCache = new Map<string, { buffers: Buffer[]; createdAt: number }>()

function hashPdfBuffer(buf: Buffer): string {
  return crypto.createHash('sha256').update(buf).digest('hex').slice(0, 32)
}

function getCachedPdfExtract(key: string): Buffer[] | null {
  const entry = pdfExtractCache.get(key)
  if (!entry || Date.now() - entry.createdAt > PDF_EXTRACT_CACHE_TTL_MS) {
    if (entry) pdfExtractCache.delete(key)
    return null
  }
  return entry.buffers
}
const toTenths = (value: number) => Math.round(value * 10)
const formatCredits = (value: number) => value.toLocaleString('vi-VN', { maximumFractionDigits: 1 })

const MAX_BATCH_IMAGES = 50

/** Tạo Poppler instance – trên Windows dùng đường dẫn từ node-poppler-win32. */
async function createPoppler(): Promise<InstanceType<typeof import('node-poppler').Poppler>> {
  const { Poppler } = await import('node-poppler')
  if (process.platform === 'win32') {
    try {
      // Dùng require động để Linux build không cố resolve package win32.
      const dynamicRequire = Function('m', 'return require(m)') as (name: string) => unknown
      const win32ModuleName = ['node', 'poppler', 'win32'].join('-')
      const win32Path = dynamicRequire(win32ModuleName) as string
      if (win32Path && fs.existsSync(win32Path)) {
        return new Poppler(win32Path)
      }
    } catch {
      // Fallback: Poppler tự tìm
    }
  }
  return new Poppler()
}

/** Lấy số trang PDF – Poppler trước, fallback pdf-to-img nếu lỗi. */
async function getPdfPageCount(pdfBuffer: Buffer): Promise<number> {
  try {
    const poppler = await createPoppler()
    const info = (await poppler.pdfInfo(pdfBuffer, { printAsJson: true })) as Record<string, string>
    const pages = parseInt(info?.pages ?? '0', 10)
    return Number.isFinite(pages) && pages > 0 ? pages : 0
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes('pdfinfo') || msg.includes('poppler') || msg.includes('ENOENT') || msg.includes('Unable to find')) {
      try {
        const { pdf } = await import('pdf-to-img')
        const doc = await pdf(pdfBuffer)
        return doc.length
      } catch (fallbackErr) {
        console.error('[getPdfPageCount] pdf-to-img fallback lỗi:', fallbackErr)
        throw e
      }
    }
    throw e
  }
}

/** Tách PDF thành ảnh – Poppler trước, fallback pdf-to-img nếu lỗi. */
async function extractPdfPages(pdfBuffer: Buffer, pageCount: number, dpi = POPPLER_DPI): Promise<Buffer[]> {
  try {
    let tmpDir: string | null = null
    try {
      const poppler = await createPoppler()
      tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'pdf-'))
      const pdfPath = path.join(tmpDir, 'in.pdf')
      await fs.promises.writeFile(pdfPath, pdfBuffer)
      const outPrefix = path.join(tmpDir, 'page')
      await poppler.pdfToCairo(pdfPath, outPrefix, {
        pngFile: true,
        resolutionXYAxis: dpi,
      })
      const entries = await fs.promises.readdir(tmpDir)
      const pngFiles = entries
        .filter((f) => f.endsWith('.png'))
        .map((f) => path.join(tmpDir!, f))
        .sort((a, b) => {
          const na = path.basename(a).replace(/\D/g, '')
          const nb = path.basename(b).replace(/\D/g, '')
          return parseInt(na || '0', 10) - parseInt(nb || '0', 10)
        })
      const buffers: Buffer[] = []
      for (let i = 0; i < pageCount && i < pngFiles.length; i++) {
        buffers.push(await fs.promises.readFile(pngFiles[i]))
      }
      if (buffers.length < pageCount) {
        throw new Error(`Poppler chỉ tạo ${buffers.length}/${pageCount} ảnh`)
      }
      console.log(`[extractPdfPages] Poppler ${dpi} DPI OK, page1=${((buffers[0]?.length ?? 0) / 1024).toFixed(0)}KB`)
      return buffers
    } finally {
      if (tmpDir) fs.promises.rm(tmpDir, { recursive: true, force: true }).catch(() => {})
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes('pdfinfo') || msg.includes('poppler') || msg.includes('pdftocairo') || msg.includes('ENOENT') || msg.includes('Unable to find')) {
      try {
        console.log('[extractPdfPages] Poppler lỗi, dùng pdf-to-img:', msg.slice(0, 80))
        const { pdf } = await import('pdf-to-img')
        const scale = dpi / 72
        const doc = await pdf(pdfBuffer, { scale })
        const buffers: Buffer[] = []
        for (let i = 1; i <= pageCount; i++) {
          const buf = await doc.getPage(i)
          buffers.push(buf)
        }
        console.log(`[extractPdfPages] pdf-to-img OK, page1=${((buffers[0]?.length ?? 0) / 1024).toFixed(0)}KB`)
        return buffers
      } catch (fallbackErr) {
        console.error('[extractPdfPages] pdf-to-img fallback lỗi:', fallbackErr)
        throw e
      }
    }
    throw e
  }
}

/** Dịch ảnh tài liệu – xử lý đồng bộ, trả kết quả ngay. */
export async function translateDocumentImage(formData: FormData) {
  if (!formData || typeof formData.get !== 'function') return { error: 'Dữ liệu không hợp lệ.' }
  const image = formData.get('image') as File
  const sourceLang = (formData.get('sourceLang') as string)?.trim()
  const targetLang = (formData.get('targetLang') as string)?.trim()
  const imageQuality = (formData.get('imageQuality') as '2K' | '4K') || '2K'
  if (!sourceLang) return { error: 'Bắt buộc chọn Ngôn ngữ nguồn.' }
  if (!targetLang) return { error: 'Bắt buộc chọn Ngôn ngữ đích.' }
  if (!image || image.size === 0) return { error: 'Cần tải lên ảnh tài liệu.' }

  const COST = TRANSLATE_COSTS[imageQuality]
  const result = await getUserForCreditAction()
  if ('error' in result) return { error: result.error }
  const { user } = result

  let openBalTr = 0
  try {
    openBalTr = await getCreditBalanceByUserId(user.id)
  } catch {
    return { error: 'Không đọc được số dư credits.' }
  }
  if (toTenths(openBalTr) < toTenths(COST)) {
    return { error: `Không đủ credits. Cần ${formatCredits(COST)} credits.` }
  }

  const timestamp = Date.now()
  const uploadPath = `uploads/${user.id}/translate_${timestamp}.png`
  const { publicUrl: originalPublicUrl } = await uploadTryOnImagePublic(uploadPath, image, {
    contentType: image.type || 'image/png',
  })
  const historyRow = await insertTryOnHistoryProcessingPg({
    userId: user.id,
    originalImageUrl: originalPublicUrl,
    garmentImageUrl: originalPublicUrl,
    feature: 'translate',
  })
  if (!historyRow) return { error: 'Không thể khởi tạo phiên xử lý.' }
  const historyItem = { id: historyRow.id }

  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!)
  const buffer = Buffer.from(await image.arrayBuffer())

  try {
    const { buffer: resultBuffer, error: translateError } = await translateOneImage(
      genAI,
      buffer,
      image.type || 'image/png',
      sourceLang,
      targetLang,
      imageQuality,
      user.id
    )
    if (translateError || !resultBuffer.length) {
      await deleteTryOnHistoryRowAndStorage(historyItem.id)
      return { error: translateError || 'AI không trả về ảnh hợp lệ.' }
    }

    const finalBuffer = await applyPostCheckOcr(resultBuffer, genAI, { sourceLang, targetLang, userId: user.id })
    const resultPath = `results/${user.id}/translate_${Date.now()}.png`
    const { publicUrl: resultPublicUrl } = await uploadTryOnImagePublic(resultPath, finalBuffer, {
      contentType: 'image/png',
      upsert: true,
    })

    const d = await deductUserCredits(user.id, COST)
    if (!d.ok) {
      await deleteTryOnHistoryRowAndStorage(historyItem.id)
      return { error: d.code === 'INSUFFICIENT_CREDITS' ? 'Không đủ credits để hoàn tất.' : d.error }
    }
    await updateTryOnHistoryCompletedPg(historyItem.id, resultPublicUrl, { feature: 'translate' })

    revalidatePath('/dich-anh-tai-lieu')
    revalidatePath('/dashboard/history')
    revalidatePath('/dashboard/history/translate')
    return { success: true, resultUrl: resultPublicUrl }
  } catch (e) {
    await deleteTryOnHistoryRowAndStorage(historyItem.id)
    const msg = e instanceof Error ? e.message : String(e)
    return { error: `Dịch thất bại: ${msg}` }
  }
}

const PDF_EXTRACT_STORAGE_PREFIX = 'temp_pdf_extract'

/** Lấy ảnh đã tách từ storage (nếu có) – tránh tách lại lần 2 */
async function getPdfPagesFromStorage(userId: string, hash: string, pageCount: number): Promise<Buffer[] | null> {
  const buffers: Buffer[] = []
  for (let i = 0; i < pageCount; i++) {
    const path = `${PDF_EXTRACT_STORAGE_PREFIX}/${userId}/${hash}/page_${i}.png`
    const buf = await downloadTryOnObject(path)
    if (!buf) return null
    buffers.push(buf)
  }
  console.log('[getPdfPagesFromStorage] Lấy', pageCount, 'ảnh từ storage, không tách lại')
  return buffers
}

/** Lấy thông tin PDF (số trang + ảnh xem trước) – tách 1 lần, upload lên storage để dùng khi dịch. */
export async function getPdfPageInfo(
  formData: FormData
): Promise<{ pageCount: number; previews: string[]; error?: string }> {
  const pdfFile = formData.get('pdfFile') as File | null
  if (!pdfFile || pdfFile.size === 0) return { pageCount: 0, previews: [], error: 'Không có file.' }
  if (pdfFile.type !== 'application/pdf') return { pageCount: 0, previews: [], error: 'File phải là PDF.' }

  try {
    const pdfBuffer = Buffer.from(await pdfFile.arrayBuffer())
    if (pdfBuffer.length < 100) return { pageCount: 0, previews: [], error: 'File PDF quá nhỏ hoặc rỗng.' }

    const pageCount = await getPdfPageCount(pdfBuffer)
    if (pageCount === 0) return { pageCount: 0, previews: [], error: 'File PDF không có trang nào.' }
    if (pageCount > MAX_PDF_PAGES) return { pageCount, previews: [], error: `Tối đa ${MAX_PDF_PAGES} trang. File có ${pageCount} trang.` }

    const cacheKey = hashPdfBuffer(pdfBuffer)
    let pageBuffers = getCachedPdfExtract(cacheKey)
    if (!pageBuffers) {
      pageBuffers = await extractPdfPages(pdfBuffer, pageCount)
      pdfExtractCache.set(cacheKey, { buffers: pageBuffers, createdAt: Date.now() })
      const user = await getUserOrBypass()
      if (user) {
        for (let i = 0; i < pageBuffers.length; i++) {
          const path = `${PDF_EXTRACT_STORAGE_PREFIX}/${user.id}/${cacheKey}/page_${i}.png`
          await uploadTryOnImagePublic(path, pageBuffers[i], { contentType: 'image/png', upsert: true })
        }
        console.log('[getPdfPageInfo] Đã upload', pageCount, 'ảnh lên storage để dùng khi dịch')
      }
    } else {
      console.log('[getPdfPageInfo] Dùng cache memory, không tách lại')
    }
    const maxPreviews = Math.min(pageCount, 20)
    const previews = pageBuffers.slice(0, maxPreviews).map((b) => `data:image/png;base64,${b.toString('base64')}`)
    return { pageCount, previews }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[getPdfPageInfo]', msg)
    const hint = msg.includes('pdfinfo') || msg.includes('poppler') || msg.includes('ENOENT')
      ? ' Cần cài Poppler (node-poppler-win32 trên Windows).'
      : msg.includes('password') || msg.includes('encrypted')
        ? ' File có thể bị mã hóa mật khẩu.'
        : msg.includes('Invalid')
          ? ' File có thể bị hỏng hoặc không phải PDF hợp lệ.'
          : ''
    return { pageCount: 0, previews: [], error: `Không đọc được file PDF.${hint}` }
  }
}

/** Dịch file PDF – tách từng trang thành ảnh, dịch bằng Gemini, ghép lại thành PDF. */
export async function translatePdfDocument(
  formData: FormData
): Promise<{ success: true; resultPdfUrl: string } | { error: string }> {
  if (!formData || typeof formData.get !== 'function') return { error: 'Dữ liệu không hợp lệ.' }
  const pdfFile = formData.get('pdfFile') as File | null
  const sourceLang = (formData.get('sourceLang') as string)?.trim()
  const targetLang = (formData.get('targetLang') as string)?.trim()
  const imageQuality = (formData.get('imageQuality') as '2K' | '4K') || '2K'
  if (!sourceLang || !targetLang) return { error: 'Bắt buộc chọn Ngôn ngữ nguồn và Ngôn ngữ đích.' }
  if (!pdfFile || pdfFile.size === 0) return { error: 'Cần tải lên file PDF.' }
  if (pdfFile.type !== 'application/pdf') return { error: 'File phải là PDF.' }

  const result = await getUserForCreditAction()
  if ('error' in result) return { error: result.error }
  const { user } = result

  const pdfBuffer = Buffer.from(await pdfFile.arrayBuffer())
  let pageCount: number
  try {
    pageCount = await getPdfPageCount(pdfBuffer)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const hint = msg.includes('pdfinfo') || msg.includes('poppler') || msg.includes('ENOENT')
      ? ' Cần cài Poppler (node-poppler-win32 trên Windows).'
      : ''
    return { error: `Không đọc được file PDF.${hint}` }
  }
  if (pageCount === 0) return { error: 'File PDF không có trang nào.' }
  if (pageCount > MAX_PDF_PAGES) return { error: `Tối đa ${MAX_PDF_PAGES} trang. File có ${pageCount} trang.` }

  const COST_PER_PAGE = TRANSLATE_COSTS[imageQuality]
  const TOTAL_COST = pageCount * COST_PER_PAGE
  let openBalPdf = 0
  try {
    openBalPdf = await getCreditBalanceByUserId(user.id)
  } catch {
    return { error: 'Không đọc được số dư credits.' }
  }
  if (toTenths(openBalPdf) < toTenths(TOTAL_COST)) {
    return { error: `Không đủ credits. Cần ${formatCredits(TOTAL_COST)} credits (${pageCount} trang × ${formatCredits(COST_PER_PAGE)}).` }
  }

  const sharp = (await import('sharp')).default
  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!)
  const translatedBuffers: Buffer[] = []
  const cacheKey = hashPdfBuffer(pdfBuffer)
  let pageBuffers = getCachedPdfExtract(cacheKey)
  if (!pageBuffers) {
    pageBuffers = await extractPdfPages(pdfBuffer, pageCount)
    pdfExtractCache.set(cacheKey, { buffers: pageBuffers, createdAt: Date.now() })
  } else {
    console.log('[translatePdfDocument] Dùng cache, không tách lại')
  }

  for (let i = 0; i < pageCount; i++) {
    const pageBuffer = pageBuffers[i]
    const { buffer: resultBuffer, error: translateError } = await translateOneImage(
      genAI,
      pageBuffer,
      'image/png',
      sourceLang,
      targetLang,
      imageQuality,
      user.id
    )
    if (translateError || !resultBuffer.length) {
      return { error: `Trang ${i + 1}/${pageCount} thất bại: ${translateError || 'AI không trả về ảnh.'}` }
    }

    const finalBuffer = await applyPostCheckOcr(resultBuffer, genAI, {
      sourceLang,
      targetLang,
      logPrefix: `[translatePdfDocument] trang ${i + 1}`,
      userId: user.id,
    })

    const dPage = await deductUserCredits(user.id, COST_PER_PAGE)
    if (!dPage.ok) {
      return { error: dPage.code === 'INSUFFICIENT_CREDITS' ? 'Không đủ credits trong quá trình xử lý.' : dPage.error }
    }

    translatedBuffers.push(finalBuffer)
  }

  const { PDFDocument } = await import('pdf-lib')
  const pdfDoc = await PDFDocument.create()
  for (let i = 0; i < translatedBuffers.length; i++) {
    const pngBuf = await sharp(translatedBuffers[i]).png().toBuffer()
    const buf = new Uint8Array(pngBuf)
    const image = await pdfDoc.embedPng(buf)
    const page = pdfDoc.addPage([image.width, image.height])
    page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height })
  }
  const outPdfBuffer = Buffer.from(await pdfDoc.save())
  const timestamp = Date.now()
  const uploadPath = `uploads/${user.id}/translate_pdf_${timestamp}.pdf`
  const { publicUrl: originalPdfPublicUrl } = await uploadTryOnImagePublic(uploadPath, pdfBuffer, {
    contentType: 'application/pdf',
  })
  const resultPath = `results/${user.id}/translate_pdf_${timestamp}.pdf`
  const { publicUrl: resultPdfPublicUrl } = await uploadTryOnImagePublic(resultPath, outPdfBuffer, {
    contentType: 'application/pdf',
    upsert: true,
  })

  const pdfHist = await insertTryOnHistoryTranslateCompletedPg({
    userId: user.id,
    originalImageUrl: originalPdfPublicUrl,
    garmentImageUrl: originalPdfPublicUrl,
    resultImageUrl: resultPdfPublicUrl,
  })
  if (!pdfHist) return { error: 'Không lưu được lịch sử dịch PDF.' }

  revalidatePath('/dich-anh-tai-lieu')
  revalidatePath('/dashboard/history')
  return { success: true, resultPdfUrl: resultPdfPublicUrl }
}

/** Khởi tạo batch dịch PDF nền – tách trang, upload, tạo jobs, fire API. User redirect sang trang tiến trình. */
export async function startTranslatePdfBatch(formData: FormData): Promise<{ batchId: string } | { error: string }> {
  if (!formData || typeof formData.get !== 'function') return { error: 'Dữ liệu không hợp lệ.' }
  const pdfFile = formData.get('pdfFile') as File | null
  const sourceLang = (formData.get('sourceLang') as string)?.trim()
  const targetLang = (formData.get('targetLang') as string)?.trim()
  const imageQuality = (formData.get('imageQuality') as '2K' | '4K') || '2K'
  if (!sourceLang) return { error: 'Bắt buộc chọn Ngôn ngữ nguồn.' }
  if (!targetLang) return { error: 'Bắt buộc chọn Ngôn ngữ đích.' }
  if (!pdfFile || pdfFile.size === 0) return { error: 'Cần tải lên file PDF.' }
  if (pdfFile.type !== 'application/pdf') return { error: 'File phải là PDF.' }

  const result = await getUserForCreditAction()
  if ('error' in result) return { error: result.error }
  const { user } = result

  const pdfBuffer = Buffer.from(await pdfFile.arrayBuffer())
  let pageCount: number
  try {
    pageCount = await getPdfPageCount(pdfBuffer)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const hint = msg.includes('pdfinfo') || msg.includes('poppler') || msg.includes('ENOENT')
      ? ' Cần cài Poppler (node-poppler-win32 trên Windows).'
      : ''
    return { error: `Không đọc được file PDF.${hint}` }
  }
  if (pageCount === 0) return { error: 'File PDF không có trang nào.' }
  if (pageCount > MAX_PDF_PAGES) return { error: `Tối đa ${MAX_PDF_PAGES} trang. File có ${pageCount} trang.` }

  const COST_PER_PAGE = TRANSLATE_COSTS[imageQuality]
  const TOTAL_COST = pageCount * COST_PER_PAGE
  let openBalPdfBatch = 0
  try {
    openBalPdfBatch = await getCreditBalanceByUserId(user.id)
  } catch {
    return { error: 'Không đọc được số dư credits.' }
  }
  if (toTenths(openBalPdfBatch) < toTenths(TOTAL_COST)) {
    return { error: `Không đủ credits. Cần ${formatCredits(TOTAL_COST)} credits (${pageCount} trang × ${formatCredits(COST_PER_PAGE)}).` }
  }

  const cacheKey = hashPdfBuffer(pdfBuffer)
  let pageBuffers = getCachedPdfExtract(cacheKey)
  if (!pageBuffers) {
    pageBuffers = await getPdfPagesFromStorage(user.id, cacheKey, pageCount)
  }
  if (!pageBuffers) {
    pageBuffers = await extractPdfPages(pdfBuffer, pageCount)
    pdfExtractCache.set(cacheKey, { buffers: pageBuffers, createdAt: Date.now() })
    for (let i = 0; i < pageBuffers.length; i++) {
      const path = `${PDF_EXTRACT_STORAGE_PREFIX}/${user.id}/${cacheKey}/page_${i}.png`
      await uploadTryOnImagePublic(path, pageBuffers[i], { contentType: 'image/png', upsert: true })
    }
    console.log('[startTranslatePdfBatch] Tách PDF lần đầu, đã upload lên storage')
  } else {
    console.log('[startTranslatePdfBatch] Dùng ảnh đã tách (storage/cache), không tách lại')
  }

  const batchId = crypto.randomUUID()
  const batchTimestamp = Date.now()
  const baseUrl = getProcessTranslateBaseUrl()
  const secret = process.env.PROCESS_TRANSLATE_SECRET
  const headers: Record<string, string> = {}
  if (secret) headers['x-process-secret'] = secret

  for (let i = 0; i < pageCount; i++) {
    const pageBuffer = pageBuffers[i]
    const uploadPath = `uploads/${user.id}/translate_pdf_${batchTimestamp}_page_${i}.png`
    const { publicUrl: pageOriginalPublicUrl } = await uploadTryOnImagePublic(uploadPath, pageBuffer, {
      contentType: 'image/png',
      upsert: true,
    })

    const historyItem = await insertTryOnHistoryTranslateProcessingPg({
      userId: user.id,
      originalImageUrl: pageOriginalPublicUrl,
      garmentImageUrl: pageOriginalPublicUrl,
      batchId: batchId,
      batchType: 'pdf',
    })
    if (!historyItem) {
      console.error('[startTranslatePdfBatch] try_on_history insert failed')
      return { error: 'Không thể tạo bản ghi xử lý. Kiểm tra DATABASE_URL và bảng try_on_history.' }
    }

    const cost = TRANSLATE_COSTS[imageQuality]
    const job = await insertTranslateJobPendingPg({
      userId: user.id,
      historyId: historyItem.id,
      sourceLang,
      targetLang,
      imageQuality,
      cost,
    })
    if (!job) {
      console.error('[startTranslatePdfBatch] translate_jobs insert failed')
      await deleteTryOnHistoryRowAndStorage(historyItem.id)
      return { error: 'Không thể tạo job. Kiểm tra DATABASE_URL và bảng translate_jobs.' }
    }
  }

  const triggerUrl = `${baseUrl}/api/process-translate?batchId=${batchId}`
  setTimeout(() => fetch(triggerUrl, { headers }).catch((e) => console.warn('[startTranslatePdfBatch] trigger failed:', e)), 500)

  revalidatePath('/dich-anh-tai-lieu')
  revalidatePath('/dashboard/history/translate')
  return { batchId }
}

function safeZipName(name: string, index: number): string {
  const base = path.basename(name).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100)
  const ext = path.extname(base) || '.png'
  const stem = base.replace(/\.[^.]+$/, '') || `image_${index + 1}`
  return `${stem}_dich${ext}`
}

/** Dịch 1 ảnh (batch) – xử lý đồng bộ. */
export async function translateOneImageFromBatch(
  formData: FormData
): Promise<{ success: true; resultUrl: string; originalUrl: string } | { error: string }> {
  if (!formData || typeof formData.get !== 'function') return { error: 'Dữ liệu không hợp lệ.' }
  const image = formData.get('image') as File
  const sourceLang = (formData.get('sourceLang') as string)?.trim() || 'en'
  const targetLang = (formData.get('targetLang') as string)?.trim() || 'vi'
  const imageQuality = (formData.get('imageQuality') as '2K' | '4K') || '2K'
  if (!image || image.size === 0) return { error: 'Cần ảnh.' }

  const COST = TRANSLATE_COSTS[imageQuality]
  const result = await getUserForCreditAction()
  if ('error' in result) return { error: result.error }
  const { user } = result

  let openBalBatch1 = 0
  try {
    openBalBatch1 = await getCreditBalanceByUserId(user.id)
  } catch {
    return { error: 'Không đọc được số dư credits.' }
  }
  if (toTenths(openBalBatch1) < toTenths(COST)) {
    return { error: `Không đủ credits. Cần ${formatCredits(COST)} credit.` }
  }

  const timestamp = Date.now()
  const uploadPath = `uploads/${user.id}/translate_batch_${timestamp}.png`
  const { publicUrl: batchOriginalPublicUrl } = await uploadTryOnImagePublic(uploadPath, image, {
    contentType: image.type || 'image/png',
  })

  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!)
  const buffer = Buffer.from(await image.arrayBuffer())
  const { buffer: resultBuffer, error: translateError } = await translateOneImage(
    genAI,
    buffer,
    image.type || 'image/png',
    sourceLang,
    targetLang,
    imageQuality,
    user.id
  )

  if (translateError || !resultBuffer.length) {
    return { error: translateError || 'AI không trả về ảnh.' }
  }

  const finalBuffer = await applyPostCheckOcr(resultBuffer, genAI, { sourceLang, targetLang, userId: user.id })
  const resultPath = `results/${user.id}/translate_batch_${timestamp}.png`
  const { publicUrl: batchResultPublicUrl } = await uploadTryOnImagePublic(resultPath, finalBuffer, {
    contentType: 'image/png',
    upsert: true,
  })

  const dBatch1 = await deductUserCredits(user.id, COST)
  if (!dBatch1.ok) {
    return { error: dBatch1.code === 'INSUFFICIENT_CREDITS' ? 'Không đủ credits.' : dBatch1.error }
  }

  const insBatch = await insertTryOnHistoryTranslateCompletedPg({
    userId: user.id,
    originalImageUrl: batchOriginalPublicUrl,
    garmentImageUrl: batchOriginalPublicUrl,
    resultImageUrl: batchResultPublicUrl,
  })
  if (!insBatch) return { error: 'Không lưu được lịch sử.' }

  revalidatePath('/dich-anh-tai-lieu')
  revalidatePath('/dashboard/history')
  revalidatePath('/dashboard/history/translate')
  return { success: true, resultUrl: batchResultPublicUrl, originalUrl: batchOriginalPublicUrl }
}

/** Dịch 1 ảnh từ URL (Excel) – xử lý đồng bộ. */
export async function translateOneImageFromUrl(
  formData: FormData
): Promise<{ success: true; resultUrl: string; originalUrl: string } | { error: string }> {
  if (!formData || typeof formData.get !== 'function') return { error: 'Dữ liệu không hợp lệ.' }
  const url = (formData.get('imageUrl') as string)?.trim()
  const sourceLang = (formData.get('sourceLang') as string)?.trim() || 'en'
  const targetLang = (formData.get('targetLang') as string)?.trim() || 'vi'
  const imageQuality = (formData.get('imageQuality') as '2K' | '4K') || '2K'
  if (!url || !/^https?:\/\//i.test(url)) return { error: 'Link ảnh không hợp lệ.' }

  const COST = TRANSLATE_COSTS[imageQuality]
  const result = await getUserForCreditAction()
  if ('error' in result) return { error: result.error }
  const { user } = result

  let openBalUrl = 0
  try {
    openBalUrl = await getCreditBalanceByUserId(user.id)
  } catch {
    return { error: 'Không đọc được số dư credits.' }
  }
  if (toTenths(openBalUrl) < toTenths(COST)) {
    return { error: `Không đủ credits. Cần ${formatCredits(COST)} credit.` }
  }

  let imageBuffer: Buffer
  try {
    imageBuffer = await fetchImageWith1688Bypass(url)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const hint = msg.includes('fetch') || msg.includes('abort') || msg.includes('ECONNREFUSED') || msg.includes('ETIMEDOUT')
      ? ' (Link có thể chặn tải từ server. Thử tải ảnh về máy rồi chọn chế độ "Thư mục / nhiều ảnh" để tải lên.)'
      : ''
    return { error: `Không tải được: ${msg}${hint}` }
  }

  const timestamp = Date.now()
  const uploadPath = `uploads/${user.id}/translate_excel_${timestamp}.png`
  const { publicUrl: excelOriginalPublicUrl } = await uploadTryOnImagePublic(uploadPath, imageBuffer, {
    contentType: 'image/png',
  })

  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!)
  const { buffer: resultBuffer, error: translateError } = await translateOneImage(
    genAI,
    imageBuffer,
    'image/png',
    sourceLang,
    targetLang,
    imageQuality,
    user.id
  )

  if (translateError || !resultBuffer.length) {
    return { error: translateError || 'AI không trả về ảnh.' }
  }

  const finalBuffer = await applyPostCheckOcr(resultBuffer, genAI, { sourceLang, targetLang, userId: user.id })
  const resultPath = `results/${user.id}/translate_excel_${timestamp}.png`
  const { publicUrl: excelResultPublicUrl } = await uploadTryOnImagePublic(resultPath, finalBuffer, {
    contentType: 'image/png',
    upsert: true,
  })

  const dUrl = await deductUserCredits(user.id, COST)
  if (!dUrl.ok) {
    return { error: dUrl.code === 'INSUFFICIENT_CREDITS' ? 'Không đủ credits.' : dUrl.error }
  }

  const insUrl = await insertTryOnHistoryTranslateCompletedPg({
    userId: user.id,
    originalImageUrl: excelOriginalPublicUrl,
    garmentImageUrl: excelOriginalPublicUrl,
    resultImageUrl: excelResultPublicUrl,
  })
  if (!insUrl) return { error: 'Không lưu được lịch sử.' }

  revalidatePath('/dich-anh-tai-lieu')
  revalidatePath('/dashboard/history')
  revalidatePath('/dashboard/history/translate')
  return { success: true, resultUrl: excelResultPublicUrl, originalUrl: excelOriginalPublicUrl }
}

/** Tạo file zip từ danh sách kết quả */
export async function createZipFromResults(
  entries: Array<{ resultUrl: string; name: string }>
): Promise<{ zipUrl: string } | { error: string }> {
  if (!entries.length) return { error: 'Không có ảnh để nén.' }

  const result = await getUserForCreditAction()
  if ('error' in result) return { error: result.error }
  const { user } = result

  const zipEntries: Array<{ name: string; buffer: Buffer }> = []
  for (const e of entries) {
    try {
      const res = await fetch(e.resultUrl, { signal: AbortSignal.timeout(15000) })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const buf = Buffer.from(await res.arrayBuffer())
      zipEntries.push({ name: e.name, buffer: buf })
    } catch (err) {
      console.warn('[createZip] Skip:', e.name, err)
    }
  }
  if (zipEntries.length === 0) return { error: 'Không tải được ảnh để nén.' }

  const zipBuffer = await new Promise<Buffer>((resolve, reject) => {
    const archive = archiver('zip', { zlib: { level: 9 } })
    const chunks: Buffer[] = []
    archive.on('data', (chunk: Buffer) => chunks.push(chunk))
    archive.on('end', () => resolve(Buffer.concat(chunks)))
    archive.on('error', reject)
    for (const e of zipEntries) {
      archive.append(e.buffer, { name: e.name })
    }
    archive.finalize()
  })

  const zipPath = `results/${user.id}/dich_tai_lieu_${Date.now()}.zip`
  const { publicUrl: zipPublicUrl } = await uploadTryOnImagePublic(zipPath, zipBuffer, {
    contentType: 'application/zip',
    upsert: true,
  })
  revalidatePath('/dich-anh-tai-lieu')
  return { zipUrl: zipPublicUrl }
}

/** Dịch nhiều ảnh tài liệu – xử lý tuần tự, trả về kết quả + file zip. */
export async function translateDocumentImageBatch(
  formData: FormData
): Promise<{ success: true; results: Array<{ originalUrl: string; resultUrl: string }>; zipUrl?: string } | { error: string }> {
  if (!formData || typeof formData.get !== 'function') return { error: 'Dữ liệu không hợp lệ.' }
  const sourceLang = (formData.get('sourceLang') as string)?.trim() || 'en'
  const targetLang = (formData.get('targetLang') as string)?.trim() || 'vi'
  const imageQuality = (formData.get('imageQuality') as '2K' | '4K') || '2K'

  const images: File[] = []
  for (let i = 0; i < MAX_BATCH_IMAGES; i++) {
    const f = formData.get(`image_${i}`) as File | null
    if (f && f.size > 0) images.push(f)
  }
  if (images.length === 0) return { error: 'Cần tải lên ít nhất 1 ảnh.' }
  if (images.length > MAX_BATCH_IMAGES) return { error: `Tối đa ${MAX_BATCH_IMAGES} ảnh.` }

  const COST_PER_IMAGE = TRANSLATE_COSTS[imageQuality]
  const TOTAL_COST = images.length * COST_PER_IMAGE

  const result = await getUserForCreditAction()
  if ('error' in result) return { error: result.error }
  const { user } = result

  let openBalDoc = 0
  try {
    openBalDoc = await getCreditBalanceByUserId(user.id)
  } catch {
    return { error: 'Không đọc được số dư credits.' }
  }
  if (toTenths(openBalDoc) < toTenths(TOTAL_COST)) {
    return { error: `Không đủ credits. Cần ${formatCredits(TOTAL_COST)} credits (${images.length} × ${formatCredits(COST_PER_IMAGE)}).` }
  }

  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!)
  const results: Array<{ originalUrl: string; resultUrl: string }> = []
  const zipEntries: Array<{ name: string; buffer: Buffer }> = []
  const batchTimestamp = Date.now()

  for (let i = 0; i < images.length; i++) {
    const image = images[i]
    const uploadPath = `uploads/${user.id}/translate_batch_${batchTimestamp}_${i}.png`
    const { publicUrl: docBatchOriginalPublicUrl } = await uploadTryOnImagePublic(uploadPath, image, {
      contentType: image.type || 'image/png',
    })

    const buffer = Buffer.from(await image.arrayBuffer())
    const { buffer: resultBuffer, error: translateError } = await translateOneImage(
      genAI,
      buffer,
      image.type || 'image/png',
      sourceLang,
      targetLang,
      imageQuality,
      user.id
    )

    if (translateError || !resultBuffer.length) {
      const failed = i + 1
      return { error: `Ảnh ${failed}/${images.length} thất bại: ${translateError || 'AI không trả về ảnh.'}` }
    }

    const finalBuffer = await applyPostCheckOcr(resultBuffer, genAI, {
      sourceLang,
      targetLang,
      logPrefix: `[translateDocumentImageBatch] ảnh ${i + 1}`,
      userId: user.id,
    })
    const resultPath = `results/${user.id}/translate_batch_${batchTimestamp}_${i}.png`
    const { publicUrl: docBatchResultPublicUrl } = await uploadTryOnImagePublic(resultPath, finalBuffer, {
      contentType: 'image/png',
      upsert: true,
    })

    const dImg = await deductUserCredits(user.id, COST_PER_IMAGE)
    if (!dImg.ok) {
      return { error: dImg.code === 'INSUFFICIENT_CREDITS' ? 'Không đủ credits trong quá trình xử lý.' : dImg.error }
    }

    const insMulti = await insertTryOnHistoryTranslateCompletedPg({
      userId: user.id,
      originalImageUrl: docBatchOriginalPublicUrl,
      garmentImageUrl: docBatchOriginalPublicUrl,
      resultImageUrl: docBatchResultPublicUrl,
    })
    if (!insMulti) return { error: 'Không lưu được lịch sử.' }

    results.push({ originalUrl: docBatchOriginalPublicUrl, resultUrl: docBatchResultPublicUrl })
    zipEntries.push({ name: safeZipName(image.name, i), buffer: finalBuffer })
  }

  let zipUrl: string | undefined
  if (zipEntries.length > 0) {
    const zipBuffer = await new Promise<Buffer>((resolve, reject) => {
      const archive = archiver('zip', { zlib: { level: 9 } })
      const chunks: Buffer[] = []
      archive.on('data', (chunk: Buffer) => chunks.push(chunk))
      archive.on('end', () => resolve(Buffer.concat(chunks)))
      archive.on('error', reject)
      for (const e of zipEntries) {
        archive.append(e.buffer, { name: e.name })
      }
      archive.finalize()
    })
    const zipPath = `results/${user.id}/dich_tai_lieu_${batchTimestamp}.zip`
    const { publicUrl: docBatchZipPublicUrl } = await uploadTryOnImagePublic(zipPath, zipBuffer, {
      contentType: 'application/zip',
      upsert: true,
    })
    zipUrl = docBatchZipPublicUrl
  }

  revalidatePath('/dich-anh-tai-lieu')
  revalidatePath('/dashboard/history')
  return { success: true, results, zipUrl }
}

function getProcessTranslateBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return `http://localhost:${process.env.PORT || 3000}`
}

/** Khởi tạo batch dịch nền – tạo records, fire API, trả batch_id. User redirect sang trang tiến trình. */
export async function startTranslateBatch(formData: FormData): Promise<{ batchId: string } | { error: string }> {
  if (!formData || typeof formData.get !== 'function') return { error: 'Dữ liệu không hợp lệ.' }
  const sourceLang = (formData.get('sourceLang') as string)?.trim()
  const targetLang = (formData.get('targetLang') as string)?.trim()
  const imageQuality = (formData.get('imageQuality') as '2K' | '4K') || '2K'
  const mode = (formData.get('mode') as string) || 'batch' // 'batch' | 'excel'
  if (!sourceLang) return { error: 'Bắt buộc chọn Ngôn ngữ nguồn.' }
  if (!targetLang) return { error: 'Bắt buộc chọn Ngôn ngữ đích.' }

  const result = await getUserForCreditAction()
  if ('error' in result) return { error: result.error }
  const { user } = result

  const COST_PER_IMAGE = TRANSLATE_COSTS[imageQuality]
  const items: Array<{ originalUrl: string; name?: string }> = []

  if (mode === 'excel') {
    const excelFile = formData.get('excelFile') as File | null
    if (!excelFile || excelFile.size === 0) return { error: 'Cần tải lên file Excel.' }
    const buffer = Buffer.from(await excelFile.arrayBuffer())
    const urls = extractUrlsFromExcel(buffer)
    if (urls.length === 0) return { error: 'File Excel không có link ảnh hợp lệ ở cột A.' }
    if (urls.length > MAX_BATCH_IMAGES) return { error: `Tối đa ${MAX_BATCH_IMAGES} link.` }
    let openBalExcelStart = 0
    try {
      openBalExcelStart = await getCreditBalanceByUserId(user.id)
    } catch {
      return { error: 'Không đọc được số dư credits.' }
    }
    if (toTenths(openBalExcelStart) < toTenths(COST_PER_IMAGE)) {
      return { error: `Không đủ credits. Cần ít nhất ${formatCredits(COST_PER_IMAGE)} credit.` }
    }
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i]
      let imageBuffer: Buffer
      try {
        imageBuffer = await fetchImageWith1688Bypass(url)
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        return { error: `Ảnh ${i + 1}/${urls.length}: Không tải được. ${msg}` }
      }
      const uploadPath = `uploads/${user.id}/translate_excel_${Date.now()}_${i}.png`
      const { publicUrl: startBatchExcelPublicUrl } = await uploadTryOnImagePublic(uploadPath, imageBuffer, {
        contentType: 'image/png',
      })
      items.push({ originalUrl: startBatchExcelPublicUrl, name: `image_${i + 1}` })
    }
  } else {
    const images: File[] = []
    for (let i = 0; i < MAX_BATCH_IMAGES; i++) {
      const f = formData.get(`image_${i}`) as File | null
      if (f && f.size > 0) images.push(f)
    }
    if (images.length === 0) return { error: 'Cần tải lên ít nhất 1 ảnh.' }
    const TOTAL_COST = images.length * COST_PER_IMAGE
    let openBalStartBatch = 0
    try {
      openBalStartBatch = await getCreditBalanceByUserId(user.id)
    } catch {
      return { error: 'Không đọc được số dư credits.' }
    }
    if (toTenths(openBalStartBatch) < toTenths(TOTAL_COST)) {
      return { error: `Không đủ credits. Cần ${formatCredits(TOTAL_COST)} credits.` }
    }
    const batchTimestamp = Date.now()
    for (let i = 0; i < images.length; i++) {
      const image = images[i]
      const uploadPath = `uploads/${user.id}/translate_batch_${batchTimestamp}_${i}.png`
      const { publicUrl: startBatchImgPublicUrl } = await uploadTryOnImagePublic(uploadPath, image, {
        contentType: image.type || 'image/png',
      })
      items.push({ originalUrl: startBatchImgPublicUrl, name: image.name })
    }
  }

  const batchId = crypto.randomUUID()
  const baseUrl = getProcessTranslateBaseUrl()
  const secret = process.env.PROCESS_TRANSLATE_SECRET
  const headers: Record<string, string> = {}
  if (secret) headers['x-process-secret'] = secret

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const historyItem = await insertTryOnHistoryTranslateProcessingPg({
      userId: user.id,
      originalImageUrl: item.originalUrl,
      garmentImageUrl: item.originalUrl,
      batchId,
      batchType: 'image',
    })
    if (!historyItem) return { error: 'Không thể tạo bản ghi xử lý. Kiểm tra DATABASE_URL.' }

    const cost = TRANSLATE_COSTS[imageQuality]
    const job = await insertTranslateJobPendingPg({
      userId: user.id,
      historyId: historyItem.id,
      sourceLang,
      targetLang,
      imageQuality,
      cost,
    })
    if (!job) {
      console.error('[startTranslateBatch] translate_jobs insert failed')
      await deleteTryOnHistoryRowAndStorage(historyItem.id)
      return { error: 'Không thể tạo job. Kiểm tra DATABASE_URL và bảng translate_jobs.' }
    }
  }

  fetch(`${baseUrl}/api/process-translate?batchId=${batchId}`, { headers }).catch(() => {})

  revalidatePath('/dich-anh-tai-lieu')
  revalidatePath('/dashboard/history/translate')
  return { batchId }
}

const CANCEL_CONFIRM_TEXT = 'HỦY'

/** Hủy tiến trình dịch – yêu cầu gõ "HỦY" để xác nhận. Trả zip ảnh kết quả và ảnh gốc đã xử lý xong (nếu có). */
export async function cancelBatchTranslate(
  batchId: string,
  confirmText: string
): Promise<{ zipUrl?: string; originalZipUrl?: string; cancelled: true } | { error: string; cancelled?: true }> {
  if (!batchId) return { error: 'Thiếu batchId.' }
  const trimmed = (confirmText || '').trim().toUpperCase()
  if (trimmed !== CANCEL_CONFIRM_TEXT) {
    return { error: `Gõ chính xác "${CANCEL_CONFIRM_TEXT}" (viết hoa) để xác nhận hủy.` }
  }

  const authResult = await getUserForCreditAction()
  if ('error' in authResult) return { error: authResult.error }
  const { user } = authResult

  const items = await fetchTryOnHistoryBatchRowsForCancelPg(user.id, batchId)
  if (items == null) return { error: 'Không tải được tiến trình.' }
  if (!items.length) return { error: 'Không tìm thấy tiến trình.' }

  const completed = items.filter((x) => x.status === 'completed' && x.result_image_url)
  const processingIds = items.filter((x) => x.status === 'processing').map((x) => x.id)

  if (processingIds.length > 0) {
    await cancelTranslateBatchPendingPg(user.id, batchId)
  }

  if (completed.length === 0) {
    revalidatePath('/dich-anh-tai-lieu')
    revalidatePath(`/dich-anh-tai-lieu/tien-trinh/${batchId}`)
    revalidatePath('/dashboard/history/translate')
    return { cancelled: true, error: 'Chưa có ảnh nào xử lý xong để tải xuống.' }
  }

  const result = await getBatchZipUrl(batchId)
  if ('error' in result) return result

  revalidatePath('/dich-anh-tai-lieu')
  revalidatePath(`/dich-anh-tai-lieu/tien-trinh/${batchId}`)
  revalidatePath('/dashboard/history/translate')
  return { ...result, cancelled: true }
}

/** Khởi động lại chuỗi xử lý batch (khi server restart, chuỗi bị đứt). Gọi khi user mở trang tiến trình. */
export async function resumeBatchTranslate(batchId: string): Promise<void> {
  if (!batchId) return
  const result = await getUserForCreditAction()
  if ('error' in result) return
  const { user } = result
  const ids = await fetchTryOnHistoryIdsByBatchIdAndUserPg(batchId, user.id)
  if (!ids?.length) return
  const baseUrl = getProcessTranslateBaseUrl()
  const secret = process.env.PROCESS_TRANSLATE_SECRET
  const headers: Record<string, string> = {}
  if (secret) headers['x-process-secret'] = secret
  fetch(`${baseUrl}/api/process-translate?batchId=${batchId}`, { headers }).catch(() => {})
}

/** Tạo zip ảnh kết quả và ảnh gốc từ batch đã dịch xong – dùng cho nút tải và khi hủy. */
export async function getBatchZipUrl(batchId: string): Promise<{ zipUrl?: string; originalZipUrl?: string } | { error: string }> {
  if (!batchId) return { error: 'Thiếu batchId.' }
  const result = await getUserForCreditAction()
  if ('error' in result) return { error: result.error }
  const { user } = result

  const items = await fetchTryOnHistoryBatchDownloadRowsPg(user.id, batchId)
  if (items == null) return { error: 'Không tải được dữ liệu batch.' }

  const completed = items.filter((x) => x.result_image_url)
  if (completed.length === 0) return { error: 'Không có ảnh đã xử lý xong để tải.' }

  const isPdfBatch = items.some((x) => x.batch_type === 'pdf')
  const pagePrefix = isPdfBatch ? 'trang' : 'image'

  const zipResult = await createZipFromResults(
    completed.map((item, i: number) => ({
      resultUrl: item.result_image_url!,
      name: `${pagePrefix}_${i + 1}_dich.png`,
    }))
  )
  if ('error' in zipResult) return zipResult

  const origEntries = completed
    .map((item, i: number) => ({ url: item.original_image_url, idx: i + 1 }))
    .filter((x): x is { url: string; idx: number } => Boolean(x.url))
  let originalZipUrl: string | undefined
  if (origEntries.length > 0) {
    const origResult = await createZipFromResults(
      origEntries.map((x) => ({ resultUrl: x.url, name: `${pagePrefix}_${x.idx}_goc.png` }))
    )
    if ('zipUrl' in origResult && origResult.zipUrl) originalZipUrl = origResult.zipUrl
  }

  return { zipUrl: zipResult.zipUrl, originalZipUrl }
}

/** Lấy tiến trình batch dịch – dùng cho trang tiến trình (polling). */
export async function getBatchProgress(batchId: string): Promise<
  { done: number; total: number; items: Array<{ id: string; status: string; original_image_url?: string; result_image_url?: string; error_message?: string | null }>; cancelled?: number; isCancelled?: boolean } | { error: string }
> {
  if (!batchId) return { error: 'Thiếu batchId.' }
  const result = await getUserForCreditAction()
  if ('error' in result) return { error: result.error }
  const { user } = result

  const listRaw = await fetchTryOnHistoryBatchProgressRowsPg(user.id, batchId)
  if (listRaw == null) return { error: 'Không tải được tiến trình.' }
  const list = listRaw.map((r) => ({
    id: r.id,
    status: r.status,
    original_image_url: r.original_image_url ?? undefined,
    result_image_url: r.result_image_url ?? undefined,
    error_message: r.error_message,
  }))
  const done = list.filter((x) => x.status === 'completed').length
  const cancelled = list.filter((x) => x.status === 'cancelled').length
  const isCancelled =
    list.length > 0 && list.every((x) => x.status === 'completed' || x.status === 'cancelled' || x.status === 'failed')
  return { done, total: list.length, items: list, cancelled, isCancelled }
}

/** Đọc URL từ cột A file Excel */
function extractUrlsFromExcel(buffer: Buffer): string[] {
  const wb = XLSX.read(buffer, { type: 'buffer' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  if (!ws) return []
  const data = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 })
  const urls: string[] = []
  for (let r = 1; r < data.length; r++) {
    const cell = data[r]?.[0]
    const s = (typeof cell === 'string' ? cell : String(cell ?? '')).trim()
    if (s && /^https?:\/\//i.test(s)) urls.push(s)
  }
  return urls
}

/** Dịch ảnh từ file Excel – cột A chứa link ảnh. Tải ảnh, xử lý tuần tự, trừ credit từng ảnh, trả zip. */
export async function translateFromExcel(
  formData: FormData
): Promise<{ success: true; results: Array<{ originalUrl: string; resultUrl: string }>; zipUrl?: string; estimatedCost: number } | { error: string }> {
  if (!formData || typeof formData.get !== 'function') return { error: 'Dữ liệu không hợp lệ.' }
  const excelFile = formData.get('excelFile') as File | null
  if (!excelFile || excelFile.size === 0) return { error: 'Cần tải lên file Excel.' }

  const sourceLang = (formData.get('sourceLang') as string)?.trim() || 'en'
  const targetLang = (formData.get('targetLang') as string)?.trim() || 'vi'
  const imageQuality = (formData.get('imageQuality') as '2K' | '4K') || '2K'

  const buffer = Buffer.from(await excelFile.arrayBuffer())
  const urls = extractUrlsFromExcel(buffer)
  if (urls.length === 0) return { error: 'File Excel không có link ảnh hợp lệ ở cột A.' }
  if (urls.length > MAX_BATCH_IMAGES) return { error: `Tối đa ${MAX_BATCH_IMAGES} link.` }

  const COST_PER_IMAGE = TRANSLATE_COSTS[imageQuality]
  const estimatedCost = urls.length * COST_PER_IMAGE

  const result = await getUserForCreditAction()
  if ('error' in result) return { error: result.error }
  const { user } = result

  let openBalExcelFull = 0
  try {
    openBalExcelFull = await getCreditBalanceByUserId(user.id)
  } catch {
    return { error: 'Không đọc được số dư credits.' }
  }
  if (toTenths(openBalExcelFull) < toTenths(estimatedCost)) {
    return { error: `Không đủ credits. Cần ${formatCredits(estimatedCost)} credits (${urls.length} ảnh × ${formatCredits(COST_PER_IMAGE)}).` }
  }

  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!)
  const results: Array<{ originalUrl: string; resultUrl: string }> = []
  const zipEntries: Array<{ name: string; buffer: Buffer }> = []
  const batchTimestamp = Date.now()

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i]
    let imageBuffer: Buffer
    try {
      imageBuffer = await fetchImageWith1688Bypass(url)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      const hint = (msg.includes('fetch') || msg.includes('abort') || msg.includes('ECONNREFUSED') || msg.includes('ETIMEDOUT'))
        ? ' Thử tải ảnh về máy rồi dùng chế độ "Thư mục / nhiều ảnh".'
        : ''
      return { error: `Ảnh ${i + 1}/${urls.length}: Không tải được. ${msg}${hint}` }
    }

    const uploadPath = `uploads/${user.id}/translate_excel_${batchTimestamp}_${i}.png`
    const { publicUrl: fromExcelOriginalPublicUrl } = await uploadTryOnImagePublic(uploadPath, imageBuffer, {
      contentType: 'image/png',
    })

    const { buffer: resultBuffer, error: translateError } = await translateOneImage(
      genAI,
      imageBuffer,
      'image/png',
      sourceLang,
      targetLang,
      imageQuality,
      user.id
    )

    if (translateError || !resultBuffer.length) {
      return { error: `Ảnh ${i + 1}/${urls.length} thất bại: ${translateError || 'AI không trả về ảnh.'}` }
    }

    const finalBuffer = await applyPostCheckOcr(resultBuffer, genAI, {
      sourceLang,
      targetLang,
      logPrefix: `[translateFromExcel] ảnh ${i + 1}`,
      userId: user.id,
    })
    const resultPath = `results/${user.id}/translate_excel_${batchTimestamp}_${i}.png`
    const { publicUrl: fromExcelResultPublicUrl } = await uploadTryOnImagePublic(resultPath, finalBuffer, {
      contentType: 'image/png',
      upsert: true,
    })

    const dExcel = await deductUserCredits(user.id, COST_PER_IMAGE)
    if (!dExcel.ok) {
      return { error: dExcel.code === 'INSUFFICIENT_CREDITS' ? 'Không đủ credits trong quá trình xử lý.' : dExcel.error }
    }

    const insExcel = await insertTryOnHistoryTranslateCompletedPg({
      userId: user.id,
      originalImageUrl: fromExcelOriginalPublicUrl,
      garmentImageUrl: fromExcelOriginalPublicUrl,
      resultImageUrl: fromExcelResultPublicUrl,
    })
    if (!insExcel) return { error: 'Không lưu được lịch sử.' }

    results.push({ originalUrl: fromExcelOriginalPublicUrl, resultUrl: fromExcelResultPublicUrl })
    let baseName = `image_${i + 1}`
    try {
      baseName = path.basename(new URL(url).pathname) || baseName
    } catch {
      baseName = `image_${i + 1}`
    }
    zipEntries.push({ name: safeZipName(baseName, i), buffer: finalBuffer })
  }

  let zipUrl: string | undefined
  if (zipEntries.length > 0) {
    const zipBuffer = await new Promise<Buffer>((resolve, reject) => {
      const archive = archiver('zip', { zlib: { level: 9 } })
      const chunks: Buffer[] = []
      archive.on('data', (chunk: Buffer) => chunks.push(chunk))
      archive.on('end', () => resolve(Buffer.concat(chunks)))
      archive.on('error', reject)
      for (const e of zipEntries) {
        archive.append(e.buffer, { name: e.name })
      }
      archive.finalize()
    })
    const zipPath = `results/${user.id}/dich_tai_lieu_${batchTimestamp}.zip`
    const { publicUrl: fromExcelZipPublicUrl } = await uploadTryOnImagePublic(zipPath, zipBuffer, {
      contentType: 'application/zip',
      upsert: true,
    })
    zipUrl = fromExcelZipPublicUrl
  }

  revalidatePath('/dich-anh-tai-lieu')
  revalidatePath('/dashboard/history')
  revalidatePath('/dashboard/history/translate')
  return { success: true, results, zipUrl, estimatedCost }
}

