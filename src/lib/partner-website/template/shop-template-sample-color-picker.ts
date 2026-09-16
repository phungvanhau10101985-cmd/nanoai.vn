import type { WebLocale } from '@/lib/i18n/config'
import { getPartnerWebsiteCopy } from '@/lib/i18n/partner-website-copy'
import { escapeAttr, escapeHtml } from '@/lib/packaging/mockup-share-html'
import type { PartnerWebsiteTheme } from '@/lib/partner-website/template/partner-website-template-types'
import { getShopTemplatePreset } from '@/lib/partner-website/template/shop-template-presets'
import {
  hexesClose,
  isHexColor,
  normalizeHexColor,
  SHOP_MAIN_COLOR_SWATCHES,
  themeCssVarMap,
  themeFromMainSwatch,
  type ShopColorSwatch,
} from '@/lib/partner-website/template/partner-website-theme-tokens'

export const PW_SAMPLE_COLORS_ATTR = 'data-pw-sample-colors'
export const PW_SAMPLE_APPLY_PRESET_PARAM = 'applyPreset'
export const PW_SAMPLE_APPLY_COLOR_PARAM = 'color'
const PW_SAMPLE_COLOR_STYLE_ID = 'pw-sample-color-css'
const PW_SAMPLE_COLOR_CFG_ID = 'pw-sample-color-cfg'
const PW_SAMPLE_APPLY_ATTR = 'data-pw-sample-apply'

/** Dashboard URL that applies this gallery sample (look + currently shown hue). */
export function shopTemplateSampleApplyDashboardPath(
  presetId: string,
  colorHex?: string | null
): string {
  const params = new URLSearchParams()
  params.set(PW_SAMPLE_APPLY_PRESET_PARAM, presetId)
  const hex = parseShopTemplateSampleColorParam(colorHex)
  if (hex) params.set(PW_SAMPLE_APPLY_COLOR_PARAM, hex.slice(1))
  return `/dashboard/messaging/website?${params.toString()}`
}

/** Keep applyPreset + color when the website hub redirects to a tenant slug. */
export function withShopTemplateSampleApplyQuery(
  path: string,
  search: Record<string, string | string[] | undefined> | URLSearchParams
): string {
  const read = (key: string): string => {
    if (search instanceof URLSearchParams) return search.get(key)?.trim() || ''
    const raw = search[key]
    return String(Array.isArray(raw) ? raw[0] : raw || '').trim()
  }
  const preset = read(PW_SAMPLE_APPLY_PRESET_PARAM)
  if (!preset) return path
  const query = shopTemplateSampleApplyDashboardPath(preset, read(PW_SAMPLE_APPLY_COLOR_PARAM)).split('?')[1]
  return query ? `${path}?${query}` : path
}

/** Query `?color=2563eb` / `#2563eb` on `/mau-giao-dien/{preset}`. */
export function parseShopTemplateSampleColorParam(raw: string | null | undefined): string | null {
  const v = String(raw || '').trim()
  if (!v) return null
  const hex = v.startsWith('#') ? v : `#${v}`
  if (!isHexColor(hex)) return null
  return normalizeHexColor(hex, hex)
}

/**
 * Picking the preset's own primary restores the original theme (marketplace can keep
 * a distinct buy color). Any other hue follows `themeFromMainSwatch`.
 */
export function shopTemplateSampleThemeForPrimary(
  base: PartnerWebsiteTheme,
  hex: string | null | undefined
): PartnerWebsiteTheme {
  const parsed = parseShopTemplateSampleColorParam(hex)
  if (!parsed) return base
  if (hexesClose(parsed, base.primaryColor)) return base
  return themeFromMainSwatch(base, parsed)
}

export function shopTemplateSampleColorSwatches(theme: PartnerWebsiteTheme): ShopColorSwatch[] {
  const primary = normalizeHexColor(theme.primaryColor, '#f97316')
  const seen = new Set<string>()
  const out: ShopColorSwatch[] = []
  const add = (id: string, hex: string) => {
    const next = normalizeHexColor(hex, '')
    if (!next || seen.has(next)) return
    seen.add(next)
    out.push({ id, hex: next })
  }
  add('preset', primary)
  for (const swatch of SHOP_MAIN_COLOR_SWATCHES) add(swatch.id, swatch.hex)
  return out
}

