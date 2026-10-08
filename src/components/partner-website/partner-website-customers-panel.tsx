'use client'

import { Fragment, useCallback, useEffect, useState } from 'react'
import type { WebLocale } from '@/lib/i18n/config'
import type { PartnerWebsiteCopy } from '@/lib/i18n/partner-website-copy'
import { presetModulesForLinkedRole } from '@/lib/messaging/partner-shop-member-staff'
import { PARTNER_STAFF_PERM_KEYS, type PartnerStaffPermKey } from '@/lib/messaging/partner-staff-permissions'

/**
 * Quản lý thành viên shop — cùng mặt 188 `/admin/members` (danh sách, import, khóa, xóa, quyền, chi tiết).
 */

type LinkedStaffRole = 'none' | 'order_manager' | 'admin' | 'product_manager' | 'content_manager'

type MemberRow = {
  id: string
  email: string
  fullName: string
  phone: string
  dateOfBirth: string | null
  gender: string | null
  createdAt: string
  updatedAt: string
  lastLogin: string
  isActive: boolean
  isVerified: boolean
  address: string
  avatar: string | null
  hasLinkedAdmin: boolean
  linkedAdminRole: LinkedStaffRole
  linkedAdminModules: string[]
}

type ImportResult = {
  message?: string
  corrections?: Array<{ row: number; original: string; fixed: string }>
  invalidRows?: Array<{ row: number; email: string; name: string; reason: string }>
}

const PAGE_SIZE = 20

const ROLE_OPTIONS: LinkedStaffRole[] = ['none', 'order_manager', 'admin', 'product_manager', 'content_manager']

const MODULE_GROUPS: Array<{ title: string; keys: PartnerStaffPermKey[] }> = [
  { title: 'inbox', keys: ['inbox'] },
  { title: 'brand', keys: ['workspace_branding', 'workspace_payment'] },
  {
    title: 'inventory',
    keys: [
      'inventory_products',
      'inventory_studio',
      'inventory_listing_import',
      'inventory_source_stock',
      'inventory_open_sync',
      'inventory_image_loc',
      'inventory_search_aliases',
      'inventory_facet_cache',
      'inventory_search_cache',
    ],
  },
  { title: 'shipping', keys: ['orders_shipping'] },
  {
    title: 'ops',
    keys: ['orders', 'orders_profit', 'orders_ems', 'notifications', 'marketing_campaigns', 'email_management'],
  },
  { title: 'customers', keys: ['website_customers', 'website_leads'] },
  {
    title: 'website',
    keys: [
      'website_editor',
      'website_categories',
      'website_reviews',
      'website_static_pages',
      'website_promotions',
      'website_landings',
      'website_floating_cta',
    ],
  },
  { title: 'connect', keys: ['integrations_channels', 'analytics_catalog', 'analytics_ads'] },
  { title: 'ai', keys: ['ai_settings', 'usage_reports'] },
]

function L(locale: WebLocale, vi: string, en: string, zh: string, ja: string, ko: string): string {
  if (locale === 'en') return en
  if (locale === 'zh') return zh
  if (locale === 'ja') return ja
  if (locale === 'ko') return ko
  return vi
}

function roleLabel(locale: WebLocale, role: LinkedStaffRole): string {
  const map: Record<LinkedStaffRole, [string, string, string, string, string]> = {
    none: ['Không', 'None', '无', 'なし', '없음'],
    order_manager: ['NV đơn hàng', 'Order staff', '订单员工', '注文担当', '주문 담당'],
    admin: ['Quản trị (full)', 'Admin (full)', '管理员（全部）', '管理（全権限）', '관리자 (전체)'],
    product_manager: ['NV SP / danh mục', 'Product staff', '商品员工', '商品担当', '상품 담당'],
    content_manager: ['NV nội dung', 'Content staff', '内容员工', 'コンテンツ担当', '콘텐츠 담당'],
  }
  const row = map[role]
  return L(locale, row[0], row[1], row[2], row[3], row[4])
}

function roleDisplay(locale: WebLocale, m: MemberRow): string {
  if (!m.hasLinkedAdmin || m.linkedAdminRole === 'none') return '—'
  const base =
    m.linkedAdminRole === 'admin'
      ? L(locale, 'Quản trị', 'Admin', '管理员', '管理', '관리자')
      : roleLabel(locale, m.linkedAdminRole)
  const n = m.linkedAdminModules?.length ?? 0
  const unit = L(locale, 'mục', 'items', '项', '項目', '항목')
  return n > 0 ? `${base} (${n} ${unit})` : base
}

