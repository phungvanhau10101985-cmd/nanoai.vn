/**
 * Typography cố định (không theo breakpoint cửa sổ) để GV và HS
 * cùng cỡ chữ, cùng số dòng, cùng số chữ mỗi dòng.
 */
export const SLIDE_SYNC_MARKDOWN_CLASS =
  'box-border w-full max-w-full min-w-0 text-left text-[18px] font-normal leading-[1.625] tracking-normal [font-kerning:none] [font-variant-ligatures:none] whitespace-pre-wrap break-words space-y-2 [&_p]:my-0 [&_p]:text-[18px] [&_p]:font-normal [&_p]:leading-[1.625] [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-2 [&_li]:text-[18px] [&_li]:leading-[1.625]'

export const POINTER_PROSE_ROOT_ATTR = 'data-pointer-prose-root'

/** Khung slide GV và HS dùng chung — chuột ảo lấy tỷ lệ trong khung này, không tính nút riêng của giáo viên. */
export const SLIDE_POINTER_CHAIN_CARD_CLASS = 'box-border rounded-xl border p-5'
export const SLIDE_POINTER_CHAIN_TITLE_CLASS = 'mb-3 box-border w-full max-w-full break-words text-[20px] font-bold leading-tight [font-kerning:none]'
export const SLIDE_POINTER_CHAIN_BLOCKS_CLASS = 'space-y-4'
export const SLIDE_POINTER_CHAIN_BLOCK_CLASS = 'border-t pt-4 first:border-t-0 first:pt-0'
export const SLIDE_POINTER_CHAIN_HEADER_CLASS = 'mb-2 text-xs font-bold leading-tight'

export const SLIDE_POINTER_SINGLE_TITLE_CLASS =
  'mb-4 w-full break-words text-xl font-bold leading-tight md:mb-6 md:text-2xl lg:text-3xl'
export const SLIDE_POINTER_SINGLE_BLOCKS_CLASS = 'space-y-4'
export const SLIDE_POINTER_SINGLE_BLOCK_CLASS = 'relative overflow-hidden rounded-lg border'
export const SLIDE_POINTER_SINGLE_HEADER_CLASS =
  'flex min-h-10 items-center gap-2 border-b px-4 py-2.5 text-xs font-bold leading-tight'
export const SLIDE_POINTER_SINGLE_BODY_CLASS = 'p-2.5'
