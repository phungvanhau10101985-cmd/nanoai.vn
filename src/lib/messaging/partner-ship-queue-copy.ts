import type { WebLocale } from '@/lib/i18n/config'

export type ShipQueueCopy = {
  title: string
  intro: string
  orderCount: string
  unshippedTotal: string
  periodAll: string
  periodDay: string
  periodWeek: string
  periodMonth: string
  viewOrder: string
  emptyPeriod: string
  periodOrders: string
  colOrder: string
  colCustomer: string
  colTotal: string
  colDays: string
  colDepositDate: string
  days: string
  empty: string
  loading: string
  loadError: string
  retry: string
  truncated: string
  dash: string
}

const COPY: Record<WebLocale, ShipQueueCopy> = {
  vi: {
    title: 'Hàng chờ gửi',
    intro: 'Đơn khách đã cọc, tổng tiền chưa gửi, và chưa có mã vận chuyển EMS.',
    orderCount: 'Số đơn',
    unshippedTotal: 'Tổng tiền chưa gửi',
    periodAll: 'Tất cả',
    periodDay: 'Ngày',
    periodWeek: 'Tuần',
    periodMonth: 'Tháng',
    viewOrder: 'Xem chi tiết đơn hàng',
    emptyPeriod: 'Không có đơn chờ gửi trong kỳ này.',
    periodOrders: '{n} đơn',
    colOrder: 'Mã đơn',
    colCustomer: 'Khách',
    colTotal: 'Tổng tiền',
    colDays: 'Số ngày',
    colDepositDate: 'Ngày bắt đầu cọc',
    days: '{n} ngày',
    empty: 'Không có đơn chờ gửi.',
    loading: 'Đang tải hàng chờ gửi…',
    loadError: 'Không tải được hàng chờ gửi.',
    retry: 'Thử lại',
    truncated: 'Danh sách hiện {n} đơn chờ lâu nhất. Tổng tiền phía trên gồm mọi đơn đang chờ.',
    dash: '—',
  },
  en: {
    title: 'Waiting to ship',
    intro: 'Deposited orders whose total has not shipped and that have no EMS tracking code.',
    orderCount: 'Orders',
    unshippedTotal: 'Unshipped total',
    periodAll: 'All',
    periodDay: 'Day',
    periodWeek: 'Week',
    periodMonth: 'Month',
    viewOrder: 'View order details',
    emptyPeriod: 'No orders are waiting to ship in this period.',
    periodOrders: '{n} orders',
    colOrder: 'Order',
    colCustomer: 'Customer',
    colTotal: 'Total',
    colDays: 'Days',
    colDepositDate: 'Deposit started',
    days: '{n} days',
    empty: 'No orders are waiting to ship.',
    loading: 'Loading the ship queue…',
    loadError: 'Could not load the ship queue.',
    retry: 'Retry',
    truncated: 'Showing the {n} orders waiting the longest. The total above includes every waiting order.',
    dash: '—',
  },
  zh: {
    title: '待发货',
    intro: '客户已付定金、货款尚未发出、且还没有 EMS 运单号的订单。',
    orderCount: '订单数',
    unshippedTotal: '未发货总额',
    periodAll: '全部',
    periodDay: '日',
    periodWeek: '周',
    periodMonth: '月',
    viewOrder: '查看订单详情',
    emptyPeriod: '这个周期没有待发货订单。',
    periodOrders: '{n} 单',
    colOrder: '订单号',
    colCustomer: '客户',
    colTotal: '总额',
    colDays: '天数',
    colDepositDate: '开始付定金',
    days: '{n} 天',
    empty: '没有待发货订单。',
    loading: '正在加载待发货…',
    loadError: '无法加载待发货列表。',
    retry: '重试',
    truncated: '列表显示等待最久的 {n} 单。上方总额包含全部待发货订单。',
    dash: '—',
  },
  ja: {
    title: '発送待ち',
    intro: '入金済みで、代金が未発送、かつ EMS 伝票番号がない注文です。',
    orderCount: '件数',
    unshippedTotal: '未発送の合計',
    periodAll: 'すべて',
    periodDay: '日',
    periodWeek: '週',
    periodMonth: '月',
    viewOrder: '注文詳細を見る',
    emptyPeriod: 'この期間に発送待ちの注文はありません。',
    periodOrders: '{n}件',
    colOrder: '注文番号',
    colCustomer: 'お客様',
    colTotal: '合計',
    colDays: '日数',
    colDepositDate: '入金開始日',
    days: '{n}日',
    empty: '発送待ちの注文はありません。',
    loading: '発送待ちを読み込み中…',
    loadError: '発送待ちを読み込めませんでした。',
    retry: '再試行',
    truncated: '待ち日数が長い {n} 件を表示しています。上の合計は待ち注文のすべてを含みます。',
    dash: '—',
  },
  ko: {
    title: '발송 대기',
    intro: '고객이 계약금을 냈고, 총액이 아직 발송되지 않았으며 EMS 운송장이 없는 주문입니다.',
    orderCount: '주문 수',
    unshippedTotal: '미발송 총액',
    periodAll: '전체',
    periodDay: '일',
    periodWeek: '주',
    periodMonth: '월',
    viewOrder: '주문 상세 보기',
    emptyPeriod: '이 기간에 발송 대기 주문이 없습니다.',
    periodOrders: '{n}건',
    colOrder: '주문번호',
    colCustomer: '고객',
    colTotal: '총액',
    colDays: '일수',
    colDepositDate: '계약금 시작일',
    days: '{n}일',
    empty: '발송 대기 주문이 없습니다.',
    loading: '발송 대기를 불러오는 중…',
    loadError: '발송 대기를 불러오지 못했습니다.',
    retry: '다시 시도',
    truncated: '가장 오래 기다린 {n}건을 표시합니다. 위 총액은 대기 주문 전체를 포함합니다.',
    dash: '—',
  },
}

export function shipQueueCopy(locale: WebLocale | undefined): ShipQueueCopy {
  return COPY[locale && locale in COPY ? locale : 'vi']
}

export function fillShipQueueCopy(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''))
}
