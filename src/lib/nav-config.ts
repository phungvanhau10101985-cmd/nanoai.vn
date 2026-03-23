/**
 * Cấu hình điều hướng - đồng bộ giữa Header, MobileNav, Dashboard
 */
import type { ComponentType } from 'react'
import {
  Music2,
  SlidersHorizontal,
  ImagePlus,
  Radio,
  Languages,
  Video,
  Box,
  Shield,
  Stamp,
  BookOpen,
  FileQuestion,
  Wand2,
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
import { DichAnhTaiLieuIcon } from '@/components/icons/dich-anh-tai-lieu-icon'
import { XoaNenPngIcon } from '@/components/icons/xoa-nen-png-icon'
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
}

export type NavGroupConfig = {
  titleKey: NavGroupKey
  links: readonly NavGroupLinkItem[]
}

export const AI_TOOLS = [
  { href: '/thu-do-online', labelKey: 'try_on' as ToolKey, icon: TryOnIcon },
  { href: '/phuc-dung-anh', labelKey: 'restore_image' as ToolKey, icon: ImageRestorationIcon },
  { href: '/lam-net-anh', labelKey: 'enhance_image' as ToolKey, icon: LamNetAnhIcon },
  { href: '/lam-dep-anh', labelKey: 'beautify_image' as ToolKey, icon: LamDepAnhIcon },
  { href: '/ghep-anh', labelKey: 'merge_image' as ToolKey, icon: GhepAnhIcon },
  { href: '/tao-banner', labelKey: 'create_banner' as ToolKey, icon: TaoBannerIcon },
  { href: '/tao-anh-tu-chu', labelKey: 'text_to_image' as ToolKey, icon: Wand2 },
  { href: '/tao-anh-the', labelKey: 'create_id_photo' as ToolKey, icon: TaoAnhTheIcon },
  { href: '/thiet-ke-logo', labelKey: 'design_logo' as ToolKey, icon: ThietKeLogoIcon },
  { href: '/ke-chuyen-bang-hinh-anh', labelKey: 'story_with_images' as ToolKey, icon: KeChuyenBangHinhAnhIcon },
  { href: '/tao-nhan-gian', labelKey: 'create_sticker' as ToolKey, icon: TaoNhanGianIcon },
  { href: '/tao-nhan-gioi-thieu-san-pham', labelKey: 'create_product_label' as ToolKey, icon: TaoNhanGioiThieuSanPhamIcon },
  { href: '/tao-tem-niem-phong-bao-hanh', labelKey: 'create_seal_warranty_label' as ToolKey, icon: Shield },
  { href: '/thiet-ke-bao-bi', labelKey: 'design_package' as ToolKey, icon: Box },
  { href: '/tao-ma-vach', labelKey: 'create_barcode' as ToolKey, icon: TaoMaVachIcon },
  { href: '/che-anh', labelKey: 'meme_maker' as ToolKey, icon: CheAnhIcon },
  { href: '/xoa-vat-the', labelKey: 'remove_object' as ToolKey, icon: XoaVatTheIcon },
  { href: '/xoa-nen-png', labelKey: 'remove_bg_png' as ToolKey, icon: XoaNenPngIcon },
  { href: '/thay-nen-san-pham', labelKey: 'replace_product_bg' as ToolKey, icon: ThayNenSanPhamIcon },
  { href: '/tao-anh-3d', labelKey: 'product_3d_sample' as ToolKey, icon: TaoAnh3DIcon },
  { href: '/tao-mo-hinh-3d-tu-anh', labelKey: 'model_3d_from_image' as ToolKey, icon: TaoMoHinh3DTuAnhIcon },
  { href: '/tao-video-tu-anh', labelKey: 'create_video_from_image' as ToolKey, icon: Video },
  { href: '/thiet-ke-noi-ngoai-that', labelKey: 'interior_exterior' as ToolKey, icon: ThietKeNoiNgoaiThatIcon },
  { href: '/xay-nha-tu-dat-nen', labelKey: 'my_house' as ToolKey, icon: XayNhaTuDatNenIcon },
  { href: '/tao-anh-chain-dung', labelKey: 'portrait_photo' as ToolKey, icon: TaoAnhChanDungIcon },
  { href: '/mo-rong-khung-hinh', labelKey: 'expand_frame' as ToolKey, icon: MoRongKhungHinhIcon },
  { href: '/hoan-doi-khuon-mat', labelKey: 'face_swap' as ToolKey, icon: HoanDoiKhuonMatIcon },
  { href: '/dich-anh-tai-lieu', labelKey: 'translate_document_image' as ToolKey, icon: DichAnhTaiLieuIcon },
  { href: '/nhac-nen-ai', labelKey: 'ai_music_background' as ToolKey, icon: Music2 },
  { href: '/ai-dj', labelKey: 'ai_dj' as ToolKey, icon: SlidersHorizontal },
  { href: '/nhac-theo-cam-xuc-anh', labelKey: 'music_from_image_mood' as ToolKey, icon: ImagePlus },
  { href: '/dieu-khien-nhac-realtime', labelKey: 'realtime_music_control' as ToolKey, icon: Radio },
  { href: '/hoc-tieng-anh-ai', labelKey: 'ai_language_learning' as ToolKey, icon: Languages },
  { href: '/giao-trinh', labelKey: 'create_curriculum' as ToolKey, icon: BookOpen },
  { href: '/tao-de-trac-nghiem', labelKey: 'create_exam' as ToolKey, icon: FileQuestion },
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
    titleKey: 'image_edit' as NavGroupKey,
    links: [
      { href: '/phuc-dung-anh', labelKey: 'restore_image' as ToolKey, icon: ImageRestorationIcon },
      { href: '/lam-net-anh', labelKey: 'enhance_image' as ToolKey, icon: LamNetAnhIcon },
      { href: '/lam-dep-anh', labelKey: 'beautify_image' as ToolKey, icon: LamDepAnhIcon },
      { href: '/ghep-anh', labelKey: 'merge_image' as ToolKey, icon: GhepAnhIcon },
      { href: '/xoa-vat-the', labelKey: 'remove_object' as ToolKey, icon: XoaVatTheIcon },
      { href: '/xoa-nen-png', labelKey: 'remove_bg_png' as ToolKey, icon: XoaNenPngIcon },
      { href: '/thay-nen-san-pham', labelKey: 'replace_product_bg' as ToolKey, icon: ThayNenSanPhamIcon },
      { href: '/mo-rong-khung-hinh', labelKey: 'expand_frame' as ToolKey, icon: MoRongKhungHinhIcon },
      { href: '/hoan-doi-khuon-mat', labelKey: 'face_swap' as ToolKey, icon: HoanDoiKhuonMatIcon },
    ],
  },
  {
    titleKey: 'design_creative' as NavGroupKey,
    links: [
      { href: '/tao-banner', labelKey: 'create_banner' as ToolKey, icon: TaoBannerIcon },
      { href: '/tao-anh-tu-chu', labelKey: 'text_to_image' as ToolKey, icon: Wand2 },
      { href: '/tao-anh-the', labelKey: 'create_id_photo' as ToolKey, icon: TaoAnhTheIcon },
      { href: '/thiet-ke-logo', labelKey: 'design_logo' as ToolKey, icon: ThietKeLogoIcon },
      { href: '/ke-chuyen-bang-hinh-anh', labelKey: 'story_with_images' as ToolKey, icon: KeChuyenBangHinhAnhIcon },
      { href: '/tao-nhan-gian', labelKey: 'create_sticker' as ToolKey, icon: TaoNhanGianIcon },
      { href: '/tao-nhan-gioi-thieu-san-pham', labelKey: 'create_product_label' as ToolKey, icon: TaoNhanGioiThieuSanPhamIcon },
      { href: '/tao-tem-niem-phong-bao-hanh', labelKey: 'create_seal_warranty_label' as ToolKey, icon: Shield },
      { href: '/thiet-ke-con-dau', labelKey: 'design_stamp' as ToolKey, icon: Stamp },
      { href: '/thiet-ke-bao-bi', labelKey: 'design_package' as ToolKey, icon: Box },
      { href: '/tao-ma-vach', labelKey: 'create_barcode' as ToolKey, icon: TaoMaVachIcon },
      { href: '/che-anh', labelKey: 'meme_maker' as ToolKey, icon: CheAnhIcon },
    ],
  },
  {
    titleKey: 'three_d_special' as NavGroupKey,
    links: [
      { href: '/tao-anh-3d', labelKey: 'product_3d_sample' as ToolKey, icon: TaoAnh3DIcon },
      { href: '/tao-mo-hinh-3d-tu-anh', labelKey: 'model_3d_from_image' as ToolKey, icon: TaoMoHinh3DTuAnhIcon },
      { href: '/tao-video-tu-anh', labelKey: 'create_video_from_image' as ToolKey, icon: Video },
      { href: '/thiet-ke-noi-ngoai-that', labelKey: 'interior_exterior' as ToolKey, icon: ThietKeNoiNgoaiThatIcon },
      { href: '/xay-nha-tu-dat-nen', labelKey: 'my_house' as ToolKey, icon: XayNhaTuDatNenIcon },
      { href: '/tao-anh-chain-dung', labelKey: 'portrait_photo' as ToolKey, icon: TaoAnhChanDungIcon },
    ],
  },
  {
    titleKey: 'translation' as NavGroupKey,
    links: [
      { href: '/dich-anh-tai-lieu', labelKey: 'translate_document_image' as ToolKey, icon: DichAnhTaiLieuIcon },
    ],
  },
  {
    titleKey: 'music_ai' as NavGroupKey,
    links: [
      { href: '/nhac-nen-ai', labelKey: 'ai_music_background' as ToolKey, icon: Music2 },
      { href: '/ai-dj', labelKey: 'ai_dj' as ToolKey, icon: SlidersHorizontal },
      { href: '/nhac-theo-cam-xuc-anh', labelKey: 'music_from_image_mood' as ToolKey, icon: ImagePlus },
      { href: '/dieu-khien-nhac-realtime', labelKey: 'realtime_music_control' as ToolKey, icon: Radio },
    ],
  },
  {
    titleKey: 'curriculum' as NavGroupKey,
    links: [
      {
        href: '/giao-trinh',
        labelKey: 'create_curriculum' as ToolKey,
        icon: BookOpen,
      },
      { href: '/tao-de-trac-nghiem', labelKey: 'create_exam' as ToolKey, icon: FileQuestion },
    ],
  },
  {
    titleKey: 'learning_ai' as NavGroupKey,
    links: [{ href: '/hoc-tieng-anh-ai', labelKey: 'ai_language_learning' as ToolKey, icon: Languages }],
  },
]
