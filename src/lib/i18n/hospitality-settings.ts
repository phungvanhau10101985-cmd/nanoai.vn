import type { WebLocale } from '@/lib/i18n/config'

export type HospitalitySettingsDict = {
  pageTitle: string
  pageDescription: string
  overview: string
  dashboard: string
  noWorkspace: string
  createWorkspace: string
  choosePartnerTitle: string
  choosePartnerDescription: string
  choosePartnerPlaceholder: string
  tabRooms: string
  tabInteraction: string
  tabAi: string
  tabReport: string
  loading: string
  roomTypes: string
  physicalRooms: string
  activeRooms: string
  uploadedImages: string
  inSystem: string
  readySuffix: string
  pausedSuffix: string
  forConsulting: string
  typeList: string
  typeCountSuffix: string
  createRoomType: string
  noRoomType: string
  emptySelectType: string
  codeAndNameRequired: string
  createRoomTypeFailed: string
  createdRoomType: string
  updateFailed: string
  savedRoomType: string
  deleteFailed: string
  deletedRoomType: string
  roomCodeRequired: string
  createRoomFailed: string
  createdRoom: string
  updateRoomFailed: string
  updatedRoom: string
  deleteRoomFailed: string
  deletedRoom: string
  active: string
  maintenance: string
  inactive: string
  roomTypeNewTitle: string
  roomTypeNewDesc: string
  roomTypeCode: string
  roomTypeName: string
  maxGuests: string
  currency: string
  hourlyRate: string
  dailyRate: string
  description: string
  cancel: string
  creating: string
  saveChanges: string
  saving: string
  delete: string
  roomTypeDeleteTitle: string
  roomTypeDeleteDesc: string
  deleteForever: string
  roomsTab: string
  infoTab: string
  roomQuickAddTitle: string
  roomQuickAddDesc: string
  newRoomCode: string
  floorOptional: string
  addRoom: string
  noRoomForType: string
  roomCode: string
  floor: string
  image: string
  status: string
  actions: string
  calendar: string
  roomCalendarTitle: string
  calendarHint: string
  dayFree: string
  dayFullBooked: string
  dayHourlyBooked: string
  hourTableTitle: string
  hourBooked: string
  hourFree: string
  prevMonth: string
  nextMonth: string
  addImage: string
  roomImageTitlePrefix: string
  roomImageDesc: string
  chooseImage: string
  takePhoto: string
  noImageYet: string
  close: string
  edit: string
  save: string
  roomDeleteTitle: string
  roomDeleteDesc: string
  aiTitle: string
  aiDesc: string
  enableAi: string
  autoReply: string
  defaultLocale: string
  toneGuide: string
  policy: string
  saveSettings: string
  reportTitle: string
  reportDesc: string
  reload: string
  embedTitle: string
  embedDesc: string
  embedHostedUrl: string
  embedIframeCode: string
  copy: string
  copied: string
  copyFailed: string
  openEmbed: string
  interactionTitle: string
  interactionDesc: string
  conversations: string
  bookings: string
  noConversations: string
  noBookings: string
  pickConversation: string
  sendMessage: string
  messagePlaceholder: string
  sendingMessage: string
  customer: string
  checkin: string
  checkout: string
  amount: string
  totalBookings: string
  confirmedBookings: string
  paidRevenue: string
  pendingHolds: string
  noData: string
}