function moduleLabel(locale: WebLocale, key: string): string {
  const labels: Record<string, [string, string, string, string, string]> = {
    inbox: ['Hộp thư', 'Inbox', '收件箱', '受信箱', '받은편지함'],
    workspace_branding: ['Thương hiệu', 'Brand', '品牌', 'ブランド', '브랜드'],
    workspace_payment: ['Thanh toán', 'Payment', '支付', '決済', '결제'],
    inventory_products: ['Sản phẩm', 'Products', '商品', '商品', '상품'],
    inventory_studio: ['Đăng sản phẩm', 'Publish', '发布商品', '商品登録', '상품 등록'],
    inventory_listing_import: ['Parse HTML', 'Parse HTML', '解析 HTML', 'HTML解析', 'HTML 파싱'],
    inventory_source_stock: ['Kiểm tra nguồn', 'Source stock', '货源检查', '在庫確認', '공급처 재고'],
    inventory_open_sync: ['Open Catalog', 'Open Catalog', '开放目录', 'オープンカタログ', '오픈 카탈로그'],
    inventory_image_loc: ['Bản địa hóa ảnh', 'Image localization', '图片本地化', '画像ローカライズ', '이미지 현지화'],
    inventory_search_aliases: ['Từ khóa', 'Search aliases', '搜索词', '検索語', '검색어'],
    inventory_facet_cache: ['Cache bộ lọc', 'Filter cache', '筛选缓存', '絞り込みキャッシュ', '필터 캐시'],
    inventory_search_cache: ['Cache tìm kiếm', 'Search cache', '搜索缓存', '検索キャッシュ', '검색 캐시'],
    orders_shipping: ['Vận chuyển', 'Shipping', '配送', '配送', '배송'],
    orders: ['Đơn hàng', 'Orders', '订单', '注文', '주문'],
    orders_profit: ['Lợi nhuận', 'Profit', '利润', '利益', '이익'],
    orders_ems: ['EMS', 'EMS', 'EMS', 'EMS', 'EMS'],
    notifications: ['Thông báo', 'Notifications', '通知', '通知', '알림'],
    marketing_campaigns: ['Khuyến mãi', 'Promotions', '促销', 'プロモーション', '프로모션'],
    email_management: ['Email', 'Email', '邮件', 'メール', '이메일'],
    website_customers: ['Thành viên', 'Members', '会员', '会員', '회원'],
    website_leads: ['Lead form', 'Leads', '线索', 'リード', '리드'],
    website_editor: ['Sửa web', 'Website editor', '网站编辑', 'サイト編集', '웹 편집'],
    website_categories: ['Danh mục', 'Categories', '分类', 'カテゴリ', '카테고리'],
    website_reviews: ['Đánh giá', 'Reviews', '评价', 'レビュー', '리뷰'],
    website_static_pages: ['Trang tĩnh', 'Pages', '静态页', '固定ページ', '정적 페이지'],
    website_landings: ['Landing', 'Landing', '落地页', 'ランディング', '랜딩'],
    website_promotions: ['Khuyến mãi web', 'Web promos', '网站促销', 'ウェブ施策', '웹 프로모션'],
    website_floating_cta: ['Nút nổi', 'Floating button', '浮动按钮', 'フローティング', '플로팅 버튼'],
    integrations_channels: ['Kênh', 'Channels', '渠道', 'チャネル', '채널'],
    analytics_catalog: ['Catalog', 'Catalog', '目录', 'カタログ', '카탈로그'],
    analytics_ads: ['Quảng cáo', 'Ads', '广告', '広告', '광고'],
    ai_settings: ['AI', 'AI', 'AI', 'AI', 'AI'],
    usage_reports: ['Báo cáo', 'Reports', '报表', 'レポート', '리포트'],
  }
  const row = labels[key]
  if (!row) return key
  return L(locale, row[0], row[1], row[2], row[3], row[4])
}

function groupTitle(locale: WebLocale, id: string): string {
  const map: Record<string, [string, string, string, string, string]> = {
    inbox: ['Hộp thư', 'Inbox', '收件箱', '受信箱', '받은편지함'],
    brand: ['Thương hiệu', 'Brand', '品牌', 'ブランド', '브랜드'],
    inventory: ['Kho hàng', 'Inventory', '库存', '在庫', '재고'],
    shipping: ['Vận chuyển', 'Shipping', '配送', '配送', '배송'],
    ops: ['Vận hành', 'Operations', '运营', '運用', '운영'],
    customers: ['Khách hàng', 'Customers', '客户', '顧客', '고객'],
    website: ['Website', 'Website', '网站', 'サイト', '웹사이트'],
    connect: ['Kết nối', 'Connections', '连接', '連携', '연결'],
    ai: ['AI', 'AI', 'AI', 'AI', 'AI'],
  }
  const row = map[id] ?? [id, id, id, id, id]
  return L(locale, row[0], row[1], row[2], row[3], row[4])
}

function formatBirthShort(s: string | null | undefined) {
  if (!s) return '—'
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const [y, m, d] = s.slice(0, 10).split('-')
    return `${d}/${m}/${y}`
  }
  const dt = new Date(s)
  return Number.isNaN(dt.getTime()) ? '—' : dt.toLocaleDateString('vi-VN')
}

function formatGender(locale: WebLocale, value: string | null | undefined) {
  const g = (value || '').trim().toLowerCase()
  if (!g) return '—'
  if (g === 'male' || g === 'nam' || g === 'm') return L(locale, 'Nam', 'Male', '男', '男性', '남')
  if (g === 'female' || g === 'nữ' || g === 'nu' || g === 'n') return L(locale, 'Nữ', 'Female', '女', '女性', '여')
  return value || '—'
}

