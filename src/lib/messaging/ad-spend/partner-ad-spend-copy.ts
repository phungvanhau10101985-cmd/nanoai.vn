import type { WebLocale } from '@/lib/i18n/config'
import type { SettingsDataRoleCopy } from '@/lib/messaging/settings-data-role'

export type AdSpendPageCopy = {
  title: string
  intro: string
  badRange: string
  from: string
  to: string
  viewPeriod: string
  reading: string
  calculating: string
  viewing: string
  wholePeriod: string
  eachDay: string
  adSpend: string
  profit: string
  google: string
  facebook: string
  revenue: string
  cost: string
  costHint: string
  missingCostShort: string
  returnedRevenue: string
  googlePlusFacebook: string
  mixedCurrency: string
  dash: string
  notConfigured: string
  unreadable: string
  clicksImpressions: string
  depositedHint: string
  missingCost: string
  grossBeforeAds: string
  orders: string
  dailyTitle: string
  dailyHint: string
  noSpend: string
  day: string
  total: string
  campaign: string
  clicks: string
  noCampaigns: string
  partial: string
  keysTitle: string
  open: string
  close: string
  googleTitle: string
  facebookTitle: string
  googleLead: string
  facebookLead: string
  googleSteps: string[]
  facebookSteps: string[]
  customerId: string
  mcc: string
  developerToken: string
  clientId: string
  clientSecret: string
  refreshToken: string
  adAccountId: string
  accessToken: string
  savedKeep: string
  missingSecret: string
  clearGoogle: string
  clearFacebook: string
  saveKeys: string
  saving: string
  savedToast: string
  guideTitle: string
  profitTitle: string
  profitBody: string
  rate: string
  shipChina: string
  shipBorder: string
  shipHanoi: string
  saveRates: string
  savingRates: string
  savedRates: string
  badMoney: string
  badCell: string
  goodsPlaceholder: string
  returnedLine: string
  revenueTitle: string
  returnedTitle: string
  goodsAria: string
  shipChinaAria: string
  shipBorderAria: string
  shipHanoiAria: string
  manualAds: string
  manualAdsHint: string
  shipNote: string
  missingGoods: string
  truncated: string
  noOrders: string
  loadingOrders: string
  retry: string
  colOrder: string
  colDate: string
  colRevenue: string
  colGoods: string
  colImport: string
  colShipChina: string
  colShipBorder: string
  colShipHanoi: string
  colCny: string
  colCost: string
  colGross: string
  presets: Record<'today' | 'yesterday' | 'week' | 'prevWeek' | '7' | '30' | 'month' | 'prev', string>
  role: SettingsDataRoleCopy
}

