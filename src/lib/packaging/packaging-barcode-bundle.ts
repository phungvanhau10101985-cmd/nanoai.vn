import type { WebLocale } from '@/lib/i18n/config'
import type { HubStudioSession } from '@/lib/hub-chat/hub-studio-types'
import { generateBarcodeLabelBuffer } from '@/lib/barcode/generate-barcode-label'
import { validateBarcodeContent, type BarcodeType } from '@/lib/barcode/generate-barcode'
import { uploadTryOnImagePublic } from '@/lib/storage/try-on-public-upload'
import {
  MAX_PACKAGING_BARCODE_ENTRIES,
  barcodeBundleNote,
  barcodeDownloadLabel,
  barcodeFormValidationError,
  barcodeLabelScanHint,
  buildPackagingQrPayload,
  combinedQrArtifactLabel,
  normalizeBarcodeDataFields,
  type PackagingBarcodeFormEntry,
} from '@/lib/packaging/packaging-barcode-form'

export type { PackagingBarcodeFormEntry } from '@/lib/packaging/packaging-barcode-form'
export {
  MAX_PACKAGING_BARCODE_ENTRIES,
  barcodeFormValidationError,
  buildPackagingQrPayload,
  defaultBarcodeFormEntries,
  normalizeBarcodeDataFields,
  packagingBarcodeIsReady,
} from '@/lib/packaging/packaging-barcode-form'

export type PackagingBarcodeArtifact = {
  id: string
  type: BarcodeType
  content: string
  label: string
  url: string
  fileName: string
}

export type PackagingBarcodeStudioArtifact = PackagingBarcodeArtifact & {
  downloadLabel: string
}

function parseFormBarcodeType(raw: string | undefined): BarcodeType {
  const value = String(raw ?? '').trim().toLowerCase()
  if (value === 'qrcode' || value === 'ean13' || value === 'upca' || value === 'code128') {
    return value
  }
  return 'code128'
}

export function inferBarcodeTypeForContent(
  requested: BarcodeType,
  content: string
): BarcodeType {
  const trimmed = content.trim()
  if (!trimmed) return requested
  if (requested === 'qrcode' || requested === 'ean13' || requested === 'upca') {
    return requested
  }
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('WIFI:') || trimmed.startsWith('BEGIN:VCARD')) {
    return 'qrcode'
  }
  if (/^\d{13}$/.test(trimmed)) return 'ean13'
  if (/^\d{12}$/.test(trimmed)) return 'upca'
  return 'code128'
}

export function normalizeBarcodeFormEntry(
  raw: PackagingBarcodeFormEntry & { type?: BarcodeType }
): { type: BarcodeType; content: string; label?: string } | null {
  const content = String(raw.content ?? '').trim()
  if (!content) return null
  let type = inferBarcodeTypeForContent(parseFormBarcodeType(raw.type), content)
  if (type === 'ean13' && !/^\d{13}$/.test(content)) type = 'code128'
  if (type === 'upca' && !/^\d{12}$/.test(content)) type = 'code128'
  const validationError = validateBarcodeContent(type, content)
  if (validationError) return null
  const label = String(raw.label ?? '').trim() || undefined
  return { type, content, label }
}

export function normalizeBarcodeFormEntries(
  entries: (PackagingBarcodeFormEntry & { type?: BarcodeType })[] | undefined
): { type: BarcodeType; content: string; label?: string }[] {
  if (!entries?.length) return []
  const out: { type: BarcodeType; content: string; label?: string }[] = []
  for (const entry of entries.slice(0, MAX_PACKAGING_BARCODE_ENTRIES)) {
    const normalized = normalizeBarcodeFormEntry(entry)
    if (normalized) out.push(normalized)
  }
  return out
}

export async function exportPackagingBarcodeBundle(input: {
  userId: string
  locale: WebLocale
  session: HubStudioSession
  entries: PackagingBarcodeFormEntry[]
}): Promise<
  | {
      artifacts: PackagingBarcodeArtifact[]
      studioArtifacts: PackagingBarcodeStudioArtifact[]
      primary: PackagingBarcodeArtifact
      formEntries: PackagingBarcodeFormEntry[]
      qrPayload: string
      note: string
      downloadLabel: string
    }
  | { error: string }
> {
  const { userId, locale, session, entries } = input
  if (entries.length > MAX_PACKAGING_BARCODE_ENTRIES) {
    return { error: barcodeFormValidationError(locale, 'too_many') }
  }
  const fields = normalizeBarcodeDataFields(entries)
  if (!fields.length) {
    return { error: barcodeFormValidationError(locale, 'empty') }
  }
  const qrPayload = buildPackagingQrPayload(fields)
  const payloadError = validateBarcodeContent('qrcode', qrPayload)
  if (payloadError) {
    return { error: barcodeFormValidationError(locale, 'empty') }
  }

  const brandName = session.briefNotes.brand_name?.trim() || session.projectTitle?.trim() || undefined
  const productName = session.briefNotes.product_type?.trim() || undefined
  const stamp = Date.now()
  const formEntries = fields.map((field) => ({
    label: field.label,
    content: field.content,
  }))

  const buffer = await generateBarcodeLabelBuffer({
    type: 'qrcode',
    content: qrPayload,
    brandName,
    productName,
    productCode: barcodeLabelScanHint(locale, fields.length),
  })
  const fileName = `product-qr-${fields.length}-fields.png`
  const path = `results/${userId}/packaging_barcode_${stamp}_combined_qr.png`
  const { publicUrl } = await uploadTryOnImagePublic(path, buffer, {
    contentType: 'image/png',
    upsert: true,
  })
  const artifact: PackagingBarcodeArtifact = {
    id: `combined-qr-${stamp}`,
    type: 'qrcode',
    content: qrPayload,
    label: combinedQrArtifactLabel(locale),
    url: publicUrl,
    fileName,
  }

  const downloadLabel = barcodeDownloadLabel(locale)
  const studioArtifacts: PackagingBarcodeStudioArtifact[] = [
    { ...artifact, downloadLabel },
  ]
  return {
    artifacts: [artifact],
    studioArtifacts,
    primary: artifact,
    formEntries,
    qrPayload,
    note: barcodeBundleNote(locale, fields.length),
    downloadLabel,
  }
}
