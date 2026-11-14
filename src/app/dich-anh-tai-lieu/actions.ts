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
  continueTranslateBatchPg,
  countRunnableTranslateJobsPg,
  fetchPdfCheckpointRowsPg,
  fetchTryOnHistoryBatchDownloadRowsPg,
  fetchTryOnHistoryBatchProgressRowsPg,
  fetchTryOnHistoryBatchRowsForCancelPg,
  fetchTryOnHistoryIdsByBatchIdAndUserPg,
  insertTranslateJobPendingPg,
  insertTryOnHistoryTranslateCompletedPg,
  insertTryOnHistoryTranslateProcessingPg,
  listRecentTranslateBatchesPg,
  markUnfinishedTranslateHistoriesProcessingPg,
  moveTranslateHistoriesToBatchPg,
  pauseTranslateBatchPg,
  reopenFailedTranslateBatchPg,
  requeueTranslateJobsPg,
} from '@/lib/db/translate-process-pg'
import {
  allPdfPages,
  parsePdfPageSelection,
  parseThumbPageList,
  pdfPageNumberFromUrl,
  type PdfPageSelectionError,
} from '@/lib/dich-anh-tai-lieu/pdf-page-selection'
import { parseKeepTerms } from '@/lib/dich-anh-tai-lieu/pdf-keep-terms'
import { describePdfDocument, type PdfPageDescription } from '@/lib/dich-anh-tai-lieu/pdf-source'
import {
  finishedPdfPages,
  MAX_PDF_PAGES,
  pdfCheckpointLikePattern,
  pdfCheckpointObjectPath,
  planPdfCheckpoint,
  TRANSLATE_JOB_STALE_MS,
  type CheckpointRow,
} from '@/lib/dich-anh-tai-lieu/pdf-checkpoint'
import { metaPathForImagePath, type PdfPageMeta } from '@/lib/dich-anh-tai-lieu/pdf-job-files'
import { translatePdfPageFromParts } from '@/lib/dich-anh-tai-lieu/translate-pdf-page'
import { buildPdfFromTranslatedPages } from '@/lib/dich-anh-tai-lieu/pdf-page-paint'
import { revalidatePath } from 'next/cache'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { translateOneImage } from '@/lib/translate-document-image'
import { DOCUMENT_TRANSLATE_GEMINI_CREDITS } from '@/lib/document-translate-pricing'
import { fetchImageWith1688Bypass } from '@/lib/fetch-image-1688'
import { uploadTryOnImagePublic } from '@/lib/storage/try-on-public-upload'
import { requireGoogleApiKeyForUser } from '@/lib/ai/google-api-key-resolver'
import { imageChargeFromForm } from '@/lib/ai/image-engine'
const TRANSLATE_COSTS = DOCUMENT_TRANSLATE_GEMINI_CREDITS

function translateCharge(formData: FormData, imageQuality: '2K' | '4K') {
  const charge = imageChargeFromForm(formData, TRANSLATE_COSTS[imageQuality] ?? TRANSLATE_COSTS['2K'], 1)
  if (!charge.error && charge.engine === 'gpt' && charge.gptQuality === 'low') {
    return { ...charge, cost: 0, error: 'Trang này không dùng NanoAI 2L. Chọn NanoAI 2M hoặc NanoAI 2H.' }
  }
  return charge
}
const PDF_PREVIEW_PAGES = 8
const PDF_PREVIEW_DPI = 96
const PDF_THUMB_DPI = 72
const PDF_THUMB_BATCH = 8
const PDF_SOURCE_CACHE_TTL_MS = 20 * 60 * 1000
const pdfSourceCache = new Map<string, { buffer: Buffer; pageCount: number; createdAt: number }>()

function rememberPdfSource(buffer: Buffer, pageCount: number): string {
  const hash = hashPdfBuffer(buffer)
  const now = Date.now()
  for (const [key, entry] of pdfSourceCache) {
    if (now - entry.createdAt > PDF_SOURCE_CACHE_TTL_MS) pdfSourceCache.delete(key)
  }
  pdfSourceCache.delete(hash)
  pdfSourceCache.set(hash, { buffer, pageCount, createdAt: now })
  while (pdfSourceCache.size > 2) {
    const oldest = pdfSourceCache.keys().next().value
    if (!oldest) break
    pdfSourceCache.delete(oldest)
  }
  return hash
}