const vi: AdSpendPageCopy = {
  title: 'Lợi nhuận',
  intro: 'Chọn hôm nay, tuần hoặc tháng. Chi phí quảng cáo Google và Facebook cùng lợi nhuận của kỳ đó hiện ngay bên dưới.',
  badRange: 'Chọn ngày bắt đầu trước hoặc bằng ngày kết thúc.',
  from: 'Từ',
  to: 'Đến',
  viewPeriod: 'Xem kỳ này',
  reading: 'Đang đọc…',
  calculating: 'Đang tính…',
  viewing: 'Đang xem',
  wholePeriod: 'Cả kỳ',
  eachDay: 'Từng ngày — bấm để xem số của ngày đó',
  adSpend: 'Chi phí quảng cáo',
  profit: 'Lợi nhuận',
  google: 'Google Ads',
  facebook: 'Facebook Ads',
  revenue: 'Doanh thu đã cọc',
  cost: 'Giá vốn',
  costHint: 'Giá hàng và ship',
  missingCostShort: 'Còn đơn thiếu giá nhập',
  returnedRevenue: '{n} đơn · trừ {amount} chưa cọc của {returned} đơn hoàn',
  googlePlusFacebook: 'Google + Facebook',
  mixedCurrency: 'Google và Facebook không cùng đơn vị tiền',
  dash: '—',
  notConfigured: 'Chưa cấu hình',
  unreadable: 'Không đọc được',
  clicksImpressions: '{clicks} lượt nhấn · {impressions} lượt hiển thị',
  depositedHint: 'Đơn đã cọc trong kỳ đang chọn',
  missingCost: '{n} đơn còn thiếu giá nhập',
  grossBeforeAds: '{n} đơn · lãi trước quảng cáo {amount}',
  orders: '{n} đơn',
  dailyTitle: 'Chi tiết theo ngày',
  dailyHint: 'Bấm một dòng để đưa chi phí và lợi nhuận của ngày đó lên trên.',
  noSpend: 'Không có chi phí trong khoảng này.',
  day: 'Ngày',
  total: 'Tổng',
  campaign: 'Chiến dịch',
  clicks: 'Nhấn',
  noCampaigns: 'Không có chiến dịch phát sinh chi phí.',
  partial: 'Kỳ này có nhiều dòng hơn mức đã tải. Rút ngắn khoảng ngày để xem đủ chi phí.',
  keysTitle: 'Khóa kết nối',
  open: 'Mở',
  close: 'Thu gọn',
  googleTitle: 'Google Ads',
  facebookTitle: 'Facebook Ads',
  googleLead: 'Dán khóa đọc của tài khoản quảng cáo shop này. Ô khóa để trống nghĩa là giữ khóa đã lưu. API đang dùng {version}.',
  facebookLead: 'Token hệ thống trong Business Manager, quyền ads_read. ID tài khoản là dãy số, có hoặc không có act_. Graph đang dùng {version}.',
  googleSteps: [
    'Vào Google Ads → Công cụ → Trung tâm API, xin developer token (quyền chỉ đọc là đủ).',
    'Trên Google Cloud tạo OAuth client (ứng dụng web hoặc máy tính), lấy Client ID và Client secret.',
    'Xin refresh token với phạm vi https://www.googleapis.com/auth/adwords. Giữ token này, không dán access token ngắn hạn.',
    'Customer ID là 10 số trên góc tài khoản Google Ads, bỏ dấu gạch. Nếu quản lý qua MCC thì điền thêm ID tài khoản quản lý.',
    'Lưu khóa. Trang đọc chi phí của kỳ đang chọn và trừ một lần vào lợi nhuận, không chia vào từng đơn.',
  ],
  facebookSteps: [
    'Mở Meta Business Manager → Người dùng hệ thống, tạo token có quyền ads_read.',
    'Lấy Ad account ID trong Cài đặt tài khoản quảng cáo (dãy số, act_ có thể bỏ).',
    'Dán token và ID vào ô xanh lá rồi Lưu khóa. Token không hiện lại sau khi lưu.',
    'Chi phí Facebook cộng với Google khi cả hai cùng đơn vị tiền. Khác tiền tệ thì tổng không cộng dồn.',
  ],
  customerId: 'Customer ID',
  mcc: 'ID tài khoản quản lý (MCC, nếu có)',
  developerToken: 'Developer token',
  clientId: 'OAuth client ID',
  clientSecret: 'OAuth client secret',
  refreshToken: 'Refresh token',
  adAccountId: 'Ad account ID',
  accessToken: 'Access token',
  savedKeep: 'Đã lưu — để trống nếu không đổi',
  missingSecret: 'Chưa có',
  clearGoogle: 'Xóa khóa Google đã lưu',
  clearFacebook: 'Xóa token Facebook đã lưu',
  saveKeys: 'Lưu khóa',
  saving: 'Đang lưu…',
  savedToast: 'Đã lưu khóa đọc chi phí quảng cáo.',
  guideTitle: 'Hướng dẫn tích hợp chi phí quảng cáo',
  profitTitle: 'Chi tiết đơn đã cọc',
  profitBody:
    'Chỉ đơn đã cọc trong khoảng đang chọn. Giá thu là tiền hàng sau các chương trình sale, không gồm phí ship khách trả. Giá vốn hàng Trung Quốc lấy giá gốc tệ × tỷ giá. Hàng Việt Nam lấy giá nhập đồng; hàng sale thanh lý kho là 0đ và không cộng ship Trung Quốc. Lợi nhuận = giá thu − giá vốn − ship − quảng cáo.',
  rate: 'Tỷ giá (₫ / 1 ¥)',
  shipChina: 'Ship TQ nội địa (¥ / đơn)',
  shipBorder: 'Ship cửa khẩu về Hà Nội (¥ / đơn)',
  shipHanoi: 'Ship Hà Nội đến khách (₫ / đơn)',
  saveRates: 'Lưu tỷ giá và tiền ship',
  savingRates: 'Đang lưu…',
  savedRates: 'Đã lưu tỷ giá và tiền ship.',
  badMoney: 'Nhập tỷ giá và tiền ship mức chung. Các số không được âm.',
  badCell: 'Có ô tiền không đọc được. Nhập số không âm, dùng dấu chấm cho phần thập phân.',
  goodsPlaceholder: 'Nhập ¥',
  returnedLine: 'Hoàn · trừ {amount} chưa cọc',
  revenueTitle: 'Tiền hàng sau sale, không gồm phí ship khách trả',
  returnedTitle: 'Đơn hoàn: giữ tiền cọc, trừ phần hàng khách chưa trả',
  goodsAria: 'Giá hàng tệ {code}',
  shipChinaAria: 'Ship Trung Quốc {code}',
  shipBorderAria: 'Ship cửa khẩu {code}',
  shipHanoiAria: 'Ship Hà Nội {code}',
  manualAds: 'Quảng cáo kỳ (₫)',
  manualAdsHint: 'Chưa nối Google hoặc Facebook nên ô này nhập tay. Sau khi lưu khóa, số này lấy từ hai nền tảng.',
  shipNote:
    'Mức ship chung áp cho đơn có hàng tệ. Đơn chỉ có hàng Việt Nam hoặc sale kho giữ ship Trung Quốc bằng 0, trừ khi sửa riêng đơn đó. Đổi tỷ giá thì tiền vốn tệ đổi lại; giá gốc tệ và giá nhập đồng đã lưu không đổi.',
  missingGoods: '{n} đơn chưa có đủ giá nhập nên tổng giá vốn và lợi nhuận chưa chốt. Nhập giá hàng ¥ cho các đơn đó.',
  truncated: 'Kỳ này nhiều hơn 400 đơn đã cọc. Rút ngắn khoảng ngày để hạch toán đủ.',
  noOrders: 'Không có đơn đã cọc trong khoảng này.',
  loadingOrders: 'Đang tải đơn đã cọc…',
  retry: 'Thử lại',
  colOrder: 'Đơn',
  colDate: 'Ngày cọc',
  colRevenue: 'Giá thu',
  colGoods: 'Giá hàng ¥',
  colImport: 'Nhập VN',
  colShipChina: 'Ship TQ ¥',
  colShipBorder: 'Cửa khẩu ¥',
  colShipHanoi: 'Hà Nội ₫',
  colCny: 'Giá tệ',
  colCost: 'Giá vốn',
  colGross: 'Lãi gộp',
  presets: {
    today: 'Hôm nay',
    yesterday: 'Hôm qua',
    week: 'Tuần này',
    prevWeek: 'Tuần trước',
    '7': '7 ngày',
    '30': '30 ngày',
    month: 'Tháng này',
    prev: 'Tháng trước',
  },
  role: {
    legendTitle: 'Màu trường',
    legendInternal: 'Đen — thông tin nội bộ trên nền tảng.',
    legendIssued: 'Xanh dương — khóa nền tảng cấp ra hệ thống khác.',
    legendInbound: 'Xanh lá — dữ liệu từ Google hoặc Facebook điền vào đây.',
    badge: { internal: 'Nội bộ', issued: 'Cấp ra', inbound: 'Điền vào' },
  },
}

