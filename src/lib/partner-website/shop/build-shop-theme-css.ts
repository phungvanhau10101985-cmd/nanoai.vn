import type { PartnerWebsiteTheme } from '@/lib/partner-website/template/partner-website-template-types'

/** Fashion-orange aligned chrome for React platform shop pages. */
export function buildPartnerSiteShopThemeCss(theme: PartnerWebsiteTheme): string {
  return `:root{
  --pw-primary:${theme.primaryColor};
  --pw-accent:${theme.accentColor};
  --pw-bg:${theme.backgroundColor};
  --pw-text:${theme.textColor};
  --pw-muted:${theme.mutedColor};
  --pw-footer:#4b5563;
}
.pw-shop{min-height:100dvh;background:
  radial-gradient(900px 420px at 0% -10%, color-mix(in srgb, var(--pw-primary) 14%, transparent), transparent 55%),
  radial-gradient(700px 360px at 100% 0%, rgba(251,191,36,.10), transparent 50%),
  var(--pw-bg);color:var(--pw-text);font-family:var(--pw-font-ui), 'Segoe UI', system-ui, -apple-system, sans-serif;line-height:1.6;padding-bottom:72px;-webkit-font-smoothing:auto;-moz-osx-font-smoothing:auto;font-synthesis:none;text-rendering:optimizeLegibility}
.pw-shop h1,.pw-shop h2,.pw-shop-info h1{font-family:var(--pw-font-ui), 'Segoe UI', system-ui, -apple-system, sans-serif}
.pw-shop a{color:inherit;text-decoration:none}
.pw-shop-topbar{background:var(--pw-primary);color:#fff;font-size:12px}
.pw-shop-topbar-inner{max-width:1180px;margin:0 auto;padding:8px 20px;display:flex;justify-content:flex-end;gap:16px}
.pw-shop-topbar a,.pw-shop-topbar button{color:#fff;background:none;border:none;cursor:pointer;font:inherit;padding:0}
.pw-shop-header{position:sticky;top:0;z-index:40;background:#fff;border-bottom:1px solid #f3f4f6}
.pw-shop-header-inner{max-width:1180px;margin:0 auto;padding:12px 20px;display:flex;align-items:center;gap:12px}
.pw-shop-brand-cluster{position:relative;display:flex;align-items:center;gap:10px;flex-shrink:0}
.pw-shop-cat-btn{display:inline-flex;align-items:center;gap:6px;height:36px;padding:0 12px;border:1px solid #e5e7eb;border-radius:999px;background:#fff;color:#374151;font:inherit;font-size:13px;font-weight:700;cursor:pointer;white-space:nowrap}
.pw-shop-nav-icon{width:20px;height:20px;flex-shrink:0;display:block}
.pw-shop-cat-panel{position:absolute;left:0;top:calc(100% + 8px);z-index:60;min-width:200px;display:grid;gap:2px;padding:8px;background:#fff;border:1px solid #e5e7eb;border-radius:12px;box-shadow:0 12px 32px rgba(15,23,42,.12)}
.pw-shop-cat-panel a{display:block;padding:10px 12px;border-radius:8px;font-size:13px;font-weight:700;color:#374151}
.pw-shop-cat-panel a:hover{background:#fff7ed;color:var(--pw-primary)}
.pw-shop-cat-panel a.is-sale{color:var(--pw-primary)}
.pw-shop-logo{height:36px;width:auto;object-fit:contain}
.pw-shop-brand{font-weight:800;font-size:1.1rem;color:var(--pw-primary);white-space:nowrap}
.pw-shop-search-wrap{flex:1;min-width:0;max-width:560px;margin:0 auto;position:relative}
.pw-shop-search-form{display:flex;align-items:stretch;border:2px solid var(--pw-primary);border-radius:999px;overflow:hidden;background:#fff}
.pw-shop-search-form input[type="search"]{flex:1;min-width:0;border:none;outline:none;padding:10px 14px;font:inherit;background:transparent;color:#111827}
.pw-shop-search-form input[type="search"]::placeholder{color:#9ca3af}
.pw-shop-search-image{display:inline-flex;align-items:center;justify-content:center;border:none;background:#fff7ed;padding:0 10px;cursor:pointer;color:var(--pw-primary)}
.pw-shop-search-image .pw-shop-nav-icon{width:18px;height:18px}
.pw-shop-search-submit{display:inline-flex;align-items:center;justify-content:center;gap:4px;border:none;background:var(--pw-primary);color:#fff;font-weight:800;font-size:12px;letter-spacing:.04em;text-transform:uppercase;padding:0 16px;cursor:pointer;white-space:nowrap}
.pw-shop-search-submit-icon{display:none;width:18px;height:18px}
.pw-shop-search-panel{position:absolute;left:0;right:0;top:calc(100% + 8px);z-index:50;background:#fff;border:1px solid #e5e7eb;border-radius:12px;box-shadow:0 12px 32px rgba(15,23,42,.12);padding:12px;max-height:min(70vh,480px);overflow:auto}
.pw-shop-search-panel-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
.pw-shop-search-panel-head button{border:none;background:transparent;font-size:1.25rem;cursor:pointer;line-height:1;color:var(--pw-muted)}
.pw-shop-search-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px}
.pw-shop-search-card{display:flex;flex-direction:column;gap:4px;border-radius:10px;overflow:hidden;border:1px solid #f3f4f6;background:#fff}
.pw-shop-search-card img,.pw-shop-search-ph{width:100%;aspect-ratio:1;object-fit:cover;background:#fff7ed;display:block}
.pw-shop-search-name{font-size:12px;font-weight:600;padding:0 8px;line-height:1.3}
.pw-shop-search-card .pw-shop-price{padding:0 8px 8px;font-size:12px}
.pw-shop-header-actions{display:flex;align-items:center;gap:4px;margin-left:auto}
.pw-shop-account-wrap{position:relative}
.pw-shop-account-panel{position:absolute;right:0;top:calc(100% + 8px);z-index:60;min-width:220px;display:grid;gap:2px;padding:6px;background:#fff;border:1px solid #e5e7eb;border-radius:12px;box-shadow:0 12px 32px rgba(15,23,42,.12)}
.pw-shop-account-panel a{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:8px;font-size:13px;font-weight:600;color:#374151}
.pw-shop-account-panel a:hover{background:#fff7ed;color:var(--pw-primary)}
.pw-shop-account-panel a.is-header{background:#eff6ff;color:#2563eb;border-left:3px solid #2563eb;border-radius:8px 8px 8px 6px;font-weight:700}
.pw-shop-account-panel a.is-header:hover{background:#dbeafe;color:#1d4ed8}
.pw-shop-account-panel a.is-accent{background:#fff7ed;color:#ea580c;border-left:3px solid #f97316;border-radius:8px 8px 8px 6px;font-weight:700}
.pw-shop-account-panel a.is-accent:hover{background:#ffedd5;color:#c2410c}
.pw-shop-account-icon{width:18px;height:18px;flex-shrink:0;color:inherit;opacity:.85}
.pw-shop-account-panel a.is-header .pw-shop-account-icon{color:#2563eb}
.pw-shop-account-panel a.is-accent .pw-shop-account-icon{color:#ea580c}
.pw-shop-account-summary{margin-top:16px;padding:16px 18px;border:1px solid #e5e7eb;border-radius:12px;background:#fff}
.pw-shop-account-greeting{font-size:1.1rem;font-weight:700;margin:0 0 8px}
.pw-shop-account-links{margin-top:28px}
.pw-shop-account-links h2,.pw-shop-account-edit h2{font-size:1rem;margin:0 0 12px;text-transform:uppercase;letter-spacing:.04em;color:var(--pw-primary)}
.pw-shop-account-links-grid{display:grid;gap:10px;grid-template-columns:repeat(auto-fill,minmax(140px,1fr))}
.pw-shop-account-link-card{display:flex;flex-direction:column;align-items:flex-start;gap:8px;padding:14px;border:1px solid #e5e7eb;border-radius:12px;background:#fff;font-weight:700;font-size:13px;color:#374151}
.pw-shop-account-link-card:hover{border-color:var(--pw-primary);color:var(--pw-primary);background:#fff7ed}
.pw-shop-account-link-card.is-accent{border-color:#fdba74;background:#fff7ed;color:#ea580c}
.pw-shop-account-link-icon{width:20px;height:20px}
.pw-shop-account-edit{margin-top:32px;padding-top:24px;border-top:1px solid #e5e7eb}
.pw-shop-page-head{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;margin-bottom:8px}
.pw-shop-page-head h1{margin:0}
.pw-shop-orders-list{list-style:none;padding:0;margin-top:16px;display:grid;gap:12px}
.pw-shop-order-card{border:1px solid #e2e8f0;border-radius:12px;padding:16px;background:#fff}
.pw-shop-order-card-head{display:flex;gap:14px;align-items:flex-start}
.pw-shop-order-thumb{width:72px;height:72px;object-fit:cover;border-radius:8px;flex-shrink:0;background:#fff7ed}
.pw-shop-order-card-main{flex:1;min-width:0}
.pw-shop-order-actions{margin-top:12px}
.pw-shop-order-payment{margin-top:12px;padding-top:12px;border-top:1px solid #e5e7eb}
.pw-shop-order-qr{max-width:280px;width:100%;border-radius:8px}
.pw-shop-address-card{margin-top:16px;padding:16px 18px;border:1px solid #e5e7eb;border-radius:12px;background:#fff}
.pw-shop-address-card-label{font-weight:700;margin:0 0 6px;color:var(--pw-primary)}
.pw-shop-icon-btn{display:inline-flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;min-width:44px;min-height:40px;border-radius:10px;border:none;background:transparent;color:#374151;cursor:pointer;position:relative;font-weight:700;font-size:10px;line-height:1.1;padding:4px 6px;text-decoration:none}
.pw-shop-icon-label{max-width:4.8rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pw-shop-cart-badge{position:absolute;top:0;right:2px;min-width:16px;height:16px;border-radius:999px;background:var(--pw-primary);color:#fff;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;padding:0 4px}
.pw-shop-nav-row{display:none;justify-content:center;gap:18px;flex-wrap:wrap;padding:0 20px 12px;max-width:1180px;margin:0 auto}
.pw-shop-nav-row a{font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#374151}
.pw-shop-nav-row a.is-sale{color:var(--pw-primary)}
.pw-shop-main{max-width:1180px;margin:0 auto;padding:24px 20px 48px}
.pw-shop-main h1{font-size:clamp(1.35rem,2.2vw,1.75rem);font-weight:700;letter-spacing:0;margin:0 0 8px;line-height:1.25;color:var(--pw-text)}
.pw-shop-info h1{margin:0 0 16px;font-size:clamp(1.4rem,2.5vw,1.8rem);font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:var(--pw-primary)}
.pw-shop-info p{margin:0 0 12px;color:var(--pw-text);max-width:720px}
.pw-shop-info ul{margin:0 0 16px;padding-left:1.2rem;color:var(--pw-muted)}
.pw-shop-info details{border:1px solid #e5e7eb;border-radius:8px;padding:12px 16px;margin-bottom:10px;background:#fff}
.pw-shop-info summary{font-weight:700;cursor:pointer}
.pw-shop-grid{display:grid;gap:18px;grid-template-columns:repeat(auto-fill,minmax(180px,1fr))}
.pw-shop-card{display:flex;flex-direction:column;border:1px solid #f3f4f6;border-radius:10px;overflow:hidden;background:#fff;box-shadow:0 4px 14px rgba(15,23,42,.06)}
.pw-shop-card img{width:100%;aspect-ratio:1;object-fit:cover}
.pw-shop-card-body{padding:12px;display:grid;gap:8px}
.pw-shop-price{font-weight:800;color:var(--pw-primary)}
.pw-shop-btn{display:inline-flex;align-items:center;justify-content:center;padding:11px 20px;border-radius:8px;border:none;background:var(--pw-primary);color:#fff;font-weight:700;cursor:pointer;text-decoration:none;font-size:14px;line-height:1.35;letter-spacing:0;text-transform:none;font-family:inherit}
.pw-shop-btn:disabled{opacity:.45;cursor:not-allowed;filter:saturate(.75)}
.pw-shop-btn-outline{background:#fff;color:var(--pw-primary);border:2px solid var(--pw-primary)}
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
.pw-shop-product-img{width:100%;border-radius:12px;aspect-ratio:1;object-fit:cover;background:#fff7ed}
.pw-shop-product-gallery{display:grid;gap:10px}
.pw-shop-product-thumbs{display:flex;flex-wrap:wrap;gap:8px}
.pw-shop-product-thumb{width:64px;height:64px;padding:0;border:2px solid transparent;border-radius:8px;overflow:hidden;background:#fff7ed;cursor:pointer}
.pw-shop-product-thumb.is-active{border-color:var(--pw-primary)}
.pw-shop-product-thumb img{width:100%;height:100%;object-fit:cover}
.pw-shop-product-detail{margin-top:40px;display:grid;gap:32px}
.pw-shop-product-detail h2{font-size:1.25rem;margin:0 0 12px;color:var(--pw-primary)}
.pw-shop-product-detail-body{white-space:pre-wrap;line-height:1.75}
.pw-shop-detail-grid{display:grid;gap:12px;grid-template-columns:repeat(auto-fill,minmax(180px,1fr))}
.pw-shop-detail-grid img{width:100%;border-radius:10px;aspect-ratio:1;object-fit:cover;background:#fff7ed}
.pw-shop-product-video{width:100%;max-width:720px;border-radius:12px;border:none;aspect-ratio:16/9;background:#0f172a}
.pw-shop-cart-row{display:grid;gap:12px;padding:16px;border:1px solid #f3f4f6;border-radius:12px;background:#fff;grid-template-columns:80px 1fr auto;box-shadow:0 2px 10px rgba(15,23,42,.04)}
.pw-shop-cart-row img{width:80px;height:80px;object-fit:cover;border-radius:8px}
.pw-shop-form{display:grid;gap:12px;max-width:480px}
.pw-shop-form label{display:grid;gap:6px;font-size:15px;font-weight:600;color:var(--pw-text)}
.pw-shop-form input,.pw-shop-form textarea{padding:11px 12px;border:1px solid #9ca3af;border-radius:8px;font:inherit;font-size:15px;line-height:1.4;color:var(--pw-text);background:#fff}
.pw-shop-form input::placeholder,.pw-shop-form textarea::placeholder{color:#9ca3af}
.pw-shop-muted{color:#4b5563;font-size:14px;line-height:1.5}
.pw-shop-footer{background:var(--pw-footer);color:#f3f4f6;padding:40px 20px 24px;margin-top:32px}
.pw-shop-footer-inner{max-width:1180px;margin:0 auto;display:grid;gap:24px;grid-template-columns:repeat(auto-fit,minmax(160px,1fr))}
.pw-shop-footer h3{margin:0 0 10px;font-size:13px;text-transform:uppercase;letter-spacing:.06em;color:#fff}
.pw-shop-footer a,.pw-shop-footer p{display:block;margin:0 0 8px;font-size:13px;color:#e5e7eb}
.pw-shop-bottom-nav{display:none}
@media(min-width:900px){
  .pw-shop-nav-row{display:flex}
  .pw-shop{padding-bottom:0}
  .pw-shop-icon-btn{flex-direction:row;gap:6px;min-width:auto;min-height:36px;font-size:13px;padding:0 10px;border-radius:999px}
  .pw-shop-icon-label{max-width:none}
  .pw-shop-cart-badge{top:0;right:0}
}
@media(max-width:899px){
  .pw-shop-topbar{display:none}
  .pw-shop-header{background:var(--pw-primary);box-shadow:0 6px 18px rgba(154,52,18,.18)}
  .pw-shop-header-inner{display:flex;flex-wrap:nowrap;align-items:center;gap:6px;padding:8px 10px}
  .pw-shop-brand-cluster{gap:6px;max-width:none;min-width:0;flex-shrink:0}
  .pw-shop-header-actions{gap:0;margin-left:0;flex-shrink:0}
  .pw-shop-account-wrap{display:none}
  .pw-shop-search-wrap{flex:1 1 auto;min-width:0;max-width:none;margin:0}
  .pw-shop-header a.pw-shop-brand,
  .pw-shop-brand{
    color:#fff;
    font-size:.95rem;
    font-weight:700;
    letter-spacing:0;
    line-height:1.2;
    max-width:28vw;
    overflow:hidden;
    text-overflow:ellipsis;
  }
  .pw-shop-logo{height:26px;filter:brightness(0) invert(1)}
  .pw-shop-cat-btn{
    width:34px;height:34px;padding:0;justify-content:center;
    border:1.5px solid rgba(255,255,255,.55);
    background:rgba(255,255,255,.16);
    color:#fff;flex-shrink:0;
  }
  .pw-shop-cat-btn > span{display:none}
  .pw-shop-cat-btn .pw-shop-nav-icon{width:18px;height:18px}
  .pw-shop-search-form{
    border:none;
    height:36px;
    background:#fff;
    box-shadow:0 2px 8px rgba(15,23,42,.10);
  }
  .pw-shop-search-form input[type="search"]{padding:0 8px;font-size:13px;font-weight:500}
  .pw-shop-search-image{background:transparent;padding:0 6px;color:#ea580c}
  .pw-shop-search-image .pw-shop-nav-icon{width:16px;height:16px}
  .pw-shop-search-submit{min-width:36px;padding:0 10px}
  .pw-shop-search-submit-label{display:none}
  .pw-shop-search-submit-icon{display:block;width:16px;height:16px}
  .pw-shop-icon-btn{color:#fff;min-width:32px;min-height:34px;padding:2px}
  .pw-shop-icon-btn .pw-shop-nav-icon{width:20px;height:20px}
  .pw-shop-icon-label{display:none}
  .pw-shop-cart-badge{background:#fff;color:var(--pw-primary);top:-2px;right:-2px;box-shadow:0 0 0 1px rgba(255,255,255,.2)}
  .pw-shop-bottom-nav{position:fixed;left:0;right:0;bottom:0;z-index:50;display:grid;grid-template-columns:repeat(4,1fr);background:#fff;border-top:1px solid #e5e7eb;padding:6px 4px calc(6px + env(safe-area-inset-bottom))}
  .pw-shop-bottom-nav a{display:flex;flex-direction:column;align-items:center;gap:3px;font-size:10px;font-weight:600;color:#6b7280;padding:6px 2px}
  .pw-shop-bottom-nav a .pw-shop-nav-icon{width:22px;height:22px}
  .pw-shop-bottom-nav a.is-active{color:var(--pw-primary)}
}`
}
