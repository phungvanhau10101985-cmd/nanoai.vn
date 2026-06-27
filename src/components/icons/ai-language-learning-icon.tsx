import Image from 'next/image'
import { rewriteLegacyBunnyCdnUrl } from '@/lib/bunny-cdn-url'

/** Ảnh sticker — icon «Học ngoại ngữ AI» (/hoc-tieng-anh-ai). */
const AI_LANGUAGE_LEARNING_ICON_SRC =
  'https://nanoai.b-cdn.net/results/ef34291c-0b83-49c1-b390-4ab50df32e9d/sticker_1776511328378.png'

export function AiLanguageLearningIcon({ className }: { className?: string }) {
  const iconSrc = rewriteLegacyBunnyCdnUrl(AI_LANGUAGE_LEARNING_ICON_SRC)
  return (
    <span className={`inline-flex shrink-0 ${className ?? ''}`} aria-hidden>
      <Image
        src={iconSrc}
        alt=""
        width={256}
        height={256}
        className="h-full w-full min-h-0 min-w-0 object-contain"
        sizes="(max-width: 640px) 80px, 112px"
      />
    </span>
  )
}
