import type { WebLocale } from '@/lib/i18n/config'

export type PartnerShippingOpsCopy = {
  shopPartTitle: string
  shopPartHint: string
  lookupPartTitle: string
  lookupPartHint: string
  emsTitle: string
  emsHint: string
  searchTitle: string
  searchHint: string
  searchPlaceholder: string
  searchButton: string
  searchClear: string
  opsTitle: string
  opsRefresh: string
  timelineTitle: string
  receivedTitle: string
  importEmsTitle: string
  importEmsHint: string
  importCodTitle: string
  importCodHint: string
  returnTitle: string
  returnHint: string
  warehouseTitle: string
  warehouseHint: string
  freightTitle: string
  freightHint: string
  tableTitle: string
  syncStatsTitle: string
  downloadSample: string
  importRun: string
  trackingRefresh: string
  deleteSelected: string
  confirmDelete: string
  noRows: string
  loadError: string
  importReport: string
  batchHistory: string
  createdCount: string
  updatedCount: string
  matched: string
  mismatch: string
  notInDb: string
  totalPaid: string
  difference: string
  filterAll: string
  highFee: string
  settled: string
  alreadySettled: string
  confirmable: string
  alreadyReturned: string
  notReady: string
  warehouseStock: string
  warehouseClearanceBadge: string
  warehouseIntakeOk: string
  selectRowsToTrack: string
  xlsHint: string
  colorLabel: string
  sizeLabel: string
  previewAuto: string
  confirmReturn: string
  viewStatus: string
  dateFrom: string
  dateTo: string
  yearLabel: string
  clearFilter: string
  closePanel: string
  emsEvents: string
  refreshOne: string
  syncInProgress: string
  syncUnlinked: string
  syncEmsMissing: string
  syncParseError: string
  syncMatched: string
  syncMismatch: string
  prevPage: string
  nextPage: string
  perPage: string
  colTracking: string
  colOrder: string
  colCustomer: string
  colEmsStatus: string
  colCod: string
  colFreight: string
  colSync: string
  colActions: string
  deletedCount: string
  trackingProgress: string
  loadingStats: string
}