const en: AdSpendPageCopy = {
  ...vi,
  title: 'Profit',
  intro: 'Pick today, a week, or a month. Google and Facebook ad spend and profit for that period appear below.',
  badRange: 'Pick a start date on or before the end date.',
  from: 'From',
  to: 'To',
  viewPeriod: 'View this period',
  reading: 'Loading…',
  calculating: 'Calculating…',
  viewing: 'Viewing',
  wholePeriod: 'Whole period',
  eachDay: 'Each day — click to see that day',
  adSpend: 'Ad spend',
  profit: 'Profit',
  revenue: 'Deposited revenue',
  cost: 'Cost',
  costHint: 'Goods and shipping',
  missingCostShort: 'Some orders are missing import cost',
  returnedRevenue: '{n} orders · minus {amount} not deposited on {returned} returns',
  googlePlusFacebook: 'Google + Facebook',
  mixedCurrency: 'Google and Facebook use different currencies',
  notConfigured: 'Not connected',
  unreadable: 'Could not read',
  clicksImpressions: '{clicks} clicks · {impressions} impressions',
  depositedHint: 'Deposited orders in the selected period',
  missingCost: '{n} orders still missing import cost',
  grossBeforeAds: '{n} orders · profit before ads {amount}',
  orders: '{n} orders',
  dailyTitle: 'Daily detail',
  dailyHint: 'Click a row to move that day’s spend and profit to the top.',
  noSpend: 'No spend in this range.',
  day: 'Date',
  total: 'Total',
  campaign: 'Campaign',
  clicks: 'Clicks',
  noCampaigns: 'No campaign spent money.',
  partial: 'This range has more rows than were loaded. Shorten the dates to see the full spend.',
  keysTitle: 'Connection keys',
  open: 'Open',
  close: 'Collapse',
  googleLead: 'Paste this shop’s read-only ad account keys. Leave a secret blank to keep the saved one. API version {version}.',
  facebookLead: 'A Business Manager system token with ads_read. The ad account id is digits, with or without act_. Graph version {version}.',
  googleSteps: [
    'In Google Ads open Tools → API Center and request a developer token. Read-only access is enough.',
    'In Google Cloud create an OAuth client (web or desktop) and copy the client id and secret.',
    'Request a refresh token with scope https://www.googleapis.com/auth/adwords. Keep that token, not a short-lived access token.',
    'Customer ID is the 10 digits in the Google Ads account corner, without dashes. If an MCC manages the account, also fill the manager id.',
    'Save the keys. This page reads spend for the selected period and subtracts it once from profit, not from each order.',
  ],
  facebookSteps: [
    'In Meta Business Manager create a system-user token with ads_read.',
    'Copy the ad account id from ad account settings (digits; act_ is optional).',
    'Paste the token and id into the green fields and save. The token is not shown again.',
    'Facebook spend is added to Google only when both use the same currency.',
  ],
  mcc: 'Manager account id (MCC, if any)',
  savedKeep: 'Saved — leave blank to keep',
  missingSecret: 'Not set',
  clearGoogle: 'Delete saved Google keys',
  clearFacebook: 'Delete saved Facebook token',
  saveKeys: 'Save keys',
  saving: 'Saving…',
  savedToast: 'Ad spend keys saved.',
  guideTitle: 'How to connect ad spend',
  profitTitle: 'Deposited orders',
  profitBody:
    'Only deposited orders in the selected range. Revenue is merchandise after every sale, without the shipping the customer paid. China goods use source yuan × the rate. Vietnam goods use the dong import cost; clearance is 0 and skips China shipping. Profit = revenue − cost − shipping − ads.',
  rate: 'Rate (₫ / 1 ¥)',
  shipChina: 'China domestic ship (¥ / order)',
  shipBorder: 'Border to Hanoi (¥ / order)',
  shipHanoi: 'Hanoi to customer (₫ / order)',
  saveRates: 'Save rate and shipping',
  savingRates: 'Saving…',
  savedRates: 'Rate and shipping saved.',
  badMoney: 'Enter the shared rate and shipping. Amounts cannot be negative.',
  badCell: 'A money cell could not be read. Enter a non-negative number and use a dot for decimals.',
  goodsPlaceholder: 'Enter ¥',
  returnedLine: 'Return · minus {amount} not deposited',
  revenueTitle: 'Merchandise after sale, without the shipping the customer paid',
  returnedTitle: 'Returned order: keep the deposit, drop the goods the customer did not pay',
  goodsAria: 'Yuan goods {code}',
  shipChinaAria: 'China shipping {code}',
  shipBorderAria: 'Border shipping {code}',
  shipHanoiAria: 'Hanoi shipping {code}',
  manualAds: 'Period ads (₫)',
  manualAdsHint: 'Google and Facebook are not connected, so this amount is typed. After the keys are saved, the figure comes from both platforms.',
  shipNote:
    'The shared shipping amounts apply to orders that still have yuan goods. Vietnam-only and clearance orders keep China shipping at 0 unless that order is edited. Changing the rate recalculates yuan cost; a saved yuan price and a saved dong import cost stay as they are.',
  missingGoods: '{n} orders are missing import cost, so cost and profit are not final. Enter the yuan goods price for those orders.',
  truncated: 'This period has more than 400 deposited orders. Shorten the dates to account for all of them.',
  noOrders: 'No deposited orders in this range.',
  loadingOrders: 'Loading deposited orders…',
  retry: 'Try again',
  colOrder: 'Order',
  colDate: 'Deposit date',
  colRevenue: 'Revenue',
  colGoods: 'Goods ¥',
  colImport: 'VN import',
  colShipChina: 'China ship ¥',
  colShipBorder: 'Border ¥',
  colShipHanoi: 'Hanoi ₫',
  colCny: 'Yuan total',
  colCost: 'Cost',
  colGross: 'Gross',
  presets: {
    today: 'Today',
    yesterday: 'Yesterday',
    week: 'This week',
    prevWeek: 'Last week',
    '7': '7 days',
    '30': '30 days',
    month: 'This month',
    prev: 'Last month',
  },
  role: {
    legendTitle: 'Field colors',
    legendInternal: 'Black — internal platform data.',
    legendIssued: 'Blue — a key this platform issues to another system.',
    legendInbound: 'Green — data from Google or Facebook that you paste here.',
    badge: { internal: 'Internal', issued: 'Issued', inbound: 'Inbound' },
  },
}

