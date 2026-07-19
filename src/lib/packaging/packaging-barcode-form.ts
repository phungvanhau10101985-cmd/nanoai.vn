import type { WebLocale } from '@/lib/i18n/config'
import type { HubStudioSession } from '@/lib/hub-chat/hub-studio-types'

export const MAX_PACKAGING_BARCODE_ENTRIES = 8

export type PackagingBarcodeFormEntry = {
  label?: string
  content: string
}

/** Normalize data-field rows for a combined product QR. */
export function normalizeBarcodeDataFields(
  entries: PackagingBarcodeFormEntry[] | undefined
): { label?: string; content: string }[] {
  if (!entries?.length) return []
  const out: { label?: string; content: string }[] = []
  for (const entry of entries.slice(0, MAX_PACKAGING_BARCODE_ENTRIES)) {
    const content = String(entry.content ?? '').trim()
    if (!content) continue
    const label = String(entry.label ?? '').trim() || undefined
    out.push({ label, content })
  }
  return out
}

/** Build plain-text QR payload — phone scanners show all labeled fields when scanned. */
export function buildPackagingQrPayload(
  entries: { label?: string; content: string }[]
): string {
  const lines: string[] = []
  for (const entry of entries) {
    if (entry.label) {
      lines.push(`${entry.label}: ${entry.content}`)
    } else {
      lines.push(entry.content)
    }
  }
  return lines.join('\n')
}

export function defaultBarcodeFormEntries(session: HubStudioSession): PackagingBarcodeFormEntry[] {
  const brandName = session.briefNotes.brand_name?.trim()
  const productName = session.briefNotes.product_type?.trim()
  const website = session.briefNotes.website?.trim() || session.briefNotes.brand_website?.trim()
  return [
    {
      content: website?.startsWith('http') ? website : website ? `https://${website}` : '',
      label: brandName ? `${brandName} web` : undefined,
    },
    {
      content: '',
      label: productName ? `${productName} SKU` : undefined,
    },
  ]
}

export function barcodeFormValidationError(
  locale: WebLocale,
  kind: 'empty' | 'too_many'
): string {
  const rows: Record<WebLocale, Record<'empty' | 'too_many', string>> = {
    vi: {
      empty: 'Nhập ít nhất một trường dữ liệu (link, SKU, số EAN…).',
      too_many: `Tối đa ${MAX_PACKAGING_BARCODE_ENTRIES} trường mỗi lần tạo.`,
    },
    en: {
      empty: 'Enter at least one data field (link, SKU, EAN digits…).',
      too_many: `Up to ${MAX_PACKAGING_BARCODE_ENTRIES} fields per batch.`,
    },
    zh: {
      empty: '请至少填写一条数据（链接、SKU、EAN 数字等）。',
      too_many: `每次最多 ${MAX_PACKAGING_BARCODE_ENTRIES} 个字段。`,
    },
    ja: {
      empty: '少なくとも1件のデータ（リンク、SKU、EAN数字など）を入力してください。',
      too_many: `1回あたり最大 ${MAX_PACKAGING_BARCODE_ENTRIES} 件です。`,
    },
    ko: {
      empty: '데이터(링크, SKU, EAN 숫자 등)를 최소 1개 입력하세요.',
      too_many: `한 번에 최대 ${MAX_PACKAGING_BARCODE_ENTRIES}개 필드까지 가능합니다.`,
    },
  }
  return rows[locale][kind]
}

export function packagingBarcodeIsReady(
  packaging: HubStudioSession['packaging'] | undefined
): boolean {
  if (!packaging) return false
  if (packaging.barcodeArtifacts?.length) return true
  return Boolean(packaging.barcodeUrl)
}

export function barcodeDownloadLabel(locale: WebLocale): string {
  const rows: Record<WebLocale, string> = {
    vi: 'Tải nhãn mã vạch',
    en: 'Download barcode label',
    zh: '下载条码标签',
    ja: 'バーコードラベルをダウンロード',
    ko: '바코드 라벨 다운로드',
  }
  return rows[locale]
}

export function barcodeBundleNote(locale: WebLocale, fieldCount: number): string {
  const rows: Record<WebLocale, string> = {
    vi: `Đã tạo 1 mã QR chứa ${fieldCount} trường dữ liệu — quét để xem toàn bộ thông tin (thư viện chuẩn, không phải ảnh AI).`,
    en: `Created one QR code with ${fieldCount} data fields — scan to view all product information (standard library, not AI art).`,
    zh: `已生成 1 个 QR，包含 ${fieldCount} 条数据 — 扫描即可查看全部信息（标准库，非 AI 图）。`,
    ja: `${fieldCount}件のデータを含むQRコードを1つ作成しました — スキャンですべての情報を表示（標準ライブラリ、AI画像ではありません）。`,
    ko: `데이터 ${fieldCount}개를 담은 QR 코드 1개를 생성했습니다 — 스캔하면 모든 정보를 확인할 수 있습니다(표준 라이브러리, AI 아님).`,
  }
  return rows[locale]
}

export function barcodeLabelScanHint(locale: WebLocale, fieldCount: number): string {
  const rows: Record<WebLocale, string> = {
    vi: `Quét QR — ${fieldCount} trường thông tin`,
    en: `Scan QR — ${fieldCount} data fields`,
    zh: `扫描二维码 — ${fieldCount} 条数据`,
    ja: `QRをスキャン — ${fieldCount}件の情報`,
    ko: `QR 스캔 — ${fieldCount}개 데이터`,
  }
  return rows[locale]
}

export function combinedQrArtifactLabel(locale: WebLocale): string {
  const rows: Record<WebLocale, string> = {
    vi: 'QR sản phẩm (tất cả thông tin)',
    en: 'Product QR (all information)',
    zh: '产品 QR（全部信息）',
    ja: '製品QR（全情報）',
    ko: '제품 QR (전체 정보)',
  }
  return rows[locale]
}
