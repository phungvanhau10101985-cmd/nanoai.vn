import type { WebLocale } from '@/lib/i18n/config'
import { partnerSiteProductsPath } from '@/lib/partner-website/shop/partner-site-shop-paths'
import {
  PW_SLIDER_ARROW_NEXT_HTML,
  PW_SLIDER_ARROW_PREV_HTML,
  PW_SLIDER_SLIDE_MAX,
  PW_SLIDER_WAIT_DEFAULT,
} from '@/lib/partner-website/visual-editor/pw-slider-runtime'
import { PW_KIND_SCENE_MEDIA, pwKindSceneAttr } from '@/lib/partner-website/visual-editor/pw-kind-scene'
import {
  PW_EDIT_SLOT,
  PW_EL,
  PW_REGION,
  pwElAttr,
  pwRegionAttr,
} from '@/lib/partner-website/visual-editor/pw-ui-contract'

export const VISUAL_EDITOR_BANNER_KINDS = ['hero', 'slider', 'birthday', 'sale-calendar'] as const

export type VisualEditorBannerKind = (typeof VISUAL_EDITOR_BANNER_KINDS)[number]

export const VISUAL_EDITOR_PICKER_LIVE_BANNER_KINDS = ['birthday', 'sale-calendar'] as const

export function isVisualEditorBannerKind(value: string): value is VisualEditorBannerKind {
  return (VISUAL_EDITOR_BANNER_KINDS as readonly string[]).includes(value)
}

export function personalizeBannerKindOf(
  kind: VisualEditorBannerKind
): 'birthday' | 'sale-calendar' | null {
  if (kind === 'birthday' || kind === 'sale-calendar') return kind
  return null
}

const COPY: Record<
  VisualEditorBannerKind,
  Record<WebLocale, { badge: string; title: string; subtitle: string; cta: string; ctaSecondary: string }>
> = {
  hero: {
    vi: {
      badge: 'Mới',
      title: 'Bộ sưu tập mới',
      subtitle: 'Khám phá hàng mới về',
      cta: 'Mua ngay',
      ctaSecondary: 'Xem thêm',
    },
    en: {
      badge: 'New',
      title: 'New collection',
      subtitle: 'Discover the latest arrivals',
      cta: 'Shop now',
      ctaSecondary: 'See more',
    },
    zh: {
      badge: '新品',
      title: '全新系列',
      subtitle: '探索最新到货',
      cta: '立即购买',
      ctaSecondary: '查看更多',
    },
    ja: {
      badge: '新着',
      title: '新作コレクション',
      subtitle: '最新アイテムを見る',
      cta: '今すぐ買う',
      ctaSecondary: 'もっと見る',
    },
    ko: {
      badge: '신상',
      title: '신규 컬렉션',
      subtitle: '새로 들어온 상품을 만나보세요',
      cta: '바로 구매',
      ctaSecondary: '더 보기',
    },
  },
  slider: {
    vi: {
      badge: 'Mới',
      title: 'Bộ sưu tập mới',
      subtitle: 'Khám phá hàng mới về',
      cta: 'Mua ngay',
      ctaSecondary: 'Xem thêm',
    },
    en: {
      badge: 'New',
      title: 'New collection',
      subtitle: 'Discover the latest arrivals',
      cta: 'Shop now',
      ctaSecondary: 'See more',
    },
    zh: {
      badge: '新品',
      title: '全新系列',
      subtitle: '探索最新到货',
      cta: '立即购买',
      ctaSecondary: '查看更多',
    },
    ja: {
      badge: '新着',
      title: '新作コレクション',
      subtitle: '最新アイテムを見る',
      cta: '今すぐ買う',
      ctaSecondary: 'もっと見る',
    },
    ko: {
      badge: '신상',
      title: '신규 컬렉션',
      subtitle: '새로 들어온 상품을 만나보세요',
      cta: '바로 구매',
      ctaSecondary: '더 보기',
    },
  },
  birthday: {
    vi: {
      badge: 'Sinh nhật',
      title: 'Chúc mừng sinh nhật',
      subtitle: 'Quà giảm giá dành riêng cho bạn',
      cta: 'Nhận quà',
      ctaSecondary: 'Xem thêm',
    },
    en: {
      badge: 'Birthday',
      title: 'Happy birthday',
      subtitle: 'A discount gift just for you',
      cta: 'Claim gift',
      ctaSecondary: 'See more',
    },
    zh: {
      badge: '生日',
      title: '生日快乐',
      subtitle: '专属折扣礼物',
      cta: '领取礼物',
      ctaSecondary: '查看更多',
    },
    ja: {
      badge: '誕生日',
      title: 'お誕生日おめでとうございます',
      subtitle: 'あなただけの割引ギフト',
      cta: 'ギフトを受け取る',
      ctaSecondary: 'もっと見る',
    },
    ko: {
      badge: '생일',
      title: '생일을 축하합니다',
      subtitle: '회원님만을 위한 할인 선물',
      cta: '선물 받기',
      ctaSecondary: '더 보기',
    },
  },
  'sale-calendar': {
    vi: {
      badge: 'Sale',
      title: 'Sale cùng ngày cùng tháng',
      subtitle: 'Ưu đãi đúng hẹn ngày trùng tháng',
      cta: 'Săn deal',
      ctaSecondary: 'Xem thêm',
    },
    en: {
      badge: 'Sale',
      title: 'Same-day same-month sale',
      subtitle: 'On-time discount when day matches month',
      cta: 'Shop the sale',
      ctaSecondary: 'See more',
    },
    zh: {
      badge: '促销',
      title: '同日同月促销',
      subtitle: '日期与月份相同即享优惠',
      cta: '马上抢',
      ctaSecondary: '查看更多',
    },
    ja: {
      badge: 'セール',
      title: '同日同月セール',
      subtitle: '日と月が同じ日だけお得',
      cta: 'セールを見る',
      ctaSecondary: 'もっと見る',
    },
    ko: {
      badge: '세일',
      title: '같은 날짜·월 세일',
      subtitle: '일과 월이 같은 날만 할인',
      cta: '세일 보기',
      ctaSecondary: '더 보기',
    },
  },
}

