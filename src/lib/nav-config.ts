/**
 * Cấu hình điều hướng - đồng bộ giữa Header, MobileNav, Dashboard
 */
import {
  Sparkles,
  Layers,
  Layout,
  User,
  Users,
  Palette,
  Smile,
  Eraser,
  Package,
  Box,
  BoxSelect,
  Home,
  Briefcase,
  Expand,
  Repeat,
  FileText,
  BarChart3,
  BookOpen,
  Tag,
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

export const AI_TOOLS = [
  { href: '/thu-do-online', label: 'Thử đồ', icon: TryOnIcon },
  { href: '/phuc-dung-anh', label: 'Phục dựng ảnh', icon: ImageRestorationIcon },
  { href: '/lam-net-anh', label: 'Làm nét ảnh', icon: LamNetAnhIcon },
  { href: '/lam-dep-anh', label: 'Làm đẹp ảnh', icon: LamDepAnhIcon },
  { href: '/ghep-anh', label: 'Ghép ảnh', icon: GhepAnhIcon },
  { href: '/tao-banner', label: 'Tạo banner', icon: TaoBannerIcon },
  { href: '/tao-anh-the', label: 'Tạo ảnh thẻ', icon: TaoAnhTheIcon },
  { href: '/thiet-ke-logo', label: 'Thiết kế logo', icon: Palette },
  { href: '/ke-chuyen-bang-hinh-anh', label: 'Kể chuyện bằng ảnh', icon: BookOpen },
  { href: '/tao-nhan-gian', label: 'Tạo nhãn gián', icon: Tag },
  { href: '/che-anh', label: 'Chế ảnh', icon: Smile },
  { href: '/xoa-vat-the', label: 'Xóa vật thể', icon: XoaVatTheIcon },
  { href: '/thay-nen-san-pham', label: 'Thay nền sản phẩm', icon: ThayNenSanPhamIcon },
  { href: '/tao-anh-3d', label: 'Ảnh sản phẩm mẫu 3D', icon: Box },
  { href: '/tao-mo-hinh-3d-tu-anh', label: 'Mô hình 3D từ ảnh', icon: BoxSelect },
  { href: '/thiet-ke-noi-ngoai-that', label: 'Nội ngoại thất', icon: Home },
  { href: '/xay-nha-tu-dat-nen', label: 'Nhà của bạn', icon: Home },
  { href: '/tao-anh-chain-dung', label: 'Ảnh chân dung', icon: Briefcase },
  { href: '/mo-rong-khung-hinh', label: 'Mở rộng khung hình', icon: MoRongKhungHinhIcon },
  { href: '/hoan-doi-khuon-mat', label: 'Hoán đổi khuôn mặt', icon: HoanDoiKhuonMatIcon },
  { href: '/dich-anh-tai-lieu', label: 'Dịch ảnh tài liệu', icon: FileText },
  { href: '/dich-anh-tai-lieu/tien-trinh', label: 'Tiến trình dịch', icon: BarChart3 },
  // { href: '/tao-video-tu-anh', label: 'Tạo video từ ảnh', icon: Video }, // Tạm ẩn
] as const

export const NAV_GROUPS = [
  {
    title: 'Thử đồ & Phối đồ',
    links: [
      { href: '/thu-do-online/1-nguoi', label: 'Thử đồ 1 người', icon: TryOnIcon },
      { href: '/thu-do-online/2-nguoi', label: 'Thử đồ 2 người', icon: TryOnIcon },
      { href: '/thu-do-online/3-nguoi', label: 'Thử đồ 3 người', icon: TryOnIcon },
      { href: '/thu-do-online/4-nguoi', label: 'Thử đồ 4 người', icon: TryOnIcon },
      { href: '/thu-do-online/5-nguoi', label: 'Thử đồ 5 người', icon: TryOnIcon },
    ],
  },
  {
    title: 'Chỉnh sửa ảnh',
    links: [
      { href: '/phuc-dung-anh', label: 'Phục dựng ảnh', icon: ImageRestorationIcon },
      { href: '/lam-net-anh', label: 'Làm nét ảnh', icon: LamNetAnhIcon },
      { href: '/lam-dep-anh', label: 'Làm đẹp ảnh', icon: LamDepAnhIcon },
      { href: '/ghep-anh', label: 'Ghép ảnh', icon: GhepAnhIcon },
      { href: '/xoa-vat-the', label: 'Xóa vật thể', icon: XoaVatTheIcon },
      { href: '/thay-nen-san-pham', label: 'Thay nền sản phẩm', icon: ThayNenSanPhamIcon },
      { href: '/mo-rong-khung-hinh', label: 'Mở rộng khung hình', icon: MoRongKhungHinhIcon },
      { href: '/hoan-doi-khuon-mat', label: 'Hoán đổi khuôn mặt', icon: HoanDoiKhuonMatIcon },
    ],
  },
  {
    title: 'Thiết kế & Sáng tạo',
    links: [
      { href: '/tao-banner', label: 'Tạo banner', icon: TaoBannerIcon },
      { href: '/tao-anh-the', label: 'Tạo ảnh thẻ', icon: TaoAnhTheIcon },
      { href: '/thiet-ke-logo', label: 'Thiết kế logo', icon: Palette },
      { href: '/ke-chuyen-bang-hinh-anh', label: 'Kể chuyện bằng ảnh', icon: BookOpen },
      { href: '/tao-nhan-gian', label: 'Tạo nhãn gián', icon: Tag },
      { href: '/che-anh', label: 'Chế ảnh', icon: Smile },
    ],
  },
  {
    title: '3D & Chuyên dụng',
    links: [
      { href: '/tao-anh-3d', label: 'Ảnh sản phẩm mẫu 3D', icon: Box },
      { href: '/tao-mo-hinh-3d-tu-anh', label: 'Mô hình 3D từ ảnh', icon: BoxSelect },
      { href: '/thiet-ke-noi-ngoai-that', label: 'Nội ngoại thất', icon: Home },
      { href: '/xay-nha-tu-dat-nen', label: 'Nhà của bạn', icon: Home },
      { href: '/tao-anh-chain-dung', label: 'Ảnh chân dung', icon: Briefcase },
      // { href: '/tao-video-tu-anh', label: 'Tạo video từ ảnh', icon: Video }, // Tạm ẩn
    ],
  },
  {
    title: 'Dịch thuật',
    links: [
      { href: '/dich-anh-tai-lieu', label: 'Dịch ảnh tài liệu', icon: FileText },
      { href: '/dich-anh-tai-lieu/tien-trinh', label: 'Tiến trình dịch', icon: BarChart3 },
    ],
  },
] as const
