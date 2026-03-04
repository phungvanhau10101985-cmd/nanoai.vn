'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Trash2 } from 'lucide-react'
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
  onDeleteSession?: (sessionId: string) => void
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
  onDeleteSession,
}: HistoryPanelProps) {
  return (
    <Card className="section-surface min-w-0">
      <CardHeader className="min-w-0">
        <CardTitle className="break-words">{title}</CardTitle>
        <CardDescription className="break-words">{description}</CardDescription>
      </CardHeader>
      <CardContent className="min-w-0 space-y-3">
        <div className="mb-2 flex min-w-0 items-center justify-between gap-2">
          <p className="min-w-0 break-words text-sm font-semibold text-slate-800">
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
              <div key={session.sessionId} className="flex min-w-0 max-w-full flex-col gap-2 overflow-hidden rounded-xl border border-border/70 bg-background/80 p-2.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1 overflow-hidden">
                  <p className="break-words text-sm font-medium text-slate-800">
                    {session.topicLabel ? (
                      <>
                        <span className="font-semibold text-indigo-700">{session.topicLabel}</span>
                        {' • '}
                        {session.teacherLabel || localText('Giáo viên AI', 'AI teacher')}
                      </>
                    ) : (
                      session.teacherLabel || localText('Giáo viên AI', 'AI teacher')
                    )}
                  </p>
                  <p className="break-words text-xs text-muted-foreground">
                    {session.isPresetReplaySession
                      ? localText('Bài có sẵn', 'Saved lesson')
                      : localText('Live AI', 'Live AI')} •{' '}
                    {session.languageCode?.toUpperCase() || 'N/A'} • {
                      session.mode === 'listen_speak'
                        ? localText('Luyện nghe nói', 'Listen & Speak')
                        : session.mode === 'roleplay_short'
                          ? localText('Nhập vai ngắn', 'Short roleplay')
                          : localText('Hội thoại', 'Conversation')
                    } • {session.messageCount} {localText('tin nhắn', 'messages')}
                  </p>
                  <p className="break-words text-xs text-slate-600">{session.lastTeacherText || localText('Không có bản xem trước.', 'No preview available.')}</p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant={openedHistorySessionId === session.sessionId ? 'secondary' : 'outline'}
                    size="sm"
                    disabled={historyBusy}
                    onClick={() => onOpenSession(session.sessionId)}
                    className="min-w-0 shrink-0"
                  >
                    {openedHistorySessionId === session.sessionId ? localText('Đang mở', 'Opened') : (
                      <>
                        <span className="hidden sm:inline">{localText('Mở buổi này', 'Open this lesson')}</span>
                        <span className="sm:hidden">{localText('Mở', 'Open')}</span>
                      </>
                    )}
                  </Button>
                  {onDeleteSession ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={historyBusy}
                      onClick={() => onDeleteSession(session.sessionId)}
                      title={localText('Xóa buổi học', 'Delete lesson')}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
