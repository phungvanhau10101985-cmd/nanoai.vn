/**
 * Gom `api_usage_log.feature` thành nhóm báo cáo admin (nhóm → tính năng → model).
 * Bổ sung feature mới: map vào nhóm phù hợp hoặc `other`.
 */

export type ApiFeatureGroupId =
  | 'language-coach'
  | 'curriculum'
  | 'virtual-tryon'
  | 'interior'
  | 'house-builder'
  | 'brand-packaging'
  | 'photo-studio'
  | 'document-text'
  | 'meeting-assistant'
  | 'education-exam'
  | 'music-ai'
  | 'other'

export const API_FEATURE_GROUP_LABELS: Record<
  ApiFeatureGroupId,
  { vi: string; en: string; zh: string; ja: string; ko: string }
> = {
  'language-coach': {
    vi: 'Học ngoại ngữ AI',
    en: 'Language coach AI',
    zh: '外语学习 AI',
    ja: '語学学習AI',
    ko: '외국어 코치 AI',
  },
  curriculum: {
    vi: 'Tạo giáo trình / slide',
    en: 'Curriculum & slides',
    zh: '课程与幻灯片',
    ja: '授業・スライド',
    ko: '교안·슬라이드',
  },
  'virtual-tryon': {
    vi: 'Thử đồ ảo',
    en: 'Virtual try-on',
    zh: '虚拟试衣',
    ja: 'バーチャル試着',
    ko: '가상 피팅',
  },
  interior: {
    vi: 'Thiết kế nội / ngoại thất',
    en: 'Interior & exterior design',
    zh: '室内外设计',
    ja: '内装・外装デザイン',
    ko: '실내·실외 디자인',
  },
  'house-builder': {
    vi: 'Xây nhà / mô hình kiến trúc',
    en: 'House & architecture',
    zh: '房屋与建筑',
    ja: '住宅・建築',
    ko: '주택·건축',
  },
  'brand-packaging': {
    vi: 'Nhãn hiệu, bao bì, banner',
    en: 'Branding, packaging, banners',
    zh: '品牌、包装、横幅',
    ja: 'ブランド・パッケージ・バナー',
    ko: '브랜드·패키지·배너',
  },
  'photo-studio': {
    vi: 'Ảnh & video (xử lý, ghép, 3D…)',
    en: 'Photo & video tools',
    zh: '图片与视频工具',
    ja: '写真・動画ツール',
    ko: '사진·영상 도구',
  },
  'document-text': {
    vi: 'Tài liệu & văn bản (dịch, infographic…)',
    en: 'Documents & text',
    zh: '文档与文本',
    ja: '文書・テキスト',
    ko: '문서·텍스트',
  },
  'meeting-assistant': {
    vi: 'Biên bản / họp (audio → báo cáo)',
    en: 'Meeting notes (audio → report)',
    zh: '会议纪要（音频→报告）',
    ja: '議事録（音声→レポート）',
    ko: '회의록(오디오→보고)',
  },
  'education-exam': {
    vi: 'Thi / bài tập (đề, chấm tự luận…)',
    en: 'Exams & worksheets',
    zh: '考试与作业',
    ja: '試験・課題',
    ko: '시험·과제',
  },
  'music-ai': {
    vi: 'Nhạc AI (Lyria, …)',
    en: 'Music AI (Lyria, …)',
    zh: '音乐 AI',
    ja: '音楽AI',
    ko: '음악 AI',
  },
  other: {
    vi: 'Khác / chưa phân loại',
    en: 'Other / uncategorized',
    zh: '其他 / 未分类',
    ja: 'その他 / 未分類',
    ko: '기타 / 미분류',
  },
}

const BRAND_EXACT = new Set([
  'thiet-ke-logo',
  'thiet-ke-con-dau',
  'tao-banner',
  'tao-nhan-gian',
  'tao-nhan-gioi-thieu-san-pham',
  'tao-nhan-gioi-thieu-san-pham-mockup',
  'tao-tem-niem-phong-bao-hanh',
])

const PHOTO_STUDIO = new Set([
  'du-anh-tu-phac-thao',
  'tao-anh-tu-chu',
  'xoa-nen-png',
  'xoa-vat-the',
  'thay-nen-san-pham',
  'tao-video-tu-anh',
  'tao-mo-hinh-3d-tu-anh',
  'tao-anh-the',
  'tao-anh-chain-dung',
  'tao-anh-3d',
  'phuc-dung-anh',
  'mo-rong-khung-hinh',
  'lam-net-anh',
  'lam-dep-anh',
  'ke-chuyen-bang-hinh-anh',
  'hoan-doi-khuon-mat',
  'ghep-anh',
  'che-anh',
])

const DOCUMENT_TEXT = new Set(['tao-infographic-tu-sach', 'ai-normalize', 'dich-anh-tai-lieu'])

export function resolveApiFeatureGroupId(feature: string): ApiFeatureGroupId {
  if (!feature) return 'other'
  if (feature.startsWith('english-coach-')) return 'language-coach'
  if (feature.startsWith('curriculum-')) return 'curriculum'
  if (feature.startsWith('meeting-report-')) return 'meeting-assistant'
  if (feature.startsWith('exam-')) return 'education-exam'
  if (feature.startsWith('music-lyria') || feature.startsWith('music-image-mood')) return 'music-ai'
  if (feature === 'thu-do-online') return 'virtual-tryon'
  if (feature.startsWith('thiet-ke-noi-ngoai-that')) return 'interior'
  if (feature.startsWith('xay-nha-')) return 'house-builder'
  if (feature.startsWith('thiet-ke-bao-bi') || BRAND_EXACT.has(feature)) return 'brand-packaging'
  if (PHOTO_STUDIO.has(feature)) return 'photo-studio'
  if (DOCUMENT_TEXT.has(feature)) return 'document-text'
  if (feature.startsWith('dich-anh-tai-lieu-postcheck')) return 'document-text'
  return 'other'
}
