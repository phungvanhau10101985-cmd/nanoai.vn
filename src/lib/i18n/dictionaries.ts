import { DEFAULT_WEB_LOCALE, type WebLocale } from '@/lib/i18n/config'

export type NavGroupKey =
  | 'try_on'
  | 'image_edit'
  | 'design_creative'
  | 'three_d_special'
  | 'translation'
  | 'music_ai'
  | 'curriculum'
  | 'learning_ai'
  | 'system'

export type ToolKey =
  | 'try_on'
  | 'restore_image'
  | 'enhance_image'
  | 'beautify_image'
  | 'merge_image'
  | 'create_banner'
  | 'text_to_image'
  | 'create_id_photo'
  | 'design_logo'
  | 'story_with_images'
  | 'create_sticker'
  | 'create_product_label'
  | 'create_barcode'
  | 'design_package'
  | 'design_flat_bag'
  | 'cylinder_wrap_mockup'
  | 'create_seal_warranty_label'
  | 'design_stamp'
  | 'meme_maker'
  | 'remove_object'
  | 'remove_bg_png'
  | 'replace_product_bg'
  | 'product_3d_sample'
  | 'model_3d_from_image'
  | 'create_video_from_image'
  | 'interior_exterior'
  | 'my_house'
  | 'portrait_photo'
  | 'expand_frame'
  | 'face_swap'
  | 'translate_document_image'
  | 'ai_music_background'
  | 'ai_dj'
  | 'music_from_image_mood'
  | 'realtime_music_control'
  | 'ai_language_learning'
  | 'create_curriculum'
  | 'create_exam'
  | 'online_exam'
  | 'classes'
  | 'try_on_1'
  | 'try_on_2'
  | 'try_on_3'
  | 'try_on_4'
  | 'try_on_5'
  | 'admin'

export type Dictionary = {
  app: {
    siteName: string
    defaultTitle: string
    defaultDescription: string
    toolHub: string
    login: string
  }
  menu: {
    openMenu: string
    mainMenu: string
    accountMenu: string
    system: string
    admin: string
    dashboard: string
    processedImages: string
    translateHistory: string
    musicHistory: string
    wallet: string
    credits: string
    signIn: string
    signOut: string
    switchToRealAccount: string
    exitDevMode: string
    notifications: string
    noNotifications: string
  }
  home: {
    title: string
  }
  footer: {
    platformTitle: string
    platformDescription: string
    policyTitle: string
    policyNotice: string
    contactTitle: string
    contactEmailLabel: string
    contactEmailValue: string
    supportHours: string
    adDisclosure: string
    rights: string
  }
  navGroup: Record<NavGroupKey, string>
  tool: Record<ToolKey, string>
  creationSidebar: {
    back: string
    relatedTitle: string
    popularTitle: string
  }
  classes: {
    title: string
    myClasses: string
    createClass: string
    joinClass: string
    joinClassRoleHint: string
    className: string
    joinCode: string
    copyCode: string
    copied: string
    students: string
    worksheets: string
    noStudents: string
    noClasses: string
    enterCode: string
    join: string
    alreadyJoined: string
    invalidCode: string
    created: string
    backToList: string
    /** Chỉ mobile: mở /tao-bai-thi (cùng trang tạo bài thi trực tuyến) */
    mobileCreateExam: string
    assignWorksheet: string
    noWorksheets: string
    doWorksheet: string
    submit: string
    submitSuccess: string
    viewResult: string
    quizScore: string
    sampleAnswer: string
    submissions: string
    worksheetSubmissionsSection: string
    noWorksheetSubmissions: string
    worksheetSubmissionsSeeExamBelow: string
    submittedAt: string
    noSubmissions: string
    presentWorksheet: string
    schoolLabel: string
    gradeLevelLabel: string
    subjectLabel: string
    renameClass: string
    saveClassName: string
    cancelAction: string
    renameClassFailed: string
    renameClassSuccess: string
    examSubmissions: string
    noExamSubmissions: string
    /** Lớp chưa gắn phiên đề thi nào */
    noExamsForClass: string
    /** Đã có đề nhưng chưa ai nộp trong phiên đó */
    examSessionNoAttemptsYet: string
    /** Mở / sao chép URL học sinh làm bài (lam-bai/[code]) */
    examStudentDoLinkOpen: string
    examStudentDoLinkCopy: string
    examStudentDoLinkCopied: string
    /** Hộp thoại QR + link — GV chia sẻ cho HS, không mở trang lam-bai */
    examStudentShareDialogTitle: string
    examStudentShareDialogDescription: string
    examStudentShareUrlLabel: string
    /** Trang lam-bai: đã có hồ sơ lớp — chỉ cần bấm bắt đầu */
    examIdentityFromClassHint: string
    examChangeIdentityManual: string
    examManualIdentityIntro: string
    examStartTestButton: string
    examOneAttemptNote: string
    showStudentsAction: string
    hideStudentsAction: string
    examReviewAction: string
    /** Xóa phiên đề thi gắn lớp (GV) */
    examDeleteAction: string
    examDeleteConfirmTitle: string
    examDeleteConfirmDescription: string
    examDeleteConfirmAction: string
    examDeleteSuccess: string
    examDeleteFailed: string
    examDeleting: string
    examDeleteConfirmTypeHint: string
    /** Cụm người dùng phải gõ (hiển thị + so khớp, không phân biệt hoa/thường) */
    examDeleteConfirmPhrase: string
    examAttemptCount: string
    lowScoreWarningPrefix: string
    lowScoreWarningSuffix: string
    correctLabel: string
    wrongLabel: string
    scoreLabel: string
    questionSuffix: string
    deleteClass: string
    deleteClassConfirmTitle: string
    deleteClassConfirmDescription: string
    deleteClassConfirmAction: string
    deleteClassFailed: string
    deleteClassSuccess: string
    deleteClassDeleting: string
    deleteClassConfirmTypeHint: string
    /** Cụm xác nhận xóa lớp — phải gõ đúng (không phân biệt hoa/thường) */
    deleteClassConfirmPhrase: string
    memberRoleStudent: string
    memberRoleTeacher: string
    createClassSchoolRequired: string
    createClassSchoolPlaceholder: string
    createClassSchoolHint: string
    createClassSchoolSearching: string
    createClassSchoolAddNew: string
    createClassSchoolSelected: string
    createClassSchoolNotFound: string
    createClassSchoolTryOther: string
    joinStudentDisplayName: string
    joinStudentBirthDate: string
    joinDobDayPlaceholder: string
    joinDobMonthPlaceholder: string
    joinDobYearPlaceholder: string
    joinNameRequired: string
    joinBirthRequired: string
    joinNameTooShort: string
    memberBirthDateLabel: string
    removeStudentFromClass: string
    removeStudentConfirmTitle: string
    removeStudentConfirmDescription: string
    removeStudentConfirmAction: string
    removeStudentFailed: string
    removeStudentSuccess: string
    removeStudentRemoving: string
    leaveClass: string
    leaveClassConfirmTitle: string
    leaveClassConfirmDescription: string
    leaveClassConfirmAction: string
    leaveClassFailed: string
    leaveClassSuccess: string
    leaveClassLeaving: string
    /** Màn tham gia lớp ngay trên trang làm bài thi (đề gắn lớp) */
    examEnrollGateTitle: string
    examEnrollGateDescription: string
    examEnrollSubmitButton: string
    examEnrollSubmitting: string
  }
  /** Trang công khai /phieu-bai-tap/[id] — lời giải & đáp án */
  worksheetSolutionPage: {
    metaTitlePrefix: string
    metaTitleFallback: string
    metaDescription: string
    eyebrow: string
    qrHint: string
    cardTitle: string
    backHome: string
    updatedLabel: string
    /** Nhãn nhỏ cạnh số thứ tự trong khối câu hỏi (WorksheetView) */
    questionBadge: string
  }
  adminWorksheetVerify: {
    pageTitle: string
    pageDescription: string
    /** Giải thích: báo cáo gồm cả verify ngầm + quét lô */
    reportScopeNote: string
    newScan: string
    nextBatch: string
    refresh: string
    noReports: string
    worksheetsPlanned: string
    worksheetsProcessed: string
    qsMarked: string
    qsPatched: string
    qsSkipped: string
    status: string
    details: string
    batchSize: string
    running: string
    completed: string
    failed: string
    cancelled: string
    openRow: string
    nonePending: string
    cronDoc: string
    toastStarted: string
    toastStepOk: string
    toastDone: string
    toastErr: string
    worksheetId: string
    errors: string
    durationMs: string
    stopPoll: string
    reportUpdatedAt: string
  }
}

