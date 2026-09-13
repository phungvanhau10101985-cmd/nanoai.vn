export type PartnerGoLiveItemId =
  | 'brand'
  | 'website'
  | 'products'
  | 'payment'
  | 'shipping'
  | 'logo'
  | 'slogan'
  | 'domain'
  | 'ads'
  | 'contact'
  | 'return_address'
  | 'sepay_hmac'

export type PartnerGoLiveItem = {
  id: PartnerGoLiveItemId
  required: boolean
  done: boolean
}

export type PartnerGoLiveFacts = {
  displayName: string
  brandName: string
  logoUrl: string
  contactPhone: string
  contactZaloUrl: string
  facebookPixelId: string
  ga4MeasurementId: string
  tiktokPixelId: string
  gtmContainerId: string
  websitePublished: boolean
  websiteExists: boolean
  slogan: string
  websiteLogoUrl: string
  inventoryCount: number
  hasPaymentSettings: boolean
  paymentReady: boolean
  sepayEnabled: boolean
  sepayHmacConfigured: boolean
  hasCustomDomain: boolean
  returnAddress: string
}

export function partnerPaymentReady(input: {
  depositMode?: string | null
  accountNumber?: string | null
  accountHolder?: string | null
  sepayEnabled?: boolean
  sepayBankCode?: string | null
  sepayAccountNumber?: string | null
}): boolean {
  if (String(input.depositMode || '').trim() === 'none') return true
  const bank =
    Boolean(String(input.accountNumber || '').trim()) && Boolean(String(input.accountHolder || '').trim())
  const sepay =
    input.sepayEnabled === true &&
    Boolean(String(input.sepayBankCode || '').trim()) &&
    Boolean(String(input.sepayAccountNumber || '').trim())
  return bank || sepay
}

export function buildPartnerGoLiveChecklist(facts: PartnerGoLiveFacts): PartnerGoLiveItem[] {
  const brandOk = Boolean(facts.brandName.trim() || facts.displayName.trim())
  const items: PartnerGoLiveItem[] = [
    { id: 'brand', required: true, done: brandOk },
    { id: 'website', required: true, done: facts.websiteExists && facts.websitePublished },
    { id: 'products', required: true, done: facts.inventoryCount > 0 },
    { id: 'payment', required: true, done: facts.paymentReady },
    { id: 'shipping', required: true, done: facts.hasPaymentSettings },
    { id: 'logo', required: false, done: Boolean(facts.logoUrl.trim() || facts.websiteLogoUrl.trim()) },
    { id: 'slogan', required: false, done: Boolean(facts.slogan.trim()) },
    { id: 'domain', required: false, done: facts.hasCustomDomain },
    {
      id: 'ads',
      required: false,
      done: Boolean(
        facts.facebookPixelId.trim() ||
          facts.ga4MeasurementId.trim() ||
          facts.tiktokPixelId.trim() ||
          facts.gtmContainerId.trim()
      ),
    },
    {
      id: 'contact',
      required: false,
      done: Boolean(facts.contactPhone.trim() || facts.contactZaloUrl.trim()),
    },
    { id: 'return_address', required: false, done: Boolean(facts.returnAddress.trim()) },
  ]
  if (facts.sepayEnabled) {
    items.push({ id: 'sepay_hmac', required: false, done: facts.sepayHmacConfigured })
  }
  return items
}

export function partnerGoLiveProgress(items: PartnerGoLiveItem[]): {
  requiredDone: number
  requiredTotal: number
  optionalDone: number
  optionalTotal: number
  ready: boolean
} {
  const required = items.filter((item) => item.required)
  const optional = items.filter((item) => !item.required)
  const requiredDone = required.filter((item) => item.done).length
  return {
    requiredDone,
    requiredTotal: required.length,
    optionalDone: optional.filter((item) => item.done).length,
    optionalTotal: optional.length,
    ready: required.length > 0 && requiredDone === required.length,
  }
}

export function partnerGoLiveSectionForItem(id: PartnerGoLiveItemId): string {
  switch (id) {
    case 'brand':
    case 'logo':
    case 'slogan':
      return 'brand'
    case 'website':
      return 'partner-website-editor'
    case 'products':
      return 'inventory'
    case 'payment':
    case 'sepay_hmac':
      return 'payment'
    case 'shipping':
    case 'return_address':
      return 'shipping'
    case 'domain':
      return 'domains'
    case 'ads':
      return 'analytics-ads'
    case 'contact':
      return 'channels'
    default:
      return 'workspace'
  }
}
