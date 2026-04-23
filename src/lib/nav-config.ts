/**
 * Cấu hình điều hướng - đồng bộ giữa Header, MobileNav, Dashboard
 */
import type { ComponentType } from 'react'
import {
  Monitor,
  NotebookPen,
  Users,
} from 'lucide-react'
import { TryOnIcon } from '@/components/icons/try-on-icon'
import { ImageRestorationIcon } from '@/components/icons/image-restoration-icon'
import { LamNetAnhIcon } from '@/components/icons/lam-net-anh-icon'
import { LamDepAnhIcon } from '@/components/icons/lam-dep-anh-icon'
import { GhepAnhIcon } from '@/components/icons/ghep-anh-icon'
import { XoaVatTheIcon } from '@/components/icons/xoa-vat-the-icon'
import { ThayNenSanPhamIcon } from '@/components/icons/thay-nen-san-pham-icon'
import { MoRongKhungHinhIcon } from '@/components/icons/mo-rong-khung-hinh-icon'
import { HoanDoiKhuonMatIcon } from '@/components/icons/hoan-doi-khuon-mat-icon'
import { TaoBannerIcon } from '@/components/icons/tao-banner-icon'
import { TaoAnhTheIcon } from '@/components/icons/tao-anh-the-icon'
import { ThietKeLogoIcon } from '@/components/icons/thiet-ke-logo-icon'
import { KeChuyenBangHinhAnhIcon } from '@/components/icons/ke-chuyen-bang-hinh-anh-icon'
import { TaoNhanGianIcon } from '@/components/icons/tao-nhan-gian-icon'
import { TaoNhanGioiThieuSanPhamIcon } from '@/components/icons/tao-nhan-gioi-thieu-san-pham-icon'
import { TaoMaVachIcon } from '@/components/icons/tao-ma-vach-icon'
import { CheAnhIcon } from '@/components/icons/che-anh-icon'
import { TaoAnh3DIcon } from '@/components/icons/tao-anh-3d-icon'
import { TaoMoHinh3DTuAnhIcon } from '@/components/icons/tao-mo-hinh-3d-tu-anh-icon'
import { ThietKeNoiNgoaiThatIcon } from '@/components/icons/thiet-ke-noi-ngoai-that-icon'
import { XayNhaTuDatNenIcon } from '@/components/icons/xay-nha-tu-dat-nen-icon'
import { TaoAnhChanDungIcon } from '@/components/icons/tao-anh-chain-dung-icon'
import { MyCurriculaIcon } from '@/components/icons/my-curricula-icon'
import { AiLanguageLearningIcon } from '@/components/icons/ai-language-learning-icon'
import { MeetingRecorderReportIcon } from '@/components/icons/meeting-recorder-report-icon'
import { DichAnhTaiLieuIcon } from '@/components/icons/dich-anh-tai-lieu-icon'
import { InfographicFromBookIcon } from '@/components/icons/infographic-from-book-icon'
import { TaoAnhTuChuIcon } from '@/components/icons/tao-anh-tu-chu-icon'
import { DuAnhTuPhacThaoIcon } from '@/components/icons/du-anh-tu-phac-thao-icon'
import { TaoTemNiemPhongBaoHanhIcon } from '@/components/icons/tao-tem-niem-phong-bao-hanh-icon'
import { ThietKeConDauIcon } from '@/components/icons/thiet-ke-con-dau-icon'
import { ThietKeBaoBiIcon } from '@/components/icons/thiet-ke-bao-bi-icon'
import { TaoBaiHatLyria3Icon } from '@/components/icons/tao-bai-hat-lyria-3-icon'
import { XoaNenPngIcon } from '@/components/icons/xoa-nen-png-icon'
import { SuaAnhTheoYeuCauIcon } from '@/components/icons/sua-anh-theo-yeu-cau-icon'
import type { NavGroupKey, ToolKey } from '@/lib/i18n/dictionaries'

export type NavIcon = ComponentType<{ className?: string }>

/** Mục con bên trong một ô lớn (vd: Lớp học nằm trong Tạo giáo trình). */
export type NavGroupSubLink = {
  href: string
  labelKey: ToolKey
  icon: NavIcon
}