const VI_DICTIONARY: Dictionary = {
  app: {
    siteName: 'NanoAI',
    defaultTitle: 'NanoAI - Sáng tạo không giới hạn cùng AI',
    defaultDescription: 'Trải nghiệm phòng thử đồ ảo với AI. Thử đồ 1-5 người, phục dựng ảnh, làm nét ảnh, ghép ảnh. Nhanh chóng, chính xác.',
    toolHub: 'Công cụ AI',
    login: 'Đăng nhập',
  },
  menu: {
    openMenu: 'Mở menu',
    mainMenu: 'Menu chính',
    accountMenu: 'Mở menu tài khoản',
    system: 'Hệ thống',
    admin: 'Quản trị',
    dashboard: 'Bảng điều khiển',
    processedImages: 'Ảnh đã xử lý',
    translateHistory: 'Lịch sử dịch ảnh',
    musicHistory: 'Lịch sử tạo nhạc',
    wallet: 'Ví',
    credits: 'Tín dụng',
    signIn: 'Đăng nhập',
    signOut: 'Đăng xuất',
    switchToRealAccount: 'Đăng nhập tài khoản thật',
    notifications: 'Thông báo',
    noNotifications: 'Chưa có thông báo',
    exitDevMode: 'Thoát chế độ dev',
  },
  home: {
    title: 'NanoAI - Sáng tạo không giới hạn cùng AI',
  },
  footer: {
    platformTitle: 'NanoAI Platform',
    platformDescription: 'Nền tảng AI hỗ trợ học tập và sáng tạo nội dung số.',
    policyTitle: 'Minh bạch quảng cáo',
    policyNotice: 'Nội dung trên nền tảng được hiển thị trung tính, không cam kết kết quả tuyệt đối. Người dùng cần dùng thử và tự đánh giá đầu ra trước khi sử dụng.',
    contactTitle: 'Liên hệ hỗ trợ',
    contactEmailLabel: 'Email',
    contactEmailValue: 'support@nanoai.vn',
    supportHours: 'Giờ hỗ trợ: 08:30 - 17:30 (Thứ 2 - Thứ 7)',
    adDisclosure: 'NanoAI tuân thủ chính sách nội dung quảng cáo của Google, Meta và TikTok tại Việt Nam.',
    rights: '© NanoAI. All rights reserved.',
  },
  navGroup: {
    try_on: 'Thử đồ & Phối đồ',
    image_edit: 'Chỉnh sửa ảnh',
    design_creative: 'Thiết kế & Sáng tạo',
    three_d_special: '3D & Chuyên dụng',
    translation: 'Dịch thuật',
    music_ai: 'Âm nhạc AI',
    curriculum: 'Giáo trình',
    learning_ai: 'Học tập AI',
    system: 'Hệ thống',
  },
  tool: {
    try_on: 'Thử đồ',
    restore_image: 'Phục dựng ảnh',
    enhance_image: 'Làm nét ảnh',
    beautify_image: 'Làm đẹp ảnh',
    merge_image: 'Ghép ảnh',
    create_banner: 'Tạo banner',
    text_to_image: 'Tạo ảnh bằng chữ',
    create_id_photo: 'Tạo ảnh thẻ',
    design_logo: 'Thiết kế logo',
    story_with_images: 'Kể chuyện bằng ảnh',
    create_sticker: 'Tạo nhãn gián',
    create_product_label: 'Tạo nhãn giới thiệu sản phẩm',
    create_barcode: 'Tạo mã vạch & QR Code',
    design_package: 'Thiết kế bao bì (hộp, túi)',
    design_flat_bag: 'Thiết kế túi đựng (mặt phẳng)',
    cylinder_wrap_mockup: 'Mockup nhãn chai / lon',
    create_seal_warranty_label: 'Tạo tem niêm phong, bảo hành',
    design_stamp: 'Thiết kế con dấu',
    meme_maker: 'Chế ảnh',
    remove_object: 'Xóa vật thể',
    remove_bg_png: 'Xóa nền PNG',
    replace_product_bg: 'Thay nền sản phẩm',
    product_3d_sample: 'Ảnh sản phẩm mẫu 3D',
    model_3d_from_image: 'Mô hình 3D từ ảnh',
    create_video_from_image: 'Tạo video từ ảnh',
    interior_exterior: 'Nội ngoại thất',
    my_house: 'Nhà của bạn',
    portrait_photo: 'Ảnh chân dung',
    expand_frame: 'Mở rộng khung hình',
    face_swap: 'Hoán đổi khuôn mặt',
    translate_document_image: 'Dịch ảnh tài liệu',
    ai_music_background: 'Nhạc nền AI',
    ai_dj: 'AI DJ',
    music_from_image_mood: 'Nhạc theo cảm xúc ảnh',
    realtime_music_control: 'Điều khiển nhạc realtime',
    ai_language_learning: 'Học ngoại ngữ AI',
    create_curriculum: 'Tạo giáo trình',
    create_exam: 'Tạo đề trắc nghiệm',
    online_exam: 'Tạo bài thi trực tuyến',
    classes: 'Lớp học',
    try_on_1: 'Thử đồ 1 người',
    try_on_2: 'Thử đồ 2 người',
    try_on_3: 'Thử đồ 3 người',
    try_on_4: 'Thử đồ 4 người',
    try_on_5: 'Thử đồ 5 người',
    admin: 'Quản trị',
  },
  creationSidebar: {
    back: 'Quay lại',
    relatedTitle: 'Liên quan',
    popularTitle: 'Nhiều người dùng',
  },
  classes: {
    title: 'Lớp học',
    myClasses: 'Lớp của tôi',
    createClass: 'Tạo lớp',
    joinClass: 'Tham gia lớp',
    joinClassRoleHint:
      'Tham gia bằng mã lớp: bạn là học sinh/thành viên. Mở link hoặc mã làm bài thi cũng chỉ đăng ký bạn là học sinh. Thầy/cô là người đã tạo lớp và người đã tạo bài thi — không đổi được qua mã hay link tham gia.',
    className: 'Tên lớp',
    joinCode: 'Mã tham gia',
    copyCode: 'Sao chép mã',
    copied: 'Đã sao chép',
    students: 'Học sinh',
    worksheets: 'Phiếu bài tập',
    noClasses: 'Chưa có lớp nào',
    enterCode: 'Nhập mã tham gia',
    join: 'Tham gia',
    alreadyJoined: 'Bạn đã trong lớp này',
    invalidCode: 'Mã không hợp lệ',
    created: 'Đã tạo',
    backToList: 'Về danh sách',
    mobileCreateExam: 'Tạo bài thi',
    assignWorksheet: 'Gán phiếu',
    noWorksheets: 'Chưa có phiếu nào',
    noStudents: 'Chưa có học sinh',
    doWorksheet: 'Làm bài',
    submit: 'Nộp bài',
    submitSuccess: 'Đã nộp bài',
    viewResult: 'Xem kết quả',
    quizScore: 'Điểm trắc nghiệm',
    sampleAnswer: 'Đáp án mẫu',
    submissions: 'Bài nộp',
    worksheetSubmissionsSection: 'Bài nộp phiếu bài tập',
    noWorksheetSubmissions: 'Chưa có bài nộp phiếu bài tập nào.',
    worksheetSubmissionsSeeExamBelow: 'Bài làm từ đề thi nằm ở mục "Bài nộp từ đề thi" phía dưới.',
    submittedAt: 'Nộp lúc',
    noSubmissions: 'Chưa có bài nộp',
    presentWorksheet: 'Trình chiếu phiếu bài tập',
    schoolLabel: 'Trường',
    gradeLevelLabel: 'Khối',
    subjectLabel: 'Môn',
    renameClass: 'Đổi tên lớp',
    saveClassName: 'Lưu tên lớp',
    cancelAction: 'Hủy',
    renameClassFailed: 'Đổi tên lớp thất bại.',
    renameClassSuccess: 'Đã đổi tên lớp.',
    examSubmissions: 'Bài nộp từ đề thi',
    noExamSubmissions: 'Chưa có bài nộp đề thi nào.',
    noExamsForClass: 'Lớp này chưa có đề thi nào.',
    examSessionNoAttemptsYet: 'Chưa có học sinh nộp bài thi này.',
    examStudentDoLinkOpen: 'QR & link cho học sinh',
    examStudentDoLinkCopy: 'Sao chép link làm bài',
    examStudentDoLinkCopied: 'Đã sao chép link làm bài cho học sinh.',
    examStudentShareDialogTitle: 'Chia sẻ bài thi cho học sinh',
    examStudentShareDialogDescription:
      'Học sinh quét mã QR hoặc mở link bên dưới. Trang đó dành cho học sinh làm bài — thầy/cô không cần điền tên hay làm bài tại đây.',
    examStudentShareUrlLabel: 'Link làm bài',
    examIdentityFromClassHint:
      'Hồ sơ trong lớp đã có họ tên và ngày sinh. Bấm Bắt đầu khi sẵn sàng làm bài; đồng hồ chỉ chạy sau khi bấm.',
    examChangeIdentityManual: 'Nhập họ tên và ngày sinh khác',
    examManualIdentityIntro:
      'Nhập thông tin và bấm Bắt đầu để làm bài. Đồng hồ chỉ chạy sau khi bấm Bắt đầu.',
    examStartTestButton: 'Bắt đầu bài kiểm tra',
    examOneAttemptNote: 'Mỗi tài khoản chỉ được làm bài một lần.',
    showStudentsAction: 'Xem học sinh làm bài',
    hideStudentsAction: 'Ẩn danh sách',
    examReviewAction: 'Chữa bài',
    examDeleteAction: 'Xóa bài thi',
    examDeleteConfirmTitle: 'Xóa bài thi này?',
    examDeleteConfirmDescription:
      'Toàn bộ bài làm và dữ liệu phiên thi sẽ bị xóa vĩnh viễn. Học sinh không còn mở được link làm bài.',
    examDeleteConfirmAction: 'Xóa bài thi',
    examDeleteSuccess: 'Đã xóa bài thi.',
    examDeleteFailed: 'Không xóa được bài thi.',
    examDeleting: 'Đang xóa…',
    examDeleteConfirmTypeHint: 'Nhập chính xác cụm sau để xác nhận (không phân biệt chữ hoa/thường):',
    examDeleteConfirmPhrase: 'XÓA BÀI THI',
    examAttemptCount: 'bài nộp',
    lowScoreWarningPrefix: 'Có',
    lowScoreWarningSuffix: 'học sinh điểm thấp (< 5/10). Giáo viên nên để ý và hỗ trợ thêm.',
    correctLabel: 'Đúng',
    wrongLabel: 'Sai',
    scoreLabel: 'Điểm',
    questionSuffix: 'câu',
    deleteClass: 'Xóa lớp',
    deleteClassConfirmTitle: 'Xóa lớp này?',
    deleteClassConfirmDescription:
      'Không thể hoàn tác. Thành viên, phiếu đã gán và bài nộp của lớp sẽ bị xóa. Phiếu bài tập gốc trong giáo trình vẫn được giữ.',
    deleteClassConfirmAction: 'Xóa vĩnh viễn',
    deleteClassFailed: 'Không xóa được lớp.',
    deleteClassSuccess: 'Đã xóa lớp.',
    deleteClassDeleting: 'Đang xóa…',
    deleteClassConfirmTypeHint: 'Nhập chính xác cụm sau để xác nhận (không phân biệt chữ hoa/thường):',
    deleteClassConfirmPhrase: 'XÓA LỚP',
    memberRoleStudent: 'Học sinh',
    memberRoleTeacher: 'Giáo viên',
    createClassSchoolRequired: 'Vui lòng chọn trường trước khi tạo lớp.',
    createClassSchoolPlaceholder: 'Gõ tên trường để tìm…',
    createClassSchoolHint: 'Lớp phải gắn với một trường. Chọn trường có sẵn hoặc thêm trường mới.',
    createClassSchoolSearching: 'Đang tìm trường…',
    createClassSchoolAddNew: 'Thêm trường này',
    createClassSchoolSelected: 'Trường đã chọn',
    createClassSchoolNotFound: 'Không tìm thấy trường đã chọn.',
    createClassSchoolTryOther: 'Chưa có trường trùng khớp. Đổi từ khóa hoặc dùng nút thêm trường (khi hiện).',
    joinStudentDisplayName: 'Họ và tên học sinh',
    joinStudentBirthDate: 'Ngày sinh',
    joinDobDayPlaceholder: 'Ngày',
    joinDobMonthPlaceholder: 'Tháng',
    joinDobYearPlaceholder: 'Năm',
    joinNameRequired: 'Vui lòng nhập họ và tên.',
    joinBirthRequired: 'Vui lòng chọn ngày sinh.',
    joinNameTooShort: 'Họ tên quá ngắn (ít nhất 2 ký tự).',
    memberBirthDateLabel: 'Sinh',
    removeStudentFromClass: 'Xóa khỏi lớp',
    removeStudentConfirmTitle: 'Xóa học sinh khỏi lớp?',
    removeStudentConfirmDescription:
      'Học sinh sẽ không còn trong danh sách lớp. Có thể tham gia lại bằng mã nếu cần.',
    removeStudentConfirmAction: 'Xóa khỏi lớp',
    removeStudentFailed: 'Không xóa được học sinh.',
    removeStudentSuccess: 'Đã xóa học sinh khỏi lớp.',
    removeStudentRemoving: 'Đang xóa…',
    leaveClass: 'Rời lớp',
    leaveClassConfirmTitle: 'Rời lớp này?',
    leaveClassConfirmDescription:
      'Bạn sẽ không còn trong danh sách lớp. Có thể tham gia lại bằng mã lớp nếu cần.',
    leaveClassConfirmAction: 'Rời lớp',
    leaveClassFailed: 'Không rời lớp được.',
    leaveClassSuccess: 'Bạn đã rời lớp.',
    leaveClassLeaving: 'Đang rời lớp…',
    examEnrollGateTitle: 'Tham gia lớp để làm bài thi',
    examEnrollGateDescription:
      'Đề thi này gắn với một lớp. Nhập họ tên và ngày sinh đúng như trong sổ lớp (không dùng tên mặc định tài khoản Google). Sau đó em có thể bắt đầu làm bài.',
    examEnrollSubmitButton: 'Tham gia lớp và làm bài thi',
    examEnrollSubmitting: 'Đang tham gia…',
  },
  worksheetSolutionPage: {
    metaTitlePrefix: 'Lời giải',
    metaTitleFallback: 'Phiếu bài tập — Lời giải',
    metaDescription:
      'Xem đáp án và lời giải chi tiết phiếu bài tập. Quét mã QR trên phiếu để mở trang này.',
    eyebrow: 'Phiếu bài tập',
    qrHint: 'Quét mã QR trên phiếu để mở trang này trên điện thoại hoặc máy tính.',
    cardTitle: 'Nội dung lời giải',
    backHome: 'Về trang chủ',
    updatedLabel: 'Cập nhật',
    questionBadge: 'Câu hỏi',
  },
  adminWorksheetVerify: {
    pageTitle: 'Báo cáo verify phiếu bài tập',
    pageDescription:
      'Trang này chủ yếu để đọc lại báo cáo các lượt verify tự động (cron): số phiếu trong hàng đợi, đã xử lý, số lần đóng verified và sửa nội dung. Bấm một dòng để xem chi tiết từng phiếu. Khi cần, có thể bấm "Bắt đầu quét mới" để chạy thủ công từng lô trên máy chủ.',
    reportScopeNote:
      'Mỗi lần verify ngầm sau khi tạo/sửa phiếu (Tạo giáo trình) cũng được ghi vào danh sách này khi máy chủ có SUPABASE_SERVICE_ROLE_KEY. Trước đây chỉ có quét lô/cron mới tạo dòng — nếu bạn đã verify nhưng không thấy báo cáo, hãy cấu hình service role và chạy verify lại một lần.',
    newScan: 'Bắt đầu quét mới',
    nextBatch: 'Xử lý lô tiếp theo',
    refresh: 'Làm mới',
    noReports: 'Chưa có báo cáo.',
    worksheetsPlanned: 'Phiếu trong hàng đợi',
    worksheetsProcessed: 'Phiếu đã xử lý',
    qsMarked: 'Lần đóng verified',
    qsPatched: 'Lần sửa nội dung',
    qsSkipped: 'Câu bỏ qua (thiếu dữ liệu)',
    status: 'Trạng thái',
    details: 'Chi tiết',
    batchSize: 'Phiếu mỗi bước',
    running: 'Đang chạy',
    completed: 'Hoàn tất',
    failed: 'Thất bại',
    cancelled: 'Đã hủy',
    openRow: 'Xem chi tiết phiếu',
    nonePending: 'Không có phiếu nào cần verify.',
    cronDoc: 'Tự động: GET /api/cron/worksheet-verify-batch với Authorization: Bearer ADMIN_WORKSHEET_VERIFY_CRON_SECRET',
    toastStarted: 'Đã tạo báo cáo',
    toastStepOk: 'Đã xử lý một lô',
    toastDone: 'Đã hoàn tất lượt quét',
    toastErr: 'Lỗi',
    worksheetId: 'ID phiếu',
    errors: 'Lỗi',
    durationMs: 'Thời gian (ms)',
    stopPoll: 'Dừng sau bước hiện tại',
    reportUpdatedAt: 'Cập nhật báo cáo',
  },
}

