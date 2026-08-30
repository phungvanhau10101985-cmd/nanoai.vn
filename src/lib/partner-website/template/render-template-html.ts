import { escapeAttr, escapeHtml } from '@/lib/packaging/mockup-share-html'
import { buildPartnerSitePersonalizationBootstrapScript } from '@/lib/partner-website/shop/build-personalization-bootstrap-script'
import {
  buildPartnerSiteAccountPanelCss,
  buildPartnerSiteHeaderHtml,
} from '@/lib/partner-website/shop/build-partner-site-header-html'
import { buildPartnerSiteFooterHtml } from '@/lib/partner-website/shop/build-partner-site-footer-html'
import { partnerSiteProductsPath } from '@/lib/partner-website/shop/partner-site-shop-paths'
import {
  FASHION_SHOP_FONT_DISPLAY,
  FASHION_SHOP_FONT_UI,
  FASHION_SHOP_GOOGLE_FONTS_HREF,
  buildFashionShopMotionCss,
} from '@/lib/partner-website/shop/fashion-shop-design'
import {
  buildShopVisualSeoHead,
  buildShopVisualWebsiteJsonLd,
} from '@/lib/partner-website/shop/build-shop-visual-seo-head'
import { PW_PRODUCT_GRID_RULER_CSS } from '@/lib/partner-website/shop/pw-product-grid-ruler'
import { buildThemeCssVarBlock } from '@/lib/partner-website/template/partner-website-theme-tokens'
import type {
  PartnerWebsiteSection,
  PartnerWebsiteTemplateRenderInput,
} from '@/lib/partner-website/template/partner-website-template-types'
import { getSectionRegistryEntry, isSectionTypeEnabled } from '@/lib/partner-website/template/section-registry'
import { PW_EL, PW_REGION, pwElAttr, pwRegionAttr } from '@/lib/partner-website/visual-editor/pw-ui-contract'
import { PW_SCENE_HEAD_Z, PW_SCENE_TOPBAR_Z } from '@/lib/partner-website/visual-editor/pw-scene'

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback
}

