'use client'

import { cn } from '@/lib/utils'

type WeddingAlbumThumbProps = {
  url: string
  alt: string
  /** cover: thumbnail trên thiệp; contain: lưới album đầy đủ */
  fit?: 'cover' | 'contain'
  className?: string
  imgClassName?: string
}

/** Khung ảnh album dọc 3:4 — phù hợp ảnh cưới chân dung, ưu tiên giữ phần trên (mặt). */
export function WeddingAlbumThumb({
  url,
  alt,
  fit = 'cover',
  className,
  imgClassName,
}: WeddingAlbumThumbProps) {
  return (
    <div className={cn('relative aspect-[3/4] overflow-hidden rounded-2xl bg-[#fffcf7]/35 shadow-sm ring-1 ring-white/30', className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- external wedding album URLs */}
      <img
        src={url}
        alt={alt}
        className={cn(
          'h-full w-full transition duration-300',
          fit === 'cover' ? 'object-cover object-top' : 'object-contain',
          imgClassName,
        )}
      />
    </div>
  )
}

type WeddingAlbumPreviewGridProps = {
  urls: string[]
  alt: string
  extraCount?: number
  className?: string
}

/** Lưới xem trước 1–2 ảnh trên thiệp. */
export function WeddingAlbumPreviewGrid({ urls, alt, extraCount = 0, className }: WeddingAlbumPreviewGridProps) {
  const previewUrls = urls.slice(0, 2)
  if (previewUrls.length === 0) return null

  return (
    <div
      className={cn(
        previewUrls.length === 1 ? 'mx-auto w-full max-w-[280px]' : 'grid w-full grid-cols-2 gap-2 sm:gap-3',
        className,
      )}
    >
      {previewUrls.map((url, index) => (
        <div key={url} className="relative">
          <WeddingAlbumThumb url={url} alt={alt} fit="cover" imgClassName="group-hover:scale-105" />
          {index === 1 && extraCount > 0 ? (
            <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/35 text-2xl font-bold text-white">
              +{extraCount}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  )
}

type WeddingAlbumGalleryGridProps = {
  urls: string[]
  alt: string
  onSelect: (index: number) => void
  className?: string
}

/** Lưới album đầy đủ — 2 cột mobile, 3 cột desktop, tỷ lệ 3:4. */
export function WeddingAlbumGalleryGrid({ urls, alt, onSelect, className }: WeddingAlbumGalleryGridProps) {
  return (
    <div className={cn('grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3', className)}>
      {urls.map((url, index) => (
        <button
          key={`${url}-${index}`}
          type="button"
          onClick={() => onSelect(index)}
          className="overflow-hidden rounded-2xl text-left transition hover:opacity-95"
        >
          <WeddingAlbumThumb url={url} alt={alt} fit="contain" imgClassName="hover:scale-[1.02]" />
        </button>
      ))}
    </div>
  )
}
