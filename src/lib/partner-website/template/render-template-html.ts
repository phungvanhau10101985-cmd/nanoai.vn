import { escapeAttr, escapeHtml } from '@/lib/packaging/mockup-share-html'
import { buildPartnerSitePersonalizationBootstrapScript } from '@/lib/partner-website/shop/build-personalization-bootstrap-script'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import {
  partnerSiteCartPath,
  partnerSiteHomePath,
  partnerSiteOrdersPath,
  partnerSiteProductsPath,
} from '@/lib/partner-website/shop/partner-site-shop-paths'
import type { PartnerWebsiteSection, PartnerWebsiteTemplateRenderInput } from '@/lib/partner-website/template/partner-website-template-types'
import { getSectionRegistryEntry, isSectionTypeEnabled } from '@/lib/partner-website/template/section-registry'

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback
}

function renderHero(section: PartnerWebsiteSection, siteSlug?: string): string {
  const title = escapeHtml(str(section.props.title, 'Welcome'))
  const subtitle = escapeHtml(str(section.props.subtitle, ''))
  const cta = escapeHtml(str(section.props.ctaText, 'Get started'))
  const bg = str(section.props.backgroundImage)
  const bgStyle = bg ? `background-image:linear-gradient(rgba(0,0,0,.45),rgba(0,0,0,.45)),url('${escapeAttr(bg)}');` : ''
  const ctaHref = siteSlug?.trim()
    ? escapeAttr(partnerSiteProductsPath(siteSlug.trim()))
    : '#products'
  const utmVariants = Array.isArray(section.props.utmVariants) ? section.props.utmVariants : []
  const utmData =
    utmVariants.length > 0
      ? ` data-pw-hero-variants="${escapeAttr(JSON.stringify(utmVariants))}"`
      : ''
  return `<section class="pw-hero" style="${bgStyle}"${utmData}>
  <div class="pw-container">
    <h1>${title}</h1>
    ${subtitle ? `<p class="pw-muted pw-hero-sub">${subtitle}</p>` : ''}
    <a class="pw-btn" href="${ctaHref}">${cta}</a>
  </div>
</section>`
}

function renderTrustBar(section: PartnerWebsiteSection): string {
  const items = Array.isArray(section.props.items) ? section.props.items : []
  const cells = items
    .slice(0, 6)
    .map((item) => {
      if (!item || typeof item !== 'object') return ''
      const o = item as Record<string, unknown>
      return `<div class="pw-trust-item"><strong>${escapeHtml(str(o.value))}</strong><span>${escapeHtml(str(o.label))}</span></div>`
    })
    .join('')
  if (!cells) return ''
  return `<section class="pw-trust-bar"><div class="pw-container pw-trust-grid">${cells}</div></section>`
}

function renderProducts(section: PartnerWebsiteSection, input: PartnerWebsiteTemplateRenderInput): string {
  const title = escapeHtml(str(section.props.title, 'Products'))
  const subtitle = escapeHtml(str(section.props.subtitle, ''))
  const products = Array.isArray(section.props.products) ? section.props.products : []
  const defaultCta = escapeHtml(str(section.props.productCtaText, 'View'))
  const chatHref = input.chatPath?.trim() ? escapeAttr(input.chatPath) : '#contact'
  const cards = products
    .slice(0, 24)
    .map((item) => {
      if (!item || typeof item !== 'object') return ''
      const o = item as Record<string, unknown>
      const img = str(o.imageUrl)
      const cta = escapeHtml(str(o.ctaText, defaultCta))
      const detailPath = str(o.detailPath)
      const href = detailPath ? escapeAttr(detailPath) : chatHref
      return `<article class="pw-product-card">
        ${img ? `<a href="${href}"><img src="${escapeAttr(img)}" alt="${escapeAttr(str(o.name))}" loading="lazy"/></a>` : '<div class="pw-product-ph"></div>'}
        <h3>${escapeHtml(str(o.name))}</h3>
        ${str(o.price) ? `<p class="pw-price">${escapeHtml(str(o.price))}</p>` : ''}
        ${str(o.description) ? `<p class="pw-muted pw-product-desc">${escapeHtml(str(o.description))}</p>` : ''}
        <a class="pw-btn pw-btn-sm pw-btn-accent" href="${href}">${cta}</a>
      </article>`
    })
    .join('')
  return `<section class="pw-section" id="products"><div class="pw-container">
    <h2>${title}</h2>
    ${subtitle ? `<p class="pw-muted pw-section-sub">${subtitle}</p>` : ''}
    <div class="pw-product-grid">${cards || '<p class="pw-muted">No products yet.</p>'}</div>
  </div></section>`
}