function renderHero(section: PartnerWebsiteSection, siteSlug?: string): string {
  const title = escapeHtml(str(section.props.title, 'Welcome'))
  const subtitle = escapeHtml(str(section.props.subtitle, ''))
  const cta = escapeHtml(str(section.props.ctaText, 'Shop now'))
  const bg = str(section.props.backgroundImage)
  const bgStyle = bg
    ? `background-image:linear-gradient(90deg,color-mix(in srgb, var(--pw-primary) 55%, transparent),rgba(0,0,0,.25)),url('${escapeAttr(bg)}');`
    : ''
  const ctaHref = siteSlug?.trim()
    ? escapeAttr(partnerSiteProductsPath(siteSlug.trim()))
    : '#products'
  const utmVariants = Array.isArray(section.props.utmVariants) ? section.props.utmVariants : []
  const utmData =
    utmVariants.length > 0
      ? ` data-pw-hero-variants="${escapeAttr(JSON.stringify(utmVariants))}"`
      : ''
  return `<section class="pw-hero" ${pwRegionAttr(PW_REGION.banner)} style="${bgStyle}"${utmData}>
  <div class="pw-hero-inner pw-container" ${pwElAttr(PW_EL.inner)}>
    <div class="pw-hero-copy" ${pwElAttr(PW_EL.copy)}>
      <h1 ${pwElAttr(PW_EL.title)}>${title}</h1>
      ${subtitle ? `<p class="pw-hero-sub" ${pwElAttr(PW_EL.subtitle)}>${subtitle}</p>` : ''}
      <a class="pw-btn pw-btn-hero" ${pwElAttr(PW_EL.cta)} href="${ctaHref}">${cta}</a>
      <div class="pw-hero-dots" ${pwElAttr(PW_EL.dots)} aria-hidden="true"><span class="is-active"></span><span></span><span></span></div>
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
      return `<a class="pw-cat-card" ${pwElAttr(PW_EL.card)} href="${href}">
        <span class="pw-cat-media" ${pwElAttr(PW_EL.cardMedia)}>${img ? `<img src="${escapeAttr(img)}" alt="${name}" loading="lazy"/>` : ''}</span>
        <span class="pw-cat-label" ${pwElAttr(PW_EL.cardName)}>${name}</span>
      </a>`
    })
    .join('')
  if (!cards) return ''
  return `<section class="pw-section pw-categories" id="categories" ${pwRegionAttr(PW_REGION.categories)}>
  <div class="pw-container">
    <h2 class="pw-section-title" ${pwElAttr(PW_EL.sectionTitle)}>${title}</h2>
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
      return `<article class="pw-product-card" ${pwElAttr(PW_EL.card)}>
        <a class="pw-product-card-media" ${pwElAttr(PW_EL.cardMedia)} href="${href}">
          ${opts.showNew ? '<span class="pw-badge-new">NEW</span>' : ''}
          ${img ? `<img src="${escapeAttr(img)}" alt="${escapeAttr(str(o.name))}" loading="lazy"/>` : '<div class="pw-product-ph"></div>'}
        </a>
        <div class="pw-product-card-body">
          <h3 ${pwElAttr(PW_EL.cardName)}><a href="${href}">${name}</a></h3>
          ${str(o.price) ? `<p class="pw-price" ${pwElAttr(PW_EL.cardPrice)}>${escapeHtml(str(o.price))}</p>` : ''}
          <a class="pw-btn pw-btn-cart" ${pwElAttr(PW_EL.cardCart)} href="${href}">${escapeHtml(str(o.ctaText, 'Add to cart'))}</a>
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
    return `<section class="${sectionClass}${bandClass}" id="${variant === 'best-sellers' ? 'best-sellers' : 'products'}" ${pwRegionAttr(PW_REGION.catalog)} data-pw-catalog data-limit="${limit}" data-sort="default"${showNew ? ' data-new-badge="1"' : ''}>
  <div class="pw-container">
    <h2 class="${titleClass}" ${pwElAttr(PW_EL.sectionTitle)}>${title}</h2>
    ${subtitle ? `<p class="pw-muted pw-section-sub">${subtitle}</p>` : ''}
    <div class="pw-product-grid" ${pwElAttr(PW_EL.grid)} data-pw-grid>${fallbackCards}</div>
    <p class="pw-catalog-empty pw-personalize-empty" hidden></p>
  </div>
</section>`
  }

  const sectionId = variant === 'best-sellers' ? 'best-sellers' : 'products'
  return `<section class="${sectionClass}${bandClass}" id="${sectionId}" ${pwRegionAttr(PW_REGION.catalog)}><div class="pw-container">
    <h2 class="${titleClass}" ${pwElAttr(PW_EL.sectionTitle)}>${title}</h2>
    ${subtitle ? `<p class="pw-muted pw-section-sub">${subtitle}</p>` : ''}
    <div class="pw-product-grid" ${pwElAttr(PW_EL.grid)}>${fallbackCards || '<p class="pw-muted">No products yet.</p>'}</div>
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
  return `<section class="pw-section pw-personalize" id="${sectionId}" ${pwRegionAttr(PW_REGION.catalog)} data-pw-personalize="${dataKinds[kind]}" data-limit="${limit}" data-cta="${cta}" hidden>
  <div class="pw-container">
    <h2 class="pw-section-title" ${pwElAttr(PW_EL.sectionTitle)}>${title}</h2>
    ${subtitle ? `<p class="pw-muted pw-section-sub">${subtitle}</p>` : ''}
    <div class="pw-product-grid" ${pwElAttr(PW_EL.grid)} data-pw-grid></div>
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
      return `<article class="pw-card"><h3 ${pwElAttr(PW_EL.title)}>${escapeHtml(str(o.title))}</h3><p ${pwElAttr(PW_EL.body)}>${escapeHtml(str(o.description))}</p></article>`
    })
    .join('')
  return `<section class="pw-section pw-features" ${pwRegionAttr(PW_REGION.content)}><div class="pw-container"><h2 class="pw-section-title" ${pwElAttr(PW_EL.title)}>${title}</h2><div class="pw-grid">${cards}</div></div></section>`
}

function renderTestimonials(section: PartnerWebsiteSection): string {
  const title = escapeHtml(str(section.props.title, 'Testimonials'))
  const items = Array.isArray(section.props.items) ? section.props.items : []
  const cards = items
    .slice(0, 12)
    .map((item) => {
      if (!item || typeof item !== 'object') return ''
      const o = item as Record<string, unknown>
      return `<blockquote class="pw-testimonial"><p ${pwElAttr(PW_EL.body)}>"${escapeHtml(str(o.quote))}"</p><footer><strong ${pwElAttr(PW_EL.title)}>${escapeHtml(str(o.name))}</strong>${str(o.role) ? ` · ${escapeHtml(str(o.role))}` : ''}</footer></blockquote>`
    })
    .join('')
  return `<section class="pw-section pw-testimonials" ${pwRegionAttr(PW_REGION.content)}><div class="pw-container"><h2 class="pw-section-title" ${pwElAttr(PW_EL.title)}>${title}</h2><div class="pw-grid">${cards}</div></div></section>`
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
      return `<article class="pw-plan${hl}"><h3 ${pwElAttr(PW_EL.title)}>${escapeHtml(str(o.name))}</h3><p class="pw-price" ${pwElAttr(PW_EL.body)}>${escapeHtml(str(o.price))}</p><ul ${pwElAttr(PW_EL.body)}>${list}</ul><button type="button" class="pw-btn pw-btn-sm pw-chat-open" data-nanoai-open-chat ${pwElAttr(PW_EL.cta)}>Contact</button></article>`
    })
    .join('')
  return `<section class="pw-section" ${pwRegionAttr(PW_REGION.content)}><div class="pw-container"><h2 class="pw-section-title" ${pwElAttr(PW_EL.title)}>${title}</h2><div class="pw-pricing-grid">${cards}</div></div></section>`
}

function renderFaq(section: PartnerWebsiteSection): string {
  const title = escapeHtml(str(section.props.title, 'FAQ'))
  const items = Array.isArray(section.props.items) ? section.props.items : []
  const rows = items
    .slice(0, 20)
    .map((item) => {
      if (!item || typeof item !== 'object') return ''
      const o = item as Record<string, unknown>
      return `<details class="pw-faq" ${pwElAttr(PW_EL.faqItem)}><summary>${escapeHtml(str(o.q))}</summary><p>${escapeHtml(str(o.a))}</p></details>`
    })
    .join('')
  return `<section class="pw-section pw-faq-wrap" id="faq" ${pwRegionAttr(PW_REGION.content)}><div class="pw-container"><h2 class="pw-section-title" ${pwElAttr(PW_EL.title)}>${title}</h2>${rows}</div></section>`
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

  return `<section class="pw-section pw-lead-form" id="lead-form" ${pwRegionAttr(PW_REGION.form)}>
  <div class="pw-container pw-lead-inner">
    <h2 class="pw-section-title" ${pwElAttr(PW_EL.title)}>${title}</h2>
    ${subtitle ? `<p class="pw-muted" ${pwElAttr(PW_EL.subtitle)}>${subtitle}</p>` : ''}
    <form class="pw-form" id="pw-lead-form" data-api="${escapeAttr(apiUrl)}" data-success="${successMessage}">
      <label ${pwElAttr(PW_EL.label)}>${nameLabel}<input name="name" type="text" required maxlength="200" ${pwElAttr(PW_EL.field)}/></label>
      <label ${pwElAttr(PW_EL.label)}>${phoneLabel}<input name="phone" type="tel" maxlength="50" ${pwElAttr(PW_EL.field)}/></label>
      <label ${pwElAttr(PW_EL.label)}>${emailLabel}<input name="email" type="email" maxlength="200" ${pwElAttr(PW_EL.field)}/></label>
      <label ${pwElAttr(PW_EL.label)}>${messageLabel}<textarea name="message" rows="4" maxlength="4000" ${pwElAttr(PW_EL.field)}></textarea></label>
      <button type="submit" class="pw-btn pw-btn-accent" ${pwElAttr(PW_EL.submit)}>${submitText}</button>
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
  return `<section class="pw-section pw-chat-cta" id="contact" ${pwRegionAttr(PW_REGION.promo)}><div class="pw-container pw-center">
  <h2 class="pw-section-title" ${pwElAttr(PW_EL.title)}>${title}</h2>
  ${subtitle ? `<p class="pw-muted" ${pwElAttr(PW_EL.subtitle)}>${subtitle}</p>` : ''}
  <button type="button" class="pw-btn pw-btn-accent pw-btn-lg pw-chat-open" data-nanoai-open-chat ${pwElAttr(PW_EL.cta)}>${buttonText}</button>
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
      return `<figure class="pw-gallery-item"><img src="${escapeAttr(url)}" alt="${escapeAttr(str(o.caption))}" loading="lazy" ${pwElAttr(PW_EL.image)}/><figcaption ${pwElAttr(PW_EL.body)}>${escapeHtml(str(o.caption))}</figcaption></figure>`
    })
    .join('')
  if (!cells) return ''
  return `<section class="pw-section" ${pwRegionAttr(PW_REGION.content)}><div class="pw-container"><h2 class="pw-section-title" ${pwElAttr(PW_EL.title)}>${title}</h2><div class="pw-gallery">${cells}</div></div></section>`
}

function renderFooter(
  section: PartnerWebsiteSection,
  input: PartnerWebsiteTemplateRenderInput
): string {
  const brand = str(section.props.brandName, input.title || 'Shop')
  return buildPartnerSiteFooterHtml({
    locale: input.locale,
    siteSlug: input.siteSlug?.trim() ?? '',
    brand,
    logoUrl: input.logoUrl ?? input.theme.logoUrl ?? null,
  })
}

function renderTrustBar(section: PartnerWebsiteSection): string {
  const items = Array.isArray(section.props.items) ? section.props.items : []
  const cells = items
    .slice(0, 6)
    .map((item) => {
      if (!item || typeof item !== 'object') return ''
      const o = item as Record<string, unknown>
      return `<div class="pw-trust-item"><strong ${pwElAttr(PW_EL.title)}>${escapeHtml(str(o.value))}</strong><span ${pwElAttr(PW_EL.subtitle)}>${escapeHtml(str(o.label))}</span></div>`
    })
    .join('')
  if (!cells) return ''
  return `<section class="pw-trust-bar" ${pwRegionAttr(PW_REGION.promo)}><div class="pw-container pw-trust-grid">${cells}</div></section>`
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
  ${buildThemeCssVarBlock(theme)};
  --pw-dark:#374151;
  --pw-font-display:${FASHION_SHOP_FONT_DISPLAY};
  --pw-font-ui:${FASHION_SHOP_FONT_UI};
}
*{box-sizing:border-box}
html,body{margin:0}
body{font-family:var(--pw-font-ui);color:var(--pw-text);background:
  radial-gradient(900px 420px at 0% -10%, color-mix(in srgb, var(--pw-primary) 12%, transparent), transparent 55%),
  radial-gradient(700px 360px at 100% 0%, color-mix(in srgb, var(--pw-accent) 10%, transparent), transparent 50%),
  var(--pw-bg);line-height:1.5;padding-bottom:72px}
${buildFashionShopMotionCss()}
a{color:inherit}
.pw-container{max-width:1200px;margin:0 auto;padding:0 20px}
.pw-topbar{background:var(--pw-primary);color:#fff;font-size:12px;position:relative;z-index:${PW_SCENE_TOPBAR_Z}}
.pw-topbar-inner{display:flex;justify-content:flex-end;align-items:center;gap:18px;max-width:var(--pw-content,1200px);width:100%;margin:0 auto;padding:8px var(--pw-chrome-inset,60px);box-sizing:border-box}
.pw-topbar a,.pw-topbar button{color:#fff;text-decoration:none;background:none;border:none;cursor:pointer;font:inherit;padding:0}
.pw-header{background:#fff;border-bottom:1px solid #f3f4f6;position:sticky;top:0;z-index:${PW_SCENE_HEAD_Z}}
.pw-header-main{display:flex;align-items:center;gap:12px;padding:14px var(--pw-chrome-inset,60px)}
.pw-brand-cluster{position:relative;display:flex;align-items:center;gap:10px;flex-shrink:0}
.pw-brand{display:inline-flex;align-items:center;gap:10px;text-decoration:none;width:max-content;max-width:100%;min-width:0}
.pw-logo{height:36px;width:auto;object-fit:contain}
.pw-wordmark{font-weight:800;font-size:1.15rem;color:var(--pw-primary);white-space:nowrap}
.pw-cat-btn{display:inline-flex;align-items:center;gap:6px;height:36px;padding:0 12px;border:1px solid #e5e7eb;border-radius:999px;background:#fff;color:#374151;font:inherit;font-size:13px;font-weight:700;cursor:pointer;white-space:nowrap}
.pw-cat-btn svg{width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:2}
.pw-cat-panel{display:none;position:absolute;left:0;top:calc(100% + 8px);z-index:60;min-width:200px;padding:8px;background:#fff;border:1px solid #e5e7eb;border-radius:12px;box-shadow:0 12px 32px rgba(15,23,42,.12)}
.pw-cat-panel.is-open{display:grid;gap:2px}
.pw-cat-panel a{display:block;padding:10px 12px;border-radius:8px;font-size:13px;font-weight:700;color:#374151;text-decoration:none}
.pw-cat-panel a:hover{background:var(--pw-surface);color:var(--pw-primary)}
.pw-cat-panel a.pw-nav-sale{color:#374151}
.pw-header-search{flex:1 1 0%;min-width:72px;min-height:36px;max-width:100%;width:auto;margin:0;position:relative;z-index:1}
.pw-search-form{display:flex;align-items:stretch;width:100%;border:2px solid var(--pw-primary);border-radius:999px;overflow:hidden;background:#fff}
.pw-search-form input[type="search"]{flex:1;min-width:0;border:none;outline:none;padding:10px 14px;font:inherit;background:transparent}
.pw-search-image-btn{border:none;background:transparent;padding:0;cursor:pointer;font-size:0;line-height:1}
.pw-search-submit{border:none;background:var(--pw-primary);color:#fff;font-weight:800;font-size:12px;letter-spacing:.04em;text-transform:uppercase;padding:0 16px;cursor:pointer;white-space:nowrap}
.pw-nav-main{display:none;justify-content:center;gap:18px;flex-wrap:wrap;padding:0 0 12px}
.pw-nav-main a,.pw-nav-main button{text-decoration:none;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#374151;background:none;border:none;cursor:pointer;padding:0}
.pw-nav-main a.pw-nav-sale,.pw-nav-main a.is-sale{color:#374151}
.pw-header-actions{margin-left:auto;display:flex;align-items:center;gap:10px}
${buildPartnerSiteAccountPanelCss()}
.pw-icon-btn{display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:999px;border:none;background:transparent;color:#374151;text-decoration:none;cursor:pointer;position:relative}
.pw-icon-btn svg,.pw-header-actions>a>svg,[data-pw-chrome-btn]>svg,[data-pw-chrome-added] svg{width:20px;height:20px;max-width:20px;max-height:20px;flex-shrink:0;display:block;stroke:currentColor;fill:none;stroke-width:2}
.pw-icon-btn svg.pw-chrome-brand-logo,[data-pw-chrome-btn] svg.pw-chrome-brand-logo,[data-pw-chrome-added] svg.pw-chrome-brand-logo{stroke:none;fill:none;stroke-width:0}
.pw-cart-badge{position:absolute;top:2px;right:2px;min-width:16px;height:16px;border-radius:999px;background:var(--pw-primary);color:#fff;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;padding:0 4px}
.pw-cart-badge[hidden],.pw-shop-cart-badge[hidden],[data-pw-chrome-badge][hidden]{display:none!important}
.pw-mobile-header{display:none}
.pw-hero{min-height:360px;background:linear-gradient(135deg,var(--pw-primary),var(--pw-accent));background-size:cover;background-position:center;color:#fff;display:flex;align-items:center;border-radius:0;overflow:hidden;position:relative}
.pw-hero::after{content:"";position:absolute;inset:0;background:radial-gradient(ellipse at top right,rgba(251,146,60,.35),transparent 55%);pointer-events:none}
.pw-hero-inner{width:100%;padding:64px 20px;position:relative;z-index:1}
.pw-hero-copy{max-width:560px}
.pw-hero h1{margin:0 0 12px;font-family:var(--pw-font-display);font-size:clamp(2rem,4.5vw,3.4rem);line-height:1.08;letter-spacing:.01em;text-transform:uppercase;font-weight:800}
.pw-hero-sub{margin:0 0 20px;color:rgba(255,255,255,.92);font-size:1rem}
.pw-btn{display:inline-flex;align-items:center;justify-content:center;padding:12px 22px;border-radius:999px;background:var(--pw-primary);color:#fff;font-weight:700;text-decoration:none;border:none;cursor:pointer;font-size:14px}
.pw-btn-hero{background:#fff;color:var(--pw-primary);border-radius:10px;padding:12px 28px;letter-spacing:.04em}
.pw-btn-accent{background:var(--pw-accent);color:#fff}
.pw-btn-cart{width:100%;border-radius:8px;background:var(--pw-cart);color:#fff;font-size:12px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;padding:10px 12px}
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
.pw-cat-media{display:block;width:100%;aspect-ratio:1;border:2px solid var(--pw-primary);border-radius:8px;overflow:hidden;background:var(--pw-surface)}
.pw-cat-media img{width:100%;height:100%;object-fit:cover;display:block}
.pw-cat-label{font-size:13px;font-weight:700;color:#4b5563;text-align:center}
.pw-product-grid{display:grid;gap:12px;grid-template-columns:repeat(2,minmax(0,1fr))}
@media (min-width:1280px){
  .pw-product-grid{gap:18px;grid-template-columns:repeat(4,minmax(0,1fr))}
}
@media (min-width:1440px){
  .pw-product-grid{grid-template-columns:repeat(5,minmax(0,1fr))}
}
.pw-product-card{display:flex;flex-direction:column;background:#fff;border-radius:16px;overflow:hidden;border:1px solid var(--pw-border);box-shadow:0 12px 36px -18px color-mix(in srgb, var(--pw-primary) 40%, transparent);transition:transform .35s ease,box-shadow .35s ease}
.pw-product-card:hover{transform:translateY(-4px);box-shadow:0 22px 44px -20px rgba(234,88,12,.5)}
.pw-product-card-media{position:relative;display:block;aspect-ratio:4/5;background:var(--pw-surface)}
.pw-product-card-media img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .7s ease}
.pw-product-card:hover .pw-product-card-media img{transform:scale(1.05)}
.pw-product-ph{width:100%;height:100%;background:linear-gradient(135deg,color-mix(in srgb, var(--pw-primary) 28%, #fff),var(--pw-surface))}
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
.pw-trust-bar{background:var(--pw-surface);border-bottom:1px solid var(--pw-border);padding:18px 0}
.pw-trust-grid{display:flex;flex-wrap:wrap;gap:24px;justify-content:center;text-align:center}
.pw-trust-item strong{display:block;font-size:1.2rem;color:var(--pw-primary)}
.pw-trust-item span{font-size:.85rem;color:var(--pw-muted)}
.pw-testimonial{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:20px;margin:0}
.pw-pricing-grid{display:grid;gap:20px;grid-template-columns:repeat(auto-fit,minmax(240px,1fr))}
.pw-plan{border:1px solid #e5e7eb;border-radius:12px;padding:24px;background:#fff;text-align:center}
.pw-plan-highlight{border-color:var(--pw-accent);box-shadow:0 8px 24px rgba(0,0,0,.08)}
.pw-plan ul{list-style:none;padding:0;margin:16px 0;text-align:left}
.pw-faq-wrap details.pw-faq{border:1px solid #e5e7eb;border-radius:8px;padding:12px 16px;margin-bottom:10px;background:#fff}
.pw-lead-form{background:var(--pw-surface)}
.pw-lead-inner{max-width:560px;margin:0 auto;text-align:center}
.pw-form{text-align:left;display:grid;gap:12px;margin-top:20px}
.pw-form label{display:grid;gap:4px;font-size:14px;font-weight:600}
.pw-form input,.pw-form textarea{padding:10px 12px;border:1px solid #d1d5db;border-radius:8px;font:inherit}
.pw-form-msg{font-size:14px;margin-top:8px}
.pw-form-ok{color:#15803d}
.pw-form-err{color:#b91c1c}
.pw-chat-cta{background:linear-gradient(180deg,var(--pw-surface),#fff);text-align:center}
.pw-center{text-align:center}
.pw-gallery{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(160px,1fr))}
.pw-gallery-item img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:8px}
.pw-footer{background:var(--pw-footer,#fff);color:var(--pw-text,#111827);border-top:1px solid var(--pw-border,#e5e7eb);padding:40px 0 0;margin-top:40px}
.pw-footer-grid{display:grid;gap:28px;grid-template-columns:repeat(4,minmax(0,1fr));padding-bottom:28px}
.pw-footer-col h3{margin:0 0 12px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#111827}
.pw-footer-col p{display:block;color:#4b5563;font-size:14px;line-height:1.65;margin:0 0 10px;padding:0}
.pw-footer-col a,.pw-footer-link-btn{display:flex;align-items:center;color:#4b5563;text-decoration:none;font-size:14px;margin:0;padding:8px 0;min-height:36px;background:none;border:none;cursor:pointer;font:inherit;text-align:left}
.pw-footer-col a:hover,.pw-footer-link-btn:hover{color:var(--pw-primary)}
.pw-footer-news-hint{opacity:.85}
.pw-newsletter{display:flex;gap:0;margin-top:10px}
.pw-newsletter input{flex:1;border:1px solid #e5e7eb;border-right:none;border-radius:6px 0 0 6px;padding:10px 12px;font:inherit;background:#f9fafb}
.pw-newsletter button{border:none;background:var(--pw-primary);color:#fff;padding:0 14px;border-radius:0 6px 6px 0;font-weight:800;cursor:pointer}
.pw-footer-bottom{border-top:1px solid #e5e7eb;padding:16px 0 20px;color:#6b7280}
.pw-footer-bottom-inner{display:flex;justify-content:space-between;gap:12px;font-size:12px;opacity:.85}
.pw-bottom-nav{display:none}
.pw-fab-chat{position:fixed;right:16px;bottom:84px;z-index:9999;width:52px;height:52px;border-radius:50%;background:var(--pw-accent);color:#fff;display:flex;align-items:center;justify-content:center;border:none;cursor:pointer;font-size:22px;box-shadow:0 8px 24px rgba(0,0,0,.2)}
@media (min-width:900px){
  .pw-nav-main{display:flex}
  .pw-header-main{justify-content:flex-start;gap:16px}
  .pw-header-search{flex:1 1 0%;min-width:200px;max-width:100%}
}
html[data-pw-edit-device="laptop"] .pw-header-main,html[data-pw-scene-lock="laptop"] .pw-header-main{gap:8px;padding:8px var(--pw-chrome-inset,60px)}
html[data-pw-edit-device="desktop"] .pw-header-main,html[data-pw-scene-lock="desktop"] .pw-header-main{gap:8px;padding:8px var(--pw-chrome-inset,60px)}
@media (min-width:1280px){
  body{padding-bottom:0}
  .pw-bottom-nav{display:none}
  .pw-fab-chat{bottom:16px}
}
@media (max-width:899px){
  .pw-topbar{display:none}
  .pw-header{background:var(--pw-primary);border:none;box-shadow:0 6px 18px color-mix(in srgb, var(--pw-primary) 35%, transparent)}
  .pw-header-main{display:flex;flex-wrap:nowrap;align-items:center;gap:6px;padding:8px 10px}
  .pw-brand-cluster{gap:6px;max-width:90px;min-width:0;width:auto;overflow:visible;position:relative;z-index:50;flex:0 0 auto}
  .pw-header-actions{margin-left:auto;gap:2px;width:auto;max-width:none;overflow:visible;flex:0 0 auto}
  .pw-header-search{flex:1 1 0%;min-width:72px;max-width:none;width:auto;margin:0;z-index:1}
  .pw-header-search[data-pw-search-width]{flex:1 1 0%;min-width:72px}
  .pw-search-form{width:100%}
  .pw-wordmark{
    color:#fff;font-size:.92rem;font-weight:800;letter-spacing:-.01em;
    text-shadow:0 1px 1px rgba(0,0,0,.22);
    max-width:none;overflow:visible;
  }
  .pw-logo{height:28px;padding:0;background:transparent;border-radius:0;filter:none;position:relative;z-index:90;overflow:visible;object-fit:contain;object-position:left center}
  .pw-logo-frame,.pw-header [data-pw-logo-frame="1"]{padding:0;background:transparent;max-width:none;max-height:none;overflow:hidden}
  .pw-header-actions .pw-icon-btn:not([data-pw-chrome-float]){color:#fff;flex-shrink:0;width:32px;height:34px}
  .pw-cat-btn{
    width:34px;height:34px;padding:0;justify-content:center;
    border:1.5px solid rgba(255,255,255,.55);
    background:rgba(255,255,255,.16);color:#fff;flex-shrink:0;
  }
  .pw-cat-btn span{display:none}
  .pw-search-form{border:none;height:36px;background:#fff;box-shadow:0 2px 8px rgba(15,23,42,.10)}
  .pw-search-form input[type="search"]{padding:0 8px;font-size:13px;font-weight:500}
  .pw-search-image-btn{background:transparent;padding:0}
  .pw-search-submit{min-width:36px;padding:0 10px;font-size:0;letter-spacing:0}
  .pw-search-submit::before{content:"";display:block;width:16px;height:16px;background-color:currentColor;background-image:none;-webkit-mask:center/contain no-repeat url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='11' cy='11' r='7'/%3E%3Cpath d='m20 20-3.5-3.5'/%3E%3C/svg%3E");mask:center/contain no-repeat url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='11' cy='11' r='7'/%3E%3Cpath d='m20 20-3.5-3.5'/%3E%3C/svg%3E")}
  html:not([data-pw-edit-device]):not([data-pw-scene-lock]) .pw-hero{margin:12px 16px 0;border-radius:1.5rem;min-height:220px;overflow:hidden}
  html:not([data-pw-edit-device]):not([data-pw-scene-lock]) .pw-hero-inner{padding:28px 18px}
  html:not([data-pw-edit-device]):not([data-pw-scene-lock]) .pw-hero h1{font-size:1.45rem}
  html:not([data-pw-edit-device]):not([data-pw-scene-lock]) .pw-btn-hero{background:var(--pw-primary);color:#fff;border:2px solid #fff}
  .pw-band-orange{background:transparent}
  .pw-band-orange .pw-section-title-light{color:var(--pw-primary)}
  .pw-cat-grid{grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;overflow-x:auto}
  .pw-cat-media{border:none;border-radius:999px;aspect-ratio:1;max-width:72px;margin:0 auto}
  .pw-cat-label{font-size:11px}
  .pw-product-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:12px}
  .pw-footer-grid{grid-template-columns:1fr 1fr}
}
@media (max-width:1279px){
  .pw-product-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:12px}
  .pw-bottom-nav{position:fixed;left:0;right:0;bottom:0;z-index:${PW_SCENE_HEAD_Z};display:flex;flex-wrap:nowrap;justify-content:space-around;align-items:stretch;background:#fff;border-top:1px solid #e5e7eb;padding:6px 4px calc(6px + env(safe-area-inset-bottom))}
  .pw-bottom-nav a,.pw-bottom-nav .pw-icon-btn,.pw-bottom-nav .pw-shop-icon-btn{flex:1 1 0;min-width:0;min-height:0;width:auto;height:auto;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;text-decoration:none;font-size:var(--pw-chrome-label,13px);font-weight:600;color:#6b7280;padding:6px 2px;background:transparent;transform:none}
  .pw-bottom-nav a.is-active,.pw-bottom-nav a:first-child{color:var(--pw-primary)}
  .pw-bottom-nav svg{width:20px;height:20px;max-width:20px;max-height:20px;stroke:currentColor;fill:none;stroke-width:2}
  .pw-bottom-nav .pw-chrome-icon-wrap{position:relative;display:inline-flex;flex-direction:row;align-items:center;justify-content:center;width:22px;height:22px;overflow:visible}
  .pw-bottom-nav .pw-shop-icon-label,.pw-bottom-nav .pw-chrome-btn-label,.pw-bottom-nav .pw-shop-nav-label,.pw-bottom-nav>a>span:not(.pw-chrome-icon-wrap):not(.pw-cart-badge):not(.pw-shop-cart-badge){display:block;max-width:100%;white-space:normal;overflow:visible;text-overflow:unset;color:inherit;text-align:center;line-height:1.15;overflow-wrap:break-word;word-break:break-word}
  .pw-bottom-nav .pw-chrome-icon-wrap .pw-cart-badge,.pw-bottom-nav .pw-chrome-icon-wrap .pw-shop-cart-badge{position:absolute;top:-5px;right:-9px;left:auto;bottom:auto;z-index:2}
}
@media (max-width:520px){
  .pw-footer-grid{grid-template-columns:1fr}
}
.pw-skip{position:absolute;left:-999px;top:8px;z-index:1000;padding:8px 12px;background:var(--pw-primary);color:#fff;border-radius:8px}
.pw-skip:focus{left:12px}
html[data-pw-edit-device="desktop"] .pw-header-main,html[data-pw-scene-lock="desktop"] .pw-header-main{gap:8px;padding:8px var(--pw-chrome-inset,60px)}
html[data-pw-edit-device="laptop"] .pw-header-main,html[data-pw-scene-lock="laptop"] .pw-header-main{gap:8px;padding:8px var(--pw-chrome-inset,60px)}
html[data-pw-edit-device="desktop"] .pw-hero,html[data-pw-scene-lock="desktop"] .pw-hero,html[data-pw-edit-device="laptop"] .pw-hero,html[data-pw-scene-lock="laptop"] .pw-hero{margin:0;border-radius:0;min-height:360px}
html[data-pw-edit-device="desktop"] .pw-hero-inner,html[data-pw-scene-lock="desktop"] .pw-hero-inner,html[data-pw-edit-device="laptop"] .pw-hero-inner,html[data-pw-scene-lock="laptop"] .pw-hero-inner{padding:64px 20px}
html[data-pw-edit-device="desktop"] .pw-hero h1,html[data-pw-scene-lock="desktop"] .pw-hero h1{font-size:clamp(2rem,4.5vw,3.4rem)}
html[data-pw-edit-device="desktop"] .pw-btn-hero,html[data-pw-scene-lock="desktop"] .pw-btn-hero,html[data-pw-edit-device="laptop"] .pw-btn-hero,html[data-pw-scene-lock="laptop"] .pw-btn-hero{background:#fff;color:var(--pw-primary);border:none}
html[data-pw-edit-device="mobile"] .pw-hero,html[data-pw-scene-lock="mobile"] .pw-hero{margin:12px 16px 0;border-radius:1.5rem;min-height:220px}
html[data-pw-edit-device="tablet"] .pw-hero,html[data-pw-scene-lock="tablet"] .pw-hero{margin:16px 20px 0;border-radius:1.25rem;min-height:280px}
html[data-pw-edit-device="mobile"] .pw-hero-inner,html[data-pw-scene-lock="mobile"] .pw-hero-inner{padding:28px 18px}
html[data-pw-edit-device="mobile"] .pw-hero h1,html[data-pw-scene-lock="mobile"] .pw-hero h1{font-size:1.45rem}
html[data-pw-edit-device="mobile"] .pw-btn-hero,html[data-pw-scene-lock="mobile"] .pw-btn-hero{background:var(--pw-primary);color:#fff;border:2px solid #fff}
html[data-pw-edit-device="desktop"] .pw-product-grid,html[data-pw-scene-lock="desktop"] .pw-product-grid{grid-template-columns:repeat(5,minmax(0,1fr))!important;gap:18px}
html[data-pw-edit-device="laptop"] .pw-product-grid,html[data-pw-scene-lock="laptop"] .pw-product-grid{grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:16px}
html[data-pw-edit-device="tablet"] .pw-product-grid,html[data-pw-scene-lock="tablet"] .pw-product-grid,html[data-pw-edit-device="mobile"] .pw-product-grid,html[data-pw-scene-lock="mobile"] .pw-product-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:12px}
html[data-pw-edit-device="desktop"] .pw-cat-grid,html[data-pw-scene-lock="desktop"] .pw-cat-grid,html[data-pw-edit-device="laptop"] .pw-cat-grid,html[data-pw-scene-lock="laptop"] .pw-cat-grid{grid-template-columns:repeat(4,minmax(0,1fr));gap:16px}
html[data-pw-edit-device="mobile"] .pw-cat-media,html[data-pw-scene-lock="mobile"] .pw-cat-media{border:none;border-radius:999px;max-width:72px;margin:0 auto}
html[data-pw-edit-device="desktop"] .pw-cat-media,html[data-pw-scene-lock="desktop"] .pw-cat-media,html[data-pw-edit-device="laptop"] .pw-cat-media,html[data-pw-scene-lock="laptop"] .pw-cat-media{border:2px solid var(--pw-primary);border-radius:8px;max-width:none}
html[data-pw-edit-device="desktop"] .pw-footer-grid,html[data-pw-scene-lock="desktop"] .pw-footer-grid,html[data-pw-edit-device="laptop"] .pw-footer-grid,html[data-pw-scene-lock="laptop"] .pw-footer-grid{grid-template-columns:repeat(4,minmax(0,1fr))}
html[data-pw-edit-device="tablet"] .pw-footer-grid,html[data-pw-scene-lock="tablet"] .pw-footer-grid{grid-template-columns:1fr 1fr}
html[data-pw-edit-device="mobile"] .pw-footer-grid,html[data-pw-scene-lock="mobile"] .pw-footer-grid{grid-template-columns:1fr}
html[data-pw-edit-device="desktop"] .pw-nav-main,html[data-pw-scene-lock="desktop"] .pw-nav-main,html[data-pw-edit-device="laptop"] .pw-nav-main,html[data-pw-scene-lock="laptop"] .pw-nav-main{display:flex}
html[data-pw-edit-device="mobile"] .pw-nav-main,html[data-pw-scene-lock="mobile"] .pw-nav-main,html[data-pw-edit-device="tablet"] .pw-nav-main,html[data-pw-scene-lock="tablet"] .pw-nav-main{display:none}
html[data-pw-edit-device="desktop"] .pw-topbar,html[data-pw-scene-lock="desktop"] .pw-topbar,html[data-pw-edit-device="laptop"] .pw-topbar,html[data-pw-scene-lock="laptop"] .pw-topbar{display:block}
html[data-pw-edit-device="mobile"] .pw-topbar,html[data-pw-scene-lock="mobile"] .pw-topbar,html[data-pw-edit-device="tablet"] .pw-topbar,html[data-pw-scene-lock="tablet"] .pw-topbar{display:none}
html[data-pw-edit-device="desktop"] .pw-header,html[data-pw-scene-lock="desktop"] .pw-header,html[data-pw-edit-device="laptop"] .pw-header,html[data-pw-scene-lock="laptop"] .pw-header{background:#fff;border-bottom:1px solid #f3f4f6;box-shadow:none}
html[data-pw-edit-device="desktop"] .pw-wordmark,html[data-pw-scene-lock="desktop"] .pw-wordmark,html[data-pw-edit-device="laptop"] .pw-wordmark,html[data-pw-scene-lock="laptop"] .pw-wordmark{color:var(--pw-primary);text-shadow:none}
html[data-pw-edit-device="mobile"] .pw-header,html[data-pw-scene-lock="mobile"] .pw-header,html[data-pw-edit-device="tablet"] .pw-header,html[data-pw-scene-lock="tablet"] .pw-header{background:var(--pw-primary);border:none;box-shadow:0 6px 18px color-mix(in srgb, var(--pw-primary) 35%, transparent)}
html[data-pw-edit-device="mobile"] .pw-wordmark,html[data-pw-scene-lock="mobile"] .pw-wordmark,html[data-pw-edit-device="tablet"] .pw-wordmark,html[data-pw-scene-lock="tablet"] .pw-wordmark{color:#fff}
html[data-pw-edit-device="desktop"] .pw-bottom-nav,html[data-pw-scene-lock="desktop"] .pw-bottom-nav,html[data-pw-edit-device="laptop"] .pw-bottom-nav,html[data-pw-scene-lock="laptop"] .pw-bottom-nav{display:none}
html[data-pw-edit-device="desktop"] body,html[data-pw-scene-lock="desktop"] body,html[data-pw-edit-device="laptop"] body,html[data-pw-scene-lock="laptop"] body{padding-bottom:0}
html[data-pw-edit-device="mobile"] .pw-bottom-nav,html[data-pw-scene-lock="mobile"] .pw-bottom-nav,html[data-pw-edit-device="tablet"] .pw-bottom-nav,html[data-pw-scene-lock="tablet"] .pw-bottom-nav{display:flex;position:fixed;left:0;right:0;bottom:0;z-index:${PW_SCENE_HEAD_Z};background:#fff}
html[data-pw-edit-device="mobile"] body,html[data-pw-scene-lock="mobile"] body,html[data-pw-edit-device="tablet"] body,html[data-pw-scene-lock="tablet"] body{padding-bottom:72px}
${PW_PRODUCT_GRID_RULER_CSS}`
}

