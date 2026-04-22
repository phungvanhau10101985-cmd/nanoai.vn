'use client'

import { readWebLocaleFromDocumentCookie } from '@/lib/i18n/read-web-locale-cookie'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
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
type UiLocale = 'vi' | 'en' | 'zh' | 'ja' | 'ko'

function getWebLocaleFromCookie(): UiLocale {
  if (typeof document === 'undefined') return 'vi'
  const cookieValue = readWebLocaleFromDocumentCookie()
  if (cookieValue === 'en' || cookieValue === 'zh' || cookieValue === 'ja' || cookieValue === 'ko') return cookieValue
  return 'vi'
}

function tr(uiLocale: UiLocale, vi: string, en: string, zh: string, ja: string, ko: string): string {
  if (uiLocale === 'en') return en
  if (uiLocale === 'zh') return zh
  if (uiLocale === 'ja') return ja
  if (uiLocale === 'ko') return ko
  return vi
}

export default function XayNhaTuDatNenClientPage() {
  const [uiLocale, setUiLocale] = useState<UiLocale>('vi')
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [projectName, setProjectName] = useState('')
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [generatingStep, setGeneratingStep] = useState<string | null>(null)

  const { toast } = useToast()
  const { checkCreditsAndProceed } = useCredits()

  useEffect(() => {
    const syncLocale = () => setUiLocale(getWebLocaleFromCookie())
    syncLocale()
    const timer = window.setInterval(syncLocale, 1000)
    window.addEventListener('focus', syncLocale)
    document.addEventListener('visibilitychange', syncLocale)
    listHouseProjects().then((r) => {
      if (r.success && r.projects) setProjects(r.projects as Project[])
      setLoading(false)
    })
    return () => {
      window.removeEventListener('focus', syncLocale)
      document.removeEventListener('visibilitychange', syncLocale)
      window.clearInterval(timer)
    }
  }, [])

  const selectedProject = projects.find((p) => p.id === selectedProjectId)

  const handleCreateProject = async () => {
    const r = await createHouseProject()
    if (r.error) toast({ title: tr(uiLocale, 'Lỗi', 'Error', '错误', 'エラー', '오류'), description: r.error, variant: 'destructive' })
    else if (r.success && r.projectId) {
      setProjects((prev) => [...prev, { id: r.projectId!, name: tr(uiLocale, 'Dự án mới', 'New project', '新项目', '新規プロジェクト', '새 프로젝트'), house_info: null, steps: {}, current_step: 'floor_3d', updated_at: new Date().toISOString() }])
      setSelectedProjectId(r.projectId)
      setProjectName(tr(uiLocale, 'Dự án mới', 'New project', '新项目', '新規プロジェクト', '새 프로젝트'))
      toast({ title: tr(uiLocale, 'Đã tạo dự án mới', 'New project created', '已创建新项目', '新規プロジェクトを作成しました', '새 프로젝트를 생성했습니다'), duration: 2000 })
    }
  }

  const handleSaveProjectName = async () => {
    if (!selectedProjectId) return
    const r = await updateProjectName(selectedProjectId, projectName)
    if (r.success) {
      setProjects((prev) => prev.map((p) => (p.id === selectedProjectId ? { ...p, name: projectName || (uiLocale === 'vi' ? 'Dự án mới' : uiLocale === 'en' ? 'New project' : uiLocale === 'zh' ? '新项目' : uiLocale === 'ja' ? '新規プロジェクト' : '새 프로젝트') } : p)))
      toast({ title: uiLocale === 'vi' ? 'Đã lưu tên' : uiLocale === 'en' ? 'Name saved' : uiLocale === 'zh' ? '名称已保存' : uiLocale === 'ja' ? '名前を保存しました' : '이름이 저장되었습니다', duration: 2000 })
    }
  }

  const handleDeleteProject = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    if (!confirm(uiLocale === 'vi' ? 'Bạn có chắc muốn xóa dự án này?' : uiLocale === 'en' ? 'Are you sure you want to delete this project?' : uiLocale === 'zh' ? '确定要删除此项目吗？' : uiLocale === 'ja' ? 'このプロジェクトを削除しますか？' : '이 프로젝트를 삭제하시겠습니까?')) return
    const r = await deleteHouseProject(id)
    if (r.error) toast({ title: uiLocale === 'vi' ? 'Lỗi' : uiLocale === 'en' ? 'Error' : uiLocale === 'zh' ? '错误' : uiLocale === 'ja' ? 'エラー' : '오류', description: r.error, variant: 'destructive' })
    else if (r.success) {
      setProjects((prev) => prev.filter((p) => p.id !== id))
      if (selectedProjectId === id) setSelectedProjectId(null)
      toast({ title: uiLocale === 'vi' ? 'Đã xóa dự án' : uiLocale === 'en' ? 'Project deleted' : uiLocale === 'zh' ? '项目已删除' : uiLocale === 'ja' ? 'プロジェクトを削除しました' : '프로젝트가 삭제되었습니다', duration: 2000 })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-muted-foreground">{uiLocale === 'vi' ? 'Đang tải...' : uiLocale === 'en' ? 'Loading...' : uiLocale === 'zh' ? '加载中...' : uiLocale === 'ja' ? '読み込み中...' : '불러오는 중...'}</p>
      </div>
    )
  }

  return (
    <>
      <Toaster />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{uiLocale === 'vi' ? 'Nhà của bạn' : uiLocale === 'en' ? 'Your House' : uiLocale === 'zh' ? '你的房屋' : uiLocale === 'ja' ? 'あなたの家' : '내 집'}</h1>
            <p className="text-muted-foreground text-sm mt-1">{uiLocale === 'vi' ? 'Tạo mặt tiền nhà 3D. Mỗi lần tạo = dự án mới được lưu.' : uiLocale === 'en' ? 'Create 3D house facade. Each generation is saved as a new project.' : uiLocale === 'zh' ? '生成 3D 房屋立面。每次生成都会保存为新项目。' : uiLocale === 'ja' ? '3Dの外観を作成。生成ごとに新規プロジェクトとして保存されます。' : '3D 주택 외관 생성. 생성할 때마다 새 프로젝트로 저장됩니다.'}</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleCreateProject} className="bg-sky-600 hover:bg-sky-700">
              <Plus className="mr-2 h-4 w-4" /> {tr(uiLocale, 'Dự án mới', 'New project', '新项目', '新規プロジェクト', '새 프로젝트')}
            </Button>
            <DepositCreditButton variant="outline" size="sm" />
          </div>
        </div>

        {projects.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FolderOpen className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">{tr(uiLocale, 'Chưa có dự án nào', 'No projects yet', '暂无项目', 'プロジェクトがありません', '프로젝트가 없습니다')}</p>
              <Button onClick={handleCreateProject}>
                <Plus className="mr-2 h-4 w-4" /> {tr(uiLocale, 'Tạo dự án đầu tiên', 'Create first project', '创建第一个项目', '最初のプロジェクトを作成', '첫 프로젝트 만들기')}
              </Button>
            </CardContent>
          </Card>
        )}

        {projects.length > 0 && !selectedProjectId && (
          <Card>
            <CardHeader>
              <CardTitle>{uiLocale === 'vi' ? 'Chọn dự án' : uiLocale === 'en' ? 'Select project' : uiLocale === 'zh' ? '选择项目' : uiLocale === 'ja' ? 'プロジェクトを選択' : '프로젝트 선택'}</CardTitle>
              <CardDescription>{uiLocale === 'vi' ? 'Chọn dự án để tiếp tục hoặc tạo dự án mới' : uiLocale === 'en' ? 'Select a project to continue or create new one' : uiLocale === 'zh' ? '选择项目继续，或创建新项目' : uiLocale === 'ja' ? '続行するプロジェクトを選択、または新規作成' : '계속할 프로젝트를 선택하거나 새로 생성하세요'}</CardDescription>
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
                        /* eslint-disable-next-line @next/next/no-img-element -- project thumbnail URL from saved result */
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
                        {p.current_step === 'completed' ? (uiLocale === 'vi' ? 'Hoàn thành' : uiLocale === 'en' ? 'Completed' : uiLocale === 'zh' ? '已完成' : uiLocale === 'ja' ? '完了' : '완료') : p.current_step.replace('_', ' ')}
                      </span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 ml-1" />
                    </button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={(e) => handleDeleteProject(p.id, e)}
                      title={uiLocale === 'vi' ? 'Xóa dự án' : uiLocale === 'en' ? 'Delete project' : uiLocale === 'zh' ? '删除项目' : uiLocale === 'ja' ? 'プロジェクト削除' : '프로젝트 삭제'}
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
            uiLocale={uiLocale}
            tr={tr}
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
      <p className="text-xs text-muted-foreground text-center mt-6">{uiLocale === 'vi' ? 'Kết quả mang tính tham khảo. Cần tư vấn kỹ sư trước khi thi công.' : uiLocale === 'en' ? 'Results are for reference only. Consult an engineer before construction.' : uiLocale === 'zh' ? '结果仅供参考，施工前请咨询工程师。' : uiLocale === 'ja' ? '結果は参考用です。施工前に専門家へ相談してください。' : '결과는 참고용입니다. 시공 전 전문가와 상담하세요.'}</p>
    </>
  )
}

