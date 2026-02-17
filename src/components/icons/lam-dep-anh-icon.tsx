'use client'

import Image from 'next/image'

/** URL icon tùy chỉnh (Supabase...) – nếu set thì dùng thay file local. Ảnh PNG nền trong suốt. */
const LAM_DEP_ANH_ICON_SRC =
  'https://mxwfxudyeoqstgwmlupa.supabase.co/storage/v1/object/sign/anh%20icon/lam%20dep%20anh.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9kZTg0NGZlNC04YTNkLTRhYjQtOGJmNC05NzU1MmVhYzhhZmEiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJhbmggaWNvbi9sYW0gZGVwIGFuaC5wbmciLCJpYXQiOjE3NzEzMzk5MzAsImV4cCI6NDkyNDkzOTkzMH0.badr8x-N-mdZCSks-RbEdqLP6dbYuA41X5sq_UDRMXQ'

/** Icon làm đẹp ảnh – ảnh tùy chỉnh từ Supabase. */
export function LamDepAnhIcon({ className }: { className?: string; strokeWidth?: number }) {
  return (
    <span className="flex w-full aspect-square items-center justify-center rounded-none sm:rounded-lg overflow-hidden">
      <Image
        src={LAM_DEP_ANH_ICON_SRC}
        alt="Làm đẹp ảnh"
        width={80}
        height={80}
        className="h-full w-full object-cover"
        unoptimized
      />
    </span>
  )
}
