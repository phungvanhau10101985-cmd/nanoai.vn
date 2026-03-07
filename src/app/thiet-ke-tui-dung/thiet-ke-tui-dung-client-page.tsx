'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'
import { ShoppingBag, RefreshCw, Download, FileText } from 'lucide-react'
import {
  generateBagNetSvg,
  getBagNetBounds,
  type BagDimensions,
} from './lib/bag-net-svg'
import { generateBagNetPdf } from './actions'

type UiLocale = 'vi' | 'en' | 'zh' | 'ja' | 'ko'

function getWebLocaleFromCookie(): UiLocale {
  if (typeof document === 'undefined') return 'vi'
  const cookieValue = document.cookie
    .split(';')
    .map((x) => x.trim())
    .find((x) => x.startsWith('nanoai_locale='))
    ?.split('=')[1]
    ?.trim()
    .toLowerCase()
  if (cookieValue === 'en' || cookieValue === 'zh' || cookieValue === 'ja' || cookieValue === 'ko') return cookieValue
  return 'vi'
}

const DEFAULT_DIMS: BagDimensions = { widthMm: 200, heightMm: 280, gussetMm: 60 }

export default function ThietKeTuiDungClientPage() {
  const [uiLocale, setUiLocale] = useState<UiLocale>('vi')
  const [widthInput, setWidthInput] = useState(String(DEFAULT_DIMS.widthMm))
  const [heightInput, setHeightInput] = useState(String(DEFAULT_DIMS.heightMm))
  const [gussetInput, setGussetInput] = useState(String(DEFAULT_DIMS.gussetMm))
  const widthMm = widthInput === '' ? 20 : Math.max(20, Math.min(500, Number(widthInput) || 20))
  const heightMm = heightInput === '' ? 20 : Math.max(20, Math.min(500, Number(heightInput) || 20))
  const gussetMm = gussetInput === '' ? 10 : Math.max(10, Math.min(200, Number(gussetInput) || 10))
  const [svgContent, setSvgContent] = useState('')
  const [pdfLoading, setPdfLoading] = useState(false)
  const svgRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()

  const tr = (vi: string, en: string, zh: string, ja: string, ko: string) => {
    if (uiLocale === 'en') return en
    if (uiLocale === 'zh') return zh
    if (uiLocale === 'ja') return ja
    if (uiLocale === 'ko') return ko
    return vi
  }

  useEffect(() => {
    const syncLocale = () => setUiLocale(getWebLocaleFromCookie())
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

  useEffect(() => {
    const G = Math.min(gussetMm, heightMm - 5)
    const d: BagDimensions = { widthMm, heightMm, gussetMm: G }
    setSvgContent(generateBagNetSvg(d))
  }, [widthMm, heightMm, gussetMm])

  const dims: BagDimensions = {
    widthMm,
    heightMm,
    gussetMm: Math.min(gussetMm, heightMm - 5),
  }
  const bounds = getBagNetBounds(dims)

  const handleExportPng = () => {
    const svgEl = svgRef.current?.querySelector('svg')
    if (!svgEl) return
    const svgStr = new XMLSerializer().serializeToString(svgEl)
    const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      const scale = 2
      const canvas = document.createElement('canvas')
      canvas.width = img.width * scale
      canvas.height = img.height * scale
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.scale(scale, scale)
      ctx.drawImage(img, 0, 0)
      canvas.toBlob((b) => {
        if (!b) return
        const a = document.createElement('a')
        a.href = URL.createObjectURL(b)
        a.download = `bag-net-${dims.widthMm}x${dims.heightMm}x${dims.gussetMm}mm.png`
        a.click()
        URL.revokeObjectURL(a.href)
        toast({ title: tr('Đã tải PNG', 'PNG downloaded', 'PNG已下载', 'PNGをダウンロードしました', 'PNG 다운로드됨'), duration: 2000 })
      })
      URL.revokeObjectURL(url)
    }
    img.src = url
  }

  const handleExportPdf = async () => {
    const svgEl = svgRef.current?.querySelector('svg')
    if (!svgEl) return
    let svgStr = new XMLSerializer().serializeToString(svgEl)
    const pxPerMm = 300 / 25.4
    const targetW = Math.ceil(bounds.widthMm * pxPerMm)
    const targetH = Math.ceil(bounds.heightMm * pxPerMm)
    svgStr = svgStr.replace(/width="[^"]+"/, `width="${targetW}"`).replace(/height="[^"]+"/, `height="${targetH}"`)
    const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = async () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth || img.width
      canvas.height = img.naturalHeight || img.height
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0)
      const dataUrl = canvas.toDataURL('image/png')
      URL.revokeObjectURL(url)
      setPdfLoading(true)
      try {
        const result = await generateBagNetPdf(dataUrl, Math.ceil(bounds.widthMm), Math.ceil(bounds.heightMm))
        if ('error' in result) {
          toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: result.error, variant: 'destructive' })
        } else {
          const a = document.createElement('a')
          a.href = result.pdfUrl
          a.download = `bag-net-${dims.widthMm}x${dims.heightMm}x${dims.gussetMm}mm.pdf`
          a.target = '_blank'
          a.click()
          toast({ title: tr('Đã tạo PDF chuẩn in. Bleed 3mm, crop marks.', 'Print-ready PDF created. Bleed 3mm, crop marks.', '已生成印刷用PDF。出血3mm，裁切线。', '印刷用PDFを作成しました。塗り足し3mm、トンボ付き。', '인쇄용 PDF 생성됨. 블리드 3mm, 크롭 마크.'), duration: 3000 })
        }
      } finally {
        setPdfLoading(false)
      }
    }
    img.src = url
  }

  const handleReset = () => {
    setWidthInput(String(DEFAULT_DIMS.widthMm))
    setHeightInput(String(DEFAULT_DIMS.heightMm))
    setGussetInput(String(DEFAULT_DIMS.gussetMm))
  }

  return (
    <>
      <Toaster />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">
            {tr('Thiết kế túi đựng (mặt phẳng)', 'Flat bag design', '平面袋设计', '平面袋デザイン', '평면 가방 설계')}
          </h1>
          <p className="text-muted-foreground mt-1">
            {tr('Nhập kích thước mm (W×H×G). Net triển khai túi có gusset. Xuất PNG, PDF chuẩn in.', 'Enter dimensions in mm (W×H×G). Flat bag net with gusset. Export PNG, print-ready PDF.', '输入尺寸（毫米）。带侧边袋的平面展开图。导出 PNG、印刷用 PDF。', 'サイズ（mm）を入力。ガセット付き平面袋の展開図。PNG・印刷用PDFを出力。', '크기(mm) 입력. 가셋 포함 평면 가방 전개도. PNG, 인쇄용 PDF 다운로드.')}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="border shadow-sm bg-white/80 backdrop-blur border-emerald-200/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShoppingBag className="h-4 w-4 text-emerald-600" />
                {tr('Thông số túi', 'Bag parameters', '袋子参数', '袋のパラメータ', '가방 파라미터')}
              </CardTitle>
              <CardDescription>
                {tr('W: chiều rộng mặt trước/sau. H: chiều cao. G: độ sâu gusset (hông túi).', 'W: front/back width. H: height. G: gusset depth (bag sides).', 'W: 正面/背面宽度。H: 高度。G: 侧边深度。', 'W: 前面/背面の幅。H: 高さ。G: ガセット（側面）の深さ。', 'W: 앞/뒤 너비. H: 높이. G: 가셋(폭) 깊이.')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">W (mm)</label>
                  <Input type="number" min={20} max={500} value={widthInput} onChange={(e) => setWidthInput(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">H (mm)</label>
                  <Input type="number" min={20} max={500} value={heightInput} onChange={(e) => setHeightInput(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">G (mm)</label>
                  <Input type="number" min={10} max={200} value={gussetInput} onChange={(e) => setGussetInput(e.target.value)} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {tr('Net kích thước:', 'Net size:', '展开图尺寸:', '展開図サイズ:', '전개도 크기:')} {Math.ceil(bounds.widthMm)} × {Math.ceil(bounds.heightMm)} mm
              </p>
              <p className="text-xs text-muted-foreground">
                {tr('Nét đỏ: cắt chu vi ngoài. Nét đứt xanh: gấp.', 'Red: cut outer perimeter. Dashed green: fold.', '红线：裁切外轮廓。绿色虚线：折叠。', '赤線：外周を裁断。緑点線：折り。', '빨간선: 외곽 절단. 초록 점선: 접기.')}
              </p>
              <Button variant="outline" size="sm" onClick={handleReset} className="w-full">
                <RefreshCw className="h-3 w-3 mr-2" /> {tr('Đặt lại', 'Reset', '重置', 'リセット', '초기화')}
              </Button>
            </CardContent>
          </Card>

          <div className="lg:col-span-2 space-y-4">
            <Card className="border shadow-sm bg-white overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{tr('Net triển khai', 'Flat net', '平面展开图', '平面展開図', '평면 전개도')}</CardTitle>
                <CardDescription>
                  {tr('In trên giấy. Cắt theo nét đỏ (chu vi ngoài). Gấp theo nét đứt xanh.', 'Print on paper. Cut along red lines (outer perimeter). Fold along dashed green lines.', '打印在纸上。沿红线裁切（外轮廓）。沿绿色虚线折叠。', '紙に印刷。赤線（外周）で裁断。緑点線で折り。', '종이에 인쇄. 빨간선(외곽)으로 자르기. 초록 점선으로 접기.')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div
                  ref={svgRef}
                  className="w-full overflow-auto bg-[repeating-conic-gradient(#e5e7eb_0%_25%,#f9fafb_0%_50%)] bg-[length:12px_12px] rounded-lg border p-4 flex items-center justify-center min-h-[320px]"
                  dangerouslySetInnerHTML={{ __html: svgContent }}
                />
                <div className="flex flex-wrap gap-2 mt-4">
                  <Button size="sm" variant="outline" onClick={handleExportPng} className="gap-2">
                    <Download className="h-3 w-3" /> {tr('Tải PNG', 'Download PNG', '下载 PNG', 'PNGをダウンロード', 'PNG 다운로드')}
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleExportPdf} disabled={pdfLoading} className="gap-2">
                    <FileText className="h-3 w-3" />
                    {pdfLoading ? tr('Đang tạo...', 'Creating...', '生成中...', '作成中...', '생성 중...') : tr('Tải PDF chuẩn in', 'Download print-ready PDF', '下载印刷用PDF', '印刷用PDFをダウンロード', '인쇄용 PDF 다운로드')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          {tr('Net phù hợp in trên giấy bìa, giấy kraft, màng PE. Cắt và gấp thủ công. Gusset G nên nhỏ hơn H.', 'Net suitable for printing on cardboard, kraft paper, PE film. Cut and fold manually. Gusset G should be less than H.', '展开图适合打印在纸板、牛皮纸、PE膜上。手工裁切折叠。侧边G应小于H。', '展開図は厚紙、クラフト紙、PEフィルムに印刷可能。手裁断・手折り。ガセットGはHより小さく。', '전개도는 두꺼운 종이, 크래프트지, PE 필름에 인쇄 후 수동 절단·접기에 적합. G는 H보다 작게.')}
        </p>
      </div>
    </>
  )
}