function readPdfSource(hash: string): { buffer: Buffer; pageCount: number } | null {
  const entry = pdfSourceCache.get(hash)
  if (!entry) return null
  if (Date.now() - entry.createdAt > PDF_SOURCE_CACHE_TTL_MS) {
    pdfSourceCache.delete(hash)
    return null
  }
  entry.createdAt = Date.now()
  return entry
}

function pdfSelectionError(code: PdfPageSelectionError): string {
  if (code === 'empty') return 'Chọn ít nhất một trang.'
  if (code === 'range') return 'Có trang nằm ngoài file PDF.'
  return 'Khoảng trang không hợp lệ. Dùng dạng 3-8, 12.'
}

function readPdfJobOptions(
  formData: FormData,
  pageCount: number
): { pages: number[]; keepTerms: string[] } | { error: string } {
  const raw = String(formData.get('selectedPages') ?? '').trim()
  const parsed = raw ? parsePdfPageSelection(raw, pageCount) : { pages: allPdfPages(pageCount) }
  if ('error' in parsed) return { error: pdfSelectionError(parsed.error) }
  return { pages: parsed.pages, keepTerms: parseKeepTerms(String(formData.get('keepTerms') ?? '')) }
}

async function describePdfOrEmpty(pdfBuffer: Buffer): Promise<PdfPageDescription[]> {
  try {
    return await describePdfDocument(pdfBuffer)
  } catch (error) {
    console.warn('[describePdfOrEmpty]', error instanceof Error ? error.message : error)
    return []
  }
}
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

/** Tách đúng một trang. Buffer trang trước được bỏ trước khi tách trang sau. */
async function extractPdfPage(pdfBuffer: Buffer, pageNumber: number, dpi = POPPLER_DPI): Promise<Buffer> {
  let tmpDir: string | null = null
  try {
    const poppler = await createPoppler()
    tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'pdf-page-'))
    const pdfPath = path.join(tmpDir, 'in.pdf')
    await fs.promises.writeFile(pdfPath, pdfBuffer)
    const outPrefix = path.join(tmpDir, 'page')
    await poppler.pdfToCairo(pdfPath, outPrefix, {
      pngFile: true,
      resolutionXYAxis: dpi,
      firstPageToConvert: pageNumber,
      lastPageToConvert: pageNumber,
    })
    const pngName = (await fs.promises.readdir(tmpDir)).find((name) => name.endsWith('.png'))
    if (!pngName) throw new Error('Poppler không tạo ảnh trang.')
    return await fs.promises.readFile(path.join(tmpDir, pngName))
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (!(msg.includes('pdfinfo') || msg.includes('poppler') || msg.includes('pdftocairo') || msg.includes('ENOENT') || msg.includes('Unable to find') || msg.includes('không tạo'))) {
      throw e
    }
    const { pdf } = await import('pdf-to-img')
    const doc = await pdf(pdfBuffer, { scale: dpi / 72 })
    return await doc.getPage(pageNumber)
  } finally {
    if (tmpDir) fs.promises.rm(tmpDir, { recursive: true, force: true }).catch(() => {})
  }
}

