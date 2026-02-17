'use client'

import Image from 'next/image'

/** URL icon tùy chỉnh (Supabase...) – nếu set thì dùng thay file local. Ảnh PNG nền trong suốt. */
const LAM_NET_ANH_ICON_SRC =
  'https://mxwfxudyeoqstgwmlupa.supabase.co/storage/v1/object/sign/anh%20icon/lam%20net%20anh.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9kZTg0NGZlNC04YTNkLTRhYjQtOGJmNC05NzU1MmVhYzhhZmEiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJhbmggaWNvbi9sYW0gbmV0IGFuaC5wbmciLCJpYXQiOjE3NzEzMzgzOTEsImV4cCI6NDkyNDkzODM5MX0.rN059fnb2y9zJiiMlSChhMfKfM9BKiVvzet-E0xT5bY'

/** Icon làm nét ảnh – ảnh tùy chỉnh từ Supabase. */
export function LamNetAnhIcon({ className }: { className?: string; strokeWidth?: number }) {
  return (
    <span className="flex w-full aspect-square items-center justify-center rounded-none sm:rounded-lg overflow-hidden">
      <Image
        src={LAM_NET_ANH_ICON_SRC}
        alt="Làm nét ảnh"
        width={80}
        height={80}
        className="h-full w-full object-cover"
        unoptimized
      />
    </span>
  )
}
