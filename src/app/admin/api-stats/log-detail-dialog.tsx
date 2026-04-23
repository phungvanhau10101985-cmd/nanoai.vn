'use client'

import { readWebLocaleFromDocumentCookie } from '@/lib/i18n/read-web-locale-cookie'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { useEffect, useState } from 'react'

export interface LogWithCost {
  id: string
  user_id: string | null
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
  const [uiLocale, setUiLocale] = useState<'vi' | 'en' | 'zh' | 'ja' | 'ko'>('vi')
  const tr = (vi: string, en: string, zh: string, ja: string, ko: string) => {
    if (uiLocale === 'en') return en
    if (uiLocale === 'zh') return zh
    if (uiLocale === 'ja') return ja
    if (uiLocale === 'ko') return ko
    return vi
  }
  useEffect(() => {
    const syncLocale = () => {
      const cookieValue = readWebLocaleFromDocumentCookie()
      if (cookieValue === 'en' || cookieValue === 'zh' || cookieValue === 'ja' || cookieValue === 'ko') setUiLocale(cookieValue)
      else setUiLocale('vi')
    }
    syncLocale()
    const timer = window.setInterval(syncLocale, 1000)
    window.addEventListener('focus', syncLocale)
    document.addEventListener('visibilitychange', syncLocale)
    return () => {
      window.removeEventListener('focus', syncLocale)
      document.removeEventListener('visibilitychange', syncLocale)
      window.clearInterval(timer)
    }
  }, [])
  if (!log) return null

  const imgSize = (log as { image_size?: string | null }).image_size
  const featureLabel = featureLabels[log.feature] || log.feature

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{tr('Chi tiết lượt gọi API', 'API call details', 'API 调用详情', 'API呼び出し詳細', 'API 호출 상세')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <div>
            <p className="text-muted-foreground text-xs mb-1">{tr('Thời gian', 'Time', '时间', '時間', '시간')}</p>
            <p className="font-medium">{new Date(log.created_at).toLocaleString('vi-VN')}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs mb-1">Model</p>
            <Badge variant="outline" className="font-mono text-xs">
              {log.model}
            </Badge>
          </div>
          <div>
            <p className="text-muted-foreground text-xs mb-1">{tr('User ID', 'User ID', '用户 ID', 'ユーザー ID', '사용자 ID')}</p>
            <p className="font-mono text-xs break-all">
              {log.user_id || tr('Ẩn danh / không xác định', 'Anonymous / unknown', '匿名 / 未知', '匿名 / 不明', '익명 / 알 수 없음')}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs mb-1">{tr('Chức năng (dùng để làm gì)', 'Feature (used for)', '功能（用途）', '機能（用途）', '기능(용도)')}</p>
            <p className="font-medium">{featureLabel}</p>
            <p className="text-xs text-muted-foreground">{log.feature}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs mb-1">{tr('Độ phân giải ảnh trả về', 'Returned image resolution', '返回图片分辨率', '返却画像の解像度', '반환 이미지 해상도')}</p>
            {imgSize ? (
              <Badge variant="outline" className={imgSize === '2K' ? 'text-sky-600 border-sky-300' : 'text-amber-600 border-amber-300'}>
                {imgSize}
              </Badge>
            ) : (
              <span className="text-muted-foreground">{tr('Không trả ảnh (chỉ text)', 'No image returned (text only)', '不返回图片（仅文本）', '画像なし（テキストのみ）', '이미지 없음(텍스트만)')}</span>
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
              <p className="text-muted-foreground text-xs mb-1">{tr('Tổng tokens', 'Total tokens', '总 tokens', '合計 tokens', '총 tokens')}</p>
              <p className="font-mono font-medium">{formatNum(log.total_token_count || 0)}</p>
            </div>
          </div>
          <div className="pt-3 border-t">
            <p className="text-muted-foreground text-xs mb-1">{tr('Tổng chi phí lượt này', 'Total cost for this call', '本次调用总成本', 'この呼び出しの合計コスト', '이번 호출 총 비용')}</p>
            <p className="text-xl font-bold text-amber-700">{formatVnd(log.costVnd)}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