const vi: HospitalitySettingsDict = {
  pageTitle: 'Cài đặt khách sạn / nhà nghỉ',
  pageDescription:
    'Quản lý danh sách phòng, trợ lý AI và báo cáo doanh thu 30 ngày. Tách biệt hoàn toàn khỏi cấu hình bán lẻ thời trang.',
  overview: 'Tổng quan',
  dashboard: 'Dashboard',
  noWorkspace: 'Bạn chưa có workspace khách sạn nào. Tạo mới ở',
  createWorkspace: 'trang tạo workspace',
  choosePartnerTitle: 'Chọn khách sạn / nhà nghỉ',
  choosePartnerDescription: 'Mọi thay đổi chỉ áp dụng cho workspace khách sạn được chọn.',
  choosePartnerPlaceholder: 'Chọn khách sạn',
  tabRooms: 'Danh sách phòng',
  tabInteraction: 'Tương tác khách',
  tabAi: 'Trợ lý AI',
  tabReport: 'Báo cáo 30 ngày',
  loading: 'Đang tải...',
  roomTypes: 'Loại phòng',
  physicalRooms: 'Phòng thực tế',
  activeRooms: 'Đang hoạt động',
  uploadedImages: 'Ảnh đã đăng',
  inSystem: 'Đang có trong hệ thống',
  readySuffix: 'sẵn sàng',
  pausedSuffix: 'tạm dừng',
  forConsulting: 'Dùng khi tư vấn khách',
  typeList: 'Loại phòng',
  typeCountSuffix: 'loại',
  createRoomType: '+ Tạo loại phòng',
  noRoomType: 'Chưa có loại phòng. Nhấn «+ Tạo loại phòng» để bắt đầu.',
  emptySelectType: 'Chọn một loại phòng bên trái hoặc tạo loại phòng mới.',
  codeAndNameRequired: 'Mã và tên loại phòng là bắt buộc.',
  createRoomTypeFailed: 'Tạo loại phòng thất bại',
  createdRoomType: 'Đã tạo loại phòng',
  updateFailed: 'Cập nhật thất bại',
  savedRoomType: 'Đã lưu loại phòng.',
  deleteFailed: 'Xóa thất bại',
  deletedRoomType: 'Đã xóa loại phòng',
  roomCodeRequired: 'Vui lòng nhập mã phòng.',
  createRoomFailed: 'Tạo phòng thất bại',
  createdRoom: 'Đã tạo phòng',
  updateRoomFailed: 'Cập nhật phòng thất bại',
  updatedRoom: 'Đã cập nhật phòng.',
  deleteRoomFailed: 'Xóa phòng thất bại',
  deletedRoom: 'Đã xóa phòng.',
  active: 'Sẵn sàng',
  maintenance: 'Bảo trì',
  inactive: 'Ngưng dùng',
  roomTypeNewTitle: 'Tạo loại phòng mới',
  roomTypeNewDesc: 'Định nghĩa giá và sức chứa chung. Sau khi tạo, hãy thêm phòng thực tế (101, 102...) và ảnh cho từng phòng.',
  roomTypeCode: 'Mã loại phòng',
  roomTypeName: 'Tên loại phòng',
  maxGuests: 'Sức chứa tối đa',
  currency: 'Đơn vị tiền tệ',
  hourlyRate: 'Giá theo giờ',
  dailyRate: 'Giá theo ngày',
  description: 'Mô tả',
  cancel: 'Hủy',
  creating: 'Đang tạo...',
  saveChanges: 'Lưu thay đổi',
  saving: 'Đang lưu...',
  delete: 'Xóa',
  roomTypeDeleteTitle: 'Xóa loại phòng',
  roomTypeDeleteDesc: 'Thao tác này sẽ xóa cả các phòng thực tế và ảnh thuộc loại này. Không thể hoàn tác.',
  deleteForever: 'Xóa vĩnh viễn',
  roomsTab: 'Phòng thực tế',
  infoTab: 'Thông tin & giá',
  roomQuickAddTitle: 'Thêm phòng mới',
  roomQuickAddDesc: 'Mỗi phòng thực tế cần mã riêng để đặt phòng và quản lý ảnh.',
  newRoomCode: 'Mã phòng mới',
  floorOptional: 'Tầng (tùy chọn)',
  addRoom: '+ Thêm phòng',
  noRoomForType: 'Chưa có phòng thực tế nào cho loại này.',
  roomCode: 'Mã phòng',
  floor: 'Tầng',
  image: 'Ảnh',
  status: 'Trạng thái',
  actions: 'Thao tác',
  calendar: 'Lịch',
  roomCalendarTitle: 'Lịch phòng',
  calendarHint: 'Chọn ngày để xem lịch theo giờ. Xanh: trống, Vàng: đặt theo giờ, Đỏ: kín cả ngày.',
  dayFree: 'Ngày trống',
  dayFullBooked: 'Kín cả ngày',
  dayHourlyBooked: 'Có đặt theo giờ',
  hourTableTitle: 'Lịch theo giờ',
  hourBooked: 'Đã đặt',
  hourFree: 'Còn trống',
  prevMonth: 'Tháng trước',
  nextMonth: 'Tháng sau',
  addImage: 'Thêm ảnh',
  roomImageTitlePrefix: 'Ảnh phòng',
  roomImageDesc: 'Mỗi phòng có ảnh riêng để khách xem chính xác phòng mình sẽ nhận.',
  chooseImage: 'Chọn ảnh từ máy',
  takePhoto: 'Chụp ảnh',
  noImageYet: 'Chưa có ảnh. Tải lên vài góc chụp thực tế (cửa vào, giường, phòng tắm, view) để khách hình dung.',
  close: 'Đóng',
  edit: 'Sửa',
  save: 'Lưu',
  roomDeleteTitle: 'Xóa phòng',
  roomDeleteDesc: 'Thao tác này không thể hoàn tác. Nếu chỉ muốn tạm ẩn, chọn trạng thái «Ngưng dùng».',
  aiTitle: 'Trợ lý AI dành cho khách sạn',
  aiDesc: 'Chỉ áp dụng cho workspace khách sạn. Không liên quan đến pipeline tư vấn sản phẩm thời trang.',
  enableAi: 'Bật trợ lý AI',
  autoReply: 'Trả lời tự động khi khách nhắn tin',
  defaultLocale: 'Ngôn ngữ mặc định',
  toneGuide: 'Giọng điệu / hướng dẫn phong cách',
  policy: 'Chính sách khách sạn (hiển thị cho AI khi tư vấn)',
  saveSettings: 'Lưu cài đặt',
  reportTitle: 'Báo cáo 30 ngày gần nhất',
  reportDesc: 'Số đặt phòng, đã xác nhận và doanh thu đã thu.',
  reload: 'Tải lại',
  embedTitle: 'Mã nhúng chat khách sạn',
  embedDesc: 'Dán đoạn iframe này vào website của khách sạn để nhận tư vấn/đặt phòng trực tiếp.',
  embedHostedUrl: 'Đường dẫn nhúng',
  embedIframeCode: 'Mã iframe nhúng',
  copy: 'Sao chép',
  copied: 'Đã sao chép',
  copyFailed: 'Không thể sao chép',
  openEmbed: 'Mở trang nhúng',
  interactionTitle: 'Quản lý tương tác khách',
  interactionDesc: 'Theo dõi tin nhắn khách và booking mới của khách sạn trong cùng một nơi.',
  conversations: 'Hội thoại',
  bookings: 'Booking',
  noConversations: 'Chưa có hội thoại nào.',
  noBookings: 'Chưa có booking nào.',
  pickConversation: 'Chọn hội thoại để xem và trả lời tin nhắn.',
  sendMessage: 'Gửi tin',
  messagePlaceholder: 'Nhập nội dung trả lời khách...',
  sendingMessage: 'Đang gửi...',
  customer: 'Khách',
  checkin: 'Nhận phòng',
  checkout: 'Trả phòng',
  amount: 'Số tiền',
  totalBookings: 'Tổng số booking',
  confirmedBookings: 'Booking đã xác nhận',
  paidRevenue: 'Doanh thu đã thu',
  pendingHolds: 'Số hold đang active',
  noData: 'Chưa có dữ liệu.',
}

