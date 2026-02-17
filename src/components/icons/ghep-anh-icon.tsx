'use client'

import Image from 'next/image'

/** URL icon tùy chỉnh (Supabase...) – nếu set thì dùng thay file local. Ảnh PNG nền trong suốt. */
const GHEP_ANH_ICON_SRC =
  'https://mxwfxudyeoqstgwmlupa.supabase.co/storage/v1/object/sign/anh%20icon/Ghep%20anh%20online.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9kZTg0NGZlNC04YTNkLTRhYjQtOGJmNC05NzU1MmVhYzhhZmEiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJhbmggaWNvbi9HaGVwIGFuaCBvbmxpbmUucG5nIiwiaWF0IjoxNzcxMzQzODA1LCJleHAiOjQ5MjQ5NDM4MDV9.m4PEr-_OrFDVsjvEm0UX8BMseH0vCP7lYozG5pUo6Sk'

/** Icon ghép ảnh – ảnh tùy chỉnh từ Supabase. */
export function GhepAnhIcon({ className }: { className?: string; strokeWidth?: number }) {
  return (
    <span className="flex w-full aspect-square items-center justify-center rounded-none sm:rounded-lg overflow-hidden">
      <Image
        src={GHEP_ANH_ICON_SRC}
        alt="Ghép ảnh"
        width={80}
        height={80}
        className="h-full w-full object-cover"
        unoptimized
      />
    </span>
  )
}