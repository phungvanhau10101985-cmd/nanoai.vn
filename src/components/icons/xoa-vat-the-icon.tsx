'use client'

import Image from 'next/image'

/** URL icon tùy chỉnh (Supabase...) – nếu set thì dùng thay file local. Ảnh PNG nền trong suốt. */
const XOA_VAT_THE_ICON_SRC =
  'https://mxwfxudyeoqstgwmlupa.supabase.co/storage/v1/object/sign/anh%20icon/Xoa%20vat%20the%20la.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9kZTg0NGZlNC04YTNkLTRhYjQtOGJmNC05NzU1MmVhYzhhZmEiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJhbmggaWNvbi9Yb2EgdmF0IHRoZSBsYS5wbmciLCJpYXQiOjE3NzEzNDQwMzEsImV4cCI6NDkyNDk0NDAzMX0.iuM6c899lZGobmOvnhRPB_lN1mwEE1z_PZC9VHhVnhI'

/** Icon xóa vật thể – ảnh tùy chỉnh từ Supabase. */
export function XoaVatTheIcon({ className }: { className?: string; strokeWidth?: number }) {
  return (
    <span className="flex w-full aspect-square items-center justify-center rounded-none sm:rounded-lg overflow-hidden">
      <Image
        src={XOA_VAT_THE_ICON_SRC}
        alt="Xóa vật thể"
        width={80}
        height={80}
        className="h-full w-full object-cover"
        unoptimized
      />
    </span>
  )
}