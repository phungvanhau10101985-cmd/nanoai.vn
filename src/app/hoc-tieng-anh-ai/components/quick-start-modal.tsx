'use client'

import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { LocalTextFn, SelectOption } from './types'

type QuickStartModalProps = {
  open: boolean
  quickStartBusy: boolean
  quickStartStageLabel: string
  localText: LocalTextFn
  learningLanguageLabel: string
  nativeLanguageLabel: string
  nativeTeacherLabel: string
  learnerLevelLabel: string
  customTopicPlaceholder: string
  languageCode: string
  languageOptions: SelectOption[]
  onLanguageChange: (code: string) => void
  nativeLanguageCode: string
  nativeLanguageOptions: SelectOption[]
  onNativeLanguageChange: (code: string) => void
  selectedTeacherId: string
  teacherOptions: SelectOption[]
  onTeacherChange: (id: string) => void
  learnerLevel: number
  learnerLevelOptions: SelectOption[]
  onLearnerLevelChange: (value: number) => void
  pendingTopicId: string
  topicSourceMode: 'builtin' | 'custom'
  builtInTopicOptions: Array<{ id: string; label: string }>
  customTopicOptions: Array<{ id: string; label: string }>
  onPickBuiltInTopic: (topicId: string) => void
  onPickCustomTopic: (topicId: string) => void
  customTopicDraft: string
  customTopicBusy: boolean
  onCustomTopicDraftChange: (next: string) => void
  onCreateCustomTopic: () => void
  onClose: () => void
  onCreateLesson: () => void
}

