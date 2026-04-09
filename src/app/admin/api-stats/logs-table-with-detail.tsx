'use client'

import { readWebLocaleFromDocumentCookie } from '@/lib/i18n/read-web-locale-cookie'

import { useEffect, useState } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { LogDetailDialog, type LogWithCost } from './log-detail-dialog'

const formatNum = (n: number) => n.toLocaleString('vi-VN')
const formatVnd = (n: number) => `${n.toLocaleString('vi-VN')}₫`

interface LogsTableWithDetailProps {
  logs: LogWithCost[]
  featureLabels: Record<string, string>
}

export function LogsTableWithDetail({
  logs,
  featureLabels,
}: LogsTableWithDetailProps) {
  const [uiLocale, setUiLocale] = useState<'vi' | 'en' | 'zh' | 'ja' | 'ko'>('vi')
  const [selectedLog, setSelectedLog] = useState<LogWithCost | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
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

  const handleRowClick = (log: LogWithCost) => {
    setSelectedLog(log)
    setDialogOpen(true)
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{tr('Thời gian', 'Time', '时间', '時間', '시간')}</TableHead>
            <TableHead>Model</TableHead>
            <TableHead>{tr('Chức năng', 'Feature', '功能', '機能', '기능')}</TableHead>
            <TableHead>{tr('Ảnh', 'Image', '图片', '画像', '이미지')}</TableHead>
            <TableHead className="text-right">Input</TableHead>
            <TableHead className="text-right">Output</TableHead>
            <TableHead className="text-right">{tr('Tổng', 'Total', '总计', '合計', '합계')}</TableHead>
            <TableHead className="text-right">{tr('Chi phí (₫)', 'Cost (₫)', '费用 (₫)', 'コスト (₫)', '비용 (₫)')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.slice(0, 100).map((log) => {
            const imgSize = (log as { image_size?: string | null }).image_size
            return (
              <TableRow
                key={log.id}
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => handleRowClick(log)}
              >
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(log.created_at).toLocaleString('vi-VN')}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="font-mono text-xs">
                    {log.model}
                  </Badge>
                </TableCell>
                <TableCell>{featureLabels[log.feature] || log.feature}</TableCell>
                <TableCell>
                  {imgSize ? (
                    <Badge variant="outline" className={imgSize === '2K' ? 'text-sky-600 border-sky-300' : 'text-amber-600 border-amber-300'}>
                      {imgSize}
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-right">{formatNum(log.prompt_token_count || 0)}</TableCell>
                <TableCell className="text-right">{formatNum(log.candidates_token_count || 0)}</TableCell>
                <TableCell className="text-right font-medium">{formatNum(log.total_token_count || 0)}</TableCell>
                <TableCell className="text-right font-medium text-amber-700">{formatVnd(log.costVnd)}</TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
      <LogDetailDialog
        log={selectedLog}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        featureLabels={featureLabels}
      />
    </>
  )
}
