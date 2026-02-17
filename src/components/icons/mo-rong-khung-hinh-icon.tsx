'use client'

import Image from 'next/image'

/** URL icon tùy chỉnh (Supabase...) – nếu set thì dùng thay file local. Ảnh PNG nền trong suốt. */
const MO_RONG_KHUNG_HINH_ICON_SRC =
  'https://mxwfxudyeoqstgwmlupa.supabase.co/storage/v1/object/sign/anh%20icon/mo%20dong%20khunh%20hinh.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9kZTg0NGZlNC04YTNkLTRhYjQtOGJmNC05NzU1MmVhYzhhZmEiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJhbmggaWNvbi9tbyBkb25nIGtodW5oIGhpbmgucG5nIiwiaWF0IjoxNzcxMzQ1ODI1LCJleHAiOjQ5MjQ5NDU4MjV9.IhEHBFHYTwLjkJXZ53QASazUBCmoXhd4XQRPyrvjFW0'

/** Icon mở rộng khung hình – ảnh tùy chỉnh từ Supabase. */
export function MoRongKhungHinhIcon({ className }: { className?: string; strokeWidth?: number }) {
  return (
    <span className="flex w-full aspect-square items-center justify-center rounded-none sm:rounded-lg overflow-hidden">
      <Image
        src={MO_RONG_KHUNG_HINH_ICON_SRC}
        alt="Mở rộng khung hình"
        width={80}
        height={80}
        className="h-full w-full object-cover"
        unoptimized
      />
    </span>
  )
}