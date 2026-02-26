'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { HistorySessionItem, LocalTextFn } from './types'

type HistoryPanelProps = {
  title: string
  description: string
  sessions: HistorySessionItem[]
  openedHistorySessionId: string
  historyBusy: boolean
  localText: LocalTextFn
  onRefresh: () => void
  onOpenSession: (sessionId: string) => void
}

export function HistoryPanel({
  title,
  description,
  sessions,
  openedHistorySessionId,
  historyBusy,
  localText,
  onRefresh,
  onOpenSession,
}: HistoryPanelProps) {
  return (
    <Card className="border shadow-sm bg-white/80 backdrop-blur">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-slate-800">
            {localText('Danh sách buổi học đã lưu', 'Saved lesson list')}
            {openedHistorySessionId ? localText(' • Đang mở 1 buổi cũ', ' • Opening one past lesson') : ''}
          </p>
          <Button type="button" variant="ghost" size="sm" onClick={onRefresh}>
            {localText('Làm mới', 'Refresh')}
          </Button>
        </div>
        {sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">{localText('Chưa có buổi học nào được lưu.', 'No saved lessons yet.')}</p>
        ) : (
          <div className="space-y-2">
            {sessions.map((session) => (
              <div key={session.sessionId} className="flex flex-col gap-2 rounded-md border bg-white p-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800">{session.teacherLabel || localText('Giáo viên AI', 'AI teacher')}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {session.languageCode?.toUpperCase() || 'N/A'} • {
                      session.mode === 'listen_speak'
                        ? localText('Luyện nghe nói', 'Listen & Speak')
                        : session.mode === 'roleplay_short'
                          ? localText('Nhập vai ngắn', 'Short roleplay')
                          : localText('Hội thoại', 'Conversation')
                    } • {session.messageCount} {localText('tin nhắn', 'messages')}
                  </p>
                  <p className="truncate text-xs text-slate-600">{session.lastTeacherText || localText('Không có bản xem trước.', 'No preview available.')}</p>
                </div>
                <Button
                  type="button"
                  variant={openedHistorySessionId === session.sessionId ? 'secondary' : 'outline'}
                  size="sm"
                  disabled={historyBusy}
                  onClick={() => onOpenSession(session.sessionId)}
                >
                  {openedHistorySessionId === session.sessionId ? localText('Đang mở', 'Opened') : localText('Mở buổi này', 'Open this lesson')}
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
