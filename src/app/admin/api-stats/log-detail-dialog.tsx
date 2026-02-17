'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'

export interface LogWithCost {
  id: string
  model: string
  feature: string
  prompt_token_count: number | null
  candidates_token_count: number | null
  total_token_count: number | null
  image_size?: string | null
  created_at: string
  costVnd: number
}

const formatNum = (n: number) => n.toLocaleString('vi-VN')
const formatVnd = (n: number) => `${n.toLocaleString('vi-VN')}₫`

interface LogDetailDialogProps {
  log: LogWithCost | null
  open: boolean
  onOpenChange: (open: boolean) => void
  featureLabels: Record<string, string>
}

export function LogDetailDialog({
  log,
  open,
  onOpenChange,
  featureLabels,
}: LogDetailDialogProps) {
  if (!log) return null

  const imgSize = (log as { image_size?: string | null }).image_size
  const featureLabel = featureLabels[log.feature] || log.feature

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Chi tiết lượt gọi API</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <div>
            <p className="text-muted-foreground text-xs mb-1">Thời gian</p>
            <p className="font-medium">{new Date(log.created_at).toLocaleString('vi-VN')}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs mb-1">Model</p>
            <Badge variant="outline" className="font-mono text-xs">
              {log.model}
            </Badge>
          </div>
          <div>
            <p className="text-muted-foreground text-xs mb-1">Chức năng (dùng để làm gì)</p>
            <p className="font-medium">{featureLabel}</p>
            <p className="text-xs text-muted-foreground">{log.feature}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs mb-1">Độ phân giải ảnh trả về</p>
            {imgSize ? (
              <Badge variant="outline" className={imgSize === '2K' ? 'text-sky-600 border-sky-300' : 'text-amber-600 border-amber-300'}>
                {imgSize}
              </Badge>
            ) : (
              <span className="text-muted-foreground">Không trả ảnh (chỉ text)</span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-muted-foreground text-xs mb-1">Input tokens</p>
              <p className="font-mono font-medium">{formatNum(log.prompt_token_count || 0)}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs mb-1">Output tokens</p>
              <p className="font-mono font-medium">{formatNum(log.candidates_token_count || 0)}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs mb-1">Tổng tokens</p>
              <p className="font-mono font-medium">{formatNum(log.total_token_count || 0)}</p>
            </div>
          </div>
          <div className="pt-3 border-t">
            <p className="text-muted-foreground text-xs mb-1">Tổng chi phí lượt này</p>
            <p className="text-xl font-bold text-amber-700">{formatVnd(log.costVnd)}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
