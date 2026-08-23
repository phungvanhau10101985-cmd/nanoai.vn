import {
  DEFAULT_PARTNER_WEBSITE_THEME,
  type PartnerWebsiteTheme,
} from '@/lib/partner-website/template/partner-website-template-types'
import { buildThemeCssVarBlock } from '@/lib/partner-website/template/partner-website-theme-tokens'
import { PARTNER_SHOP_CHROME_FLOAT_CSS } from '@/lib/partner-website/shop/chrome-float-widgets'
import { buildPartnerSiteAccountPanelCss } from '@/lib/partner-website/shop/build-partner-site-header-html'
import { PW_SCENE_TOPBAR_Z } from '@/lib/partner-website/visual-editor/pw-scene'
import {
  PW_CHROME_BTN_MIN_H,
  PW_CHROME_H_VAR,
  PW_CHROME_TEXT_ONLY_HIDE_ICON_CSS,
  PW_CHROME_TOKEN_VARS_CSS,
  PW_CHROME_W_VAR,
  PW_STOCK_CHROME_EDIT_CSS,
  PW_CHROME_LABELED_MIN_W_CSS,
  PW_CHROME_LABEL_FACE_CSS,
  PW_CHROME_FACE_EXTRAS_CSS,
} from '@/lib/partner-website/visual-editor/chrome-widgets'

/**
 * Colors + chrome for HTML factory classes (`pw-header`, `pw-topbar`, …).
 * Visual PDP / listing inject this — they are not wrapped in the React shop shell
 * that already styles `pw-shop-header`.
 */
export function buildPartnerSiteHtmlChromeCss(): string {
  return `html,body{margin:0;color:var(--pw-text);background:var(--pw-bg)}
a{color:inherit;text-decoration:none}
.pw-container{max-width:var(--pw-content,1200px);margin:0 auto;padding:0 20px;box-sizing:border-box}
.pw-topbar{background:var(--pw-primary);color:#fff;font-size:12px;position:relative;z-index:${PW_SCENE_TOPBAR_Z};isolation:isolate}
.pw-topbar-inner{display:flex;justify-content:flex-end;gap:18px;padding:8px 0}
.pw-topbar a,.pw-topbar button{color:#fff;text-decoration:none;background:none;border:none;cursor:pointer;font:inherit;padding:0}
.pw-header{background:#fff;border-bottom:1px solid var(--pw-border,#f3f4f6);position:sticky;top:0;z-index:200;isolation:isolate;overflow:visible}
.pw-header-main{display:flex;align-items:center;gap:12px;padding:14px 0}
.pw-brand-cluster{position:relative;display:flex;align-items:center;gap:10px;flex-shrink:0}
.pw-brand{display:inline-flex;align-items:center;gap:10px;text-decoration:none;width:max-content;max-width:100%;min-width:0;color:var(--pw-primary)}
.pw-logo{height:36px;width:auto;object-fit:contain}
.pw-wordmark{font-weight:800;font-size:1.15rem;color:var(--pw-primary);white-space:nowrap}
.pw-cat-btn:not([data-pw-chrome-added]){display:inline-flex;align-items:center;gap:6px;height:36px;padding:0 12px;border:1px solid var(--pw-border,#e5e7eb);border-radius:999px;background:#fff;color:#374151;font:inherit;font-size:13px;font-weight:700;cursor:pointer;white-space:nowrap}
.pw-cat-btn svg{width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:2}
.pw-cat-panel{display:none;position:absolute;left:0;top:calc(100% + 8px);z-index:60;min-width:200px;padding:8px;background:#fff;border:1px solid var(--pw-border,#e5e7eb);border-radius:12px;box-shadow:0 12px 32px rgba(15,23,42,.12)}
.pw-cat-panel.is-open{display:grid;gap:2px}
.pw-cat-panel a{display:block;padding:10px 12px;border-radius:8px;font-size:13px;font-weight:700;color:#374151;text-decoration:none}
.pw-cat-panel a:hover{background:var(--pw-surface);color:var(--pw-primary)}
.pw-header-search{flex:1 1 0%;min-width:72px;min-height:36px;max-width:100%;width:auto;margin:0;position:relative;z-index:1}
.pw-search-form{display:flex;align-items:stretch;width:100%;border:2px solid var(--pw-primary);border-radius:999px;overflow:hidden;background:#fff}
.pw-search-form input[type="search"]{flex:1;min-width:0;border:none;outline:none;padding:10px 14px;font:inherit;background:transparent;color:#111827}
.pw-search-image-btn{border:none;background:transparent;padding:0;cursor:pointer;font-size:0;line-height:1;color:var(--pw-primary)}
.pw-search-submit{border:none;background:var(--pw-primary);color:#fff;font-weight:800;font-size:12px;letter-spacing:.04em;text-transform:uppercase;padding:0 16px;cursor:pointer;white-space:nowrap}
.pw-nav-main{display:none;justify-content:center;gap:18px;flex-wrap:wrap;padding:0 0 12px}
.pw-nav-main a,.pw-nav-main button{text-decoration:none;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#374151;background:none;border:none;cursor:pointer;padding:0}
.pw-header-actions{margin-left:auto;display:flex;align-items:center;gap:10px}
${buildPartnerSiteAccountPanelCss()}
.pw-icon-btn{display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:999px;border:none;background:transparent;color:#374151;text-decoration:none;cursor:pointer;position:relative}
.pw-footer{background:#fff;color:#111827;border-top:1px solid var(--pw-border,#e5e7eb);padding:40px 0 0;margin-top:40px}
.pw-bottom-nav{display:none}
@media (min-width:900px){
  .pw-nav-main{display:flex}
}
@media (min-width:1280px){
  .pw-bottom-nav{display:none}
}
@media (max-width:899px){
  .pw-topbar{display:none}
  .pw-header{background:var(--pw-primary);border:none;box-shadow:0 6px 18px color-mix(in srgb, var(--pw-primary) 35%, transparent)}
  .pw-wordmark,.pw-brand{color:#fff}
  .pw-header-actions .pw-icon-btn:not([data-pw-chrome-float]),.pw-account-btn{color:#fff}
  .pw-cat-btn:not([data-pw-chrome-added]){width:34px;height:34px;padding:0;justify-content:center;border:1.5px solid rgba(255,255,255,.55);background:rgba(255,255,255,.16);color:#fff}
  .pw-cat-btn:not([data-pw-chrome-added]) span{display:none}
  .pw-search-form{border:none;height:36px;background:#fff;box-shadow:0 2px 8px rgba(15,23,42,.10)}
}
@media (max-width:1279px){
  .pw-bottom-nav{position:fixed;left:0;right:0;bottom:0;z-index:180;isolation:isolate;display:flex;flex-wrap:nowrap;justify-content:space-around;align-items:stretch;background:#fff;border-top:1px solid var(--pw-border,#e5e7eb);padding:6px 4px calc(6px + env(safe-area-inset-bottom))}
  .pw-bottom-nav a{flex:1 1 0;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;font-size:var(--pw-chrome-label,13px);font-weight:600;color:#6b7280;padding:6px 2px;text-decoration:none}
  .pw-bottom-nav a.is-active{color:var(--pw-primary)}
  .pw-bottom-nav svg{width:${PW_CHROME_W_VAR};height:${PW_CHROME_H_VAR};max-width:${PW_CHROME_W_VAR};max-height:${PW_CHROME_H_VAR};stroke:currentColor;fill:none}
}`
}

