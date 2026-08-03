import { escapeAttr, escapeHtml } from '@/lib/packaging/mockup-share-html'
import { buildPartnerSitePersonalizationBootstrapScript } from '@/lib/partner-website/shop/build-personalization-bootstrap-script'
import {
  buildPartnerSiteAccountPanelCss,
  buildPartnerSiteHeaderHtml,
} from '@/lib/partner-website/shop/build-partner-site-header-html'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import {
  partnerSiteCartPath,
  partnerSiteInfoPath,
  partnerSiteOrdersPath,
  partnerSiteProductsPath,
  partnerSiteWishlistPath,
} from '@/lib/partner-website/shop/partner-site-shop-paths'
import {
  FASHION_SHOP_FONT_DISPLAY,
  FASHION_SHOP_FONT_UI,
  FASHION_SHOP_GOOGLE_FONTS_HREF,
  buildFashionShopMotionCss,
} from '@/lib/partner-website/shop/fashion-shop-design'
import type {
  PartnerWebsiteSection,
  PartnerWebsiteTemplateRenderInput,
} from '@/lib/partner-website/template/partner-website-template-types'
import { getSectionRegistryEntry, isSectionTypeEnabled } from '@/lib/partner-website/template/section-registry'

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback
}

function renderHero(section: PartnerWebsiteSection, siteSlug?: string): string {
  const title = escapeHtml(str(section.props.title, 'Welcome'))
  const subtitle = escapeHtml(str(section.props.subtitle, ''))
  const cta = escapeHtml(str(section.props.ctaText, 'Shop now'))
  const bg = str(section.props.backgroundImage)
  const bgStyle = bg
    ? `background-image:linear-gradient(90deg,rgba(249,115,22,.55),rgba(0,0,0,.25)),url('${escapeAttr(bg)}');`
    : ''
  const ctaHref = siteSlug?.trim()
    ? escapeAttr(partnerSiteProductsPath(siteSlug.trim()))
    : '#products'
  const utmVariants = Array.isArray(section.props.utmVariants) ? section.props.utmVariants : []
  const utmData =
    utmVariants.length > 0
      ? ` data-pw-hero-variants="${escapeAttr(JSON.stringify(utmVariants))}"`
      : ''
  return `<section class="pw-hero" style="${bgStyle}"${utmData}>
  <div class="pw-hero-inner pw-container">
    <div class="pw-hero-copy">
      <h1>${title}</h1>
      ${subtitle ? `<p class="pw-hero-sub">${subtitle}</p>` : ''}
      <a class="pw-btn pw-btn-hero" href="${ctaHref}">${cta}</a>
      <div class="pw-hero-dots" aria-hidden="true"><span class="is-active"></span><span></span><span></span></div>
    </div>
  </div>
</section>`
}

function renderCategories(
  section: PartnerWebsiteSection,
  input: PartnerWebsiteTemplateRenderInput
): string {
  const title = escapeHtml(str(section.props.title, 'Categories'))
  const items = Array.isArray(section.props.items) ? section.props.items : []
  const siteSlug = input.siteSlug?.trim() ?? ''
  const fallbackHref = siteSlug ? partnerSiteProductsPath(siteSlug) : '#products'
  const cards = items
    .slice(0, 8)
    .map((item) => {
      if (!item || typeof item !== 'object') return ''
      const o = item as Record<string, unknown>
      const name = escapeHtml(str(o.name, 'Category'))
      const img = str(o.imageUrl)
      const href = escapeAttr(str(o.href) || fallbackHref)
      return `<a class="pw-cat-card" href="${href}">
        <span class="pw-cat-media">${img ? `<img src="${escapeAttr(img)}" alt="${name}" loading="lazy"/>` : ''}</span>
        <span class="pw-cat-label">${name}</span>
      </a>`
    })
    .join('')
  if (!cards) return ''
  return `<section class="pw-section pw-categories" id="categories">
  <div class="pw-container">
    <h2 class="pw-section-title">${title}</h2>
    <div class="pw-cat-grid">${cards}</div>
  </div>
</section>`
}

