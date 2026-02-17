'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  createHouseProject,
  listHouseProjects,
  updateProjectName,
  deleteHouseProject,
  clearFloor3D,
  step1Build3D,
  type HouseInfo,
} from './actions'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'
import { Home, Sparkles, RefreshCw, Plus, FolderOpen, ChevronRight, Trash2, Check } from 'lucide-react'
import { DepositCreditButton } from '@/components/deposit-credit-button'
import { useCredits } from '@/hooks/use-credits'
import { ImagePreview } from '@/components/ui/image-preview'
import { DownloadImageButton } from '@/components/download-image-button'
import { ImageProcessingLoader } from '@/components/image-processing-loader'

const DESIGN_STYLES = [
  { value: 'hiện đại', label: 'Hiện đại' },
  { value: 'tân cổ điển', label: 'Tân cổ điển' },
  { value: 'nhà vườn', label: 'Nhà vườn' },
  { value: 'biệt thự', label: 'Biệt thự' },
  { value: 'pháp', label: 'Pháp' },
  { value: 'nhật bản', label: 'Nhật Bản' },
  { value: 'bắc âu', label: 'Bắc Âu (Scandinavian)' },
  { value: 'tối giản', label: 'Tối giản (Minimalist)' },
  { value: 'đương đại', label: 'Đương đại (Contemporary)' },
  { value: 'thuộc địa', label: 'Thuộc địa (Colonial)' },
  { value: 'địa trung hải', label: 'Địa Trung Hải' },
  { value: 'công nghiệp', label: 'Công nghiệp (Industrial)' },
  { value: 'xanh bền vững', label: 'Xanh bền vững (Eco)' },
  { value: 'nhà nông', label: 'Nhà nông (Farmhouse)' },
  { value: 'nhiệt đới', label: 'Nhiệt đới (Tropical)' },
  { value: 'art deco', label: 'Art Deco' },
  { value: 'victorian', label: 'Victorian' },
  { value: 'cổ điển châu âu', label: 'Cổ điển châu Âu' },
  { value: 'đông dương', label: 'Đông Dương' },
  { value: 'ba gian', label: 'Ba gian truyền thống' },
] as const

interface Project {
  id: string
  name: string
  house_info: HouseInfo | null
  steps: Record<string, { imageUrl?: string; approved?: boolean }>
  current_step: string
  updated_at: string
}

export default function XayNhaTuDatNenClientPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [projectName, setProjectName] = useState('')
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [generatingStep, setGeneratingStep] = useState<string | null>(null)

  const { toast } = useToast()
  const { checkCreditsAndProceed } = useCredits()

  useEffect(() => {
    listHouseProjects().then((r) => {
      if (r.success && r.projects) setProjects(r.projects as Project[])
      setLoading(false)
    })
  }, [])

  const selectedProject = projects.find((p) => p.id === selectedProjectId)
  const steps = selectedProject?.steps || {}
  const currentStep = selectedProject?.current_step || 'floor_3d'
  const houseInfo = selectedProject?.house_info
  const floor3dUrl = steps.floor_3d?.imageUrl

  const handleCreateProject = async () => {
    const r = await createHouseProject()
    if (r.error) toast({ title: 'Lỗi', description: r.error, variant: 'destructive' })
    else if (r.success && r.projectId) {
      setProjects((prev) => [...prev, { id: r.projectId!, name: 'Dự án mới', house_info: null, steps: {}, current_step: 'floor_3d', updated_at: new Date().toISOString() }])
      setSelectedProjectId(r.projectId)
      setProjectName('Dự án mới')
      toast({ title: 'Đã tạo dự án mới', duration: 2000 })
    }
  }

  const handleSaveProjectName = async () => {
    if (!selectedProjectId) return
    const r = await updateProjectName(selectedProjectId, projectName)
    if (r.success) {
      setProjects((prev) => prev.map((p) => (p.id === selectedProjectId ? { ...p, name: projectName || 'Dự án mới' } : p)))
      toast({ title: 'Đã lưu tên', duration: 2000 })
    }
  }

  const handleDeleteProject = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    if (!confirm('Bạn có chắc muốn xóa dự án này?')) return
    const r = await deleteHouseProject(id)
    if (r.error) toast({ title: 'Lỗi', description: r.error, variant: 'destructive' })
    else if (r.success) {
      setProjects((prev) => prev.filter((p) => p.id !== id))
      if (selectedProjectId === id) setSelectedProjectId(null)
      toast({ title: 'Đã xóa dự án', duration: 2000 })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-muted-foreground">Đang tải...</p>
      </div>
    )
  }

  return (
    <>
      <Toaster />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Nhà của bạn</h1>
            <p className="text-muted-foreground text-sm mt-1">Tạo mặt tiền nhà 3D. Mỗi lần tạo = dự án mới được lưu.</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleCreateProject} className="bg-sky-600 hover:bg-sky-700">
              <Plus className="mr-2 h-4 w-4" /> Dự án mới
            </Button>
            <DepositCreditButton variant="outline" size="sm" />
          </div>
        </div>

        {projects.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FolderOpen className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">Chưa có dự án nào</p>
              <Button onClick={handleCreateProject}>
                <Plus className="mr-2 h-4 w-4" /> Tạo dự án đầu tiên
              </Button>
            </CardContent>
          </Card>
        )}

        {projects.length > 0 && !selectedProjectId && (
          <Card>
            <CardHeader>
              <CardTitle>Chọn dự án</CardTitle>
              <CardDescription>Chọn dự án để tiếp tục hoặc tạo dự án mới</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {projects.map((p) => {
                  const thumbUrl = p.steps?.floor_3d?.imageUrl
                  return (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 p-3 rounded-lg border hover:bg-slate-50 transition-colors group"
                  >
                    <div className="w-14 h-14 shrink-0 rounded-md border bg-slate-100 overflow-hidden">
                      {thumbUrl ? (
                        <img src={thumbUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                          <Home className="h-6 w-6" />
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        setSelectedProjectId(p.id)
                        setProjectName(p.name)
                      }}
                      className="flex-1 flex items-center justify-between text-left min-w-0"
                    >
                      <span className="font-medium truncate">{p.name}</span>
                      <span className="text-xs text-muted-foreground shrink-0 ml-2">
                        {p.current_step === 'completed' ? 'Hoàn thành' : p.current_step.replace('_', ' ')}
                      </span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 ml-1" />
                    </button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={(e) => handleDeleteProject(p.id, e)}
                      title="Xóa dự án"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {selectedProjectId && selectedProject && (
          <StepWizard
            project={selectedProject}
            projectName={projectName}
            setProjectName={setProjectName}
            onSaveName={handleSaveProjectName}
            onBack={async () => {
              setSelectedProjectId(null)
              const r = await listHouseProjects()
              if (r.success && r.projects) setProjects(r.projects as Project[])
            }}
            onDelete={() => handleDeleteProject(selectedProjectId)}
            onProjectUpdate={async (newProjectId?: string) => {
              const r = await listHouseProjects()
              if (r.success && r.projects) {
                const list = r.projects as Project[]
                setProjects(list)
                if (newProjectId) {
                  setSelectedProjectId(newProjectId)
                  const p = list.find((x) => x.id === newProjectId)
                  if (p) setProjectName(p.name)
                }
              }
            }}
            checkCreditsAndProceed={checkCreditsAndProceed}
            generating={generating}
            setGenerating={setGenerating}
            generatingStep={generatingStep}
            setGeneratingStep={setGeneratingStep}
            toast={toast}
          />
        )}
      </div>
      <p className="text-xs text-muted-foreground text-center mt-6">Kết quả mang tính tham khảo. Cần tư vấn kỹ sư trước khi thi công.</p>
    </>
  )
}

function StepWizard({
  project,
  projectName,
  setProjectName,
  onSaveName,
  onBack,
  onDelete,
  onProjectUpdate,
  checkCreditsAndProceed,
  generating,
  setGenerating,
  generatingStep,
  setGeneratingStep,
  toast,
}: {
  project: Project
  projectName: string
  setProjectName: (v: string) => void
  onSaveName: () => void
  onBack: () => void
  onDelete: () => void
  onProjectUpdate: (newProjectId?: string) => void | Promise<void>
  checkCreditsAndProceed: (cost: number, fn: () => Promise<void>) => void
  generating: boolean
  setGenerating: (v: boolean) => void
  generatingStep: string | null
  setGeneratingStep: (v: string | null) => void
  toast: (opts: { title: string; description?: string; variant?: 'destructive'; duration?: number }) => void
}) {
  const { steps, current_step, house_info } = project

  const floor3dUrl = steps.floor_3d?.imageUrl

  const handleStep1 = async (formData: FormData) => {
    setGenerating(true)
    setGeneratingStep('floor_3d')
    const r = await step1Build3D(formData)
    setGenerating(false)
    setGeneratingStep(null)
    if (r.error) toast({ title: 'Lỗi', description: r.error, variant: 'destructive', duration: 5000 })
    else if (r.success && r.projectId) {
      toast({ title: 'Đã tạo ảnh 3D nhà. Dự án mới đã được lưu.', duration: 3000 })
      await onProjectUpdate(r.projectId)
    }
  }

  const handleClear3D = async () => {
    const r = await clearFloor3D(project.id)
    if (r.error) toast({ title: 'Lỗi', description: r.error, variant: 'destructive' })
    else if (r.success) {
      toast({ title: 'Đã quay lại form mặt tiền. Thông tin đã nhập được giữ nguyên.', duration: 2000 })
      onProjectUpdate()
    }
  }

  const isStep1 = current_step === 'floor_3d' || !floor3dUrl

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack}>
          ← Quay lại
        </Button>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Input
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            onBlur={onSaveName}
            className="max-w-[200px] font-medium"
            placeholder="Tên dự án"
          />
          <Button variant="ghost" size="sm" onClick={onSaveName} title="Lưu tên">
            <Check className="h-4 w-4" />
          </Button>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-destructive"
          onClick={onDelete}
          title="Xóa dự án"
        >
          <Trash2 className="h-4 w-4 mr-1" /> Xóa
        </Button>
      </div>

      {generating && (
        <Card>
          <CardContent className="py-12">
            <ImageProcessingLoader
              mode="interior"
              title={`Đang xử lý: ${generatingStep || '...'}`}
              description="AI đang tạo ảnh, vui lòng chờ"
            />
          </CardContent>
        </Card>
      )}

      {!generating && isStep1 && (
        <Step1Form
          key={project.id}
          houseInfo={house_info}
          floor3dUrl={floor3dUrl}
          onBuild={handleStep1}
          onGoBackToForm={handleClear3D}
          checkCreditsAndProceed={checkCreditsAndProceed}
          cost={4}
        />
      )}

    </div>
  )
}

function Step1Form({
  houseInfo,
  floor3dUrl,
  onBuild,
  onGoBackToForm,
  checkCreditsAndProceed,
  cost,
}: {
  houseInfo: HouseInfo | null
  floor3dUrl?: string
  onBuild: (fd: FormData) => Promise<void>
  onGoBackToForm: () => void
  checkCreditsAndProceed: (cost: number, fn: () => Promise<void>) => void
  cost: number
}) {
  const houseLength = houseInfo?.houseLength ?? (houseInfo as Record<string, unknown>)?.houseFacadeWidth ?? ''
  const houseDepth = houseInfo?.houseDepth ?? (houseInfo as Record<string, unknown>)?.landDepthM ?? ''
  const [houseLengthVal, setHouseLengthVal] = useState(houseLength || '')
  const [houseDepthVal, setHouseDepthVal] = useState(houseDepth || '')
  const [designStyle, setDesignStyle] = useState(houseInfo?.designStyle || 'hiện đại')
  const [floors, setFloors] = useState(houseInfo?.floors || '1')
  const [hasBalcony, setHasBalcony] = useState(houseInfo?.hasBalcony ?? false)
  const [mainDoors, setMainDoors] = useState(houseInfo?.mainDoors ?? (houseInfo as Record<string, unknown>)?.mainDoors ?? '1')
  const [hasReferenceImage, setHasReferenceImage] = useState(houseInfo?.hasReferenceImage ?? false)
  const [referenceFile, setReferenceFile] = useState<File | null>(null)

  const buildFormData = () => {
    const fd = new FormData()
    fd.append('houseLength', houseLengthVal)
    fd.append('houseDepth', houseDepthVal)
    fd.append('designStyle', designStyle)
    fd.append('floors', floors)
    fd.append('hasBalcony', String(hasBalcony))
    fd.append('mainDoors', mainDoors)
    fd.append('hasReferenceImage', String(hasReferenceImage))
    if (hasReferenceImage && referenceFile) fd.append('referenceImage', referenceFile)
    return fd
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bước 1: Thiết kế mặt tiền nhà</CardTitle>
        <CardDescription>Nhập kích thước nhà (mặt tiền + chiều còn lại), phong cách, số tầng. AI tự chọn sân vườn.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {floor3dUrl ? (
          <>
            <div className="aspect-video rounded-lg border overflow-hidden">
              <ImagePreview src={floor3dUrl} alt="3D" className="w-full h-full object-contain" />
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <DownloadImageButton imageUrl={floor3dUrl} filename="mat-tien-nha-3d" />
              <Button variant="outline" onClick={onGoBackToForm}>
                <RefreshCw className="mr-2 h-4 w-4" /> Tạo thiết kế khác
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Chiều dài mặt tiền nhà (m) *</label>
                <Input placeholder="VD: 15" value={houseLengthVal} onChange={(e) => setHouseLengthVal(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Kích thước còn lại (m)</label>
                <p className="text-xs text-muted-foreground mb-1">Không phải mặt tiền, thường là chiều sâu</p>
                <Input placeholder="VD: 20" value={houseDepthVal} onChange={(e) => setHouseDepthVal(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Phong cách thiết kế</label>
              <select
                value={designStyle}
                onChange={(e) => setDesignStyle(e.target.value)}
                className="w-full mt-1 h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
              >
                {DESIGN_STYLES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Số tầng</label>
              <Input value={floors} onChange={(e) => setFloors(e.target.value)} placeholder="1-5" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Số cửa chính</label>
              <Input value={mainDoors} onChange={(e) => setMainDoors(e.target.value)} placeholder="1" className="max-w-[80px]" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Ban công mặt tiền</label>
              <div className="flex gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => setHasBalcony(true)}
                  className={`px-2 py-1 rounded border text-xs ${hasBalcony ? 'border-sky-500 bg-sky-50' : ''}`}
                >
                  Có
                </button>
                <button
                  type="button"
                  onClick={() => setHasBalcony(false)}
                  className={`px-2 py-1 rounded border text-xs ${!hasBalcony ? 'border-sky-500 bg-sky-50' : ''}`}
                >
                  Không
                </button>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Ảnh gợi ý</label>
              <div className="flex flex-wrap gap-2 mt-1 items-center">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setHasReferenceImage(!hasReferenceImage)
                    if (hasReferenceImage) setReferenceFile(null)
                  }}
                  className={hasReferenceImage ? 'border-sky-500 bg-sky-50' : ''}
                >
                  {hasReferenceImage ? 'Đã chọn ảnh' : 'Chọn ảnh gợi ý'}
                </Button>
                {hasReferenceImage && (
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setReferenceFile(e.target.files?.[0] || null)}
                    className="max-w-[200px] text-xs"
                  />
                )}
              </div>
            </div>
            <Button
              onClick={() => checkCreditsAndProceed(cost, () => onBuild(buildFormData()))}
              disabled={!houseLengthVal.trim()}
              className="bg-sky-600 hover:bg-sky-700"
            >
              <Sparkles className="mr-2 h-4 w-4" /> Dựng mặt tiền nhà ({cost} credit)
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}

