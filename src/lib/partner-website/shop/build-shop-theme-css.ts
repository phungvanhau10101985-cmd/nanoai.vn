import type { PartnerWebsiteTheme } from '@/lib/partner-website/template/partner-website-template-types'

export function buildPartnerSiteShopThemeCss(theme: PartnerWebsiteTheme): string {
  return `:root{
  --pw-primary:${theme.primaryColor};
  --pw-accent:${theme.accentColor};
  --pw-bg:${theme.backgroundColor};
  --pw-text:${theme.textColor};
  --pw-muted:${theme.mutedColor};
}
.pw-shop{min-height:100dvh;background:var(--pw-bg);color:var(--pw-text);font-family:${theme.fontFamily};line-height:1.6}
.pw-shop a{color:var(--pw-primary)}
.pw-shop-header{position:sticky;top:0;z-index:20;border-bottom:1px solid #e2e8f0;background:#fff}
.pw-shop-header-inner{max-width:1080px;margin:0 auto;padding:12px 20px;display:flex;align-items:center;gap:12px}
.pw-shop-logo{height:36px;width:auto}
.pw-shop-brand{font-weight:800;color:var(--pw-primary)}
.pw-shop-nav{margin-left:auto;display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.pw-shop-nav a,.pw-shop-nav button.pw-shop-nav-chat{text-decoration:none;font-weight:600;font-size:14px}
.pw-shop-nav button.pw-shop-nav-chat{background:none;border:none;padding:0;cursor:pointer;color:inherit;font:inherit}
.pw-shop-cart-link{position:relative;display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:999px;background:var(--pw-primary);color:#fff!important}
.pw-shop-cart-badge{min-width:18px;height:18px;padding:0 5px;border-radius:999px;background:var(--pw-accent);color:#fff;font-size:11px;font-weight:700;display:inline-flex;align-items:center;justify-content:center}
.pw-shop-main{max-width:1080px;margin:0 auto;padding:24px 20px 48px}
.pw-shop-grid{display:grid;gap:20px;grid-template-columns:repeat(auto-fill,minmax(220px,1fr))}
.pw-shop-card{border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;background:#fff}
.pw-shop-card img{width:100%;aspect-ratio:1;object-fit:cover}
.pw-shop-card-body{padding:12px 16px 16px}
.pw-shop-price{font-weight:700;color:var(--pw-accent)}
.pw-shop-btn{display:inline-flex;align-items:center;justify-content:center;padding:10px 18px;border-radius:999px;border:none;background:var(--pw-accent);color:#fff;font-weight:700;cursor:pointer;text-decoration:none;font-size:14px}
.pw-shop-btn-outline{background:#fff;color:var(--pw-primary);border:1px solid #cbd5e1}
.pw-shop-product-layout{display:grid;gap:24px;grid-template-columns:1fr}
@media(min-width:768px){.pw-shop-product-layout{grid-template-columns:1fr 1fr}}
.pw-shop-product-img{width:100%;border-radius:12px;aspect-ratio:1;object-fit:cover;background:#f1f5f9}
.pw-shop-product-gallery{display:grid;gap:10px}
.pw-shop-product-thumbs{display:flex;flex-wrap:wrap;gap:8px}
.pw-shop-product-thumb{width:64px;height:64px;padding:0;border:2px solid transparent;border-radius:8px;overflow:hidden;background:#f1f5f9;cursor:pointer}
.pw-shop-product-thumb.is-active{border-color:var(--pw-accent)}
.pw-shop-product-thumb img{width:100%;height:100%;object-fit:cover}
.pw-shop-product-detail{margin-top:40px;display:grid;gap:32px}
.pw-shop-product-detail h2{font-size:1.25rem;margin:0 0 12px}
.pw-shop-product-detail-body{white-space:pre-wrap;line-height:1.75;color:var(--pw-text)}
.pw-shop-detail-grid{display:grid;gap:12px;grid-template-columns:repeat(auto-fill,minmax(180px,1fr))}
.pw-shop-detail-grid img{width:100%;border-radius:10px;aspect-ratio:1;object-fit:cover;background:#f1f5f9}
.pw-shop-product-video{width:100%;max-width:720px;border-radius:12px;border:none;aspect-ratio:16/9;background:#0f172a}
.pw-shop-cart-row{display:grid;gap:12px;padding:16px;border:1px solid #e2e8f0;border-radius:12px;background:#fff;grid-template-columns:80px 1fr auto}
.pw-shop-cart-row img{width:80px;height:80px;object-fit:cover;border-radius:8px}
.pw-shop-form{display:grid;gap:12px;max-width:480px}
.pw-shop-form label{display:grid;gap:4px;font-size:14px;font-weight:600}
.pw-shop-form input,.pw-shop-form textarea{padding:10px 12px;border:1px solid #cbd5e1;border-radius:8px;font:inherit}
.pw-shop-muted{color:var(--pw-muted)}`
}