const SAMPLE_COLOR_CSS = `html:has([data-pw-sample-colors]){scroll-padding-top:52px}
html:has([data-pw-sample-colors]) body{padding-top:52px}
html:has([data-pw-sample-colors]) .pw-header,html:has([data-pw-sample-colors]) .pw-shop-header{top:52px}
[data-pw-sample-colors]{position:fixed;z-index:10050;top:0;left:0;right:0;bottom:auto;width:auto;max-width:none;height:52px;display:flex;align-items:center;gap:10px;padding:0 16px;border:0;border-bottom:1px solid #e5e7eb;border-radius:0;background:#fff;color:#111827;box-shadow:0 4px 18px rgba(15,23,42,.08);font:600 12px/1.3 system-ui,-apple-system,"Segoe UI",sans-serif;box-sizing:border-box}
[data-pw-sample-preset-code],[data-pw-sample-colors]:not(:has([data-pw-sample-preset-code])) [data-pw-sample-colors-title]{margin-left:auto}
[data-pw-sample-preset-code]{flex:0 0 auto;display:inline-flex;align-items:center;height:22px;padding:0 8px;border-radius:6px;background:#111827;color:#fff;font:700 11px/1 system-ui,-apple-system,"Segoe UI",sans-serif;letter-spacing:.04em}
[data-pw-sample-colors] [data-pw-sample-colors-title]{margin:0;flex:0 0 auto;font-size:12px;font-weight:700;letter-spacing:.02em;color:#111827;white-space:nowrap}
[data-pw-sample-swatches]{display:flex;flex-wrap:nowrap;align-items:center;gap:6px;min-width:0;overflow-x:auto;padding:4px 0}
[data-pw-sample-swatches] button{flex:0 0 22px;width:22px;height:22px;min-height:22px;padding:0;border-radius:7px;border:1px solid rgba(15,23,42,.18);cursor:pointer;box-shadow:0 1px 2px rgba(15,23,42,.08)}
[data-pw-sample-swatches] button[aria-pressed="true"]{outline:2px solid #111827;outline-offset:1px}
[data-pw-sample-custom]{display:flex;align-items:center;gap:6px;margin:0;color:#4b5563;font-weight:600;cursor:pointer;white-space:nowrap}
[data-pw-sample-custom] input[type="color"]{width:22px;height:22px;padding:0;border:1px solid #e5e7eb;border-radius:6px;background:#fff;cursor:pointer}
[data-pw-sample-apply]{flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;height:32px;padding:0 12px;border-radius:8px;background:var(--pw-buy,#111827);color:#fff;font:700 12px/1 system-ui,-apple-system,"Segoe UI",sans-serif;text-decoration:none;white-space:nowrap}
[data-pw-sample-apply]:hover{filter:brightness(1.06)}
@media (max-width:640px){[data-pw-sample-colors]{height:56px;padding:0 10px;gap:8px}html:has([data-pw-sample-colors]) body{padding-top:56px}html:has([data-pw-sample-colors]) .pw-header,html:has([data-pw-sample-colors]) .pw-shop-header{top:56px}[data-pw-sample-custom] span{display:none}[data-pw-sample-apply]{height:30px;padding:0 10px;font-size:11px}}`

