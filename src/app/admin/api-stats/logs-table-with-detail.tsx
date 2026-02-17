'use client'

import { useState } from 'react'
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
  const [selectedLog, setSelectedLog] = useState<LogWithCost | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  const handleRowClick = (log: LogWithCost) => {
    setSelectedLog(log)
    setDialogOpen(true)
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Thời gian</TableHead>
            <TableHead>Model</TableHead>
            <TableHead>Chức năng</TableHead>
            <TableHead>Ảnh</TableHead>
            <TableHead className="text-right">Input</TableHead>
            <TableHead className="text-right">Output</TableHead>
            <TableHead className="text-right">Tổng</TableHead>
            <TableHead className="text-right">Chi phí (₫)</TableHead>
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