const EN_DICTIONARY: Dictionary = {
  ...VI_DICTIONARY,
  app: {
    siteName: 'NanoAI',
    defaultTitle: 'NanoAI - Unlimited creativity with AI',
    defaultDescription: 'Experience AI virtual try-on. Try outfits for 1-5 people, restore photos, enhance images, and combine images quickly.',
    toolHub: 'AI Tools',
    login: 'Sign in',
  },
  menu: {
    ...VI_DICTIONARY.menu,
    openMenu: 'Open menu',
    mainMenu: 'Main menu',
    accountMenu: 'Open account menu',
    system: 'System',
    admin: 'Admin',
    dashboard: 'Dashboard',
    processedImages: 'Processed images',
    translateHistory: 'Translation history',
    musicHistory: 'Music history',
    wallet: 'Wallet',
    credits: 'Credits',
    signIn: 'Sign in',
    signOut: 'Sign out',
    switchToRealAccount: 'Sign in with real account',
    exitDevMode: 'Exit dev mode',
    notifications: 'Notifications',
    noNotifications: 'No notifications yet',
  },
  footer: {
    platformTitle: 'NanoAI Platform',
    platformDescription: 'An AI platform for learning and digital content creation.',
    policyTitle: 'Advertising transparency',
    policyNotice: 'Content is presented in a neutral way and does not guarantee absolute outcomes. Users should review outputs before use.',
    contactTitle: 'Support contact',
    contactEmailLabel: 'Email',
    contactEmailValue: 'support@nanoai.vn',
    supportHours: 'Support hours: 08:30 - 17:30 (Mon - Sat)',
    adDisclosure: 'NanoAI aligns with Google, Meta, and TikTok ad content policies in Vietnam.',
    rights: '© NanoAI. All rights reserved.',
  },
  navGroup: {
    try_on: 'Try-on & Styling',
    image_edit: 'Image Editing',
    design_creative: 'Design & Creative',
    three_d_special: '3D & Specialized',
    translation: 'Translation',
    music_ai: 'AI Music',
    curriculum: 'Curriculum',
    learning_ai: 'AI Learning',
    system: 'System',
  },
  tool: {
    ...VI_DICTIONARY.tool,
    try_on: 'Virtual Try-on',
    restore_image: 'Restore Image',
    enhance_image: 'Enhance Image',
    beautify_image: 'Beautify Image',
    merge_image: 'Merge Images',
    create_banner: 'Create Banner',
    text_to_image: 'Text-to-image',
    create_id_photo: 'Create ID Photo',
    design_logo: 'Design Logo',
    story_with_images: 'Story with Images',
    create_sticker: 'Create Sticker',
    create_product_label: 'Create Product Label',
    create_barcode: 'Create Barcode & QR Code',
    design_package: 'Packaging Design (box, bag)',
    design_flat_bag: 'Flat bag design',
    cylinder_wrap_mockup: 'Bottle / Can Label Mockup',
    create_seal_warranty_label: 'Create seal & warranty label',
    design_stamp: 'Design stamp',
    meme_maker: 'Meme Maker',
    remove_object: 'Remove Object',
    remove_bg_png: 'Remove PNG Background',
    replace_product_bg: 'Replace Product Background',
    product_3d_sample: '3D Product Sample',
    model_3d_from_image: '3D Model from Image',
    create_video_from_image: 'Create Video from Image',
    interior_exterior: 'Interior & Exterior',
    my_house: 'Your House',
    portrait_photo: 'Portrait Photo',
    expand_frame: 'Expand Frame',
    face_swap: 'Face Swap',
    translate_document_image: 'Translate Document Images',
    ai_music_background: 'AI Background Music',
    ai_dj: 'AI DJ',
    music_from_image_mood: 'Music from Image Mood',
    realtime_music_control: 'Realtime Music Control',
    ai_language_learning: 'AI Language Learning',
    create_curriculum: 'Create curriculum',
    create_exam: 'Create exam',
    online_exam: 'Online exam (live session)',
    classes: 'Classes',
    try_on_1: 'Try-on 1 Person',
    try_on_2: 'Try-on 2 People',
    try_on_3: 'Try-on 3 People',
    try_on_4: 'Try-on 4 People',
    try_on_5: 'Try-on 5 People',
    admin: 'Admin',
  },
  creationSidebar: {
    back: 'Back',
    relatedTitle: 'Related',
    popularTitle: 'Popular tools',
  },
  classes: {
    title: 'Classes',
    myClasses: 'My classes',
    createClass: 'Create class',
    joinClass: 'Join class',
    joinClassRoleHint:
      'Class code: you join as a student/member. Opening an exam link or code also only registers you as a student. Teachers are whoever created the class and whoever created the exam — codes and links never grant teacher access.',
    className: 'Class name',
    joinCode: 'Join code',
    copyCode: 'Copy code',
    copied: 'Copied',
    students: 'Students',
    worksheets: 'Worksheets',
    noClasses: 'No classes yet',
    enterCode: 'Enter join code',
    join: 'Join',
    alreadyJoined: 'You are already in this class',
    invalidCode: 'Invalid code',
    created: 'Created',
    backToList: 'Back to list',
    mobileCreateExam: 'Create exam',
    assignWorksheet: 'Assign worksheet',
    noWorksheets: 'No worksheets yet',
    noStudents: 'No students yet',
    doWorksheet: 'Do worksheet',
    submit: 'Submit',
    submitSuccess: 'Submitted',
    viewResult: 'View result',
    quizScore: 'Quiz score',
    sampleAnswer: 'Sample answer',
    submissions: 'Submissions',
    worksheetSubmissionsSection: 'Worksheet submissions',
    noWorksheetSubmissions: 'No worksheet submissions yet.',
    worksheetSubmissionsSeeExamBelow: 'Exam attempts are listed under "Exam submissions" below.',
    submittedAt: 'Submitted at',
    noSubmissions: 'No submissions yet',
    presentWorksheet: 'Present worksheet',
    schoolLabel: 'School',
    gradeLevelLabel: 'Grade',
    subjectLabel: 'Subject',
    renameClass: 'Rename class',
    saveClassName: 'Save class name',
    cancelAction: 'Cancel',
    renameClassFailed: 'Failed to rename class.',
    renameClassSuccess: 'Class name updated.',
    examSubmissions: 'Exam submissions',
    noExamSubmissions: 'No exam submissions yet.',
    noExamsForClass: 'No exams are linked to this class yet.',
    examSessionNoAttemptsYet: 'No students have submitted this exam yet.',
    examStudentDoLinkOpen: 'QR & link for students',
    examStudentDoLinkCopy: 'Copy exam link',
    examStudentDoLinkCopied: 'Exam link for students copied.',
    examStudentShareDialogTitle: 'Share exam with students',
    examStudentShareDialogDescription:
      'Students scan the QR code or open the link below. That page is for students to take the exam—you do not need to enter your name or complete it there.',
    examStudentShareUrlLabel: 'Exam link',
    examIdentityFromClassHint:
      'Your class profile already has your name and date of birth. Press Start when you are ready; the timer begins only after you start.',
    examChangeIdentityManual: 'Enter a different name and date of birth',
    examManualIdentityIntro:
      'Enter your details and press Start to begin. The timer starts only after you press Start.',
    examStartTestButton: 'Start test',
    examOneAttemptNote: 'Each account can submit this test only once.',
    showStudentsAction: 'Show students',
    hideStudentsAction: 'Hide list',
    examReviewAction: 'Review',
    examDeleteAction: 'Delete exam',
    examDeleteConfirmTitle: 'Delete this exam?',
    examDeleteConfirmDescription:
      'All submissions and this exam session will be permanently removed. Students will no longer be able to open the exam link.',
    examDeleteConfirmAction: 'Delete exam',
    examDeleteSuccess: 'Exam deleted.',
    examDeleteFailed: 'Could not delete the exam.',
    examDeleting: 'Deleting…',
    examDeleteConfirmTypeHint: 'Type the phrase below to confirm (not case-sensitive):',
    examDeleteConfirmPhrase: 'DELETE EXAM',
    examAttemptCount: 'submissions',
    lowScoreWarningPrefix: 'There are',
    lowScoreWarningSuffix: 'students with low scores (< 5/10). Please provide extra support.',
    correctLabel: 'Correct',
    wrongLabel: 'Wrong',
    scoreLabel: 'Score',
    questionSuffix: 'questions',
    deleteClass: 'Delete class',
    deleteClassConfirmTitle: 'Delete this class?',
    deleteClassConfirmDescription:
      'This cannot be undone. Members, assigned worksheets, and submissions for this class will be removed. Original worksheets in your curriculum stay.',
    deleteClassConfirmAction: 'Delete permanently',
    deleteClassFailed: 'Could not delete the class.',
    deleteClassSuccess: 'Class deleted.',
    deleteClassDeleting: 'Deleting…',
    deleteClassConfirmTypeHint: 'Type the phrase below to confirm (not case-sensitive):',
    deleteClassConfirmPhrase: 'DELETE CLASS',
    memberRoleStudent: 'Student',
    memberRoleTeacher: 'Teacher',
    createClassSchoolRequired: 'Please select a school before creating a class.',
    createClassSchoolPlaceholder: 'Type a school name to search…',
    createClassSchoolHint: 'Each class must belong to a school. Pick an existing school or add a new one.',
    createClassSchoolSearching: 'Searching schools…',
    createClassSchoolAddNew: 'Add this school',
    createClassSchoolSelected: 'Selected school',
    createClassSchoolNotFound: 'Selected school was not found.',
    createClassSchoolTryOther: 'No matching school yet. Try different keywords or use “Add this school” when it appears.',
    joinStudentDisplayName: 'Student full name',
    joinStudentBirthDate: 'Date of birth',
    joinDobDayPlaceholder: 'Day',
    joinDobMonthPlaceholder: 'Month',
    joinDobYearPlaceholder: 'Year',
    joinNameRequired: 'Please enter full name.',
    joinBirthRequired: 'Please select date of birth.',
    joinNameTooShort: 'Name is too short (at least 2 characters).',
    memberBirthDateLabel: 'Born',
    removeStudentFromClass: 'Remove from class',
    removeStudentConfirmTitle: 'Remove this student from the class?',
    removeStudentConfirmDescription:
      'They will no longer be on the class list. They can join again with the class code if needed.',
    removeStudentConfirmAction: 'Remove from class',
    removeStudentFailed: 'Could not remove the student.',
    removeStudentSuccess: 'Student removed from class.',
    removeStudentRemoving: 'Removing…',
    leaveClass: 'Leave class',
    leaveClassConfirmTitle: 'Leave this class?',
    leaveClassConfirmDescription:
      'You will be removed from the class list. You can join again with the class code if needed.',
    leaveClassConfirmAction: 'Leave class',
    leaveClassFailed: 'Could not leave the class.',
    leaveClassSuccess: 'You have left the class.',
    leaveClassLeaving: 'Leaving…',
    examEnrollGateTitle: 'Join the class to take this test',
    examEnrollGateDescription:
      'This test is linked to a class. Enter your full name and date of birth as in the class register (not your account’s default name). You can start the test afterward.',
    examEnrollSubmitButton: 'Join class and take the test',
    examEnrollSubmitting: 'Joining…',
  },
  worksheetSolutionPage: {
    metaTitlePrefix: 'Solutions',
    metaTitleFallback: 'Worksheet — Solutions',
    metaDescription:
      'View answers and detailed solutions. Scan the QR code on the worksheet to open this page.',
    eyebrow: 'Worksheet',
    qrHint: 'Scan the QR code on the worksheet to open this page on your phone or computer.',
    cardTitle: 'Solutions',
    backHome: 'Back to home',
    updatedLabel: 'Updated',
    questionBadge: 'Question',
  },
  adminWorksheetVerify: {
    pageTitle: 'Worksheet verify reports',
    pageDescription:
      'Mainly for reviewing reports from automated verify runs (cron): queued/processed worksheets, verify marks, and content fixes. Expand a row for per-worksheet details. Use “Start new scan” to run an on-demand batch on the server when needed.',
    reportScopeNote:
      'Each background verify (after creating/editing a worksheet in the curriculum builder) is also logged here when the server has SUPABASE_SERVICE_ROLE_KEY. Previously only batch/cron runs created rows—if you verified but saw no report, set the service role key and run verify once more.',
    newScan: 'Start new scan',
    nextBatch: 'Process next batch',
    refresh: 'Refresh',
    noReports: 'No reports yet.',
    worksheetsPlanned: 'Worksheets queued',
    worksheetsProcessed: 'Worksheets processed',
    qsMarked: 'Verify marks applied',
    qsPatched: 'Content fixes applied',
    qsSkipped: 'Questions skipped (invalid)',
    status: 'Status',
    details: 'Details',
    batchSize: 'Worksheets per step',
    running: 'Running',
    completed: 'Completed',
    failed: 'Failed',
    cancelled: 'Cancelled',
    openRow: 'Open worksheet',
    nonePending: 'No worksheets need verification.',
    cronDoc: 'Automation: GET /api/cron/worksheet-verify-batch with Authorization: Bearer ADMIN_WORKSHEET_VERIFY_CRON_SECRET',
    toastStarted: 'Report created',
    toastStepOk: 'Batch processed',
    toastDone: 'Scan finished',
    toastErr: 'Error',
    worksheetId: 'Worksheet ID',
    errors: 'Errors',
    durationMs: 'Duration (ms)',
    stopPoll: 'Stop after current step',
    reportUpdatedAt: 'Report updated',
  },
}

