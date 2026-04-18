import Image from 'next/image'

/** Icon «Ghi âm & báo cáo cuộc họp» — ảnh tĩnh trong /public/tool-icons. */
export function MeetingRecorderReportIcon({ className }: { className?: string }) {
  return (
    <span className={`inline-flex shrink-0 ${className ?? ''}`} aria-hidden>
      <Image
        src="/tool-icons/meeting-recorder-report.png"
        alt=""
        width={256}
        height={256}
        className="h-full w-full min-h-0 min-w-0 object-contain"
        sizes="(max-width: 640px) 80px, 112px"
      />
    </span>
  )
}