const en: HospitalitySettingsDict = {
  pageTitle: 'Hotel / Guesthouse Settings',
  pageDescription:
    'Manage rooms, AI assistant, and 30-day revenue reports. Fully isolated from fashion retail configuration.',
  overview: 'Overview',
  dashboard: 'Dashboard',
  noWorkspace: 'You do not have a hotel workspace yet. Create one at',
  createWorkspace: 'workspace creation page',
  choosePartnerTitle: 'Select hotel / guesthouse',
  choosePartnerDescription: 'All changes apply only to the selected hotel workspace.',
  choosePartnerPlaceholder: 'Select hotel',
  tabRooms: 'Room list',
  tabInteraction: 'Guest interaction',
  tabAi: 'AI assistant',
  tabReport: '30-day report',
  loading: 'Loading...',
  roomTypes: 'Room types',
  physicalRooms: 'Physical rooms',
  activeRooms: 'Active rooms',
  uploadedImages: 'Uploaded images',
  inSystem: 'In system',
  readySuffix: 'ready',
  pausedSuffix: 'paused',
  forConsulting: 'Used in guest consulting',
  typeList: 'Room types',
  typeCountSuffix: 'types',
  createRoomType: '+ Create room type',
  noRoomType: 'No room type yet. Click "+ Create room type" to start.',
  emptySelectType: 'Select a room type on the left, or create a new one.',
  codeAndNameRequired: 'Room type code and name are required.',
  createRoomTypeFailed: 'Failed to create room type',
  createdRoomType: 'Room type created',
  updateFailed: 'Update failed',
  savedRoomType: 'Room type saved.',
  deleteFailed: 'Delete failed',
  deletedRoomType: 'Room type deleted',
  roomCodeRequired: 'Please enter room code.',
  createRoomFailed: 'Failed to create room',
  createdRoom: 'Room created',
  updateRoomFailed: 'Failed to update room',
  updatedRoom: 'Room updated.',
  deleteRoomFailed: 'Failed to delete room',
  deletedRoom: 'Room deleted.',
  active: 'Ready',
  maintenance: 'Maintenance',
  inactive: 'Inactive',
  roomTypeNewTitle: 'Create new room type',
  roomTypeNewDesc: 'Define shared pricing and capacity. After creating, add physical rooms (101, 102...) and images per room.',
  roomTypeCode: 'Room type code',
  roomTypeName: 'Room type name',
  maxGuests: 'Max guests',
  currency: 'Currency',
  hourlyRate: 'Hourly rate',
  dailyRate: 'Daily rate',
  description: 'Description',
  cancel: 'Cancel',
  creating: 'Creating...',
  saveChanges: 'Save changes',
  saving: 'Saving...',
  delete: 'Delete',
  roomTypeDeleteTitle: 'Delete room type',
  roomTypeDeleteDesc: 'This will delete all physical rooms and images in this type. This cannot be undone.',
  deleteForever: 'Delete permanently',
  roomsTab: 'Physical rooms',
  infoTab: 'Info & pricing',
  roomQuickAddTitle: 'Add new room',
  roomQuickAddDesc: 'Each physical room needs a unique code for booking and image management.',
  newRoomCode: 'New room code',
  floorOptional: 'Floor (optional)',
  addRoom: '+ Add room',
  noRoomForType: 'No physical room for this type yet.',
  roomCode: 'Room code',
  floor: 'Floor',
  image: 'Image',
  status: 'Status',
  actions: 'Actions',
  calendar: 'Calendar',
  roomCalendarTitle: 'Room calendar',
  calendarHint: 'Click a date to view hourly schedule. Green: free, Yellow: hourly booking, Red: full-day booked.',
  dayFree: 'Free day',
  dayFullBooked: 'Full-day booked',
  dayHourlyBooked: 'Hourly booked',
  hourTableTitle: 'Hourly schedule',
  hourBooked: 'Booked',
  hourFree: 'Free',
  prevMonth: 'Previous month',
  nextMonth: 'Next month',
  addImage: 'Add image',
  roomImageTitlePrefix: 'Room images',
  roomImageDesc: 'Each room has its own image set so guests know exactly what they will receive.',
  chooseImage: 'Choose from device',
  takePhoto: 'Take photo',
  noImageYet: 'No image yet. Upload real photos (entrance, bed, bathroom, view) for guests.',
  close: 'Close',
  edit: 'Edit',
  save: 'Save',
  roomDeleteTitle: 'Delete room',
  roomDeleteDesc: 'This action cannot be undone. To hide temporarily, set status to inactive.',
  aiTitle: 'Hospitality AI assistant',
  aiDesc: 'Applies only to hotel workspace and is isolated from fashion product consulting.',
  enableAi: 'Enable AI assistant',
  autoReply: 'Auto-reply when guests send messages',
  defaultLocale: 'Default locale',
  toneGuide: 'Tone/style instructions',
  policy: 'Hotel policy (visible to AI)',
  saveSettings: 'Save settings',
  reportTitle: 'Last 30 days report',
  reportDesc: 'Bookings, confirmed bookings, and paid revenue.',
  reload: 'Reload',
  embedTitle: 'Hotel embed code',
  embedDesc: 'Paste this iframe snippet to the hotel website for direct guest chat and booking.',
  embedHostedUrl: 'Embed URL',
  embedIframeCode: 'Embed iframe code',
  copy: 'Copy',
  copied: 'Copied',
  copyFailed: 'Cannot copy',
  openEmbed: 'Open embed page',
  interactionTitle: 'Guest interaction management',
  interactionDesc: 'Track guest messages and recent hotel bookings in one place.',
  conversations: 'Conversations',
  bookings: 'Bookings',
  noConversations: 'No conversations yet.',
  noBookings: 'No bookings yet.',
  pickConversation: 'Select a conversation to view and reply.',
  sendMessage: 'Send',
  messagePlaceholder: 'Type your reply to guest...',
  sendingMessage: 'Sending...',
  customer: 'Customer',
  checkin: 'Check-in',
  checkout: 'Check-out',
  amount: 'Amount',
  totalBookings: 'Total bookings',
  confirmedBookings: 'Confirmed bookings',
  paidRevenue: 'Paid revenue',
  pendingHolds: 'Active holds',
  noData: 'No data yet.',
}

const MAP: Record<WebLocale, HospitalitySettingsDict> = {
  vi,
  en,
  zh: en,
  ja: en,
  ko: en,
}

export function getHospitalitySettingsDictionary(locale: WebLocale): HospitalitySettingsDict {
  return MAP[locale] ?? vi
}