export type NavGroupLinkItem = {
  href: string
  labelKey: ToolKey
  icon: NavIcon
  subLinks?: readonly NavGroupSubLink[]
  /** false = không hiển thị ô riêng trên trang chủ (vẫn có trong menu/dashboard). */
  showOnHomepage?: boolean
}

export type NavGroupConfig = {
  titleKey: NavGroupKey
  links: readonly NavGroupLinkItem[]
}

export const AI_TOOLS = [
  { href: '/thu-do-online', labelKey: 'try_on' as ToolKey, icon: TryOnIcon },
  { href: '/tao-giao-trinh', labelKey: 'create_curriculum' as ToolKey, icon: MyCurriculaIcon },
  { href: '/giao-trinh', labelKey: 'my_curricula' as ToolKey, icon: MyCurriculaIcon },
  { href: '/tao-bai-thi', labelKey: 'online_exam' as ToolKey, icon: Monitor },
  { href: '/tao-bai-tap-ve-nha', labelKey: 'homework_online' as ToolKey, icon: NotebookPen },
  { href: '/lop', labelKey: 'classes' as ToolKey, icon: Users },
  { href: '/hoc-tieng-anh-ai', labelKey: 'ai_language_learning' as ToolKey, icon: AiLanguageLearningIcon },
  { href: '/ghi-am-bao-cao-cuoc-hop', labelKey: 'meeting_recorder_report' as ToolKey, icon: MeetingRecorderReportIcon },
  { href: '/tao-infographic-tu-sach', labelKey: 'infographic_from_book' as ToolKey, icon: InfographicFromBookIcon },
  { href: '/ke-chuyen-bang-hinh-anh', labelKey: 'story_with_images' as ToolKey, icon: KeChuyenBangHinhAnhIcon },
  { href: '/dich-anh-tai-lieu', labelKey: 'translate_document_image' as ToolKey, icon: DichAnhTaiLieuIcon },
  { href: '/phuc-dung-anh', labelKey: 'restore_image' as ToolKey, icon: ImageRestorationIcon },
  { href: '/lam-net-anh', labelKey: 'enhance_image' as ToolKey, icon: LamNetAnhIcon },
  { href: '/lam-dep-anh', labelKey: 'beautify_image' as ToolKey, icon: LamDepAnhIcon },
  { href: '/ghep-anh', labelKey: 'merge_image' as ToolKey, icon: GhepAnhIcon },
  { href: '/tao-banner', labelKey: 'create_banner' as ToolKey, icon: TaoBannerIcon },
  { href: '/tao-anh-tu-chu', labelKey: 'text_to_image' as ToolKey, icon: TaoAnhTuChuIcon },
  { href: '/du-anh-tu-phac-thao', labelKey: 'sketch_to_image' as ToolKey, icon: DuAnhTuPhacThaoIcon },
  { href: '/tao-anh-the', labelKey: 'create_id_photo' as ToolKey, icon: TaoAnhTheIcon },
  { href: '/thiet-ke-logo', labelKey: 'design_logo' as ToolKey, icon: ThietKeLogoIcon },
  { href: '/tao-nhan-gian', labelKey: 'create_sticker' as ToolKey, icon: TaoNhanGianIcon },
  { href: '/tao-nhan-gioi-thieu-san-pham', labelKey: 'create_product_label' as ToolKey, icon: TaoNhanGioiThieuSanPhamIcon },
  { href: '/tao-tem-niem-phong-bao-hanh', labelKey: 'create_seal_warranty_label' as ToolKey, icon: TaoTemNiemPhongBaoHanhIcon },
  { href: '/thiet-ke-con-dau', labelKey: 'design_stamp' as ToolKey, icon: ThietKeConDauIcon },
  { href: '/thiet-ke-bao-bi', labelKey: 'design_package' as ToolKey, icon: ThietKeBaoBiIcon },
  { href: '/tao-ma-vach', labelKey: 'create_barcode' as ToolKey, icon: TaoMaVachIcon },
  { href: '/che-anh', labelKey: 'meme_maker' as ToolKey, icon: CheAnhIcon },
  { href: '/xoa-vat-the', labelKey: 'remove_object' as ToolKey, icon: XoaVatTheIcon },
  { href: '/xoa-nen-png', labelKey: 'remove_bg_png' as ToolKey, icon: XoaNenPngIcon },
  { href: '/thay-nen-san-pham', labelKey: 'replace_product_bg' as ToolKey, icon: ThayNenSanPhamIcon },
  { href: '/sua-anh-theo-yeu-cau', labelKey: 'edit_image_by_request' as ToolKey, icon: SuaAnhTheoYeuCauIcon },
  { href: '/tao-anh-3d', labelKey: 'product_3d_sample' as ToolKey, icon: TaoAnh3DIcon },
  { href: '/tao-mo-hinh-3d-tu-anh', labelKey: 'model_3d_from_image' as ToolKey, icon: TaoMoHinh3DTuAnhIcon },
  { href: '/thiet-ke-noi-ngoai-that', labelKey: 'interior_exterior' as ToolKey, icon: ThietKeNoiNgoaiThatIcon },
  { href: '/xay-nha-tu-dat-nen', labelKey: 'my_house' as ToolKey, icon: XayNhaTuDatNenIcon },
  { href: '/tao-anh-chain-dung', labelKey: 'portrait_photo' as ToolKey, icon: TaoAnhChanDungIcon },
  { href: '/mo-rong-khung-hinh', labelKey: 'expand_frame' as ToolKey, icon: MoRongKhungHinhIcon },
  { href: '/hoan-doi-khuon-mat', labelKey: 'face_swap' as ToolKey, icon: HoanDoiKhuonMatIcon },
  { href: '/tao-bai-hat-lyria-3', labelKey: 'lyria3_instrumental_song' as ToolKey, icon: TaoBaiHatLyria3Icon },
] as const

