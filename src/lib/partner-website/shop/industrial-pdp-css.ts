/** Product page face for GD09. Header class is stamped after shared chrome is copied. */
export function buildIndustrialPdpCss(): string {
  return `
.pw-industrial-pdp .pw-pdp-sku,
.pw-industrial-pdp [data-pw-pdp-slot="brand"],
.pw-industrial-pdp [data-pw-pdp-slot="flash"],
.pw-industrial-pdp [data-pw-pdp-slot="low-stock"],
.pw-industrial-pdp [data-pw-pdp-option="color"],
.pw-industrial-pdp [data-pw-pdp-option="size"],
.pw-industrial-pdp [data-pw-chrome-btn="try-on"],
.pw-industrial-pdp [data-pw-chrome-btn="favorite-product"],
.pw-industrial-pdp [data-pw-outfit]{display:none!important}
.pw-industrial-pdp .pw-pdp-buy-row{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}
.pw-industrial-pdp .pw-shop-price{color:var(--pw-primary);font-size:28px;font-weight:800;line-height:1.15;margin:0}
.pw-industrial-pdp .pw-pdp-compare{color:var(--pw-muted);text-decoration:line-through;font-size:14px;font-weight:600;margin-left:8px}
.pw-industrial-pdp .pw-pdp-save{color:var(--pw-primary);font-size:13px;font-weight:700;margin:6px 0 0}
.pw-industrial-pdp .pw-ind-lead{margin:12px 0 0;color:var(--pw-text);font-size:14px;line-height:1.55}
.pw-industrial-pdp .pw-ind-specs{border-top:1px solid var(--pw-border);margin-top:16px;padding-top:12px}
.pw-industrial-pdp .pw-ind-specs-head{display:flex;justify-content:space-between;gap:12px;font-size:14px;font-weight:700;margin:0 0 8px}
.pw-industrial-pdp .pw-ind-specs-head span:last-child{color:var(--pw-muted);font-weight:600}
.pw-industrial-pdp .pw-ind-spec{display:flex;gap:10px;align-items:center;padding:7px 0;font-size:14px}
.pw-industrial-pdp .pw-ind-spec svg{flex:0 0 auto;color:var(--pw-muted)}
.pw-industrial-pdp .pw-ind-actions{display:flex;flex-direction:column;gap:10px;margin-top:16px}
.pw-industrial-pdp .pw-ind-actions .pw-shop-btn{width:100%;min-height:48px;border-radius:8px;justify-content:center}
.pw-industrial-pdp .pw-ind-consult{width:100%;min-height:48px;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;gap:8px;text-decoration:none;font-weight:700}
.pw-industrial-pdp .pw-ind-quick{margin:28px 0 8px;text-align:center}
.pw-industrial-pdp .pw-ind-quick h2{margin:0 0 10px;font-size:16px}
.pw-industrial-pdp .pw-ind-quick-links{display:flex;justify-content:center;gap:18px;flex-wrap:wrap}
.pw-industrial-pdp .pw-ind-quick-links a{color:var(--pw-muted);font-size:14px}
.pw-industrial-pdp .pw-pdp-tab{font-weight:700}
.pw-industrial-pdp #pw-pdp-tab-desc:checked ~ .pw-pdp-tablist label[for="pw-pdp-tab-desc"],
.pw-industrial-pdp #pw-pdp-tab-specs:checked ~ .pw-pdp-tablist label[for="pw-pdp-tab-specs"]{color:var(--pw-primary);border-bottom:2px solid var(--pw-primary)}
html[data-pw-edit-device="desktop"] .pw-header.pw-industrial-chrome,
html[data-pw-edit-device="laptop"] .pw-header.pw-industrial-chrome,
html[data-pw-scene-lock="desktop"] .pw-header.pw-industrial-chrome,
html[data-pw-scene-lock="laptop"] .pw-header.pw-industrial-chrome{
  background:var(--pw-primary)!important;color:#fff!important;border-bottom:none!important
}
html[data-pw-edit-device="desktop"] .pw-header.pw-industrial-chrome .pw-topbar,
html[data-pw-edit-device="laptop"] .pw-header.pw-industrial-chrome .pw-topbar,
html[data-pw-scene-lock="desktop"] .pw-header.pw-industrial-chrome .pw-topbar,
html[data-pw-scene-lock="laptop"] .pw-header.pw-industrial-chrome .pw-topbar{display:none!important}
html[data-pw-edit-device="desktop"] .pw-header.pw-industrial-chrome .pw-wordmark,
html[data-pw-edit-device="laptop"] .pw-header.pw-industrial-chrome .pw-wordmark,
html[data-pw-scene-lock="desktop"] .pw-header.pw-industrial-chrome .pw-wordmark,
html[data-pw-scene-lock="laptop"] .pw-header.pw-industrial-chrome .pw-wordmark,
html[data-pw-edit-device="desktop"] .pw-header.pw-industrial-chrome .pw-nav-main a,
html[data-pw-edit-device="laptop"] .pw-header.pw-industrial-chrome .pw-nav-main a,
html[data-pw-scene-lock="desktop"] .pw-header.pw-industrial-chrome .pw-nav-main a,
html[data-pw-scene-lock="laptop"] .pw-header.pw-industrial-chrome .pw-nav-main a{color:#fff!important}
html[data-pw-edit-device="mobile"] .pw-header.pw-industrial-chrome,
html[data-pw-scene-lock="mobile"] .pw-header.pw-industrial-chrome{
  background:#fff!important;color:var(--pw-text,#111827)!important;box-shadow:none!important;border-bottom:1px solid var(--pw-border)!important
}
html[data-pw-edit-device="mobile"] .pw-header.pw-industrial-chrome .pw-wordmark,
html[data-pw-scene-lock="mobile"] .pw-header.pw-industrial-chrome .pw-wordmark{color:var(--pw-text,#111827)!important}
html[data-pw-edit-device="mobile"] .pw-industrial-pdp .pw-shop-breadcrumb,
html[data-pw-scene-lock="mobile"] .pw-industrial-pdp .pw-shop-breadcrumb,
html[data-pw-edit-device="mobile"] .pw-industrial-pdp .pw-pdp-hero-thumbs,
html[data-pw-scene-lock="mobile"] .pw-industrial-pdp .pw-pdp-hero-thumbs,
html[data-pw-edit-device="mobile"] .pw-industrial-pdp .pw-ind-wide-only,
html[data-pw-scene-lock="mobile"] .pw-industrial-pdp .pw-ind-wide-only,
html[data-pw-edit-device="tablet"] .pw-industrial-pdp .pw-ind-wide-only,
html[data-pw-scene-lock="tablet"] .pw-industrial-pdp .pw-ind-wide-only{display:none!important}
html[data-pw-edit-device="mobile"] .pw-industrial-pdp .pw-ind-consult,
html[data-pw-scene-lock="mobile"] .pw-industrial-pdp .pw-ind-consult{background:var(--pw-cart);color:#fff;border:0}
html[data-pw-edit-device="desktop"] .pw-industrial-pdp .pw-ind-mobile-only,
html[data-pw-edit-device="laptop"] .pw-industrial-pdp .pw-ind-mobile-only,
html[data-pw-edit-device="tablet"] .pw-industrial-pdp .pw-ind-mobile-only,
html[data-pw-scene-lock="desktop"] .pw-industrial-pdp .pw-ind-mobile-only,
html[data-pw-scene-lock="laptop"] .pw-industrial-pdp .pw-ind-mobile-only,
html[data-pw-scene-lock="tablet"] .pw-industrial-pdp .pw-ind-mobile-only{display:none!important}
html[data-pw-edit-device="desktop"] .pw-industrial-pdp .pw-ind-consult,
html[data-pw-edit-device="laptop"] .pw-industrial-pdp .pw-ind-consult,
html[data-pw-edit-device="tablet"] .pw-industrial-pdp .pw-ind-consult,
html[data-pw-scene-lock="desktop"] .pw-industrial-pdp .pw-ind-consult,
html[data-pw-scene-lock="laptop"] .pw-industrial-pdp .pw-ind-consult,
html[data-pw-scene-lock="tablet"] .pw-industrial-pdp .pw-ind-consult{background:#fff;color:var(--pw-text);border:1px solid var(--pw-border)}
@media (max-width:767px){
html:not([data-pw-edit-device]):not([data-pw-scene-lock]) .pw-header.pw-industrial-chrome{background:#fff!important;color:var(--pw-text,#111827)!important;box-shadow:none!important;border-bottom:1px solid var(--pw-border)!important}
html:not([data-pw-edit-device]):not([data-pw-scene-lock]) .pw-header.pw-industrial-chrome .pw-wordmark{color:var(--pw-text,#111827)!important}
html:not([data-pw-edit-device]):not([data-pw-scene-lock]) .pw-industrial-pdp .pw-ind-wide-only,
html:not([data-pw-edit-device]):not([data-pw-scene-lock]) .pw-industrial-pdp .pw-shop-breadcrumb,
html:not([data-pw-edit-device]):not([data-pw-scene-lock]) .pw-industrial-pdp .pw-pdp-hero-thumbs{display:none!important}
html:not([data-pw-edit-device]):not([data-pw-scene-lock]) .pw-industrial-pdp .pw-ind-consult{background:var(--pw-cart);color:#fff;border:0}
}
@media (min-width:768px){
html:not([data-pw-edit-device]):not([data-pw-scene-lock]) .pw-industrial-pdp .pw-ind-mobile-only{display:none!important}
html:not([data-pw-edit-device]):not([data-pw-scene-lock]) .pw-industrial-pdp .pw-ind-consult{background:#fff;color:var(--pw-text);border:1px solid var(--pw-border)}
}
@media (min-width:1280px){
html:not([data-pw-edit-device]):not([data-pw-scene-lock]) .pw-header.pw-industrial-chrome{background:var(--pw-primary)!important;color:#fff!important;border-bottom:none!important}
html:not([data-pw-edit-device]):not([data-pw-scene-lock]) .pw-header.pw-industrial-chrome .pw-topbar{display:none!important}
html:not([data-pw-edit-device]):not([data-pw-scene-lock]) .pw-header.pw-industrial-chrome .pw-wordmark,
html:not([data-pw-edit-device]):not([data-pw-scene-lock]) .pw-header.pw-industrial-chrome .pw-nav-main a{color:#fff!important}
}
`.trim()
}