function sampleColorPickerScript(): string {
  return `(()=>{var cfgEl=document.getElementById("${PW_SAMPLE_COLOR_CFG_ID}");if(!cfgEl)return;var cfg;try{cfg=JSON.parse(cfgEl.textContent||"{}")}catch(e){return}
function n(h){h=String(h||"").trim();if(!h)return"";if(h.charAt(0)!=="#")h="#"+h;if(/^#[0-9a-fA-F]{3}$/.test(h)){var s=h.slice(1);return("#"+s.charAt(0)+s.charAt(0)+s.charAt(1)+s.charAt(1)+s.charAt(2)+s.charAt(2)).toLowerCase()}if(/^#[0-9a-fA-F]{6}$/.test(h))return h.toLowerCase();return""}
function rgb(h){h=n(h);return[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)]}
function hx(r,g,b){function c(x){x=Math.max(0,Math.min(255,Math.round(x)));return x.toString(16).padStart(2,"0")}return"#"+c(r)+c(g)+c(b)}
function mix(a,b,t){var A=rgb(a),B=rgb(b);return hx(A[0]+(B[0]-A[0])*t,A[1]+(B[1]-A[1])*t,A[2]+(B[2]-A[2])*t)}
function darken(a,k){var A=rgb(a),m=1-k;return hx(A[0]*m,A[1]*m,A[2]*m)}
function cascade(hex){var primary=n(hex);var marketplace=cfg.look==="marketplace";var accent=marketplace?mix(primary,"#ffffff",0.18):darken(primary,0.12);return{"--pw-primary":primary,"--pw-accent":accent,"--pw-buy":primary,"--pw-cart":marketplace?primary:cfg.cart,"--pw-bg":cfg.bg,"--pw-text":cfg.text,"--pw-muted":cfg.muted,"--pw-surface":mix("#ffffff",primary,0.08),"--pw-border":cfg.border,"--pw-footer":cfg.footer,"--pw-footer-ink":"#111827"}}
function varsFor(hex){hex=n(hex);if(!hex)return null;if(hex===cfg.preset&&cfg.base)return cfg.base;if(cfg.palettes&&cfg.palettes[hex])return cfg.palettes[hex];return cascade(hex)}
function applyHref(hex){hex=n(hex);if(!cfg.presetId)return"";var q="?${PW_SAMPLE_APPLY_PRESET_PARAM}="+encodeURIComponent(cfg.presetId);if(hex)q+="&${PW_SAMPLE_APPLY_COLOR_PARAM}="+encodeURIComponent(hex.slice(1));return"/dashboard/messaging/website"+q}
function apply(hex){var vars=varsFor(hex);if(!vars)return;hex=n(hex);var nodes=[document.documentElement,document.body];for(var i=0;i<nodes.length;i++){if(!nodes[i]||!nodes[i].style)continue;for(var k in vars)nodes[i].style.setProperty(k,vars[k],"important")}
document.documentElement.setAttribute("data-pw-sample-hue",hex);var metas=document.querySelectorAll('meta[name="theme-color"]');for(var m=0;m<metas.length;m++)metas[m].setAttribute("content",vars["--pw-primary"]);var buttons=document.querySelectorAll("[data-pw-sample-swatch]");for(var b=0;b<buttons.length;b++){buttons[b].setAttribute("aria-pressed",n(buttons[b].getAttribute("data-pw-sample-swatch")||"")===hex?"true":"false")}
var input=document.querySelector("[data-pw-sample-colors] input[type=color]");if(input)input.value=hex;var applyBtn=document.querySelector("[${PW_SAMPLE_APPLY_ATTR}]");if(applyBtn)applyBtn.setAttribute("href",applyHref(hex));try{var u=new URL(location.href);u.searchParams.set("color",hex.slice(1));history.replaceState(null,"",u.pathname+u.search+u.hash)}catch(e){}}
document.addEventListener("click",function(ev){var t=ev.target&&ev.target.closest?ev.target.closest("[data-pw-sample-swatch]"):null;if(!t||!t.closest("[data-pw-sample-colors]"))return;ev.preventDefault();apply(t.getAttribute("data-pw-sample-swatch"))});
var colorInput=document.querySelector("[data-pw-sample-colors] input[type=color]");if(colorInput)colorInput.addEventListener("input",function(){apply(colorInput.value)});
})();`
}