function renderPersonalizedProducts(
  section: PartnerWebsiteSection,
  kind: 'recently-viewed' | 'favorites' | 'recommended'
): string {
  const titleDefaults: Record<typeof kind, string> = {
    'recently-viewed': 'Recently viewed',
    favorites: 'Your favorites',
    recommended: 'Recommended',
  }
  const title = escapeHtml(str(section.props.title, titleDefaults[kind]))
  const subtitle = escapeHtml(str(section.props.subtitle, ''))
  const limit = Math.max(1, Math.min(24, Math.floor(Number(section.props.limit) || 8)))
  const cta = escapeHtml(str(section.props.productCtaText, 'View'))
  const sectionIds: Record<typeof kind, string> = {
    'recently-viewed': 'recently-viewed',
    favorites: 'favorites',
    recommended: 'recommended-for-you',
  }
  const dataKinds: Record<typeof kind, string> = {
    'recently-viewed': 'recently-viewed',
    favorites: 'favorites',
    recommended: 'recommended',
  }
  const sectionId = sectionIds[kind]
  return `<section class="pw-section pw-personalize" id="${sectionId}" data-pw-personalize="${dataKinds[kind]}" data-limit="${limit}" data-cta="${cta}" hidden>
  <div class="pw-container">
    <h2>${title}</h2>
    ${subtitle ? `<p class="pw-muted pw-section-sub">${subtitle}</p>` : ''}
    <div class="pw-product-grid" data-pw-grid></div>
    <p class="pw-muted pw-personalize-empty" hidden></p>
  </div>
</section>`
}

function renderFeatures(section: PartnerWebsiteSection): string {
  const title = escapeHtml(str(section.props.title, 'Features'))
  const items = Array.isArray(section.props.items) ? section.props.items : []
  const cards = items
    .slice(0, 12)
    .map((item) => {
      if (!item || typeof item !== 'object') return ''
      const o = item as Record<string, unknown>
      return `<article class="pw-card"><h3>${escapeHtml(str(o.title))}</h3><p>${escapeHtml(str(o.description))}</p></article>`
    })
    .join('')
  return `<section class="pw-section pw-features"><div class="pw-container"><h2>${title}</h2><div class="pw-grid">${cards}</div></div></section>`
}

function renderTestimonials(section: PartnerWebsiteSection): string {
  const title = escapeHtml(str(section.props.title, 'Testimonials'))
  const items = Array.isArray(section.props.items) ? section.props.items : []
  const cards = items
    .slice(0, 12)
    .map((item) => {
      if (!item || typeof item !== 'object') return ''
      const o = item as Record<string, unknown>
      return `<blockquote class="pw-testimonial"><p>"${escapeHtml(str(o.quote))}"</p><footer><strong>${escapeHtml(str(o.name))}</strong>${str(o.role) ? ` · ${escapeHtml(str(o.role))}` : ''}</footer></blockquote>`
    })
    .join('')
  return `<section class="pw-section pw-testimonials"><div class="pw-container"><h2>${title}</h2><div class="pw-grid">${cards}</div></div></section>`
}

