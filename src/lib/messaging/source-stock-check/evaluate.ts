import { evaluateCssbuyPdpStock } from './cssbuy-probe'
import { evaluatePandamallSourceStock } from './pandamall-probe'
import { evaluateVipomallSourceStockFromUrl } from './vipomall-probe'
import type { SourceStockCheckResult, SourceStockPreviewUrlResult } from './source-stock-types'
import {
  coerceUrlForSourceStock,
  linkEligibleForSourceStockCheck,
  resolveNumeric1688OfferIdFromSourceUrl,
  resultShouldFallbackNextPlatform,
  SOURCE_STOCK_ELIGIBLE_MARKERS,
} from './source-stock-urls'
import { normalizeProductImportUrl } from '@/lib/messaging/listing-import/import-source-ids'

function skipped(): SourceStockCheckResult {
  return { status: 'skipped', error: null, checked_via: null }
}

function bubble(r: SourceStockCheckResult): SourceStockCheckResult {
  return {
    status: (r.status || '').trim(),
    error: r.error,
    checked_via: r.checked_via,
  }
}

export function mergeAllPlatformsBlockedOrError(
  css: SourceStockCheckResult,
  vm: SourceStockCheckResult,
  panda: SourceStockCheckResult
): SourceStockCheckResult {
  const attempts = [css, vm, panda]
  const real = attempts.filter((a) => {
    const st = (a.status || '').trim().toLowerCase()
    return st && st !== 'skipped'
  })
  if (real.length && real.every((a) => (a.status || '').trim().toLowerCase() === 'blocked')) {
    return {
      status: 'blocked',
      error: 'Vipomall, PandaMall và CSSBuy đều bị Cloudflare/CAPTCHA — dừng.'.slice(0, 1000),
      checked_via: 'cssbuy+vipomall+pandamall',
    }
  }
  const last =
    (panda.status || '') !== 'skipped' && panda.status
      ? panda
      : (vm.status || '') !== 'skipped' && vm.status
        ? vm
        : css
  const parts: string[] = []
  for (const a of attempts) {
    const st = (a.status || '').trim()
    if (st && st !== 'skipped') parts.push(`${a.checked_via || '?'}:${st}`)
  }
  let err = (last.error || 'Không đọc được nút giỏ/mua trên mọi nền.').slice(0, 800)
  if (parts.length) err = `${err} [${parts.join(', ')}]`.slice(0, 1000)
  return {
    status: 'error',
    error: err,
    checked_via: 'cssbuy+vipomall+pandamall',
  }
}

export async function evaluateStockPrimaryCssbuyWithFallbacks(
  rawUrl: string,
  opts?: { fallbackProductId?: string | null; partnerId?: string | null }
): Promise<SourceStockCheckResult> {
  return evaluateStockWithProbeChain({
    cssbuy: () => evaluateCssbuyPdpStock(rawUrl, opts?.partnerId),
    vipomall: () =>
      evaluateVipomallSourceStockFromUrl(rawUrl, {
        fallbackProductId: opts?.fallbackProductId,
        partnerId: opts?.partnerId,
      }),
    pandamall: () => evaluatePandamallSourceStock(rawUrl, opts?.partnerId),
  })
}

export async function evaluateStockWithProbeChain(probes: {
  cssbuy: () => Promise<SourceStockCheckResult>
  vipomall: () => Promise<SourceStockCheckResult>
  pandamall: () => Promise<SourceStockCheckResult>
}): Promise<SourceStockCheckResult> {
  const vm = await probes.vipomall()
  if (!resultShouldFallbackNextPlatform(vm.status)) return vm
  const panda = await probes.pandamall()
  if (!resultShouldFallbackNextPlatform(panda.status)) return panda
  const css = await probes.cssbuy()
  if (!resultShouldFallbackNextPlatform(css.status)) return css
  return mergeAllPlatformsBlockedOrError(css, vm, panda)
}

/** Preview giống worker: Vipomall → PandaMall → CSSBuy. Chỉ Cloudflare mới chuyển nền. Không ghi DB. */
export async function adminPreviewSourceStockByUrl(
  rawUrl: string,
  partnerId?: string | null
): Promise<SourceStockPreviewUrlResult> {
  const stripped = (rawUrl || '').trim()
  const canon = (normalizeProductImportUrl(stripped) || stripped).trim()
  const cssC = coerceUrlForSourceStock(canon, 'cssbuy')
  const vmC = coerceUrlForSourceStock(canon, 'vipomall')
  const pdC = coerceUrlForSourceStock(canon, 'pandamall')
  const coercion = {
    cssbuy_url: (cssC.url || '').trim(),
    cssbuy_coercion_error: (cssC.error || '').trim(),
    vipomall_url: (vmC.url || '').trim(),
    vipomall_coercion_error: (vmC.error || '').trim(),
    pandamall_url: (pdC.url || '').trim(),
    pandamall_coercion_error: (pdC.error || '').trim(),
  }
  const eligible = linkEligibleForSourceStockCheck(canon)
  if (!eligible) {
    const note = `Link không thuộc miền được worker PDP kiểm tra — cần chứa một trong: ${SOURCE_STOCK_ELIGIBLE_MARKERS.join(', ')}`
    const errR: SourceStockCheckResult = { status: 'error', error: note.slice(0, 1000), checked_via: null }
    return {
      ok: true,
      canonical_input: canon,
      link_eligible: false,
      coercion,
      cssbuy: bubble(skipped()),
      vipomall: bubble(skipped()),
      pandamall: bubble(skipped()),
      merged: bubble(errR),
    }
  }

  const vm = await evaluateVipomallSourceStockFromUrl(canon, {
    partnerId,
    fallbackProductId: resolveNumeric1688OfferIdFromSourceUrl(canon),
  })
  if (!resultShouldFallbackNextPlatform(vm.status)) {
    return {
      ok: true,
      canonical_input: canon,
      link_eligible: true,
      coercion,
      cssbuy: bubble(skipped()),
      vipomall: bubble(vm),
      pandamall: bubble(skipped()),
      merged: bubble(vm),
    }
  }
  const panda = await evaluatePandamallSourceStock(canon, partnerId)
  if (!resultShouldFallbackNextPlatform(panda.status)) {
    return {
      ok: true,
      canonical_input: canon,
      link_eligible: true,
      coercion,
      cssbuy: bubble(skipped()),
      vipomall: bubble(vm),
      pandamall: bubble(panda),
      merged: bubble(panda),
    }
  }
  const css = await evaluateCssbuyPdpStock(canon, partnerId)
  const merged = resultShouldFallbackNextPlatform(css.status)
    ? mergeAllPlatformsBlockedOrError(css, vm, panda)
    : css
  return {
    ok: true,
    canonical_input: canon,
    link_eligible: true,
    coercion,
    cssbuy: bubble(css),
    vipomall: bubble(vm),
    pandamall: bubble(panda),
    merged: bubble(merged),
  }
}
