'use client'

import Image from 'next/image'

/** URL icon tùy chỉnh (Supabase...) – nếu set thì dùng thay file local. Ảnh PNG nền trong suốt. */
const HOAN_DOI_KHUON_MAT_ICON_SRC =
  'https://mxwfxudyeoqstgwmlupa.supabase.co/storage/v1/object/sign/anh%20icon/hoan%20doi%20khuon%20mat.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9kZTg0NGZlNC04YTNkLTRhYjQtOGJmNC05NzU1MmVhYzhhZmEiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJhbmggaWNvbi9ob2FuIGRvaSBraHVvbiBtYXQucG5nIiwiaWF0IjoxNzcxMzQ2MDYwLCJleHAiOjQ5MjQ5NDYwNjB9.kxaJ8dqK06z_xBV1xYLVfpjJhGUjjTUPnFotkA4-Nrk'

/** Icon hoán đổi khuôn mặt – ảnh tùy chỉnh từ Supabase. */
export function HoanDoiKhuonMatIcon({ className }: { className?: string; strokeWidth?: number }) {
  return (
    <span className="flex w-full aspect-square items-center justify-center rounded-none sm:rounded-lg overflow-hidden">
      <Image
        src={HOAN_DOI_KHUON_MAT_ICON_SRC}
        alt="Hoán đổi khuôn mặt"
        width={80}
        height={80}
        className="h-full w-full object-cover"
        unoptimized
      />
    </span>
  )
}