function renderPricing(section: PartnerWebsiteSection, _chatPath?: string): string {
  const title = escapeHtml(str(section.props.title, 'Pricing'))
  const plans = Array.isArray(section.props.plans) ? section.props.plans : []
  const cards = plans
    .slice(0, 6)
    .map((item) => {
      if (!item || typeof item !== 'object') return ''
      const o = item as Record<string, unknown>
      const feats = Array.isArray(o.features) ? o.features : []
      const list = feats.map((f) => `<li>${escapeHtml(String(f))}</li>`).join('')
      const hl = o.highlighted ? ' pw-plan-highlight' : ''
      return `<article class="pw-plan${hl}"><h3>${escapeHtml(str(o.name))}</h3><p class="pw-price">${escapeHtml(str(o.price))}</p><ul>${list}</ul><button type="button" class="pw-btn pw-btn-sm pw-chat-open" data-nanoai-open-chat>Contact</button></article>`
    })
    .join('')
  return `<section class="pw-section"><div class="pw-container"><h2>${title}</h2><div class="pw-pricing-grid">${cards}</div></div></section>`
}

function renderFaq(section: PartnerWebsiteSection): string {
  const title = escapeHtml(str(section.props.title, 'FAQ'))
  const items = Array.isArray(section.props.items) ? section.props.items : []
  const rows = items
    .slice(0, 20)
    .map((item) => {
      if (!item || typeof item !== 'object') return ''
      const o = item as Record<string, unknown>
      return `<details class="pw-faq"><summary>${escapeHtml(str(o.q))}</summary><p>${escapeHtml(str(o.a))}</p></details>`
    })
    .join('')
  return `<section class="pw-section pw-faq-wrap" id="faq"><div class="pw-container"><h2>${title}</h2>${rows}</div></section>`
}

function renderLeadForm(section: PartnerWebsiteSection, siteSlug?: string): string {
  const slug = siteSlug?.trim()
  if (!slug) return ''
  const title = escapeHtml(str(section.props.title, 'Contact'))
  const subtitle = escapeHtml(str(section.props.subtitle, ''))
  const submitText = escapeHtml(str(section.props.submitText, 'Send'))
  const nameLabel = escapeHtml(str(section.props.nameLabel, 'Name'))
  const phoneLabel = escapeHtml(str(section.props.phoneLabel, 'Phone'))
  const emailLabel = escapeHtml(str(section.props.emailLabel, 'Email'))
  const messageLabel = escapeHtml(str(section.props.messageLabel, 'Message'))
  const successMessage = escapeHtml(str(section.props.successMessage, 'Thank you!'))
  const apiUrl = `/api/site/${encodeURIComponent(slug)}/lead`

  return `<section class="pw-section pw-lead-form" id="lead-form">
  <div class="pw-container pw-lead-inner">
    <h2>${title}</h2>
    ${subtitle ? `<p class="pw-muted">${subtitle}</p>` : ''}
    <form class="pw-form" id="pw-lead-form" data-api="${escapeAttr(apiUrl)}" data-success="${successMessage}">
      <label>${nameLabel}<input name="name" type="text" required maxlength="200"/></label>
      <label>${phoneLabel}<input name="phone" type="tel" maxlength="50"/></label>
      <label>${emailLabel}<input name="email" type="email" maxlength="200"/></label>
      <label>${messageLabel}<textarea name="message" rows="4" maxlength="4000"></textarea></label>
      <button type="submit" class="pw-btn pw-btn-accent">${submitText}</button>
      <p class="pw-form-msg" id="pw-lead-msg" hidden></p>
    </form>
  </div>
</section>
<script>(function(){
  var f=document.getElementById('pw-lead-form');
  if(!f)return;
  f.addEventListener('submit',function(e){
    e.preventDefault();
    var msg=document.getElementById('pw-lead-msg');
    var btn=f.querySelector('button[type=submit]');
    if(btn)btn.disabled=true;
    var fd=new FormData(f);
    fetch(f.getAttribute('data-api'),{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        name:fd.get('name')||'',
        phone:fd.get('phone')||'',
        email:fd.get('email')||'',
        message:fd.get('message')||''
      })
    }).then(function(r){return r.json().then(function(j){return {ok:r.ok,j:j};});})
    .then(function(res){
      if(msg){
        msg.hidden=false;
        msg.textContent=res.ok?(f.getAttribute('data-success')||'OK'):(res.j&&res.j.error||'Error');
        msg.className='pw-form-msg '+(res.ok?'pw-form-ok':'pw-form-err');
      }
      if(res.ok)f.reset();
    }).catch(function(){
      if(msg){msg.hidden=false;msg.textContent='Network error';msg.className='pw-form-msg pw-form-err';}
    }).finally(function(){if(btn)btn.disabled=false;});
  });
})();</script>`
}