function formatCreatedAt(s: string | null | undefined) {
  if (!s) return '—'
  const dt = new Date(s)
  if (Number.isNaN(dt.getTime())) return '—'
  return dt.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDateTime(s: string | null | undefined) {
  if (!s) return '—'
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return '—'
  return (
    d.toLocaleDateString('vi-VN') +
    ' ' +
    d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  )
}

type Props = {
  locale: WebLocale
  t: PartnerWebsiteCopy
  partnerId: string
  sectionId?: string
}

export function PartnerWebsiteCustomersPanel({ locale, partnerId, sectionId }: Props) {
  const [loading, setLoading] = useState(true)
  const [members, setMembers] = useState<MemberRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [keyword, setKeyword] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [linkedBusyId, setLinkedBusyId] = useState<string | null>(null)
  const [staffPanelUserId, setStaffPanelUserId] = useState<string | null>(null)
  const [staffPanelDraft, setStaffPanelDraft] = useState<string[]>([])
  const [canManageLinkedStaff, setCanManageLinkedStaff] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [deleteConfirmMember, setDeleteConfirmMember] = useState<MemberRow | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [detail, setDetail] = useState<MemberRow | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailMissing, setDetailMissing] = useState(false)

  const basePath = `/api/messaging/partners/${encodeURIComponent(partnerId)}/customers`
  const tx = (vi: string, en: string, zh: string, ja: string, ko: string) => L(locale, vi, en, zh, ja, ko)

  const showToast = (type: 'ok' | 'err', msg: string) => {
    setToast({ type, msg })
    window.setTimeout(() => setToast(null), 3000)
  }

  const fetchMembers = useCallback(async () => {
    setLoading(true)
    try {
      const qs = new URLSearchParams({
        page: String(page + 1),
        pageSize: String(PAGE_SIZE),
      })
      if (keyword.trim()) qs.set('search', keyword.trim())
      const res = await fetch(`${basePath}?${qs.toString()}`)
      const json = (await res.json().catch(() => null)) as {
        customers?: MemberRow[]
        total?: number
        canManageLinkedStaff?: boolean
      } | null
      if (!res.ok) throw new Error('load')
      setMembers(json?.customers ?? [])
      setTotal(json?.total ?? 0)
      setCanManageLinkedStaff(Boolean(json?.canManageLinkedStaff))
    } catch {
      showToast('err', tx('Lỗi tải danh sách thành viên', 'Could not load members', '无法加载会员', '会員一覧を読み込めません', '회원 목록을 불러오지 못했습니다'))
      setMembers([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
    // tx is stable per locale render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basePath, page, keyword, locale])

  useEffect(() => {
    void fetchMembers()
  }, [fetchMembers])

  const reloadDetail = useCallback(
    async (id: string) => {
      setDetailLoading(true)
      setDetailMissing(false)
      try {
        const res = await fetch(`${basePath}/${encodeURIComponent(id)}`)
        const json = (await res.json().catch(() => null)) as { member?: MemberRow } | null
        if (!res.ok || !json?.member) {
          setDetail(null)
          setDetailMissing(true)
          return
        }
        setDetail(json.member)
      } catch {
        setDetail(null)
        setDetailMissing(true)
      } finally {
        setDetailLoading(false)
      }
    },
    [basePath]
  )

  const patchActive = async (m: MemberRow) => {
    setUpdatingId(m.id)
    try {
      const res = await fetch(`${basePath}/${encodeURIComponent(m.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !m.isActive }),
      })
      if (!res.ok) throw new Error('patch')
      showToast(
        'ok',
        m.isActive
          ? tx('Đã tắt kích hoạt', 'Account locked', '已锁定', 'ロックしました', '잠갔습니다')
          : tx('Đã bật kích hoạt', 'Account unlocked', '已解锁', 'ロック解除しました', '잠금 해제했습니다')
      )
      await fetchMembers()
      if (detail?.id === m.id) await reloadDetail(m.id)
    } catch {
      showToast('err', tx('Lỗi cập nhật', 'Update failed', '更新失败', '更新に失敗しました', '업데이트 실패'))
    } finally {
      setUpdatingId(null)
    }
  }

  const saveLinked = async (m: MemberRow, staffRole: LinkedStaffRole, modules?: string[]) => {
    if (!canManageLinkedStaff) return
    setLinkedBusyId(m.id)
    try {
      const res = await fetch(`${basePath}/${encodeURIComponent(m.id)}/linked-staff`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffRole, modules: modules ?? null }),
      })
      const json = (await res.json().catch(() => null)) as { error?: string } | null
      if (!res.ok) {
        const err = json?.error
        if (err === 'need_email') {
          showToast('err', tx('Thành viên cần có email để gán quyền', 'Email is required', '需要邮箱', 'メールが必要です', '이메일이 필요합니다'))
        } else if (err === 'is_owner') {
          showToast('err', tx('Không gán quyền cho chủ shop', 'Cannot assign the shop owner', '不能指定店主', 'オーナーには割り当てできません', '점주는 지정할 수 없습니다'))
        } else {
          showToast('err', tx('Lỗi cập nhật', 'Update failed', '更新失败', '更新に失敗しました', '업데이트 실패'))
        }
        return
      }
      showToast(
        'ok',
        modules
          ? tx('Đã lưu quyền theo mục', 'Permissions saved', '已保存权限', '権限を保存しました', '권한을 저장했습니다')
          : tx('Đã cập nhật quyền quản trị web', 'Web admin access updated', '已更新网站管理权限', '管理権限を更新しました', '웹 관리 권한을 업데이트했습니다')
      )
      if (!modules) setStaffPanelUserId((prev) => (prev === m.id ? null : prev))
      else setStaffPanelUserId(null)
      await fetchMembers()
    } catch {
      showToast('err', tx('Lỗi cập nhật', 'Update failed', '更新失败', '更新に失敗しました', '업데이트 실패'))
    } finally {
      setLinkedBusyId(null)
    }
  }

  const confirmDelete = async () => {
    const target = deleteConfirmMember
    if (!target) return
    setDeletingId(target.id)
    try {
      const res = await fetch(`${basePath}/${encodeURIComponent(target.id)}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('delete')
      showToast('ok', tx('Đã xóa tài khoản thành viên', 'Member deleted', '已删除会员', '会員を削除しました', '회원을 삭제했습니다'))
      setDeleteConfirmMember(null)
      if (staffPanelUserId === target.id) setStaffPanelUserId(null)
      if (detail?.id === target.id) setDetail(null)
      await fetchMembers()
    } catch {
      showToast('err', tx('Không thể xóa tài khoản', 'Could not delete the account', '无法删除', '削除できません', '삭제할 수 없습니다'))
    } finally {
      setDeletingId(null)
    }
  }

  const handleImport = async () => {
    if (!importFile) {
      showToast('err', tx('Chọn file CSV hoặc Excel.', 'Choose a CSV or Excel file.', '请选择 CSV 或 Excel。', 'CSV または Excel を選んでください。', 'CSV 또는 Excel 파일을 선택하세요.'))
      return
    }
    setImporting(true)
    setImportResult(null)
    try {
      const body = new FormData()
      body.set('file', importFile)
      const res = await fetch(`${basePath}/import`, { method: 'POST', body })
      const json = (await res.json().catch(() => null)) as ImportResult & { error?: string } | null
      if (!res.ok) throw new Error(json?.error || 'import')
      setImportResult(json)
      showToast('ok', json?.message || tx('Import thành công.', 'Import finished.', '导入完成。', 'インポートしました。', '가져왔습니다.'))
      setImportFile(null)
      setPage(0)
      await fetchMembers()
    } catch (err) {
      showToast('err', err instanceof Error ? err.message : tx('Import thất bại', 'Import failed', '导入失败', 'インポート失敗', '가져오기 실패'))
    } finally {
      setImporting(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const openStaffPanel = (m: MemberRow) => {
    if (m.linkedAdminRole === 'none' || m.linkedAdminRole === 'admin') return
    if (staffPanelUserId === m.id) {
      setStaffPanelUserId(null)
      return
    }
    setStaffPanelUserId(m.id)
    setStaffPanelDraft(
      m.linkedAdminModules?.length ? [...m.linkedAdminModules] : presetModulesForLinkedRole(m.linkedAdminRole)
    )
  }

  return (
    <div id={sectionId} className="space-y-0">
      {toast ? (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-lg shadow-lg ${
            toast.type === 'ok' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
          }`}
        >
          {toast.msg}
        </div>
      ) : null}

      {detail || detailLoading || detailMissing ? (
        <MemberDetail
          locale={locale}
          loading={detailLoading}
          missing={detailMissing}
          member={detail}
          updating={Boolean(detail && updatingId === detail.id)}
          deleting={Boolean(detail && deletingId === detail.id)}
          onBack={() => {
            setDetail(null)
            setDetailMissing(false)
          }}
          onToggle={() => {
            if (detail) void patchActive(detail)
          }}
          onDelete={() => {
            if (detail) setDeleteConfirmMember(detail)
          }}
        />
      ) : (
        <>
          <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {tx('Quản lý thành viên', 'Members', '会员管理', '会員管理', '회원 관리')}
              </h1>
              <p className="text-gray-600 text-sm mt-1">
                {tx(
                  'Sắp xếp theo ngày đăng ký mới nhất. Bấm Chi tiết để xem đầy đủ thông tin.',
                  'Newest registrations first. Open Detail for the full profile.',
                  '按最新注册排序。点「详情」查看完整资料。',
                  '登録が新しい順です。「詳細」で全項目を見ます。',
                  '최근 가입순입니다. 상세에서 전체 정보를 봅니다.'
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void fetchMembers()}
              className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 text-sm font-medium"
            >
              {tx('Làm mới', 'Refresh', '刷新', '更新', '새로고침')}
            </button>
          </div>

          <div className="bg-white rounded-xl shadow border border-gray-100 p-4 mb-6 space-y-3">
            <h2 className="text-lg font-semibold text-gray-900">
              {tx('Import khách hàng cũ', 'Import existing customers', '导入旧客户', '既存顧客をインポート', '기존 고객 가져오기')}
            </h2>
            <p className="text-xs text-gray-500">
              {tx(
                'File CSV/Excel với cột name, gender, email, birthday, phone (birthday dạng số Excel như 38073 cũng được). Hệ thống tự sửa email gõ nhầm. Import lại cùng email sẽ cập nhật tên, giới tính, ngày sinh, SĐT theo file.',
                'CSV/Excel columns: name, gender, email, birthday, phone (Excel date serials such as 38073 are accepted). Typos in email are fixed. Re-importing the same email updates name, gender, birthday, and phone.',
                'CSV/Excel 列：name、gender、email、birthday、phone（Excel 日期序号如 38073 也可）。系统会修正写错的邮箱。同一邮箱再次导入会更新姓名、性别、生日和电话。',
                'CSV/Excel の列: name, gender, email, birthday, phone（Excel の日付シリアル 38073 も可）。打ち間違いメールは自動修正。同じメールの再取込で氏名・性別・生年月日・電話を更新します。',
                'CSV/Excel 열: name, gender, email, birthday, phone (Excel 날짜 번호 38073도 가능). 잘못 입력한 이메일은 자동 수정. 같은 이메일을 다시 가져오면 이름, 성별, 생일, 전화를 갱신합니다.'
              )}
            </p>
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-slate-100 file:text-slate-800"
            />
            <button
              type="button"
              disabled={importing || !importFile}
              onClick={() => void handleImport()}
              className="px-4 py-2 rounded-lg bg-slate-800 text-white text-sm font-medium hover:bg-slate-700 disabled:opacity-60"
            >
              {importing
                ? tx('Đang import…', 'Importing…', '正在导入…', 'インポート中…', '가져오는 중…')
                : tx(
                    'Import vào danh sách thành viên',
                    'Import into members',
                    '导入到会员列表',
                    '会員一覧へインポート',
                    '회원 목록으로 가져오기'
                  )}
            </button>
            {importResult && (importResult.corrections?.length || importResult.invalidRows?.length) ? (
              <div className="grid gap-3 md:grid-cols-2 pt-2">
                {importResult.corrections?.length ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
                    <p className="font-semibold text-amber-900 mb-1">
                      {tx('Email đã sửa', 'Corrected emails', '已修正邮箱', '修正したメール', '수정한 이메일')}
                    </p>
                    <ul className="max-h-36 overflow-y-auto space-y-0.5 text-amber-950">
                      {importResult.corrections.map((c) => (
                        <li key={`${c.row}-${c.original}`}>
                          {tx('Dòng', 'Row', '行', '行', '행')} {c.row}: {c.original} → <strong>{c.fixed}</strong>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {importResult.invalidRows?.length ? (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm">
                    <p className="font-semibold text-red-900 mb-1">
                      {tx('Không import được', 'Not imported', '未能导入', '取り込めませんでした', '가져오지 못함')}
                    </p>
                    <ul className="max-h-36 overflow-y-auto space-y-0.5 text-red-900">
                      {importResult.invalidRows.map((r) => (
                        <li key={`${r.row}-${r.email}-${r.name}`}>
                          {tx('Dòng', 'Row', '行', '行', '행')} {r.row}: {r.name || r.email || '—'} — {r.reason}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="bg-white rounded-xl shadow border border-gray-100 overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  setKeyword(searchInput.trim())
                  setPage(0)
                }}
                className="flex flex-wrap gap-2"
              >
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder={tx(
                    'Tìm theo SĐT, email, họ tên...',
                    'Search phone, email, name...',
                    '按电话、邮箱、姓名搜索...',
                    '電話・メール・氏名で検索...',
                    '전화, 이메일, 이름으로 검색...'
                  )}
                  className="flex-1 min-w-[200px] px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                />
                <button type="submit" className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 text-sm font-medium">
                  {tx('Tìm kiếm', 'Search', '搜索', '検索', '검색')}
                </button>
                {keyword ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchInput('')
                      setKeyword('')
                      setPage(0)
                    }}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm"
                  >
                    {tx('Xóa bộ lọc', 'Clear', '清除', 'クリア', '지우기')}
                  </button>
                ) : null}
              </form>
            </div>

            {loading ? (
              <div className="p-12 text-center text-gray-500">{tx('Đang tải...', 'Loading...', '加载中...', '読み込み中...', '불러오는 중...')}</div>
            ) : members.length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                {keyword
                  ? tx('Không có thành viên nào trùng khớp.', 'No matching members.', '没有匹配的会员。', '一致する会員はいません。', '일치하는 회원이 없습니다.')
                  : tx('Chưa có thành viên.', 'No members yet.', '还没有会员。', '会員はまだいません。', '아직 회원이 없습니다.')}
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100 text-left text-gray-600 font-medium">
                        <th className="py-3 px-4">ID</th>
                        <th className="py-3 px-4">{tx('Số điện thoại', 'Phone', '电话', '電話', '전화')}</th>
                        <th className="py-3 px-4">{tx('Họ tên', 'Name', '姓名', '氏名', '이름')}</th>
                        <th className="py-3 px-4">Email</th>
                        <th className="py-3 px-4">{tx('Ngày sinh', 'Birthday', '生日', '生年月日', '생일')}</th>
                        <th className="py-3 px-4">{tx('Giới tính', 'Gender', '性别', '性別', '성별')}</th>
                        <th className="py-3 px-4 whitespace-nowrap">{tx('Ngày tạo TK', 'Created', '创建时间', '作成日', '가입일')}</th>
                        <th className="py-3 px-4">{tx('Trạng thái', 'Status', '状态', '状態', '상태')}</th>
                        <th className="py-3 px-4 min-w-[200px]">{tx('Quản trị web', 'Web admin', '网站管理', 'ウェブ管理', '웹 관리')}</th>
                        <th className="py-3 px-4 text-center">{tx('Thao tác', 'Actions', '操作', '操作', '작업')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {members.map((m) => {
                        const showModuleBtn =
                          canManageLinkedStaff &&
                          Boolean((m.email || '').trim()) &&
                          m.linkedAdminRole !== 'none' &&
                          m.linkedAdminRole !== 'admin'
                        return (
                          <Fragment key={m.id}>
                            <tr className="border-b border-gray-100 hover:bg-gray-50/50">
                              <td className="py-3 px-4 font-mono text-gray-600 text-xs">{m.id.slice(0, 8)}</td>
                              <td className="py-3 px-4 font-medium">{m.phone || '—'}</td>
                              <td className="py-3 px-4">{m.fullName || '—'}</td>
                              <td className="py-3 px-4 text-gray-600">{m.email || '—'}</td>
                              <td className="py-3 px-4 text-gray-600 whitespace-nowrap">{formatBirthShort(m.dateOfBirth)}</td>
                              <td className="py-3 px-4 text-gray-600">{formatGender(locale, m.gender)}</td>
                              <td className="py-3 px-4 text-gray-600 whitespace-nowrap text-xs">{formatCreatedAt(m.createdAt)}</td>
                              <td className="py-3 px-4">
                                <span
                                  className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                                    m.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                  }`}
                                >
                                  {m.isActive
                                    ? tx('Đang hoạt động', 'Active', '使用中', '有効', '활성')
                                    : tx('Đã khóa', 'Locked', '已锁定', 'ロック中', '잠김')}
                                </span>
                              </td>
                              <td className="py-3 px-4 align-middle">
                                {canManageLinkedStaff ? (
                                  <div className="flex flex-col gap-1.5 max-w-[260px]">
                                    <select
                                      value={m.linkedAdminRole || 'none'}
                                      disabled={linkedBusyId === m.id || !(m.email || '').trim()}
                                      title={
                                        !(m.email || '').trim()
                                          ? tx('Thành viên cần có email để gán quyền', 'Email is required', '需要邮箱', 'メールが必要です', '이메일이 필요합니다')
                                          : tx(
                                              'Đăng nhập shop → Cá nhân → Quản trị web',
                                              'Shop login → Account → Web admin',
                                              '登录店铺 → 个人 → 网站管理',
                                              'ショップログイン → アカウント → ウェブ管理',
                                              '샵 로그인 → 계정 → 웹 관리'
                                            )
                                      }
                                      onChange={(e) => {
                                        const v = e.target.value as LinkedStaffRole
                                        if (staffPanelUserId === m.id) setStaffPanelUserId(null)
                                        void saveLinked(m, v)
                                      }}
                                      className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-white disabled:opacity-50"
                                    >
                                      {ROLE_OPTIONS.map((value) => (
                                        <option key={value} value={value}>
                                          {roleLabel(locale, value)}
                                        </option>
                                      ))}
                                    </select>
                                    {showModuleBtn ? (
                                      <button
                                        type="button"
                                        disabled={linkedBusyId === m.id}
                                        onClick={() => openStaffPanel(m)}
                                        className="text-left text-xs font-medium text-slate-700 underline-offset-2 hover:underline disabled:opacity-50"
                                      >
                                        {staffPanelUserId === m.id
                                          ? tx('Đóng chọn mục', 'Close modules', '关闭', '閉じる', '닫기')
                                          : tx('Chọn mục cụ thể', 'Choose modules', '选择具体栏目', '項目を選ぶ', '항목 선택')}
                                      </button>
                                    ) : null}
                                  </div>
                                ) : (
                                  <span className="text-gray-600 text-xs">{roleDisplay(locale, m)}</span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-center">
                                <div className="flex flex-wrap items-center justify-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => void reloadDetail(m.id)}
                                    className="inline-block px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 text-slate-800 hover:bg-slate-200"
                                  >
                                    {tx('Chi tiết', 'Detail', '详情', '詳細', '상세')}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void patchActive(m)}
                                    disabled={updatingId === m.id}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50 ${
                                      m.isActive
                                        ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                                        : 'bg-green-100 text-green-800 hover:bg-green-200'
                                    }`}
                                  >
                                    {updatingId === m.id
                                      ? '...'
                                      : m.isActive
                                        ? tx('Khóa', 'Lock', '锁定', 'ロック', '잠금')
                                        : tx('Mở khóa', 'Unlock', '解锁', '解除', '해제')}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setDeleteConfirmMember(m)}
                                    disabled={deletingId === m.id}
                                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-100 text-red-800 hover:bg-red-200 disabled:opacity-50"
                                  >
                                    {tx('Xóa', 'Delete', '删除', '削除', '삭제')}
                                  </button>
                                </div>
                              </td>
                            </tr>
                            {staffPanelUserId === m.id ? (
                              <tr className="border-b border-gray-100 bg-slate-50">
                                <td colSpan={10} className="p-4">
                                  <p className="text-xs text-gray-600 mb-3">
                                    {tx(
                                      'Chọn mục được phép trong menu quản trị. Lưu gửi danh sách lên server. Đổi vai trò ở dropdown (không đánh dấu mục) = preset mặc định của vai đó.',
                                      'Pick the admin menu items this member may open. Save sends the list. Changing the role without ticking items applies that role’s default preset.',
                                      '选择该会员可打开的管理菜单。保存会提交清单。只改角色、不勾选项目时使用该角色的默认预设。',
                                      '管理メニューで許可する項目を選びます。保存で送信。役割だけ変えて項目を選ばないと、その役割の初期セットになります。',
                                      '관리 메뉴에서 허용할 항목을 고릅니다. 저장하면 서버로 보냅니다. 역할만 바꾸면 그 역할의 기본 세트가 적용됩니다.'
                                    )}
                                  </p>
                                  <div className="mb-4 space-y-4">
                                    {MODULE_GROUPS.map((group) => (
                                      <div key={group.title}>
                                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                                          {groupTitle(locale, group.title)}
                                        </p>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                                          {group.keys.filter((key) => (PARTNER_STAFF_PERM_KEYS as readonly string[]).includes(key)).map((key) => (
                                            <label
                                              key={key}
                                              className="flex items-start gap-2 text-xs text-gray-800 cursor-pointer rounded-lg border border-gray-100 bg-white px-2 py-1.5 hover:border-gray-200"
                                            >
                                              <input
                                                type="checkbox"
                                                checked={staffPanelDraft.includes(key)}
                                                disabled={linkedBusyId === m.id}
                                                onChange={() =>
                                                  setStaffPanelDraft((prev) =>
                                                    prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
                                                  )
                                                }
                                                className="mt-0.5 rounded border-gray-300"
                                              />
                                              <span>{moduleLabel(locale, key)}</span>
                                            </label>
                                          ))}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    <button
                                      type="button"
                                      disabled={linkedBusyId === m.id}
                                      onClick={() => void saveLinked(m, m.linkedAdminRole, staffPanelDraft)}
                                      className="px-3 py-1.5 rounded-lg bg-slate-700 text-white text-xs font-medium hover:bg-slate-600 disabled:opacity-50"
                                    >
                                      {tx('Lưu quyền mục', 'Save modules', '保存栏目权限', '項目権限を保存', '항목 권한 저장')}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setStaffPanelUserId(null)}
                                      className="px-3 py-1.5 rounded-lg border border-gray-300 text-xs font-medium text-gray-700 hover:bg-white"
                                    >
                                      {tx('Huỷ', 'Cancel', '取消', 'キャンセル', '취소')}
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ) : null}
                          </Fragment>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                {totalPages > 1 ? (
                  <div className="p-4 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-gray-600 text-sm">
                      {tx('Hiển thị', 'Showing', '显示', '表示', '표시')} {page * PAGE_SIZE + 1}–
                      {Math.min((page + 1) * PAGE_SIZE, total)} / {total}
                    </p>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => setPage((p) => Math.max(0, p - 1))}
                        disabled={page === 0}
                        className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-gray-50"
                      >
                        {tx('Trước', 'Prev', '上一页', '前へ', '이전')}
                      </button>
                      <span className="px-3 py-1.5 text-sm text-gray-600">
                        {tx('Trang', 'Page', '页', 'ページ', '페이지')} {page + 1} / {totalPages}
                      </span>
                      <button
                        type="button"
                        onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                        disabled={page >= totalPages - 1}
                        className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-gray-50"
                      >
                        {tx('Sau', 'Next', '下一页', '次へ', '다음')}
                      </button>
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </>
      )}

      {deleteConfirmMember ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          onKeyDown={(e) => {
            if (e.key === 'Escape' && deletingId == null) setDeleteConfirmMember(null)
          }}
        >
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl border border-gray-200 p-5 space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">
              {tx('Xóa tài khoản thành viên?', 'Delete this member?', '删除该会员？', 'この会員を削除しますか？', '이 회원을 삭제할까요?')}
            </h3>
            <p className="text-sm text-gray-600">
              {tx('Bạn sắp xóa vĩnh viễn tài khoản', 'This permanently deletes', '即将永久删除账户', '次のアカウントを完全に削除します', '다음 계정을 영구 삭제합니다')}{' '}
              <strong>{deleteConfirmMember.fullName?.trim() || `#${deleteConfirmMember.id.slice(0, 8)}`}</strong>
              {deleteConfirmMember.email ? (
                <>
                  {' '}
                  (<span className="font-mono">{deleteConfirmMember.email}</span>)
                </>
              ) : null}
              . {tx('Thao tác này không thể hoàn tác.', 'This cannot be undone.', '此操作无法撤销。', '元に戻せません。', '되돌릴 수 없습니다.')}
            </p>
            {deleteConfirmMember.hasLinkedAdmin ? (
              <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                {tx(
                  'Thành viên này có quyền quản trị web — liên kết sẽ được gỡ khi xóa.',
                  'This member has web admin access. The link is removed when the account is deleted.',
                  '该会员有网站管理权限，删除时会解除关联。',
                  'ウェブ管理権限があります。削除すると紐付けも外れます。',
                  '웹 관리 권한이 있습니다. 삭제하면 연결도 해제됩니다.'
                )}
              </p>
            ) : null}
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setDeleteConfirmMember(null)}
                disabled={deletingId != null}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {tx('Hủy', 'Cancel', '取消', 'キャンセル', '취소')}
              </button>
              <button
                type="button"
                onClick={() => void confirmDelete()}
                disabled={deletingId != null}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deletingId != null
                  ? tx('Đang xóa…', 'Deleting…', '正在删除…', '削除中…', '삭제 중…')
                  : tx('Xóa vĩnh viễn', 'Delete permanently', '永久删除', '完全に削除', '영구 삭제')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function MemberDetail(props: {
  locale: WebLocale
  loading: boolean
  missing: boolean
  member: MemberRow | null
  updating: boolean
  deleting: boolean
  onBack: () => void
  onToggle: () => void
  onDelete: () => void
}) {
  const { locale, loading, missing, member, updating, deleting, onBack, onToggle, onDelete } = props
  const tx = (vi: string, en: string, zh: string, ja: string, ko: string) => L(locale, vi, en, zh, ja, ko)
  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <button type="button" onClick={onBack} className="text-sm font-medium text-slate-600 hover:text-slate-900">
          ← {tx('Danh sách thành viên', 'Member list', '会员列表', '会員一覧', '회원 목록')}
        </button>
      </div>
      {loading ? (
        <div className="text-gray-500">{tx('Đang tải...', 'Loading...', '加载中...', '読み込み中...', '불러오는 중...')}</div>
      ) : missing || !member ? (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-gray-600">
          {tx('Không tìm thấy thành viên.', 'Member not found.', '找不到会员。', '会員が見つかりません。', '회원을 찾을 수 없습니다.')}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {member.fullName?.trim() || `${tx('Thành viên', 'Member', '会员', '会員', '회원')} #${member.id.slice(0, 8)}`}
              </h1>
              <p className="text-gray-500 text-sm mt-1 font-mono">ID: {member.id}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex px-2.5 py-1 rounded text-xs font-medium ${
                  member.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}
              >
                {member.isActive
                  ? tx('Đang hoạt động', 'Active', '使用中', '有効', '활성')
                  : tx('Đã khóa', 'Locked', '已锁定', 'ロック中', '잠김')}
              </span>
              <span
                className={`inline-flex px-2.5 py-1 rounded text-xs font-medium ${
                  member.isVerified ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-700'
                }`}
              >
                {member.isVerified
                  ? tx('Đã xác thực', 'Verified', '已验证', '確認済み', '인증됨')
                  : tx('Chưa xác thực', 'Not verified', '未验证', '未確認', '미인증')}
              </span>
              <button
                type="button"
                onClick={onToggle}
                disabled={updating || deleting}
                className={`px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 ${
                  member.isActive ? 'bg-amber-100 text-amber-900 hover:bg-amber-200' : 'bg-green-100 text-green-900 hover:bg-green-200'
                }`}
              >
                {updating
                  ? '...'
                  : member.isActive
                    ? tx('Khóa tài khoản', 'Lock account', '锁定账户', 'アカウントをロック', '계정 잠금')
                    : tx('Mở khóa', 'Unlock', '解锁', '解除', '해제')}
              </button>
              <button
                type="button"
                onClick={onDelete}
                disabled={deleting}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-red-100 text-red-900 hover:bg-red-200 disabled:opacity-50"
              >
                {tx('Xóa tài khoản', 'Delete account', '删除账户', 'アカウント削除', '계정 삭제')}
              </button>
            </div>
          </div>
          <div className="p-6 grid gap-6 sm:grid-cols-2">
            {member.avatar ? (
              <div className="sm:col-span-2 flex items-center gap-4">
                <div className="relative h-20 w-20 rounded-full overflow-hidden bg-gray-100 border border-gray-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={member.avatar} alt="" className="h-full w-full object-cover" />
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    {tx('Ảnh đại diện', 'Avatar', '头像', 'アバター', '프로필 사진')}
                  </p>
                  <p className="text-sm text-gray-700 break-all">{member.avatar}</p>
                </div>
              </div>
            ) : null}
            <DetailRow label="Email" value={member.email || '—'} mono />
            <DetailRow label={tx('Số điện thoại', 'Phone', '电话', '電話', '전화')} value={member.phone || '—'} mono />
            <DetailRow label={tx('Họ và tên', 'Full name', '姓名', '氏名', '이름')} value={member.fullName || '—'} />
            <DetailRow label={tx('Ngày sinh', 'Birthday', '生日', '生年月日', '생일')} value={formatBirthShort(member.dateOfBirth)} />
            <DetailRow label={tx('Giới tính', 'Gender', '性别', '性別', '성별')} value={formatGender(locale, member.gender)} />
            <DetailRow
              label={tx('Thời gian tạo tài khoản', 'Account created', '创建时间', '作成日時', '가입 시각')}
              value={formatDateTime(member.createdAt)}
            />
            <DetailRow
              label={tx('Cập nhật lần cuối', 'Last updated', '最后更新', '最終更新', '마지막 수정')}
              value={formatDateTime(member.updatedAt)}
            />
            <DetailRow
              label={tx('Đăng nhập gần nhất', 'Last login', '最近登录', '最終ログイン', '최근 로그인')}
              value={formatDateTime(member.lastLogin)}
            />
            <div className="sm:col-span-2">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                {tx('Địa chỉ', 'Address', '地址', '住所', '주소')}
              </p>
              <p className="text-gray-900 whitespace-pre-wrap">{member.address?.trim() || '—'}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-gray-900 break-all ${mono ? 'font-mono text-sm' : ''}`}>{value}</p>
    </div>
  )
}