function renderStaticProductCards(
  products: unknown[],
  opts: { showNew: boolean; hrefFallback: string; limit: number }
): string {
  return products
    .slice(0, opts.limit)
    .map((item) => {
      if (!item || typeof item !== 'object') return ''
      const o = item as Record<string, unknown>
      const img = str(o.imageUrl)
      const detailPath = str(o.detailPath)
      const href = detailPath ? escapeAttr(detailPath) : opts.hrefFallback
      const name = escapeHtml(str(o.name))
      return `<article class="pw-product-card">
        <a class="pw-product-card-media" href="${href}">
          ${opts.showNew ? '<span class="pw-badge-new">NEW</span>' : ''}
          ${img ? `<img src="${escapeAttr(img)}" alt="${escapeAttr(str(o.name))}" loading="lazy"/>` : '<div class="pw-product-ph"></div>'}
        </a>
        <div class="pw-product-card-body">
          <h3><a href="${href}">${name}</a></h3>
          ${str(o.price) ? `<p class="pw-price">${escapeHtml(str(o.price))}</p>` : ''}
          <a class="pw-btn pw-btn-cart" href="${href}">${escapeHtml(str(o.ctaText, 'Add to cart'))}</a>
        </div>
      </article>`
    })
    .join('')
}

function renderProducts(section: PartnerWebsiteSection, input: PartnerWebsiteTemplateRenderInput): string {
  const title = escapeHtml(str(section.props.title, 'Products'))
  const subtitle = escapeHtml(str(section.props.subtitle, ''))
  const limit = Math.max(1, Math.min(24, Math.floor(Number(section.props.limit) || 8)))
  const siteSlug = input.siteSlug?.trim() ?? ''
  const useLive = Boolean(siteSlug) && section.props.useInventory !== false && !input.samplePreview
  const variant = str(section.props.variant, 'default')
  const showNew = section.props.showNewBadge === true
  const bandClass = variant === 'best-sellers' ? ' pw-band-orange' : ''
  const sectionClass =
    variant === 'best-sellers'
      ? 'pw-section pw-catalog pw-best-sellers'
      : variant === 'new-arrivals'
        ? 'pw-section pw-catalog pw-new-arrivals'
        : 'pw-section pw-catalog'
  const titleClass = variant === 'best-sellers' ? 'pw-section-title pw-section-title-light' : 'pw-section-title'
  const products = Array.isArray(section.props.products) ? section.props.products : []
  const chatHref = input.chatPath?.trim() ? escapeAttr(input.chatPath) : '#products'
  const fallbackCards = renderStaticProductCards(products, {
    showNew,
    hrefFallback: chatHref,
    limit,
  })

  if (useLive) {
    return `<section class="${sectionClass}${bandClass}" id="${variant === 'best-sellers' ? 'best-sellers' : 'products'}" data-pw-catalog data-limit="${limit}" data-sort="default"${showNew ? ' data-new-badge="1"' : ''}>
  <div class="pw-container">
    <h2 class="${titleClass}">${title}</h2>
    ${subtitle ? `<p class="pw-muted pw-section-sub">${subtitle}</p>` : ''}
    <div class="pw-product-grid" data-pw-grid>${fallbackCards}</div>
    <p class="pw-catalog-empty pw-personalize-empty" hidden></p>
  </div>
</section>`
  }

  const sectionId = variant === 'best-sellers' ? 'best-sellers' : 'products'
  return `<section class="${sectionClass}${bandClass}" id="${sectionId}"><div class="pw-container">
    <h2 class="${titleClass}">${title}</h2>
    ${subtitle ? `<p class="pw-muted pw-section-sub">${subtitle}</p>` : ''}
    <div class="pw-product-grid">${fallbackCards || '<p class="pw-muted">No products yet.</p>'}</div>
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
    <h2 class="pw-section-title">${title}</h2>
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
  return `<section class="pw-section pw-features"><div class="pw-container"><h2 class="pw-section-title">${title}</h2><div class="pw-grid">${cards}</div></div></section>`
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
  return `<section class="pw-section pw-testimonials"><div class="pw-container"><h2 class="pw-section-title">${title}</h2><div class="pw-grid">${cards}</div></div></section>`
}

function renderPricing(section: PartnerWebsiteSection): string {
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
  return `<section class="pw-section"><div class="pw-container"><h2 class="pw-section-title">${title}</h2><div class="pw-pricing-grid">${cards}</div></div></section>`
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
  return `<section class="pw-section pw-faq-wrap" id="faq"><div class="pw-container"><h2 class="pw-section-title">${title}</h2>${rows}</div></section>`
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
    <h2 class="pw-section-title">${title}</h2>
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

function renderChatCta(section: PartnerWebsiteSection): string {
  const title = escapeHtml(str(section.props.title, 'Ready?'))
  const subtitle = escapeHtml(str(section.props.subtitle, ''))
  const buttonText = escapeHtml(str(section.props.buttonText, 'Chat'))
  return `<section class="pw-section pw-chat-cta" id="contact"><div class="pw-container pw-center">
  <h2 class="pw-section-title">${title}</h2>
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
  return `<section class="pw-section"><div class="pw-container"><h2 class="pw-section-title">${title}</h2><div class="pw-gallery">${cells}</div></div></section>`
}

