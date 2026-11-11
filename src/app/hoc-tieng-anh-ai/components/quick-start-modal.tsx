'use client'

import { X } from 'lucide-react'
import { processingLabel } from './processing-status'
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
  learnerLevelLabel: string
  customTopicPlaceholder: string
  languageCode: string
  languageOptions: SelectOption[]
  onLanguageChange: (code: string) => void
  nativeLanguageCode: string
  nativeLanguageOptions: SelectOption[]
  onNativeLanguageChange: (code: string) => void
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

const fieldClass =
  'min-h-11 w-full rounded-lg border bg-white px-3 text-base text-slate-900 sm:text-sm'

export function QuickStartModal({
  open,
  quickStartBusy,
  quickStartStageLabel,
  localText,
  learningLanguageLabel,
  nativeLanguageLabel,
  learnerLevelLabel,
  customTopicPlaceholder,
  languageCode,
  languageOptions,
  onLanguageChange,
  nativeLanguageCode,
  nativeLanguageOptions,
  onNativeLanguageChange,
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

  const topicFieldClass = (active: boolean) =>
    `${fieldClass} ${active ? 'border-slate-900' : 'border-slate-300'}`

  return (
    <div className="fixed inset-0 z-50 bg-black/50">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-start-title"
        className="fixed inset-x-0 bottom-0 z-50 flex max-h-[100dvh] flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-xl sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-[min(40rem,calc(100vw-2rem))] sm:max-h-[min(40rem,calc(100dvh-2rem))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl"
      >
        <div className="relative border-b border-slate-200 px-4 py-3 pr-14">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            disabled={quickStartBusy}
            aria-label={localText('Đóng popup', 'Close popup')}
            className="absolute right-2 top-2 h-11 w-11"
          >
            <X className="h-4 w-4" />
          </Button>
          <p id="quick-start-title" className="text-base font-semibold leading-snug text-slate-900">
            {localText('Bắt đầu nhanh - Cài đặt bài học', 'Quick start - Lesson setup')}
          </p>
          <p className="mt-1 text-sm leading-snug text-slate-600">
            {localText(
              'Chọn nhanh các tùy chọn dưới đây, rồi bấm "Tạo bài học" để tạo giáo trình và mở buổi học luôn.',
              'Pick your settings below, then click "Create lesson" to generate curriculum and start immediately.'
            )}
          </p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="quick-start-language" className="text-sm font-medium text-slate-800">
                {learningLanguageLabel}
              </label>
              <select
                id="quick-start-language"
                value={languageCode}
                onChange={(e) => onLanguageChange(String(e.target.value))}
                className={`${fieldClass} border-slate-300`}
              >
                {languageOptions.map((lang) => (
                  <option key={lang.value} value={lang.value}>
                    {lang.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="quick-start-native" className="text-sm font-medium text-slate-800">
                {nativeLanguageLabel}
              </label>
              <select
                id="quick-start-native"
                value={nativeLanguageCode}
                onChange={(e) => onNativeLanguageChange(String(e.target.value))}
                className={`${fieldClass} border-slate-300`}
              >
                {nativeLanguageOptions.map((lang) => (
                  <option key={lang.value} value={lang.value}>
                    {lang.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <label htmlFor="quick-start-level" className="text-sm font-medium text-slate-800">
                {learnerLevelLabel}
              </label>
              <select
                id="quick-start-level"
                value={learnerLevel}
                onChange={(e) => onLearnerLevelChange(Number(e.target.value))}
                className={`${fieldClass} border-slate-300`}
              >
                {learnerLevelOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="quick-start-builtin" className="text-sm font-medium text-slate-800">
                {localText('Chủ đề có sẵn', 'Built-in topics')}
              </label>
              <select
                id="quick-start-builtin"
                value={builtInTopicOptions.some((x) => x.id === pendingTopicId) ? pendingTopicId : ''}
                onChange={(e) => {
                  const value = String(e.target.value || '').trim()
                  if (!value) return
                  onPickBuiltInTopic(value)
                }}
                className={topicFieldClass(topicSourceMode === 'builtin')}
              >
                <option value="">{localText('Chọn chủ đề có sẵn...', 'Select built-in topic...')}</option>
                {builtInTopicOptions.map((topic) => (
                  <option key={topic.id} value={topic.id}>{topic.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="quick-start-custom" className="text-sm font-medium text-slate-800">
                {localText('Chủ đề mới tạo', 'Custom topics')}
              </label>
              <select
                id="quick-start-custom"
                value={customTopicOptions.some((x) => x.id === pendingTopicId) ? pendingTopicId : ''}
                onChange={(e) => {
                  const value = String(e.target.value || '').trim()
                  if (!value) return
                  onPickCustomTopic(value)
                }}
                className={topicFieldClass(topicSourceMode === 'custom')}
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
          <div className="mt-3 space-y-1.5 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <label htmlFor="quick-start-new-topic" className="text-sm font-medium text-slate-800">
              {localText('Tạo chủ đề mới ngay trong popup', 'Create a new topic in this popup')}
            </label>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                id="quick-start-new-topic"
                value={customTopicDraft}
                onChange={(e) => onCustomTopicDraftChange(e.target.value)}
                placeholder={customTopicPlaceholder}
                className="h-11 w-full text-base sm:min-w-0 sm:flex-1 sm:text-sm"
                disabled={customTopicBusy || quickStartBusy}
              />
              <Button
                type="button"
                variant="outline"
                onClick={onCreateCustomTopic}
                disabled={customTopicBusy || quickStartBusy}
                className="h-11 w-full px-4 sm:w-auto sm:shrink-0"
              >
                {customTopicBusy ? processingLabel(localText('Đang tạo chủ đề mới...', 'Creating topic...')) : localText('Tạo chủ đề mới', 'Create topic')}
              </Button>
            </div>
          </div>
        </div>
        <div className="flex border-t border-slate-200 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <Button
            type="button"
            onClick={onCreateLesson}
            disabled={quickStartBusy}
            className="h-11 w-full text-base sm:ml-auto sm:w-auto sm:min-w-40 sm:text-sm"
          >
            {quickStartBusy ? processingLabel(quickStartStageLabel) : localText('Tạo bài học', 'Create lesson')}
          </Button>
        </div>
      </div>
    </div>
  )
}
