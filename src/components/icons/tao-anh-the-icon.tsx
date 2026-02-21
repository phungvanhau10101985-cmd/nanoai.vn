import Image from 'next/image'

const TAO_ANH_THE_ICON_SRC = 'https://mxwfxudyeoqstgwmlupa.supabase.co/storage/v1/object/sign/anh%20icon/anh%20the.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9kZTg0NGZlNC04YTNkLTRhYjQtOGJmNC05NzU1MmVhYzhhZmEiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJhbmggaWNvbi9hbmggdGhlLnBuZyIsImlhdCI6MTc3MTY4NjkwNCwiZXhwIjo0OTI1Mjg2OTA0fQ.EXF5yU8hCwJVkpG5r_eJ8SMw789oBaPqlkQyTDbhdmM'

export function TaoAnhTheIcon({ className }: { className?: string; strokeWidth?: number }) {
  return (
    <span className="flex w-full aspect-square items-center justify-center rounded-none sm:rounded-lg overflow-hidden">
      <Image
        src={TAO_ANH_THE_ICON_SRC}
        alt="Tạo ảnh thẻ"
        width={80}
        height={80}
        className="h-full w-full object-cover"
        unoptimized
      />
    </span>
  )
}