export function renderTemplateSiteToHtml(input: PartnerWebsiteTemplateRenderInput): string {
  const home = input.pages.find((p) => p.slug === '/' || p.slug === 'index') ?? input.pages[0]
  const sections = home?.sections ?? []
  const body = sections.map((s) => renderSection(s, input)).join('\n')
  const logo = input.theme.logoUrl ?? input.logoUrl
  const siteSlug = input.siteSlug?.trim() ?? ''

  // Shared chrome on every generated page — only `body` (middle) differs.
  const chrome = buildPartnerSiteHeaderHtml({
    locale: input.locale,
    title: input.title,
    logoUrl: logo,
    chatIconLogoUrl: input.theme.chatIconLogoUrl,
    siteSlug: siteSlug || undefined,
    samplePreview: input.samplePreview,
    device: input.variant,
  })

  const personalizationScript = siteSlug
    ? buildPartnerSitePersonalizationBootstrapScript({ siteSlug, locale: input.locale })
    : ''

  const faviconLink = logo
    ? `<link rel="icon" href="${escapeAttr(logo)}"/>`
    : ''
  const hero = sections.find((s) => s.type === 'hero-v1')
  const seoDescription = str(hero?.props.subtitle, input.title)
  const skipLabel =
    input.locale === 'vi'
      ? 'Bỏ qua nội dung'
      : input.locale === 'zh'
        ? '跳到正文'
        : input.locale === 'ja'
          ? '本文へスキップ'
          : input.locale === 'ko'
            ? '본문으로 건너뛰기'
            : 'Skip to content'

  return `<!DOCTYPE html>
<html lang="${escapeAttr(input.locale)}">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
${buildShopVisualSeoHead({
  title: input.title,
  description: seoDescription,
  locale: input.locale,
  imageUrl: logo || str(hero?.props.backgroundImage) || null,
})}
${faviconLink}
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="${FASHION_SHOP_GOOGLE_FONTS_HREF}" rel="stylesheet"/>
<style>${buildStyles(input.theme)}</style>
${buildShopVisualWebsiteJsonLd({
  brand: input.title,
  locale: input.locale,
  siteSlug: siteSlug || undefined,
  logoUrl: logo,
  description: seoDescription,
})}
</head>
<body id="top">
<a class="pw-skip" href="#products">${escapeHtml(skipLabel)}</a>
${chrome.header}
<main id="pw-main" class="pw-shop-main" data-pw-scene-root="1" data-pw-scene-origin="content">
${body}
</main>
${chrome.bottomNav}
${chrome.scripts}
${personalizationScript}
</body>
</html>`
}