const zh: AdSpendPageCopy = {
  ...en,
  title: '利润',
  intro: '选择今天、本周或本月。下方立即显示该期间的 Google、Facebook 广告费和利润。',
  badRange: '开始日期必须早于或等于结束日期。',
  from: '从',
  to: '到',
  viewPeriod: '查看此期间',
  reading: '正在读取…',
  calculating: '正在计算…',
  viewing: '正在查看',
  wholePeriod: '整个期间',
  eachDay: '按天 — 点击查看当天',
  adSpend: '广告费',
  profit: '利润',
  revenue: '已付定金营收',
  cost: '成本',
  costHint: '货款和运费',
  missingCostShort: '还有订单缺少进货价',
  returnedRevenue: '{n} 笔 · 减去 {returned} 笔退货未付定金 {amount}',
  googlePlusFacebook: 'Google + Facebook',
  mixedCurrency: 'Google 与 Facebook 货币不同',
  notConfigured: '未连接',
  unreadable: '无法读取',
  clicksImpressions: '{clicks} 次点击 · {impressions} 次展示',
  depositedHint: '所选期间内已付定金的订单',
  missingCost: '{n} 笔订单缺少进货价',
  grossBeforeAds: '{n} 笔 · 扣除广告前利润 {amount}',
  orders: '{n} 笔',
  dailyTitle: '按日明细',
  dailyHint: '点击一行，把当天的广告费和利润放到上方。',
  noSpend: '此区间没有广告费。',
  day: '日期',
  total: '合计',
  campaign: '广告系列',
  clicks: '点击',
  noCampaigns: '没有产生费用的广告系列。',
  partial: '此区间的行数超过已加载的部分。缩短日期才能看全费用。',
  keysTitle: '连接密钥',
  open: '展开',
  close: '收起',
  googleLead: '粘贴本店广告账户的只读密钥。密钥留空表示保留已保存的值。API 版本 {version}。',
  facebookLead: 'Business Manager 系统用户令牌，权限 ads_read。广告账户 ID 为数字，可带或不带 act_。Graph 版本 {version}。',
  googleSteps: [
    '打开 Google Ads → 工具 → API 中心，申请 developer token。只读权限即可。',
    '在 Google Cloud 创建 OAuth 客户端（网页或桌面），复制 Client ID 和 Client secret。',
    '用范围 https://www.googleapis.com/auth/adwords 申请 refresh token。保存这个长期令牌，不要粘贴短期 access token。',
    'Customer ID 是账户角上的 10 位数字，去掉横线。若由 MCC 管理，再填写经理账户 ID。',
    '保存密钥。页面读取所选期间的费用，并从利润中扣除一次，不摊到每笔订单。',
  ],
  facebookSteps: [
    '在 Meta Business Manager 创建具有 ads_read 权限的系统用户令牌。',
    '在广告账户设置中复制广告账户 ID（数字，act_ 可省略）。',
    '把令牌和 ID 粘贴到绿色字段并保存。保存后不再显示令牌。',
    '仅当 Google 与 Facebook 使用同一货币时才相加。',
  ],
  mcc: '经理账户 ID（MCC，如有）',
  savedKeep: '已保存 — 不修改请留空',
  missingSecret: '未设置',
  clearGoogle: '删除已保存的 Google 密钥',
  clearFacebook: '删除已保存的 Facebook 令牌',
  saveKeys: '保存密钥',
  saving: '正在保存…',
  savedToast: '已保存广告费密钥。',
  guideTitle: '如何接入广告费',
  profitTitle: '已付定金订单',
  profitBody:
    '只统计所选区间内已付定金的订单。收入是各项促销后的货款，不含客户支付的运费。中国货成本 = 人民币原价 × 汇率。越南货用越南盾进价；清仓为 0，不加中国运费。利润 = 收入 − 成本 − 运费 − 广告费。',
  rate: '汇率（₫ / 1 ¥）',
  shipChina: '中国国内运费（¥ / 单）',
  shipBorder: '口岸到河内（¥ / 单）',
  shipHanoi: '河内到客户（₫ / 单）',
  saveRates: '保存汇率和运费',
  savingRates: '正在保存…',
  savedRates: '已保存汇率和运费。',
  badMoney: '请填写共用汇率和运费。数字不能为负。',
  badCell: '有金额无法读取。请填非负数字，小数用点。',
  goodsPlaceholder: '输入 ¥',
  returnedLine: '退货 · 减去未付定金 {amount}',
  revenueTitle: '促销后的货款，不含客户支付的运费',
  returnedTitle: '退货单：保留定金，减去客户未付的货款',
  goodsAria: '人民币货款 {code}',
  shipChinaAria: '中国运费 {code}',
  shipBorderAria: '口岸运费 {code}',
  shipHanoiAria: '河内运费 {code}',
  manualAds: '期间广告费（₫）',
  manualAdsHint: '尚未连接 Google 或 Facebook，因此这里手工填写。保存密钥后，数字来自两个平台。',
  shipNote:
    '共用运费用于仍有人民币货款的订单。仅越南货和清仓的中国运费保持 0，除非单独改那一单。改汇率会重算人民币成本；已保存的人民币原价和越南盾进价不变。',
  missingGoods: '{n} 笔订单缺少进货价，成本和利润尚未确定。请为这些订单填写人民币货款。',
  truncated: '此期间已付定金订单超过 400 笔。缩短日期才能全部核算。',
  noOrders: '此区间没有已付定金订单。',
  loadingOrders: '正在加载已付定金订单…',
  retry: '重试',
  colOrder: '订单',
  colDate: '定金日期',
  colRevenue: '收入',
  colGoods: '货款 ¥',
  colImport: '越南进价',
  colShipChina: '中国运费 ¥',
  colShipBorder: '口岸 ¥',
  colShipHanoi: '河内 ₫',
  colCny: '人民币合计',
  colCost: '成本',
  colGross: '毛利',
  presets: {
    today: '今天',
    yesterday: '昨天',
    week: '本周',
    prevWeek: '上周',
    '7': '7 天',
    '30': '30 天',
    month: '本月',
    prev: '上月',
  },
  role: {
    legendTitle: '字段颜色',
    legendInternal: '黑色 — 平台内部信息。',
    legendIssued: '蓝色 — 平台发给其他系统的密钥。',
    legendInbound: '绿色 — 从 Google 或 Facebook 填入的数据。',
    badge: { internal: '内部', issued: '发出', inbound: '填入' },
  },
}

