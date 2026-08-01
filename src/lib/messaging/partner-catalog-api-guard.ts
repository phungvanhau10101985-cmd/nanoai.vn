import { NextResponse } from 'next/server'
import {
  baseCorsHeaders,
  guardPartnerInventorySearchApi,
  PARTNER_INVENTORY_SEARCH_API_ID_RE,
} from '@/lib/messaging/partner-inventory-search-api-guard'

export { PARTNER_INVENTORY_SEARCH_API_ID_RE }

export function catalogCorsHeaders(req: Request): HeadersInit {
  const base = baseCorsHeaders(req) as Record<string, string>
  return {
    ...base,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  }
}

export function headlessWriteCorsHeaders(req: Request): HeadersInit {
  const base = baseCorsHeaders(req) as Record<string, string>
  return {
    ...base,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}

export function headlessCartCorsHeaders(req: Request): HeadersInit {
  const base = baseCorsHeaders(req) as Record<string, string>
  return {
    ...base,
    'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
  }
}

export function headlessPersonalizationCorsHeaders(req: Request): HeadersInit {
  const base = baseCorsHeaders(req) as Record<string, string>
  return {
    ...base,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  }
}

export function jsonCatalogWithCors(req: Request, body: unknown, status: number, extra?: HeadersInit) {
  return NextResponse.json(body, {
    status,
    headers: { ...catalogCorsHeaders(req), ...extra },
  })
}

export function jsonHeadlessWriteWithCors(
  req: Request,
  body: unknown,
  status: number,
  extra?: HeadersInit
) {
  return NextResponse.json(body, {
    status,
    headers: { ...headlessWriteCorsHeaders(req), ...extra },
  })
}

export function jsonHeadlessCartWithCors(
  req: Request,
  body: unknown,
  status: number,
  extra?: HeadersInit
) {
  return NextResponse.json(body, {
    status,
    headers: { ...headlessCartCorsHeaders(req), ...extra },
  })
}

export function jsonHeadlessPersonalizationWithCors(
  req: Request,
  body: unknown,
  status: number,
  extra?: HeadersInit
) {
  return NextResponse.json(body, {
    status,
    headers: { ...headlessPersonalizationCorsHeaders(req), ...extra },
  })
}

/** Cùng Bearer + bật API tìm kho (`image_search_api_enabled`) — dùng chung cho catalog read. */
export async function guardPartnerCatalogApi(
  req: Request,
  partnerId: string
): Promise<NextResponse | null> {
  return guardPartnerInventorySearchApi(req, partnerId, 'catalog')
}
