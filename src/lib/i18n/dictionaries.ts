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
    joinClassPreviewTitle: string
    joinClassPreviewCheckHint: string
    joinClassPreviewLoading: string
    joinClassPreviewNotFound: string
    joinClassPreviewNeedCode: string
    createClassFacingSubjectLabel: string
    createClassFacingSubjectPlaceholder: string
    createClassFacingTeacherLabel: string
    createClassFacingTeacherPlaceholder: string
    createClassFacingFieldsHint: string
    updateClassFacingSave: string
    updateClassFacingSaveAsDefaults: string
    updateClassFacingSuccess: string
    updateClassFacingFailed: string
    /** Tiêu đề khối chỉnh môn/GV hiển thị cho HS trên trang chi tiết lớp */
    classPageStudentFacingTitle: string
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
    /** HS: tiêu đề danh sách đề thi trong lớp */
    studentClassExamsTitle: string
    /** HS: chưa nộp bài thi */
    studentClassExamNotStarted: string
    /** HS: đã nộp */
    studentClassExamSubmitted: string
    /** HS: {score100}, {grade10} */
    studentClassExamProgressScores: string
    /** HS: {time} */
    studentClassExamSubmittedAt: string
    studentClassExamCtaStart: string
    studentClassExamCtaViewResult: string
    /** Phiên đề đóng */
    studentClassExamBadgeClosed: string
    /** Phiên đóng, HS chưa kịp nộp */
    studentClassExamClosedMissed: string
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
    /** Trang lam-bai: đã nộp trước (máy khác / phiên khác) — hiển thị kết quả đã lưu */
    examSubmittedTitle: string
    examSubmittedSavedEarlier: string
    /** Placeholder {grade} */
    examScoreOutOf10: string
    /** Quy theo tỷ lệ đạt/tối đa → thang 100 — placeholder {score100} */
    examResultScale100Line: string
    /** Tổng kết = điểm thang 100 ÷ 10 — placeholder {grade} */
    examResultSummaryGrade10Line: string
    /** Chia sẻ kết quả có thang 100 + /10 — {title}, {score100}, {grade} */
    examShareResultScaleLine: string
    /** Placeholders {score}, {max}, {pct} — điểm đạt/tối đa (không nhất thiết = số câu) */
    examCorrectRatioLine: string
    /** Placeholders {title}, {grade}, {score}, {max}, {pct} — chia sẻ kết quả */
    examShareResultLine: string
    /** Đề có TN + TL: {title}, {grade}, {score}, {max} */
    examShareResultLineMixed: string
    /** Kết quả lam-bai: {correct}, {total}, {quizPoints}, {quizMax} */
    examMcBreakdownLine: string
    /** {essayMax} */
    examEssayPendingBreakdownLine: string
    /** {score}, {max} */
    examTotalPendingBreakdownLine: string
    /** Chỉ TN hoặc điểm xong — {score}, {max} (điểm theo đề, đã format) */
    examTotalScoreByExamLine: string
    /** GV xem lớp — bài có TL: {correct}, {wrong}, {total}, {grade10}, {score}, {max}, {essayMax}, {time} */
    examTeacherAttemptMixedSummary: string
    /** Chỉ tự luận: {score}, {max}, {essayMax}, {time} */
    examTeacherAttemptEssayOnlySummary: string
    examShareDone: string
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
    /** Placeholders {submitted}, {notSubmitted} — roster lớp; chuỗi ngắn gọn cho một dòng */
    examSessionRosterReport: string
    /** Nút mở danh sách HS trong lớp chưa nộp bài thi */
    examSessionShowNotSubmitted: string
    examSessionNotSubmittedTitle: string
    examSessionNotSubmittedAllSubmitted: string
    examSessionNotSubmittedNoRoster: string
    lowScoreWarningPrefix: string
    lowScoreWarningSuffix: string
    correctLabel: string
    wrongLabel: string
    scoreLabel: string
    questionSuffix: string
    /** HS: gợi ý đính kèm ảnh bài làm tự luận */
    examEssayPhotoHint: string
    /** HS: giới hạn lưu ảnh — {days} */
    examEssayImageRetentionHint: string
    /** HS sau nộp bài — {expiresAt}, {days} */
    examEssayImageRetentionResult: string
    /** GV chấm TL — {days}, {expiresAt} */
    examGradeEssayImageRetentionTeacher: string
    /** GV khi có ảnh nhưng không có mốc ISO trong meta — {days} */
    examGradeEssayImageRetentionTeacherFallback: string
    examEssayUploadPick: string
    examEssayUploadCamera: string
    examEssayUploading: string
    examEssayRemoveImage: string
    examEssayTooManyImages: string
    examEssayUploadFailed: string
    examEssayAnswerPlaceholder: string
    /** GV: chấm điểm tự luận */
    examGradeEssayAction: string
    examGradeEssayDialogTitle: string
    examGradeEssayPointsLabel: string
    /** {max} */
    examGradeEssayPointsMaxHint: string
    examGradeEssaySave: string
    examGradeEssayAiSuggest: string
    examGradeEssayAiRunning: string
    examGradeEssayAiApply: string
    examGradeEssayStudentText: string
    examGradeEssayNoText: string
    examGradeEssayAiNote: string
    /** Tiêu đề khối văn bản lý do / nhận xét từ AI sau khi gợi ý điểm */
    examGradeEssayAiRationaleHeading: string
    examGradeEssayLoadFailed: string
    examGradeEssaySaved: string
    examGradeEssaySaveFailed: string
    examGradeEssayAiFailed: string
    /** {index} */
    examGradeEssayQuestionLabel: string
    examGradeEssayStudentImages: string
    /** Tooltip: mở ảnh gốc (tab mới) */
    examGradeEssayImageOpenHint: string
    examGradeEssayLoadingDetail: string
    examGradeEssayGradedBadge: string
    examGradeEssayPendingBadge: string
    /** GV: chấm hàng loạt TL chưa chấm bằng AI trong một phiên thi */
    examGradeAllEssayAiButton: string
    /** Đang chạy — {current}, {total} */
    examGradeAllEssayAiRunning: string
    examGradeAllEssayAiNonePending: string
    /** Hoàn tất toàn bộ OK — {n} */
    examGradeAllEssayAiSummarySuccess: string
    /** Một phần lỗi — {ok}, {fail} */
    examGradeAllEssayAiSummaryPartial: string
    /** Trang lam-bai: tiêu đề khối lỗi */
    examErrorTitle: string
    examLoadFailed: string
    examLayoutTokenMissingSubmit: string
    examSubmitFailed: string
    examDefaultTitle: string
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
    teacherEditStudentNameButton: string
    teacherEditStudentNameTitle: string
    teacherEditStudentNameHint: string
    teacherEditStudentNameSuccess: string
    teacherEditStudentNameFailed: string
    teacherEditStudentNameTooLong: string
    removeStudentConfirmTitle: string
    removeStudentConfirmDescription: string
    removeStudentConfirmAction: string
    removeStudentFailed: string
    removeStudentSuccess: string
    removeStudentRemoving: string
    /** Màn tham gia lớp ngay trên trang làm bài thi (đề gắn lớp) */
    examEnrollGateTitle: string
    examEnrollGateDescription: string
    examEnrollSubmitButton: string
    examEnrollSubmitting: string
    /** Bảng điểm tổng hợp phiếu + đề thi (GV) */
    gradebookTitle: string
    gradebookDescription: string
    gradebookExportExcel: string
    gradebookLoading: string
    gradebookEmptyColumns: string
    gradebookFetchError: string
    gradebookColNo: string
    gradebookColName: string
    gradebookColDob: string
    gradebookColTotal: string
    gradebookExportFailed: string
    gradebookKindWorksheet: string
    gradebookKindExam: string
    /** Trang con lớp: về trang tổng lớp */
    classPageBackToClass: string
    /** Thẻ hub: mô tả đề thi */
    classHubCardExamsDesc: string
    classHubCardStudentsDesc: string
    /** Hub: mô tả đề thi / danh sách lớp khi người xem là học sinh */
    classHubCardExamsDescStudent: string
    classHubCardStudentsDescStudent: string
    classHubCardRosterTitleStudent: string
    classHubCardGradebookDesc: string
    classHubCardWorksheetsDesc: string
    /** Danh sách đề thi (trang con) */
    classExamsIndexTitle: string
    /** Chi tiết một phiên thi */
    classExamSessionPageTitle: string
    /** Danh sách đề thi: nút vào trang chấm từng phiên */
    classExamGoToSession: string
    /** SEO mô tả trang tổng /lop/[id] */
    classDetailSeoDescription: string
    /** Hub: mô tả thẻ gán phiếu bài tập */
    classHubCardAssignWorksheetDesc: string
    /** Tóm tắt một dòng khi chưa có môn/GV hiển thị cho HS */
    classPageStudentFacingNotSet: string
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
  /** Trang /tao-bai-thi — tạo phiên thi trực tuyến (GV) */
  createExamPage: {
    error: string
    cancel: string
    close: string
    delete: string
    open: string
    copied: string
    copyLink: string
    missingInput: string
    missingInputSchoolAi: string
    schoolAiFailed: string
    schoolAiNormalized: string
    schoolAiNormalizedDesc: string
    missingSchool: string
    selectSchoolBeforeClass: string
    missingClassName: string
    enterClassName: string
    createClassFailed: string
    classCreated: string
    classCreatedDesc: string
    selectSchoolBeforeExam: string
    missingClass: string
    selectClassBeforeExam: string
    invalidQuestionCount: string
    setQuestionCountHint: string
    noQuizSelected: string
    selectQuizMatchCounts: string
    notEnoughQuizByDifficulty: string
    selectEnoughQuizByDifficulty: string
    totalMustBe100: string
    /** {total} */
    totalMustBe100Desc: string
    examCreateSuccess: string
    examCreateSuccessDesc: string
    linkCopiedDesc: string
    deleteExamConfirm: string
    examDeleted: string
    examDeletedDesc: string
    loadExamFailed: string
    pdfExported: string
    wordExported: string
    pageTitle: string
    pageSubtitle: string
    examCreatedBadge: string
    questions: string
    minutes: string
    minAbbr: string
    points: string
    examLink: string
    copyLinkTitle: string
    examCode: string
    classLabel: string
    schoolLabel: string
    gradeLevelLabel: string
    reviewSlides: string
    exportPdf: string
    exportWord: string
    createAnotherExam: string
    cardExamInfo: string
    cardExamInfoDesc: string
    /** Mô tả dưới tiêu đề thẻ form tạo đề (luồng thủ công chọn câu) */
    examFormCardDescription: string
    titleOptional: string
    titlePlaceholder: string
    subject: string
    targetSchoolAndClass: string
    /** Gợi ý: form được ghi nhớ cục bộ trên trình duyệt */
    examFormRememberHint: string
    school: string
    schoolPlaceholder: string
    search: string
    searchingSchools: string
    schoolMinChars: string
    selectedPrefix: string
    class: string
    loadingClasses: string
    noClassClickNew: string
    selectSchoolBeforeNewClass: string
    createNew: string
    studentFacingBlockTitle: string
    studentFacingBlockHint: string
    subjectForStudents: string
    subjectForStudentsPh: string
    teacherForStudents: string
    teacherForStudentsPh: string
    saveAsDefaultsNextClasses: string
    saved: string
    classDisplayUpdated: string
    saving: string
    saveClassFacing: string
    examType: string
    examType15: string
    examType45: string
    examType90: string
    examType120: string
    part1Quiz: string
    colDifficulty: string
    colCount: string
    colMinPerQ: string
    colPtsPerQ: string
    colSumMin: string
    easyQuestions: string
    mediumQuestions: string
    hardQuestions: string
    easy: string
    medium: string
    hard: string
    quizPartTotal: string
    /** {n} */
    quizRemainForEssay: string
    /** Chưa chọn TL: {quizTotal} {remainForEssay} */
    quizTnOptionalEssayHint: string
    /** {n} */
    quizOver100: string
    selectCurricula: string
    loading: string
    noCurriculaForSubject: string
    createCurriculum: string
    first: string
    selectCurriculaForQuizList: string
    loadingQuestionList: string
    remainingEasy: string
    remainingMedium: string
    remainingHard: string
    searchQuizPlaceholder: string
    badgeQuiz: string
    verified: string
    unverified: string
    lessonTag: string
    selectedBadge: string
    quickView: string
    noQuizInCurricula: string
    selectedQuiz: string
    /** {selected}, {total} */
    selectedQuizCount: string
    part2Essay: string
    essayIntroNoRandom: string
    essayIntro100scale: string
    hideEssayPicker: string
    showEssayPicker: string
    selectCurriculaBeforeEssay: string
    essayQuestionList: string
    searchEssayPlaceholder: string
    badgeEssay: string
    selectedEssayListTitle: string
    timeMinutes: string
    maxPoints: string
    /** {max} */
    essayMaxAllowedLine: string
    noEssaySelectedYet: string
    noEssayInPicker: string
    summaryBeforeCreate: string
    quizSection: string
    /** {label}, {count}, {min}, {sum} */
    summaryQuizLine: string
    quizSubtotalLabel: string
    essaySection: string
    noEssaySelectedSummary: string
    essayTotalLabel: string
    targetLabel: string
    pointsFullExam: string
    allocated: string
    /** {n} */
    ptsShort: string
    /** {n} */
    ptsOver: string
    equals100: string
    totalDurationNeeded: string
    totalPointsExam: string
    selectedExamType: string
    officialExamDuration: string
    /** {total}, {limit} */
    durationWarning: string
    creating: string
    need100ToCreate: string
    createExam: string
    createAnyway: string
    createdExamsList: string
    createdExamsHint: string
    loadingExamList: string
    noExamsYet: string
    examTitle: string
    review: string
    scanQrTitle: string
    qrFailedUseLink: string
    openOnThisDevice: string
    createNewClass: string
    selectSchoolAboveForClass: string
    newClassNamePlaceholder: string
    createClass: string
    quickViewTitle: string
    problem: string
    noProblem: string
    solution: string
    noSolution: string
    levelRecognition: string
    levelComprehension: string
    levelLowApplication: string
    levelHighApplication: string
    levelPractical: string
    sourceTextbook: string
    sourceAi: string
    sourceEdited: string
    sourceOther: string
    defaultExamTitle: string
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
    joinClassPreviewTitle: 'Bạn sắp vào lớp',
    joinClassPreviewCheckHint: 'Hãy kiểm tra đúng lớp — môn — giáo viên trước khi gửi.',
    joinClassPreviewLoading: 'Đang kiểm tra mã…',
    joinClassPreviewNotFound: 'Không có lớp nào với mã này.',
    joinClassPreviewNeedCode: 'Nhập mã lớp để xem tên lớp, môn và giáo viên.',
    createClassFacingSubjectLabel: 'Môn học (hiển thị cho học sinh)',
    createClassFacingSubjectPlaceholder: 'VD: Toán',
    createClassFacingTeacherLabel: 'Tên giáo viên (hiển thị cho học sinh)',
    createClassFacingTeacherPlaceholder: 'VD: Cô Duyên',
    createClassFacingFieldsHint:
      'Học sinh sẽ thấy dạng: Tên lớp — Môn — Giáo viên khi tham gia và trong danh sách lớp. Có thể sửa sau ở trang lớp hoặc khi tạo đề thi.',
    updateClassFacingSave: 'Lưu thông tin hiển thị',
    updateClassFacingSaveAsDefaults: 'Lưu làm mặc định cho lớp sau',
    updateClassFacingSuccess: 'Đã cập nhật thông tin lớp.',
    updateClassFacingFailed: 'Không thể lưu thông tin lớp.',
    classPageStudentFacingTitle: 'Học sinh thấy khi tham gia lớp',
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
    studentClassExamsTitle: 'Bài thi trong lớp',
    studentClassExamNotStarted: 'Chưa nộp bài',
    studentClassExamSubmitted: 'Đã nộp',
    studentClassExamProgressScores: 'Quy thang 100: {score100} · Thang 10: {grade10}',
    studentClassExamSubmittedAt: 'Nộp lúc {time}',
    studentClassExamCtaStart: 'Vào làm bài',
    studentClassExamCtaViewResult: 'Xem kết quả',
    studentClassExamBadgeClosed: 'Đã đóng',
    studentClassExamClosedMissed: 'Phiên thi đã đóng — bạn chưa nộp bài.',
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
    examSubmittedTitle: 'Đã nộp bài',
    examSubmittedSavedEarlier: 'Bạn đã nộp bài thi này. Dưới đây là kết quả đã lưu.',
    examScoreOutOf10: 'Điểm {grade}/10',
    examResultScale100Line: 'Quy thang 100: {score100}/100',
    examResultSummaryGrade10Line: 'Tổng kết thang 10: {grade}/10',
    examShareResultScaleLine: '{title}: {score100}/100 (tương đương {grade}/10)',
    examCorrectRatioLine: '{score}/{max} điểm ({pct}%)',
    examShareResultLine: '{title}: Điểm {grade}/10 ({score}/{max} đúng - {pct}%)',
    examShareResultLineMixed: '{title}: Trắc nghiệm {grade}/10 · Tổng tạm {score}/{max}',
    examMcBreakdownLine: 'Trắc nghiệm: {correct}/{total} câu đúng → {quizPoints}/{quizMax} điểm',
    examEssayPendingBreakdownLine: 'Tự luận: chưa chấm (tối đa {essayMax} điểm)',
    examTotalPendingBreakdownLine: 'Tổng điểm tạm thời: {score}/{max}',
    examTotalScoreByExamLine: 'Tổng điểm theo đề: {score}/{max}',
    examTeacherAttemptMixedSummary:
      'TN: {correct}/{total} đúng, {wrong} sai · Điểm TN {grade10}/10 · Tạm {score}/{max} (TL tối đa {essayMax}) · {time}',
    examTeacherAttemptEssayOnlySummary: 'Đã nộp · Tạm {score}/{max} (tự luận, tối đa {essayMax}) · {time}',
    examShareDone: 'Đã chia sẻ!',
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
    examSessionRosterReport: '{submitted} đã nộp · {notSubmitted} chưa nộp',
    examSessionShowNotSubmitted: 'Ai chưa nộp?',
    examSessionNotSubmittedTitle: 'Học sinh chưa nộp bài',
    examSessionNotSubmittedAllSubmitted: 'Mọi học sinh trong lớp đã nộp bài thi này.',
    examSessionNotSubmittedNoRoster: 'Chưa có học sinh trong lớp — không có danh sách để hiển thị.',
    lowScoreWarningPrefix: 'Có',
    lowScoreWarningSuffix: 'học sinh điểm thấp (< 5/10). Giáo viên nên để ý và hỗ trợ thêm.',
    correctLabel: 'Đúng',
    wrongLabel: 'Sai',
    scoreLabel: 'Điểm',
    questionSuffix: 'câu',
    examEssayPhotoHint:
      'Có thể chọn ảnh từ máy hoặc chụp bằng camera (tối đa 10 ảnh mỗi câu tự luận, mỗi ảnh ≤ 5MB, JPEG/PNG/WebP). Cô sẽ xem khi chấm.',
    examEssayImageRetentionHint:
      'Ảnh tải lên được lưu tối đa {days} ngày để chấm bài; sau đó có thể bị xóa khỏi hệ thống.',
    examEssayImageRetentionResult:
      'Ảnh bạn đã tải được giữ đến khoảng {expiresAt} (khoảng {days} ngày kể từ lúc nộp).',
    examGradeEssayImageRetentionTeacher:
      'Ảnh học sinh tải lên được lưu khoảng {days} ngày (dự kiến đến {expiresAt}); cần bản sao thì hãy tải về sớm.',
    examGradeEssayImageRetentionTeacherFallback:
      'Ảnh học sinh tải lên được lưu khoảng {days} ngày; sau đó liên kết có thể không còn hoạt động.',
    examEssayUploadPick: 'Chọn ảnh',
    examEssayUploadCamera: 'Chụp ảnh',
    examEssayUploading: 'Đang tải ảnh…',
    examEssayRemoveImage: 'Xóa ảnh',
    examEssayTooManyImages: 'Tối đa 10 ảnh mỗi câu tự luận.',
    examEssayUploadFailed: 'Tải ảnh thất bại.',
    examEssayAnswerPlaceholder: 'Nhập câu trả lời hoặc chỉ gửi ảnh bài làm…',
    examGradeEssayAction: 'Chấm tự luận',
    examGradeEssayDialogTitle: 'Chấm phần tự luận',
    examGradeEssayPointsLabel: 'Điểm tự luận (tổng)',
    examGradeEssayPointsMaxHint: 'Tối đa {max} điểm (theo đề).',
    examGradeEssaySave: 'Lưu điểm',
    examGradeEssayAiSuggest: 'Gợi ý điểm (AI)',
    examGradeEssayAiRunning: 'Đang gọi AI…',
    examGradeEssayAiApply: 'Dùng điểm gợi ý',
    examGradeEssayStudentText: 'Bài làm (text)',
    examGradeEssayNoText: '(Không có text)',
    examGradeEssayAiNote:
      'AI đọc ảnh bài làm (nếu có), so với đề và lời giải trong ngân hàng câu; chỉ gợi ý — giáo viên quyết định điểm cuối.',
    examGradeEssayAiRationaleHeading: 'Gợi ý chi tiết (AI)',
    examGradeEssayLoadFailed: 'Không tải được bài làm.',
    examGradeEssaySaved: 'Đã lưu điểm tự luận.',
    examGradeEssaySaveFailed: 'Lưu điểm thất bại.',
    examGradeEssayAiFailed: 'Gợi ý AI thất bại.',
    examGradeEssayQuestionLabel: 'Câu {index}',
    examGradeEssayStudentImages: 'Ảnh bài làm',
    examGradeEssayImageOpenHint: 'Bấm ảnh để xem kích thước gốc (tab mới)',
    examGradeEssayLoadingDetail: 'Đang tải bài làm…',
    examGradeEssayGradedBadge: 'đã chấm TL',
    examGradeEssayPendingBadge: 'chưa chấm TL',
    examGradeAllEssayAiButton: 'Chấm tất cả TL bằng AI',
    examGradeAllEssayAiRunning: 'Đang chấm AI ({current}/{total})…',
    examGradeAllEssayAiNonePending:
      'Không có bài tự luận nào cần chấm (đã chấm hết hoặc đề không có phần TL).',
    examGradeAllEssayAiSummarySuccess: 'Đã lưu điểm tự luận do AI gợi ý cho {n} bài.',
    examGradeAllEssayAiSummaryPartial: 'Chấm hàng loạt xong: {ok} bài thành công, {fail} lỗi.',
    examErrorTitle: 'Lỗi',
    examLoadFailed: 'Không tải được đề thi.',
    examLayoutTokenMissingSubmit: 'Thiếu phiên đề thi. Vui lòng tải lại trang.',
    examSubmitFailed: 'Nộp bài thất bại.',
    examDefaultTitle: 'Bài thi',
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
    teacherEditStudentNameButton: 'Sửa tên',
    teacherEditStudentNameTitle: 'Đổi tên học sinh',
    teacherEditStudentNameHint: 'Tên hiển thị trong lớp này (không đổi tên tài khoản đăng nhập).',
    teacherEditStudentNameSuccess: 'Đã cập nhật tên học sinh.',
    teacherEditStudentNameFailed: 'Không thể cập nhật tên.',
    teacherEditStudentNameTooLong: 'Họ tên quá dài (tối đa 120 ký tự).',
    removeStudentConfirmTitle: 'Xóa học sinh khỏi lớp?',
    removeStudentConfirmDescription:
      'Học sinh sẽ không còn trong danh sách lớp. Có thể tham gia lại bằng mã nếu cần.',
    removeStudentConfirmAction: 'Xóa khỏi lớp',
    removeStudentFailed: 'Không xóa được học sinh.',
    removeStudentSuccess: 'Đã xóa học sinh khỏi lớp.',
    removeStudentRemoving: 'Đang xóa…',
    examEnrollGateTitle: 'Tham gia lớp để làm bài thi',
    examEnrollGateDescription:
      'Đề thi này gắn với một lớp. Nhập họ tên và ngày sinh đúng như trong sổ lớp (không dùng tên mặc định tài khoản Google). Sau đó em có thể bắt đầu làm bài.',
    examEnrollSubmitButton: 'Tham gia lớp và làm bài thi',
    examEnrollSubmitting: 'Đang tham gia…',
    gradebookTitle: 'Sổ điểm học sinh',
    gradebookDescription:
      'Mỗi cột là một phiếu bài tập hoặc một đề thi đã gắn lớp. Ô điểm dạng đúng/tổng (ví dụ 8/10). Tổng điểm = cộng điểm quy về thang 10 của từng bài. Đề có tự luận: cột tổng hàng gồm điểm tự luận sau khi giáo viên chấm; trước đó chỉ quy đổi phần trắc nghiệm. Danh sách sắp xếp từ tổng thấp đến cao.',
    gradebookExportExcel: 'Xuất Excel',
    gradebookLoading: 'Đang tải sổ điểm…',
    gradebookEmptyColumns: 'Chưa có phiếu hoặc đề thi nào gắn lớp — gán phiếu hoặc tạo đề thi để có cột điểm.',
    gradebookFetchError: 'Không tải được sổ điểm.',
    gradebookColNo: 'STT',
    gradebookColName: 'Họ và tên',
    gradebookColDob: 'Ngày sinh',
    gradebookColTotal: 'Tổng (thang 10)',
    gradebookExportFailed: 'Xuất Excel thất bại.',
    gradebookKindWorksheet: 'Phiếu',
    gradebookKindExam: 'Đề thi',
    classPageBackToClass: 'Về trang lớp',
    classHubCardExamsDesc: 'Danh sách đề thi — mỗi đề một trang: QR, chấm tự luận, AI hàng loạt.',
    classHubCardStudentsDesc: 'Thành viên lớp, sửa tên HS, gỡ khỏi lớp.',
    classHubCardExamsDescStudent:
      'Các đề thi của lớp: làm bài và xem điểm, nhận xét sau khi giáo viên chấm.',
    classHubCardStudentsDescStudent: 'Xem danh sách bạn cùng lớp và giáo viên.',
    classHubCardRosterTitleStudent: 'Thành viên lớp',
    classHubCardGradebookDesc: 'Sổ điểm tổng hợp phiếu + đề thi, xuất Excel.',
    classHubCardWorksheetsDesc: 'Các phiếu bài tập đã nộp trong lớp.',
    classExamsIndexTitle: 'Đề thi trong lớp',
    classExamSessionPageTitle: 'Chi tiết đề thi',
    classExamGoToSession: 'Mở trang chấm thi',
    classDetailSeoDescription: 'Trang lớp: đề thi, học sinh, sổ điểm và bài nộp phiếu.',
    classHubCardAssignWorksheetDesc: 'Gắn phiếu bài tập vào lớp để học sinh làm.',
    classPageStudentFacingNotSet: 'Chưa thiết lập',
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
  createExamPage: {
    error: 'Lỗi',
    cancel: 'Hủy',
    close: 'Đóng',
    delete: 'Xóa',
    open: 'Mở',
    copied: 'Đã copy',
    copyLink: 'Copy link',
    missingInput: 'Thiếu dữ liệu',
    missingInputSchoolAi: 'Vui lòng nhập tên trường dài hơn trước khi tìm AI.',
    schoolAiFailed: 'Không thể tìm và chuẩn hóa trường bằng AI.',
    schoolAiNormalized: 'Đã chuẩn hóa bằng AI',
    schoolAiNormalizedDesc: 'Đã lưu vào DB. Giáo viên chọn trường trong danh sách bên dưới.',
    missingSchool: 'Thiếu trường',
    selectSchoolBeforeClass: 'Vui lòng chọn trường trước khi tạo lớp.',
    missingClassName: 'Thiếu tên lớp',
    enterClassName: 'Vui lòng nhập tên lớp.',
    createClassFailed: 'Không thể tạo lớp.',
    classCreated: 'Đã tạo lớp',
    classCreatedDesc: 'Lớp mới đã sẵn sàng để gắn vào bài thi.',
    selectSchoolBeforeExam: 'Vui lòng chọn trường trước khi tạo bài thi.',
    missingClass: 'Thiếu lớp',
    selectClassBeforeExam: 'Vui lòng chọn lớp trước khi tạo bài thi.',
    invalidQuestionCount: 'Thiếu số lượng câu',
    setQuestionCountHint: 'Hãy nhập số câu cho ít nhất 1 mức độ.',
    noQuizSelected: 'Chưa chọn câu hỏi',
    selectQuizMatchCounts: 'Hãy chọn câu trắc nghiệm theo chỉ tiêu đã cài đặt.',
    notEnoughQuizByDifficulty: 'Chưa đủ số câu theo mức độ',
    selectEnoughQuizByDifficulty: 'Giáo viên cần chọn đủ câu Dễ/Trung bình/Khó theo cài đặt.',
    totalMustBe100: 'Tổng điểm toàn bài phải bằng 100',
    totalMustBe100Desc:
      'Hiện tổng điểm là {total}. Chỉnh điểm từng câu trắc nghiệm và điểm tối đa từng câu tự luận (nếu có) sao cho cộng lại đúng 100 điểm.',
    examCreateSuccess: 'Tạo thành công!',
    examCreateSuccessDesc: 'Đã tạo bài thi. Chia sẻ link hoặc QR cho học sinh.',
    linkCopiedDesc: 'Link đã được sao chép.',
    deleteExamConfirm: 'Xóa bài thi này? Hành động không thể hoàn tác.',
    examDeleted: 'Đã xóa',
    examDeletedDesc: 'Đã xóa bài thi.',
    loadExamFailed: 'Không tải được đề thi.',
    pdfExported: 'Đã xuất PDF',
    wordExported: 'Đã xuất Word',
    pageTitle: 'Tạo bài thi trực tuyến',
    pageSubtitle:
      '15 phút, 1 tiết, học kỳ, tốt nghiệp. Chọn môn, lớp, bài. QR + link cho học sinh.',
    examFormCardDescription:
      'Chọn môn/lớp và cách lấy câu hỏi: ngẫu nhiên hoặc giáo viên tự chọn từ danh sách bài tập trong giáo trình.',
    examCreatedBadge: 'Bài thi đã tạo',
    questions: 'câu',
    minutes: 'phút',
    minAbbr: 'phút',
    points: 'điểm',
    examLink: 'Link làm bài',
    copyLinkTitle: 'Copy link',
    examCode: 'Mã bài thi',
    classLabel: 'Lớp',
    schoolLabel: 'Trường',
    gradeLevelLabel: 'Lớp',
    reviewSlides: 'Chữa bài (slide)',
    exportPdf: 'Xuất PDF',
    exportWord: 'Xuất Word',
    createAnotherExam: 'Tạo bài thi khác',
    cardExamInfo: 'Thông tin bài thi',
    cardExamInfoDesc:
      'Chọn trường, lớp, loại bài thi, số câu và thời gian. Chọn giáo trình để lấy câu hỏi. Bấm tạo để có link và QR.',
    titleOptional: 'Tiêu đề (tùy chọn)',
    titlePlaceholder: 'Bài thi Toán 15 phút',
    subject: 'Môn học',
    targetSchoolAndClass: 'Trường và lớp áp dụng',
    examFormRememberHint:
      'Trình duyệt ghi nhớ trường, lớp, môn/khối, loại đề và tiêu đề — lần sau mở trang sẽ tự điền.',
    school: 'Trường',
    schoolPlaceholder: 'Gõ tên trường',
    search: 'Tìm kiếm',
    searchingSchools: 'Đang tìm trường...',
    schoolMinChars: 'Nhập ít nhất 3 ký tự để tìm trường.',
    selectedPrefix: 'Đang chọn',
    class: 'Lớp',
    loadingClasses: 'Đang tải lớp...',
    noClassClickNew: 'Chưa có lớp - bấm Tạo mới',
    selectSchoolBeforeNewClass: 'Vui lòng chọn trường trước khi tạo lớp mới.',
    createNew: 'Tạo mới',
    studentFacingBlockTitle: 'Thông tin học sinh thấy (lớp đã chọn)',
    studentFacingBlockHint:
      'Dùng khi HS tham gia lớp / xem danh sách lớp. Lưu để cập nhật lớp; có thể lưu làm mặc định cho lớp sau.',
    subjectForStudents: 'Môn (hiển thị HS)',
    subjectForStudentsPh: 'VD: Toán',
    teacherForStudents: 'Tên GV (hiển thị HS)',
    teacherForStudentsPh: 'VD: Cô Duyên',
    saveAsDefaultsNextClasses: 'Lưu làm mặc định cho lớp sau',
    saved: 'Đã lưu',
    classDisplayUpdated: 'Đã cập nhật thông tin hiển thị lớp.',
    saving: 'Đang lưu…',
    saveClassFacing: 'Lưu thông tin lớp',
    examType: 'Loại bài thi',
    examType15: '15 phút',
    examType45: '1 tiết (45 phút)',
    examType90: 'Học kỳ (90 phút)',
    examType120: 'Tốt nghiệp (120 phút)',
    part1Quiz: 'Phần 1: Trắc nghiệm',
    colDifficulty: 'Mức độ',
    colCount: 'Số câu',
    colMinPerQ: 'Phút/câu',
    colPtsPerQ: 'Điểm/câu',
    colSumMin: 'Tổng phút',
    easyQuestions: 'Câu dễ',
    mediumQuestions: 'Câu trung bình',
    hardQuestions: 'Câu khó',
    easy: 'Dễ',
    medium: 'Trung bình',
    hard: 'Khó',
    quizPartTotal: 'Tổng phần trắc nghiệm',
    quizRemainForEssay:
      'Trong thang 100 điểm: sau phần TN còn tối đa {n} điểm để phân cho tự luận.',
    quizTnOptionalEssayHint:
      'Cả bài tối đa 100 điểm (TN + TL). Phần 2 bên dưới có thể chọn câu tự luận và chia điểm. Hiện tổng điểm TN: {quizTotal} — còn tối đa {remainForEssay} điểm có thể gán cho TL. Nếu không dùng TL, chỉnh điểm TN sao cho tổng đúng 100.',
    quizOver100:
      'Cảnh báo: điểm trắc nghiệm ({n}) đã vượt 100 — hãy giảm điểm/câu hoặc số câu.',
    selectCurricula: 'Chọn giáo trình theo môn và lớp đã chọn',
    loading: 'Đang tải...',
    noCurriculaForSubject: 'Chưa có giáo trình cho môn/lớp này. ',
    createCurriculum: 'Tạo giáo trình',
    first: ' trước.',
    selectCurriculaForQuizList: 'Hãy chọn giáo trình trước để tải danh sách câu trắc nghiệm.',
    loadingQuestionList: 'Đang tải danh sách câu...',
    remainingEasy: 'Còn lại Dễ',
    remainingMedium: 'Còn lại Trung bình',
    remainingHard: 'Còn lại Khó',
    searchQuizPlaceholder: 'Tìm câu trắc nghiệm...',
    badgeQuiz: 'Trắc nghiệm',
    verified: 'Đã verify',
    unverified: 'Chưa verify',
    lessonTag: 'Thuộc bài',
    selectedBadge: 'Đã chọn',
    quickView: 'Xem nhanh',
    noQuizInCurricula: 'Không có câu trắc nghiệm trong giáo trình đã chọn.',
    selectedQuiz: 'Đã chọn trắc nghiệm',
    selectedQuizCount: '{selected}/{total} câu',
    part2Essay: 'Phần 2: Tự luận',
    essayIntroNoRandom:
      'Tự luận không có chế độ ngẫu nhiên. Chọn bài tự luận từ giáo trình đã chọn, rồi điền thời gian từng bài.',
    essayIntro100scale:
      'Tổng điểm TN + TL phải đúng 100. Điểm tối đa mỗi bài tự luận không vượt quá phần còn lại (100 trừ điểm TN và trừ điểm các bài TL khác).',
    hideEssayPicker: 'Ẩn chọn bài tự luận',
    showEssayPicker: 'Chọn bài tự luận',
    selectCurriculaBeforeEssay: 'Hãy chọn giáo trình ở trên trước khi chọn tự luận.',
    essayQuestionList: 'Danh sách bài tự luận',
    searchEssayPlaceholder: 'Tìm câu tự luận...',
    badgeEssay: 'Tự luận',
    selectedEssayListTitle:
      'Danh sách tự luận đã chọn (chọn ở trên sẽ tự nhảy xuống đây)',
    timeMinutes: 'Thời gian (phút)',
    maxPoints: 'Điểm tối đa',
    essayMaxAllowedLine: 'Có thể cho tối đa {max} điểm (đã trừ TN và các bài TL khác).',
    noEssaySelectedYet: 'Chưa chọn bài tự luận.',
    noEssayInPicker: 'Không có bài tự luận trong giáo trình đã chọn.',
    summaryBeforeCreate: 'Tóm tắt trước khi tạo đề',
    quizSection: 'Phần trắc nghiệm',
    summaryQuizLine: '{label}: {count} câu x {min} phút = {sum} phút',
    quizSubtotalLabel: 'Tổng trắc nghiệm',
    essaySection: 'Phần tự luận',
    noEssaySelectedSummary: 'Chưa chọn bài tự luận.',
    essayTotalLabel: 'Tổng tự luận',
    targetLabel: 'Mục tiêu',
    pointsFullExam: 'điểm toàn đề',
    allocated: 'Đã phân',
    ptsShort: 'Còn thiếu {n} điểm',
    ptsOver: 'Thừa {n} điểm',
    equals100: 'Đủ 100 điểm',
    totalDurationNeeded: 'Tổng thời gian cần làm bài',
    totalPointsExam: 'Tổng điểm đề',
    selectedExamType: 'Loại bài thi đã chọn',
    officialExamDuration: 'Thời gian đề chuẩn',
    durationWarning:
      'Cảnh báo: Tổng thời gian dự tính ({total} phút) đang lớn hơn thời gian loại bài thi đã chọn ({limit} phút). Đề vẫn được tạo, nhưng học sinh chỉ làm trong {limit} phút.',
    creating: 'Đang tạo...',
    need100ToCreate: 'Chưa tạo được: tổng điểm toàn bài phải = 100 (TN + TL nếu có)',
    createExam: 'Tạo bài thi',
    createAnyway: 'Vẫn tạo bài thi',
    createdExamsList: 'Danh sách bài thi đã tạo',
    createdExamsHint: 'Giáo viên có thể mở link hoặc xóa bài thi đã tạo.',
    loadingExamList: 'Đang tải danh sách...',
    noExamsYet: 'Chưa có bài thi nào.',
    examTitle: 'Bài thi',
    review: 'Chữa bài',
    scanQrTitle: 'Quét mã QR làm bài',
    qrFailedUseLink: 'Không tạo được QR. Dùng link bên dưới.',
    openOnThisDevice: 'Mở trên máy này',
    createNewClass: 'Tạo lớp mới',
    selectSchoolAboveForClass: 'Vui lòng chọn trường ở trên trước khi tạo lớp mới.',
    newClassNamePlaceholder: 'Nhập tên lớp mới (VD: 12A6)',
    createClass: 'Tạo lớp mới',
    quickViewTitle: 'Xem nhanh đề và lời giải',
    problem: 'Đề bài',
    noProblem: 'Không có nội dung đề bài.',
    solution: 'Lời giải',
    noSolution: 'Chưa có lời giải.',
    levelRecognition: 'Nhận biết',
    levelComprehension: 'Thông hiểu',
    levelLowApplication: 'Vận dụng thấp',
    levelHighApplication: 'Vận dụng cao',
    levelPractical: 'Thực tế',
    sourceTextbook: 'SGK',
    sourceAi: 'AI tạo',
    sourceEdited: 'Chỉnh sửa',
    sourceOther: 'Nguồn khác',
    defaultExamTitle: 'Bài thi',
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
    joinClassPreviewTitle: 'You are about to join',
    joinClassPreviewCheckHint: 'Please verify class — subject — teacher before submitting.',
    joinClassPreviewLoading: 'Checking code…',
    joinClassPreviewNotFound: 'No class matches this code.',
    joinClassPreviewNeedCode: 'Enter the class code to see class, subject, and teacher.',
    createClassFacingSubjectLabel: 'Subject (shown to students)',
    createClassFacingSubjectPlaceholder: 'e.g. Math',
    createClassFacingTeacherLabel: 'Teacher name (shown to students)',
    createClassFacingTeacherPlaceholder: 'e.g. Ms. Duyen',
    createClassFacingFieldsHint:
      'Students see: Class — Subject — Teacher when joining and in their class list. You can edit later on the class page or when creating an exam.',
    updateClassFacingSave: 'Save display info',
    updateClassFacingSaveAsDefaults: 'Save as default for next classes',
    updateClassFacingSuccess: 'Class display info updated.',
    updateClassFacingFailed: 'Could not save class display info.',
    classPageStudentFacingTitle: 'What students see when joining',
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
    studentClassExamsTitle: 'Exams for this class',
    studentClassExamNotStarted: 'Not submitted yet',
    studentClassExamSubmitted: 'Submitted',
    studentClassExamProgressScores: 'Scaled to 100: {score100} · Summary /10: {grade10}',
    studentClassExamSubmittedAt: 'Submitted at {time}',
    studentClassExamCtaStart: 'Take exam',
    studentClassExamCtaViewResult: 'View result',
    studentClassExamBadgeClosed: 'Closed',
    studentClassExamClosedMissed: 'This exam session is closed — you did not submit.',
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
    examSubmittedTitle: 'Submitted',
    examSubmittedSavedEarlier: 'You already submitted this test. Your saved result is below.',
    examScoreOutOf10: 'Score: {grade}/10',
    examResultScale100Line: 'On 100-point scale: {score100}/100',
    examResultSummaryGrade10Line: 'Summary (/10): {grade}/10',
    examShareResultScaleLine: '{title}: {score100}/100 (~{grade}/10)',
    examCorrectRatioLine: '{score}/{max} pts ({pct}%)',
    examShareResultLine: '{title}: Score {grade}/10 ({score}/{max} correct — {pct}%)',
    examShareResultLineMixed: '{title}: MC {grade}/10 · Provisional total {score}/{max}',
    examMcBreakdownLine: 'Multiple choice: {correct}/{total} correct → {quizPoints}/{quizMax} pts',
    examEssayPendingBreakdownLine: 'Essay: not graded yet (max {essayMax} pts)',
    examTotalPendingBreakdownLine: 'Provisional total: {score}/{max}',
    examTotalScoreByExamLine: 'Exam score: {score}/{max}',
    examTeacherAttemptMixedSummary:
      'MC: {correct}/{total} correct, {wrong} wrong · MC grade {grade10}/10 · Provisional {score}/{max} (essay max {essayMax}) · {time}',
    examTeacherAttemptEssayOnlySummary: 'Submitted · Provisional {score}/{max} (essay only, max {essayMax}) · {time}',
    examShareDone: 'Shared!',
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
    examSessionRosterReport: '{submitted} submitted · {notSubmitted} not yet',
    examSessionShowNotSubmitted: 'Who has not submitted?',
    examSessionNotSubmittedTitle: 'Students who have not submitted',
    examSessionNotSubmittedAllSubmitted: 'Everyone on the class roster has submitted this exam.',
    examSessionNotSubmittedNoRoster: 'There are no students on the class roster.',
    lowScoreWarningPrefix: 'There are',
    lowScoreWarningSuffix: 'students with low scores (< 5/10). Please provide extra support.',
    correctLabel: 'Correct',
    wrongLabel: 'Wrong',
    scoreLabel: 'Score',
    questionSuffix: 'questions',
    examEssayPhotoHint:
      'Pick photos from your device or use the camera (up to 10 per essay question, 5MB each, JPEG/PNG/WebP). Your teacher will see them when grading.',
    examEssayImageRetentionHint:
      'Uploaded images are kept for up to {days} days for grading, then may be removed from the system.',
    examEssayImageRetentionResult:
      'Your uploaded images stay available until about {expiresAt} (about {days} days from submission).',
    examGradeEssayImageRetentionTeacher:
      'Student uploads are kept about {days} days (until about {expiresAt}). Download copies if you need them longer.',
    examGradeEssayImageRetentionTeacherFallback:
      'Student uploads are kept about {days} days; links may stop working after that.',
    examEssayUploadPick: 'Choose from gallery',
    examEssayUploadCamera: 'Take photo',
    examEssayUploading: 'Uploading…',
    examEssayRemoveImage: 'Remove',
    examEssayTooManyImages: 'Maximum 10 images per essay question.',
    examEssayUploadFailed: 'Image upload failed.',
    examEssayAnswerPlaceholder: 'Type your answer and/or attach photos…',
    examGradeEssayAction: 'Grade essays',
    examGradeEssayDialogTitle: 'Grade essay section',
    examGradeEssayPointsLabel: 'Essay points (total)',
    examGradeEssayPointsMaxHint: 'Maximum {max} points (per exam).',
    examGradeEssaySave: 'Save score',
    examGradeEssayAiSuggest: 'AI score suggestion',
    examGradeEssayAiRunning: 'Calling AI…',
    examGradeEssayAiApply: 'Use suggested score',
    examGradeEssayStudentText: 'Student answer (text)',
    examGradeEssayNoText: '(No text)',
    examGradeEssayAiNote:
      'AI reads handwritten images when present and compares them to the question and the bank reference solution; suggestion only — you set the final score.',
    examGradeEssayAiRationaleHeading: 'AI rationale',
    examGradeEssayLoadFailed: 'Could not load submission.',
    examGradeEssaySaved: 'Essay score saved.',
    examGradeEssaySaveFailed: 'Failed to save score.',
    examGradeEssayAiFailed: 'AI suggestion failed.',
    examGradeEssayQuestionLabel: 'Question {index}',
    examGradeEssayStudentImages: 'Handwritten images',
    examGradeEssayImageOpenHint: 'Click image to open full size in a new tab',
    examGradeEssayLoadingDetail: 'Loading submission…',
    examGradeEssayGradedBadge: 'essay graded',
    examGradeEssayPendingBadge: 'essay pending',
    examGradeAllEssayAiButton: 'Grade all essays with AI',
    examGradeAllEssayAiRunning: 'AI grading ({current}/{total})…',
    examGradeAllEssayAiNonePending:
      'No essay submissions need grading (all graded or this exam has no essay section).',
    examGradeAllEssayAiSummarySuccess: 'Saved AI-suggested essay scores for {n} submission(s).',
    examGradeAllEssayAiSummaryPartial: 'Batch finished: {ok} saved, {fail} error(s).',
    examErrorTitle: 'Error',
    examLoadFailed: 'Could not load the test.',
    examLayoutTokenMissingSubmit: 'Session expired. Please reload the page.',
    examSubmitFailed: 'Submission failed.',
    examDefaultTitle: 'Test',
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
    teacherEditStudentNameButton: 'Edit name',
    teacherEditStudentNameTitle: 'Rename student',
    teacherEditStudentNameHint: 'Name shown in this class only (does not change the login account name).',
    teacherEditStudentNameSuccess: 'Student name updated.',
    teacherEditStudentNameFailed: 'Could not update the name.',
    teacherEditStudentNameTooLong: 'Name is too long (max 120 characters).',
    removeStudentConfirmTitle: 'Remove this student from the class?',
    removeStudentConfirmDescription:
      'They will no longer be on the class list. They can join again with the class code if needed.',
    removeStudentConfirmAction: 'Remove from class',
    removeStudentFailed: 'Could not remove the student.',
    removeStudentSuccess: 'Student removed from class.',
    removeStudentRemoving: 'Removing…',
    examEnrollGateTitle: 'Join the class to take this test',
    examEnrollGateDescription:
      'This test is linked to a class. Enter your full name and date of birth as in the class register (not your account’s default name). You can start the test afterward.',
    examEnrollSubmitButton: 'Join class and take the test',
    examEnrollSubmitting: 'Joining…',
    gradebookTitle: 'Student gradebook',
    gradebookDescription:
      'Each column is one worksheet or one class exam. Cells show correct/total (e.g. 8/10). Total sums scores scaled to /10 per assignment. Exams with essays: the row total includes essay points after the teacher grades them; until then only the quiz portion counts toward the sum. Rows sorted from lowest total to highest.',
    gradebookExportExcel: 'Export Excel',
    gradebookLoading: 'Loading gradebook…',
    gradebookEmptyColumns: 'No worksheets or exams linked to this class yet.',
    gradebookFetchError: 'Could not load gradebook.',
    gradebookColNo: 'No.',
    gradebookColName: 'Full name',
    gradebookColDob: 'Date of birth',
    gradebookColTotal: 'Total (/10 scale)',
    gradebookExportFailed: 'Excel export failed.',
    gradebookKindWorksheet: 'Worksheet',
    gradebookKindExam: 'Exam',
    classPageBackToClass: 'Back to class',
    classHubCardExamsDesc: 'Exam list — each exam has its own page: QR link, essay grading, batch AI.',
    classHubCardStudentsDesc: 'Class roster, edit student names, remove from class.',
    classHubCardExamsDescStudent:
      'Class tests: take exams and view scores and feedback after grading.',
    classHubCardStudentsDescStudent: 'See classmates and teachers in this class.',
    classHubCardRosterTitleStudent: 'Class members',
    classHubCardGradebookDesc: 'Combined gradebook and Excel export.',
    classHubCardWorksheetsDesc: 'Worksheet submissions for this class.',
    classExamsIndexTitle: 'Class exams',
    classExamSessionPageTitle: 'Exam details',
    classExamGoToSession: 'Open grading page',
    classDetailSeoDescription: 'Class home: exams, roster, gradebook, and worksheet submissions.',
    classHubCardAssignWorksheetDesc: 'Assign worksheets to this class for students to complete.',
    classPageStudentFacingNotSet: 'Not set',
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
  createExamPage: {
    error: 'Error',
    cancel: 'Cancel',
    close: 'Close',
    delete: 'Delete',
    open: 'Open',
    copied: 'Copied',
    copyLink: 'Copy link',
    missingInput: 'Missing input',
    missingInputSchoolAi: 'Please enter a longer school name before AI search.',
    schoolAiFailed: 'Unable to normalize school using AI.',
    schoolAiNormalized: 'AI normalized',
    schoolAiNormalizedDesc: 'Saved to DB. Please select the school from the list below.',
    missingSchool: 'Missing school',
    selectSchoolBeforeClass: 'Select a school before creating class.',
    missingClassName: 'Missing class name',
    enterClassName: 'Please enter class name.',
    createClassFailed: 'Failed to create class.',
    classCreated: 'Class created',
    classCreatedDesc: 'New class is ready for exam assignment.',
    selectSchoolBeforeExam: 'Select school before creating exam.',
    missingClass: 'Missing class',
    selectClassBeforeExam: 'Select class before creating exam.',
    invalidQuestionCount: 'Invalid question count',
    setQuestionCountHint: 'Set question count for at least one difficulty level.',
    noQuizSelected: 'No questions selected',
    selectQuizMatchCounts: 'Select quiz questions to match configured counts.',
    notEnoughQuizByDifficulty: 'Not enough questions by difficulty',
    selectEnoughQuizByDifficulty: 'Please select enough Easy/Medium/Hard questions as configured.',
    totalMustBe100: 'Full exam total must equal 100 points',
    totalMustBe100Desc:
      'Current total is {total}. Adjust points for each multiple-choice item and max points for each essay (if any) so the full paper totals 100 points.',
    examCreateSuccess: 'Created!',
    examCreateSuccessDesc: 'Exam created. Share link or QR with students.',
    linkCopiedDesc: 'Link copied.',
    deleteExamConfirm: 'Delete this exam? This action cannot be undone.',
    examDeleted: 'Deleted',
    examDeletedDesc: 'Exam deleted.',
    loadExamFailed: 'Could not load exam.',
    pdfExported: 'PDF exported',
    wordExported: 'Word exported',
    pageTitle: 'Create online exam',
    pageSubtitle:
      '15 min, 1 period, semester, graduation. Pick subject, grade, lessons. QR + link for students.',
    examFormCardDescription:
      'Select subject/grade and question method: random or teacher-picked from curriculum exercise lists.',
    examCreatedBadge: 'Exam created',
    questions: 'questions',
    minutes: 'minutes',
    minAbbr: 'min',
    points: 'pts',
    examLink: 'Exam link',
    copyLinkTitle: 'Copy link',
    examCode: 'Exam code',
    classLabel: 'Class',
    schoolLabel: 'School',
    gradeLevelLabel: 'Grade',
    reviewSlides: 'Review slides',
    exportPdf: 'Export PDF',
    exportWord: 'Export Word',
    createAnotherExam: 'Create another exam',
    cardExamInfo: 'Exam info',
    cardExamInfoDesc:
      'Choose school, class, exam type, counts and timing. Pick curricula for questions. Create to get link and QR.',
    titleOptional: 'Title (optional)',
    titlePlaceholder: 'Math 15-min exam',
    subject: 'Subject',
    targetSchoolAndClass: 'Target school and class',
    examFormRememberHint:
      'This browser remembers school, class, subject/grade, exam type, and title — they refill when you return.',
    school: 'School',
    schoolPlaceholder: 'Type school name',
    search: 'Search',
    searchingSchools: 'Searching schools...',
    schoolMinChars: 'Enter at least 3 characters to search school.',
    selectedPrefix: 'Selected',
    class: 'Class',
    loadingClasses: 'Loading classes...',
    noClassClickNew: 'No class yet — click Create new',
    selectSchoolBeforeNewClass: 'Please select school first before creating a new class.',
    createNew: 'Create new',
    studentFacingBlockTitle: 'Student-facing info (selected class)',
    studentFacingBlockHint:
      'Shown when students join or view the class list. Save to update the class; optionally save as default for new classes.',
    subjectForStudents: 'Subject (for students)',
    subjectForStudentsPh: 'e.g. Math',
    teacherForStudents: 'Teacher name (for students)',
    teacherForStudentsPh: 'e.g. Ms. Duyen',
    saveAsDefaultsNextClasses: 'Save as default for next classes',
    saved: 'Saved',
    classDisplayUpdated: 'Class display info updated.',
    saving: 'Saving…',
    saveClassFacing: 'Save class info',
    examType: 'Exam type',
    examType15: '15 min',
    examType45: '1 period (45 min)',
    examType90: 'Semester (90 min)',
    examType120: 'Graduation (120 min)',
    part1Quiz: 'Part 1: Quiz',
    colDifficulty: 'Difficulty',
    colCount: 'Count',
    colMinPerQ: 'Min/q',
    colPtsPerQ: 'Pts/q',
    colSumMin: 'Σ min',
    easyQuestions: 'Easy',
    mediumQuestions: 'Medium',
    hardQuestions: 'Hard',
    easy: 'Easy',
    medium: 'Medium',
    hard: 'Hard',
    quizPartTotal: 'Quiz total',
    quizRemainForEssay:
      'On a 100-point scale: after the quiz section, at most {n} points remain for essay questions.',
    quizTnOptionalEssayHint:
      'The full exam is 100 points (quiz + essay). Below you can add essay questions and split points. Quiz total so far: {quizTotal} — up to {remainForEssay} points can still go to essays. If you skip essays, adjust quiz points so the quiz total equals 100.',
    quizOver100:
      'Warning: quiz points ({n}) exceed 100 — lower points per question or counts.',
    selectCurricula: 'Select curricula for selected subject and grade',
    loading: 'Loading...',
    noCurriculaForSubject: 'No curricula for this subject/grade. ',
    createCurriculum: 'Create curriculum',
    first: ' first.',
    selectCurriculaForQuizList: 'Select curricula first to load quiz questions.',
    loadingQuestionList: 'Loading questions...',
    remainingEasy: 'Easy remaining',
    remainingMedium: 'Medium remaining',
    remainingHard: 'Hard remaining',
    searchQuizPlaceholder: 'Search quiz questions...',
    badgeQuiz: 'Quiz',
    verified: 'Verified',
    unverified: 'Unverified',
    lessonTag: 'Lesson',
    selectedBadge: 'Selected',
    quickView: 'Quick view',
    noQuizInCurricula: 'No quiz questions found in selected curricula.',
    selectedQuiz: 'Selected quiz',
    selectedQuizCount: '{selected}/{total} questions',
    part2Essay: 'Part 2: Essay',
    essayIntroNoRandom:
      'Essay has no random mode. Select essay questions from chosen curricula, then set time per question.',
    essayIntro100scale:
      'Quiz + essay must total 100. Each essay max cannot exceed what remains after quiz points and all other essays.',
    hideEssayPicker: 'Hide essay picker',
    showEssayPicker: 'Select essay questions',
    selectCurriculaBeforeEssay: 'Select curricula above before choosing essay questions.',
    essayQuestionList: 'Essay question list',
    searchEssayPlaceholder: 'Search essay questions...',
    badgeEssay: 'Essay',
    selectedEssayListTitle: 'Selected essay questions (picked above will move here)',
    timeMinutes: 'Time (min)',
    maxPoints: 'Max points',
    essayMaxAllowedLine: 'Up to {max} pts for this item (after quiz and other essays).',
    noEssaySelectedYet: 'No essay questions selected yet.',
    noEssayInPicker: 'No essay questions found in selected curricula.',
    summaryBeforeCreate: 'Summary before creating exam',
    quizSection: 'Quiz section',
    summaryQuizLine: '{label}: {count} questions × {min} min = {sum} min',
    quizSubtotalLabel: 'Quiz total',
    essaySection: 'Essay section',
    noEssaySelectedSummary: 'No essay questions selected.',
    essayTotalLabel: 'Essay total',
    targetLabel: 'Target',
    pointsFullExam: 'pts total',
    allocated: 'Allocated',
    ptsShort: '{n} pts short',
    ptsOver: '{n} pts over',
    equals100: 'Equals 100',
    totalDurationNeeded: 'Total exam duration needed',
    totalPointsExam: 'Total points',
    selectedExamType: 'Selected exam type',
    officialExamDuration: 'Official exam duration',
    durationWarning:
      'Warning: Estimated total time ({total} min) exceeds selected exam type duration ({limit} min). The exam will still be created, but students only have {limit} minutes.',
    creating: 'Creating...',
    need100ToCreate: 'Cannot create yet: full paper must total 100 pts (quiz + essay if any)',
    createExam: 'Create exam',
    createAnyway: 'Create anyway',
    createdExamsList: 'Created exams',
    createdExamsHint: 'Teacher can open link or delete created exams.',
    loadingExamList: 'Loading exam list...',
    noExamsYet: 'No exams yet.',
    examTitle: 'Exam',
    review: 'Review',
    scanQrTitle: 'Scan QR to take exam',
    qrFailedUseLink: 'Failed to generate QR. Use link below.',
    openOnThisDevice: 'Open on this device',
    createNewClass: 'Create new class',
    selectSchoolAboveForClass: 'Please select school above before creating class.',
    newClassNamePlaceholder: 'Enter new class name (e.g. 12A6)',
    createClass: 'Create class',
    quickViewTitle: 'Quick view: problem and solution',
    problem: 'Problem',
    noProblem: 'No problem content.',
    solution: 'Solution',
    noSolution: 'No solution available.',
    levelRecognition: 'Recognition',
    levelComprehension: 'Comprehension',
    levelLowApplication: 'Low application',
    levelHighApplication: 'High application',
    levelPractical: 'Practical',
    sourceTextbook: 'Textbook',
    sourceAi: 'AI-generated',
    sourceEdited: 'Edited',
    sourceOther: 'Other source',
    defaultExamTitle: 'Exam',
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
    joinClassPreviewTitle: '您将加入',
    joinClassPreviewCheckHint: '提交前请确认班级 — 科目 — 教师信息。',
    joinClassPreviewLoading: '正在验证代码…',
    joinClassPreviewNotFound: '没有与该代码匹配的班级。',
    joinClassPreviewNeedCode: '输入班级码以查看班级、科目和教师。',
    createClassFacingSubjectLabel: '科目（对学生显示）',
    createClassFacingSubjectPlaceholder: '例如：数学',
    createClassFacingTeacherLabel: '教师姓名（对学生显示）',
    createClassFacingTeacherPlaceholder: '例如：杜老师',
    createClassFacingFieldsHint:
      '学生加入和在班级列表中会看到：班级名 — 科目 — 教师。之后可在班级页或创建测验时修改。',
    updateClassFacingSave: '保存显示信息',
    updateClassFacingSaveAsDefaults: '保存为下次默认',
    updateClassFacingSuccess: '已更新班级显示信息。',
    updateClassFacingFailed: '无法保存班级显示信息。',
    classPageStudentFacingTitle: '学生加入时看到的信息',
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
    studentClassExamsTitle: '本班测验',
    studentClassExamNotStarted: '尚未提交',
    studentClassExamSubmitted: '已提交',
    studentClassExamProgressScores: '折合100分：{score100} · 总评/10：{grade10}',
    studentClassExamSubmittedAt: '提交时间 {time}',
    studentClassExamCtaStart: '进入测验',
    studentClassExamCtaViewResult: '查看结果',
    studentClassExamBadgeClosed: '已关闭',
    studentClassExamClosedMissed: '测验已关闭 — 您未提交。',
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
    examSubmittedTitle: '已提交',
    examSubmittedSavedEarlier: '您已提交过本场测验。以下是已保存的成绩。',
    examScoreOutOf10: '得分 {grade}/10',
    examResultScale100Line: '折合百分制：{score100}/100',
    examResultSummaryGrade10Line: '十分制总评：{grade}/10',
    examShareResultScaleLine: '{title}：{score100}/100（约 {grade}/10）',
    examCorrectRatioLine: '{score}/{max} 分（{pct}%）',
    examShareResultLine: '{title}：得分 {grade}/10（{score}/{max} 正确 — {pct}%）',
    examShareResultLineMixed: '{title}：选择题 {grade}/10 · 暂计总分 {score}/{max}',
    examMcBreakdownLine: '选择题：{correct}/{total} 题正确 → {quizPoints}/{quizMax} 分',
    examEssayPendingBreakdownLine: '主观题：待批改（最高 {essayMax} 分）',
    examTotalPendingBreakdownLine: '暂计总分：{score}/{max}',
    examTotalScoreByExamLine: '卷面总分：{score}/{max}',
    examTeacherAttemptMixedSummary:
      '选择题 {correct}/{total} 对、{wrong} 错 · 选择题折合 {grade10}/10 · 暂计 {score}/{max}（主观题最高 {essayMax}）· {time}',
    examTeacherAttemptEssayOnlySummary: '已提交 · 暂计 {score}/{max}（仅主观题，最高 {essayMax}）· {time}',
    examShareDone: '已分享！',
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
    examSessionRosterReport: '已交 {submitted} · 未交 {notSubmitted}',
    examSessionShowNotSubmitted: '谁未交？',
    examSessionNotSubmittedTitle: '尚未提交的学生',
    examSessionNotSubmittedAllSubmitted: '本班学生均已提交本场测验。',
    examSessionNotSubmittedNoRoster: '班级名单中暂无学生。',
    lowScoreWarningPrefix: '有',
    lowScoreWarningSuffix: '名学生分数较低（< 5/10），建议教师重点关注并辅导。',
    correctLabel: '正确',
    wrongLabel: '错误',
    scoreLabel: '得分',
    questionSuffix: '题',
    examEssayPhotoHint:
      '可从相册选择或用相机拍摄（主观题每题最多10张，每张≤5MB，JPEG/PNG/WebP）。教师批改时会查看。',
    examEssayImageRetentionHint: '上传的图片最多保存 {days} 天用于阅卷，之后可能被系统删除。',
    examEssayImageRetentionResult: '您上传的图片约保留至 {expiresAt}（自提交起约 {days} 天）。',
    examGradeEssayImageRetentionTeacher:
      '学生上传的图片约保存 {days} 天（预计至 {expiresAt}）；如需长期留存请尽早下载备份。',
    examGradeEssayImageRetentionTeacherFallback: '学生上传的图片约保存 {days} 天；之后链接可能失效。',
    examEssayUploadPick: '相册选图',
    examEssayUploadCamera: '拍照',
    examEssayUploading: '上传中…',
    examEssayRemoveImage: '移除',
    examEssayTooManyImages: '主观题每题最多10张图片。',
    examEssayUploadFailed: '上传失败。',
    examEssayAnswerPlaceholder: '输入答案或仅上传照片…',
    examGradeEssayAction: '批改主观题',
    examGradeEssayDialogTitle: '批改主观题',
    examGradeEssayPointsLabel: '主观题得分（合计）',
    examGradeEssayPointsMaxHint: '最高 {max} 分（按试卷）。',
    examGradeEssaySave: '保存分数',
    examGradeEssayAiSuggest: 'AI 建议分数',
    examGradeEssayAiRunning: '正在调用 AI…',
    examGradeEssayAiApply: '采用建议分数',
    examGradeEssayStudentText: '学生作答（文字）',
    examGradeEssayNoText: '（无文字）',
    examGradeEssayAiNote:
      'AI 会阅读作答图片（如有），对照题目与题库参考答案；仅为建议，最终分数由教师评定。',
    examGradeEssayAiRationaleHeading: 'AI 详细说明',
    examGradeEssayLoadFailed: '无法加载作答。',
    examGradeEssaySaved: '已保存主观题分数。',
    examGradeEssaySaveFailed: '保存失败。',
    examGradeEssayAiFailed: 'AI 建议失败。',
    examGradeEssayQuestionLabel: '第 {index} 题',
    examGradeEssayStudentImages: '手写作答图片',
    examGradeEssayImageOpenHint: '点击图片可在新标签页查看原图大小',
    examGradeEssayLoadingDetail: '正在加载作答…',
    examGradeEssayGradedBadge: '主观题已评',
    examGradeEssayPendingBadge: '主观题待评',
    examGradeAllEssayAiButton: '用 AI 批改全部主观题',
    examGradeAllEssayAiRunning: 'AI 批改中（{current}/{total}）…',
    examGradeAllEssayAiNonePending: '没有需要批改的主观题（已全部批改或试卷无主观题）。',
    examGradeAllEssayAiSummarySuccess: '已为 {n} 份作答保存 AI 建议的主观题分数。',
    examGradeAllEssayAiSummaryPartial: '批量批改结束：成功 {ok} 份，失败 {fail} 份。',
    examErrorTitle: '错误',
    examLoadFailed: '无法加载试卷。',
    examLayoutTokenMissingSubmit: '会话无效，请刷新页面。',
    examSubmitFailed: '提交失败。',
    examDefaultTitle: '测验',
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
    teacherEditStudentNameButton: '改姓名',
    teacherEditStudentNameTitle: '修改学生姓名',
    teacherEditStudentNameHint: '仅在本班级显示（不更改登录账户姓名）。',
    teacherEditStudentNameSuccess: '已更新学生姓名。',
    teacherEditStudentNameFailed: '无法更新姓名。',
    teacherEditStudentNameTooLong: '姓名过长（最多 120 个字符）。',
    removeStudentConfirmTitle: '将该学生移出班级？',
    removeStudentConfirmDescription: '学生将从班级名单中移除，需要时可凭班级码再次加入。',
    removeStudentConfirmAction: '确认移出',
    removeStudentFailed: '无法移出学生。',
    removeStudentSuccess: '已将学生移出班级。',
    removeStudentRemoving: '正在移除…',
    examEnrollGateTitle: '加入班级后才能参加测验',
    examEnrollGateDescription:
      '本测验关联班级。请按班级名册填写姓名与出生日期（勿使用账号默认显示名）。填写后即可开始答题。',
    examEnrollSubmitButton: '加入班级并开始测验',
    examEnrollSubmitting: '正在加入…',
    gradebookTitle: '学生成绩册',
    gradebookDescription:
      '每列对应一份已分配练习或一次班级测验。单元格为答对/总题数（如 8/10）。总分为各次成绩折算为满分10分后的合计。含主观题：教师批改后行总分才计入主观题；此前仅按客观题折算。行按总分从低到高排序。',
    gradebookExportExcel: '导出 Excel',
    gradebookLoading: '正在加载成绩册…',
    gradebookEmptyColumns: '尚未为本班分配练习或测验。',
    gradebookFetchError: '无法加载成绩册。',
    gradebookColNo: '序号',
    gradebookColName: '姓名',
    gradebookColDob: '出生日期',
    gradebookColTotal: '总分（10分制）',
    gradebookExportFailed: '导出 Excel 失败。',
    gradebookKindWorksheet: '练习',
    gradebookKindExam: '测验',
    classPageBackToClass: '返回班级',
    classHubCardExamsDesc: '测验列表 — 每次测验单独页面：二维码、主观题批改、批量 AI。',
    classHubCardStudentsDesc: '班级成员、修改姓名、移出班级。',
    classHubCardExamsDescStudent: '班级测验：作答并在老师批改后查看成绩与反馈。',
    classHubCardStudentsDescStudent: '查看同班同学与老师。',
    classHubCardRosterTitleStudent: '班级成员',
    classHubCardGradebookDesc: '成绩总表与导出 Excel。',
    classHubCardWorksheetsDesc: '本班已交练习单。',
    classExamsIndexTitle: '本班测验',
    classExamSessionPageTitle: '测验详情',
    classExamGoToSession: '打开批改页面',
    classDetailSeoDescription: '班级主页：测验、成员、成绩表与练习单提交。',
    classHubCardAssignWorksheetDesc: '将练习单分配到本班供学生完成。',
    classPageStudentFacingNotSet: '未设置',
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
  createExamPage: {
    error: '错误',
    cancel: '取消',
    close: '关闭',
    delete: '删除',
    open: '打开',
    copied: '已复制',
    copyLink: '复制链接',
    missingInput: '缺少信息',
    missingInputSchoolAi: '请先输入更长的学校名称再使用 AI 查找。',
    schoolAiFailed: '无法通过 AI 规范化学校名称。',
    schoolAiNormalized: 'AI 已规范化',
    schoolAiNormalizedDesc: '已保存到数据库。请从下方列表选择学校。',
    missingSchool: '未选择学校',
    selectSchoolBeforeClass: '创建班级前请先选择学校。',
    missingClassName: '缺少班级名称',
    enterClassName: '请输入班级名称。',
    createClassFailed: '创建班级失败。',
    classCreated: '已创建班级',
    classCreatedDesc: '新班级已可用于绑定测验。',
    selectSchoolBeforeExam: '创建测验前请先选择学校。',
    missingClass: '未选择班级',
    selectClassBeforeExam: '创建测验前请先选择班级。',
    invalidQuestionCount: '题目数量无效',
    setQuestionCountHint: '请至少为一个难度设置题目数量。',
    noQuizSelected: '尚未选择题',
    selectQuizMatchCounts: '请按已设置的数量选择选择题。',
    notEnoughQuizByDifficulty: '各难度题目数量不足',
    selectEnoughQuizByDifficulty: '请按设置补足易/中/难题目。',
    totalMustBe100: '整卷总分须等于 100 分',
    totalMustBe100Desc:
      '当前总分为 {total}。请调整各选择题分值与各问答题满分（如有），使整卷合计为 100 分。',
    examCreateSuccess: '创建成功！',
    examCreateSuccessDesc: '测验已创建。请分享链接或二维码给学生。',
    linkCopiedDesc: '链接已复制。',
    deleteExamConfirm: '删除此测验？此操作无法撤销。',
    examDeleted: '已删除',
    examDeletedDesc: '测验已删除。',
    loadExamFailed: '无法加载测验。',
    pdfExported: '已导出 PDF',
    wordExported: '已导出 Word',
    pageTitle: '创建在线测验',
    pageSubtitle: '15 分钟、一节课、学期、毕业考。选择学科、年级与课程。二维码+链接给学生。',
    examFormCardDescription:
      '选择学科/年级与出题方式：随机或教师从课程练习列表中自选。',
    examCreatedBadge: '测验已创建',
    questions: '题',
    minutes: '分钟',
    minAbbr: '分',
    points: '分',
    examLink: '做题链接',
    copyLinkTitle: '复制链接',
    examCode: '测验代码',
    classLabel: '班级',
    schoolLabel: '学校',
    gradeLevelLabel: '年级',
    reviewSlides: '批改（幻灯）',
    exportPdf: '导出 PDF',
    exportWord: '导出 Word',
    createAnotherExam: '再建一份测验',
    cardExamInfo: '测验信息',
    cardExamInfoDesc: '选择学校、班级、类型、题量与时间。选择课程以抽取题目。创建后获得链接与二维码。',
    titleOptional: '标题（可选）',
    titlePlaceholder: '数学 15 分钟测验',
    subject: '学科',
    targetSchoolAndClass: '适用学校与班级',
    examFormRememberHint:
      '浏览器会记住学校、班级、学科/年级、测验类型和标题，下次打开本页会自动填入。',
    school: '学校',
    schoolPlaceholder: '输入学校名称',
    search: '搜索',
    searchingSchools: '正在搜索学校…',
    schoolMinChars: '至少输入 3 个字符以搜索学校。',
    selectedPrefix: '已选',
    class: '班级',
    loadingClasses: '正在加载班级…',
    noClassClickNew: '尚无班级 — 点击新建',
    selectSchoolBeforeNewClass: '新建班级前请先选择学校。',
    createNew: '新建',
    studentFacingBlockTitle: '学生可见信息（所选班级）',
    studentFacingBlockHint:
      '学生加入班级或查看班级列表时显示。保存以更新班级；也可存为新建班级的默认。',
    subjectForStudents: '学科（给学生看）',
    subjectForStudentsPh: '例：数学',
    teacherForStudents: '教师姓名（给学生看）',
    teacherForStudentsPh: '例：李老师',
    saveAsDefaultsNextClasses: '保存为后续班级默认',
    saved: '已保存',
    classDisplayUpdated: '已更新班级展示信息。',
    saving: '保存中…',
    saveClassFacing: '保存班级信息',
    examType: '测验类型',
    examType15: '15 分钟',
    examType45: '一节课（45 分钟）',
    examType90: '学期（90 分钟）',
    examType120: '毕业（120 分钟）',
    part1Quiz: '第一部分：选择题',
    colDifficulty: '难度',
    colCount: '题数',
    colMinPerQ: '分钟/题',
    colPtsPerQ: '分/题',
    colSumMin: '总分钟',
    easyQuestions: '容易',
    mediumQuestions: '中等',
    hardQuestions: '困难',
    easy: '易',
    medium: '中',
    hard: '难',
    quizPartTotal: '选择题合计',
    quizRemainForEssay: '满分 100：选择题部分之后，问答题最多还可分配 {n} 分。',
    quizTnOptionalEssayHint:
      '整卷满分 100 分（选择+问答）。下方可添加问答题并分配分数。当前选择题合计：{quizTotal} 分——最多还可给问答部分 {remainForEssay} 分。若不使用问答，请把选择题总分调到正好 100 分。',
    quizOver100: '警告：选择题总分（{n}）已超过 100，请降低每题分值或减少题数。',
    selectCurricula: '按所选学科与年级选择课程',
    loading: '加载中…',
    noCurriculaForSubject: '此学科/年级暂无课程。',
    createCurriculum: '创建课程',
    first: ' 后再试。',
    selectCurriculaForQuizList: '请先选择课程以加载选择题列表。',
    loadingQuestionList: '正在加载题目…',
    remainingEasy: '剩余（易）',
    remainingMedium: '剩余（中）',
    remainingHard: '剩余（难）',
    searchQuizPlaceholder: '搜索选择题…',
    badgeQuiz: '选择题',
    verified: '已核验',
    unverified: '未核验',
    lessonTag: '所属课',
    selectedBadge: '已选',
    quickView: '快速查看',
    noQuizInCurricula: '所选课程中没有选择题。',
    selectedQuiz: '已选选择题',
    selectedQuizCount: '{selected}/{total} 题',
    part2Essay: '第二部分：问答题',
    essayIntroNoRandom: '问答题不支持随机。请从已选课程中选题并设置每题时间。',
    essayIntro100scale:
      '选择+问答总分须为 100。每道问答题上限不得超过剩余分值（100 减去选择题分与其它问答题）。',
    hideEssayPicker: '隐藏问答题选择',
    showEssayPicker: '选择问答题',
    selectCurriculaBeforeEssay: '请先在上方选择课程再选问答题。',
    essayQuestionList: '问答题列表',
    searchEssayPlaceholder: '搜索问答题…',
    badgeEssay: '问答',
    selectedEssayListTitle: '已选问答题（在上方勾选后会出现在此）',
    timeMinutes: '时间（分钟）',
    maxPoints: '满分',
    essayMaxAllowedLine: '本题最多 {max} 分（已扣除选择题与其它问答题）。',
    noEssaySelectedYet: '尚未选择问答题。',
    noEssayInPicker: '所选课程中没有问答题。',
    summaryBeforeCreate: '创建前摘要',
    quizSection: '选择题部分',
    summaryQuizLine: '{label}：{count} 题 × {min} 分钟 = {sum} 分钟',
    quizSubtotalLabel: '选择题小计',
    essaySection: '问答题部分',
    noEssaySelectedSummary: '未选择问答题。',
    essayTotalLabel: '问答题合计',
    targetLabel: '目标',
    pointsFullExam: '分（整卷）',
    allocated: '已分配',
    ptsShort: '还差 {n} 分',
    ptsOver: '超出 {n} 分',
    equals100: '已满 100 分',
    totalDurationNeeded: '预计总用时',
    totalPointsExam: '试卷总分',
    selectedExamType: '所选测验类型',
    officialExamDuration: '规定考试时长',
    durationWarning:
      '警告：预计总时长（{total} 分钟）超过所选类型（{limit} 分钟）。测验仍会创建，但学生仅有 {limit} 分钟。',
    creating: '创建中…',
    need100ToCreate: '暂不可创建：整卷须合计 100 分（选择+问答如有）',
    createExam: '创建测验',
    createAnyway: '仍要创建',
    createdExamsList: '已创建的测验',
    createdExamsHint: '教师可打开链接或删除已创建的测验。',
    loadingExamList: '正在加载列表…',
    noExamsYet: '尚无测验。',
    examTitle: '测验',
    review: '批改',
    scanQrTitle: '扫码做题',
    qrFailedUseLink: '无法生成二维码，请使用下方链接。',
    openOnThisDevice: '在此设备打开',
    createNewClass: '新建班级',
    selectSchoolAboveForClass: '请先在上方选择学校再创建班级。',
    newClassNamePlaceholder: '输入新班级名称（例：12A6）',
    createClass: '创建班级',
    quickViewTitle: '快速查看：题目与解答',
    problem: '题目',
    noProblem: '无题目内容。',
    solution: '解答',
    noSolution: '暂无解答。',
    levelRecognition: '识记',
    levelComprehension: '理解',
    levelLowApplication: '简单应用',
    levelHighApplication: '综合应用',
    levelPractical: '实际应用',
    sourceTextbook: '教材',
    sourceAi: 'AI 生成',
    sourceEdited: '已编辑',
    sourceOther: '其他来源',
    defaultExamTitle: '测验',
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
    joinClassPreviewTitle: '参加しようとしているクラス',
    joinClassPreviewCheckHint: '送信前にクラス・教科・教師名をご確認ください。',
    joinClassPreviewLoading: 'コードを確認中…',
    joinClassPreviewNotFound: 'このコードに一致するクラスがありません。',
    joinClassPreviewNeedCode: 'クラスコードを入力するとクラス名・教科・教師が表示されます。',
    createClassFacingSubjectLabel: '教科（生徒に表示）',
    createClassFacingSubjectPlaceholder: '例：数学',
    createClassFacingTeacherLabel: '教師名（生徒に表示）',
    createClassFacingTeacherPlaceholder: '例：田中先生',
    createClassFacingFieldsHint:
      '生徒は参加時と一覧で「クラス名 — 教科 — 教師」の形で見ます。クラスページや試験作成時に後から変更できます。',
    updateClassFacingSave: '表示情報を保存',
    updateClassFacingSaveAsDefaults: '次回以降のデフォルトに保存',
    updateClassFacingSuccess: '表示情報を更新しました。',
    updateClassFacingFailed: '表示情報を保存できませんでした。',
    classPageStudentFacingTitle: '生徒が参加時に見る情報',
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
    studentClassExamsTitle: 'クラスのテスト',
    studentClassExamNotStarted: '未提出',
    studentClassExamSubmitted: '提出済み',
    studentClassExamProgressScores: '100点換算: {score100} · 10点満点換算: {grade10}',
    studentClassExamSubmittedAt: '提出 {time}',
    studentClassExamCtaStart: 'テストを受ける',
    studentClassExamCtaViewResult: '結果を見る',
    studentClassExamBadgeClosed: '終了',
    studentClassExamClosedMissed: 'テストは終了しています — 未提出です。',
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
    examSubmittedTitle: '提出済み',
    examSubmittedSavedEarlier: 'このテストはすでに提出済みです。保存された結果は以下のとおりです。',
    examScoreOutOf10: '得点 {grade}/10',
    examResultScale100Line: '100点満点換算：{score100}/100',
    examResultSummaryGrade10Line: '10点満点の総評：{grade}/10',
    examShareResultScaleLine: '{title}：{score100}/100（目安 {grade}/10）',
    examCorrectRatioLine: '{score}/{max} 点（{pct}%）',
    examShareResultLine: '{title}：得点 {grade}/10（{score}/{max} 正解 — {pct}%）',
    examShareResultLineMixed: '{title}：選択 {grade}/10 · 仮合計 {score}/{max}',
    examMcBreakdownLine: '選択：{correct}/{total} 正解 → {quizPoints}/{quizMax} 点',
    examEssayPendingBreakdownLine: '記述：未採点（満点 {essayMax} 点）',
    examTotalPendingBreakdownLine: '仮の合計：{score}/{max}',
    examTotalScoreByExamLine: '配点合計：{score}/{max}',
    examTeacherAttemptMixedSummary:
      '選択 {correct}/{total} 正解・{wrong} 不正解 · 選択 {grade10}/10 · 仮 {score}/{max}（記述上限 {essayMax}）· {time}',
    examTeacherAttemptEssayOnlySummary: '提出済み · 仮 {score}/{max}（記述のみ、上限 {essayMax}）· {time}',
    examShareDone: '共有しました！',
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
    examSessionRosterReport: '提出済 {submitted} · 未提出 {notSubmitted}',
    examSessionShowNotSubmitted: '未提出の生徒',
    examSessionNotSubmittedTitle: '未提出の生徒',
    examSessionNotSubmittedAllSubmitted: 'クラス名簿の生徒は全員この試験を提出済みです。',
    examSessionNotSubmittedNoRoster: 'クラス名簿に生徒がいません。',
    lowScoreWarningPrefix: '低得点（< 5/10）の生徒が',
    lowScoreWarningSuffix: '人います。重点的なフォローをおすすめします。',
    correctLabel: '正解',
    wrongLabel: '不正解',
    scoreLabel: '点数',
    questionSuffix: '問',
    examEssayPhotoHint:
      '端末から選ぶかカメラで撮影できます（記述1問あたり最大10枚、各5MB、JPEG/PNG/WebP）。採点時に先生が確認します。',
    examEssayImageRetentionHint:
      'アップロード画像は採点のため最大 {days} 日保存され、その後は削除される場合があります。',
    examEssayImageRetentionResult:
      'アップロードした画像はおおよそ {expiresAt} まで（提出から約 {days} 日間）利用できます。',
    examGradeEssayImageRetentionTeacher:
      '生徒がアップロードした画像は約 {days} 日（目安 {expiresAt} まで）保存されます。必要なら早めにダウンロードしてください。',
    examGradeEssayImageRetentionTeacherFallback:
      '生徒がアップロードした画像は約 {days} 日保存されます。その後リンクが使えなくなる場合があります。',
    examEssayUploadPick: '写真を選ぶ',
    examEssayUploadCamera: 'カメラで撮る',
    examEssayUploading: 'アップロード中…',
    examEssayRemoveImage: '削除',
    examEssayTooManyImages: '記述1問あたり最大10枚です。',
    examEssayUploadFailed: 'アップロードに失敗しました。',
    examEssayAnswerPlaceholder: '解答を入力するか、写真のみ送る…',
    examGradeEssayAction: '記述を採点',
    examGradeEssayDialogTitle: '記述問題の採点',
    examGradeEssayPointsLabel: '記述の得点（合計）',
    examGradeEssayPointsMaxHint: '満点 {max} 点（試験設定）。',
    examGradeEssaySave: '得点を保存',
    examGradeEssayAiSuggest: 'AIに点数の提案',
    examGradeEssayAiRunning: 'AI処理中…',
    examGradeEssayAiApply: '提案点数を使う',
    examGradeEssayStudentText: '生徒の解答（テキスト）',
    examGradeEssayNoText: '（テキストなし）',
    examGradeEssayAiNote:
      'AIは画像の手書き解答（ある場合）を読み、問題文と問題バンクの参考解答と照合します。あくまで提案で、最終採点は教師が行います。',
    examGradeEssayAiRationaleHeading: 'AIの根拠・コメント',
    examGradeEssayLoadFailed: '答案を読み込めませんでした。',
    examGradeEssaySaved: '記述の得点を保存しました。',
    examGradeEssaySaveFailed: '保存に失敗しました。',
    examGradeEssayAiFailed: 'AIの提案に失敗しました。',
    examGradeEssayQuestionLabel: '問{index}',
    examGradeEssayStudentImages: '手書きの写真',
    examGradeEssayImageOpenHint: '画像をクリックすると新しいタブで原寸表示',
    examGradeEssayLoadingDetail: '答案を読み込み中…',
    examGradeEssayGradedBadge: '記述採点済',
    examGradeEssayPendingBadge: '記述未採点',
    examGradeAllEssayAiButton: '記述を一括AI採点',
    examGradeAllEssayAiRunning: 'AI採点中（{current}/{total}）…',
    examGradeAllEssayAiNonePending:
      '採点が必要な記述答案がありません（すべて採点済み、または記述なし）。',
    examGradeAllEssayAiSummarySuccess: 'AI提案の記述得点を{n}件保存しました。',
    examGradeAllEssayAiSummaryPartial: '一括採点完了：成功{ok}件、失敗{fail}件。',
    examErrorTitle: 'エラー',
    examLoadFailed: '試験を読み込めませんでした。',
    examLayoutTokenMissingSubmit: 'セッションが無効です。ページを再読み込みしてください。',
    examSubmitFailed: '提出に失敗しました。',
    examDefaultTitle: '試験',
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
    teacherEditStudentNameButton: '名前を編集',
    teacherEditStudentNameTitle: '生徒の表示名を変更',
    teacherEditStudentNameHint: 'このクラスでの表示名のみ変更します（ログインアカウント名は変わりません）。',
    teacherEditStudentNameSuccess: '表示名を更新しました。',
    teacherEditStudentNameFailed: '名前を更新できませんでした。',
    teacherEditStudentNameTooLong: '氏名が長すぎます（最大120文字）。',
    removeStudentConfirmTitle: 'この生徒をクラスから外しますか？',
    removeStudentConfirmDescription: '名簿から削除されます。必要なら参加コードで再参加できます。',
    removeStudentConfirmAction: 'クラスから外す',
    removeStudentFailed: '削除できませんでした。',
    removeStudentSuccess: 'クラスから外しました。',
    removeStudentRemoving: '削除中…',
    examEnrollGateTitle: 'テストを受けるにはクラスに参加',
    examEnrollGateDescription:
      'このテストはクラスに紐づいています。名簿と同じ氏名・生年月日を入力してください（アカウントの表示名は使わないでください）。その後、テストを開始できます。',
    examEnrollSubmitButton: 'クラスに参加してテストを受ける',
    examEnrollSubmitting: '参加処理中…',
    gradebookTitle: '生徒の成績一覧',
    gradebookDescription:
      '各列はワークシート1件またはクラス用テスト1回です。セルは正答数/設問数（例 8/10）。合計は各課題を10点満点に換算して合計。記述ありのテストは、教師採点後に行合計へ反映；それまでは選択肢のみ換算。行は合計の低い順です。',
    gradebookExportExcel: 'Excel に出力',
    gradebookLoading: '読み込み中…',
    gradebookEmptyColumns: 'このクラスにワークシートやテストがまだありません。',
    gradebookFetchError: '成績一覧を読み込めませんでした。',
    gradebookColNo: '番号',
    gradebookColName: '氏名',
    gradebookColDob: '生年月日',
    gradebookColTotal: '合計（10点換算）',
    gradebookExportFailed: 'Excel の出力に失敗しました。',
    gradebookKindWorksheet: 'ワークシート',
    gradebookKindExam: 'テスト',
    classPageBackToClass: 'クラスに戻る',
    classHubCardExamsDesc: 'テスト一覧 — 各テストが専用ページ（QR、記述採点、一括AI）。',
    classHubCardStudentsDesc: 'メンバー、氏名の編集、クラスから削除。',
    classHubCardExamsDescStudent:
      'クラスのテストに受験し、先生が採点後に成績・コメントを確認できます。',
    classHubCardStudentsDescStudent: 'クラスメイトと担任教員を確認できます。',
    classHubCardRosterTitleStudent: 'クラスメンバー',
    classHubCardGradebookDesc: '成績一覧と Excel 出力。',
    classHubCardWorksheetsDesc: '提出済みワークシート。',
    classExamsIndexTitle: 'クラスのテスト',
    classExamSessionPageTitle: 'テストの詳細',
    classExamGoToSession: '採点ページを開く',
    classDetailSeoDescription: 'クラスページ：テスト、メンバー、成績、ワークシート提出。',
    classHubCardAssignWorksheetDesc: 'ワークシートをクラスに割り当て、生徒が取り組めるようにします。',
    classPageStudentFacingNotSet: '未設定',
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
  createExamPage: {
    error: 'エラー',
    cancel: 'キャンセル',
    close: '閉じる',
    delete: '削除',
    open: '開く',
    copied: 'コピーしました',
    copyLink: 'リンクをコピー',
    missingInput: '入力不足',
    missingInputSchoolAi: 'AI検索の前に、学校名をもう少し長く入力してください。',
    schoolAiFailed: 'AIで学校名を正規化できませんでした。',
    schoolAiNormalized: 'AIで正規化しました',
    schoolAiNormalizedDesc: 'DBに保存しました。下の一覧から学校を選んでください。',
    missingSchool: '学校が未選択',
    selectSchoolBeforeClass: 'クラスを作る前に学校を選んでください。',
    missingClassName: 'クラス名がありません',
    enterClassName: 'クラス名を入力してください。',
    createClassFailed: 'クラスを作成できませんでした。',
    classCreated: 'クラスを作成しました',
    classCreatedDesc: '新しいクラスにテストを割り当てられます。',
    selectSchoolBeforeExam: 'テスト作成前に学校を選んでください。',
    missingClass: 'クラスが未選択',
    selectClassBeforeExam: 'テスト作成前にクラスを選んでください。',
    invalidQuestionCount: '問題数が無効',
    setQuestionCountHint: '難易度ごとに少なくとも1つ問題数を設定してください。',
    noQuizSelected: '問題が未選択',
    selectQuizMatchCounts: '設定した数に合わせて選択問題を選んでください。',
    notEnoughQuizByDifficulty: '難易度ごとの問題が足りません',
    selectEnoughQuizByDifficulty: '易・中・難を設定どおりに選んでください。',
    totalMustBe100: '試験全体の合計は100点である必要があります',
    totalMustBe100Desc:
      '現在の合計は {total} 点です。各選択問題の配点と各記述の満点（ある場合）を調整し、全体で100点になるようにしてください。',
    examCreateSuccess: '作成しました！',
    examCreateSuccessDesc: 'テストを作成しました。リンクまたはQRを生徒に共有してください。',
    linkCopiedDesc: 'リンクをコピーしました。',
    deleteExamConfirm: 'このテストを削除しますか？元に戻せません。',
    examDeleted: '削除しました',
    examDeletedDesc: 'テストを削除しました。',
    loadExamFailed: 'テストを読み込めませんでした。',
    pdfExported: 'PDFを出力しました',
    wordExported: 'Wordを出力しました',
    pageTitle: 'オンラインテストを作成',
    pageSubtitle:
      '15分・1コマ・学期・卒業試験。教科・学年・教材を選び、QRとリンクを生徒に渡します。',
    examFormCardDescription:
      '教科・学年と出題方法を選びます：ランダム、または教師が教材の演習一覧から手選び。',
    examCreatedBadge: 'テストを作成済み',
    questions: '問',
    minutes: '分',
    minAbbr: '分',
    points: '点',
    examLink: '受験リンク',
    copyLinkTitle: 'リンクをコピー',
    examCode: 'テストコード',
    classLabel: 'クラス',
    schoolLabel: '学校',
    gradeLevelLabel: '学年',
    reviewSlides: '採点（スライド）',
    exportPdf: 'PDF出力',
    exportWord: 'Word出力',
    createAnotherExam: '別のテストを作成',
    cardExamInfo: 'テスト情報',
    cardExamInfoDesc:
      '学校・クラス・種類・問題数・時間を選び、教材から問題を取り込みます。作成でリンクとQRが得られます。',
    titleOptional: 'タイトル（任意）',
    titlePlaceholder: '数学 15分テスト',
    subject: '教科',
    targetSchoolAndClass: '対象の学校とクラス',
    examFormRememberHint:
      '学校・クラス・教科/学年・テスト種類・タイトルはこのブラウザに保存され、次回も自動で入ります。',
    school: '学校',
    schoolPlaceholder: '学校名を入力',
    search: '検索',
    searchingSchools: '学校を検索中…',
    schoolMinChars: '検索には少なくとも3文字入力してください。',
    selectedPrefix: '選択中',
    class: 'クラス',
    loadingClasses: 'クラスを読み込み中…',
    noClassClickNew: 'クラスがありません — 新規作成',
    selectSchoolBeforeNewClass: '新しいクラスを作る前に学校を選んでください。',
    createNew: '新規',
    studentFacingBlockTitle: '生徒向け表示（選択中のクラス）',
    studentFacingBlockHint:
      '生徒がクラスに参加する・一覧を見るときに使われます。保存でクラスを更新でき、新規クラスの既定にもできます。',
    subjectForStudents: '教科（生徒向け）',
    subjectForStudentsPh: '例：数学',
    teacherForStudents: '教員名（生徒向け）',
    teacherForStudentsPh: '例：田中先生',
    saveAsDefaultsNextClasses: '次回以降のクラスのデフォルトとして保存',
    saved: '保存しました',
    classDisplayUpdated: 'クラス表示情報を更新しました。',
    saving: '保存中…',
    saveClassFacing: 'クラス情報を保存',
    examType: 'テストの種類',
    examType15: '15分',
    examType45: '1コマ（45分）',
    examType90: '学期（90分）',
    examType120: '卒業（120分）',
    part1Quiz: 'パート1：選択問題',
    colDifficulty: '難易度',
    colCount: '問数',
    colMinPerQ: '分/問',
    colPtsPerQ: '点/問',
    colSumMin: '合計分',
    easyQuestions: '易しい',
    mediumQuestions: '普通',
    hardQuestions: '難しい',
    easy: '易',
    medium: '中',
    hard: '難',
    quizPartTotal: '選択問題の合計',
    quizRemainForEssay:
      '100点満点：選択問題の後、記述に最大 {n} 点まで割り当て可能です。',
    quizTnOptionalEssayHint:
      '試験全体は100点（選択＋記述）です。下のパート2で記述を選び配分できます。現在の選択合計：{quizTotal} 点 — 記述には最大 {remainForEssay} 点まで割り当て可能です。記述を使わない場合は、選択だけで合計100点にしてください。',
    quizOver100:
      '警告：選択問題の点（{n}）が100を超えています。点/問または問数を減らしてください。',
    selectCurricula: '選択した教科・学年の教材を選ぶ',
    loading: '読み込み中…',
    noCurriculaForSubject: 'この教科・学年には教材がありません。',
    createCurriculum: '教材を作成',
    first: ' してください。',
    selectCurriculaForQuizList: '選択問題一覧を読み込むには先に教材を選んでください。',
    loadingQuestionList: '問題を読み込み中…',
    remainingEasy: '残り（易）',
    remainingMedium: '残り（中）',
    remainingHard: '残り（難）',
    searchQuizPlaceholder: '選択問題を検索…',
    badgeQuiz: '選択',
    verified: '検証済',
    unverified: '未検証',
    lessonTag: '該当授業',
    selectedBadge: '選択済',
    quickView: 'クイック表示',
    noQuizInCurricula: '選んだ教材に選択問題がありません。',
    selectedQuiz: '選択した選択問題',
    selectedQuizCount: '{selected}/{total} 問',
    part2Essay: 'パート2：記述',
    essayIntroNoRandom:
      '記述はランダム抽出しません。教材から選び、各問の時間を設定してください。',
    essayIntro100scale:
      '選択＋記述の合計は100点です。各記述の満点は、選択の点と他の記述を引いた残りを超えられません。',
    hideEssayPicker: '記述の選択を隠す',
    showEssayPicker: '記述問題を選ぶ',
    selectCurriculaBeforeEssay: '記述を選ぶ前に上で教材を選んでください。',
    essayQuestionList: '記述問題一覧',
    searchEssayPlaceholder: '記述問題を検索…',
    badgeEssay: '記述',
    selectedEssayListTitle: '選んだ記述（上で選ぶとここに表示）',
    timeMinutes: '時間（分）',
    maxPoints: '満点',
    essayMaxAllowedLine: 'この問は最大 {max} 点まで（選択と他の記述を差し引いた残り）。',
    noEssaySelectedYet: '記述問題が未選択です。',
    noEssayInPicker: '選んだ教材に記述問題がありません。',
    summaryBeforeCreate: '作成前の概要',
    quizSection: '選択問題',
    summaryQuizLine: '{label}: {count} 問 × {min} 分 = {sum} 分',
    quizSubtotalLabel: '選択小計',
    essaySection: '記述',
    noEssaySelectedSummary: '記述問題なし。',
    essayTotalLabel: '記述の合計',
    targetLabel: '目標',
    pointsFullExam: '点（全卷）',
    allocated: '割当済',
    ptsShort: 'あと {n} 点不足',
    ptsOver: '{n} 点超過',
    equals100: 'ちょうど100点',
    totalDurationNeeded: '想定所要時間',
    totalPointsExam: '配点合計',
    selectedExamType: '選んだテスト種類',
    officialExamDuration: '規定試験時間',
    durationWarning:
      '警告：想定時間（{total} 分）が選んだ種類（{limit} 分）を超えています。テストは作成されますが、生徒は {limit} 分のみです。',
    creating: '作成中…',
    need100ToCreate: 'まだ作成できません：試験全体が100点（選択＋記述があれば）になるようにしてください',
    createExam: 'テストを作成',
    createAnyway: 'それでも作成',
    createdExamsList: '作成したテスト一覧',
    createdExamsHint: 'リンクを開いたりテストを削除したりできます。',
    loadingExamList: '一覧を読み込み中…',
    noExamsYet: 'テストはまだありません。',
    examTitle: 'テスト',
    review: '採点',
    scanQrTitle: 'QRで受験',
    qrFailedUseLink: 'QRを生成できませんでした。下のリンクを使ってください。',
    openOnThisDevice: 'この端末で開く',
    createNewClass: '新しいクラス',
    selectSchoolAboveForClass: 'クラスを作る前に上で学校を選んでください。',
    newClassNamePlaceholder: 'クラス名（例：12A6）',
    createClass: 'クラスを作成',
    quickViewTitle: 'クイック表示：問題と解答',
    problem: '問題',
    noProblem: '問題文がありません。',
    solution: '解答',
    noSolution: '解答がありません。',
    levelRecognition: '知識・理解',
    levelComprehension: '理解',
    levelLowApplication: '応用（低）',
    levelHighApplication: '応用（高）',
    levelPractical: '実践',
    sourceTextbook: '教科書',
    sourceAi: 'AI生成',
    sourceEdited: '編集済',
    sourceOther: 'その他',
    defaultExamTitle: 'テスト',
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
    joinClassPreviewTitle: '참가하려는 수업',
    joinClassPreviewCheckHint: '제출 전에 수업 — 과목 — 교사 이름을 확인하세요.',
    joinClassPreviewLoading: '코드 확인 중…',
    joinClassPreviewNotFound: '이 코드와 일치하는 수업이 없습니다.',
    joinClassPreviewNeedCode: '수업 코드를 입력하면 수업명·과목·교사를 볼 수 있습니다.',
    createClassFacingSubjectLabel: '과목(학생에게 표시)',
    createClassFacingSubjectPlaceholder: '예: 수학',
    createClassFacingTeacherLabel: '교사 이름(학생에게 표시)',
    createClassFacingTeacherPlaceholder: '예: 김 선생님',
    createClassFacingFieldsHint:
      '학생은 참가 시와 목록에서「수업명 — 과목 — 교사」형식으로 봅니다. 수업 페이지나 시험 만들기에서 나중에 바꿀 수 있습니다.',
    updateClassFacingSave: '표시 정보 저장',
    updateClassFacingSaveAsDefaults: '다음 수업의 기본값으로 저장',
    updateClassFacingSuccess: '표시 정보를 업데이트했습니다.',
    updateClassFacingFailed: '표시 정보를 저장할 수 없습니다.',
    classPageStudentFacingTitle: '학생이 참가할 때 보는 정보',
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
    studentClassExamsTitle: '수업 시험',
    studentClassExamNotStarted: '미제출',
    studentClassExamSubmitted: '제출 완료',
    studentClassExamProgressScores: '100점 환산: {score100} · 10점 만점 환산: {grade10}',
    studentClassExamSubmittedAt: '제출 시각 {time}',
    studentClassExamCtaStart: '시험 보기',
    studentClassExamCtaViewResult: '결과 보기',
    studentClassExamBadgeClosed: '종료됨',
    studentClassExamClosedMissed: '시험이 종료되었습니다 — 제출하지 않았습니다.',
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
    examSubmittedTitle: '제출 완료',
    examSubmittedSavedEarlier: '이미 이 시험을 제출했습니다. 아래는 저장된 결과입니다.',
    examScoreOutOf10: '점수 {grade}/10',
    examResultScale100Line: '100점 환산: {score100}/100',
    examResultSummaryGrade10Line: '10점 만점 총평: {grade}/10',
    examShareResultScaleLine: '{title}: {score100}/100 (약 {grade}/10)',
    examCorrectRatioLine: '{score}/{max}점 ({pct}%)',
    examShareResultLine: '{title}: 점수 {grade}/10 ({score}/{max} 정답 — {pct}%)',
    examShareResultLineMixed: '{title}: 객관식 {grade}/10 · 임시 총점 {score}/{max}',
    examMcBreakdownLine: '객관식: {correct}/{total} 정답 → {quizPoints}/{quizMax}점',
    examEssayPendingBreakdownLine: '서술: 미채점 (최대 {essayMax}점)',
    examTotalPendingBreakdownLine: '임시 총점: {score}/{max}',
    examTotalScoreByExamLine: '배점 합계: {score}/{max}',
    examTeacherAttemptMixedSummary:
      '객관식 {correct}/{total} 정답, {wrong} 오답 · 객관식 {grade10}/10 · 임시 {score}/{max} (서술 최대 {essayMax}) · {time}',
    examTeacherAttemptEssayOnlySummary: '제출됨 · 임시 {score}/{max} (서술만, 최대 {essayMax}) · {time}',
    examShareDone: '공유했습니다!',
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
    examSessionRosterReport: '제출 {submitted} · 미제출 {notSubmitted}',
    examSessionShowNotSubmitted: '미제출 학생',
    examSessionNotSubmittedTitle: '아직 제출하지 않은 학생',
    examSessionNotSubmittedAllSubmitted: '학급 명단의 모든 학생이 이 시험을 제출했습니다.',
    examSessionNotSubmittedNoRoster: '학급 명단에 학생이 없습니다.',
    lowScoreWarningPrefix: '낮은 점수(< 5/10) 학생이',
    lowScoreWarningSuffix: '명 있습니다. 추가 지도에 유의해주세요.',
    correctLabel: '정답',
    wrongLabel: '오답',
    scoreLabel: '점수',
    questionSuffix: '문항',
    examEssayPhotoHint:
      '갤러리에서 고르거나 카메라로 촬영할 수 있습니다(서술형 문항당 최대 10장, 장당 5MB, JPEG/PNG/WebP). 채점 시 선생님이 확인합니다.',
    examEssayImageRetentionHint:
      '업로드한 이미지는 채점을 위해 최대 {days}일 보관되며 이후 삭제될 수 있습니다.',
    examEssayImageRetentionResult:
      '업로드한 이미지는 약 {expiresAt}까지(제출 후 약 {days}일) 이용할 수 있습니다.',
    examGradeEssayImageRetentionTeacher:
      '학생이 업로드한 이미지는 약 {days}일(예상 {expiresAt}까지) 보관됩니다. 필요하면 미리 내려받으세요.',
    examGradeEssayImageRetentionTeacherFallback:
      '학생이 업로드한 이미지는 약 {days}일 보관됩니다. 이후 링크가 동작하지 않을 수 있습니다.',
    examEssayUploadPick: '갤러리에서 선택',
    examEssayUploadCamera: '카메라로 촬영',
    examEssayUploading: '업로드 중…',
    examEssayRemoveImage: '삭제',
    examEssayTooManyImages: '서술형 문항당 최대 10장입니다.',
    examEssayUploadFailed: '업로드에 실패했습니다.',
    examEssayAnswerPlaceholder: '답을 입력하거나 사진만 제출…',
    examGradeEssayAction: '서술형 채점',
    examGradeEssayDialogTitle: '서술형 채점',
    examGradeEssayPointsLabel: '서술형 점수(합계)',
    examGradeEssayPointsMaxHint: '최대 {max}점(시험 기준).',
    examGradeEssaySave: '점수 저장',
    examGradeEssayAiSuggest: 'AI 점수 제안',
    examGradeEssayAiRunning: 'AI 처리 중…',
    examGradeEssayAiApply: '제안 점수 적용',
    examGradeEssayStudentText: '학생 답안(텍스트)',
    examGradeEssayNoText: '(텍스트 없음)',
    examGradeEssayAiNote:
      'AI는 답안 이미지(있는 경우)를 읽어 문제와 문항 은행의 참고 해설과 비교합니다. 제안일 뿐이며 최종 점수는 교사가 결정합니다.',
    examGradeEssayAiRationaleHeading: 'AI 근거·설명',
    examGradeEssayLoadFailed: '답안을 불러오지 못했습니다.',
    examGradeEssaySaved: '서술형 점수를 저장했습니다.',
    examGradeEssaySaveFailed: '저장에 실패했습니다.',
    examGradeEssayAiFailed: 'AI 제안에 실패했습니다.',
    examGradeEssayQuestionLabel: '{index}번',
    examGradeEssayStudentImages: '손글씨 이미지',
    examGradeEssayImageOpenHint: '이미지를 누르면 새 탭에서 원본 크기로 볼 수 있음',
    examGradeEssayLoadingDetail: '답안 불러오는 중…',
    examGradeEssayGradedBadge: '서술형 채점됨',
    examGradeEssayPendingBadge: '서술형 대기',
    examGradeAllEssayAiButton: '서술형 전부 AI 채점',
    examGradeAllEssayAiRunning: 'AI 채점 중 ({current}/{total})…',
    examGradeAllEssayAiNonePending:
      '채점할 서술형 답안이 없습니다(이미 모두 채점됨 또는 서술형 없음).',
    examGradeAllEssayAiSummarySuccess: 'AI 제안 서술형 점수를 {n}건 저장했습니다.',
    examGradeAllEssayAiSummaryPartial: '일괄 채점 완료: 성공 {ok}건, 실패 {fail}건.',
    examErrorTitle: '오류',
    examLoadFailed: '시험을 불러오지 못했습니다.',
    examLayoutTokenMissingSubmit: '세션이 유효하지 않습니다. 페이지를 새로고침하세요.',
    examSubmitFailed: '제출에 실패했습니다.',
    examDefaultTitle: '시험',
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
    teacherEditStudentNameButton: '이름 수정',
    teacherEditStudentNameTitle: '학생 이름 바꾸기',
    teacherEditStudentNameHint: '이 수업에서만 보이는 이름입니다(로그인 계정 이름은 바뀌지 않습니다).',
    teacherEditStudentNameSuccess: '학생 이름을 업데이트했습니다.',
    teacherEditStudentNameFailed: '이름을 바꿀 수 없습니다.',
    teacherEditStudentNameTooLong: '이름이 너무 깁니다(최대 120자).',
    removeStudentConfirmTitle: '이 학생을 수업에서 제거할까요?',
    removeStudentConfirmDescription: '명단에서 사라집니다. 필요하면 참가 코드로 다시 들어올 수 있습니다.',
    removeStudentConfirmAction: '수업에서 제거',
    removeStudentFailed: '제거하지 못했습니다.',
    removeStudentSuccess: '수업에서 제거했습니다.',
    removeStudentRemoving: '제거 중…',
    examEnrollGateTitle: '수업에 참가해야 시험을 볼 수 있습니다',
    examEnrollGateDescription:
      '이 시험은 수업과 연결되어 있습니다. 명단과 동일한 이름과 생년월일을 입력하세요(계정 기본 표시 이름 사용 금지). 이후 시험을 시작할 수 있습니다.',
    examEnrollSubmitButton: '수업 참가 후 시험 보기',
    examEnrollSubmitting: '참가 중…',
    gradebookTitle: '학생 성적표',
    gradebookDescription:
      '각 열은 배정된 워크시트 1개 또는 수업 시험 1회입니다. 칸은 맞힌 수/전체 문항(예: 8/10). 총점은 과제마다 10점 만점으로 환산한 값의 합입니다. 서술형이 있는 시험은 교사 채점 후 행 총점에 반영되며, 그 전에는 객관식만 환산합니다. 행은 총점 낮은 순입니다.',
    gradebookExportExcel: 'Excel보내기',
    gradebookLoading: '성적표 불러오는 중…',
    gradebookEmptyColumns: '이 수업에 워크시트나 시험이 아직 없습니다.',
    gradebookFetchError: '성적표를 불러오지 못했습니다.',
    gradebookColNo: '번호',
    gradebookColName: '이름',
    gradebookColDob: '생년월일',
    gradebookColTotal: '합계(10점 환산)',
    gradebookExportFailed: 'Excel보내기에 실패했습니다.',
    gradebookKindWorksheet: '워크시트',
    gradebookKindExam: '시험',
    classPageBackToClass: '수업으로 돌아가기',
    classHubCardExamsDesc: '시험 목록 — 시험마다 별도 페이지(QR, 서술형 채점, 일괄 AI).',
    classHubCardStudentsDesc: '구성원, 이름 수정, 수업에서 제외.',
    classHubCardExamsDescStudent:
      '반 시험: 응시하고 선생님 채점 후 점수·피드백을 확인합니다.',
    classHubCardStudentsDescStudent: '반 친구와 선생님을 확인합니다.',
    classHubCardRosterTitleStudent: '반 구성원',
    classHubCardGradebookDesc: '성적표 및 Excel보내기.',
    classHubCardWorksheetsDesc: '제출된 워크시트.',
    classExamsIndexTitle: '수업 시험',
    classExamSessionPageTitle: '시험 상세',
    classExamGoToSession: '채점 페이지 열기',
    classDetailSeoDescription: '수업 홈: 시험, 명단, 성적표, 워크시트 제출.',
    classHubCardAssignWorksheetDesc: '워크시트를 이 수업에 배정해 학생이 풀 수 있게 합니다.',
    classPageStudentFacingNotSet: '설정 안 됨',
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
  createExamPage: {
    error: '오류',
    cancel: '취소',
    close: '닫기',
    delete: '삭제',
    open: '열기',
    copied: '복사됨',
    copyLink: '링크 복사',
    missingInput: '입력이 부족합니다',
    missingInputSchoolAi: 'AI 검색 전에 학교 이름을 더 길게 입력하세요.',
    schoolAiFailed: 'AI로 학교 이름을 정규화할 수 없습니다.',
    schoolAiNormalized: 'AI로 정규화됨',
    schoolAiNormalizedDesc: 'DB에 저장되었습니다. 아래 목록에서 학교를 선택하세요.',
    missingSchool: '학교 미선택',
    selectSchoolBeforeClass: '반을 만들기 전에 학교를 선택하세요.',
    missingClassName: '반 이름 없음',
    enterClassName: '반 이름을 입력하세요.',
    createClassFailed: '반을 만들지 못했습니다.',
    classCreated: '반을 만들었습니다',
    classCreatedDesc: '새 반에 시험을 연결할 수 있습니다.',
    selectSchoolBeforeExam: '시험을 만들기 전에 학교를 선택하세요.',
    missingClass: '반 미선택',
    selectClassBeforeExam: '시험을 만들기 전에 반을 선택하세요.',
    invalidQuestionCount: '문항 수가 올바르지 않습니다',
    setQuestionCountHint: '난이도별로 최소 한 곳에 문항 수를 설정하세요.',
    noQuizSelected: '문항이 선택되지 않았습니다',
    selectQuizMatchCounts: '설정한 수에 맞게 객관식을 선택하세요.',
    notEnoughQuizByDifficulty: '난이도별 문항이 부족합니다',
    selectEnoughQuizByDifficulty: '쉬움/보통/어려움을 설정대로 채우세요.',
    totalMustBe100: '전체 시험 합계는 100점이어야 합니다',
    totalMustBe100Desc:
      '현재 합계는 {total}점입니다. 각 객관식 배점과 각 서술 만점(있는 경우)을 조정해 전체가 100점이 되게 하세요.',
    examCreateSuccess: '만들었습니다!',
    examCreateSuccessDesc: '시험이 생성되었습니다. 링크나 QR을 학생에게 공유하세요.',
    linkCopiedDesc: '링크가 복사되었습니다.',
    deleteExamConfirm: '이 시험을 삭제할까요? 되돌릴 수 없습니다.',
    examDeleted: '삭제됨',
    examDeletedDesc: '시험이 삭제되었습니다.',
    loadExamFailed: '시험을 불러오지 못했습니다.',
    pdfExported: 'PDF보냄',
    wordExported: 'Word보냄',
    pageTitle: '온라인 시험 만들기',
    pageSubtitle:
      '15분·1교시·학기·졸업. 과목·학년·교재 선택. 학생에게 QR과 링크 제공.',
    examFormCardDescription:
      '과목·학년과 문항 방식을 고릅니다: 무작위 또는 교사가 교재 연습 목록에서 직접 선택.',
    examCreatedBadge: '시험 생성됨',
    questions: '문항',
    minutes: '분',
    minAbbr: '분',
    points: '점',
    examLink: '응시 링크',
    copyLinkTitle: '링크 복사',
    examCode: '시험 코드',
    classLabel: '반',
    schoolLabel: '학교',
    gradeLevelLabel: '학년',
    reviewSlides: '채점(슬라이드)',
    exportPdf: 'PDF보내기',
    exportWord: 'Word보내기',
    createAnotherExam: '다른 시험 만들기',
    cardExamInfo: '시험 정보',
    cardExamInfoDesc:
      '학교·반·유형·문항 수·시간을 고르고 교재에서 문제를 가져옵니다. 만들면 링크와 QR이 생깁니다.',
    titleOptional: '제목(선택)',
    titlePlaceholder: '수학 15분 시험',
    subject: '과목',
    targetSchoolAndClass: '적용 학교와 반',
    examFormRememberHint:
      '학교·반·과목·학년·시험 유형·제목은 이 브라우저에 저장되어 다음에 다시 채워집니다.',
    school: '학교',
    schoolPlaceholder: '학교 이름 입력',
    search: '검색',
    searchingSchools: '학교 검색 중…',
    schoolMinChars: '검색하려면 최소 3글자를 입력하세요.',
    selectedPrefix: '선택됨',
    class: '반',
    loadingClasses: '반 목록 불러오는 중…',
    noClassClickNew: '반 없음 — 새로 만들기',
    selectSchoolBeforeNewClass: '새 반을 만들기 전에 학교를 선택하세요.',
    createNew: '새로 만들기',
    studentFacingBlockTitle: '학생에게 보이는 정보(선택한 반)',
    studentFacingBlockHint:
      '학생이 반에 참여하거나 반 목록을 볼 때 사용합니다. 저장하면 반 정보가 갱신되고, 새 반의 기본값으로도 저장할 수 있습니다.',
    subjectForStudents: '과목(학생용)',
    subjectForStudentsPh: '예: 수학',
    teacherForStudents: '교사 이름(학생용)',
    teacherForStudentsPh: '예: 김선생',
    saveAsDefaultsNextClasses: '다음 반 기본값으로 저장',
    saved: '저장됨',
    classDisplayUpdated: '반 표시 정보가 업데이트되었습니다.',
    saving: '저장 중…',
    saveClassFacing: '반 정보 저장',
    examType: '시험 유형',
    examType15: '15분',
    examType45: '1교시(45분)',
    examType90: '학기(90분)',
    examType120: '졸업(120분)',
    part1Quiz: '1부: 객관식',
    colDifficulty: '난이도',
    colCount: '문항 수',
    colMinPerQ: '분/문항',
    colPtsPerQ: '점/문항',
    colSumMin: '합계(분)',
    easyQuestions: '쉬움',
    mediumQuestions: '보통',
    hardQuestions: '어려움',
    easy: '쉬움',
    medium: '보통',
    hard: '어려움',
    quizPartTotal: '객관식 합계',
    quizRemainForEssay: '100점 만점 기준: 객관식 이후 서술에 최대 {n}점까지 배정 가능합니다.',
    quizTnOptionalEssayHint:
      '전체 시험은 100점(객관식+서술)입니다. 아래에서 서술 문항을 고르고 배점할 수 있습니다. 현재 객관식 합계: {quizTotal}점 — 서술에는 최대 {remainForEssay}점까지 줄 수 있습니다. 서술을 쓰지 않으면 객관식 합계를 정확히 100점으로 맞추세요.',
    quizOver100:
      '경고: 객관식 점수({n})가 100을 초과했습니다. 문항당 점수나 문항 수를 줄이세요.',
    selectCurricula: '선택한 과목·학년의 교재 고르기',
    loading: '불러오는 중…',
    noCurriculaForSubject: '이 과목·학년에 교재가 없습니다.',
    createCurriculum: '교재 만들기',
    first: ' 먼저 하세요.',
    selectCurriculaForQuizList: '객관식 목록을 불러오려면 먼저 교재를 선택하세요.',
    loadingQuestionList: '문항 불러오는 중…',
    remainingEasy: '남음(쉬움)',
    remainingMedium: '남음(보통)',
    remainingHard: '남음(어려움)',
    searchQuizPlaceholder: '객관식 검색…',
    badgeQuiz: '객관식',
    verified: '검증됨',
    unverified: '미검증',
    lessonTag: '단원',
    selectedBadge: '선택됨',
    quickView: '빠른 보기',
    noQuizInCurricula: '선택한 교재에 객관식이 없습니다.',
    selectedQuiz: '선택한 객관식',
    selectedQuizCount: '{selected}/{total}문항',
    part2Essay: '2부: 서술',
    essayIntroNoRandom:
      '서술은 무작위가 없습니다. 교재에서 고르고 문항별 시간을 설정하세요.',
    essayIntro100scale:
      '객관식+서술 합계는 100점입니다. 각 서술 만점은 객관식 점수와 다른 서술을 뺀 나머지를 넘을 수 없습니다.',
    hideEssayPicker: '서술 선택 숨기기',
    showEssayPicker: '서술 문항 선택',
    selectCurriculaBeforeEssay: '서술을 고르기 전에 위에서 교재를 선택하세요.',
    essayQuestionList: '서술 문항 목록',
    searchEssayPlaceholder: '서술 문항 검색…',
    badgeEssay: '서술',
    selectedEssayListTitle: '선택한 서술(위에서 고르면 여기로 이동)',
    timeMinutes: '시간(분)',
    maxPoints: '만점',
    essayMaxAllowedLine: '이 문항은 최대 {max}점까지(객관식·다른 서술 제외 잔여).',
    noEssaySelectedYet: '서술 문항이 없습니다.',
    noEssayInPicker: '선택한 교재에 서술 문항이 없습니다.',
    summaryBeforeCreate: '만들기 전 요약',
    quizSection: '객관식',
    summaryQuizLine: '{label}: {count}문항 × {min}분 = {sum}분',
    quizSubtotalLabel: '객관식 소계',
    essaySection: '서술',
    noEssaySelectedSummary: '서술 문항 없음.',
    essayTotalLabel: '서술 합계',
    targetLabel: '목표',
    pointsFullExam: '점(전체)',
    allocated: '배점됨',
    ptsShort: '{n}점 부족',
    ptsOver: '{n}점 초과',
    equals100: '100점 맞춤',
    totalDurationNeeded: '예상 소요 시간',
    totalPointsExam: '시험 총점',
    selectedExamType: '선택한 시험 유형',
    officialExamDuration: '정식 시험 시간',
    durationWarning:
      '경고: 예상 시간({total}분)이 선택한 유형({limit}분)을 초과합니다. 시험은 만들어지지만 학생은 {limit}분만 있습니다.',
    creating: '만드는 중…',
    need100ToCreate: '아직 생성 불가: 전체 합계 100점(객관식+서술)을 맞추세요',
    createExam: '시험 만들기',
    createAnyway: '그래도 만들기',
    createdExamsList: '만든 시험 목록',
    createdExamsHint: '링크를 열거나 만든 시험을 삭제할 수 있습니다.',
    loadingExamList: '목록 불러오는 중…',
    noExamsYet: '시험이 없습니다.',
    examTitle: '시험',
    review: '채점',
    scanQrTitle: 'QR로 응시',
    qrFailedUseLink: 'QR을 만들 수 없습니다. 아래 링크를 사용하세요.',
    openOnThisDevice: '이 기기에서 열기',
    createNewClass: '새 반 만들기',
    selectSchoolAboveForClass: '반을 만들기 전에 위에서 학교를 선택하세요.',
    newClassNamePlaceholder: '새 반 이름(예: 12A6)',
    createClass: '반 만들기',
    quickViewTitle: '빠른 보기: 문제와 해설',
    problem: '문제',
    noProblem: '문제 내용이 없습니다.',
    solution: '해설',
    noSolution: '해설이 없습니다.',
    levelRecognition: '지식·이해',
    levelComprehension: '이해',
    levelLowApplication: '적용(하)',
    levelHighApplication: '적용(상)',
    levelPractical: '실생활',
    sourceTextbook: '교과서',
    sourceAi: 'AI 생성',
    sourceEdited: '편집됨',
    sourceOther: '기타',
    defaultExamTitle: '시험',
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

