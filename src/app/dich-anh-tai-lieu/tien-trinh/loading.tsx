import { Loader2 } from 'lucide-react'

export default function TienTrinhLoading() {
  return (
    <div className="max-w-2xl mx-auto p-6 flex flex-col items-center justify-center min-h-[200px]">
      <Loader2 className="h-10 w-10 animate-spin text-slate-500" />
      <p className="mt-4 text-muted-foreground">Đang tải...</p>
    </div>
  )
}
