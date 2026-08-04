/**
 * Fashion shop v2 design tokens — distinctive type + orange retail atmosphere.
 * Used by React home and HTML template preview for visual parity.
 */
export const FASHION_SHOP_FONT_DISPLAY = '"Fraunces", "Times New Roman", serif'
export const FASHION_SHOP_FONT_UI = '"Outfit", "Segoe UI", system-ui, sans-serif'

export const FASHION_SHOP_GOOGLE_FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,700;9..144,800&family=Outfit:wght@400;500;600;700;800&subset=latin,latin-ext&display=swap'

export function buildFashionShopMotionCss(): string {
  return `
@keyframes pwFadeUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}
@keyframes pwSoftPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.03)}}
@keyframes pwShimmer{0%{background-position:0% 50%}100%{background-position:100% 50%}}
@keyframes pwFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
.pw-anim-in{animation:pwFadeUp .7s cubic-bezier(.22,1,.36,1) both}
.pw-anim-in-d1{animation-delay:.08s}
.pw-anim-in-d2{animation-delay:.16s}
.pw-anim-in-d3{animation-delay:.24s}
.pw-anim-in-d4{animation-delay:.32s}
@media (prefers-reduced-motion:reduce){
  .pw-anim-in,.pw-anim-in-d1,.pw-anim-in-d2,.pw-anim-in-d3,.pw-anim-in-d4{animation:none}
}
`
}