/** Tách một dải trang liền nhau trong một lần Poppler. */
async function extractPdfPageRange(pdfBuffer: Buffer, firstPage: number, lastPage: number, dpi = PDF_THUMB_DPI): Promise<Buffer[]> {
  const count = lastPage - firstPage + 1
  let tmpDir: string | null = null
  try {
    const poppler = await createPoppler()
    tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'pdf-thumbs-'))
    const pdfPath = path.join(tmpDir, 'in.pdf')
    await fs.promises.writeFile(pdfPath, pdfBuffer)
    await poppler.pdfToCairo(pdfPath, path.join(tmpDir, 'page'), {
      pngFile: true,
      resolutionXYAxis: dpi,
      firstPageToConvert: firstPage,
      lastPageToConvert: lastPage,
    })
    const pngs = (await fs.promises.readdir(tmpDir))
      .filter((name) => name.endsWith('.png'))
      .sort((a, b) => {
        const na = Number(a.replace(/\D/g, '') || '0')
        const nb = Number(b.replace(/\D/g, '') || '0')
        return na - nb
      })
    if (pngs.length < count) throw new Error(`Poppler tạo ${pngs.length}/${count} ảnh`)
    const buffers: Buffer[] = []
    for (let index = 0; index < count; index++) {
      buffers.push(await fs.promises.readFile(path.join(tmpDir, pngs[index])))
    }
    return buffers
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (!(msg.includes('pdfinfo') || msg.includes('poppler') || msg.includes('pdftocairo') || msg.includes('ENOENT') || msg.includes('Unable to find') || msg.includes('tạo'))) {
      throw e
    }
    const buffers: Buffer[] = []
    for (let page = firstPage; page <= lastPage; page++) buffers.push(await extractPdfPage(pdfBuffer, page, dpi))
    return buffers
  } finally {
    if (tmpDir) fs.promises.rm(tmpDir, { recursive: true, force: true }).catch(() => {})
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

  const charge = translateCharge(formData, imageQuality)
  if (charge.error) return { error: charge.error }
  const COST = charge.cost
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

  const genAI = new GoogleGenerativeAI((await requireGoogleApiKeyForUser(user.id)).apiKey)
  const buffer = Buffer.from(await image.arrayBuffer())

  try {
    const { buffer: resultBuffer, error: translateError } = await translateOneImage(
      genAI,
      buffer,
      image.type || 'image/png',
      sourceLang,
      targetLang,
      imageQuality,
      user.id,
      null,
      { engine: charge.engine, gptQuality: charge.gptQuality }
    )
    if (translateError || !resultBuffer.length) {
      await deleteTryOnHistoryRowAndStorage(historyItem.id)
      return { error: translateError || 'AI không trả về ảnh hợp lệ.' }
    }

    const resultPath = `results/${user.id}/translate_${Date.now()}.png`
    const { publicUrl: resultPublicUrl } = await uploadTryOnImagePublic(resultPath, resultBuffer, {
      contentType: 'image/png',
      upsert: true,
    })

    const d = await deductUserCredits(user.id, COST, 'dich-anh-tai-lieu')
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

/** Đọc số trang, vài ảnh xem trước, và trang nào của đúng file này đã dịch xong. */
export async function getPdfPageInfo(
  formData: FormData
): Promise<{ pageCount: number; previews: string[]; fileHash?: string; pageKinds?: Array<'text' | 'scan'>; finishedPages?: number[]; error?: string }> {
  const pdfFile = formData.get('pdfFile') as File | null
  if (!pdfFile || pdfFile.size === 0) return { pageCount: 0, previews: [], error: 'Không có file.' }
  if (pdfFile.type !== 'application/pdf') return { pageCount: 0, previews: [], error: 'File phải là PDF.' }

  try {
    const pdfBuffer = Buffer.from(await pdfFile.arrayBuffer())
    if (pdfBuffer.length < 100) return { pageCount: 0, previews: [], error: 'File PDF quá nhỏ hoặc rỗng.' }

    const pageCount = await getPdfPageCount(pdfBuffer)
    if (pageCount === 0) return { pageCount: 0, previews: [], error: 'File PDF không có trang nào.' }
    if (pageCount > MAX_PDF_PAGES) return { pageCount, previews: [], error: `Tối đa ${MAX_PDF_PAGES} trang. File có ${pageCount} trang.` }

    const fileHash = rememberPdfSource(pdfBuffer, pageCount)
    const previewCount = Math.min(pageCount, PDF_PREVIEW_PAGES)
    const previews: string[] = []
    for (let page = 1; page <= previewCount; page++) {
      const png = await extractPdfPage(pdfBuffer, page, PDF_PREVIEW_DPI)
      previews.push(`data:image/png;base64,${png.toString('base64')}`)
    }
    let finishedPages: number[] = []
    const user = await getUserOrBypass()
    if (user) {
      const saved = await fetchPdfCheckpointRowsPg(user.id, pdfCheckpointLikePattern(hashPdfBuffer(pdfBuffer)))
      if (saved) {
        finishedPages = finishedPdfPages(
          saved.map((row) => ({
            page: pdfPageNumberFromUrl(row.originalImageUrl) ?? 0,
            historyStatus: row.historyStatus,
            hasResult: row.hasResult,
          }))
        )
      }
    }
    return { pageCount, previews, fileHash, finishedPages }
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

/** Ảnh nhỏ của một nhóm trang, để lưới chọn trang trong modal. Không dịch và không trừ credit. */
export async function getPdfThumbBatch(
  formData: FormData
): Promise<{ thumbs: Array<{ page: number; src: string }>; hash: string } | { error: string; code?: 'missing' }> {
  const requestedHash = String(formData.get('hash') ?? '').trim().toLowerCase()
  const file = formData.get('pdfFile')
  let source = /^[a-f0-9]{32}$/.test(requestedHash) ? readPdfSource(requestedHash) : null
  let hash = requestedHash
  if (!source && file instanceof File && file.size > 0) {
    if (file.type && file.type !== 'application/pdf') return { error: 'File phải là PDF.' }
    const buffer = Buffer.from(await file.arrayBuffer())
    if (buffer.length < 100) return { error: 'File PDF quá nhỏ hoặc rỗng.' }
    let pageCount = 0
    try {
      pageCount = await getPdfPageCount(buffer)
    } catch {
      return { error: 'Không đọc được file PDF.' }
    }
    if (pageCount < 1 || pageCount > MAX_PDF_PAGES) return { error: `Tối đa ${MAX_PDF_PAGES} trang.` }
    hash = rememberPdfSource(buffer, pageCount)
    source = readPdfSource(hash)
  }
  if (!source) return { error: 'Hết phiên xem ảnh. Chọn lại file PDF.', code: 'missing' }
  const pages = parseThumbPageList(String(formData.get('pages') ?? ''), source.pageCount, PDF_THUMB_BATCH)
  if (pages.length === 0) return { thumbs: [], hash }
  try {
    const thumbs: Array<{ page: number; src: string }> = []
    let index = 0
    while (index < pages.length) {
      let end = index
      while (end + 1 < pages.length && pages[end + 1] === pages[end] + 1) end += 1
      const buffers = await extractPdfPageRange(source.buffer, pages[index], pages[end], PDF_THUMB_DPI)
      for (let offset = 0; offset < buffers.length; offset++) {
        thumbs.push({ page: pages[index] + offset, src: `data:image/png;base64,${buffers[offset].toString('base64')}` })
      }
      index = end + 1
    }
    return { thumbs, hash }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { error: `Không tạo được ảnh trang.${msg ? ` ${msg}` : ''}` }
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

  const selection = readPdfJobOptions(formData, pageCount)
  if ('error' in selection) return selection
  if (selection.pages.length > 40) {
    return { error: 'PDF dài chạy từng trang ở tiến trình nền. Bấm Dịch trên trang dịch tài liệu.' }
  }
  const charge = translateCharge(formData, imageQuality)
  if (charge.error) return { error: charge.error }
  const COST_PER_PAGE = charge.cost
  const TOTAL_COST = selection.pages.length * COST_PER_PAGE
  let openBalPdf = 0
  try {
    openBalPdf = await getCreditBalanceByUserId(user.id)
  } catch {
    return { error: 'Không đọc được số dư credits.' }
  }
  if (toTenths(openBalPdf) < toTenths(TOTAL_COST)) {
    return { error: `Không đủ credits. Cần ${formatCredits(TOTAL_COST)} credits (${selection.pages.length} trang × ${formatCredits(COST_PER_PAGE)}).` }
  }

  const genAI = new GoogleGenerativeAI((await requireGoogleApiKeyForUser(user.id)).apiKey)
  const translatedPages: Array<{ png: Buffer; vectorPdf?: Buffer; lines: string[]; widthPt: number; heightPt: number }> = []
  const cacheKey = hashPdfBuffer(pdfBuffer)
  let pageBuffers = getCachedPdfExtract(cacheKey)
  if (!pageBuffers) {
    pageBuffers = await extractPdfPages(pdfBuffer, pageCount)
    pdfExtractCache.set(cacheKey, { buffers: pageBuffers, createdAt: Date.now() })
  } else {
    console.log('[translatePdfDocument] Dùng cache, không tách lại')
  }
  const described = await describePdfOrEmpty(pdfBuffer)

  for (const pageNumber of selection.pages) {
    const index = pageNumber - 1
    const desc = described[index]
    const meta: PdfPageMeta = {
      page: pageNumber,
      widthPt: desc?.widthPt ?? 0,
      heightPt: desc?.heightPt ?? 0,
      kind: desc?.kind === 'text' ? 'text' : 'scan',
      keepTerms: selection.keepTerms,
      lines: [],
      pagePdfPath: null,
    }
    const prepared = await translatePdfPageFromParts({
      genAI,
      userId: user.id,
      sourceLang,
      targetLang,
      imageQuality,
      engine: charge.engine,
      gptQuality: charge.gptQuality,
      png: pageBuffers[index],
      meta,
    })
    if (prepared.error || !prepared.png.length) {
      return { error: `Trang ${pageNumber}/${pageCount} thất bại: ${prepared.error || 'AI không trả về ảnh.'}` }
    }
    const dPage = await deductUserCredits(user.id, COST_PER_PAGE, 'dich-anh-tai-lieu')
    if (!dPage.ok) {
      return { error: dPage.code === 'INSUFFICIENT_CREDITS' ? 'Không đủ credits trong quá trình xử lý.' : dPage.error }
    }
    translatedPages.push({
      png: prepared.png,
      vectorPdf: prepared.vectorPdf,
      lines: prepared.lines,
      widthPt: meta.widthPt,
      heightPt: meta.heightPt,
    })
  }

  const outPdfBuffer = await buildPdfFromTranslatedPages(translatedPages)
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

/** Khởi tạo batch dịch PDF nền. Trang đã xong của cùng file được giữ, chỉ chạy trang chưa xong. */
export async function startTranslatePdfBatch(
  formData: FormData
): Promise<{ batchId: string; skipped: number; queued: number } | { error: string; batchId?: string }> {
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

  const selection = readPdfJobOptions(formData, pageCount)
  if ('error' in selection) return selection
  const charge = translateCharge(formData, imageQuality)
  if (charge.error) return { error: charge.error }
  const COST_PER_PAGE = charge.cost
  const fileHash = hashPdfBuffer(pdfBuffer)
  const saved = await fetchPdfCheckpointRowsPg(user.id, pdfCheckpointLikePattern(fileHash))
  if (saved == null) return { error: 'Không đọc được các trang đã dịch của file này.' }
  const checkpointRows: CheckpointRow[] = saved.map((row) => ({
    historyId: row.historyId,
    jobId: row.jobId,
    batchId: row.batchId,
    page: pdfPageNumberFromUrl(row.originalImageUrl) ?? 0,
    historyStatus: row.historyStatus,
    jobStatus: row.jobStatus,
    hasResult: row.hasResult,
    createdAt: row.createdAt,
    processingFresh: row.processingFresh,
  }))
  const plan = planPdfCheckpoint(selection.pages, checkpointRows)
  const runCount = plan.create.length + plan.requeue.length
  if (runCount > 0) {
    let openBalPdfBatch = 0
    try {
      openBalPdfBatch = await getCreditBalanceByUserId(user.id)
    } catch {
      return { error: 'Không đọc được số dư credits.' }
    }
    const totalCost = runCount * COST_PER_PAGE
    if (toTenths(openBalPdfBatch) < toTenths(totalCost)) {
      return {
        error: `Không đủ credits. Cần ${formatCredits(totalCost)} credits (${runCount} trang chưa xong × ${formatCredits(COST_PER_PAGE)}). ${plan.skip.length} trang đã xong được giữ.`,
      }
    }
  }

  const hasNewRun = plan.create.length > 0 || plan.requeue.length > 0
  const batchId = hasNewRun ? crypto.randomUUID() : plan.batchId || crypto.randomUUID()
  if (hasNewRun && plan.requeue.length > 0) {
    const moved = await moveTranslateHistoriesToBatchPg(
      user.id,
      plan.requeue.map((item) => item.historyId),
      batchId
    )
    if (!moved) return { error: 'Không tách được đợt dịch mới.', batchId: plan.batchId || undefined }
  }
  const baseUrl = getProcessTranslateBaseUrl()
  const secret = process.env.PROCESS_TRANSLATE_SECRET
  const headers: Record<string, string> = {}
  if (secret) headers['x-process-secret'] = secret
  const trigger = () => {
    setTimeout(
      () => fetch(`${baseUrl}/api/process-translate?batchId=${batchId}`, { headers }).catch((e) => console.warn('[startTranslatePdfBatch] trigger failed:', e)),
      500
    )
  }

  const needsFiles = plan.create.length > 0 || plan.requeue.length > 0
  const described: PdfPageDescription[] = []
  const writePage = async (pageNumber: number, raster: boolean): Promise<string> => {
    const index = pageNumber - 1
    const uploadPath = pdfCheckpointObjectPath(user.id, fileHash, index)
    let publicUrl = ''
    if (raster) {
      const png = await extractPdfPage(pdfBuffer, pageNumber)
      publicUrl = (await uploadTryOnImagePublic(uploadPath, png, { contentType: 'image/png', upsert: true })).publicUrl
    }
    const desc = described[index]
    const meta: PdfPageMeta = {
      page: pageNumber,
      widthPt: desc?.widthPt ?? 0,
      heightPt: desc?.heightPt ?? 0,
      kind: desc?.kind === 'text' ? 'text' : 'scan',
      keepTerms: selection.keepTerms,
      lines: [],
      pagePdfPath: null,
    }
    const metaPath = metaPathForImagePath(uploadPath)
    if (metaPath) {
      await uploadTryOnImagePublic(metaPath, Buffer.from(JSON.stringify(meta)), {
        contentType: 'application/json',
        upsert: true,
      })
    }
    return publicUrl
  }

  const requeueIds = plan.requeue.map((item) => item.jobId).filter((id): id is string => Boolean(id))
  if (requeueIds.length > 0) {
    const requeued = await requeueTranslateJobsPg({
      userId: user.id,
      jobIds: requeueIds,
      sourceLang,
      targetLang,
      imageQuality,
      cost: COST_PER_PAGE,
    })
    if (requeued == null) return { error: 'Không xếp lại được trang đang dở.', batchId }
  }
  if (plan.requeue.length > 0) {
    const marked = await markUnfinishedTranslateHistoriesProcessingPg(
      user.id,
      plan.requeue.map((item) => item.historyId)
    )
    if (marked == null) return { error: 'Không mở lại được trang đang dở.', batchId }
  }

  for (const item of plan.requeue) {
    if (item.jobId) continue
    const job = await insertTranslateJobPendingPg({
      userId: user.id,
      historyId: item.historyId,
      sourceLang,
      targetLang,
      imageQuality,
      cost: COST_PER_PAGE,
    })
    if (!job) return { error: 'Không thể tạo job. Kiểm tra DATABASE_URL và bảng translate_jobs.', batchId }
  }

  const queued = plan.requeue.length + plan.create.length
  if (plan.requeue.length > 0 || plan.keep.length > 0) trigger()
  if (needsFiles) {
    const pagesToCreate = plan.create.slice()
    const pagesToRefresh = plan.requeue.map((item) => item.page)
    void (async () => {
      try {
        described.push(...(await describePdfOrEmpty(pdfBuffer)))
        for (const pageNumber of pagesToRefresh) {
          await writePage(pageNumber, false)
        }
        for (const pageNumber of pagesToCreate) {
          const publicUrl = await writePage(pageNumber, true)
          const historyItem = await insertTryOnHistoryTranslateProcessingPg({
            userId: user.id,
            originalImageUrl: publicUrl,
            garmentImageUrl: publicUrl,
            batchId,
            batchType: 'pdf',
          })
          if (!historyItem) throw new Error('Không tạo được bản ghi trang ' + pageNumber)
          const job = await insertTranslateJobPendingPg({
            userId: user.id,
            historyId: historyItem.id,
            sourceLang,
            targetLang,
            imageQuality,
            cost: COST_PER_PAGE,
          })
          if (!job) {
            await deleteTryOnHistoryRowAndStorage(historyItem.id)
            throw new Error('Không tạo được job trang ' + pageNumber)
          }
          if (pagesToRefresh.length === 0 && pageNumber === pagesToCreate[0]) trigger()
        }
        trigger()
        revalidatePath('/dich-anh-tai-lieu')
        revalidatePath('/dashboard/history/translate')
      } catch (e) {
        console.error('[startTranslatePdfBatch] Xếp trang nền dừng tại trang đang dở. Bấm Dịch lại cùng file để chạy tiếp.', e)
      }
    })()
  }
  revalidatePath('/dich-anh-tai-lieu')
  revalidatePath('/dashboard/history/translate')
  return { batchId, skipped: plan.skip.length, queued }
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

  const charge = translateCharge(formData, imageQuality)
  if (charge.error) return { error: charge.error }
  const COST = charge.cost
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

  const genAI = new GoogleGenerativeAI((await requireGoogleApiKeyForUser(user.id)).apiKey)
  const buffer = Buffer.from(await image.arrayBuffer())
  const { buffer: resultBuffer, error: translateError } = await translateOneImage(
    genAI,
    buffer,
    image.type || 'image/png',
    sourceLang,
    targetLang,
    imageQuality,
    user.id,
    null,
    { engine: charge.engine, gptQuality: charge.gptQuality }
  )

  if (translateError || !resultBuffer.length) {
    return { error: translateError || 'AI không trả về ảnh.' }
  }

  const resultPath = `results/${user.id}/translate_batch_${timestamp}.png`
  const { publicUrl: batchResultPublicUrl } = await uploadTryOnImagePublic(resultPath, resultBuffer, {
    contentType: 'image/png',
    upsert: true,
  })

  const dBatch1 = await deductUserCredits(user.id, COST, 'dich-anh-tai-lieu')
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

  const charge = translateCharge(formData, imageQuality)
  if (charge.error) return { error: charge.error }
  const COST = charge.cost
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

  const genAI = new GoogleGenerativeAI((await requireGoogleApiKeyForUser(user.id)).apiKey)
  const { buffer: resultBuffer, error: translateError } = await translateOneImage(
    genAI,
    imageBuffer,
    'image/png',
    sourceLang,
    targetLang,
    imageQuality,
    user.id,
    null,
    { engine: charge.engine, gptQuality: charge.gptQuality }
  )

  if (translateError || !resultBuffer.length) {
    return { error: translateError || 'AI không trả về ảnh.' }
  }

  const resultPath = `results/${user.id}/translate_excel_${timestamp}.png`
  const { publicUrl: excelResultPublicUrl } = await uploadTryOnImagePublic(resultPath, resultBuffer, {
    contentType: 'image/png',
    upsert: true,
  })

  const dUrl = await deductUserCredits(user.id, COST, 'dich-anh-tai-lieu')
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

  const charge = translateCharge(formData, imageQuality)
  if (charge.error) return { error: charge.error }
  const COST_PER_IMAGE = charge.cost
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

  const genAI = new GoogleGenerativeAI((await requireGoogleApiKeyForUser(user.id)).apiKey)
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
      user.id,
      null,
      { engine: charge.engine, gptQuality: charge.gptQuality }
    )

    if (translateError || !resultBuffer.length) {
      const failed = i + 1
      return { error: `Ảnh ${failed}/${images.length} thất bại: ${translateError || 'AI không trả về ảnh.'}` }
    }

    const resultPath = `results/${user.id}/translate_batch_${batchTimestamp}_${i}.png`
    const { publicUrl: docBatchResultPublicUrl } = await uploadTryOnImagePublic(resultPath, resultBuffer, {
      contentType: 'image/png',
      upsert: true,
    })

    const dImg = await deductUserCredits(user.id, COST_PER_IMAGE, 'dich-anh-tai-lieu')
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
    zipEntries.push({ name: safeZipName(image.name, i), buffer: resultBuffer })
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

  const charge = translateCharge(formData, imageQuality)
  if (charge.error) return { error: charge.error }
  const COST_PER_IMAGE = charge.cost
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

    const cost = COST_PER_IMAGE
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

/** Khởi động lại chuỗi khi còn trang pending và không có trang đang chạy. Trang paused không bị đánh thức. */
export async function resumeBatchTranslate(batchId: string): Promise<void> {
  if (!batchId) return
  const result = await getUserForCreditAction()
  if ('error' in result) return
  const { user } = result
  const ids = await fetchTryOnHistoryIdsByBatchIdAndUserPg(batchId, user.id)
  if (!ids?.length) return
  const freshAfter = new Date(Date.now() - TRANSLATE_JOB_STALE_MS).toISOString()
  const counts = await countRunnableTranslateJobsPg(user.id, batchId, freshAfter)
  if (!counts || counts.pending < 1 || counts.processingFresh > 0) return
  const baseUrl = getProcessTranslateBaseUrl()
  const secret = process.env.PROCESS_TRANSLATE_SECRET
  const headers: Record<string, string> = {}
  if (secret) headers['x-process-secret'] = secret
  fetch(`${baseUrl}/api/process-translate?batchId=${batchId}`, { headers }).catch(() => {})
}

/** Dừng hàng chờ. Trang đang dịch vẫn lưu khi xong. Bấm Chạy tiếp để đi tiếp, không dịch lại trang đã xong. */
export async function pauseBatchTranslate(batchId: string): Promise<{ paused: number } | { error: string }> {
  if (!batchId) return { error: 'Thiếu batchId.' }
  const result = await getUserForCreditAction()
  if ('error' in result) return { error: result.error }
  const paused = await pauseTranslateBatchPg(result.user.id, batchId)
  if (paused == null) return { error: 'Không dừng được tiến trình.' }
  revalidatePath('/dich-anh-tai-lieu')
  revalidatePath(`/dich-anh-tai-lieu/tien-trinh/${batchId}`)
  revalidatePath('/dashboard/history/translate')
  return { paused }
}

/** Chạy tiếp từ trang chưa xong. Trang đã có kết quả không bị dịch lại và không bị trừ credit lần nữa. */
export async function continueBatchTranslate(batchId: string): Promise<{ retried: number } | { error: string }> {
  if (!batchId) return { error: 'Thiếu batchId.' }
  const result = await getUserForCreditAction()
  if ('error' in result) return { error: result.error }
  const retried = await continueTranslateBatchPg(result.user.id, batchId)
  if (retried == null) return { error: 'Không chạy tiếp được.' }
  if (retried === 0) return { error: 'Không có trang nào đang dở để chạy tiếp.' }
  await resumeBatchTranslate(batchId)
  revalidatePath('/dich-anh-tai-lieu')
  revalidatePath(`/dich-anh-tai-lieu/tien-trinh/${batchId}`)
  revalidatePath('/dashboard/history/translate')
  return { retried }
}

/** Dịch lại đúng các trang lỗi. Trang đã xong giữ nguyên. Credit chỉ trừ khi trang dịch lại xong. */
export async function retryFailedTranslatePages(batchId: string): Promise<{ retried: number } | { error: string }> {
  if (!batchId) return { error: 'Thiếu batchId.' }
  const result = await getUserForCreditAction()
  if ('error' in result) return { error: result.error }
  const retried = await reopenFailedTranslateBatchPg(result.user.id, batchId)
  if (retried == null) return { error: 'Không mở lại được trang lỗi.' }
  if (retried === 0) return { error: 'Không có trang lỗi để dịch lại.' }
  await resumeBatchTranslate(batchId)
  revalidatePath('/dich-anh-tai-lieu')
  revalidatePath(`/dich-anh-tai-lieu/tien-trinh/${batchId}`)
  revalidatePath('/dashboard/history/translate')
  return { retried }
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
      name: `${pagePrefix}_${pdfPageNumberFromUrl(item.original_image_url) ?? i + 1}_dich.png`,
    }))
  )
  if ('error' in zipResult) return zipResult

  const origEntries = completed
    .map((item, i: number) => ({ url: item.original_image_url, idx: i + 1 }))
    .filter((x): x is { url: string; idx: number } => Boolean(x.url))
  let originalZipUrl: string | undefined
  if (origEntries.length > 0) {
    const origResult = await createZipFromResults(
      origEntries.map((x) => ({
        resultUrl: x.url,
        name: `${pagePrefix}_${pdfPageNumberFromUrl(x.url) ?? x.idx}_goc.png`,
      }))
    )
    if ('zipUrl' in origResult && origResult.zipUrl) originalZipUrl = origResult.zipUrl
  }

  return { zipUrl: zipResult.zipUrl, originalZipUrl }
}

/** Các đợt dịch gần nhất, mới nhất trước. Mỗi lần bấm Dịch là một đợt. */
export async function listRecentTranslateBatches(): Promise<
  { batches: Array<{ batchId: string; startedAt: string; memberIds: string[] }> } | { error: string }
> {
  const result = await getUserForCreditAction()
  if ('error' in result) return { error: result.error }
  const rows = await listRecentTranslateBatchesPg(result.user.id)
  if (rows == null) return { error: 'Không tải được các đợt dịch.' }
  return { batches: rows }
}

/** Lấy tiến trình batch dịch – dùng cho trang tiến trình (polling). */
export async function getBatchProgress(batchId: string): Promise<
  { done: number; total: number; items: Array<{ id: string; status: string; original_image_url?: string; result_image_url?: string; error_message?: string | null; batch_type?: string | null; job_status?: string | null }>; cancelled?: number; isCancelled?: boolean } | { error: string }
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
    batch_type: r.batch_type,
    job_status: r.job_status,
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

  const charge = translateCharge(formData, imageQuality)
  if (charge.error) return { error: charge.error }
  const COST_PER_IMAGE = charge.cost
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

  const genAI = new GoogleGenerativeAI((await requireGoogleApiKeyForUser(user.id)).apiKey)
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
      user.id,
      null,
      { engine: charge.engine, gptQuality: charge.gptQuality }
    )

    if (translateError || !resultBuffer.length) {
      return { error: `Ảnh ${i + 1}/${urls.length} thất bại: ${translateError || 'AI không trả về ảnh.'}` }
    }

    const resultPath = `results/${user.id}/translate_excel_${batchTimestamp}_${i}.png`
    const { publicUrl: fromExcelResultPublicUrl } = await uploadTryOnImagePublic(resultPath, resultBuffer, {
      contentType: 'image/png',
      upsert: true,
    })

    const dExcel = await deductUserCredits(user.id, COST_PER_IMAGE, 'dich-anh-tai-lieu')
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
    zipEntries.push({ name: safeZipName(baseName, i), buffer: resultBuffer })
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