const ja: AdSpendPageCopy = {
  ...en,
  title: '利益',
  intro: '今日、今週、今月を選びます。その期間の Google と Facebook の広告費と利益が下に出ます。',
  badRange: '開始日は終了日と同じか、それより前にしてください。',
  from: '開始',
  to: '終了',
  viewPeriod: 'この期間を見る',
  reading: '読み込み中…',
  calculating: '計算中…',
  viewing: '表示中',
  wholePeriod: '期間全体',
  eachDay: '日ごと — クリックするとその日を表示',
  adSpend: '広告費',
  profit: '利益',
  revenue: '入金済み売上',
  cost: '原価',
  costHint: '商品と送料',
  missingCostShort: '仕入値が未入力の注文があります',
  returnedRevenue: '{n} 件 · 返品 {returned} 件の未入金 {amount} を差し引き',
  googlePlusFacebook: 'Google + Facebook',
  mixedCurrency: 'Google と Facebook の通貨が違います',
  notConfigured: '未接続',
  unreadable: '読めません',
  clicksImpressions: '{clicks} クリック · {impressions} 表示',
  depositedHint: '選択期間の入金済み注文',
  missingCost: '{n} 件は仕入値が未入力です',
  grossBeforeAds: '{n} 件 · 広告前利益 {amount}',
  orders: '{n} 件',
  dailyTitle: '日別明細',
  dailyHint: '行をクリックすると、その日の広告費と利益が上に出ます。',
  noSpend: 'この期間に広告費はありません。',
  day: '日付',
  total: '合計',
  campaign: 'キャンペーン',
  clicks: 'クリック',
  noCampaigns: '費用のあるキャンペーンはありません。',
  partial: '読み込んだ行より多い期間です。日付を短くすると全額が見えます。',
  keysTitle: '接続キー',
  open: '開く',
  close: '閉じる',
  googleLead: 'この店の広告アカウントの読み取りキーを貼ります。秘密欄を空にすると保存済みを維持します。API {version}。',
  facebookLead: 'Business Manager のシステムトークン（ads_read）。広告アカウント ID は数字です。act_ は付けても外せます。Graph {version}。',
  googleSteps: [
    'Google 広告 → ツール → API センターで developer token を申請します。読み取り権限で足ります。',
    'Google Cloud で OAuth クライアント（ウェブまたはデスクトップ）を作り、Client ID と secret をコピーします。',
    'スコープ https://www.googleapis.com/auth/adwords で refresh token を取得します。短い access token は使いません。',
    'Customer ID はアカウント隅の 10 桁（ハイフンなし）です。MCC 管理ならマネージャー ID も入れます。',
    '保存すると、選択期間の広告費を読み、利益から一度だけ引きます。注文ごとには割りません。',
  ],
  facebookSteps: [
    'Meta Business Manager で ads_read 付きのシステムユーザートークンを作ります。',
    '広告アカウント設定から広告アカウント ID（数字。act_ は任意）をコピーします。',
    '緑の欄にトークンと ID を貼って保存します。保存後トークンは再表示しません。',
    'Google と Facebook が同じ通貨のときだけ合計します。',
  ],
  mcc: 'マネージャーアカウント ID（MCC、ある場合）',
  savedKeep: '保存済み — 変えないなら空欄',
  missingSecret: '未設定',
  clearGoogle: '保存した Google キーを削除',
  clearFacebook: '保存した Facebook トークンを削除',
  saveKeys: 'キーを保存',
  saving: '保存中…',
  savedToast: '広告費のキーを保存しました。',
  guideTitle: '広告費のつなぎ方',
  profitTitle: '入金済み注文',
  profitBody:
    '選択期間の入金済み注文だけを見ます。売上はセール後の商品代金で、お客様負担の送料は含みません。中国商品の原価は人民元 × レート。ベトナム商品はドンの仕入値。在庫処分は 0 で中国送料なし。利益 = 売上 − 原価 − 送料 − 広告費。',
  rate: 'レート（₫ / 1 ¥）',
  shipChina: '中国国内送料（¥ / 件）',
  shipBorder: '国境からハノイ（¥ / 件）',
  shipHanoi: 'ハノイからお客様（₫ / 件）',
  saveRates: 'レートと送料を保存',
  savingRates: '保存中…',
  savedRates: 'レートと送料を保存しました。',
  badMoney: '共通のレートと送料を入力してください。負の数は使えません。',
  badCell: '読めない金額があります。0 以上の数を入れ、小数は点を使います。',
  goodsPlaceholder: '¥ を入力',
  returnedLine: '返品 · 未入金 {amount} を差し引き',
  revenueTitle: 'セール後の商品代金。お客様負担の送料は含みません',
  returnedTitle: '返品: 入金は残し、未払いの商品代金を引きます',
  goodsAria: '人民元の商品 {code}',
  shipChinaAria: '中国送料 {code}',
  shipBorderAria: '国境送料 {code}',
  shipHanoiAria: 'ハノイ送料 {code}',
  manualAds: '期間の広告費（₫）',
  manualAdsHint: 'Google と Facebook が未接続のため手入力です。キー保存後は両プラットフォームの数値になります。',
  shipNote:
    '共通送料は人民元の商品がある注文に使います。ベトナムのみと在庫処分の中国送料は 0 のままです。その注文だけ変えた場合は別です。レートを変えると人民元の原価を再計算します。保存済みの人民元とドン仕入値は変わりません。',
  missingGoods: '{n} 件は仕入値が足りないため、原価と利益は未確定です。それらの注文に人民元の商品価格を入力してください。',
  truncated: 'この期間の入金済み注文は 400 件を超えています。日付を短くすると全部計算できます。',
  noOrders: 'この期間に入金済み注文はありません。',
  loadingOrders: '入金済み注文を読み込み中…',
  retry: '再試行',
  colOrder: '注文',
  colDate: '入金日',
  colRevenue: '売上',
  colGoods: '商品 ¥',
  colImport: 'VN 仕入',
  colShipChina: '中国送料 ¥',
  colShipBorder: '国境 ¥',
  colShipHanoi: 'ハノイ ₫',
  colCny: '人民元合計',
  colCost: '原価',
  colGross: '粗利',
  presets: {
    today: '今日',
    yesterday: '昨日',
    week: '今週',
    prevWeek: '先週',
    '7': '7 日',
    '30': '30 日',
    month: '今月',
    prev: '先月',
  },
  role: {
    legendTitle: '項目の色',
    legendInternal: '黒 — プラットフォーム内部の情報。',
    legendIssued: '青 — プラットフォームが他システムへ出すキー。',
    legendInbound: '緑 — Google または Facebook から貼るデータ。',
    badge: { internal: '内部', issued: '発行', inbound: '入力' },
  },
}

