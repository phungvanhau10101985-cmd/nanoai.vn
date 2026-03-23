'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'
import { Cylinder, Download, FileText, ImagePlus } from 'lucide-react'
import {
  generateLabelSvg,
  getLabelBounds,
  type CylinderDimensions,
} from './lib/cylinder-wrap-svg'
import { generateCylinderLabelPdf } from './actions'
import { DraggableLabelFrame } from './components/draggable-label-frame'

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

const DEFAULT_DIMS: CylinderDimensions = { diameterMm: 66, heightMm: 120 }

export default function MockupCylinderWrapClientPage() {
  const [uiLocale, setUiLocale] = useState<UiLocale>('vi')
  const [diameterInput, setDiameterInput] = useState(String(DEFAULT_DIMS.diameterMm))
  const [heightInput, setHeightInput] = useState(String(DEFAULT_DIMS.heightMm))
  const diameterMm = diameterInput === '' ? 20 : Math.max(20, Math.min(200, Number(diameterInput) || 20))
  const heightMm = heightInput === '' ? 20 : Math.max(20, Math.min(500, Number(heightInput) || 20))
  const [labelImageUrl, setLabelImageUrl] = useState<string | null>(null)
  const [svgContent, setSvgContent] = useState('')
  const [pdfLoading, setPdfLoading] = useState(false)
  const [imagePosition, setImagePosition] = useState<{
    panX: number
    panY: number
    scale: number
    imgW: number
    imgH: number
    frameW: number
    frameH: number
  } | null>(null)
  const imagePositionRef = useRef(imagePosition)
  imagePositionRef.current = imagePosition
  const svgRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
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

  const dims: CylinderDimensions = {
    diameterMm: Math.max(20, Math.min(200, diameterMm)),
    heightMm: Math.max(20, Math.min(500, heightMm)),
  }
  const bounds = getLabelBounds(dims)

  useEffect(() => {
    if (!labelImageUrl) setSvgContent(generateLabelSvg(dims))
  }, [dims.diameterMm, dims.heightMm, labelImageUrl])

  // Vẽ 3D cylinder mockup
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const draw = (img: HTMLImageElement | null) => {
      if (canvas.getBoundingClientRect().width === 0) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const dpr = window.devicePixelRatio || 1
      const rect = canvas.getBoundingClientRect()
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      ctx.scale(dpr, dpr)

      const w = rect.width
      const h = rect.height
      const aspect = dims.heightMm / dims.diameterMm
      let cylW = Math.min(w * 0.6, h * 0.35)
      let bodyH = cylW * aspect
      if (bodyH > h * 0.75) {
        bodyH = h * 0.75
        cylW = bodyH / aspect
      }
      const ellipseH = Math.max(4, bodyH * 0.06)
      const cylH = bodyH + 2 * ellipseH
      const cx = w / 2
      const cy = h / 2
      const bodyTop = cy - cylH / 2 + ellipseH
      const bodyBottom = cy + cylH / 2 - ellipseH

      ctx.fillStyle = '#f1f5f9'
      ctx.fillRect(0, 0, w, h)

      ctx.fillStyle = '#e2e8f0'
      ctx.beginPath()
      ctx.ellipse(cx, cy - cylH / 2, cylW / 2, ellipseH, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = '#94a3b8'
      ctx.stroke()

      if (img) {
        ctx.save()
        ctx.beginPath()
        ctx.rect(cx - cylW / 2, bodyTop, cylW, bodyH)
        ctx.clip()
        const pos = imagePositionRef.current
        const iw = img.naturalWidth
        const ih = img.naturalHeight
        const imgStartX = pos?.scale ? pos.panX / pos.scale : 0
        const srcY = pos?.scale ? pos.panY / pos.scale : 0
        const srcH = pos?.frameH ? pos.frameH / pos.scale : ih
        const panY = pos?.frameH ? (pos.panY / pos.frameH) * bodyH : 0
        const n = 120
        let sumWeight = 0
        for (let i = 0; i < n; i++) {
          const t = (i + 0.5) / n
          const theta = (t - 0.5) * Math.PI
          const w = 1 - Math.abs(Math.sin(theta))
          sumWeight += Math.max(0.01, w)
        }
        const srcW = iw / n
        let destX = cx - cylW / 2
        for (let i = 0; i < n; i++) {
          const t = (i + 0.5) / n
          const theta = (t - 0.5) * Math.PI
          const w = 1 - Math.abs(Math.sin(theta))
          const stripW = (cylW / sumWeight) * Math.max(0.01, w)
          let srcX = imgStartX + i * srcW
          while (srcX < 0) srcX += iw
          while (srcX >= iw) srcX -= iw
          const srcXClamped = Math.max(0, Math.min(iw - srcW, srcX))
          const srcYClamped = Math.max(0, Math.min(ih - srcH, srcY))
          ctx.drawImage(img, srcXClamped, srcYClamped, srcW, srcH, destX, bodyTop - panY, stripW, bodyH)
          destX += stripW
        }
        ctx.restore()
      } else {
        ctx.fillStyle = '#f8fafc'
        ctx.fillRect(cx - cylW / 2, bodyTop, cylW, bodyH)
        ctx.strokeStyle = '#cbd5e1'
        ctx.strokeRect(cx - cylW / 2, bodyTop, cylW, bodyH)
      }

      ctx.beginPath()
      ctx.ellipse(cx, cy + cylH / 2, cylW / 2, ellipseH, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()

      ctx.strokeStyle = '#64748b'
      ctx.lineWidth = 1
      const tickLen = 8
      ctx.beginPath()
      ctx.moveTo(cx - cylW / 2, bodyTop)
      ctx.lineTo(cx - cylW / 2 + tickLen, bodyTop)
      ctx.moveTo(cx - cylW / 2, bodyBottom)
      ctx.lineTo(cx - cylW / 2 + tickLen, bodyBottom)
      ctx.moveTo(cx + cylW / 2, bodyTop)
      ctx.lineTo(cx + cylW / 2 - tickLen, bodyTop)
      ctx.moveTo(cx + cylW / 2, bodyBottom)
      ctx.lineTo(cx + cylW / 2 - tickLen, bodyBottom)
      ctx.moveTo(cx - cylW / 2, bodyTop)
      ctx.lineTo(cx - cylW / 2, bodyTop + tickLen)
      ctx.moveTo(cx + cylW / 2, bodyTop)
      ctx.lineTo(cx + cylW / 2, bodyTop + tickLen)
      ctx.moveTo(cx - cylW / 2, bodyBottom)
      ctx.lineTo(cx - cylW / 2, bodyBottom - tickLen)
      ctx.moveTo(cx + cylW / 2, bodyBottom)
      ctx.lineTo(cx + cylW / 2, bodyBottom - tickLen)
      ctx.stroke()

      ctx.fillStyle = '#64748b'
      ctx.font = '12px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(`Ø ${dims.diameterMm} × H ${dims.heightMm} mm`, cx, h - 8)
    }

    let loadedImg: HTMLImageElement | null = null
    let cancelled = false

    if (labelImageUrl) {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        if (!cancelled) {
          loadedImg = img
          draw(img)
        }
      }
      img.onerror = () => {
        if (!cancelled) draw(null)
      }
      img.src = labelImageUrl
    } else {
      draw(null)
    }

    const ro = new ResizeObserver(() => draw(loadedImg))
    ro.observe(canvas)
    return () => {
      cancelled = true
      ro.disconnect()
    }
  }, [labelImageUrl, imagePosition, dims])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file?.type.startsWith('image/')) return
    const url = URL.createObjectURL(file)
    setLabelImageUrl(url)
    if (labelImageUrl) URL.revokeObjectURL(labelImageUrl)
  }

  const renderLabelToCanvas = (
    canvas: HTMLCanvasElement,
    pxPerMm: number
  ): Promise<void> => {
    const cw = Math.ceil(bounds.widthMm * pxPerMm)
    const ch = Math.ceil(bounds.heightMm * pxPerMm)
    canvas.width = cw
    canvas.height = ch
    const ctx = canvas.getContext('2d')
    if (!ctx) return Promise.resolve()

    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, cw, ch)

    if (labelImageUrl) {
      return new Promise((resolve) => {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => {
          const imgW = img.naturalWidth
          const imgH = img.naturalHeight
          const imgScale = Math.max(cw / imgW, ch / imgH)
          const scaledImgW = imgW * imgScale
          const scaledImgH = imgH * imgScale
          let offsetX = (scaledImgW - cw) / 2
          let offsetY = (scaledImgH - ch) / 2
          if (imagePosition && imagePosition.frameW > 0) {
            const { panX, panY, frameW, frameH } = imagePosition
            offsetX = panX * (cw / frameW)
            offsetY = panY * (ch / frameH)
          }
          ctx.drawImage(img, -offsetX, -offsetY, scaledImgW, scaledImgH)
          resolve()
        }
        img.onerror = () => resolve()
        img.src = labelImageUrl
      })
    }

    const svgEl = svgRef.current?.querySelector('svg')
    if (svgEl) {
      const svgStr = new XMLSerializer().serializeToString(svgEl)
      const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      return new Promise((resolve) => {
        const img = new Image()
        img.onload = () => {
          ctx.drawImage(img, 0, 0, cw, ch)
          URL.revokeObjectURL(url)
          resolve()
        }
        img.onerror = () => {
          URL.revokeObjectURL(url)
          resolve()
        }
        img.src = url
      })
    }
    return Promise.resolve()
  }

  const handleExportPng = async () => {
    const canvas = document.createElement('canvas')
    const pxPerMm = 2 * (96 / 25.4)
    await renderLabelToCanvas(canvas, pxPerMm)
    canvas.toBlob((b) => {
      if (!b) return
      const a = document.createElement('a')
      a.href = URL.createObjectURL(b)
      a.download = `cylinder-label-${dims.diameterMm}x${dims.heightMm}mm.png`
      a.click()
      URL.revokeObjectURL(a.href)
      toast({ title: tr('Đã tải PNG', 'PNG downloaded', 'PNG已下载', 'PNGをダウンロードしました', 'PNG 다운로드됨'), duration: 2000 })
    })
  }

  const handleExportPdf = async () => {
    const canvas = document.createElement('canvas')
    const pxPerMm = 300 / 25.4
    await renderLabelToCanvas(canvas, pxPerMm)
    const dataUrl = canvas.toDataURL('image/png')
    setPdfLoading(true)
    try {
      const result = await generateCylinderLabelPdf(dataUrl, Math.ceil(bounds.widthMm), Math.ceil(bounds.heightMm))
      if ('error' in result) {
        toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: result.error, variant: 'destructive' })
      } else {
        const a = document.createElement('a')
        a.href = result.pdfUrl
        a.download = `cylinder-label-${dims.diameterMm}x${dims.heightMm}mm.pdf`
        a.target = '_blank'
        a.click()
        toast({ title: tr('Đã tạo PDF chuẩn in.', 'Print-ready PDF created.', '已生成印刷用PDF。', '印刷用PDFを作成しました。', '인쇄용 PDF 생성됨.'), duration: 3000 })
      }
    } finally {
      setPdfLoading(false)
    }
  }

  const handleReset = () => {
    setDiameterInput(String(DEFAULT_DIMS.diameterMm))
    setHeightInput(String(DEFAULT_DIMS.heightMm))
    setImagePosition(null)
    if (labelImageUrl) {
      URL.revokeObjectURL(labelImageUrl)
      setLabelImageUrl(null)
    }
  }

  return (
    <>
      <Toaster />
      <div className="tool-page-container">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">
            {tr('Mockup nhãn chai / lon (cylinder wrap)', 'Bottle / can label mockup (cylinder wrap)', '瓶子/罐子标签样机（圆柱包装）', 'ボトル・缶ラベルモックアップ（シリンダーラップ）', '병/캔 라벨 목업 (실린더 랩)')}
          </h1>
          <p className="text-muted-foreground mt-1">
            {tr('Nhập đường kính và chiều cao mm. Tạo nhãn phẳng (chu vi = π×Ø). Tùy chọn tải ảnh. Xuất PNG, PDF chuẩn in.', 'Enter diameter and height in mm. Generate flat label (circumference = π×Ø). Optional image upload. Export PNG, print-ready PDF.', '输入直径和高度（毫米）。生成平面标签（周长=π×Ø）。可选上传图片。导出 PNG、印刷用 PDF。', '直径と高さ（mm）を入力。平面ラベル生成（円周=π×Ø）。画像アップロード可。PNG・印刷用PDFを出力。', '직경·높이(mm) 입력. 평면 라벨 생성(둘레=π×Ø). 이미지 업로드 선택. PNG, 인쇄용 PDF 다운로드.')}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="border shadow-sm bg-white/80 backdrop-blur border-sky-200/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Cylinder className="h-4 w-4 text-sky-600" />
                {tr('Thông số chai/lon', 'Bottle/can parameters', '瓶子/罐子参数', 'ボトル・缶パラメータ', '병/캔 파라미터')}
              </CardTitle>
              <CardDescription>
                {tr('Đường kính và chiều cao (mm).', 'Diameter and height in mm.', '直径和高度（毫米）。', '直径と高さ（mm）。', '직경·높이(mm).')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Ø (mm)</label>
                  <Input type="number" min={20} max={200} value={diameterInput} onChange={(e) => setDiameterInput(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">H (mm)</label>
                  <Input type="number" min={20} max={500} value={heightInput} onChange={(e) => setHeightInput(e.target.value)} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {tr('Kích thước nhãn:', 'Label size:', '标签尺寸:', 'ラベルサイズ:', '라벨 크기:')} {Math.ceil(bounds.widthMm)} × {Math.ceil(bounds.heightMm)} mm
              </p>
              <div>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                <Button variant="outline" size="sm" className="w-full gap-2" onClick={() => fileInputRef.current?.click()}>
                  <ImagePlus className="h-3 w-3" />
                  {labelImageUrl ? tr('Đổi ảnh nhãn', 'Change label image', '更换标签图', 'ラベル画像を変更', '라벨 이미지 변경') : tr('Tải ảnh nhãn', 'Upload label image', '上传标签图', 'ラベル画像をアップロード', '라벨 이미지 업로드')}
                </Button>
              </div>
              <Button variant="outline" size="sm" onClick={handleReset} className="w-full">
                {tr('Đặt lại', 'Reset', '重置', 'リセット', '초기화')}
              </Button>
            </CardContent>
          </Card>

          <div className="lg:col-span-2 space-y-4">
            <Card className="border shadow-sm bg-white overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{tr('Nhãn phẳng & Mockup 3D', 'Flat label & 3D mockup', '平面标签与3D样机', '平面ラベルと3Dモックアップ', '평면 라벨 및 3D 목업')}</CardTitle>
                <CardDescription>
                  {tr('Nhãn phẳng in trực tiếp. Chu vi = π × đường kính.', 'Flat label for direct printing. Circumference = π × diameter.', '平面标签直接印刷。周长=π×直径。', '平面ラベルを直接印刷。円周=π×直径。', '평면 라벨 직접 인쇄. 둘레=π×직경.')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">
                      {labelImageUrl
                        ? tr('Nhãn phẳng – kéo ảnh để định vị', 'Flat label – drag image to position', '平面标签 – 拖动图片定位', '平面ラベル – ドラッグで配置', '평면 라벨 – 드래그하여 위치 조정')
                        : tr('Nhãn phẳng (in)', 'Flat label (print)', '平面标签（印刷）', '平面ラベル（印刷）', '평면 라벨 (인쇄)')}
                    </p>
                    {labelImageUrl ? (
                      <DraggableLabelFrame
                        widthMm={bounds.widthMm}
                        heightMm={bounds.heightMm}
                        imageUrl={labelImageUrl}
                        onExportData={setImagePosition}
                        className="w-full min-h-[200px]"
                      />
                    ) : (
                      <div
                        ref={svgRef}
                        className="w-full overflow-auto bg-[repeating-conic-gradient(#e5e7eb_0%_25%,#f9fafb_0%_50%)] bg-[length:12px_12px] rounded-lg border p-4 flex items-center justify-center min-h-[200px]"
                        dangerouslySetInnerHTML={{ __html: svgContent }}
                      />
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">{tr('Mockup 3D', '3D mockup', '3D样机', '3Dモックアップ', '3D 목업')}</p>
                    <canvas ref={canvasRef} className="w-full rounded-lg border bg-slate-100 min-h-[200px]" style={{ aspectRatio: '4/3' }} />
                  </div>
                </div>
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
          {tr('Nhãn phù hợp in trên giấy decal, dán quanh chai/lon. Kiểm tra kích thước trước khi in.', 'Label suitable for printing on decal paper, wrap around bottle/can. Verify dimensions before printing.', '标签适合打印在贴纸上，包裹瓶子/罐子。印刷前请核对尺寸。', 'ラベルはデカール紙に印刷し、ボトル・缶に巻き付けます。印刷前にサイズを確認してください。', '라벨은 데칼지에 인쇄 후 병/캔에 감쌉니다. 인쇄 전 크기 확인하세요.')}
        </p>
      </div>
    </>
  )
}