function StepWizard({
  uiLocale,
  tr,
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
  uiLocale: UiLocale
  tr: (l: UiLocale, vi: string, en: string, zh: string, ja: string, ko: string) => string
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
    if (r.error) toast({ title: tr(uiLocale, 'Lỗi', 'Error', '错误', 'エラー', '오류'), description: r.error, variant: 'destructive', duration: 5000 })
    else if (r.success && r.projectId) {
      toast({ title: tr(uiLocale, 'Đã tạo ảnh 3D nhà. Dự án mới đã được lưu.', '3D house image created. New project saved.', '已创建 3D 房屋图。新项目已保存。', '3D家の画像を作成しました。新規プロジェクトを保存しました。', '3D 주택 이미지 생성됨. 새 프로젝트 저장됨.'), duration: 3000 })
      await onProjectUpdate(r.projectId)
    }
  }

  const handleClear3D = async () => {
    const r = await clearFloor3D(project.id)
    if (r.error) toast({ title: tr(uiLocale, 'Lỗi', 'Error', '错误', 'エラー', '오류'), description: r.error, variant: 'destructive' })
    else if (r.success) {
      toast({ title: tr(uiLocale, 'Đã quay lại form mặt tiền. Thông tin đã nhập được giữ nguyên.', 'Returned to facade form. Entered info preserved.', '已返回立面表单。已输入信息已保留。', '外観フォームに戻りました。入力情報は保持されています。', '외관 폼으로 돌아갔습니다. 입력 정보가 유지됩니다.'), duration: 2000 })
      onProjectUpdate()
    }
  }

  const isStep1 = current_step === 'floor_3d' || !floor3dUrl

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack}>
          ← {tr(uiLocale, 'Quay lại', 'Back', '返回', '戻る', '뒤로')}
        </Button>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Input
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            onBlur={onSaveName}
            className="max-w-[200px] font-medium"
            placeholder={tr(uiLocale, 'Tên dự án', 'Project name', '项目名称', 'プロジェクト名', '프로젝트 이름')}
          />
          <Button variant="ghost" size="sm" onClick={onSaveName} title={tr(uiLocale, 'Lưu tên', 'Save name', '保存名称', '名前を保存', '이름 저장')}>
            <Check className="h-4 w-4" />
          </Button>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-destructive"
          onClick={onDelete}
          title={tr(uiLocale, 'Xóa dự án', 'Delete project', '删除项目', 'プロジェクト削除', '프로젝트 삭제')}
        >
          <Trash2 className="h-4 w-4 mr-1" /> {tr(uiLocale, 'Xóa', 'Delete', '删除', '削除', '삭제')}
        </Button>
      </div>

      {generating && (
        <Card>
          <CardContent className="py-12">
            <ImageProcessingLoader
              mode="interior"
              title={`${tr(uiLocale, 'Đang xử lý', 'Processing', '处理中', '処理中', '처리 중')}: ${generatingStep || '...'}`}
              description={tr(uiLocale, 'AI đang tạo ảnh, vui lòng chờ', 'AI is generating image, please wait', 'AI 正在生成图片，请稍候', 'AIが画像を生成しています。お待ちください', 'AI가 이미지를 생성 중입니다. 잠시만 기다려 주세요')}
            />
          </CardContent>
        </Card>
      )}

      {!generating && isStep1 && (
        <Step1Form
          key={project.id}
          uiLocale={uiLocale}
          tr={tr}
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
  uiLocale,
  tr,
  houseInfo,
  floor3dUrl,
  onBuild,
  onGoBackToForm,
  checkCreditsAndProceed,
  cost,
}: {
  uiLocale: UiLocale
  tr: (l: UiLocale, vi: string, en: string, zh: string, ja: string, ko: string) => string
  houseInfo: HouseInfo | null
  floor3dUrl?: string
  onBuild: (fd: FormData) => Promise<void>
  onGoBackToForm: () => void
  checkCreditsAndProceed: (cost: number, fn: () => Promise<void>) => void
  cost: number
}) {
  const houseLength = houseInfo?.houseLength ?? houseInfo?.houseFacadeWidth ?? ''
  const houseDepth = houseInfo?.houseDepth ?? houseInfo?.landDepthM ?? ''
  const [houseLengthVal, setHouseLengthVal] = useState(houseLength || '')
  const [houseDepthVal, setHouseDepthVal] = useState(houseDepth || '')
  const [designStyle, setDesignStyle] = useState(houseInfo?.designStyle || 'hiện đại')
  const [floors, setFloors] = useState(houseInfo?.floors || '1')
  const [hasBalcony, setHasBalcony] = useState(houseInfo?.hasBalcony ?? false)
  const [mainDoors, setMainDoors] = useState(houseInfo?.mainDoors ?? '1')
  const [hasReferenceImage, setHasReferenceImage] = useState(houseInfo?.hasReferenceImage ?? false)
  const [referenceFile, setReferenceFile] = useState<File | null>(null)

  const buildFormData = () => {
    const fd = new FormData()
    fd.append('houseLength', String(houseLengthVal))
    fd.append('houseDepth', String(houseDepthVal))
    fd.append('designStyle', String(designStyle))
    fd.append('floors', String(floors))
    fd.append('hasBalcony', String(hasBalcony))
    fd.append('mainDoors', String(mainDoors))
    fd.append('hasReferenceImage', String(hasReferenceImage))
    if (hasReferenceImage && referenceFile) fd.append('referenceImage', referenceFile)
    return fd
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{tr(uiLocale, 'Bước 1: Thiết kế mặt tiền nhà', 'Step 1: House facade design', '步骤 1：房屋立面设计', 'ステップ1：外観デザイン', '1단계: 주택 외관 설계')}</CardTitle>
        <CardDescription>{tr(uiLocale, 'Nhập kích thước nhà (mặt tiền + chiều còn lại), phong cách, số tầng. AI tự chọn sân vườn.', 'Enter house size (facade + depth), style, floors. AI selects garden.', '输入房屋尺寸（立面+进深）、风格、层数。AI 自动选择花园。', '家のサイズ（外観+奥行き）、スタイル、階数を入力。AIが庭を選択。', '주택 크기(외관+깊이), 스타일, 층수 입력. AI가 정원 선택.')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {floor3dUrl ? (
          <>
            <div className="aspect-video rounded-lg border overflow-hidden">
              <ImagePreview src={floor3dUrl} alt="3D" className="w-full h-full object-contain" />
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <DownloadImageButton
              imageUrl={floor3dUrl}
              filename="mat-tien-nha-3d"
              printReady
              printReadyInferFromImage
            />
              <Button variant="outline" onClick={onGoBackToForm}>
                <RefreshCw className="mr-2 h-4 w-4" /> {tr(uiLocale, 'Tạo thiết kế khác', 'Create another design', '创建其他设计', '別のデザインを作成', '다른 디자인 만들기')}
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground">{tr(uiLocale, 'Chiều dài mặt tiền nhà (m) *', 'Facade length (m) *', '立面长度 (m) *', '外観幅 (m) *', '외관 길이 (m) *')}</label>
                <Input placeholder="VD: 15" value={houseLengthVal} onChange={(e) => setHouseLengthVal(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">{tr(uiLocale, 'Kích thước còn lại (m)', 'Remaining dimension (m)', '其余尺寸 (m)', '残り寸法 (m)', '나머지 치수 (m)')}</label>
                <p className="text-xs text-muted-foreground mb-1">{tr(uiLocale, 'Không phải mặt tiền, thường là chiều sâu', 'Not facade, usually depth', '非立面，通常为进深', '外観以外、通常は奥行き', '외관 아님, 보통 깊이')}</p>
                <Input placeholder="VD: 20" value={houseDepthVal} onChange={(e) => setHouseDepthVal(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">{tr(uiLocale, 'Phong cách thiết kế', 'Design style', '设计风格', 'デザインスタイル', '디자인 스타일')}</label>
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
              <label className="text-xs font-medium text-muted-foreground">{tr(uiLocale, 'Số tầng', 'Floors', '层数', '階数', '층수')}</label>
              <Input value={floors} onChange={(e) => setFloors(e.target.value)} placeholder="1-5" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">{tr(uiLocale, 'Số cửa chính', 'Main doors', '主门数量', '玄関の数', '현관문 수')}</label>
              <Input value={mainDoors} onChange={(e) => setMainDoors(e.target.value)} placeholder="1" className="max-w-[80px]" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">{tr(uiLocale, 'Ban công mặt tiền', 'Facade balcony', '立面阳台', '外観バルコニー', '외관 발코니')}</label>
              <div className="flex gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => setHasBalcony(true)}
                  className={`px-2 py-1 rounded border text-xs ${hasBalcony ? 'border-sky-500 bg-sky-50' : ''}`}
                >
                  {tr(uiLocale, 'Có', 'Yes', '有', 'あり', '있음')}
                </button>
                <button
                  type="button"
                  onClick={() => setHasBalcony(false)}
                  className={`px-2 py-1 rounded border text-xs ${!hasBalcony ? 'border-sky-500 bg-sky-50' : ''}`}
                >
                  {tr(uiLocale, 'Không', 'No', '无', 'なし', '없음')}
                </button>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">{tr(uiLocale, 'Ảnh gợi ý', 'Reference image', '参考图片', '参考画像', '참고 이미지')}</label>
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
                  {hasReferenceImage ? tr(uiLocale, 'Đã chọn ảnh', 'Image selected', '已选图片', '画像選択済み', '이미지 선택됨') : tr(uiLocale, 'Chọn ảnh gợi ý', 'Select reference image', '选择参考图片', '参考画像を選択', '참고 이미지 선택')}
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
              <Sparkles className="mr-2 h-4 w-4" /> {tr(uiLocale, 'Dựng mặt tiền nhà', 'Build house facade', '生成房屋立面', '外観を生成', '주택 외관 생성')} ({cost} credit)
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}

