'use client'

import { cn } from '@/lib/utils'

/** Ô mẫu: thấy phần trên thiệp. Đưa chuột vào thì trượt chậm hết thiệp đã mở, rời chuột thì về đầu. */
export function WeddingSampleScrollPreview(props: { src: string; eager?: boolean; className?: string }) {
  return (
    <span className={cn('wedding-sample-scroll relative block aspect-[3/5] overflow-hidden bg-[#fffaf2] [container-type:size]', props.className)}>
      <style>{SCROLL_CSS}</style>
      <img
        src={props.src}
        alt=""
        loading={props.eager ? 'eager' : 'lazy'}
        decoding="async"
        className="absolute inset-x-0 top-0 block w-full max-w-none"
      />
    </span>
  )
}

const SCROLL_CSS = `
.wedding-sample-scroll img {
  transform: translate3d(0, 0, 0);
  transition: transform 0.45s ease-out;
}
.wedding-sample-scroll:hover img {
  transform: translate3d(0, calc(-100% + 100cqh), 0);
  transition: transform 42s linear;
}
@media (prefers-reduced-motion: reduce) {
  .wedding-sample-scroll img,
  .wedding-sample-scroll:hover img {
    transform: none;
    transition: none;
  }
}
`