function renderChatCta(section: PartnerWebsiteSection, _chatPath?: string): string {
  const title = escapeHtml(str(section.props.title, 'Ready?'))
  const subtitle = escapeHtml(str(section.props.subtitle, ''))
  const buttonText = escapeHtml(str(section.props.buttonText, 'Chat'))
  return `<section class="pw-section pw-chat-cta" id="contact"><div class="pw-container pw-center">
  <h2>${title}</h2>
  ${subtitle ? `<p class="pw-muted">${subtitle}</p>` : ''}
  <button type="button" class="pw-btn pw-btn-accent pw-btn-lg pw-chat-open" data-nanoai-open-chat>${buttonText}</button>
</div></section>`
}

function renderGallery(section: PartnerWebsiteSection): string {
  const title = escapeHtml(str(section.props.title, 'Gallery'))
  const images = Array.isArray(section.props.images) ? section.props.images : []
  const cells = images
    .slice(0, 24)
    .map((img) => {
      if (!img || typeof img !== 'object') return ''
      const o = img as Record<string, unknown>
      const url = str(o.url)
      if (!url) return ''
      return `<figure class="pw-gallery-item"><img src="${escapeAttr(url)}" alt="${escapeAttr(str(o.caption))}" loading="lazy"/><figcaption>${escapeHtml(str(o.caption))}</figcaption></figure>`
    })
    .join('')
  if (!cells) return ''
  return `<section class="pw-section"><div class="pw-container"><h2>${title}</h2><div class="pw-gallery">${cells}</div></div></section>`
}

function renderFooter(section: PartnerWebsiteSection): string {
  const brand = escapeHtml(str(section.props.brandName, 'Shop'))
  const note = escapeHtml(str(section.props.note, ''))
  return `<footer class="pw-footer"><div class="pw-container"><strong>${brand}</strong>${note ? `<p class="pw-muted">${note}</p>` : ''}</div></footer>`
}

function renderSection(section: PartnerWebsiteSection, input: PartnerWebsiteTemplateRenderInput): string {
  const enabled = input.enabledSectionTypes ?? []
  if (enabled.length && !isSectionTypeEnabled(section.type, enabled)) return ''
  if (!getSectionRegistryEntry(section.type)) return ''

  switch (section.type) {
    case 'hero-v1':
      return renderHero(section, input.siteSlug)
    case 'trust-bar-v1':
      return renderTrustBar(section)
    case 'products-v1':
      return renderProducts(section, input)
    case 'recently-viewed-v1':
      return renderPersonalizedProducts(section, 'recently-viewed')
    case 'favorites-v1':
      return renderPersonalizedProducts(section, 'favorites')
    case 'recommended-for-you-v1':
      return renderPersonalizedProducts(section, 'recommended')
    case 'features-v1':
      return renderFeatures(section)
    case 'testimonials-v1':
      return renderTestimonials(section)
    case 'pricing-v1':
      return renderPricing(section, input.chatPath)
    case 'faq-v1':
      return renderFaq(section)
    case 'lead-form-v1':
      return renderLeadForm(section, input.siteSlug)
    case 'chat-cta-v1':
      return renderChatCta(section, input.chatPath)
    case 'gallery-v1':
      return renderGallery(section)
    case 'footer-v1':
      return renderFooter(section)
    default:
      return ''
  }
}

