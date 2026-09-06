export type RemoveBgMaskVariant = 'product' | 'logo'

/** Cùng giá với `/xoa-nen-png` — Gemini 3 Pro Image tạo mask 2K. */
export const REMOVE_BG_PNG_CREDIT = 1.5

/** Cùng prompt với `/xoa-nen-png` — giữ chủ thể; không khoét nền trong khối logo trên ảnh sản phẩm. */
export const PRODUCT_REMOVE_BG_MASK_PROMPT = `Create a precise segmentation mask for this image.
Return ONLY one grayscale mask image:
- White = KEEP: main subject, product, people, text, important content, textured/gradient areas.
- Black = REMOVE: only unimportant solid/flat color elements – plain backgrounds, decorative borders, flat color blocks, empty areas. Do NOT remove product, text, or main subject.
- Brand logos: do NOT remove background from logo areas. Keep logo + its background block together as one unit (no transparency around logos).
- Preserve fine details (hair, fur, edges) with smooth anti-aliased boundaries.
- No color, no text, no extra graphics in the mask output.`

/** Sau khi AI tạo logo: chỉ giữ mark, xóa canvas/nền bên ngoài thành alpha. */
export const LOGO_REMOVE_BG_MASK_PROMPT = `Create a precise segmentation mask for this brand logo image.
Return ONLY one grayscale mask image:
- White = KEEP: the logo mark only (icon, wordmark, letters, graphic shapes, inner holes of letters like O/A/B stay black where the canvas shows through).
- Black = REMOVE: everything outside the logo — solid canvas fill, colored rectangle/card behind the mark, decorative borders, mockup scenes, empty margins.
- Cut tightly around the logo silhouette. Do NOT keep a colored plate, circle badge, or background block behind the logo.
- Preserve fine details (thin strokes, serifs, inner counters of letters) with smooth anti-aliased boundaries.
- No color, no text, no extra graphics in the mask output.`

export function removeBgMaskPrompt(variant: RemoveBgMaskVariant): string {
  return variant === 'logo' ? LOGO_REMOVE_BG_MASK_PROMPT : PRODUCT_REMOVE_BG_MASK_PROMPT
}

export function requiredCreditsForLogoCreate(logoCost: number): number {
  return logoCost + REMOVE_BG_PNG_CREDIT
}

export function chargedCreditsForLogoCreate(logoCost: number, removedBg: boolean): number {
  return removedBg ? logoCost + REMOVE_BG_PNG_CREDIT : logoCost
}
