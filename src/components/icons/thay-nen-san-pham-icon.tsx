'use client'

import Image from 'next/image'

/** URL icon tùy chỉnh (Supabase...) – nếu set thì dùng thay file local. Ảnh PNG nền trong suốt. */
const THAY_NEN_SAN_PHAM_ICON_SRC =
  'https://mxwfxudyeoqstgwmlupa.supabase.co/storage/v1/object/sign/anh%20icon/thay%20nen%20san%20pham.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9kZTg0NGZlNC04YTNkLTRhYjQtOGJmNC05NzU1MmVhYzhhZmEiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJhbmggaWNvbi90aGF5IG5lbiBzYW4gcGhhbS5wbmciLCJpYXQiOjE3NzEzNDQyMzIsImV4cCI6NDkyNDk0NDIzMn0.BYNFCURjN3krLF7mv8cWrQwO6eqYArx0zigkMos8sl0'

/** Icon thay nền sản phẩm – ảnh tùy chỉnh từ Supabase. */
export function ThayNenSanPhamIcon({ className }: { className?: string; strokeWidth?: number }) {
  return (
    <span className="flex w-full aspect-square items-center justify-center rounded-none sm:rounded-lg overflow-hidden">
      <Image
        src={THAY_NEN_SAN_PHAM_ICON_SRC}
        alt="Thay nền sản phẩm"
        width={80}
        height={80}
        className="h-full w-full object-cover"
        unoptimized
      />
    </span>
  )
}