function buildStyles(theme: PartnerWebsiteTemplateRenderInput['theme']): string {
  return `:root{
  --pw-primary:${theme.primaryColor};
  --pw-accent:${theme.accentColor};
  --pw-bg:${theme.backgroundColor};
  --pw-text:${theme.textColor};
  --pw-muted:${theme.mutedColor};
}
*{box-sizing:border-box}
body{margin:0;font-family:${theme.fontFamily};color:var(--pw-text);background:var(--pw-bg);line-height:1.6}
.pw-container{max-width:1080px;margin:0 auto;padding:0 20px}
.pw-hero{padding:96px 0;background:linear-gradient(135deg,var(--pw-primary),#0f172a);color:#fff;text-align:center;background-size:cover;background-position:center}
.pw-hero h1{font-size:clamp(2rem,5vw,3rem);margin:0 0 12px}
.pw-hero-sub{color:rgba(255,255,255,.85);margin:0 0 24px;font-size:1.1rem}
.pw-muted{color:var(--pw-muted);margin:0 0 16px}
.pw-section-sub{margin:-8px 0 24px}
.pw-btn{display:inline-block;padding:12px 22px;border-radius:999px;background:#fff;color:var(--pw-primary);font-weight:700;text-decoration:none;border:none;cursor:pointer;font-size:14px}
.pw-btn-sm{padding:8px 16px;font-size:13px}
.pw-btn-lg{padding:14px 28px;font-size:16px}
.pw-btn-accent{background:var(--pw-accent);color:#fff}
.pw-section{padding:64px 0}
.pw-section h2{font-size:clamp(1.5rem,3vw,2rem);margin:0 0 24px;text-align:center}
.pw-grid{display:grid;gap:20px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr))}
.pw-card{padding:20px;border:1px solid #e2e8f0;border-radius:12px;background:#fff}
.pw-trust-bar{background:#f8fafc;border-bottom:1px solid #e2e8f0;padding:20px 0}
.pw-trust-grid{display:flex;flex-wrap:wrap;gap:24px;justify-content:center;text-align:center}
.pw-trust-item strong{display:block;font-size:1.25rem;color:var(--pw-primary)}
.pw-trust-item span{font-size:.875rem;color:var(--pw-muted)}
.pw-product-grid{display:grid;gap:20px;grid-template-columns:repeat(auto-fill,minmax(220px,1fr))}
.pw-product-card{border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;background:#fff;padding-bottom:16px}
.pw-product-card img{width:100%;aspect-ratio:1;object-fit:cover}
.pw-product-ph{aspect-ratio:1;background:linear-gradient(135deg,#e2e8f0,#f1f5f9)}
.pw-product-card h3,.pw-product-card p,.pw-product-card a{margin:8px 16px 0}
.pw-price{font-weight:700;color:var(--pw-accent);margin:4px 16px}
.pw-product-desc{font-size:.875rem}
.pw-testimonial{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin:0}
.pw-testimonial p{font-style:italic;margin:0 0 12px}
.pw-pricing-grid{display:grid;gap:20px;grid-template-columns:repeat(auto-fit,minmax(240px,1fr))}
.pw-plan{border:1px solid #e2e8f0;border-radius:12px;padding:24px;background:#fff;text-align:center}
.pw-plan-highlight{border-color:var(--pw-accent);box-shadow:0 8px 24px rgba(0,0,0,.08)}
.pw-plan ul{list-style:none;padding:0;margin:16px 0;text-align:left}
.pw-faq-wrap details.pw-faq{border:1px solid #e2e8f0;border-radius:8px;padding:12px 16px;margin-bottom:10px;background:#fff}
.pw-lead-form{background:#f8fafc}
.pw-lead-inner{max-width:560px;margin:0 auto;text-align:center}
.pw-form{text-align:left;display:grid;gap:12px;margin-top:20px}
.pw-form label{display:grid;gap:4px;font-size:14px;font-weight:600}
.pw-form input,.pw-form textarea{padding:10px 12px;border:1px solid #cbd5e1;border-radius:8px;font:inherit}
.pw-form-msg{font-size:14px;margin-top:8px}
.pw-form-ok{color:#15803d}
.pw-form-err{color:#b91c1c}
.pw-chat-cta{background:linear-gradient(180deg,#f8fafc,#fff);text-align:center}
.pw-center{text-align:center}
.pw-gallery{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(160px,1fr))}
.pw-gallery-item img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:8px}
.pw-footer{padding:32px 0;border-top:1px solid #e2e8f0;text-align:center}
.pw-header{padding:16px 0;border-bottom:1px solid #e2e8f0;background:#fff;position:sticky;top:0;z-index:10}
.pw-header-inner{display:flex;align-items:center;gap:12px}
.pw-logo{height:40px;width:auto}
.pw-wordmark{font-weight:800;font-size:1.1rem;color:var(--pw-primary)}
.pw-nav{margin-left:auto;display:flex;gap:16px;font-size:14px}
.pw-nav a{color:var(--pw-primary);text-decoration:none;font-weight:600}`
}

