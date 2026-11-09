'use client'

import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { goToPreviousPage } from '@/components/navigation/browser-back-control'

/** Quay lại trang trước trong lịch sử (không hardcode /dashboard). */
export function ApiKeysHubBackButton({ label }: { label: string }) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="gap-1.5"
      onClick={() => goToPreviousPage()}
    >
      <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
      {label}
    </Button>
  )
}
