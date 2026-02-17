'use client'

import Image from 'next/image'

/** URL icon tùy chỉnh (Supabase...) – nếu set thì dùng thay file local. Ảnh PNG nền trong suốt. */
const TAO_BANNER_ICON_SRC =
  'https://mxwfxudyeoqstgwmlupa.supabase.co/storage/v1/object/sign/anh%20icon/tao%20banner.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9kZTg0NGZlNC04YTNkLTRhYjQtOGJmNC05NzU1MmVhYzhhZmEiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJhbmggaWNvbi90YW8gYmFubmVyLnBuZyIsImlhdCI6MTc3MTM0NzMxNywiZXhwIjo0OTI0OTQ3MzE3fQ.h2vqd4gw6P1qzZxU8jSBfuowNyOA_3uaDujz2Ke7M2I'

/** Icon tạo banner – ảnh tùy chỉnh từ Supabase. */
export function TaoBannerIcon({ className }: { className?: string; strokeWidth?: number }) {
  return (
    <span className="flex w-full aspect-square items-center justify-center rounded-none sm:rounded-lg overflow-hidden">
      <Image
        src={TAO_BANNER_ICON_SRC}
        alt="Tạo banner"
        width={80}
        height={80}
        className="h-full w-full object-cover"
        unoptimized
      />
    </span>
  )
}