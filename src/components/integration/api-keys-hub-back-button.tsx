'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

/** Quay lại trang trước trong lịch sử (không hardcode /dashboard). */
export function ApiKeysHubBackButton({ label }: { label: string }) {
  const router = useRouter()
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="gap-1.5"
      onClick={() => router.back()}
    >
      <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
      {label}
    </Button>
  )
}