const LABEL: Record<VisualEditorBannerKind, Record<WebLocale, string>> = {
  hero: {
    vi: 'Banner',
    en: 'Banner',
    zh: '横幅',
    ja: 'バナー',
    ko: '배너',
  },
  slider: {
    vi: 'Banner ngang',
    en: 'Horizontal banner',
    zh: '横向横幅',
    ja: '横スライド',
    ko: '가로 배너',
  },
  birthday: {
    vi: 'Banner chúc mừng SN',
    en: 'Birthday greeting banner',
    zh: '生日祝福横幅',
    ja: '誕生日バナー',
    ko: '생일 배너',
  },
  'sale-calendar': {
    vi: 'Banner sale cùng ngày cùng tháng',
    en: 'Same-day same-month sale banner',
    zh: '同日同月促销横幅',
    ja: '同日同月セールバナー',
    ko: '같은 날짜·월 세일 배너',
  },
}

/** Transparent hit-target so theme `--pw-primary` / `--pw-accent` show until merchant uploads a photo. */
export const BANNER_PLACEHOLDER_SRC =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="720" viewBox="0 0 1600 720"></svg>'
  )

export function bannerWidgetLabel(kind: VisualEditorBannerKind, locale: WebLocale): string {
  return LABEL[kind][locale] || LABEL.hero.vi
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function editAttr(slot: string): string {
  return `data-pw-edit="${slot}"`
}

const SLIDE_ARROW_PREV = PW_SLIDER_ARROW_PREV_HTML
const SLIDE_ARROW_NEXT = PW_SLIDER_ARROW_NEXT_HTML

function buildSliderSlidesHtml(count: number): string {
  const n = Math.min(PW_SLIDER_SLIDE_MAX, Math.max(2, count))
  const slides: string[] = []
  const dots: string[] = []
  for (let i = 0; i < n; i++) {
    const active = i === 0 ? ' data-pw-slide-active="1"' : ''
    slides.push(
      `<div data-pw-slide="${i}"${active}><img class="pw-hero-media" ${pwElAttr(PW_EL.media)} ${editAttr(PW_EDIT_SLOT.heroImage)} data-pw-banner-placeholder="1" alt="" width="1600" height="720" src="${BANNER_PLACEHOLDER_SRC}"/></div>`
    )
    dots.push(
      `<button type="button" data-pw-slide-to="${i}"${i === 0 ? ' class="is-active"' : ''}></button>`
    )
  }
  return `<div data-pw-slides>${slides.join('')}</div>
  ${SLIDE_ARROW_PREV}
  ${SLIDE_ARROW_NEXT}
  <div class="pw-slide-dots" ${pwElAttr(PW_EL.dots)} aria-hidden="true">${dots.join('')}</div>`
}

function bannerCopyHtml(
  copy: { badge: string; title: string; subtitle: string; cta: string; ctaSecondary: string },
  productsHref: string,
  withHeroDots: boolean
): string {
  const dots = withHeroDots
    ? `<div class="pw-hero-dots" ${pwElAttr(PW_EL.dots)} aria-hidden="true" style="display:flex;gap:6px;margin-top:18px">
        <span class="is-active" style="width:8px;height:8px;border-radius:50%;background:#fff"></span>
        <span style="width:8px;height:8px;border-radius:50%;background:rgba(255,255,255,.45)"></span>
        <span style="width:8px;height:8px;border-radius:50%;background:rgba(255,255,255,.45)"></span>
      </div>`
    : ''
  return `<div class="pw-hero-inner pw-container" ${pwElAttr(PW_EL.inner)} style="position:relative;z-index:2;width:100%;padding:64px 20px;box-sizing:border-box">
    <div class="pw-hero-copy" ${pwElAttr(PW_EL.copy)} data-pw-banner-copy="1" style="max-width:560px">
      <span class="pw-hero-badge" ${pwElAttr(PW_EL.badge)} ${editAttr(PW_EDIT_SLOT.heroBadge)} style="display:inline-block;margin-bottom:10px;padding:4px 10px;border-radius:999px;background:var(--pw-accent);color:#fff;font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase">${escapeHtml(copy.badge)}</span>
      <h1 ${pwElAttr(PW_EL.title)} ${editAttr(PW_EDIT_SLOT.heroTitle)} style="margin:0 0 12px;font-size:clamp(2rem,4.5vw,3.2rem);line-height:1.08;font-weight:800">${escapeHtml(copy.title)}</h1>
      <p class="pw-hero-sub" ${pwElAttr(PW_EL.subtitle)} ${editAttr(PW_EDIT_SLOT.heroSubtitle)} style="margin:0 0 20px;font-size:1rem;color:rgba(255,255,255,.92)">${escapeHtml(copy.subtitle)}</p>
      <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center">
        <a class="pw-btn pw-btn-hero" ${pwElAttr(PW_EL.cta)} ${editAttr(PW_EDIT_SLOT.heroCta)} data-pw-token="buy" href="${productsHref}" style="background:var(--pw-buy,var(--pw-primary));color:#fff">${escapeHtml(copy.cta)}</a>
        <a class="pw-btn" ${pwElAttr(PW_EL.ctaSecondary)} data-pw-token="primary" href="${productsHref}" style="background:transparent;color:#fff;border:1px solid rgba(255,255,255,.75)">${escapeHtml(copy.ctaSecondary)}</a>
      </div>
      ${dots}
    </div>
  </div>`
}

/** Lưu Sửa nhanh: trả ảnh/chữ mẫu, bỏ ảnh AI vừa hydrate. */
export function restoreMarketingBannerSeedsInDocument(root: ParentNode): void {
  root.querySelectorAll('[data-pw-personalize-banner]').forEach((section) => {
    const src = section.getAttribute('data-pw-seed-src')
    const title = section.getAttribute('data-pw-seed-title')
    const subtitle = section.getAttribute('data-pw-seed-subtitle')
    const img = section.querySelector('img[data-pw-el="media"]')
    if (src != null && img) {
      if (src) img.setAttribute('src', src)
      else img.removeAttribute('src')
    }
    const titleEl = section.querySelector('[data-pw-el="title"]')
    if (title != null && titleEl) titleEl.textContent = title
    const subEl = section.querySelector('[data-pw-el="subtitle"]')
    if (subtitle != null && subEl) subEl.textContent = subtitle
    section.removeAttribute('data-pw-banner-live')
    section.removeAttribute('data-pw-seed-src')
    section.removeAttribute('data-pw-seed-title')
    section.removeAttribute('data-pw-seed-subtitle')
    section.querySelectorAll('[data-pw-banner-greeting]').forEach((el) => el.remove())
    const sibling = section.nextElementSibling
    if (sibling?.getAttribute('data-pw-banner-greeting') === '1') sibling.remove()
  })
}

/** In-flow banner section for Sửa nhanh «Thêm». Packaged: media + copy + CTAs + dots. */
export function buildVisualEditorBannerHtml(input: {
  kind?: VisualEditorBannerKind
  siteSlug: string
  locale?: WebLocale
}): string {
  const locale = input.locale && input.locale in COPY.hero ? input.locale : 'vi'
  const kind: VisualEditorBannerKind = input.kind && isVisualEditorBannerKind(input.kind) ? input.kind : 'hero'
  const copy = COPY[kind][locale]
  const productsHref = escapeHtml(partnerSiteProductsPath(input.siteSlug))
  const overlay =
    '<div aria-hidden="true" style="position:absolute;inset:0;background:linear-gradient(90deg,color-mix(in srgb,var(--pw-text,#111) 35%,transparent),transparent);pointer-events:none;z-index:1"></div>'

  if (kind === 'slider') {
    return `<section class="pw-hero pw-banner" ${pwRegionAttr(PW_REGION.banner)}${pwKindSceneAttr(PW_KIND_SCENE_MEDIA)} data-pw-bg-role="banner" data-pw-added-banner="1" data-pw-banner-kind="slider" data-pw-slider="1" data-pw-slide-wait="${PW_SLIDER_WAIT_DEFAULT}" data-pw-slide-arrows="1" data-pw-slide-index="0" data-pw-image-radius="0" style="position:relative;min-height:360px;overflow:hidden;display:flex;align-items:center;background:linear-gradient(135deg,var(--pw-primary),var(--pw-accent));color:#fff;border-radius:0">
  ${buildSliderSlidesHtml(3)}
  ${overlay}
  ${bannerCopyHtml(copy, productsHref, false)}
</section>`
  }

  const liveKind = personalizeBannerKindOf(kind)
  if (liveKind) {
    return `<section class="pw-hero pw-banner" ${pwRegionAttr(PW_REGION.banner)}${pwKindSceneAttr(PW_KIND_SCENE_MEDIA)} data-pw-bg-role="banner" data-pw-added-banner="1" data-pw-banner-kind="${liveKind}" data-pw-personalize-banner="${liveKind}" data-pw-image-radius="0" style="position:relative;aspect-ratio:21/9;overflow:hidden;display:flex;align-items:center;background:linear-gradient(135deg,var(--pw-primary),var(--pw-accent));color:#fff;border-radius:0">
  <img class="pw-hero-media" ${pwElAttr(PW_EL.media)} ${editAttr(PW_EDIT_SLOT.heroImage)} data-pw-banner-placeholder="1" alt="" width="2100" height="900" src="${BANNER_PLACEHOLDER_SRC}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain"/>
  ${overlay}
  ${bannerCopyHtml(copy, productsHref, false)}
</section>`
  }

  return `<section class="pw-hero pw-banner" id="pw-banner-added" ${pwRegionAttr(PW_REGION.banner)}${pwKindSceneAttr(PW_KIND_SCENE_MEDIA)} data-pw-bg-role="banner" data-pw-added-banner="1" data-pw-banner-kind="${kind}" data-pw-image-radius="0" style="position:relative;min-height:360px;overflow:hidden;display:flex;align-items:center;background:linear-gradient(135deg,var(--pw-primary),var(--pw-accent));color:#fff;border-radius:0">
  <img class="pw-hero-media" ${pwElAttr(PW_EL.media)} ${editAttr(PW_EDIT_SLOT.heroImage)} data-pw-banner-placeholder="1" alt="" width="1600" height="720" src="${BANNER_PLACEHOLDER_SRC}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover"/>
  ${overlay}
  ${bannerCopyHtml(copy, productsHref, true)}
</section>`
}