export function injectShopTemplateSampleColorPickerInHtml(
  html: string,
  input: {
    locale: WebLocale
    originalTheme: PartnerWebsiteTheme
    selectedHex?: string | null
    presetId?: string | null
  }
): string {
  if (!html.trim() || new RegExp(`\\b${PW_SAMPLE_COLORS_ATTR}=`, 'i').test(html)) return html
  const t = getPartnerWebsiteCopy(input.locale)
  const original = input.originalTheme
  const presetHex = normalizeHexColor(original.primaryColor, '#f97316')
  const selected = parseShopTemplateSampleColorParam(input.selectedHex) || presetHex
  const presetId = String(input.presetId || '').trim()
  const swatches = shopTemplateSampleColorSwatches(original)
  const palettes: Record<string, Record<string, string>> = {}
  for (const swatch of swatches) {
    palettes[swatch.hex] = themeCssVarMap(shopTemplateSampleThemeForPrimary(original, swatch.hex))
  }
  const resolved = themeCssVarMap(original)
  const cfg = {
    preset: presetHex,
    presetId,
    look: String(original.look || '').trim() === 'marketplace' ? 'marketplace' : 'shop',
    cart: resolved['--pw-cart'],
    bg: resolved['--pw-bg'],
    text: resolved['--pw-text'],
    muted: resolved['--pw-muted'],
    border: resolved['--pw-border'],
    footer: resolved['--pw-footer'],
    base: resolved,
    palettes,
  }
  const buttons = swatches
    .map((swatch) => {
      const on = hexesClose(swatch.hex, selected)
      return `<button type="button" data-pw-sample-swatch="${escapeAttr(swatch.hex)}" title="${escapeAttr(swatch.hex)}" aria-label="${escapeAttr(swatch.hex)}" aria-pressed="${on ? 'true' : 'false'}" style="background:${escapeAttr(swatch.hex)}"></button>`
    })
    .join('')
  const applyHref = presetId ? shopTemplateSampleApplyDashboardPath(presetId, selected) : ''
  const applyBtn = applyHref
    ? `<a ${PW_SAMPLE_APPLY_ATTR}="1" href="${escapeAttr(applyHref)}">${escapeHtml(t.templateGallerySelectThis)}</a>`
    : ''
  const presetCode = presetId ? getShopTemplatePreset(presetId).code : ''
  const codeBadge = presetCode
    ? `<span data-pw-sample-preset-code aria-label="${escapeAttr(presetCode)}">${escapeHtml(presetCode)}</span>`
    : ''
  const barLabel = presetCode ? `${presetCode} · ${t.templateGalleryColorPicker}` : t.templateGalleryColorPicker
  const styleTag = `<style id="${PW_SAMPLE_COLOR_STYLE_ID}">${SAMPLE_COLOR_CSS}</style>`
  const panel = `<aside ${PW_SAMPLE_COLORS_ATTR}="1" role="group" aria-label="${escapeAttr(barLabel)}">
${codeBadge}
<p data-pw-sample-colors-title>${escapeHtml(t.templateGalleryColorPicker)}</p>
<div data-pw-sample-swatches>${buttons}</div>
<label data-pw-sample-custom>
<input type="color" value="${escapeAttr(selected)}" aria-label="${escapeAttr(t.templateGalleryColorCustom)}"/>
<span>${escapeHtml(t.templateGalleryColorCustom)}</span>
</label>
${applyBtn}
<script type="application/json" id="${PW_SAMPLE_COLOR_CFG_ID}">${JSON.stringify(cfg)}</script>
</aside>
<script>${sampleColorPickerScript()}</script>`
  let out = html
  if (!new RegExp(`id=["']${PW_SAMPLE_COLOR_STYLE_ID}["']`, 'i').test(out)) {
    if (/<\/head>/i.test(out)) out = out.replace(/<\/head>/i, `${styleTag}</head>`)
    else out = `${styleTag}${out}`
  }
  if (/<\/body>/i.test(out)) out = out.replace(/<\/body>/i, `${panel}</body>`)
  else out = `${out}${panel}`
  return out.replace(/<html\b([^>]*)>/i, (full, attrs: string) => {
    if (/\bdata-pw-sample-hue=/.test(attrs)) {
      return `<html${attrs.replace(/\sdata-pw-sample-hue=(["'])[^"']*\1/i, ` data-pw-sample-hue="${selected}"`)}>`
    }
    return `<html${attrs} data-pw-sample-hue="${selected}">`
  })
}