const COPY: Record<WebLocale, PartnerShippingOpsCopy> = {
  vi: {
    shopPartTitle: '1. Quản lý vận chuyển web shop',
    shopPartHint:
      'Phí ship, đơn vị vận chuyển, địa chỉ hoàn hàng, và vận hành EMS/COD trên chính shop NanoAI (giống admin 188: import gửi EMS, đối soát COD, hoàn trả shop, đối soát cước).',
    lookupPartTitle: '2. API vận chuyển web khách khác hệ thống',
    lookupPartHint:
      'Khi khách hỏi đơn trên chat, NanoAI gọi HTTPS cổng tra cứu của website khách (URL + API key). Shop NanoAI không cần cổng này — tra cứu đọc bảng EMS/đơn shop.',
    emsTitle: 'Quản lý vận chuyển EMS',
    emsHint:
      'Import file gửi EMS: cột A mã vận đơn, I mã đơn shop (DHxxx/DCxxx), G COD, D tên khách. Khi khớp đơn shop, timeline ghi «Shop đã gửi EMS giao hàng».',
    searchTitle: 'Tra cứu vận đơn',
    searchHint: 'Tìm theo mã đơn shop (DH/DC), số điện thoại, mã tham chiếu, mã EMS hoặc mã vận đã lưu trên đơn.',
    searchPlaceholder: 'VD: 0369597965, DH033, EE123456789VN…',
    searchButton: 'Tra cứu',
    searchClear: 'Xóa tìm',
    opsTitle: 'Tổng quan vận hành',
    opsRefresh: 'Làm mới',
    timelineTitle: 'Theo dõi theo đơn nhập',
    receivedTitle: 'Theo dữ liệu thực nhận',
    importEmsTitle: '1. Upload file Excel gửi EMS',
    importEmsHint:
      'File gui ems.xlsx (hoặc .xls): cột A mã vận đơn, I mã đơn shop, G COD, D tên khách. Cột TRONG_LUONG đơn vị gram (g), không phải kg. Import lần 2: mã cột A đã có thì cập nhật. Sau import tự tra MyEMS nền; xem báo cáo từng dòng bên dưới.',
    importCodTitle: '2. Import đối soát COD EMS trả shop',
    importCodHint: 'Excel EMS trả tiền (.xls/.xlsx): E1 ngày trả, từ hàng 3 — cột B mã tham chiếu, C mã EMS, D số tiền. Xem đợt cũ + lọc khớp/lệch.',
    returnTitle: '3. Xác nhận đơn hoàn đã trả shop',
    returnHint: 'Dán mã đơn / mã EMS. Chỉ xác nhận khi EMS đã báo hoàn (phát hoàn / chuyển hoàn). Xem trước tự chạy khi gõ.',
    warehouseTitle: 'Nhập hàng hoàn vào kho thanh lý',
    warehouseHint: 'Đọc SKU kho từ mã vận / mã SP, hiện ảnh/tồn rồi cộng kho. Có thể chọn size/màu và đánh dấu thanh lý.',
    freightTitle: '4. Import đối soát cước',
    freightHint: 'Excel cước (.xls/.xlsx): cột A mã EMS, C ngày, L phí. Cảnh báo phí ≥ 70.000 đ. Xem đợt cũ + dòng phí cao.',
    tableTitle: 'Bảng vận chuyển EMS',
    syncStatsTitle: 'Thống kê theo trạng thái đối chiếu',
    downloadSample: 'Tải file mẫu',
    importRun: 'Import & đối chiếu',
    trackingRefresh: 'Tra lại EMS',
    deleteSelected: 'Xóa dòng đã chọn',
    confirmDelete: 'Xóa các vận đơn đã chọn khỏi bảng EMS? Đơn shop không bị xóa.',
    noRows: 'Chưa có vận đơn EMS.',
    loadError: 'Không tải được dữ liệu vận chuyển.',
    importReport: 'Báo cáo import',
    batchHistory: 'Đợt đã import',
    createdCount: 'mới',
    updatedCount: 'cập nhật',
    matched: 'Khớp',
    mismatch: 'Lệch tiền',
    notInDb: 'Không có trên DB',
    totalPaid: 'Tổng EMS trả',
    difference: 'Chênh lệch',
    filterAll: 'Tất cả',
    highFee: 'Phí ≥ 70k',
    settled: 'Đã ghi cước',
    alreadySettled: 'Đã đối soát trước',
    confirmable: 'Có thể xác nhận',
    alreadyReturned: 'Đã trả shop',
    notReady: 'Chưa báo hoàn',
    warehouseStock: 'Tồn kho',
    warehouseClearanceBadge: 'Thanh lý',
    warehouseIntakeOk: 'Đã cộng tồn',
    selectRowsToTrack: 'Chọn dòng hoặc tra cứu trước khi Tra lại EMS.',
    xlsHint: 'Nhận .xls / .xlsx / .xlsm',
    colorLabel: 'Màu',
    sizeLabel: 'Size',
    previewAuto: 'Xem trước tự chạy khi gõ',
    confirmReturn: 'Xác nhận trả shop',
    viewStatus: 'Xem trạng thái',
    dateFrom: 'Từ ngày',
    dateTo: 'Đến ngày',
    yearLabel: 'Năm',
    clearFilter: 'Xóa lọc kỳ',
    closePanel: 'Đóng',
    emsEvents: 'Hành trình EMS',
    refreshOne: 'Tra lại',
    syncInProgress: 'Đang xử lý',
    syncUnlinked: 'Chưa ghép đơn',
    syncEmsMissing: 'Không tra EMS',
    syncParseError: 'Lỗi parse',
    syncMatched: 'Khớp',
    syncMismatch: 'Lệch trạng thái',
    prevPage: 'Trước',
    nextPage: 'Sau',
    perPage: '/trang',
    colTracking: 'Mã vận / EMS',
    colOrder: 'Đơn shop',
    colCustomer: 'Khách',
    colEmsStatus: 'EMS',
    colCod: 'COD',
    colFreight: 'Cước',
    colSync: 'Đối chiếu',
    colActions: 'Thao tác',
    deletedCount: 'Đã xóa {n} dòng.',
    trackingProgress: 'Tra EMS {processed}/{total}',
    loadingStats: 'Đang tải thống kê…',
  },
  en: {
    shopPartTitle: '1. Shop website shipping',
    shopPartHint:
      'Shipping fee, carrier, return address, and EMS/COD operations on this NanoAI shop (import EMS, COD settlement, shop returns, freight).',
    lookupPartTitle: '2. External customer-site shipping API',
    lookupPartHint:
      'When customers ask about orders in chat, NanoAI calls their website shipping lookup (URL + API key). NanoAI shops do not need this — lookup reads EMS/order tables.',
    emsTitle: 'EMS shipping management',
    emsHint: 'Import EMS handover Excel: column A tracking, I shop order (DHxxx/DCxxx), G COD, D customer name.',
    searchTitle: 'Look up shipment',
    searchHint: 'Search by shop order code, phone, reference, EMS code, or saved tracking.',
    searchPlaceholder: 'e.g. 0369597965, DH033, EE123456789VN…',
    searchButton: 'Search',
    searchClear: 'Clear',
    opsTitle: 'Operations overview',
    opsRefresh: 'Refresh',
    timelineTitle: 'By import date',
    receivedTitle: 'Actually received',
    importEmsTitle: '1. Upload EMS handover Excel',
    importEmsHint: 'gui ems.xlsx / .xls: A tracking, I shop order, G COD, D name. TRONG_LUONG is grams (g), not kg. Re-import updates existing A codes. MyEMS tracking starts automatically; see the row report below.',
    importCodTitle: '2. Import COD settlement',
    importCodHint: 'EMS payout Excel (.xls/.xlsx): E1 payment date; from row 3 — B reference, C EMS, D amount. Open past batches and filter matched/mismatch.',
    returnTitle: '3. Confirm returns received by shop',
    returnHint: 'Paste order / EMS codes. Confirm only after EMS reports a return. Preview runs as you type.',
    warehouseTitle: 'Intake returns into clearance stock',
    warehouseHint: 'Resolve warehouse SKU from tracking / product code, show photo/stock, then add qty. Optional size/color and clearance.',
    freightTitle: '4. Import freight settlement',
    freightHint: 'Freight Excel (.xls/.xlsx): A EMS code, C date, L fee. Warn when fee ≥ 70,000. Open past batches and high-fee rows.',
    tableTitle: 'EMS shipments',
    syncStatsTitle: 'Reconcile status',
    downloadSample: 'Download sample',
    importRun: 'Import & match',
    trackingRefresh: 'Refresh EMS',
    deleteSelected: 'Delete selected',
    confirmDelete: 'Delete selected EMS rows? Shop orders are not deleted.',
    noRows: 'No EMS shipments yet.',
    loadError: 'Could not load shipping data.',
    importReport: 'Import report',
    batchHistory: 'Past batches',
    createdCount: 'created',
    updatedCount: 'updated',
    matched: 'Matched',
    mismatch: 'Amount mismatch',
    notInDb: 'Not in DB',
    totalPaid: 'EMS paid total',
    difference: 'Difference',
    filterAll: 'All',
    highFee: 'Fee ≥ 70k',
    settled: 'Freight recorded',
    alreadySettled: 'Already settled',
    confirmable: 'Ready to confirm',
    alreadyReturned: 'Already received',
    notReady: 'EMS has not reported return',
    warehouseStock: 'Stock',
    warehouseClearanceBadge: 'Clearance',
    warehouseIntakeOk: 'Stock added',
    selectRowsToTrack: 'Select rows or search before refreshing EMS.',
    xlsHint: 'Accepts .xls / .xlsx / .xlsm',
    colorLabel: 'Color',
    sizeLabel: 'Size',
    previewAuto: 'Preview updates as you type',
    confirmReturn: 'Confirm shop received',
    viewStatus: 'View status',
    dateFrom: 'From',
    dateTo: 'To',
    yearLabel: 'Year',
    clearFilter: 'Clear period filter',
    closePanel: 'Close',
    emsEvents: 'EMS timeline',
    refreshOne: 'Refresh',
    syncInProgress: 'In progress',
    syncUnlinked: 'Unlinked',
    syncEmsMissing: 'EMS not found',
    syncParseError: 'Parse error',
    syncMatched: 'Matched',
    syncMismatch: 'Status mismatch',
    prevPage: 'Prev',
    nextPage: 'Next',
    perPage: '/page',
    colTracking: 'Tracking / EMS',
    colOrder: 'Shop order',
    colCustomer: 'Customer',
    colEmsStatus: 'EMS',
    colCod: 'COD',
    colFreight: 'Freight',
    colSync: 'Sync',
    colActions: 'Actions',
    deletedCount: 'Deleted {n} rows.',
    trackingProgress: 'EMS refresh {processed}/{total}',
    loadingStats: 'Loading stats…',
  },
  zh: {
    shopPartTitle: '1. 本店网站物流',
    shopPartHint: '运费、承运商、退货地址，以及本店 EMS/货到付款作业（导入、对账、退回、运费）。',
    lookupPartTitle: '2. 外部客户网站物流 API',
    lookupPartHint: '顾客在聊天中询问订单时，NanoAI 调用其网站物流查询（URL + API key）。NanoAI 本店无需此接口。',
    emsTitle: 'EMS 物流管理',
    emsHint: '导入 EMS 交接表：A 运单、I 店铺订单、G COD、D 客户名。',
    searchTitle: '查询运单',
    searchHint: '按店铺订单号、电话、参考号、EMS 或已保存运单号查询。',
    searchPlaceholder: '例如 0369597965、DH033、EE123456789VN…',
    searchButton: '查询',
    searchClear: '清除',
    opsTitle: '运营概览',
    opsRefresh: '刷新',
    timelineTitle: '按导入日期',
    receivedTitle: '实际到账/收回',
    importEmsTitle: '1. 上传 EMS 交接 Excel',
    importEmsHint: 'gui ems.xlsx / .xls：A 运单、I 订单、G COD、D 姓名。TRONG_LUONG 单位为克 (g)，不是千克。再次导入会更新已有 A 码。导入后自动查询 MyEMS，见下方逐行报告。',
    importCodTitle: '2. 导入 COD 对账',
    importCodHint: 'EMS 打款表（.xls/.xlsx）：E1 日期；第 3 行起 B 参考号、C EMS、D 金额。可打开历史批次并筛选相符/差额。',
    returnTitle: '3. 确认退件已回店',
    returnHint: '粘贴订单/EMS 号。仅当 EMS 已报退（退回发件人）才可确认。输入时自动预览。',
    warehouseTitle: '退件入库清仓',
    warehouseHint: '从运单/货号解析仓库 SKU，显示图片/库存后再加库存。可选尺码/颜色并标记清仓。',
    freightTitle: '4. 导入运费对账',
    freightHint: '运费表（.xls/.xlsx）：A EMS、C 日期、L 费用。费用 ≥ 70,000 会警示。可打开历史批次与高费用行。',
    tableTitle: 'EMS 运单表',
    syncStatsTitle: '对账状态',
    downloadSample: '下载模板',
    importRun: '导入并对账',
    trackingRefresh: '重新查询 EMS',
    deleteSelected: '删除所选',
    confirmDelete: '删除所选 EMS 行？不会删除店铺订单。',
    noRows: '暂无 EMS 运单。',
    loadError: '无法加载物流数据。',
    importReport: '导入报告',
    batchHistory: '历史批次',
    createdCount: '新增',
    updatedCount: '更新',
    matched: '相符',
    mismatch: '金额不符',
    notInDb: '库中无此单',
    totalPaid: 'EMS 打款合计',
    difference: '差额',
    filterAll: '全部',
    highFee: '费用 ≥ 70k',
    settled: '已记运费',
    alreadySettled: '此前已对账',
    confirmable: '可确认',
    alreadyReturned: '店已收回',
    notReady: 'EMS 尚未报退',
    warehouseStock: '库存',
    warehouseClearanceBadge: '清仓',
    warehouseIntakeOk: '已加库存',
    selectRowsToTrack: '请先勾选或搜索后再重新查询 EMS。',
    xlsHint: '支持 .xls / .xlsx / .xlsm',
    colorLabel: '颜色',
    sizeLabel: '尺码',
    previewAuto: '输入时自动预览',
    confirmReturn: '确认店已收回',
    viewStatus: '查看状态',
    dateFrom: '开始日期',
    dateTo: '结束日期',
    yearLabel: '年份',
    clearFilter: '清除期间筛选',
    closePanel: '关闭',
    emsEvents: 'EMS 轨迹',
    refreshOne: '重新查询',
    syncInProgress: '处理中',
    syncUnlinked: '未匹配订单',
    syncEmsMissing: '未查到 EMS',
    syncParseError: '解析错误',
    syncMatched: '匹配',
    syncMismatch: '状态不符',
    prevPage: '上一页',
    nextPage: '下一页',
    perPage: '/页',
    colTracking: '运单 / EMS',
    colOrder: '店铺订单',
    colCustomer: '客户',
    colEmsStatus: 'EMS',
    colCod: '货到付款',
    colFreight: '运费',
    colSync: '对照',
    colActions: '操作',
    deletedCount: '已删除 {n} 行。',
    trackingProgress: '查询 EMS {processed}/{total}',
    loadingStats: '正在加载统计…',
  },
  ja: {
    shopPartTitle: '1. 自店サイトの配送管理',
    shopPartHint: '送料、配送業者、返送先、および本店の EMS/代引運用（取込・照合・返品・運賃）。',
    lookupPartTitle: '2. 外部顧客サイトの配送 API',
    lookupPartHint:
      'チャットで注文を尋ねられたとき、NanoAI は顧客サイトの照会 API（URL + API key）を呼びます。NanoAI 店舗はこの設定なしでも EMS/注文表を参照します。',
    emsTitle: 'EMS 配送管理',
    emsHint: 'EMS 引渡し Excel：A 追跡番号、I 店舗注文、G 代引、D 氏名。',
    searchTitle: '追跡照会',
    searchHint: '店舗注文番号、電話、参照番号、EMS、保存済み追跡番号で検索。',
    searchPlaceholder: '例: 0369597965, DH033, EE123456789VN…',
    searchButton: '検索',
    searchClear: 'クリア',
    opsTitle: '運用概要',
    opsRefresh: '更新',
    timelineTitle: '取込日別',
    receivedTitle: '実入金・実受領',
    importEmsTitle: '1. EMS 引渡し Excel をアップロード',
    importEmsHint: 'gui ems.xlsx / .xls：A 追跡、I 注文、G 代引、D 氏名。TRONG_LUONG の単位はグラム (g) で、kg ではありません。再取込は既存 A を更新。取込後 MyEMS を自動照会し、下の行レポートを確認。',
    importCodTitle: '2. 代引照合を取込',
    importCodHint: 'EMS 入金表（.xls/.xlsx）：E1 日付。3 行目から B 参照、C EMS、D 金額。過去バッチを開き一致/差額で絞り込み。',
    returnTitle: '3. 返送が店舗に戻ったことを確認',
    returnHint: '注文/EMS 番号を貼り付け。EMS が返送を報告した場合のみ確認できます。入力中にプレビューします。',
    warehouseTitle: '返品を在庫（セール）へ入庫',
    warehouseHint: '追跡/品番から倉庫 SKU を解決し、写真/在庫を表示してから加算。サイズ/色とセールマークを選べます。',
    freightTitle: '4. 運賃照合を取込',
    freightHint: '運賃表（.xls/.xlsx）：A EMS、C 日付、L 料金。70,000 以上は警告。過去バッチと高額行を表示。',
    tableTitle: 'EMS 一覧',
    syncStatsTitle: '照合ステータス',
    downloadSample: 'サンプルをダウンロード',
    importRun: '取込して照合',
    trackingRefresh: 'EMS を再照会',
    deleteSelected: '選択を削除',
    confirmDelete: '選択した EMS 行を削除しますか？店舗注文は削除されません。',
    noRows: 'EMS 出荷はまだありません。',
    loadError: '配送データを読み込めません。',
    importReport: '取込レポート',
    batchHistory: '過去の取込',
    createdCount: '新規',
    updatedCount: '更新',
    matched: '一致',
    mismatch: '金額差',
    notInDb: 'DB になし',
    totalPaid: 'EMS 入金合計',
    difference: '差額',
    filterAll: 'すべて',
    highFee: '料金 ≥ 70k',
    settled: '運賃を記録',
    alreadySettled: '以前に照合済み',
    confirmable: '確認可能',
    alreadyReturned: '店舗受領済み',
    notReady: 'EMS 未返送',
    warehouseStock: '在庫',
    warehouseClearanceBadge: 'セール',
    warehouseIntakeOk: '在庫を加算しました',
    selectRowsToTrack: 'EMS 再照会の前に行を選択するか検索してください。',
    xlsHint: '.xls / .xlsx / .xlsm 対応',
    colorLabel: '色',
    sizeLabel: 'サイズ',
    previewAuto: '入力中にプレビュー',
    confirmReturn: '店舗受領を確認',
    viewStatus: '状態を見る',
    dateFrom: '開始日',
    dateTo: '終了日',
    yearLabel: '年',
    clearFilter: '期間フィルタを解除',
    closePanel: '閉じる',
    emsEvents: 'EMS 履歴',
    refreshOne: '再照会',
    syncInProgress: '処理中',
    syncUnlinked: '未照合',
    syncEmsMissing: 'EMS なし',
    syncParseError: '解析エラー',
    syncMatched: '一致',
    syncMismatch: '状態不一致',
    prevPage: '前へ',
    nextPage: '次へ',
    perPage: '/ページ',
    colTracking: '伝票 / EMS',
    colOrder: '店舗注文',
    colCustomer: '顧客',
    colEmsStatus: 'EMS',
    colCod: '代引',
    colFreight: '運賃',
    colSync: '照合',
    colActions: '操作',
    deletedCount: '{n} 行を削除しました。',
    trackingProgress: 'EMS 照会 {processed}/{total}',
    loadingStats: '統計を読み込み中…',
  },
  ko: {
    shopPartTitle: '1. 자사 웹샵 배송 관리',
    shopPartHint: '배송비, 운송사, 반송 주소, 그리고 이 샵의 EMS/착불 운영(가져오기, 대사, 반품, 운임).',
    lookupPartTitle: '2. 외부 고객 사이트 배송 API',
    lookupPartHint:
      '채팅에서 주문을 물으면 NanoAI가 고객 사이트 조회 API(URL + API key)를 호출합니다. NanoAI 샵은 이 설정 없이 EMS/주문 표를 읽습니다.',
    emsTitle: 'EMS 배송 관리',
    emsHint: 'EMS 인계 엑셀: A 운송장, I 샵 주문, G COD, D 고객명.',
    searchTitle: '운송장 조회',
    searchHint: '샵 주문번호, 전화, 참조번호, EMS, 저장된 운송장으로 검색.',
    searchPlaceholder: '예: 0369597965, DH033, EE123456789VN…',
    searchButton: '조회',
    searchClear: '지우기',
    opsTitle: '운영 개요',
    opsRefresh: '새로고침',
    timelineTitle: '가져오기 날짜별',
    receivedTitle: '실제 수령',
    importEmsTitle: '1. EMS 인계 엑셀 업로드',
    importEmsHint: 'gui ems.xlsx / .xls: A 운송장, I 주문, G COD, D 이름. TRONG_LUONG 단위는 그램(g)이며 kg가 아닙니다. 재가져오기는 기존 A를 갱신. 가져온 뒤 MyEMS를 자동 조회하며 아래 행 보고서를 봅니다.',
    importCodTitle: '2. COD 대사 가져오기',
    importCodHint: 'EMS 지급 엑셀(.xls/.xlsx): E1 날짜, 3행부터 B 참조, C EMS, D 금액. 이전 배치를 열고 일치/차액을 필터합니다.',
    returnTitle: '3. 반품이 샵에 도착했음을 확인',
    returnHint: '주문/EMS 코드를 붙여넣기. EMS가 반송을 보고한 경우에만 확인. 입력하는 동안 미리보기가 실행됩니다.',
    warehouseTitle: '반품을 클리어런스 재고로 입고',
    warehouseHint: '운송장/상품코드에서 창고 SKU를 찾아 사진/재고를 본 뒤 가산. 사이즈/색과 클리어런스를 선택할 수 있습니다.',
    freightTitle: '4. 운임 대사 가져오기',
    freightHint: '운임 엑셀(.xls/.xlsx): A EMS, C 날짜, L 요금. 70,000 이상은 경고. 이전 배치와 고액 행을 봅니다.',
    tableTitle: 'EMS 목록',
    syncStatsTitle: '대사 상태',
    downloadSample: '샘플 다운로드',
    importRun: '가져오기 및 대사',
    trackingRefresh: 'EMS 다시 조회',
    deleteSelected: '선택 삭제',
    confirmDelete: '선택한 EMS 행을 삭제할까요? 샵 주문은 삭제되지 않습니다.',
    noRows: 'EMS 운송장이 없습니다.',
    loadError: '배송 데이터를 불러올 수 없습니다.',
    importReport: '가져오기 보고서',
    batchHistory: '이전 배치',
    createdCount: '신규',
    updatedCount: '갱신',
    matched: '일치',
    mismatch: '금액 차이',
    notInDb: 'DB에 없음',
    totalPaid: 'EMS 지급 합계',
    difference: '차액',
    filterAll: '전체',
    highFee: '요금 ≥ 70k',
    settled: '운임 기록',
    alreadySettled: '이미 대사됨',
    confirmable: '확인 가능',
    alreadyReturned: '샵 수령됨',
    notReady: 'EMS 미반송',
    warehouseStock: '재고',
    warehouseClearanceBadge: '클리어런스',
    warehouseIntakeOk: '재고를 더했습니다',
    selectRowsToTrack: 'EMS를 다시 조회하기 전에 행을 선택하거나 검색하세요.',
    xlsHint: '.xls / .xlsx / .xlsm 지원',
    colorLabel: '색상',
    sizeLabel: '사이즈',
    previewAuto: '입력하는 동안 미리보기',
    confirmReturn: '샵 수령 확인',
    viewStatus: '상태 보기',
    dateFrom: '시작일',
    dateTo: '종료일',
    yearLabel: '연도',
    clearFilter: '기간 필터 지우기',
    closePanel: '닫기',
    emsEvents: 'EMS 경로',
    refreshOne: '다시 조회',
    syncInProgress: '처리 중',
    syncUnlinked: '미연결',
    syncEmsMissing: 'EMS 없음',
    syncParseError: '파싱 오류',
    syncMatched: '일치',
    syncMismatch: '상태 불일치',
    prevPage: '이전',
    nextPage: '다음',
    perPage: '/페이지',
    colTracking: '운송장 / EMS',
    colOrder: '샵 주문',
    colCustomer: '고객',
    colEmsStatus: 'EMS',
    colCod: '착불',
    colFreight: '운임',
    colSync: '대사',
    colActions: '작업',
    deletedCount: '{n}행을 삭제했습니다.',
    trackingProgress: 'EMS 조회 {processed}/{total}',
    loadingStats: '통계를 불러오는 중…',
  },
}

export function partnerShippingOpsCopy(locale: WebLocale): PartnerShippingOpsCopy {
  return COPY[locale] || COPY.vi
}