export function QuickStartModal({
  open,
  quickStartBusy,
  quickStartStageLabel,
  localText,
  learningLanguageLabel,
  nativeLanguageLabel,
  nativeTeacherLabel,
  learnerLevelLabel,
  customTopicPlaceholder,
  languageCode,
  languageOptions,
  onLanguageChange,
  nativeLanguageCode,
  nativeLanguageOptions,
  onNativeLanguageChange,
  selectedTeacherId,
  teacherOptions,
  onTeacherChange,
  learnerLevel,
  learnerLevelOptions,
  onLearnerLevelChange,
  pendingTopicId,
  topicSourceMode,
  builtInTopicOptions,
  customTopicOptions,
  onPickBuiltInTopic,
  onPickCustomTopic,
  customTopicDraft,
  customTopicBusy,
  onCustomTopicDraftChange,
  onCreateCustomTopic,
  onClose,
  onCreateLesson,
}: QuickStartModalProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-6 sm:pt-10">
      <div className="relative flex w-full max-w-3xl max-h-[calc(100vh-4.5rem)] flex-col rounded-lg border bg-white shadow-xl">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onClose}
          disabled={quickStartBusy}
          aria-label={localText('Đóng popup', 'Close popup')}
          className="absolute right-2 top-2 z-10 h-8 w-8"
        >
          <X className="h-4 w-4" />
        </Button>
        <div className="border-b px-4 py-3">
          <p className="text-base font-semibold text-slate-900">
            {localText('Bắt đầu nhanh - Cài đặt bài học', 'Quick start - Lesson setup')}
          </p>
          <p className="text-xs text-slate-600">
            {localText(
              'Chọn nhanh các tùy chọn dưới đây, rồi bấm "Tạo bài học" để tạo giáo trình và mở buổi học luôn.',
              'Pick your settings below, then click "Create lesson" to generate curriculum and start immediately.'
            )}
          </p>
        </div>
        <div className="overflow-auto px-4 py-3">
          <div className="grid gap-3 grid-cols-1 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">{learningLanguageLabel}</label>
              <select
                value={languageCode}
                onChange={(e) => onLanguageChange(String(e.target.value))}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                {languageOptions.map((lang) => (
                  <option key={lang.value} value={lang.value}>
                    {lang.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">{nativeLanguageLabel}</label>
              <select
                value={nativeLanguageCode}
                onChange={(e) => onNativeLanguageChange(String(e.target.value))}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                {nativeLanguageOptions.map((lang) => (
                  <option key={lang.value} value={lang.value}>
                    {lang.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">{nativeTeacherLabel}</label>
              <select
                value={selectedTeacherId}
                onChange={(e) => onTeacherChange(String(e.target.value))}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                {teacherOptions.map((teacher) => (
                  <option key={teacher.value} value={teacher.value}>
                    {teacher.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">{learnerLevelLabel}</label>
              <select
                value={learnerLevel}
                onChange={(e) => onLearnerLevelChange(Number(e.target.value))}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                {learnerLevelOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-3 grid gap-3 grid-cols-1 md:grid-cols-2">
            <div className="space-y-1">
              <p className="text-xs font-medium text-slate-700">{localText('Chủ đề có sẵn', 'Built-in topics')}</p>
              <select
                value={builtInTopicOptions.some((x) => x.id === pendingTopicId) ? pendingTopicId : ''}
                onChange={(e) => {
                  const value = String(e.target.value || '').trim()
                  if (!value) return
                  onPickBuiltInTopic(value)
                }}
                className={`w-full rounded-md border px-3 py-2 text-sm ${
                  topicSourceMode === 'builtin'
                    ? 'border-slate-900 bg-slate-50 text-slate-900'
                    : 'border-slate-300 bg-white text-slate-700'
                }`}
              >
                <option value="">{localText('Chọn chủ đề có sẵn...', 'Select built-in topic...')}</option>
                {builtInTopicOptions.map((topic) => (
                  <option key={topic.id} value={topic.id}>{topic.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-slate-700">{localText('Chủ đề mới tạo', 'Custom topics')}</p>
              <select
                value={customTopicOptions.some((x) => x.id === pendingTopicId) ? pendingTopicId : ''}
                onChange={(e) => {
                  const value = String(e.target.value || '').trim()
                  if (!value) return
                  onPickCustomTopic(value)
                }}
                className={`w-full rounded-md border px-3 py-2 text-sm ${
                  topicSourceMode === 'custom'
                    ? 'border-slate-900 bg-slate-50 text-slate-900'
                    : 'border-slate-300 bg-white text-slate-700'
                }`}
              >
                <option value="">
                  {customTopicOptions.length > 0
                    ? localText('Chọn chủ đề mới tạo...', 'Select custom topic...')
                    : localText('Chưa có chủ đề mới tạo', 'No custom topic yet')}
                </option>
                {customTopicOptions.map((topic) => (
                  <option key={topic.id} value={topic.id}>{topic.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-3 space-y-2 rounded-md border bg-slate-50 p-3">
            <p className="text-xs font-medium text-slate-700">{localText('Tạo chủ đề mới ngay trong popup', 'Create a new topic in this popup')}</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                value={customTopicDraft}
                onChange={(e) => onCustomTopicDraftChange(e.target.value)}
                placeholder={customTopicPlaceholder}
                className="h-11 w-full text-base sm:flex-1"
                disabled={customTopicBusy || quickStartBusy}
              />
              <Button
                type="button"
                variant="outline"
                onClick={onCreateCustomTopic}
                disabled={customTopicBusy || quickStartBusy}
                className="h-11 px-4 sm:shrink-0"
              >
                {customTopicBusy ? localText('Đang tạo chủ đề mới...', 'Creating topic...') : localText('Tạo chủ đề mới', 'Create topic')}
              </Button>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2 border-t px-4 py-3 sm:flex-row sm:justify-end">
          <Button
            type="button"
            onClick={onCreateLesson}
            disabled={quickStartBusy}
            className="min-h-[44px]"
          >
            {quickStartBusy ? quickStartStageLabel : localText('Tạo bài học', 'Create lesson')}
          </Button>
        </div>
      </div>
    </div>
  )
}