/** Fashion-orange aligned chrome for React platform shop pages + HTML factory chrome. */
export function buildPartnerSiteShopThemeCss(theme: PartnerWebsiteTheme): string {
  return `:root{
  ${buildThemeCssVarBlock(theme)};
  --pw-content:1200px;
}
${buildPartnerSiteHtmlChromeCss()}
.pw-shop{min-height:100dvh;background:
  radial-gradient(900px 420px at 0% -10%, color-mix(in srgb, var(--pw-primary) 14%, transparent), transparent 55%),
  radial-gradient(700px 360px at 100% 0%, color-mix(in srgb, var(--pw-accent) 12%, transparent), transparent 50%),
  var(--pw-bg);color:var(--pw-text);font-family:var(--pw-font-ui), "Be Vietnam Pro", "Segoe UI", system-ui, -apple-system, sans-serif;line-height:1.6;padding-bottom:72px;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;text-rendering:optimizeLegibility}
.pw-shop h1,.pw-shop h2,.pw-shop-info h1,.pw-shop-brand{font-family:var(--pw-font-display), var(--pw-font-ui), "Be Vietnam Pro", "Segoe UI", sans-serif}
.pw-shop a{color:inherit;text-decoration:none}
.pw-shop-topbar{background:var(--pw-primary);color:#fff;font-size:12px;position:relative;z-index:${PW_SCENE_TOPBAR_Z};isolation:isolate}
.pw-shop-topbar-inner{max-width:var(--pw-content);margin:0 auto;padding:8px 20px;display:flex;justify-content:flex-end;gap:16px}
.pw-shop-topbar a,.pw-shop-topbar button{color:#fff;background:none;border:none;cursor:pointer;font:inherit;padding:0}
.pw-shop-header{position:sticky;top:0;z-index:200;isolation:isolate;background:#fff;border-bottom:1px solid #f3f4f6}
.pw-shop-header-inner{max-width:var(--pw-content);width:100%;margin:0 auto;padding:12px 16px;display:flex;align-items:center;gap:12px;box-sizing:border-box}
.pw-shop-brand-cluster{position:relative;display:flex;align-items:center;gap:10px;flex-shrink:0;pointer-events:none}
.pw-shop-brand-cluster > *,.pw-shop-brand-cluster a,.pw-shop-brand-cluster button,.pw-shop-brand-cluster img,.pw-shop-brand-cluster [data-pw-el]{pointer-events:auto}
.pw-shop-cat-btn:not([data-pw-chrome-added]){display:inline-flex;align-items:center;gap:6px;height:36px;padding:0 12px;border:1px solid #e5e7eb;border-radius:999px;background:#fff;color:#374151;font:inherit;font-size:13px;font-weight:700;cursor:pointer;white-space:nowrap}
.pw-shop-nav-icon{width:20px;height:20px;flex-shrink:0;display:block}
.pw-shop-cat-panel{position:absolute;left:0;top:calc(100% + 8px);z-index:60;min-width:200px;display:grid;gap:2px;padding:8px;background:#fff;border:1px solid #e5e7eb;border-radius:12px;box-shadow:0 12px 32px rgba(15,23,42,.12)}
.pw-shop-cat-panel a{display:block;padding:10px 12px;border-radius:8px;font-size:13px;font-weight:700;color:#374151}
.pw-shop-cat-panel a:hover{background:var(--pw-surface);color:var(--pw-primary)}
.pw-shop-cat-panel a.is-sale{color:#374151}
.pw-shop-logo{height:36px;width:auto;object-fit:contain}
.pw-shop-brand{font-weight:800;font-size:1.1rem;color:var(--pw-primary);white-space:nowrap}
.pw-shop-search-wrap{flex:1 1 0%;min-width:72px;min-height:36px;max-width:100%;width:auto;margin:0;position:relative;z-index:1}
.pw-shop-search-form{display:flex;align-items:stretch;width:100%;border:2px solid var(--pw-primary);border-radius:999px;overflow:hidden;background:#fff}
.pw-shop-search-form input[type="search"]{flex:1;min-width:0;border:none;outline:none;padding:10px 14px;font:inherit;background:transparent;color:#111827}
.pw-shop-search-form input[type="search"]::placeholder{color:#9ca3af}
.pw-shop-search-image{display:inline-flex;align-items:center;justify-content:center;align-self:stretch;height:auto;border:none;background:transparent;padding:0;cursor:pointer;color:var(--pw-primary)}
.pw-shop-search-image .pw-shop-nav-icon{width:18px;height:18px}
.pw-shop-search-submit{display:inline-flex;align-items:center;justify-content:center;gap:4px;border:none;background:var(--pw-primary);color:#fff;font-weight:800;font-size:12px;letter-spacing:.04em;text-transform:uppercase;padding:0 16px;cursor:pointer;white-space:nowrap}
.pw-shop-search-submit-icon{display:none;width:18px;height:18px}
.pw-shop-search-panel{position:absolute;left:0;right:0;top:calc(100% + 8px);z-index:50;background:#fff;border:1px solid #e5e7eb;border-radius:12px;box-shadow:0 12px 32px rgba(15,23,42,.12);padding:12px;max-height:min(70vh,480px);overflow:auto}
.pw-shop-search-panel-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
.pw-shop-search-panel-head button{border:none;background:transparent;font-size:1.25rem;cursor:pointer;line-height:1;color:var(--pw-muted)}
.pw-shop-search-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
@media(min-width:1280px){.pw-shop-search-grid{grid-template-columns:repeat(4,minmax(0,1fr))}}
@media(min-width:1440px){.pw-shop-search-grid{grid-template-columns:repeat(5,minmax(0,1fr))}}
.pw-shop-search-card{display:flex;flex-direction:column;gap:4px;border-radius:10px;overflow:hidden;border:1px solid #f3f4f6;background:#fff}
.pw-shop-search-card img,.pw-shop-search-ph{width:100%;aspect-ratio:1;object-fit:cover;background:var(--pw-surface);display:block}
.pw-shop-search-name{font-size:12px;font-weight:600;padding:0 8px;line-height:1.3}
.pw-shop-search-card .pw-shop-price{padding:0 8px 8px;font-size:12px}
.pw-shop-header-actions{display:flex;align-items:center;gap:4px;margin-left:auto}
.pw-shop-account-wrap{position:relative}
.pw-shop-account-panel{position:absolute;right:0;left:auto;top:calc(100% + 8px);z-index:60;min-width:220px;display:grid;gap:2px;padding:6px;background:#fff;border:1px solid #e5e7eb;border-radius:12px;box-shadow:0 12px 32px rgba(15,23,42,.12)}
.pw-shop-account-panel a{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:8px;font-size:13px;font-weight:600;color:#374151}
.pw-shop-account-panel a:hover{background:var(--pw-surface);color:var(--pw-primary)}
.pw-shop-account-panel a.is-header{background:#eff6ff;color:#2563eb;border-left:3px solid #2563eb;border-radius:8px 8px 8px 6px;font-weight:700}
.pw-shop-account-panel a.is-header:hover{background:#dbeafe;color:#1d4ed8}
.pw-shop-account-panel a.is-accent{background:var(--pw-surface);color:var(--pw-accent);border-left:3px solid var(--pw-primary);border-radius:8px 8px 8px 6px;font-weight:700}
.pw-shop-account-panel a.is-accent:hover{background:var(--pw-surface);color:var(--pw-primary)}
.pw-shop-account-icon{width:18px;height:18px;flex-shrink:0;color:inherit;opacity:.85}
.pw-shop-account-panel a.is-header .pw-shop-account-icon{color:#2563eb}
.pw-shop-account-panel a.is-accent .pw-shop-account-icon{color:var(--pw-accent)}
.pw-shop-account-summary{margin-top:0;padding:16px 18px;border:1px solid #e5e7eb;border-radius:12px;background:#fff}
.pw-shop-account-greeting{font-size:1.1rem;font-weight:700;margin:0 0 8px}
.pw-shop-account-layout{display:grid;gap:28px}
@media(min-width:768px){.pw-shop-account-layout{grid-template-columns:200px 1fr}}
.pw-shop-account-sidebar{display:flex;flex-direction:column;gap:8px}
.pw-shop-account-sidebar h2{margin:0 0 8px}
.pw-shop-account-content{min-width:0}
.pw-shop-account-links{margin-top:0}
.pw-shop-account-links h2,.pw-shop-account-edit h2{font-size:1rem;margin:0 0 10px;text-transform:uppercase;letter-spacing:.04em;color:var(--pw-primary)}
.pw-shop-account-links-grid{display:flex;flex-direction:column;gap:6px}
.pw-shop-account-link-card{display:flex;flex-direction:row;align-items:center;gap:8px;padding:10px 12px;border:1px solid #e5e7eb;border-radius:8px;background:#fff;font-weight:600;font-size:13px;color:#374151;cursor:pointer;width:100%;text-align:left;text-decoration:none}
.pw-shop-account-link-card:hover{border-color:var(--pw-primary);color:var(--pw-primary);background:var(--pw-surface)}
.pw-shop-account-link-card.is-active{border-color:var(--pw-primary);background:var(--pw-primary);color:#fff}
.pw-shop-account-link-card.is-active .pw-shop-account-link-icon{color:#fff;opacity:1}
.pw-shop-account-link-card.is-accent{border-color:var(--pw-primary);background:var(--pw-surface);color:var(--pw-accent)}
.pw-shop-account-link-card.is-accent.is-active{background:var(--pw-accent);color:#fff;border-color:var(--pw-accent)}
.pw-shop-account-admin-cta{margin-top:16px;display:grid;gap:8px;max-width:420px}
.pw-shop-account-admin-cta .pw-shop-btn{width:100%}
.pw-shop-account-link-card.is-logout{margin-top:6px;border-color:#fecaca;color:#b91c1c;background:#fff}
.pw-shop-account-link-card.is-logout:hover{border-color:#f87171;color:#991b1b;background:#fef2f2}
.pw-shop-account-link-card.is-logout .pw-shop-account-link-icon{color:#b91c1c;opacity:1}
.pw-shop-account-link-icon{width:20px;height:20px}
.pw-shop-account-edit{margin-top:0;padding-top:0;border-top:none}
.pw-shop-page-head{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;margin-bottom:8px}
.pw-shop-page-head h1{margin:0}
.pw-shop-order-filters{display:flex;gap:8px;overflow-x:auto;padding:4px 2px 8px;margin:12px 0 4px;-webkit-overflow-scrolling:touch;scrollbar-width:thin}
.pw-shop-order-filter-chip{flex:0 0 auto;display:inline-flex;align-items:center;gap:6px;padding:8px 12px;border:1px solid #e5e7eb;border-radius:999px;background:#fff;color:#374151;font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap}
.pw-shop-order-filter-chip:hover{border-color:var(--pw-primary);color:var(--pw-primary)}
.pw-shop-order-filter-chip.is-active{border-color:var(--pw-primary);background:var(--pw-primary);color:#fff}
.pw-shop-order-filter-badge{min-width:18px;height:18px;padding:0 5px;border-radius:999px;background:#111827;color:#fff;font-size:11px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;line-height:1}
.pw-shop-order-filter-chip.is-active .pw-shop-order-filter-badge{background:rgba(255,255,255,.25);color:#fff}
.pw-shop-orders-list{list-style:none;padding:0;margin-top:16px;display:grid;gap:12px}
.pw-shop-order-card{border:1px solid #e2e8f0;border-radius:12px;padding:16px;background:#fff}
.pw-shop-order-card-head{display:flex;gap:14px;align-items:flex-start}
.pw-shop-order-thumb{width:72px;height:72px;object-fit:cover;border-radius:8px;flex-shrink:0;background:var(--pw-surface)}
.pw-shop-order-card-main{flex:1;min-width:0}
.pw-shop-order-actions{margin-top:12px;display:flex;flex-wrap:wrap;gap:8px}
.pw-shop-order-payment{margin-top:12px;padding-top:12px;border-top:1px solid #e5e7eb}
.pw-shop-order-timeline{list-style:none;margin:0;padding:0;display:grid;gap:8px}
.pw-shop-order-timeline li{position:relative;padding-left:22px;color:var(--pw-muted);font-size:13px}
.pw-shop-order-timeline li::before{content:'';position:absolute;left:0;top:5px;width:10px;height:10px;border-radius:999px;background:var(--pw-border)}
.pw-shop-order-timeline li.is-done{color:var(--pw-text);font-weight:600}
.pw-shop-order-timeline li.is-done::before{background:var(--pw-primary)}
.pw-shop-order-timeline li.is-active{color:var(--pw-primary);font-weight:700}
.pw-shop-order-timeline li.is-active::before{background:var(--pw-primary);box-shadow:0 0 0 3px color-mix(in srgb, var(--pw-primary) 25%, transparent)}
.pw-shop-order-qr{max-width:280px;width:100%;border-radius:8px}
.pw-shop-push-card{margin:0 0 16px;padding:16px 18px;border:1px solid var(--pw-border);border-radius:12px;background:var(--pw-surface)}
.pw-shop-push-card h3{margin:0 0 6px;color:var(--pw-text);font-size:16px}
.pw-shop-address-card{margin-top:16px;padding:16px 18px;border:1px solid #e5e7eb;border-radius:12px;background:#fff}
.pw-shop-address-card-label{font-weight:700;margin:0 0 6px;color:var(--pw-primary)}
.pw-shop-icon-btn{display:inline-flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;min-width:44px;min-height:40px;border-radius:10px;border:none;background:transparent;color:#374151;cursor:pointer;position:relative;font-weight:700;font-size:var(--pw-chrome-label,13px);line-height:1.1;padding:4px 6px;text-decoration:none}
.pw-icon-btn{display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;position:relative;text-decoration:none;color:inherit}
${PW_CHROME_TOKEN_VARS_CSS}
${PARTNER_SHOP_CHROME_FLOAT_CSS}
.pw-chrome-icon-wrap{position:relative;display:inline-flex;align-items:center;justify-content:center;width:${PW_CHROME_W_VAR};height:${PW_CHROME_H_VAR};flex-shrink:0;overflow:visible}
${PW_CHROME_TEXT_ONLY_HIDE_ICON_CSS}
.pw-chrome-icon-only .pw-shop-icon-label,.pw-chrome-icon-only .pw-chrome-btn-label{display:none!important}
.pw-shop-header-actions .pw-chrome-icon-only,[data-pw-chrome-btn="chat"].pw-chrome-icon-only,[data-pw-chrome-btn="chat-zalo"].pw-chrome-icon-only,[data-pw-chrome-btn="chat-facebook"].pw-chrome-icon-only{width:auto;height:auto;min-width:0;min-height:0;padding:var(--pw-chrome-pad-y,4px) var(--pw-chrome-pad-x,4px);border-radius:999px;flex-direction:row}
.pw-shop-header-actions .pw-chrome-icon-square,[data-pw-chrome-btn="chat"].pw-chrome-icon-square,[data-pw-chrome-btn="chat-zalo"].pw-chrome-icon-square,[data-pw-chrome-btn="chat-facebook"].pw-chrome-icon-square{border-radius:10px}
.pw-chrome-icon-square .pw-chrome-icon-wrap,.pw-chrome-icon-square .pw-chrome-chat-logo{border-radius:8px}
.pw-chrome-has-label{flex-direction:column;gap:2px}
.pw-header-actions .pw-chrome-has-label,.pw-shop-header-actions .pw-chrome-has-label,.pw-header-actions .pw-chrome-link,.pw-shop-header-actions .pw-chrome-link,[data-pw-chrome-added].pw-chrome-has-label,[data-pw-chrome-added].pw-chrome-link{flex-direction:row;gap:var(--pw-chrome-gap,6px);min-height:${PW_CHROME_BTN_MIN_H};padding:var(--pw-chrome-pad-y,4px) var(--pw-chrome-pad-x,12px);border-radius:999px;font-size:var(--pw-chrome-label,13px)}
.pw-chrome-label-below,[data-pw-chrome-style="icon-label-below"],[data-pw-chrome-added].pw-chrome-label-below{flex-direction:column;align-items:center;justify-content:center;padding:var(--pw-chrome-pad-y,4px) 6px;border-radius:10px}
.pw-chrome-label-left,[data-pw-chrome-style="icon-label-left"],[data-pw-chrome-added].pw-chrome-label-left{flex-direction:row;align-items:center;justify-content:center}
[data-pw-chrome-btn="chat"] .pw-chrome-icon-wrap,[data-pw-chrome-btn="chat-zalo"] .pw-chrome-icon-wrap,[data-pw-chrome-btn="chat-facebook"] .pw-chrome-icon-wrap{overflow:hidden;border-radius:999px}
.pw-chrome-icon-wrap .pw-chrome-chat-logo{width:100%;height:100%;object-fit:cover;border-radius:999px}
.pw-chrome-has-label .pw-shop-icon-label,.pw-chrome-has-label .pw-chrome-btn-label{display:block;max-width:none;overflow:visible;text-overflow:unset;white-space:nowrap}
.pw-icon-btn svg,.pw-shop-icon-btn svg,.pw-shop-header-actions>a>svg,.pw-header-actions>a>svg{width:20px;height:20px;max-width:20px;max-height:20px;flex-shrink:0;display:block;stroke:currentColor;fill:none}
.pw-chrome-icon-wrap svg,[data-pw-chrome-btn] svg,[data-pw-chrome-added] svg{width:${PW_CHROME_W_VAR};height:${PW_CHROME_H_VAR};max-width:${PW_CHROME_W_VAR};max-height:${PW_CHROME_H_VAR};flex-shrink:0;display:block}
.pw-shop-icon-label{max-width:none;overflow:visible;text-overflow:unset;white-space:nowrap}
.pw-shop-cart-badge{position:absolute;top:0;right:2px;min-width:16px;height:16px;border-radius:999px;background:var(--pw-primary);color:#fff;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;padding:0 4px}
.pw-cart-badge[hidden],.pw-shop-cart-badge[hidden],[data-pw-chrome-badge][hidden]{display:none!important}
.pw-shop-nav-row{display:none;justify-content:center;gap:22px;flex-wrap:wrap;padding:0 24px 14px;max-width:var(--pw-content);margin:0 auto}
.pw-shop-nav-row a,.pw-shop-nav-row button{font-size:13px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:#374151;background:none;border:none;cursor:pointer;padding:0}
.pw-shop-nav-row a.is-sale,.pw-shop-nav-row a.pw-nav-sale{color:#374151}
.pw-shop-main{max-width:var(--pw-content);margin:0 auto;padding:20px 16px 40px}
.pw-shop-main h1{font-size:clamp(1.35rem,2.2vw,1.75rem);font-weight:700;letter-spacing:0;margin:0 0 8px;line-height:1.25;color:var(--pw-text)}
.pw-shop-info h1{margin:0 0 16px;font-size:clamp(1.4rem,2.5vw,1.8rem);font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:var(--pw-primary)}
.pw-shop-info p{margin:0 0 12px;color:var(--pw-text);max-width:720px}
.pw-shop-info ul{margin:0 0 16px;padding-left:1.2rem;color:var(--pw-muted)}
.pw-shop-info details{border:1px solid #e5e7eb;border-radius:8px;padding:12px 16px;margin-bottom:10px;background:#fff}
.pw-shop-info summary{font-weight:700;cursor:pointer}
.pw-shop-breadcrumb{font-size:13px;color:#6b7280;margin-bottom:14px}
.pw-shop-breadcrumb a{color:#6b7280;text-decoration:none}
.pw-shop-breadcrumb a:hover{color:var(--pw-primary);text-decoration:underline}
.pw-shop-category-banner{position:relative;border-radius:14px;overflow:hidden;margin-bottom:16px;min-height:140px;display:flex;align-items:flex-end;background:#f3f4f6}
.pw-shop-category-banner img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.pw-shop-category-banner h1{position:relative;margin:0;padding:20px;color:#fff;text-shadow:0 2px 8px rgba(0,0,0,.55);font-size:clamp(1.35rem,2.2vw,1.75rem);font-weight:700}
.pw-shop-category-tiles{display:grid;gap:14px;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));margin-top:10px}
.pw-shop-category-tile{position:relative;display:flex;flex-direction:column;align-items:center;gap:8px;padding:14px 10px;border:1px solid #f3f4f6;border-radius:12px;background:#fff;text-decoration:none;box-shadow:0 2px 8px rgba(15,23,42,.05)}
.pw-shop-category-tile:hover{border-color:var(--pw-primary)}
.pw-shop-category-tile img{width:64px;height:64px;border-radius:50%;object-fit:cover}
.pw-shop-category-tile-placeholder{width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,var(--pw-primary),#f3f4f6)}
.pw-shop-category-tile-name{font-size:13px;font-weight:600;color:var(--pw-text);text-align:center}
.pw-shop-category-tile-count{font-size:11px;color:#6b7280}
.pw-shop-grid{display:grid;gap:12px;grid-template-columns:repeat(2,minmax(0,1fr))}
@media(min-width:1280px){.pw-shop-grid{gap:18px;grid-template-columns:repeat(4,minmax(0,1fr))}}
@media(min-width:1440px){.pw-shop-grid{grid-template-columns:repeat(5,minmax(0,1fr))}}
.pw-shop-card{display:flex;flex-direction:column;border:1px solid #f3f4f6;border-radius:10px;overflow:hidden;background:#fff;box-shadow:0 4px 14px rgba(15,23,42,.06)}
.pw-shop-card img{width:100%;aspect-ratio:1;object-fit:cover}
.pw-shop-card-body{padding:12px;display:grid;gap:8px}
.pw-shop-price{font-weight:800;color:var(--pw-primary)}
.pw-shop-btn{display:inline-flex;align-items:center;justify-content:center;padding:11px 20px;border-radius:8px;border:none;background:var(--pw-primary);color:#fff;font-weight:700;cursor:pointer;text-decoration:none;font-size:14px;line-height:1.35;letter-spacing:0;text-transform:none;font-family:inherit}
.pw-shop-btn:disabled{opacity:.45;cursor:not-allowed;filter:saturate(.75)}
.pw-shop-btn-outline{background:#fff;color:var(--pw-primary);border:2px solid var(--pw-primary)}
.pw-shop-btn-cart{background:var(--pw-cart);color:#fff;border:none}
.pw-shop-btn-buy{background:var(--pw-buy);color:#fff;border:none}
.pw-btn-outline{background:transparent;border-radius:12px;border-style:solid;border-width:2px}
.pw-shop-auth-panel{margin-top:16px;padding:20px;border:1px solid #d1d5db;border-radius:12px;background:#fff;box-shadow:0 1px 2px rgba(15,23,42,.05);max-width:480px}
.pw-shop-auth-panel .pw-shop-btn{width:100%;padding:12px 18px}
.pw-shop-auth-panel-intro{margin:0 0 16px;font-size:15px;font-weight:600;color:var(--pw-text);line-height:1.45}
.pw-shop-auth-panel-hint{margin:8px 0 0;font-size:14px;line-height:1.5;color:#4b5563}
.pw-shop-auth-panel-divider{margin:16px 0 12px;font-size:14px;line-height:1.5;color:#4b5563}
.pw-shop-auth-panel-check{display:flex;align-items:flex-start;gap:8px;font-size:14px;line-height:1.45;color:#4b5563;font-weight:500}
.pw-shop-auth-panel-check input{margin-top:3px;flex-shrink:0}
.pw-shop-auth-panel form{display:grid;gap:12px}
.pw-shop-auth-panel-welcome{margin:0 0 4px;font-size:15px;font-weight:700;color:var(--pw-text)}
.pw-shop-btn-google{display:inline-flex;align-items:center;justify-content:center;gap:10px;width:100%;padding:11px 18px;border:1px solid #d1d5db;border-radius:8px;background:#fff;color:#374151;font-weight:600;font-size:14px;cursor:pointer;font-family:inherit}
.pw-shop-btn-google:hover:not(:disabled){background:#f9fafb;border-color:#9ca3af}
.pw-shop-btn-google:disabled{opacity:.45;cursor:not-allowed}
.pw-shop-auth-divider{display:flex;align-items:center;gap:12px;margin:4px 0;color:#6b7280;font-size:13px}
.pw-shop-auth-divider::before,.pw-shop-auth-divider::after{content:'';flex:1;height:1px;background:#e5e7eb}
.pw-shop-btn-send-otp{width:100%;background:#fff!important;color:#374151!important;border:1px solid #d1d5db!important;font-weight:600}
.pw-shop-btn-send-otp:hover:not(:disabled){background:#f9fafb!important;border-color:#9ca3af!important;color:#111827!important}
.pw-shop-product-layout{display:grid;gap:24px;grid-template-columns:1fr}
@media(min-width:768px){.pw-shop-product-layout{grid-template-columns:1fr 1fr}}
.pw-shop-product-img{width:100%;border-radius:12px;aspect-ratio:1;object-fit:cover;background:var(--pw-surface)}
.pw-shop-product-gallery{display:grid;gap:10px}
.pw-shop-product-thumbs{display:flex;flex-wrap:wrap;gap:8px}
.pw-shop-product-thumb{width:64px;height:64px;padding:0;border:2px solid transparent;border-radius:8px;overflow:hidden;background:var(--pw-surface);cursor:pointer}
.pw-shop-product-thumb.is-active{border-color:var(--pw-primary)}
.pw-shop-product-thumb img{width:100%;height:100%;object-fit:cover}
.pw-pdp-hero{display:none;position:relative;background:var(--pw-surface)}
.pw-pdp-hero-img{width:100%;display:block;aspect-ratio:3/4;object-fit:cover;background:var(--pw-surface);cursor:zoom-in;touch-action:pan-y}
.pw-pdp-hero-count{position:absolute;top:12px;right:12px;z-index:1;padding:4px 10px;border-radius:999px;background:rgba(0,0,0,.55);color:#fff;font-size:11px;font-weight:600;tabular-nums}
.pw-pdp-hero-dots{position:absolute;left:0;right:0;bottom:12px;z-index:1;display:flex;justify-content:center;gap:6px;pointer-events:none}
.pw-pdp-hero-dots span{width:6px;height:6px;border-radius:999px;background:rgba(255,255,255,.5)}
.pw-pdp-hero-dots span.is-active{width:16px;background:#fff}
.pw-pdp-hero-thumbs{display:flex;gap:8px;overflow-x:auto;padding:8px 16px 4px;scrollbar-width:none;-webkit-overflow-scrolling:touch}
.pw-pdp-hero-thumbs::-webkit-scrollbar{display:none}
.pw-pdp-title{margin:0;font-size:1.05rem;font-weight:800;letter-spacing:.02em;text-transform:uppercase;line-height:1.35;color:var(--pw-text)}
@media(min-width:768px){.pw-pdp-title{font-size:1.35rem;text-transform:none}}
.pw-pdp-sku{margin:8px 0 0;font-size:12px;color:var(--pw-muted)}
.pw-pdp-sku strong{color:var(--pw-text);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-weight:600}
.pw-pdp-stats{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;margin:10px 0 0;font-size:13px;color:var(--pw-muted)}
.pw-pdp-stats strong{color:var(--pw-text)}
.pw-pdp-star{color:#f59e0b}
.pw-pdp-price-card{margin-top:14px;padding:14px;border-radius:16px;border:1px solid color-mix(in srgb,var(--pw-primary) 18%,var(--pw-border));background:color-mix(in srgb,var(--pw-primary) 8%,#fff)}
.pw-pdp-price-card .pw-shop-price{margin:0;font-size:1.45rem;line-height:1.2}
.pw-pdp-compare{margin-left:8px;text-decoration:line-through;font-size:1rem;font-weight:600;color:var(--pw-muted)}
.pw-pdp-save{margin:6px 0 0;font-size:12px;font-weight:700;color:#059669}
.pw-pdp-policy{margin-top:14px;padding-top:14px;border-top:1px solid var(--pw-border);font-size:12px;line-height:1.6;color:var(--pw-text)}
.pw-pdp-policy a{color:var(--pw-primary);font-weight:700}
.pw-pdp-policy a:hover{text-decoration:underline}
.pw-pdp-notes{margin:12px 0 0;padding:0 0 0 1.1rem;font-size:12px;color:var(--pw-muted);display:grid;gap:4px}
.pw-pdp-pills{display:flex;flex-wrap:wrap;gap:8px}
.pw-pdp-pill{min-width:44px;min-height:36px;padding:6px 12px;border:1px solid var(--pw-border);border-radius:8px;background:#fff;color:var(--pw-text);font:inherit;font-size:13px;font-weight:600;cursor:pointer}
.pw-pdp-pill.is-active{border-color:var(--pw-primary);color:var(--pw-primary);background:var(--pw-surface);box-shadow:0 0 0 1px var(--pw-primary)}
.pw-pdp-color{padding:4px;border-radius:10px}
.pw-pdp-color img{width:44px;height:44px;object-fit:cover;border-radius:6px;display:block}
.pw-pdp-qty{display:flex;align-items:center;gap:8px}
.pw-pdp-qty button{width:32px;height:32px;border:1px solid var(--pw-border);border-radius:8px;background:#fff;color:var(--pw-text);font-size:16px;cursor:pointer}
.pw-pdp-qty button:hover{background:var(--pw-surface)}
.pw-pdp-qty span{min-width:40px;text-align:center;font-weight:700}
.pw-pdp-total{display:flex;align-items:baseline;justify-content:space-between;margin-top:12px;font-size:14px;font-weight:700}
.pw-pdp-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:18px}
.pw-pdp-actions-inline{display:none}
@media(min-width:768px){.pw-pdp-actions-inline{display:flex}}
.pw-pdp,.pw-shop-product-layout,.pw-shop-main{max-width:100%;box-sizing:border-box}
.pw-pdp-sticky svg,.pw-pdp-sticky-nav svg{width:${PW_CHROME_W_VAR}!important;height:${PW_CHROME_H_VAR}!important;max-width:${PW_CHROME_W_VAR}!important;max-height:${PW_CHROME_H_VAR}!important;flex-shrink:0;display:block}
.pw-pdp-sticky{display:none}
@media(max-width:767px){
  .pw-shop:has(.pw-pdp){padding-bottom:88px}
  .pw-shop-main:has(.pw-pdp){padding-top:0}
  .pw-pdp-hero{display:block;margin-inline:-16px}
  #pw-pdp-reviews,#pw-pdp-qa{scroll-margin-top:72px}
  .pw-pdp-gallery-desktop{display:none}
  .pw-pdp-info-pad{padding-inline:16px}
  .pw-pdp-sticky{display:flex;position:fixed;left:0;right:0;bottom:0;z-index:120;align-items:stretch;gap:6px;padding:6px 8px calc(6px + env(safe-area-inset-bottom,0px));background:#f3f4f6;border-top:1px solid #e5e7eb}
  .pw-pdp-sticky-nav{display:flex;align-items:stretch;gap:2px;padding-right:8px;margin-right:2px;border-right:1px solid #e5e7eb}
  .pw-pdp-sticky-nav a,.pw-pdp-sticky-nav button{width:44px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;border:none;background:transparent;color:#4b5563;font:inherit;font-size:var(--pw-chrome-label,13px);line-height:1.1;cursor:pointer;text-decoration:none;padding:2px 0}
  .pw-pdp-sticky-nav a.is-try,.pw-pdp-sticky-nav button.is-try{color:var(--pw-primary)}
  .pw-pdp-sticky-nav button.is-fav{color:#e11d48}
  .pw-pdp-sticky-nav svg{width:${PW_CHROME_W_VAR};height:${PW_CHROME_H_VAR};max-width:${PW_CHROME_W_VAR};max-height:${PW_CHROME_H_VAR}}
  .pw-pdp-sticky-ctas{flex:1;min-width:0;display:flex;gap:6px}
  .pw-pdp-sticky-ctas .pw-shop-btn{flex:1;padding:10px 8px;font-size:12px;border-radius:8px}
}
@media(min-width:768px){
  .pw-pdp-sticky.is-visible{display:flex;position:fixed;left:0;right:0;bottom:58px;z-index:120;align-items:center;justify-content:center;gap:12px;padding:10px 16px;background:#f3f4f6;border-top:1px solid #e5e7eb}
  .pw-pdp-sticky-nav{display:flex;align-items:center;gap:8px}
  .pw-pdp-sticky-nav a,.pw-pdp-sticky-nav button{width:56px;display:flex;flex-direction:column;align-items:center;gap:2px;border:none;background:transparent;color:#4b5563;font:inherit;font-size:11px;cursor:pointer;text-decoration:none}
  .pw-pdp-sticky-nav a.is-try,.pw-pdp-sticky-nav button.is-try{color:var(--pw-primary)}
  .pw-pdp-sticky-nav button.is-fav{color:#e11d48}
  .pw-pdp-sticky-nav svg{width:${PW_CHROME_W_VAR};height:${PW_CHROME_H_VAR};max-width:${PW_CHROME_W_VAR};max-height:${PW_CHROME_H_VAR}}
  .pw-pdp-sticky-ctas{display:flex;gap:8px}
  .pw-pdp-sticky-ctas .pw-shop-btn{min-width:160px;padding:11px 18px}
}
@media(min-width:1280px){
  .pw-pdp-sticky.is-visible{bottom:0}
}
.pw-shop-product-detail{margin-top:40px;display:grid;gap:32px}
.pw-shop-product-detail h2{font-size:1.25rem;margin:0 0 12px;color:var(--pw-primary)}
.pw-shop-product-detail-body{white-space:pre-wrap;line-height:1.75}
.pw-shop-detail-grid{display:grid;gap:12px;grid-template-columns:repeat(2,minmax(0,1fr))}
@media(min-width:1280px){.pw-shop-detail-grid{grid-template-columns:repeat(4,minmax(0,1fr))}}
@media(min-width:1440px){.pw-shop-detail-grid{grid-template-columns:repeat(5,minmax(0,1fr))}}
.pw-shop-detail-grid img{width:100%;border-radius:10px;aspect-ratio:1;object-fit:cover;background:var(--pw-surface)}
.pw-shop-product-video{width:100%;max-width:720px;border-radius:12px;border:none;aspect-ratio:16/9;background:#0f172a}
.pw-shop-urgency-badge{display:inline-block;margin-top:10px;padding:4px 10px;border-radius:999px;background:#fef2f2;color:#dc2626;font-size:12px;font-weight:700}
.pw-shop-product-img{cursor:zoom-in;touch-action:pan-y}
.pw-shop-lightbox{position:fixed;inset:0;z-index:200;background:rgba(15,23,42,.92);display:flex;align-items:center;justify-content:center;touch-action:pan-y}
.pw-shop-lightbox img{max-width:94vw;max-height:80vh;object-fit:contain;transition:transform .2s ease;cursor:zoom-in;user-select:none}
.pw-shop-lightbox img.is-zoomed{transform:scale(2);cursor:zoom-out}
.pw-shop-lightbox-close{position:absolute;top:16px;right:16px;width:40px;height:40px;border-radius:999px;background:rgba(255,255,255,.15);color:#fff;border:none;font-size:20px;line-height:1;cursor:pointer}
.pw-shop-lightbox-nav{position:absolute;top:50%;transform:translateY(-50%);width:44px;height:44px;border-radius:999px;background:rgba(255,255,255,.15);color:#fff;border:none;font-size:22px;cursor:pointer}
.pw-shop-lightbox-prev{left:12px}
.pw-shop-lightbox-next{right:12px}
.pw-shop-lightbox-dots{position:absolute;bottom:18px;left:0;right:0;display:flex;justify-content:center;gap:6px}
.pw-shop-lightbox-dots span{width:6px;height:6px;border-radius:999px;background:rgba(255,255,255,.4)}
.pw-shop-lightbox-dots span.is-active{background:#fff}
.pw-shop-sticky-buy{display:none}
.pw-shop-cart-row{display:grid;gap:12px;padding:16px;border:1px solid #f3f4f6;border-radius:12px;background:#fff;grid-template-columns:80px 1fr auto;box-shadow:0 2px 10px rgba(15,23,42,.04)}
.pw-shop-cart-row img{width:80px;height:80px;object-fit:cover;border-radius:8px}
.pw-shop-form{display:grid;gap:12px;max-width:480px}
.pw-shop-form label{display:grid;gap:6px;font-size:15px;font-weight:600;color:var(--pw-text)}
.pw-shop-form input,.pw-shop-form textarea{padding:11px 12px;border:1px solid #9ca3af;border-radius:8px;font:inherit;font-size:15px;line-height:1.4;color:var(--pw-text);background:#fff}
.pw-shop-form input::placeholder,.pw-shop-form textarea::placeholder{color:#9ca3af}
.pw-shop-muted{color:#4b5563;font-size:14px;line-height:1.5}
.pw-shop-footer{background:var(--pw-footer);color:#111827;border-top:1px solid #e5e7eb;padding:36px 16px 0;margin-top:40px}
.pw-shop-footer-inner{max-width:var(--pw-content);margin:0 auto;display:grid;gap:28px 32px;grid-template-columns:1fr}
.pw-shop-footer-logo{height:40px;width:auto;max-width:160px;object-fit:contain;margin:0 0 12px;display:block}
.pw-shop-footer-name{margin:0 0 8px;font-weight:800;font-size:1.05rem;line-height:1.3;color:#111827;font-family:var(--pw-font-display),var(--pw-font-ui),sans-serif}
.pw-shop-footer-hint{margin:0;max-width:280px;font-size:13px;line-height:1.65;color:#4b5563}
.pw-shop-footer-col h3{margin:0 0 12px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#111827}
.pw-shop-footer-col ul{list-style:none;margin:0;padding:0;display:grid;gap:2px}
.pw-shop-footer-col a{display:inline-flex;align-items:center;min-height:36px;font-size:14px;color:#4b5563}
.pw-shop-footer-col a:hover{color:var(--pw-primary)}
.pw-shop-footer-bar{max-width:var(--pw-content);margin:28px auto 0;padding:16px 0 20px;border-top:1px solid #e5e7eb;display:flex;flex-wrap:wrap;justify-content:space-between;gap:8px 16px;font-size:13px;color:#6b7280}
.pw-shop-footer-bar p{margin:0}
.pw-shop-bottom-nav{display:none}
@media(min-width:640px){
  .pw-shop-footer-inner{grid-template-columns:repeat(2,minmax(0,1fr))}
  .pw-shop-footer-brand{grid-column:1/-1}
}
@media(min-width:900px){
  .pw-shop-nav-row{display:flex}
  .pw-shop-header-inner{padding:14px 24px;gap:16px}
  .pw-shop-topbar-inner{padding:8px 24px}
  .pw-shop-main{padding:28px 24px 64px}
  .pw-shop-footer{padding:48px 24px 0;margin-top:56px}
  .pw-shop-footer-inner{grid-template-columns:minmax(220px,1.35fr) repeat(4,minmax(0,1fr));gap:32px 28px}
  .pw-shop-footer-brand{grid-column:auto}
  .pw-shop-footer-bar{padding:18px 0 28px}
  .pw-shop-icon-btn{flex-direction:row;gap:6px;min-width:auto;min-height:36px;font-size:13px;padding:0 10px;border-radius:999px}
  .pw-shop-icon-label{max-width:none}
  .pw-shop-cart-badge{top:0;right:0}
}
@media(min-width:1280px){
  .pw-shop{padding-bottom:0}
  .pw-shop-bottom-nav{display:none}
}
@media(max-width:899px){
  .pw-shop-topbar{display:none}
  .pw-shop-header{background:var(--pw-primary);box-shadow:0 6px 18px color-mix(in srgb, var(--pw-primary) 35%, transparent)}
  .pw-shop-header-inner{display:flex;flex-wrap:nowrap;align-items:center;gap:6px;padding:8px 10px}
  .pw-shop-brand-cluster{gap:6px;max-width:90px;min-width:0;width:auto;overflow:visible;position:relative;z-index:50;flex:0 0 auto}
  .pw-shop-header-actions{gap:0;margin-left:auto;width:auto;max-width:none;overflow:visible;flex:0 0 auto}
  .pw-shop-account-wrap{display:none}
  .pw-shop-search-wrap{flex:1 1 0%;min-width:72px;max-width:none;width:auto;margin:0;z-index:1}
  .pw-shop-search-wrap[data-pw-search-width]{flex:1 1 0%;min-width:72px}
  .pw-shop-search-form{width:100%}
  .pw-shop-header a.pw-shop-brand,
  .pw-shop-brand{
    color:#fff;
    font-size:.95rem;
    font-weight:700;
    letter-spacing:0;
    line-height:1.2;
    max-width:none;
    overflow:visible;
    position:relative;
    z-index:50;
  }
  .pw-shop-logo{height:28px;padding:0;background:transparent;border-radius:0;filter:none;position:relative;z-index:90;overflow:visible;object-fit:contain;object-position:left center}
  .pw-logo-frame,.pw-shop-header [data-pw-logo-frame="1"]{padding:0;background:transparent;max-width:none;max-height:none;overflow:hidden}
  .pw-shop-cat-btn:not([data-pw-chrome-added]){
    width:34px;height:34px;padding:0;justify-content:center;
    border:1.5px solid rgba(255,255,255,.55);
    background:rgba(255,255,255,.16);
    color:#fff;flex-shrink:0;
  }
  .pw-shop-cat-btn:not([data-pw-chrome-added]) > span{display:none}
  .pw-shop-cat-btn .pw-shop-nav-icon{width:18px;height:18px}
  .pw-shop-search-form{
    border:none;
    height:36px;
    background:#fff;
    box-shadow:0 2px 8px rgba(15,23,42,.10);
  }
  .pw-shop-search-form input[type="search"]{padding:0 8px;font-size:13px;font-weight:500}
  .pw-shop-search-image{background:transparent;padding:0;color:var(--pw-accent)}
  .pw-shop-search-image .pw-shop-nav-icon{width:16px;height:16px}
  .pw-shop-search-submit{min-width:36px;padding:0 10px}
  .pw-shop-search-submit-label{display:none}
  .pw-shop-search-submit-icon{display:block;width:16px;height:16px}
  .pw-shop-header-actions .pw-shop-icon-btn,.pw-shop-header-actions .pw-icon-btn{color:#fff;min-width:32px;min-height:34px;padding:2px}
  .pw-shop-icon-btn .pw-shop-nav-icon{width:20px;height:20px}
  .pw-shop-header-actions .pw-shop-icon-label,.pw-shop-header-actions .pw-chrome-btn-label,.pw-shop-header-actions .pw-chrome-icon-only .pw-shop-icon-label{display:none}
  .pw-shop-header-actions .pw-chrome-has-label .pw-shop-icon-label,.pw-shop-header-actions .pw-chrome-has-label .pw-chrome-btn-label{display:inline;color:inherit;white-space:nowrap}
  .pw-shop-cart-badge{background:#fff;color:var(--pw-primary);top:-2px;right:-2px;box-shadow:0 0 0 1px rgba(255,255,255,.2)}
  .pw-shop-footer{padding:32px 16px 0;margin-top:28px}
  .pw-shop-footer-bar{padding-bottom:12px}
}
@media(max-width:1279px){
  .pw-shop-bottom-nav{position:fixed;left:0;right:0;bottom:0;z-index:180;isolation:isolate;display:flex;flex-wrap:nowrap;justify-content:space-around;align-items:stretch;background:#fff;border-top:1px solid #e5e7eb;padding:6px 4px calc(6px + env(safe-area-inset-bottom))}
  .pw-shop-bottom-nav a,.pw-shop-bottom-nav .pw-icon-btn,.pw-shop-bottom-nav .pw-shop-icon-btn{flex:1 1 0;min-width:0;min-height:0;width:auto;height:auto;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;font-size:var(--pw-chrome-label,13px);font-weight:600;color:#6b7280;padding:6px 2px;position:relative;background:transparent}
  .pw-shop-bottom-nav a .pw-shop-nav-icon,.pw-shop-bottom-nav a svg{width:${PW_CHROME_W_VAR};height:${PW_CHROME_H_VAR};max-width:${PW_CHROME_W_VAR};max-height:${PW_CHROME_H_VAR};stroke:currentColor;fill:none}
  .pw-shop-bottom-nav .pw-chrome-icon-wrap{position:relative;display:inline-flex;flex-direction:row;align-items:center;justify-content:center;width:${PW_CHROME_W_VAR};height:${PW_CHROME_H_VAR};overflow:visible}
  .pw-shop-bottom-nav .pw-shop-icon-label,.pw-shop-bottom-nav .pw-chrome-btn-label,.pw-shop-bottom-nav .pw-shop-nav-label,.pw-shop-bottom-nav>a>span:not(.pw-chrome-icon-wrap):not(.pw-cart-badge):not(.pw-shop-cart-badge){display:block;max-width:100%;white-space:normal;overflow:visible;text-overflow:unset;color:inherit;text-align:center;line-height:1.15;overflow-wrap:break-word;word-break:break-word}
  .pw-shop-bottom-nav a.is-active{color:var(--pw-primary)}
  .pw-shop-bottom-nav .pw-chrome-icon-wrap .pw-shop-cart-badge,.pw-shop-bottom-nav .pw-chrome-icon-wrap .pw-cart-badge{position:absolute;top:-5px;right:-9px;left:auto;bottom:auto;background:var(--pw-primary);color:#fff;box-shadow:none;z-index:2}
  .pw-shop-sticky-buy.is-visible{display:flex;position:fixed;left:0;right:0;bottom:58px;z-index:49;align-items:center;gap:10px;padding:8px 12px;background:#fff;border-top:1px solid #e5e7eb;box-shadow:0 -4px 14px rgba(15,23,42,.08)}
  .pw-shop-sticky-buy img{width:42px;height:42px;border-radius:8px;object-fit:cover;flex-shrink:0;background:var(--pw-surface)}
  .pw-shop-sticky-buy-info{flex:1;min-width:0}
  .pw-shop-sticky-buy-info p{margin:0;font-size:12px;line-height:1.3;color:#111827;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .pw-shop-sticky-buy-info p.pw-shop-price{font-size:13px}
  .pw-shop-sticky-buy-actions{display:flex;gap:6px;flex-shrink:0}
  .pw-shop-sticky-buy-actions .pw-shop-btn{padding:9px 12px;font-size:12px}
}
@media(max-width:767px){
  .pw-shop{padding-bottom:72px}
  [data-pw-page="product"] .pw-shop-bottom-nav:not([data-pw-pdp-bottom]),
  [data-pw-page="product"] .pw-bottom-nav:not([data-pw-pdp-bottom]){display:none!important}
  .pw-shop-bottom-nav[data-pw-pdp-bottom],.pw-bottom-nav[data-pw-pdp-bottom]{
    justify-content:flex-start;gap:6px;padding:6px 8px calc(6px + env(safe-area-inset-bottom,0px))
  }
  .pw-shop-sticky-buy.is-visible{bottom:0}
}
${PW_STOCK_CHROME_EDIT_CSS}
${PW_CHROME_LABELED_MIN_W_CSS}
${PW_CHROME_LABEL_FACE_CSS}
${PW_CHROME_FACE_EXTRAS_CSS}
${PW_CHROME_TEXT_ONLY_HIDE_ICON_CSS}`
}

export const PARTNER_SHOP_THEME_STYLE_ID = 'pw-shop-theme-css'

/** Visual PDP/listing HTML has no React shell — ship the same shop CSS the live storefront uses. */
export function injectPartnerShopThemeCss(html: string, theme?: PartnerWebsiteTheme | null): string {
  const trimmed = html.trim()
  if (!trimmed) return html
  const css = buildPartnerSiteShopThemeCss(theme || DEFAULT_PARTNER_WEBSITE_THEME)
  const tag = `<style id="${PARTNER_SHOP_THEME_STYLE_ID}">${css}</style>`
  let replaced = false
  let out = trimmed.replace(
    new RegExp(`<style id="${PARTNER_SHOP_THEME_STYLE_ID}">[\\s\\S]*?<\\/style>`, 'gi'),
    () => {
      if (replaced) return ''
      replaced = true
      return tag
    }
  )
  if (!replaced) {
    if (/<\/head>/i.test(out)) out = out.replace(/<\/head>/i, `${tag}\n</head>`)
    else if (/<html[^>]*>/i.test(out)) out = out.replace(/<html[^>]*>/i, (m) => `${m}\n<head>${tag}</head>`)
    else out = `${tag}\n${out}`
  }
  return out
}
