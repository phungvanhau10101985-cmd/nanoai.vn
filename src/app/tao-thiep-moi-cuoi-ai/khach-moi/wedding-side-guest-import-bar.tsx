'use client'

import { useRef, useState } from 'react'
import { Download, FileUp, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { downloadWeddingGuestImportTemplate, importWeddingInvitedGuests } from './actions'

type Side = 'groom' | 'bride'

type Props = {
  cardId: string
  side: Side
  disabled?: boolean
  onImported?: () => void | Promise<void>
}

export function WeddingSideGuestImportBar({ cardId, side, disabled, onImported }: Props) {
  const { toast } = useToast()
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [importing, setImporting] = useState(false)
  const sideLabel = side === 'bride' ? 'nhà gái' : 'nhà trai'
  const forceSide = side === 'bride' ? 'bride_home' : 'groom_home'
  const blocked = disabled || !cardId || importing

  const downloadTemplate = async () => {
    const result = await downloadWeddingGuestImportTemplate(side)
    if ('error' in result) {
      toast({ title: 'Không tải được file mẫu', description: result.error, variant: 'destructive' })
      return
    }
    const binary = atob(result.base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
    const blob = new Blob([bytes], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = side === 'bride' ? 'mau-khach-nha-gai.xlsx' : 'mau-khach-nha-trai.xlsx'
    link.click()
    URL.revokeObjectURL(url)
  }

  const importFile = async (file: File | null) => {
    if (!file || !cardId || importing) return
    setImporting(true)
    const formData = new FormData()
    formData.append('cardId', cardId)
    formData.append('forceSide', forceSide)
    formData.append('file', file)
    const result = await importWeddingInvitedGuests(formData)
    setImporting(false)
    if (fileRef.current) fileRef.current.value = ''
    if ('error' in result && result.error) {
      toast({ title: 'Import thất bại', description: result.error, variant: 'destructive' })
      return
    }
    if (!('created' in result)) return
    const skippedNote = result.skipped ? ` Bỏ qua ${result.skipped} dòng.` : ''
    const detail = result.errors.length ? ` ${result.errors[0]}` : ''
    toast({
      title: `Đã thêm ${result.created} khách ${sideLabel}`,
      description: `${skippedNote}${detail}`.trim() || `Danh sách đã vào ${sideLabel}.`,
    })
    await onImported?.()
  }

  return (
    <div className="space-y-3 rounded-xl border border-dashed bg-background px-3 py-3">
      <p className="text-sm leading-6 text-muted-foreground">
        Import Excel chỉ thêm khách {sideLabel}. File mẫu có cột Tên, không cần cột Bên.
        {!cardId ? ' Lưu thiệp trước khi import.' : ''}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" className="h-11 flex-1 sm:h-9 sm:flex-none" onClick={() => void downloadTemplate()}>
          <Download className="mr-2 h-4 w-4" />
          Tải file mẫu {sideLabel}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-11 flex-1 sm:h-9 sm:flex-none"
          disabled={blocked}
          onClick={() => fileRef.current?.click()}
        >
          {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileUp className="mr-2 h-4 w-4" />}
          Import khách {sideLabel}
        </Button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0] ?? null
          void importFile(file)
        }}
      />
    </div>
  )
}
