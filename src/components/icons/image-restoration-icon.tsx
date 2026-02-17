'use client'

import Image from 'next/image'

/** URL icon tùy chỉnh (Supabase...) – nếu set thì dùng thay file local. Ảnh PNG nền trong suốt. */
const IMAGE_RESTORATION_ICON_SRC =
  'https://mxwfxudyeoqstgwmlupa.supabase.co/storage/v1/object/sign/anh%20icon/phuc%20dung%20anh%20cu.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9kZTg0NGZlNC04YTNkLTRhYjQtOGJmNC05NzU1MmVhYzhhZmEiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJhbmggaWNvbi9waHVjIGR1bmcgYW5oIGN1LnBuZyIsImlhdCI6MTc3MTMzNzc0NywiZXhwIjo0OTI0OTM3NzQ3fQ.7VY0nAva5gLWMQ0Cnnos9pA_hjsAMGmzKI6kyEKIZ7Y'

/** Icon phục dựng ảnh – ảnh tùy chỉnh từ Supabase. */
export function ImageRestorationIcon({ className }: { className?: string; strokeWidth?: number }) {
  return (
    <span className="flex w-full aspect-square items-center justify-center rounded-none sm:rounded-lg overflow-hidden">
      <Image
        src={IMAGE_RESTORATION_ICON_SRC}
        alt="Phục dựng ảnh"
        width={80}
        height={80}
        className="h-full w-full object-cover"
        unoptimized
      />
    </span>
  )
}