const ZH_DICTIONARY: Dictionary = {
  ...EN_DICTIONARY,
  app: {
    ...EN_DICTIONARY.app,
    defaultTitle: 'NanoAI - AI 创意无限',
    defaultDescription: '体验 AI 虚拟试衣。支持 1-5 人试衣、修复照片、清晰化和合成图片。',
    toolHub: 'AI 工具',
    login: '登录',
  },
  footer: {
    platformTitle: 'NanoAI 平台',
    platformDescription: '用于学习与数字内容创作的 AI 平台。',
    policyTitle: '广告透明说明',
    policyNotice: '平台内容以中性方式呈现，不承诺绝对结果。请在使用前自行评估输出内容。',
    contactTitle: '支持联系',
    contactEmailLabel: '邮箱',
    contactEmailValue: 'support@nanoai.vn',
    supportHours: '支持时间：08:30 - 17:30（周一至周六）',
    adDisclosure: 'NanoAI 在越南遵循 Google、Meta 与 TikTok 的广告内容政策。',
    rights: '© NanoAI. 保留所有权利。',
  },
  menu: {
    ...EN_DICTIONARY.menu,
    openMenu: '打开菜单',
    mainMenu: '主菜单',
    accountMenu: '打开账户菜单',
    system: '系统',
    admin: '管理',
    dashboard: '控制台',
    processedImages: '已处理图片',
    translateHistory: '翻译历史',
    musicHistory: '音乐历史',
    wallet: '钱包',
    credits: '点数',
    signIn: '登录',
    signOut: '退出登录',
    switchToRealAccount: '登录真实账号',
    exitDevMode: '退出开发模式',
    notifications: '通知',
    noNotifications: '暂无通知',
  },
  navGroup: {
    try_on: '试衣与穿搭',
    image_edit: '图片编辑',
    design_creative: '设计与创意',
    three_d_special: '3D 与专业工具',
    translation: '翻译',
    music_ai: 'AI 音乐',
    curriculum: '课程',
    learning_ai: 'AI 学习',
    system: '系统',
  },
  tool: {
    ...EN_DICTIONARY.tool,
    try_on: '虚拟试衣',
    restore_image: '照片修复',
    enhance_image: '图片增强',
    beautify_image: '图片美化',
    merge_image: '图片合成',
    create_banner: '生成横幅',
    text_to_image: '文生图',
    create_id_photo: '制作证件照',
    design_logo: '设计 Logo',
    story_with_images: '图像故事',
    create_sticker: '生成贴纸',
    create_product_label: '创建产品介绍标签',
    create_barcode: '创建条形码和二维码',
    design_package: '包装设计（箱・袋）',
    design_flat_bag: '平面袋设计',
    cylinder_wrap_mockup: '瓶子/罐子标签样机',
    create_seal_warranty_label: '创建封条/保修标签',
    design_stamp: '设计印章',
    meme_maker: '表情包制作',
    remove_object: '移除物体',
    remove_bg_png: '去除 PNG 背景',
    replace_product_bg: '替换商品背景',
    product_3d_sample: '3D 商品样图',
    model_3d_from_image: '从图片生成 3D 模型',
    create_video_from_image: '从图片创建视频',
    interior_exterior: '室内与室外',
    my_house: '我的房屋',
    portrait_photo: '人像照片',
    expand_frame: '扩展画幅',
    face_swap: '换脸',
    translate_document_image: '文档图片翻译',
    ai_music_background: 'AI 背景音乐',
    ai_dj: 'AI DJ',
    music_from_image_mood: '按图片情绪生成音乐',
    realtime_music_control: '实时音乐控制',
    ai_language_learning: 'AI 语言学习',
    create_curriculum: '创建课程',
    create_exam: '创建试题',
    online_exam: '在线考试（课堂）',
    classes: '班级',
    try_on_1: '1 人试衣',
    try_on_2: '2 人试衣',
    try_on_3: '3 人试衣',
    try_on_4: '4 人试衣',
    try_on_5: '5 人试衣',
    admin: '管理',
  },
  creationSidebar: {
    back: '返回',
    relatedTitle: '相关',
    popularTitle: '常用工具',
  },
  classes: {
    title: '班级',
    myClasses: '我的班级',
    createClass: '创建班级',
    joinClass: '加入班级',
    joinClassRoleHint:
      '班级加入码：以学生/成员身份加入。打开考试链接或考试码也同样只登记为学生。教师为创建班级和创建考试的人；任何加入码或链接都不会赋予教师权限。',
    className: '班级名称',
    joinCode: '加入码',
    copyCode: '复制码',
    copied: '已复制',
    students: '学生',
    worksheets: '作业单',
    noClasses: '暂无班级',
    enterCode: '输入加入码',
    join: '加入',
    alreadyJoined: '您已在此班级',
    invalidCode: '无效码',
    created: '已创建',
    backToList: '返回列表',
    mobileCreateExam: '创建考试',
    assignWorksheet: '分配作业单',
    noWorksheets: '暂无作业单',
    noStudents: '暂无学生',
    doWorksheet: '做作业',
    submit: '提交',
    submitSuccess: '已提交',
    viewResult: '查看结果',
    quizScore: '测验分数',
    sampleAnswer: '参考答案',
    submissions: '提交记录',
    worksheetSubmissionsSection: '练习单提交',
    noWorksheetSubmissions: '暂无练习单提交。',
    worksheetSubmissionsSeeExamBelow: '试卷作答请查看下方的「试题提交」。',
    submittedAt: '提交时间',
    noSubmissions: '暂无提交',
    presentWorksheet: '演示作业单',
    schoolLabel: '学校',
    gradeLevelLabel: '年级',
    subjectLabel: '科目',
    renameClass: '重命名班级',
    saveClassName: '保存班级名称',
    cancelAction: '取消',
    renameClassFailed: '班级重命名失败。',
    renameClassSuccess: '班级名称已更新。',
    examSubmissions: '试题提交',
    noExamSubmissions: '暂无试题提交。',
    noExamsForClass: '本班级尚未关联任何测验。',
    examSessionNoAttemptsYet: '还没有学生提交本场测验。',
    examStudentDoLinkOpen: '学生用二维码与链接',
    examStudentDoLinkCopy: '复制答题链接',
    examStudentDoLinkCopied: '已复制学生答题链接。',
    examStudentShareDialogTitle: '向学生分享考试',
    examStudentShareDialogDescription:
      '学生可扫描二维码或打开下方链接。该页面供学生答题，教师无需在此填写姓名或作答。',
    examStudentShareUrlLabel: '答题链接',
    examIdentityFromClassHint:
      '班级档案中已有您的姓名与出生日期。准备好后点击开始；计时仅在点击开始后启动。',
    examChangeIdentityManual: '改用其他姓名与出生日期',
    examManualIdentityIntro: '请填写信息并点击开始答题；计时仅在点击开始后启动。',
    examStartTestButton: '开始测验',
    examOneAttemptNote: '每个账号只能提交一次。',
    showStudentsAction: '查看作答学生',
    hideStudentsAction: '收起列表',
    examReviewAction: '讲评',
    examDeleteAction: '删除考试',
    examDeleteConfirmTitle: '删除这场考试？',
    examDeleteConfirmDescription: '所有作答记录与考试数据将被永久删除，学生将无法再打开答题链接。',
    examDeleteConfirmAction: '删除考试',
    examDeleteSuccess: '已删除考试。',
    examDeleteFailed: '无法删除考试。',
    examDeleting: '正在删除…',
    examDeleteConfirmTypeHint: '请输入以下文字以确认（需完全一致）：',
    examDeleteConfirmPhrase: '删除考试',
    examAttemptCount: '份提交',
    lowScoreWarningPrefix: '有',
    lowScoreWarningSuffix: '名学生分数较低（< 5/10），建议教师重点关注并辅导。',
    correctLabel: '正确',
    wrongLabel: '错误',
    scoreLabel: '得分',
    questionSuffix: '题',
    deleteClass: '删除班级',
    deleteClassConfirmTitle: '确定删除此班级？',
    deleteClassConfirmDescription:
      '此操作无法撤销。该班级的成员、已分配练习单与提交记录将被删除。课程中的原始练习单仍会保留。',
    deleteClassConfirmAction: '永久删除',
    deleteClassFailed: '无法删除班级。',
    deleteClassSuccess: '班级已删除。',
    deleteClassDeleting: '正在删除…',
    deleteClassConfirmTypeHint: '请输入以下文字以确认（需完全一致）：',
    deleteClassConfirmPhrase: '删除班级',
    memberRoleStudent: '学生',
    memberRoleTeacher: '教师',
    createClassSchoolRequired: '创建班级前请先选择学校。',
    createClassSchoolPlaceholder: '输入学校名称搜索…',
    createClassSchoolHint: '每个班级必须归属一所学校。请选择已有学校或新增学校。',
    createClassSchoolSearching: '正在搜索学校…',
    createClassSchoolAddNew: '添加此学校',
    createClassSchoolSelected: '已选学校',
    createClassSchoolNotFound: '未找到所选学校。',
    createClassSchoolTryOther: '暂无匹配学校。可更换关键词，或在出现按钮时添加新学校。',
    joinStudentDisplayName: '学生姓名',
    joinStudentBirthDate: '出生日期',
    joinDobDayPlaceholder: '日',
    joinDobMonthPlaceholder: '月',
    joinDobYearPlaceholder: '年',
    joinNameRequired: '请填写姓名。',
    joinBirthRequired: '请选择出生日期。',
    joinNameTooShort: '姓名过短（至少 2 个字符）。',
    memberBirthDateLabel: '出生',
    removeStudentFromClass: '移出班级',
    removeStudentConfirmTitle: '将该学生移出班级？',
    removeStudentConfirmDescription: '学生将从班级名单中移除，需要时可凭班级码再次加入。',
    removeStudentConfirmAction: '确认移出',
    removeStudentFailed: '无法移出学生。',
    removeStudentSuccess: '已将学生移出班级。',
    removeStudentRemoving: '正在移除…',
    leaveClass: '退出班级',
    leaveClassConfirmTitle: '确定退出此班级？',
    leaveClassConfirmDescription: '您将从班级名单中移除。需要时可凭班级码再次加入。',
    leaveClassConfirmAction: '退出班级',
    leaveClassFailed: '无法退出班级。',
    leaveClassSuccess: '已退出班级。',
    leaveClassLeaving: '正在退出…',
    examEnrollGateTitle: '加入班级后才能参加测验',
    examEnrollGateDescription:
      '本测验关联班级。请按班级名册填写姓名与出生日期（勿使用账号默认显示名）。填写后即可开始答题。',
    examEnrollSubmitButton: '加入班级并开始测验',
    examEnrollSubmitting: '正在加入…',
  },
  worksheetSolutionPage: {
    metaTitlePrefix: '解答',
    metaTitleFallback: '练习单 — 解答',
    metaDescription: '查看练习单的答案与详细解答。扫描练习上的二维码打开本页。',
    eyebrow: '练习单',
    qrHint: '扫描练习上的二维码，在手机或电脑上打开本页。',
    cardTitle: '解答内容',
    backHome: '返回首页',
    updatedLabel: '更新于',
    questionBadge: '题目',
  },
  adminWorksheetVerify: {
    pageTitle: '作业单核验报告',
    pageDescription:
      '主要用于查看自动核验（cron）各次运行的报告：排队/已处理作业单数、核验标记与内容修正次数；展开行可看每张作业单明细。需要时也可点此「开始新扫描」在服务器上手动分批执行。',
    reportScopeNote:
      '在课程创建流程中每次后台核验也会写入此列表（需服务器配置 SUPABASE_SERVICE_ROLE_KEY）。若之前只有批量/cron 才会出现记录，请配置该密钥后重新触发一次核验。',
    newScan: '开始新扫描',
    nextBatch: '处理下一批',
    refresh: '刷新',
    noReports: '暂无报告。',
    worksheetsPlanned: '排队作业单数',
    worksheetsProcessed: '已处理作业单',
    qsMarked: '核验标记次数',
    qsPatched: '内容修正次数',
    qsSkipped: '跳过题目（数据不全）',
    status: '状态',
    details: '详情',
    batchSize: '每步作业单数',
    running: '进行中',
    completed: '已完成',
    failed: '失败',
    cancelled: '已取消',
    openRow: '打开作业单',
    nonePending: '没有需要核验的作业单。',
    cronDoc: '自动化：GET /api/cron/worksheet-verify-batch，请求头 Authorization: Bearer ADMIN_WORKSHEET_VERIFY_CRON_SECRET',
    toastStarted: '已创建报告',
    toastStepOk: '已处理一批',
    toastDone: '扫描完成',
    toastErr: '错误',
    worksheetId: '作业单 ID',
    errors: '错误',
    durationMs: '耗时（毫秒）',
    stopPoll: '当前步完成后停止',
    reportUpdatedAt: '报告更新时间',
  },
}

