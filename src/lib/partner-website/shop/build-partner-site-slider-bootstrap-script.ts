import { PW_SLIDER_ENGINE_JS } from '@/lib/partner-website/visual-editor/pw-slider-runtime'

/** Live shop: lướt ngang theo `data-pw-slide-wait` + mũi tên. Strip khi Lưu Sửa nhanh. */
export function buildPartnerSiteSliderBootstrapScript(): string {
  return `<script data-pw-slider-bootstrap>(function(){
${PW_SLIDER_ENGINE_JS}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', pwSliderBoot);
else pwSliderBoot();
})()</script>`
}