function renderFooter(
  section: PartnerWebsiteSection,
  input: PartnerWebsiteTemplateRenderInput
): string {
  const brand = escapeHtml(str(section.props.brandName, input.title || 'Shop'))
  const note = escapeHtml(str(section.props.note, ''))
  const about = escapeHtml(
    str(
      section.props.aboutText,
      input.locale === 'vi'
        ? 'Shop thời trang — chất lượng, giao nhanh, tư vấn tận tâm.'
        : 'Fashion shop — quality pieces, fast delivery, friendly support.'
    )
  )
  const siteSlug = input.siteSlug?.trim() ?? ''
  const shop = siteSlug || input.samplePreview ? getPartnerSiteShopCopy(input.locale) : null
  const products = siteSlug ? escapeAttr(partnerSiteProductsPath(siteSlug)) : '#products'
  const cart = siteSlug ? escapeAttr(partnerSiteCartPath(siteSlug)) : '#'
  const wishlist = siteSlug ? escapeAttr(partnerSiteWishlistPath(siteSlug)) : '#'
  const orders = siteSlug ? escapeAttr(partnerSiteOrdersPath(siteSlug)) : '#'
  const aboutPage = siteSlug ? escapeAttr(partnerSiteInfoPath(siteSlug, 'about')) : '#faq'
  const contactPage = siteSlug ? escapeAttr(partnerSiteInfoPath(siteSlug, 'contact')) : '#lead-form'
  const faqPage = siteSlug ? escapeAttr(partnerSiteInfoPath(siteSlug, 'faq')) : '#faq'
  const shippingPage = siteSlug ? escapeAttr(partnerSiteInfoPath(siteSlug, 'shipping')) : '#faq'
  const returnsPage = siteSlug ? escapeAttr(partnerSiteInfoPath(siteSlug, 'returns')) : '#faq'
  const year = new Date().getFullYear()

  const aboutLabel =
    input.locale === 'vi' ? 'Về chúng tôi' : input.locale === 'zh' ? '关于我们' : 'About us'
  const serviceLabel =
    input.locale === 'vi' ? 'Hỗ trợ khách hàng' : input.locale === 'zh' ? '客户服务' : 'Customer service'
  const contactLabel =
    input.locale === 'vi' ? 'Liên hệ' : input.locale === 'zh' ? '联系' : 'Contact'
  const newsLabel =
    input.locale === 'vi' ? 'Nhận ưu đãi' : input.locale === 'zh' ? '订阅优惠' : 'Newsletter'
  const shippingLabel =
    input.locale === 'vi' ? 'Vận chuyển' : input.locale === 'zh' ? '配送' : 'Shipping'
  const returnsLabel =
    input.locale === 'vi' ? 'Đổi trả' : input.locale === 'zh' ? '退换' : 'Returns'

  return `<footer class="pw-footer">
  <div class="pw-container pw-footer-grid">
    <div class="pw-footer-col">
      <h3>${aboutLabel}</h3>
      <p>${about}</p>
      <a href="${aboutPage}">${aboutLabel}</a>
    </div>
    <div class="pw-footer-col">
      <h3>${serviceLabel}</h3>
      <a href="${products}">${shop ? escapeHtml(shop.navProducts) : 'Products'}</a>
      <a href="${wishlist}">${shop ? escapeHtml(shop.navFavorites) : 'Wishlist'}</a>
      <a href="${orders}">${shop ? escapeHtml(shop.navOrders) : 'Orders'}</a>
      <a href="${faqPage}">FAQ</a>
      <a href="${shippingPage}">${shippingLabel}</a>
      <a href="${returnsPage}">${returnsLabel}</a>
    </div>
    <div class="pw-footer-col">
      <h3>${contactLabel}</h3>
      <a href="${contactPage}">${contactLabel}</a>
      <button type="button" class="pw-footer-link-btn pw-chat-open" data-nanoai-open-chat>${shop ? escapeHtml(shop.navChat) : 'Chat'}</button>
      <a href="${cart}">${shop ? escapeHtml(shop.navCart) : 'Cart'}</a>
    </div>
    <div class="pw-footer-col">
      <h3>${newsLabel}</h3>
      <p class="pw-footer-news-hint">${note || brand}</p>
      <form class="pw-newsletter" action="#lead-form" method="get">
        <input type="email" name="email" placeholder="Email" aria-label="Email"/>
        <button type="submit" aria-label="Subscribe">→</button>
      </form>
    </div>
  </div>
  <div class="pw-footer-bottom">
    <div class="pw-container pw-footer-bottom-inner">
      <span>© ${year} ${brand}</span>
      <span>NanoAI</span>
    </div>
  </div>
</footer>`
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

function renderSection(section: PartnerWebsiteSection, input: PartnerWebsiteTemplateRenderInput): string {
  const enabled = input.enabledSectionTypes ?? []
  if (enabled.length && !isSectionTypeEnabled(section.type, enabled)) return ''
  if (!getSectionRegistryEntry(section.type)) return ''

  switch (section.type) {
    case 'hero-v1':
      return renderHero(section, input.siteSlug)
    case 'categories-v1':
      return renderCategories(section, input)
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
      return renderPricing(section)
    case 'faq-v1':
      return renderFaq(section)
    case 'lead-form-v1':
      return renderLeadForm(section, input.siteSlug)
    case 'chat-cta-v1':
      return renderChatCta(section)
    case 'gallery-v1':
      return renderGallery(section)
    case 'footer-v1':
      return renderFooter(section, input)
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
  --pw-dark:#374151;
  --pw-footer:#4b5563;
  --pw-font-display:${FASHION_SHOP_FONT_DISPLAY};
  --pw-font-ui:${FASHION_SHOP_FONT_UI};
}
*{box-sizing:border-box}
html,body{margin:0}
body{font-family:var(--pw-font-ui),${theme.fontFamily};color:var(--pw-text);background:
  radial-gradient(900px 420px at 0% -10%, color-mix(in srgb, var(--pw-primary) 12%, transparent), transparent 55%),
  radial-gradient(700px 360px at 100% 0%, rgba(251,191,36,.08), transparent 50%),
  var(--pw-bg);line-height:1.5;padding-bottom:72px}
${buildFashionShopMotionCss()}
a{color:inherit}
.pw-container{max-width:1180px;margin:0 auto;padding:0 20px}
.pw-topbar{background:var(--pw-primary);color:#fff;font-size:12px}
.pw-topbar-inner{display:flex;justify-content:flex-end;gap:18px;padding:8px 0}
.pw-topbar a,.pw-topbar button{color:#fff;text-decoration:none;background:none;border:none;cursor:pointer;font:inherit;padding:0}
.pw-header{background:#fff;border-bottom:1px solid #f3f4f6;position:sticky;top:0;z-index:40}
.pw-header-main{display:flex;align-items:center;gap:12px;padding:14px 0}
.pw-brand-cluster{position:relative;display:flex;align-items:center;gap:10px;flex-shrink:0}
.pw-brand{display:flex;align-items:center;gap:10px;text-decoration:none;min-width:0}
.pw-logo{height:36px;width:auto;object-fit:contain}
.pw-wordmark{font-weight:800;font-size:1.15rem;color:var(--pw-primary);white-space:nowrap}
.pw-cat-btn{display:inline-flex;align-items:center;gap:6px;height:36px;padding:0 12px;border:1px solid #e5e7eb;border-radius:999px;background:#fff;color:#374151;font:inherit;font-size:13px;font-weight:700;cursor:pointer;white-space:nowrap}
.pw-cat-btn svg{width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:2}
.pw-cat-panel{display:none;position:absolute;left:0;top:calc(100% + 8px);z-index:60;min-width:200px;padding:8px;background:#fff;border:1px solid #e5e7eb;border-radius:12px;box-shadow:0 12px 32px rgba(15,23,42,.12)}
.pw-cat-panel.is-open{display:grid;gap:2px}
.pw-cat-panel a{display:block;padding:10px 12px;border-radius:8px;font-size:13px;font-weight:700;color:#374151;text-decoration:none}
.pw-cat-panel a:hover{background:#fff7ed;color:var(--pw-primary)}
.pw-cat-panel a.pw-nav-sale{color:var(--pw-primary)}
.pw-header-search{flex:1;min-width:0;max-width:560px;margin:0 auto}
.pw-search-form{display:flex;align-items:stretch;border:2px solid var(--pw-primary);border-radius:999px;overflow:hidden;background:#fff}
.pw-search-form input[type="search"]{flex:1;min-width:0;border:none;outline:none;padding:10px 14px;font:inherit;background:transparent}
.pw-search-image-btn{border:none;background:#fff7ed;padding:0 10px;cursor:pointer;font-size:1.05rem;line-height:1}
.pw-search-submit{border:none;background:var(--pw-primary);color:#fff;font-weight:800;font-size:12px;letter-spacing:.04em;text-transform:uppercase;padding:0 16px;cursor:pointer;white-space:nowrap}
.pw-nav-main{display:none;justify-content:center;gap:18px;flex-wrap:wrap;padding:0 0 12px}
.pw-nav-main a{text-decoration:none;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#374151}
.pw-nav-main a.pw-nav-sale{color:var(--pw-primary)}
.pw-header-actions{margin-left:auto;display:flex;align-items:center;gap:10px}
${buildPartnerSiteAccountPanelCss()}
.pw-icon-btn{display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:999px;border:none;background:transparent;color:#374151;text-decoration:none;cursor:pointer;position:relative}
.pw-icon-btn svg{width:20px;height:20px;stroke:currentColor;fill:none;stroke-width:2}
.pw-cart-badge{position:absolute;top:2px;right:2px;min-width:16px;height:16px;border-radius:999px;background:var(--pw-primary);color:#fff;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;padding:0 4px}
.pw-mobile-header{display:none}
.pw-hero{min-height:360px;background:linear-gradient(135deg,var(--pw-primary),#fb923c);background-size:cover;background-position:center;color:#fff;display:flex;align-items:center;border-radius:0;overflow:hidden;position:relative}
.pw-hero::after{content:"";position:absolute;inset:0;background:radial-gradient(ellipse at top right,rgba(251,146,60,.35),transparent 55%);pointer-events:none}
.pw-hero-inner{width:100%;padding:64px 20px;position:relative;z-index:1}
.pw-hero-copy{max-width:560px}
.pw-hero h1{margin:0 0 12px;font-family:var(--pw-font-display);font-size:clamp(2rem,4.5vw,3.4rem);line-height:1.08;letter-spacing:.01em;text-transform:uppercase;font-weight:800}
.pw-hero-sub{margin:0 0 20px;color:rgba(255,255,255,.92);font-size:1rem}
.pw-btn{display:inline-flex;align-items:center;justify-content:center;padding:12px 22px;border-radius:999px;background:var(--pw-primary);color:#fff;font-weight:700;text-decoration:none;border:none;cursor:pointer;font-size:14px}
.pw-btn-hero{background:#fff;color:var(--pw-primary);border-radius:10px;padding:12px 28px;text-transform:uppercase;letter-spacing:.04em}
.pw-btn-accent{background:var(--pw-accent);color:#fff}
.pw-btn-cart{width:100%;border-radius:8px;background:var(--pw-primary);color:#fff;font-size:12px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;padding:10px 12px}
.pw-btn-lg{padding:14px 28px;font-size:16px}
.pw-btn-sm{padding:8px 14px;font-size:13px}
.pw-hero-dots{display:flex;gap:6px;margin-top:18px}
.pw-hero-dots span{width:8px;height:8px;border-radius:50%;background:rgba(255,255,255,.45)}
.pw-hero-dots span.is-active{background:#fff}
.pw-section{padding:48px 0}
.pw-section-title{margin:0 0 22px;text-align:center;font-family:var(--pw-font-display);font-size:clamp(1.25rem,2.5vw,1.7rem);font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--pw-primary)}
.pw-section-title-light{color:#fff}
.pw-section-sub{text-align:center;margin:-8px 0 24px}
.pw-muted{color:var(--pw-muted)}
.pw-band-orange{background:var(--pw-primary)}
.pw-band-orange .pw-muted{color:rgba(255,255,255,.85)}
.pw-cat-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px}
.pw-cat-card{display:flex;flex-direction:column;align-items:center;gap:10px;text-decoration:none;color:inherit}
.pw-cat-media{display:block;width:100%;aspect-ratio:1;border:2px solid var(--pw-primary);border-radius:8px;overflow:hidden;background:#fff7ed}
.pw-cat-media img{width:100%;height:100%;object-fit:cover;display:block}
.pw-cat-label{font-size:13px;font-weight:700;color:#4b5563;text-align:center}
.pw-product-grid{display:grid;gap:18px;grid-template-columns:repeat(4,minmax(0,1fr))}
.pw-product-card{display:flex;flex-direction:column;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #ffedd5;box-shadow:0 12px 36px -18px rgba(234,88,12,.4);transition:transform .35s ease,box-shadow .35s ease}
.pw-product-card:hover{transform:translateY(-4px);box-shadow:0 22px 44px -20px rgba(234,88,12,.5)}
.pw-product-card-media{position:relative;display:block;aspect-ratio:4/5;background:#fff7ed}
.pw-product-card-media img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .7s ease}
.pw-product-card:hover .pw-product-card-media img{transform:scale(1.05)}
.pw-product-ph{width:100%;height:100%;background:linear-gradient(135deg,#fed7aa,#ffedd5)}
.pw-badge-new{position:absolute;top:8px;left:8px;background:#9ca3af;color:#fff;font-size:10px;font-weight:800;padding:3px 8px;border-radius:4px;letter-spacing:.04em}
.pw-product-card-body{padding:12px;display:grid;gap:8px}
.pw-product-card-body h3{margin:0;font-size:14px;line-height:1.35;font-weight:600}
.pw-product-card-body h3 a{color:inherit;text-decoration:none}
.pw-price{margin:0;font-weight:800;color:var(--pw-primary);font-size:15px}
.pw-shop-action-bar{display:grid;gap:8px}
.pw-shop-action-bar .pw-btn{width:100%;border-radius:8px}
.pw-shop-action-bar .pw-btn-sm:not(.pw-btn-accent){display:none}
.pw-grid{display:grid;gap:20px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr))}
.pw-card{padding:20px;border:1px solid #e5e7eb;border-radius:12px;background:#fff}
.pw-trust-bar{background:#fff7ed;border-bottom:1px solid #fed7aa;padding:18px 0}
.pw-trust-grid{display:flex;flex-wrap:wrap;gap:24px;justify-content:center;text-align:center}
.pw-trust-item strong{display:block;font-size:1.2rem;color:var(--pw-primary)}
.pw-trust-item span{font-size:.85rem;color:var(--pw-muted)}
.pw-testimonial{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:20px;margin:0}
.pw-pricing-grid{display:grid;gap:20px;grid-template-columns:repeat(auto-fit,minmax(240px,1fr))}
.pw-plan{border:1px solid #e5e7eb;border-radius:12px;padding:24px;background:#fff;text-align:center}
.pw-plan-highlight{border-color:var(--pw-accent);box-shadow:0 8px 24px rgba(0,0,0,.08)}
.pw-plan ul{list-style:none;padding:0;margin:16px 0;text-align:left}
.pw-faq-wrap details.pw-faq{border:1px solid #e5e7eb;border-radius:8px;padding:12px 16px;margin-bottom:10px;background:#fff}
.pw-lead-form{background:#fff7ed}
.pw-lead-inner{max-width:560px;margin:0 auto;text-align:center}
.pw-form{text-align:left;display:grid;gap:12px;margin-top:20px}
.pw-form label{display:grid;gap:4px;font-size:14px;font-weight:600}
.pw-form input,.pw-form textarea{padding:10px 12px;border:1px solid #d1d5db;border-radius:8px;font:inherit}
.pw-form-msg{font-size:14px;margin-top:8px}
.pw-form-ok{color:#15803d}
.pw-form-err{color:#b91c1c}
.pw-chat-cta{background:linear-gradient(180deg,#fff7ed,#fff);text-align:center}
.pw-center{text-align:center}
.pw-gallery{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(160px,1fr))}
.pw-gallery-item img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:8px}
.pw-footer{background:var(--pw-footer);color:#f3f4f6;padding:48px 0 0;margin-top:24px}
.pw-footer-grid{display:grid;gap:28px;grid-template-columns:repeat(4,minmax(0,1fr));padding-bottom:32px}
.pw-footer-col h3{margin:0 0 12px;font-size:14px;text-transform:uppercase;letter-spacing:.06em;color:#fff}
.pw-footer-col p,.pw-footer-col a,.pw-footer-link-btn{display:block;color:#e5e7eb;text-decoration:none;font-size:13px;margin:0 0 8px;background:none;border:none;padding:0;cursor:pointer;font:inherit;text-align:left}
.pw-footer-news-hint{opacity:.85}
.pw-newsletter{display:flex;gap:0;margin-top:10px}
.pw-newsletter input{flex:1;border:none;border-radius:6px 0 0 6px;padding:10px 12px;font:inherit}
.pw-newsletter button{border:none;background:var(--pw-primary);color:#fff;padding:0 14px;border-radius:0 6px 6px 0;font-weight:800;cursor:pointer}
.pw-footer-bottom{border-top:1px solid rgba(255,255,255,.15);padding:14px 0}
.pw-footer-bottom-inner{display:flex;justify-content:space-between;gap:12px;font-size:12px;opacity:.85}
.pw-bottom-nav{display:none}
.pw-fab-chat{position:fixed;right:16px;bottom:84px;z-index:9999;width:52px;height:52px;border-radius:50%;background:var(--pw-accent);color:#fff;display:flex;align-items:center;justify-content:center;border:none;cursor:pointer;font-size:22px;box-shadow:0 8px 24px rgba(0,0,0,.2)}
@media (min-width:900px){
  body{padding-bottom:0}
  .pw-nav-main{display:flex}
  .pw-fab-chat{bottom:16px}
}
@media (max-width:899px){
  .pw-topbar{display:none}
  .pw-header{background:var(--pw-primary);border:none;box-shadow:0 6px 18px rgba(154,52,18,.18)}
  .pw-header-main{display:flex;flex-wrap:nowrap;align-items:center;gap:6px;padding:8px 0}
  .pw-brand-cluster{gap:6px;max-width:none;min-width:0;flex-shrink:0}
  .pw-header-actions{margin-left:0;gap:2px;flex-shrink:0}
  .pw-header-search{flex:1 1 auto;min-width:0;max-width:none;margin:0}
  .pw-wordmark{
    color:#fff;font-size:.92rem;font-weight:800;letter-spacing:-.01em;
    text-shadow:0 1px 1px rgba(0,0,0,.22);
    max-width:28vw;overflow:hidden;text-overflow:ellipsis;
  }
  .pw-logo{height:26px;filter:brightness(0) invert(1)}
  .pw-icon-btn{color:#fff;flex-shrink:0;width:32px;height:34px}
  .pw-cat-btn{
    width:34px;height:34px;padding:0;justify-content:center;
    border:1.5px solid rgba(255,255,255,.55);
    background:rgba(255,255,255,.16);color:#fff;flex-shrink:0;
  }
  .pw-cat-btn span{display:none}
  .pw-search-form{border:none;height:36px;background:#fff;box-shadow:0 2px 8px rgba(15,23,42,.10)}
  .pw-search-form input[type="search"]{padding:0 8px;font-size:13px;font-weight:500}
  .pw-search-image-btn{background:transparent;padding:0 6px}
  .pw-search-submit{min-width:36px;padding:0 10px;font-size:0;letter-spacing:0}
  .pw-search-submit::before{content:"";display:block;width:16px;height:16px;background:center/contain no-repeat url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='11' cy='11' r='7'/%3E%3Cpath d='m20 20-3.5-3.5'/%3E%3C/svg%3E")}
  .pw-hero{margin:12px 16px 0;border-radius:1.5rem;min-height:220px;overflow:hidden}
  .pw-hero-inner{padding:28px 18px}
  .pw-hero h1{font-size:1.45rem}
  .pw-btn-hero{background:var(--pw-primary);color:#fff;border:2px solid #fff}
  .pw-band-orange{background:transparent}
  .pw-band-orange .pw-section-title-light{color:var(--pw-primary)}
  .pw-cat-grid{grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;overflow-x:auto}
  .pw-cat-media{border:none;border-radius:999px;aspect-ratio:1;max-width:72px;margin:0 auto}
  .pw-cat-label{font-size:11px}
  .pw-product-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
  .pw-footer-grid{grid-template-columns:1fr 1fr}
  .pw-bottom-nav{position:fixed;left:0;right:0;bottom:0;z-index:50;display:grid;grid-template-columns:repeat(4,1fr);background:#fff;border-top:1px solid #e5e7eb;padding:6px 4px calc(6px + env(safe-area-inset-bottom))}
  .pw-bottom-nav a{display:flex;flex-direction:column;align-items:center;gap:2px;text-decoration:none;font-size:10px;font-weight:600;color:#6b7280;padding:6px 2px}
  .pw-bottom-nav a.is-active,.pw-bottom-nav a:first-child{color:var(--pw-primary)}
  .pw-bottom-nav svg{width:20px;height:20px;stroke:currentColor;fill:none;stroke-width:2}
}
@media (max-width:520px){
  .pw-footer-grid{grid-template-columns:1fr}
}`
}

export function renderTemplateSiteToHtml(input: PartnerWebsiteTemplateRenderInput): string {
  const home = input.pages.find((p) => p.slug === '/' || p.slug === 'index') ?? input.pages[0]
  const sections = home?.sections ?? []
  const body = sections.map((s) => renderSection(s, input)).join('\n')
  const logo = input.theme.logoUrl ?? input.logoUrl
  const siteSlug = input.siteSlug?.trim() ?? ''

  const chrome = buildPartnerSiteHeaderHtml({
    locale: input.locale,
    title: input.title,
    logoUrl: logo,
    siteSlug: siteSlug || undefined,
    samplePreview: input.samplePreview,
  })

  const floatingChat = input.chatPath?.trim()
    ? `<button type="button" class="pw-fab-chat pw-chat-open" data-nanoai-open-chat aria-label="Chat">💬</button>`
    : ''

  const personalizationScript = siteSlug
    ? buildPartnerSitePersonalizationBootstrapScript({ siteSlug, locale: input.locale })
    : ''

  const faviconLink = logo
    ? `<link rel="icon" href="${escapeAttr(logo)}"/>`
    : ''

  return `<!DOCTYPE html>
<html lang="${escapeAttr(input.locale)}">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${escapeHtml(input.title)}</title>
${faviconLink}
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="${FASHION_SHOP_GOOGLE_FONTS_HREF}" rel="stylesheet"/>
<style>${buildStyles(input.theme)}</style>
</head>
<body id="top">
${chrome.header}
${body}
${floatingChat}
${chrome.bottomNav}
${chrome.scripts}
${personalizationScript}
</body>
</html>`
}