const JA_DICTIONARY: Dictionary = {
  ...EN_DICTIONARY,
  app: {
    ...EN_DICTIONARY.app,
    defaultTitle: 'NanoAI - AI で無限の創造',
    defaultDescription: 'AI バーチャル試着を体験。1-5 人試着、写真修復、高画質化、画像合成に対応。',
    toolHub: 'AI ツール',
    login: 'ログイン',
  },
  footer: {
    platformTitle: 'NanoAI プラットフォーム',
    platformDescription: '学習とデジタルコンテンツ制作を支援する AI プラットフォーム。',
    policyTitle: '広告ポリシーの透明性',
    policyNotice: 'コンテンツは中立的に表示され、絶対的な結果を保証しません。利用前に出力内容をご確認ください。',
    contactTitle: 'サポート連絡先',
    contactEmailLabel: 'メール',
    contactEmailValue: 'support@nanoai.vn',
    supportHours: 'サポート時間: 08:30 - 17:30（月 - 土）',
    adDisclosure: 'NanoAI はベトナムにおける Google・Meta・TikTok の広告コンテンツ方針に準拠します。',
    rights: '© NanoAI. All rights reserved.',
  },
  menu: {
    ...EN_DICTIONARY.menu,
    openMenu: 'メニューを開く',
    mainMenu: 'メインメニュー',
    accountMenu: 'アカウントメニューを開く',
    system: 'システム',
    admin: '管理',
    dashboard: 'ダッシュボード',
    processedImages: '処理済み画像',
    translateHistory: '翻訳履歴',
    musicHistory: '音楽履歴',
    wallet: 'ウォレット',
    credits: 'クレジット',
    signIn: 'ログイン',
    signOut: 'ログアウト',
    switchToRealAccount: '本番アカウントでログイン',
    exitDevMode: '開発モードを終了',
    notifications: '通知',
    noNotifications: '通知はありません',
  },
  navGroup: {
    try_on: '試着・コーデ',
    image_edit: '画像編集',
    design_creative: 'デザイン・クリエイティブ',
    three_d_special: '3D・専門ツール',
    translation: '翻訳',
    music_ai: 'AI 音楽',
    curriculum: 'カリキュラム',
    learning_ai: 'AI 学習',
    system: 'システム',
  },
  tool: {
    ...EN_DICTIONARY.tool,
    try_on: 'バーチャル試着',
    restore_image: '画像修復',
    enhance_image: '画像高画質化',
    beautify_image: '画像補正',
    merge_image: '画像合成',
    create_banner: 'バナー作成',
    text_to_image: 'テキストから画像',
    create_id_photo: '証明写真作成',
    design_logo: 'ロゴ作成',
    story_with_images: '画像でストーリー作成',
    create_sticker: 'ステッカー作成',
    create_product_label: '商品紹介ラベル作成',
    create_barcode: 'バーコード・QRコード作成',
    design_package: '包装設計（箱・袋）',
    design_flat_bag: '平面袋デザイン',
    cylinder_wrap_mockup: 'ボトル・缶ラベルモックアップ',
    create_seal_warranty_label: '封印・保証ラベル作成',
    design_stamp: 'スタンプデザイン',
    meme_maker: 'ミーム作成',
    remove_object: 'オブジェクト削除',
    remove_bg_png: 'PNG 背景削除',
    replace_product_bg: '商品背景置換',
    product_3d_sample: '3D 商品サンプル',
    model_3d_from_image: '画像から 3D モデル生成',
    create_video_from_image: '画像から動画作成',
    interior_exterior: '内装・外装',
    my_house: 'あなたの家',
    portrait_photo: 'ポートレート写真',
    expand_frame: 'フレーム拡張',
    face_swap: '顔交換',
    translate_document_image: '書類画像翻訳',
    ai_music_background: 'AI BGM',
    ai_dj: 'AI DJ',
    music_from_image_mood: '画像の雰囲気から音楽生成',
    realtime_music_control: 'リアルタイム音楽制御',
    ai_language_learning: 'AI 語学学習',
    create_curriculum: 'カリキュラム作成',
    create_exam: '試験作成',
    online_exam: 'オンライン試験（授業）',
    classes: 'クラス',
    try_on_1: '1人試着',
    try_on_2: '2人試着',
    try_on_3: '3人試着',
    try_on_4: '4人試着',
    try_on_5: '5人試着',
    admin: '管理',
  },
  creationSidebar: {
    back: '戻る',
    relatedTitle: '関連',
    popularTitle: 'よく使うツール',
  },
  classes: {
    title: 'クラス',
    myClasses: 'マイクラス',
    createClass: 'クラス作成',
    joinClass: 'クラス参加',
    joinClassRoleHint:
      'クラス参加コードでは学生・メンバーとして追加されます。試験のリンクやコードを開いても学生としての登録のみです。教師はクラスと試験を作成した人であり、参加コードやリンクでは教師権限になりません。',
    className: 'クラス名',
    joinCode: '参加コード',
    copyCode: 'コードをコピー',
    copied: 'コピーしました',
    students: '生徒',
    worksheets: 'ワークシート',
    noClasses: 'クラスがありません',
    enterCode: '参加コードを入力',
    join: '参加',
    alreadyJoined: '既にこのクラスに参加しています',
    invalidCode: '無効なコード',
    created: '作成済み',
    backToList: '一覧に戻る',
    mobileCreateExam: '試験を作成',
    assignWorksheet: 'ワークシートを割り当て',
    noWorksheets: 'ワークシートがありません',
    noStudents: '生徒がいません',
    doWorksheet: '問題を解く',
    submit: '提出',
    submitSuccess: '提出済み',
    viewResult: '結果を見る',
    quizScore: 'クイズ得点',
    sampleAnswer: '模範解答',
    submissions: '提出一覧',
    worksheetSubmissionsSection: 'ワークシート提出',
    noWorksheetSubmissions: 'ワークシートの提出はまだありません。',
    worksheetSubmissionsSeeExamBelow: '試験の答案は下の「試験提出」に表示されます。',
    submittedAt: '提出日時',
    noSubmissions: '提出なし',
    presentWorksheet: 'ワークシートをプレゼン',
    schoolLabel: '学校',
    gradeLevelLabel: '学年',
    subjectLabel: '教科',
    renameClass: 'クラス名を変更',
    saveClassName: 'クラス名を保存',
    cancelAction: 'キャンセル',
    renameClassFailed: 'クラス名の変更に失敗しました。',
    renameClassSuccess: 'クラス名を更新しました。',
    examSubmissions: '試験提出',
    noExamSubmissions: '試験提出はまだありません。',
    noExamsForClass: 'このクラスにはまだテストがありません。',
    examSessionNoAttemptsYet: 'このテストの提出はまだありません。',
    examStudentDoLinkOpen: 'QRと受験リンク',
    examStudentDoLinkCopy: '受験リンクをコピー',
    examStudentDoLinkCopied: '受験用リンクをコピーしました。',
    examStudentShareDialogTitle: '受験生に試験を共有',
    examStudentShareDialogDescription:
      '受験生はQRコードを読み取るか、下のリンクを開いてください。そのページは受験用です。教員が名前を入力したり解答する必要はありません。',
    examStudentShareUrlLabel: '受験リンク',
    examIdentityFromClassHint:
      'クラス名簿に氏名・生年月日が登録済みです。準備ができたら開始を押してください。タイマーは開始後に動きます。',
    examChangeIdentityManual: '別の氏名・生年月日を入力',
    examManualIdentityIntro: '情報を入力して開始を押してください。タイマーは開始後に動きます。',
    examStartTestButton: 'テストを開始',
    examOneAttemptNote: 'アカウントごとに1回だけ受験できます。',
    showStudentsAction: '受験した生徒を表示',
    hideStudentsAction: 'リストを隠す',
    examReviewAction: '解説',
    examDeleteAction: '試験を削除',
    examDeleteConfirmTitle: 'この試験を削除しますか？',
    examDeleteConfirmDescription:
      'すべての解答と試験データが完全に削除されます。受験生はリンクから開けなくなります。',
    examDeleteConfirmAction: '試験を削除',
    examDeleteSuccess: '試験を削除しました。',
    examDeleteFailed: '試験を削除できませんでした。',
    examDeleting: '削除中…',
    examDeleteConfirmTypeHint: '確認のため、次の文を正確に入力してください。',
    examDeleteConfirmPhrase: '試験を削除',
    examAttemptCount: '件の提出',
    lowScoreWarningPrefix: '低得点（< 5/10）の生徒が',
    lowScoreWarningSuffix: '人います。重点的なフォローをおすすめします。',
    correctLabel: '正解',
    wrongLabel: '不正解',
    scoreLabel: '点数',
    questionSuffix: '問',
    deleteClass: 'クラスを削除',
    deleteClassConfirmTitle: 'このクラスを削除しますか？',
    deleteClassConfirmDescription:
      '取り消せません。メンバー、割り当て済みワークシート、提出データが削除されます。カリキュラム上の元のワークシートは残ります。',
    deleteClassConfirmAction: '完全に削除',
    deleteClassFailed: 'クラスを削除できませんでした。',
    deleteClassSuccess: 'クラスを削除しました。',
    deleteClassDeleting: '削除中…',
    deleteClassConfirmTypeHint: '確認のため、次の文を正確に入力してください。',
    deleteClassConfirmPhrase: 'クラスを削除',
    memberRoleStudent: '生徒',
    memberRoleTeacher: '教師',
    createClassSchoolRequired: 'クラスを作成する前に学校を選んでください。',
    createClassSchoolPlaceholder: '学校名を入力して検索…',
    createClassSchoolHint: 'クラスは必ず学校に紐づきます。一覧から選ぶか、新規追加してください。',
    createClassSchoolSearching: '学校を検索中…',
    createClassSchoolAddNew: 'この学校を追加',
    createClassSchoolSelected: '選択中の学校',
    createClassSchoolNotFound: '選択した学校が見つかりません。',
    createClassSchoolTryOther: '一致する学校がありません。別のキーワードを試すか、表示されたら学校を追加してください。',
    joinStudentDisplayName: '生徒の氏名',
    joinStudentBirthDate: '生年月日',
    joinDobDayPlaceholder: '日',
    joinDobMonthPlaceholder: '月',
    joinDobYearPlaceholder: '年',
    joinNameRequired: '氏名を入力してください。',
    joinBirthRequired: '生年月日を選んでください。',
    joinNameTooShort: '氏名が短すぎます（2文字以上）。',
    memberBirthDateLabel: '生年月日',
    removeStudentFromClass: 'クラスから外す',
    removeStudentConfirmTitle: 'この生徒をクラスから外しますか？',
    removeStudentConfirmDescription: '名簿から削除されます。必要なら参加コードで再参加できます。',
    removeStudentConfirmAction: 'クラスから外す',
    removeStudentFailed: '削除できませんでした。',
    removeStudentSuccess: 'クラスから外しました。',
    removeStudentRemoving: '削除中…',
    leaveClass: 'クラスを抜ける',
    leaveClassConfirmTitle: 'このクラスを抜けますか？',
    leaveClassConfirmDescription: '名簿から外れます。必要なら参加コードで再参加できます。',
    leaveClassConfirmAction: 'クラスを抜ける',
    leaveClassFailed: 'クラスを抜けられませんでした。',
    leaveClassSuccess: 'クラスを抜けました。',
    leaveClassLeaving: '処理中…',
    examEnrollGateTitle: 'テストを受けるにはクラスに参加',
    examEnrollGateDescription:
      'このテストはクラスに紐づいています。名簿と同じ氏名・生年月日を入力してください（アカウントの表示名は使わないでください）。その後、テストを開始できます。',
    examEnrollSubmitButton: 'クラスに参加してテストを受ける',
    examEnrollSubmitting: '参加処理中…',
  },
  worksheetSolutionPage: {
    metaTitlePrefix: '解答',
    metaTitleFallback: 'ワークシート — 解答',
    metaDescription:
      'ワークシートの正答と詳しい解答を表示。用紙のQRコードを読み取ってこのページを開けます。',
    eyebrow: 'ワークシート',
    qrHint: '用紙のQRコードを読み取ると、スマホやPCでこのページを開けます。',
    cardTitle: '解答の内容',
    backHome: 'ホームへ',
    updatedLabel: '更新',
    questionBadge: '設問',
  },
  adminWorksheetVerify: {
    pageTitle: 'ワークシート検証レポート',
    pageDescription:
      '未検証の設問があるワークシートを走査し、AI（Gemini Flash）で検証してバッチごとに集計します。手動ステップまたは cron（.env.example 参照）で実行できます。',
    reportScopeNote:
      'カリキュラム作成後のバックグラウンド検証も、サーバーに SUPABASE_SERVICE_ROLE_KEY がある場合はここに記録されます。以前はバッチ/cron のみでした。記録が無い場合はキーを設定し、検証を再実行してください。',
    newScan: '新しいスキャンを開始',
    nextBatch: '次のバッチを処理',
    refresh: '更新',
    noReports: 'レポートがありません。',
    worksheetsPlanned: 'キュー内ワークシート',
    worksheetsProcessed: '処理済みワークシート',
    qsMarked: '検証マーク適用',
    qsPatched: '内容修正',
    qsSkipped: 'スキップした設問（データ不備）',
    status: '状態',
    details: '詳細',
    batchSize: '1ステップあたりの枚数',
    running: '実行中',
    completed: '完了',
    failed: '失敗',
    cancelled: 'キャンセル',
    openRow: 'ワークシートを開く',
    nonePending: '検証が必要なワークシートはありません。',
    cronDoc: '自動化: GET /api/cron/worksheet-verify-batch、Authorization: Bearer ADMIN_WORKSHEET_VERIFY_CRON_SECRET',
    toastStarted: 'レポートを作成しました',
    toastStepOk: 'バッチを処理しました',
    toastDone: 'スキャンが完了しました',
    toastErr: 'エラー',
    worksheetId: 'ワークシート ID',
    errors: 'エラー',
    durationMs: '所要時間（ms）',
    stopPoll: '現在のステップの後に停止',
    reportUpdatedAt: 'レポート更新',
  },
}