export function renderTemplateSiteToHtml(input: PartnerWebsiteTemplateRenderInput): string {
  const home = input.pages.find((p) => p.slug === '/' || p.slug === 'index') ?? input.pages[0]
  const sections = home?.sections ?? []
  const body = sections.map((s) => renderSection(s, input)).join('\n')
  const logo = input.theme.logoUrl ?? input.logoUrl
  const shop = input.siteSlug?.trim() ? getPartnerSiteShopCopy(input.locale) : null
  const siteSlug = input.siteSlug?.trim() ?? ''
  const nav = shop && siteSlug
    ? `<nav class="pw-nav" aria-label="Shop">
    <a href="${escapeAttr(partnerSiteHomePath(siteSlug))}">${escapeHtml(shop.navHome)}</a>
    <a href="${escapeAttr(partnerSiteProductsPath(siteSlug))}">${escapeHtml(shop.navProducts)}</a>
    <a href="#recently-viewed">${escapeHtml(shop.navRecentlyViewed)}</a>
    <a href="#favorites">${escapeHtml(shop.navFavorites)}</a>
    <a href="#recommended-for-you">${escapeHtml(shop.navRecommended)}</a>
    <a href="${escapeAttr(partnerSiteOrdersPath(siteSlug))}">${escapeHtml(shop.navOrders)}</a>
    <a href="#faq">FAQ</a>
    <a href="#lead-form">Contact</a>
    <a href="${escapeAttr(partnerSiteCartPath(siteSlug))}">${escapeHtml(shop.navCart)}</a>
    <button type="button" class="pw-chat-open" data-nanoai-open-chat>${escapeHtml(shop.navChat)}</button>
  </nav>`
    : `<nav class="pw-nav" aria-label="Sections">
    <a href="#products">Products</a>
    <a href="#faq">FAQ</a>
    <a href="#lead-form">Contact</a>
    <a href="#contact">Chat</a>
  </nav>`
  const header = logo
    ? `<header class="pw-header"><div class="pw-container pw-header-inner"><img class="pw-logo" src="${escapeAttr(logo)}" alt="${escapeAttr(input.title)}"/><span class="pw-wordmark">${escapeHtml(input.title)}</span>${nav}</div></header>`
    : `<header class="pw-header"><div class="pw-container pw-header-inner"><span class="pw-wordmark">${escapeHtml(input.title)}</span>${nav}</div></header>`

  const floatingChat = input.chatPath?.trim()
    ? `<button type="button" class="pw-fab-chat pw-chat-open" data-nanoai-open-chat aria-label="Chat">💬</button>
<style>.pw-fab-chat{position:fixed;right:16px;bottom:16px;z-index:9999;width:52px;height:52px;border-radius:50%;background:var(--pw-accent);color:#fff;display:flex;align-items:center;justify-content:center;border:none;cursor:pointer;font-size:22px;box-shadow:0 8px 24px rgba(0,0,0,.2)}.pw-nav .pw-chat-open,.pw-chat-open.pw-btn{background:none;border:none;cursor:pointer;font:inherit}.pw-nav .pw-chat-open{color:var(--pw-primary);font-weight:600;font-size:14px;padding:0}</style>`
    : ''

  const personalizationScript = siteSlug
      ? buildPartnerSitePersonalizationBootstrapScript({ siteSlug, locale: input.locale })
      : ''

  return `<!DOCTYPE html>
<html lang="${escapeAttr(input.locale)}">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${escapeHtml(input.title)}</title>
<style>${buildStyles(input.theme)}</style>
</head>
<body>
${header}
${body}
${floatingChat}
${personalizationScript}
</body>
</html>`
}
