import type { BarcodeType } from '@/lib/barcode/generate-barcode'
import type { HubStudioSession } from '@/lib/hub-chat/hub-studio-types'

export function isBarcodeLabelStepKey(stepKey: string | null | undefined): boolean {
  return stepKey === 'barcode_label'
}

function slugToken(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toUpperCase()
    .slice(0, 24)
}

/** Extract product / SKU code from user message. */
export function extractProductCode(message: string): string | null {
  const text = message.trim()
  if (!text) return null

  const labeled = text.match(
    /(?:mã\s*(?:sp|sản\s*phẩm|san\s*pham)|ma\s*(?:sp|san\s*pham)|sku|product\s*code|item\s*code|barcode)\s*[:=\-]?\s*([A-Za-z0-9][A-Za-z0-9\-_.]{1,40})/i
  )
  if (labeled?.[1]) return labeled[1].trim()

  const skuLike = text.match(/\b([A-Z]{2,5}-\d{3,10})\b/)
  if (skuLike?.[1]) return skuLike[1]

  const digits = text.match(/\b(\d{13})\b/)
  if (digits?.[1]) return digits[1]

  const digits12 = text.match(/\b(\d{12})\b/)
  if (digits12?.[1]) return digits12[1]

  return null
}

export function parseBarcodeType(message: string): BarcodeType {
  const text = message.trim()
  if (/\bean[\s-]*13\b/i.test(text) || /\b(\d{13})\b/.test(text)) return 'ean13'
  if (/\bupc[\s-]*a\b/i.test(text) || /\b(\d{12})\b/.test(text)) return 'upca'
  if (/\b(qr|qrcode|qr code)\b/i.test(text)) return 'qrcode'
  return 'code128'
}

function parseExplicitBarcodeContent(message: string, type: BarcodeType): string {
  const text = message.trim()
  if (!text) return ''
  if (type === 'qrcode') {
    return text.replace(/^.*?\b(?:qr|qrcode|qr code)\b\s*[:=\-]?\s*/i, '').trim()
  }
  if (type === 'code128') {
    const stripped = text.replace(/^.*?\b(?:code\s*128|code128)\b\s*[:=\-]?\s*/i, '').trim()
    if (stripped !== text) return stripped
  }
  if (
    /^(tạo|tao|làm|lam|create|generate|make)\b/i.test(text) &&
    /(mã|ma)\s*vạch|barcode/i.test(text) &&
    !extractProductCode(text)
  ) {
    return ''
  }
  return text
}

export function resolveBarcodeLabelInput(
  session: HubStudioSession,
  message: string
): { type: BarcodeType; content: string; brandName?: string; productName?: string; productCode: string } {
  const brandName = session.briefNotes.brand_name?.trim() || session.projectTitle?.trim() || undefined
  const productName = session.briefNotes.product_type?.trim() || undefined
  const labelBrief = session.briefNotes.product_label?.trim()

  const type = parseBarcodeType(message)
  const codeFromMessage = extractProductCode(message)
  let content = codeFromMessage ?? parseExplicitBarcodeContent(message, type)

  if (!content && labelBrief) {
    content = extractProductCode(labelBrief) ?? ''
  }

  if (!content) {
    const parts = [slugToken(brandName ?? ''), slugToken(productName ?? '')].filter(Boolean)
    content = parts.length ? parts.join('-') : 'PRODUCT-001'
  }

  if (type === 'ean13' && !/^\d{13}$/.test(content)) {
    return {
      type: 'code128',
      content,
      brandName,
      productName,
      productCode: content,
    }
  }
  if (type === 'upca' && !/^\d{12}$/.test(content)) {
    return {
      type: 'code128',
      content,
      brandName,
      productName,
      productCode: content,
    }
  }

  return { type, content, brandName, productName, productCode: content }
}