const ko: AdSpendPageCopy = {
  ...en,
  title: '이익',
  intro: '오늘, 이번 주, 이번 달을 고르면 그 기간의 Google·Facebook 광고비와 이익이 아래에 나옵니다.',
  badRange: '시작일은 종료일과 같거나 더 이전이어야 합니다.',
  from: '부터',
  to: '까지',
  viewPeriod: '이 기간 보기',
  reading: '읽는 중…',
  calculating: '계산 중…',
  viewing: '보는 중',
  wholePeriod: '전체 기간',
  eachDay: '날짜별 — 누르면 그날 수치',
  adSpend: '광고비',
  profit: '이익',
  revenue: '입금된 매출',
  cost: '원가',
  costHint: '상품과 배송',
  missingCostShort: '매입가가 없는 주문이 있습니다',
  returnedRevenue: '{n}건 · 반품 {returned}건의 미입금 {amount} 제외',
  googlePlusFacebook: 'Google + Facebook',
  mixedCurrency: 'Google과 Facebook 통화가 다릅니다',
  notConfigured: '연결 안 됨',
  unreadable: '읽지 못함',
  clicksImpressions: '클릭 {clicks} · 노출 {impressions}',
  depositedHint: '선택한 기간의 입금 주문',
  missingCost: '{n}건은 매입가가 없습니다',
  grossBeforeAds: '{n}건 · 광고 전 이익 {amount}',
  orders: '{n}건',
  dailyTitle: '일별 내역',
  dailyHint: '한 줄을 누르면 그날 광고비와 이익이 위로 올라갑니다.',
  noSpend: '이 구간에 광고비가 없습니다.',
  day: '날짜',
  total: '합계',
  campaign: '캠페인',
  clicks: '클릭',
  noCampaigns: '비용이 발생한 캠페인이 없습니다.',
  partial: '불러온 줄보다 많은 기간입니다. 날짜를 줄이면 전체 비용을 봅니다.',
  keysTitle: '연결 키',
  open: '열기',
  close: '접기',
  googleLead: '이 상점 광고 계정의 읽기 키를 붙입니다. 비밀 칸을 비우면 저장된 값을 유지합니다. API {version}.',
  facebookLead: 'Business Manager 시스템 토큰, 권한 ads_read. 광고 계정 ID는 숫자이며 act_는 있어도 됩니다. Graph {version}.',
  googleSteps: [
    'Google Ads → 도구 → API 센터에서 developer token을 신청합니다. 읽기 권한이면 됩니다.',
    'Google Cloud에서 OAuth 클라이언트(웹 또는 데스크톱)를 만들고 Client ID와 secret을 복사합니다.',
    '범위 https://www.googleapis.com/auth/adwords 로 refresh token을 받습니다. 짧은 access token은 쓰지 않습니다.',
    'Customer ID는 계정 모서리의 10자리(하이픈 제외)입니다. MCC가 관리하면 관리자 ID도 넣습니다.',
    '저장하면 선택 기간의 광고비를 읽고 이익에서 한 번만 뺍니다. 주문마다 나누지 않습니다.',
  ],
  facebookSteps: [
    'Meta Business Manager에서 ads_read 권한이 있는 시스템 사용자 토큰을 만듭니다.',
    '광고 계정 설정에서 광고 계정 ID(숫자, act_는 선택)를 복사합니다.',
    '초록 칸에 토큰과 ID를 붙여 저장합니다. 저장 후 토큰은 다시 보이지 않습니다.',
    'Google과 Facebook이 같은 통화일 때만 합산합니다.',
  ],
  mcc: '관리자 계정 ID (MCC, 있는 경우)',
  savedKeep: '저장됨 — 유지하려면 비움',
  missingSecret: '없음',
  clearGoogle: '저장된 Google 키 삭제',
  clearFacebook: '저장된 Facebook 토큰 삭제',
  saveKeys: '키 저장',
  saving: '저장 중…',
  savedToast: '광고비 키를 저장했습니다.',
  guideTitle: '광고비 연결 방법',
  profitTitle: '입금된 주문',
  profitBody:
    '선택한 구간의 입금 주문만 봅니다. 매출은 할인 후 상품 대금이며 고객 배송비는 포함하지 않습니다. 중국 상품 원가는 위안 × 환율. 베트남 상품은 동 매입가. 재고 정리는 0이고 중국 배송비 없음. 이익 = 매출 − 원가 − 배송 − 광고비.',
  rate: '환율 (₫ / 1 ¥)',
  shipChina: '중국 국내 배송 (¥ / 주문)',
  shipBorder: '국경에서 하노이 (¥ / 주문)',
  shipHanoi: '하노이에서 고객 (₫ / 주문)',
  saveRates: '환율과 배송비 저장',
  savingRates: '저장 중…',
  savedRates: '환율과 배송비를 저장했습니다.',
  badMoney: '공통 환율과 배송비를 입력하세요. 음수는 안 됩니다.',
  badCell: '읽을 수 없는 금액이 있습니다. 0 이상 숫자를 넣고 소수는 점을 씁니다.',
  goodsPlaceholder: '¥ 입력',
  returnedLine: '반품 · 미입금 {amount} 제외',
  revenueTitle: '할인 후 상품 대금. 고객 배송비는 포함하지 않습니다',
  returnedTitle: '반품: 입금은 유지하고 고객이 내지 않은 상품 대금을 뺍니다',
  goodsAria: '위안 상품 {code}',
  shipChinaAria: '중국 배송 {code}',
  shipBorderAria: '국경 배송 {code}',
  shipHanoiAria: '하노이 배송 {code}',
  manualAds: '기간 광고비 (₫)',
  manualAdsHint: 'Google 또는 Facebook이 연결되지 않아 직접 입력합니다. 키를 저장하면 두 플랫폼 수치를 씁니다.',
  shipNote:
    '공통 배송비는 위안 상품이 있는 주문에 적용됩니다. 베트남 전용과 재고 정리의 중국 배송비는 0입니다. 그 주문만 고치면 달라집니다. 환율을 바꾸면 위안 원가를 다시 계산합니다. 저장한 위안 가격과 동 매입가는 그대로입니다.',
  missingGoods: '{n}건은 매입가가 부족해 원가와 이익이 확정되지 않았습니다. 해당 주문에 위안 상품 가격을 입력하세요.',
  truncated: '이 기간의 입금 주문이 400건을 넘습니다. 날짜를 줄이면 모두 계산합니다.',
  noOrders: '이 구간에 입금 주문이 없습니다.',
  loadingOrders: '입금 주문을 불러오는 중…',
  retry: '다시 시도',
  colOrder: '주문',
  colDate: '입금일',
  colRevenue: '매출',
  colGoods: '상품 ¥',
  colImport: 'VN 매입',
  colShipChina: '중국 배송 ¥',
  colShipBorder: '국경 ¥',
  colShipHanoi: '하노이 ₫',
  colCny: '위안 합계',
  colCost: '원가',
  colGross: '매출총이익',
  presets: {
    today: '오늘',
    yesterday: '어제',
    week: '이번 주',
    prevWeek: '지난 주',
    '7': '7일',
    '30': '30일',
    month: '이번 달',
    prev: '지난 달',
  },
  role: {
    legendTitle: '칸 색',
    legendInternal: '검정 — 플랫폼 내부 정보.',
    legendIssued: '파랑 — 플랫폼이 다른 시스템에 주는 키.',
    legendInbound: '초록 — Google 또는 Facebook에서 붙여 넣는 데이터.',
    badge: { internal: '내부', issued: '발급', inbound: '입력' },
  },
}

const COPY: Record<WebLocale, AdSpendPageCopy> = { vi, en, zh, ja, ko }

export function adSpendPageCopy(locale: WebLocale): AdSpendPageCopy {
  return COPY[locale] ?? vi
}

export function fillCopy(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''))
}