export const NAV_GROUPS: readonly NavGroupConfig[] = [
  {
    titleKey: 'try_on' as NavGroupKey,
    links: [
      { href: '/thu-do-online/1-nguoi', labelKey: 'try_on_1' as ToolKey, icon: TryOnIcon },
      { href: '/thu-do-online/2-nguoi', labelKey: 'try_on_2' as ToolKey, icon: TryOnIcon },
      { href: '/thu-do-online/3-nguoi', labelKey: 'try_on_3' as ToolKey, icon: TryOnIcon },
      { href: '/thu-do-online/4-nguoi', labelKey: 'try_on_4' as ToolKey, icon: TryOnIcon },
      { href: '/thu-do-online/5-nguoi', labelKey: 'try_on_5' as ToolKey, icon: TryOnIcon },
    ],
  },
  {
    titleKey: 'education' as NavGroupKey,
    links: [
      { href: '/tao-giao-trinh', labelKey: 'create_curriculum' as ToolKey, icon: MyCurriculaIcon },
      {
        href: '/giao-trinh',
        labelKey: 'my_curricula' as ToolKey,
        icon: MyCurriculaIcon,
        showOnHomepage: false,
      },
      {
        href: '/tao-bai-thi',
        labelKey: 'online_exam' as ToolKey,
        icon: Monitor,
        showOnHomepage: false,
      },
      {
        href: '/tao-bai-tap-ve-nha',
        labelKey: 'homework_online' as ToolKey,
        icon: NotebookPen,
        showOnHomepage: false,
      },
      {
        href: '/lop',
        labelKey: 'classes' as ToolKey,
        icon: Users,
        showOnHomepage: false,
      },
      { href: '/hoc-tieng-anh-ai', labelKey: 'ai_language_learning' as ToolKey, icon: AiLanguageLearningIcon },
      { href: '/ghi-am-bao-cao-cuoc-hop', labelKey: 'meeting_recorder_report' as ToolKey, icon: MeetingRecorderReportIcon },
      { href: '/tao-infographic-tu-sach', labelKey: 'infographic_from_book' as ToolKey, icon: InfographicFromBookIcon },
      { href: '/ke-chuyen-bang-hinh-anh', labelKey: 'story_with_images' as ToolKey, icon: KeChuyenBangHinhAnhIcon },
      { href: '/dich-anh-tai-lieu', labelKey: 'translate_document_image' as ToolKey, icon: DichAnhTaiLieuIcon },
    ],
  },
  {
    titleKey: 'image_edit' as NavGroupKey,
    links: [
      { href: '/phuc-dung-anh', labelKey: 'restore_image' as ToolKey, icon: ImageRestorationIcon },
      { href: '/lam-net-anh', labelKey: 'enhance_image' as ToolKey, icon: LamNetAnhIcon },
      { href: '/lam-dep-anh', labelKey: 'beautify_image' as ToolKey, icon: LamDepAnhIcon },
      { href: '/ghep-anh', labelKey: 'merge_image' as ToolKey, icon: GhepAnhIcon },
      { href: '/xoa-vat-the', labelKey: 'remove_object' as ToolKey, icon: XoaVatTheIcon },
      { href: '/xoa-nen-png', labelKey: 'remove_bg_png' as ToolKey, icon: XoaNenPngIcon },
      { href: '/thay-nen-san-pham', labelKey: 'replace_product_bg' as ToolKey, icon: ThayNenSanPhamIcon },
      { href: '/sua-anh-theo-yeu-cau', labelKey: 'edit_image_by_request' as ToolKey, icon: SuaAnhTheoYeuCauIcon },
      { href: '/mo-rong-khung-hinh', labelKey: 'expand_frame' as ToolKey, icon: MoRongKhungHinhIcon },
      { href: '/hoan-doi-khuon-mat', labelKey: 'face_swap' as ToolKey, icon: HoanDoiKhuonMatIcon },
    ],
  },
  {
    titleKey: 'design_creative' as NavGroupKey,
    links: [
      { href: '/tao-banner', labelKey: 'create_banner' as ToolKey, icon: TaoBannerIcon },
      { href: '/tao-anh-tu-chu', labelKey: 'text_to_image' as ToolKey, icon: TaoAnhTuChuIcon },
      { href: '/du-anh-tu-phac-thao', labelKey: 'sketch_to_image' as ToolKey, icon: DuAnhTuPhacThaoIcon },
      { href: '/tao-anh-the', labelKey: 'create_id_photo' as ToolKey, icon: TaoAnhTheIcon },
      { href: '/thiet-ke-logo', labelKey: 'design_logo' as ToolKey, icon: ThietKeLogoIcon },
      { href: '/tao-nhan-gian', labelKey: 'create_sticker' as ToolKey, icon: TaoNhanGianIcon },
      { href: '/tao-nhan-gioi-thieu-san-pham', labelKey: 'create_product_label' as ToolKey, icon: TaoNhanGioiThieuSanPhamIcon },
      { href: '/tao-tem-niem-phong-bao-hanh', labelKey: 'create_seal_warranty_label' as ToolKey, icon: TaoTemNiemPhongBaoHanhIcon },
      { href: '/thiet-ke-con-dau', labelKey: 'design_stamp' as ToolKey, icon: ThietKeConDauIcon },
      { href: '/thiet-ke-bao-bi', labelKey: 'design_package' as ToolKey, icon: ThietKeBaoBiIcon },
      { href: '/tao-ma-vach', labelKey: 'create_barcode' as ToolKey, icon: TaoMaVachIcon },
      { href: '/che-anh', labelKey: 'meme_maker' as ToolKey, icon: CheAnhIcon },
    ],
  },
  {
    titleKey: 'three_d_special' as NavGroupKey,
    links: [
      { href: '/tao-anh-3d', labelKey: 'product_3d_sample' as ToolKey, icon: TaoAnh3DIcon },
      { href: '/tao-mo-hinh-3d-tu-anh', labelKey: 'model_3d_from_image' as ToolKey, icon: TaoMoHinh3DTuAnhIcon },
      { href: '/thiet-ke-noi-ngoai-that', labelKey: 'interior_exterior' as ToolKey, icon: ThietKeNoiNgoaiThatIcon },
      { href: '/xay-nha-tu-dat-nen', labelKey: 'my_house' as ToolKey, icon: XayNhaTuDatNenIcon },
      { href: '/tao-anh-chain-dung', labelKey: 'portrait_photo' as ToolKey, icon: TaoAnhChanDungIcon },
    ],
  },
  {
    titleKey: 'music_ai' as NavGroupKey,
    links: [{ href: '/tao-bai-hat-lyria-3', labelKey: 'lyria3_instrumental_song' as ToolKey, icon: TaoBaiHatLyria3Icon }],
  },
]
