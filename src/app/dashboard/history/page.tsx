import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getUserOrBypass } from '@/lib/auth'
import Image from 'next/image'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Download, Calendar, Clock, Maximize2, Trash2 } from 'lucide-react'
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import { Toaster } from '@/components/ui/toaster'

// Client component for image preview
import { ImagePreview } from '@/components/ui/image-preview'
import { DownloadImageButton } from '@/components/download-image-button'
import { DeleteHistoryButton } from './delete-button'
import Link from 'next/link'

export default async function HistoryPage() {
  const supabase = createClient()

  const user = await getUserOrBypass(() => supabase.auth.getUser())
  if (!user) redirect('/auth/login')

  const { data: history, error } = await supabase
    .from('try_on_history')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'completed')
    .or('feature.neq.translate,feature.is.null')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching history:', error)
    return <div>Failed to load history.</div>
  }

  return (
    <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <Toaster />
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Ảnh đã xử lý</h1>
        <div className="flex items-center gap-4">
          <p className="text-muted-foreground">
            {history?.length || 0} kết quả
          </p>
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/history/translate">Lịch sử dịch ảnh</Link>
          </Button>
        </div>
      </div>

      {history && history.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {history.map((item) => (
            <Card key={item.id} className="overflow-hidden flex flex-col">
              <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
                <div className="flex items-center text-sm text-muted-foreground">
                  <Calendar className="mr-1 h-3 w-3" />
                  {new Date(item.created_at).toLocaleDateString('vi-VN')}
                </div>
                <Badge variant={item.status === 'completed' ? 'default' : 'destructive'}>
                  {item.status === 'completed' ? 'Thành công' : 'Thất bại'}
                </Badge>
              </CardHeader>
              <CardContent className="p-4 flex-1 space-y-4">
                {item.result_image_url && (
                  <div className="space-y-2">
                    <div className="relative aspect-[3/4] rounded-md overflow-hidden border-2 border-primary shadow-sm group">
                      <ImagePreview 
                        src={item.result_image_url} 
                        alt="Result" 
                        className="w-full h-full"
                      />
                      <div className="absolute top-2 right-2 pointer-events-none">
                        <Badge className="bg-primary text-primary-foreground">Kết quả</Badge>
                      </div>
                      <div className="absolute bottom-2 right-2 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                        <Badge variant="secondary" className="bg-black/50 text-white hover:bg-black/70">
                          <Maximize2 className="w-3 h-3 mr-1" /> Xem to
                        </Badge>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <DownloadImageButton imageUrl={item.result_image_url} filename={`try-on-${item.id}`} size="sm" variant="default" className="w-full" />
                      </div>
                      <div className="w-24">
                        <DeleteHistoryButton id={item.id} />
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div className="relative aspect-[3/4] rounded-md overflow-hidden border bg-muted group">
                    <ImagePreview
                      src={item.original_image_url}
                      alt="Original"
                      className="w-full h-full"
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[10px] p-1 text-center pointer-events-none">
                      Ảnh gốc
                    </div>
                    <div className="absolute top-1 right-1 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="bg-black/50 text-white p-1 rounded-full">
                        <Maximize2 className="w-3 h-3" />
                      </div>
                    </div>
                  </div>
                  <div className="relative aspect-[3/4] rounded-md overflow-hidden border bg-muted group">
                    <ImagePreview
                      src={item.garment_image_url}
                      alt="Garment"
                      className="w-full h-full"
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[10px] p-1 text-center pointer-events-none">
                      Sản phẩm
                    </div>
                    <div className="absolute top-1 right-1 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="bg-black/50 text-white p-1 rounded-full">
                        <Maximize2 className="w-3 h-3" />
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
              {/* <CardFooter className="p-4 pt-0">
                {item.result_image_url && (
                  <a href={item.result_image_url} download={`try-on-${item.id}.png`} className="w-full" target="_blank" rel="noopener noreferrer">
                    <Button className="w-full" variant="outline">
                      <Download className="mr-2 h-4 w-4" /> Tải ảnh về
                    </Button>
                  </a>
                )}
              </CardFooter> */}
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <h3 className="text-lg font-medium">Chưa có lịch sử</h3>
          <p className="text-muted-foreground mt-1">Hãy thử các tính năng thử đồ, phục dựng ảnh, làm nét, ghép ảnh ngay bây giờ!</p>
          <div className="flex flex-wrap justify-center gap-3 mt-4">
            <Button asChild>
              <a href="/thu-do-online">Thử đồ ngay</a>
            </Button>
            <Button variant="outline" asChild>
              <a href="/dashboard/history/translate">Lịch sử dịch ảnh</a>
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}