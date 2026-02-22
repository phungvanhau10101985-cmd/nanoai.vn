/**
 * Cấu hình điều hướng - đồng bộ giữa Header, MobileNav, Dashboard
 */
import {
  BarChart3,
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
import { CheAnhIcon } from '@/components/icons/che-anh-icon'
import { TaoAnh3DIcon } from '@/components/icons/tao-anh-3d-icon'
import { TaoMoHinh3DTuAnhIcon } from '@/components/icons/tao-mo-hinh-3d-tu-anh-icon'
import { ThietKeNoiNgoaiThatIcon } from '@/components/icons/thiet-ke-noi-ngoai-that-icon'
import { XayNhaTuDatNenIcon } from '@/components/icons/xay-nha-tu-dat-nen-icon'
import { TaoAnhChanDungIcon } from '@/components/icons/tao-anh-chain-dung-icon'
import { DichAnhTaiLieuIcon } from '@/components/icons/dich-anh-tai-lieu-icon'
import { XoaNenPngIcon } from '@/components/icons/xoa-nen-png-icon'

export const AI_TOOLS = [
  { href: '/thu-do-online', label: 'Thử đồ', icon: TryOnIcon },
  { href: '/phuc-dung-anh', label: 'Phục dựng ảnh', icon: ImageRestorationIcon },
  { href: '/lam-net-anh', label: 'Làm nét ảnh', icon: LamNetAnhIcon },
  { href: '/lam-dep-anh', label: 'Làm đẹp ảnh', icon: LamDepAnhIcon },
  { href: '/ghep-anh', label: 'Ghép ảnh', icon: GhepAnhIcon },
  { href: '/tao-banner', label: 'Tạo banner', icon: TaoBannerIcon },
  { href: '/tao-anh-the', label: 'Tạo ảnh thẻ', icon: TaoAnhTheIcon },
  { href: '/thiet-ke-logo', label: 'Thiết kế logo', icon: ThietKeLogoIcon },
  { href: '/ke-chuyen-bang-hinh-anh', label: 'Kể chuyện bằng ảnh', icon: KeChuyenBangHinhAnhIcon },
  { href: '/tao-nhan-gian', label: 'Tạo nhãn gián', icon: TaoNhanGianIcon },
  { href: '/che-anh', label: 'Chế ảnh', icon: CheAnhIcon },
  { href: '/xoa-vat-the', label: 'Xóa vật thể', icon: XoaVatTheIcon },
  { href: '/xoa-nen-png', label: 'Xóa nền PNG', icon: XoaNenPngIcon },
  { href: '/thay-nen-san-pham', label: 'Thay nền sản phẩm', icon: ThayNenSanPhamIcon },
  { href: '/tao-anh-3d', label: 'Ảnh sản phẩm mẫu 3D', icon: TaoAnh3DIcon },
  { href: '/tao-mo-hinh-3d-tu-anh', label: 'Mô hình 3D từ ảnh', icon: TaoMoHinh3DTuAnhIcon },
  { href: '/thiet-ke-noi-ngoai-that', label: 'Nội ngoại thất', icon: ThietKeNoiNgoaiThatIcon },
  { href: '/xay-nha-tu-dat-nen', label: 'Nhà của bạn', icon: XayNhaTuDatNenIcon },
  { href: '/tao-anh-chain-dung', label: 'Ảnh chân dung', icon: TaoAnhChanDungIcon },
  { href: '/mo-rong-khung-hinh', label: 'Mở rộng khung hình', icon: MoRongKhungHinhIcon },
  { href: '/hoan-doi-khuon-mat', label: 'Hoán đổi khuôn mặt', icon: HoanDoiKhuonMatIcon },
  { href: '/dich-anh-tai-lieu', label: 'Dịch ảnh tài liệu', icon: DichAnhTaiLieuIcon },
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
      { href: '/xoa-nen-png', label: 'Xóa nền PNG', icon: XoaNenPngIcon },
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
      { href: '/thiet-ke-logo', label: 'Thiết kế logo', icon: ThietKeLogoIcon },
      { href: '/ke-chuyen-bang-hinh-anh', label: 'Kể chuyện bằng ảnh', icon: KeChuyenBangHinhAnhIcon },
      { href: '/tao-nhan-gian', label: 'Tạo nhãn gián', icon: TaoNhanGianIcon },
      { href: '/che-anh', label: 'Chế ảnh', icon: CheAnhIcon },
    ],
  },
  {
    title: '3D & Chuyên dụng',
    links: [
      { href: '/tao-anh-3d', label: 'Ảnh sản phẩm mẫu 3D', icon: TaoAnh3DIcon },
      { href: '/tao-mo-hinh-3d-tu-anh', label: 'Mô hình 3D từ ảnh', icon: TaoMoHinh3DTuAnhIcon },
      { href: '/thiet-ke-noi-ngoai-that', label: 'Nội ngoại thất', icon: ThietKeNoiNgoaiThatIcon },
      { href: '/xay-nha-tu-dat-nen', label: 'Nhà của bạn', icon: XayNhaTuDatNenIcon },
      { href: '/tao-anh-chain-dung', label: 'Ảnh chân dung', icon: TaoAnhChanDungIcon },
      // { href: '/tao-video-tu-anh', label: 'Tạo video từ ảnh', icon: Video }, // Tạm ẩn
    ],
  },
  {
    title: 'Dịch thuật',
    links: [
      { href: '/dich-anh-tai-lieu', label: 'Dịch ảnh tài liệu', icon: DichAnhTaiLieuIcon },
      { href: '/dich-anh-tai-lieu/tien-trinh', label: 'Tiến trình dịch', icon: BarChart3 },
    ],
  },
] as const