const KO_DICTIONARY: Dictionary = {
  ...EN_DICTIONARY,
  app: {
    ...EN_DICTIONARY.app,
    defaultTitle: 'NanoAI - AI로 무한한 창작',
    defaultDescription: 'AI 가상 피팅을 경험하세요. 1-5인 피팅, 사진 복원, 선명화, 이미지 합성 지원.',
    toolHub: 'AI 도구',
    login: '로그인',
  },
  footer: {
    platformTitle: 'NanoAI 플랫폼',
    platformDescription: '학습 및 디지털 콘텐츠 제작을 지원하는 AI 플랫폼입니다.',
    policyTitle: '광고 정책 투명성',
    policyNotice: '콘텐츠는 중립적으로 제공되며 절대적인 결과를 보장하지 않습니다. 사용 전 결과를 검토해 주세요.',
    contactTitle: '지원 연락처',
    contactEmailLabel: '이메일',
    contactEmailValue: 'support@nanoai.vn',
    supportHours: '지원 시간: 08:30 - 17:30 (월 - 토)',
    adDisclosure: 'NanoAI는 베트남 내 Google, Meta, TikTok 광고 콘텐츠 정책을 준수합니다.',
    rights: '© NanoAI. All rights reserved.',
  },
  menu: {
    ...EN_DICTIONARY.menu,
    openMenu: '메뉴 열기',
    mainMenu: '메인 메뉴',
    accountMenu: '계정 메뉴 열기',
    system: '시스템',
    admin: '관리',
    dashboard: '대시보드',
    processedImages: '처리된 이미지',
    translateHistory: '번역 기록',
    musicHistory: '음악 기록',
    wallet: '지갑',
    credits: '크레딧',
    signIn: '로그인',
    signOut: '로그아웃',
    switchToRealAccount: '실계정으로 로그인',
    exitDevMode: '개발 모드 종료',
    notifications: '알림',
    noNotifications: '알림 없음',
  },
  navGroup: {
    try_on: '가상 피팅·스타일링',
    image_edit: '이미지 편집',
    design_creative: '디자인·크리에이티브',
    three_d_special: '3D·전문 도구',
    translation: '번역',
    music_ai: 'AI 음악',
    curriculum: '교육과정',
    learning_ai: 'AI 학습',
    system: '시스템',
  },
  tool: {
    ...EN_DICTIONARY.tool,
    try_on: '가상 피팅',
    restore_image: '이미지 복원',
    enhance_image: '이미지 선명화',
    beautify_image: '이미지 보정',
    merge_image: '이미지 합성',
    create_banner: '배너 생성',
    text_to_image: '텍스트로 이미지',
    create_id_photo: '증명사진 생성',
    design_logo: '로고 디자인',
    story_with_images: '이미지 스토리 만들기',
    create_sticker: '스티커 생성',
    create_product_label: '제품 소개 라벨 만들기',
    create_barcode: '바코드·QR 코드 만들기',
    design_package: '포장 설계 (상자, 가방)',
    design_flat_bag: '평면 가방 설계',
    cylinder_wrap_mockup: '병/캔 라벨 목업',
    create_seal_warranty_label: '봉인·보증 라벨 만들기',
    design_stamp: '스탬프 디자인',
    meme_maker: '밈 만들기',
    remove_object: '객체 제거',
    remove_bg_png: 'PNG 배경 제거',
    replace_product_bg: '상품 배경 교체',
    product_3d_sample: '3D 상품 샘플',
    model_3d_from_image: '이미지로 3D 모델 생성',
    create_video_from_image: '이미지에서 비디오 만들기',
    interior_exterior: '인테리어·익스테리어',
    my_house: '내 집',
    portrait_photo: '인물 사진',
    expand_frame: '프레임 확장',
    face_swap: '얼굴 교체',
    translate_document_image: '문서 이미지 번역',
    ai_music_background: 'AI 배경 음악',
    ai_dj: 'AI DJ',
    music_from_image_mood: '이미지 분위기 음악 생성',
    realtime_music_control: '실시간 음악 제어',
    ai_language_learning: 'AI 외국어 학습',
    create_curriculum: '교육과정 생성',
    create_exam: '시험 생성',
    online_exam: '온라인 시험(수업)',
    classes: '수업',
    try_on_1: '1인 피팅',
    try_on_2: '2인 피팅',
    try_on_3: '3인 피팅',
    try_on_4: '4인 피팅',
    try_on_5: '5인 피팅',
    admin: '관리',
  },
  creationSidebar: {
    back: '돌아가기',
    relatedTitle: '관련',
    popularTitle: '자주 쓰는 도구',
  },
  classes: {
    title: '수업',
    myClasses: '내 수업',
    createClass: '수업 만들기',
    joinClass: '수업 참가',
    joinClassRoleHint:
      '수업 참가 코드로 들어가면 학생(구성원)으로 등록됩니다. 시험 링크나 시험 코드로 들어가도 학생으로만 등록됩니다. 교사는 수업과 시험을 만든 계정이며, 참가 코드나 링크로는 교사 권한이 되지 않습니다.',
    className: '수업 이름',
    joinCode: '참가 코드',
    copyCode: '코드 복사',
    copied: '복사됨',
    students: '학생',
    worksheets: '워크시트',
    noClasses: '수업이 없습니다',
    enterCode: '참가 코드 입력',
    join: '참가',
    alreadyJoined: '이미 이 수업에 참가했습니다',
    invalidCode: '잘못된 코드',
    created: '생성됨',
    backToList: '목록으로',
    mobileCreateExam: '시험 만들기',
    assignWorksheet: '워크시트 할당',
    noWorksheets: '워크시트가 없습니다',
    noStudents: '학생이 없습니다',
    doWorksheet: '문제 풀기',
    submit: '제출',
    submitSuccess: '제출됨',
    viewResult: '결과 보기',
    quizScore: '퀴즈 점수',
    sampleAnswer: '모범 답안',
    submissions: '제출 목록',
    worksheetSubmissionsSection: '워크시트 제출',
    noWorksheetSubmissions: '워크시트 제출이 없습니다.',
    worksheetSubmissionsSeeExamBelow: '시험 응시 내역은 아래「시험 제출」에서 확인하세요.',
    submittedAt: '제출 시각',
    noSubmissions: '제출 없음',
    presentWorksheet: '워크시트 발표',
    schoolLabel: '학교',
    gradeLevelLabel: '학년',
    subjectLabel: '과목',
    renameClass: '수업 이름 변경',
    saveClassName: '수업 이름 저장',
    cancelAction: '취소',
    renameClassFailed: '수업 이름 변경에 실패했습니다.',
    renameClassSuccess: '수업 이름이 업데이트되었습니다.',
    examSubmissions: '시험 제출',
    noExamSubmissions: '시험 제출이 없습니다.',
    noExamsForClass: '이 수업에 연결된 시험이 아직 없습니다.',
    examSessionNoAttemptsYet: '이 시험을 제출한 학생이 아직 없습니다.',
    examStudentDoLinkOpen: '학생용 QR·링크',
    examStudentDoLinkCopy: '시험 링크 복사',
    examStudentDoLinkCopied: '학생용 시험 링크를 복사했습니다.',
    examStudentShareDialogTitle: '학생에게 시험 공유',
    examStudentShareDialogDescription:
      '학생이 QR 코드를 스캔하거나 아래 링크를 열면 됩니다. 해당 페이지는 학생용 시험 화면이며, 선생님께서 이름을 입력하거나 풀 필요는 없습니다.',
    examStudentShareUrlLabel: '시험 링크',
    examIdentityFromClassHint:
      '수업 명단에 이름과 생년월일이 이미 있습니다. 준비되면 시작을 누르세요. 타이머는 시작 후에만 작동합니다.',
    examChangeIdentityManual: '다른 이름·생년월일 입력',
    examManualIdentityIntro: '정보를 입력하고 시작을 누르세요. 타이머는 시작 후에만 작동합니다.',
    examStartTestButton: '시험 시작',
    examOneAttemptNote: '계정당 한 번만 응시할 수 있습니다.',
    showStudentsAction: '응시 학생 보기',
    hideStudentsAction: '목록 숨기기',
    examReviewAction: '해설',
    examDeleteAction: '시험 삭제',
    examDeleteConfirmTitle: '이 시험을 삭제할까요?',
    examDeleteConfirmDescription:
      '모든 제출과 시험 데이터가 영구 삭제됩니다. 학생은 더 이상 시험 링크를 열 수 없습니다.',
    examDeleteConfirmAction: '시험 삭제',
    examDeleteSuccess: '시험을 삭제했습니다.',
    examDeleteFailed: '시험을 삭제할 수 없습니다.',
    examDeleting: '삭제 중…',
    examDeleteConfirmTypeHint: '확인을 위해 아래 문구를 정확히 입력하세요.',
    examDeleteConfirmPhrase: '시험 삭제',
    examAttemptCount: '개 제출',
    lowScoreWarningPrefix: '낮은 점수(< 5/10) 학생이',
    lowScoreWarningSuffix: '명 있습니다. 추가 지도에 유의해주세요.',
    correctLabel: '정답',
    wrongLabel: '오답',
    scoreLabel: '점수',
    questionSuffix: '문항',
    deleteClass: '수업 삭제',
    deleteClassConfirmTitle: '이 수업을 삭제할까요?',
    deleteClassConfirmDescription:
      '되돌릴 수 없습니다. 구성원, 할당된 워크시트, 제출 기록이 삭제됩니다. 교육과정의 원본 워크시트는 유지됩니다.',
    deleteClassConfirmAction: '영구 삭제',
    deleteClassFailed: '수업을 삭제할 수 없습니다.',
    deleteClassSuccess: '수업이 삭제되었습니다.',
    deleteClassDeleting: '삭제 중…',
    deleteClassConfirmTypeHint: '확인을 위해 아래 문구를 정확히 입력하세요.',
    deleteClassConfirmPhrase: '수업 삭제',
    memberRoleStudent: '학생',
    memberRoleTeacher: '교사',
    createClassSchoolRequired: '수업을 만들기 전에 학교를 선택하세요.',
    createClassSchoolPlaceholder: '학교 이름을 입력해 검색…',
    createClassSchoolHint: '모든 수업은 학교에 연결되어야 합니다. 목록에서 고르거나 새 학교를 추가하세요.',
    createClassSchoolSearching: '학교 검색 중…',
    createClassSchoolAddNew: '이 학교 추가',
    createClassSchoolSelected: '선택한 학교',
    createClassSchoolNotFound: '선택한 학교를 찾을 수 없습니다.',
    createClassSchoolTryOther: '일치하는 학교가 없습니다. 다른 검색어를 쓰거나 버튼이 보이면 새 학교를 추가하세요.',
    joinStudentDisplayName: '학생 이름',
    joinStudentBirthDate: '생년월일',
    joinDobDayPlaceholder: '일',
    joinDobMonthPlaceholder: '월',
    joinDobYearPlaceholder: '년',
    joinNameRequired: '이름을 입력하세요.',
    joinBirthRequired: '생년월일을 선택하세요.',
    joinNameTooShort: '이름이 너무 짧습니다(2자 이상).',
    memberBirthDateLabel: '생일',
    removeStudentFromClass: '수업에서 제거',
    removeStudentConfirmTitle: '이 학생을 수업에서 제거할까요?',
    removeStudentConfirmDescription: '명단에서 사라집니다. 필요하면 참가 코드로 다시 들어올 수 있습니다.',
    removeStudentConfirmAction: '수업에서 제거',
    removeStudentFailed: '제거하지 못했습니다.',
    removeStudentSuccess: '수업에서 제거했습니다.',
    removeStudentRemoving: '제거 중…',
    leaveClass: '수업 나가기',
    leaveClassConfirmTitle: '이 수업에서 나갈까요?',
    leaveClassConfirmDescription: '명단에서 빠집니다. 필요하면 참가 코드로 다시 들어올 수 있습니다.',
    leaveClassConfirmAction: '나가기',
    leaveClassFailed: '수업을 나가지 못했습니다.',
    leaveClassSuccess: '수업에서 나갔습니다.',
    leaveClassLeaving: '나가는 중…',
    examEnrollGateTitle: '수업에 참가해야 시험을 볼 수 있습니다',
    examEnrollGateDescription:
      '이 시험은 수업과 연결되어 있습니다. 명단과 동일한 이름과 생년월일을 입력하세요(계정 기본 표시 이름 사용 금지). 이후 시험을 시작할 수 있습니다.',
    examEnrollSubmitButton: '수업 참가 후 시험 보기',
    examEnrollSubmitting: '참가 중…',
  },
  worksheetSolutionPage: {
    metaTitlePrefix: '해설',
    metaTitleFallback: '워크시트 — 해설',
    metaDescription: '워크시트의 정답과 상세 해설을 봅니다. 워크시트의 QR 코드를 스캔해 이 페이지를 엽니다.',
    eyebrow: '워크시트',
    qrHint: '워크시트의 QR 코드를 스캔하면 휴대폰이나 PC에서 이 페이지를 열 수 있습니다.',
    cardTitle: '해설 내용',
    backHome: '홈으로',
    updatedLabel: '업데이트',
    questionBadge: '문항',
  },
  adminWorksheetVerify: {
    pageTitle: '워크시트 검증 보고서',
    pageDescription:
      '주로 자동 검증(cron) 실행 결과 보고서를 다시 보는 페이지입니다. 대기/처리 워크시트 수, 검증 표시·내용 수정 횟수를 보여 주며 행을 펼치면 워크시트별 상세를 볼 수 있습니다. 필요 시 «새 스캔 시작»으로 서버에서 수동 배치 실행도 가능합니다.',
    reportScopeNote:
      '교육과정 생성 후 백그라운드 검증도 서버에 SUPABASE_SERVICE_ROLE_KEY가 있으면 여기에 기록됩니다. 이전에는 배치/cron만 기록되었습니다. 보고서가 없으면 키를 설정한 뒤 검증을 한 번 더 실행하세요.',
    newScan: '새 스캔 시작',
    nextBatch: '다음 배치 처리',
    refresh: '새로고침',
    noReports: '보고서가 없습니다.',
    worksheetsPlanned: '대기 중인 워크시트',
    worksheetsProcessed: '처리된 워크시트',
    qsMarked: '검증 표시 적용',
    qsPatched: '내용 수정',
    qsSkipped: '건너뛴 문항(데이터 부족)',
    status: '상태',
    details: '세부',
    batchSize: '단계당 워크시트 수',
    running: '진행 중',
    completed: '완료',
    failed: '실패',
    cancelled: '취소됨',
    openRow: '워크시트 열기',
    nonePending: '검증이 필요한 워크시트가 없습니다.',
    cronDoc: '자동화: GET /api/cron/worksheet-verify-batch, Authorization: Bearer ADMIN_WORKSHEET_VERIFY_CRON_SECRET',
    toastStarted: '보고서가 생성되었습니다',
    toastStepOk: '배치를 처리했습니다',
    toastDone: '스캔이 완료되었습니다',
    toastErr: '오류',
    worksheetId: '워크시트 ID',
    errors: '오류',
    durationMs: '소요 시간(ms)',
    stopPoll: '현재 단계 후 중지',
    reportUpdatedAt: '보고서 갱신',
  },
}

const DICTIONARIES: Record<WebLocale, Dictionary> = {
  vi: VI_DICTIONARY,
  en: EN_DICTIONARY,
  zh: ZH_DICTIONARY,
  ja: JA_DICTIONARY,
  ko: KO_DICTIONARY,
}

export function getDictionary(locale: WebLocale | null | undefined): Dictionary {
  if (!locale) return DICTIONARIES[DEFAULT_WEB_LOCALE]
  return DICTIONARIES[locale] || DICTIONARIES[DEFAULT_WEB_LOCALE]
}

