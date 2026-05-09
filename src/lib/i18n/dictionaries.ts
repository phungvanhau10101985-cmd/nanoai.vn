import { DEFAULT_WEB_LOCALE, type WebLocale } from '@/lib/i18n/config'

export type NavGroupKey =
  | 'try_on'
  | 'education'
  | 'image_edit'
  | 'design_creative'
  | 'three_d_special'
  | 'music_ai'
  | 'system'

export type ToolKey =
  | 'try_on'
  | 'restore_image'
  | 'enhance_image'
  | 'beautify_image'
  | 'merge_image'
  | 'create_banner'
  | 'wedding_invitation_ai'
  | 'text_to_image'
  | 'infographic_from_book'
  | 'sketch_to_image'
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
  | 'edit_image_by_request'
  | 'product_3d_sample'
  | 'model_3d_from_image'
  | 'create_video_from_image'
  | 'flow_music_veo_video'
  | 'interior_exterior'
  | 'my_house'
  | 'portrait_photo'
  | 'expand_frame'
  | 'face_swap'
  | 'translate_document_image'
  | 'lyria3_instrumental_song'
  | 'meeting_recorder_report'
  | 'ai_language_learning'
  | 'create_curriculum'
  | 'my_curricula'
  | 'online_exam'
  | 'homework_online'
  | 'classes'
  | 'try_on_1'
  | 'try_on_2'
  | 'try_on_3'
  | 'try_on_4'
  | 'try_on_5'
  | 'image_result_display'
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
    inviteFriends: string
    /** Menu tài khoản → trang gói dịch vụ */
    viewPlan: string
    /** Nút / mục menu nạp thêm credit */
    topUpCredits: string
    /** Trung tâm tác vụ / hàng đợi */
    tasksHub: string
    /** Menu → /support-chat */
    supportChat: string
    /** Menu → /dashboard/messaging (kênh kinh doanh của đối tác) */
    partnerInbox: string
    /** Menu → /dashboard/api-integration (chủ shop: API, nhúng chat) */
    partnerApiIntegration: string
    /** Menu → /dashboard/customer-api-keys (BYOK AI provider keys) */
    customerApiKeys: string
    /** Menu → /messaging/my-chats (khách: tin với các shop khác, không phải inbox chủ shop) */
    myChats: string
    /** Menu → /messaging/my-orders (đơn đặt qua chat widget) */
    myOrders: string
    /** Menu tài khoản → hộp thoại cài web app (PWA): Chrome/Android + Safari/iOS */
    downloadApp: string
    downloadAppSubtitle: string
    downloadAndroidTitle: string
    downloadAndroidChromeHint: string
    downloadAndroidStep1: string
    downloadAndroidStep2: string
    downloadAndroidStep3: string
    downloadIosTitle: string
    downloadIosSafariHint: string
    downloadIosStep1: string
    downloadIosStep2: string
    downloadIosStep3: string
  }
  home: {
    title: string
  }
  referral: {
    pageTitle: string
    metaDescription: string
    headline: string
    description: string
    yourLinkLabel: string
    copyButton: string
    copied: string
    howItWorksTitle: string
    step1: string
    step2: string
    step3: string
    bonusNote: string
    inviteVisualYou: string
    inviteVisualFriend: string
    /** Người được mời không nhận credit giới thiệu — hiển thị thay cho +2 */
    inviteeNoReferralCredit: string
    errorGeneric: string
  }
  /** Trang /account/plan — dùng thử + phí tháng giáo trình; English AI trả theo bài */
  accountPlan: {
    pageTitle: string
    metaDescription: string
    headline: string
    /** {period} kỳ YYYY-MM (VN) */
    billingPeriod: string
    trialSectionTitle: string
    trialActiveLine: string
    /** {days} */
    trialTotalDaysNote: string
    /** {days} */
    trialDaysLeft: string
    /** {datetime} */
    trialEndsAtLine: string
    trialNotActive: string
    servicesSectionTitle: string
    productEnglishCoach: string
    /** Học tiếng Anh AI — không phí tháng, trừ credit theo buổi/bài */
    englishCoachPayPerLesson: string
    productCurriculum: string
    statusViaTrial: string
    /** Hiếm: API đồng bộ — đã access nhưng không khớp trial/charge */
    statusAccessOn: string
    /** {period} */
    statusPaidMonth: string
    /** {credits} {period} */
    statusPendingPayment: string
    /** {credits} */
    noteSignupBonus: string
    noteAiCredits: string
    refresh: string
    loading: string
    errorLoad: string
    errorConfig: string
    /** {credits} {vnd} số tiền đã format theo locale */
    monthlyCostLine: string
    backDashboard: string
    linkWallet: string
  }
  push: {
    bannerTitle: string
    bannerHint: string
    enable: string
    later: string
    enabledToast: string
    bellEnableHint: string
    bellEnableButton: string
    bellSubscribedShort: string
    bellDeniedHint: string
    bellSyncHint: string
  }
  /** /support-chat — chat nội bộ, cùng hộp thư với FB/Zalo */
  supportChat: {
    pageTitle: string
    metaDescription: string
    /** Nhãn nhỏ phía trên tiêu đề (thương hiệu) */
    brandBadge: string
    headline: string
    subline: string
    loginRequired: string
    /** Gợi ý dưới tiêu đề thẻ đăng nhập (khác pollNote) */
    loginSupportingLine: string
    loginLink: string
    placeholder: string
    send: string
    emptyThread: string
    loadError: string
    sendError: string
    pollNote: string
    /** Gợi ý phím tắt ô nhập */
    sendKeyboardHint: string
    /** Thẻ sản phẩm AI: mở trang sản phẩm */
    messageProductCardOpenProduct: string
    /** Thẻ sản phẩm AI: nút mở trang chi tiết (phía trên tư vấn/mua) */
    messageProductCardViewDetails: string
  }
  /** /admin/customer-care */
  customerCareAdmin: {
    pageTitle: string
    pageDescription: string
    inboxTitle: string
    pickConversation: string
    replyPlaceholder: string
    send: string
    refresh: string
    channelFacebook: string
    channelZalo: string
    channelInternal: string
    channelWidget: string
    unknownUser: string
    sendFailed: string
    noMessages: string
    sendKeyboardHint: string
    messageProductCardOpenProduct: string
    messageProductCardViewDetails: string
  }
  /** /dashboard/messaging — đối tác B2B: inbox + FB/Zalo/widget */
  partnerMessaging: {
    pageTitle: string
    pageDescription: string
    cardTitle: string
    cardDescription: string
    createWorkspace: string
    workspaceNameLabel: string
    workspaceLabel: string
    createButton: string
    saveOk: string
    channelsSection: string
    fbPageId: string
    fbPageToken: string
    fbVerifyToken: string
    saveFacebook: string
    zaloSecret: string
    zaloToken: string
    saveZalo: string
    embedSection: string
    embedHint: string
    embedHeadersHelp: string
    /** Khác biệt embed ẩn danh vs chat có đăng nhập NanoAI */
    embedAnonymousFootnote: string
    inboxTitle: string
    /** Ô tìm trong danh sách hội thoại (inbox shop) */
    inboxSearchPlaceholder: string
    /** Không có mục nào khớp ô tìm */
    inboxNoSearchResults: string
    /** Cột phải kiểu CRM */
    inboxSideInfoTab: string
    inboxSideOrderTab: string
    inboxSideNoNotes: string
    inboxSideNotePlaceholder: string
    inboxSideOrderEmpty: string
    inboxSideCreateOrder: string
    pickConversation: string
    replyPlaceholder: string
    send: string
    refresh: string
    channelFacebook: string
    channelZalo: string
    channelWidget: string
    unknownUser: string
    noMessages: string
    /** Inbox shop: trợ lý AI đang xử lý tin khách */
    inboxShopDrafting: string
    replyKeyboardHint: string
    /** Thẻ sản phẩm AI trong inbox / guest chat */
    messageProductCardOpenProduct: string
    messageProductCardViewDetails: string
    /** Shop gửi ảnh cho khách (dashboard inbox) */
    partnerAttachPhoto: string
    partnerTakePhoto: string
    partnerRemoveAttachmentAria: string
    partnerCaptionHint: string
    partnerUploading: string
    partnerImageTooLarge: string
    partnerImageInvalidType: string
    nanoaiHostedSection: string
    nanoaiHostedHint: string
    nanoaiHostedUrlLabel: string
    nanoaiHostedIframeTitle: string
    /** Thuộc tính title="" trong mã iframe (a11y) */
    nanoaiHostedIframeTitleAttr: string
    nanoaiHostedIframeHelp: string
    copyHostedChatLinkButton: string
    hostedChatLinkCopiedToast: string
    copyIframeSnippetButton: string
    iframeSnippetCopiedToast: string
    integrationSectionTitle: string
    integrationSectionHint: string
    googleTagLabel: string
    googleTagPlaceholder: string
    facebookPixelLabel: string
    facebookPixelPlaceholder: string
    /** Meta Pixel + CAPI cho trang tư vấn / link có ctx_inventory */
    metaConsultTrackingSection: string
    metaConsultTrackingHint: string
    metaConsultCapiTokenLabel: string
    metaConsultCapiTokenPlaceholder: string
    /** Hiển thị cạnh nhãn khi DB đã có token CAPI */
    metaConsultCapiConfiguredBadge: string
    metaConsultCapiSavedHint: string
    metaConsultSaveButton: string
    shopGa4MeasurementLabel: string
    shopGa4MeasurementHint: string
    shopGa4MeasurementPlaceholder: string
    shopGa4InvalidIdToast: string
    shopGa4SaveButton: string
    /** URL feed CSV cho Meta Commerce / Facebook danh mục sản phẩm */
    facebookCatalogFeedTitle: string
    facebookCatalogFeedHint: string
    facebookCatalogFeedCopyButton: string
    facebookCatalogFeedCopiedToast: string
    nanoaiEmbedCodeLabel: string
    facebookChatEmbedCodeLabel: string
    zaloChatEmbedCodeLabel: string
    embedCodePlaceholder: string
    copyNanoaiEmbedButton: string
    copyFacebookChatEmbedButton: string
    copyZaloChatEmbedButton: string
    addAnotherWorkspace: string
    cancelAddWorkspace: string
    deleteWorkspaceButton: string
    deleteWorkspaceConfirm: string
    deleteWorkspaceSuccess: string
    /** Xóa workspace: OTP + lên lịch */
    deleteWorkspaceOtpIntro: string
    deleteWorkspaceOtpSend: string
    deleteWorkspaceOtpLabel: string
    deleteWorkspaceOtpConfirm: string
    deleteWorkspaceScheduledBanner: string
    deleteWorkspaceCancelSchedule: string
    deleteWorkspaceOtpSentToast: string
    deleteWorkspaceScheduleCancelled: string
    teamStaffSectionTitle: string
    teamStaffSectionHint: string
    badgeStaffWorkspace: string
    teamInviteEmailLabel: string
    teamInviteEmailPlaceholder: string
    teamInviteButton: string
    teamStaffListTitle: string
    teamRemoveMember: string
    teamSavePermissions: string
    teamInviteErrorNotFound: string
    teamInviteErrorBadEmail: string
    teamInviteErrorOwner: string
    teamInviteOk: string
    teamStaffRestrictedNote: string
    teamPermInbox: string
    teamPermOrders: string
    teamPermInventory: string
    teamPermAiSettings: string
    teamPermWorkspaceBranding: string
    teamPermWorkspacePayment: string
    teamPermIntegrationsChannels: string
    teamPermIntegrationsAnalytics: string
    teamPermUsageReports: string
    /** Staff có quyền analytics chỉ xem Pixel/GA4; chỉ chủ được lưu. */
    integrationsAnalyticsOwnerOnly: string
    teamRemoveMemberConfirm: string
    fbLinkedLine: string
    zaloLinkedLine: string
    credentialsKeepHint: string
    /** Bố cục trang: cột cấu hình */
    setupColumnTitle: string
    /** Bố cục trang: cột chat */
    chatColumnTitle: string
    /** Nút/link tới /dashboard/messaging/settings */
    messagingSettingsLink: string
    messagingSettingsPageTitle: string
    messagingInboxDescription: string
    noWorkspaceInboxCta: string
    goToInbox: string
    /** Nút quay lại danh sách hội thoại (inbox shop, mobile) */
    inboxMobileBackAria: string
    /** Link tới /dashboard/api-integration */
    apiIntegrationGuideLink: string
    apiIntegrationGuideShort: string
    /** /dashboard/messaging/settings — thẻ dẫn sang trang tích hợp API (nhúng/keys không còn trên trang này) */
    messagingSettingsApiHubCardTitle: string
    messagingSettingsApiHubCardBody: string
    /** Hướng dẫn tạo workspace shop chăm sóc khách (đa ngôn ngữ) */
    customerCareShopSetupGuideTitle: string
    customerCareShopSetupGuideBody: string
  }
  /** /dashboard/messaging/orders — đơn tạo từ widget chat */
  partnerMessagingOrders: {
    pageTitle: string
    pageDescription: string
    introLine: string
    allWorkspaces: string
    allStatuses: string
    searchPlaceholder: string
    exportExcel: string
    exportExcelTitle: string
    reload: string
    filterCreatedFrom: string
    filterCreatedTo: string
    summaryTitle: string
    summaryDescription: string
    statOrders: string
    statSubtotal: string
    statSubtotalHint: string
    statRequired: string
    statRequiredHint: string
    statPaid: string
    statPaidHint: string
    statOutstanding: string
    statOutstandingHint: string
    statusAwaitingPayment: string
    statusPaymentChecking: string
    statusPaidVerified: string
    statusPendingManualReview: string
    statusCancelled: string
    emptyList: string
    emptyFiltered: string
    shippingPending: string
    shippingConfirmed: string
    shippingPacking: string
    shippingShipping: string
    shippingDelivered: string
    shippingReturned: string
    shippingCancelled: string
    proofVerified: string
    proofManualReview: string
    proofFailed: string
    proofPending: string
    proofNone: string
    labelWorkspace: string
    labelCustomer: string
    labelEmail: string
    labelAddress: string
    labelProduct: string
    labelMoneyPrefix: string
    /** {subtotal}{required}{paid} — đã format tiền */
    moneyLine: string
    openProduct: string
    openProofImage: string
    openInbox: string
    openChat: string
    orderLocked: string
    notePlaceholder: string
    btnConfirmPaid: string
    btnMarkManualReview: string
    btnCancelOrder: string
    btnViewTimeline: string
    timelineTitle: string
    timelinePickOrder: string
    timelineNoEvents: string
    timelineLoading: string
    toastStatusUpdated: string
    toastShippingUpdated: string
    /** {count} {filename} */
    toastExportDone: string
    /** Tiền cọc so với mức yêu cầu */
    depositNone: string
    depositPartial: string
    depositFull: string
    /** Kênh thanh toán cọc — dùng `{shop}` = tên shop. */
    pathSepay: string
    pathManual: string
    /** Gợi ý đối soát tự động — `{shop}` = tên shop. */
    sepayAutoHint: string
    /** Biên lai ảnh — dạng ngắn trên dải tóm tắt */
    proofReceiptShortVerified: string
    proofReceiptShortPending: string
    proofReceiptShortFailed: string
    proofReceiptShortManual: string
    proofReceiptShortNone: string
    /** Tab tóm tắt theo giai đoạn xử lý đơn (bảng shop) */
    tabAll: string
    tabAwaitDeposit: string
    tabAwaitShip: string
    tabAwaitReceive: string
    tabReceived: string
    tabReviewed: string
    tabCancelled: string
    tableColOrderCode: string
    tableColConsulted: string
    tableColCustomer: string
    tableColSubtotal: string
    /** Theo cấu hình đơn (khoản cọc / thanh toán ngay) */
    tableColDepositRequired: string
    /** Đã ghi nhận thanh toán */
    tableColPaidAmount: string
    /** max(0, tổng tiền hàng − đã thanh toán) */
    tableColDueOnDelivery: string
    tableColStatus: string
    tableColOrderDate: string
    tableColActions: string
    filterShippingLabel: string
    filterPaymentShort: string
    clearTableFilters: string
    consultedAria: string
    reviewedAria: string
    expandRow: string
    collapseRow: string
    listCapNote: string
    consultLocalHint: string
    badgePayAwaiting: string
    badgePayPartial: string
    badgePayDone: string
    btnConfirmDeposit: string
    tableDetails: string
    /** Modal chi tiết đơn — `{id}` = UUID đơn */
    modalTitle: string
    modalInternalIdLine: string
    modalConsultedCustomer: string
    modalPaymentHeading: string
    modalOrderTotal: string
    modalDepositNeed: string
    modalDepositDeposited: string
    modalCodAfterDeposit: string
    modalProductsHeading: string
    modalColImage: string
    modalColProduct: string
    modalCopyAddress: string
    toastAddressCopied: string
    toastAddressCopyFailed: string
    modalSkuPrefix: string
    modalColor: string
    modalSize: string
    modalQty: string
    modalOrderUnavailable: string
    modalOrderNoteLabel: string
    modalShippingAddressHeading: string
    modalContactSectionTitle: string
  }
  /** /dashboard/messaging — trợ lý AI (chờ nhân viên + LLM / kho) */
  partnerMessagingAi: {
    panelTitle: string
    panelSubtitle: string
    tabSettings: string
    tabInventory: string
    /** Tab thống kê token API LLM */
    tabUsage: string
    usagePeriodLabel: string
    usagePeriodDay: string
    usagePeriodWeek: string
    usagePeriodMonth: string
    usagePeriodScopeDay: string
    usagePeriodScopeWeek: string
    usagePeriodScopeMonth: string
    /** Chế độ: lăn vs chọn ngày UTC */
    usageRangeModeLabel: string
    usageRangeModeRolling: string
    usageRangeModeCalendar: string
    usageCalendarFromLabel: string
    usageCalendarToLabel: string
    /** {from} {to} ngày YYYY-MM-DD UTC */
    usagePeriodScopeCalendar: string
    usageSectionCreditTitle: string
    usageSectionCreditIntro: string
    usageSectionApiTitle: string
    usageSectionApiIntro: string
    /** {scope} = usagePeriodScopeDay | Week | Month */
    tokenUsageIntro: string
    tokenUsageEmpty: string
    tokenUsageColProvider: string
    tokenUsageColModel: string
    tokenUsageColCalls: string
    tokenUsageColPrompt: string
    tokenUsageColCompletion: string
    tokenUsageColTotal: string
    /** Ước tính chi phí (VNĐ) theo bảng giá tham khảo — cột bảng token theo model */
    tokenUsageColEstimatedCost: string
    /** Đoạn giải thích + tỷ giá; có thể ghi env PARTNER_AI_TOKEN_COST_USD_TO_VND */
    tokenUsageCostDisclaimer: string
    /** Tổng ước tính; placeholder {amount} = số VNĐ định dạng */
    tokenUsageEstimatedTotalLabel: string
    /** Tổng chi tiết từng lần gọi; placeholder {amount} */
    tokenUsageDetailEstimatedTotalLabel: string
    /** Gom theo usage_kind (inbox / material_infer / …) */
    tokenUsageByKindTitle: string
    tokenUsageByKindIntro: string
    /** Gom theo ngày UTC */
    tokenUsageByDayTitle: string
    tokenUsageByDayIntro: string
    tokenUsageColDay: string
    /** Chi tiết usage_kind + model + chi phí ước tính */
    tokenUsageCostByKindAndModelTitle: string
    tokenUsageCostByKindAndModelIntro: string
    /** Gộp theo tuần (bắt đầu thứ Hai UTC) trong khoảng đã chọn */
    tokenUsageCostByWeekTitle: string
    tokenUsageCostByWeekIntro: string
    tokenUsageColWeekStart: string
    /** Gộp theo tháng lịch UTC (YYYY-MM) trong khoảng đã chọn */
    tokenUsageCostByMonthTitle: string
    tokenUsageCostByMonthIntro: string
    tokenUsageColMonthUtc: string
    /** Gợi ý khi có bảng chi phí theo nhánh/ngày/tuần/tháng */
    tokenUsageCostTablesNote: string
    usageDetailApiTitle: string
    usageDetailApiIntro: string
    usageDetailColTime: string
    usageDetailColUsageKind: string
    usageTokenKindInbox: string
    usageTokenKindMaterialInfer: string
    usageDetailEmpty: string
    usageCreditLedgerTitle: string
    usageCreditLedgerIntro: string
    usageCreditLedgerEmpty: string
    usageCreditColType: string
    usageCreditColAmount: string
    usageCreditColCount: string
    usageCreditDetailTitle: string
    usageCreditColWhen: string
    usageCreditColSingle: string
    usageLogoCreditTitle: string
    usageLogoCreditIntro: string
    usageLogoCreditEmpty: string
    usageLogoColModel: string
    usageLogoColStatus: string
    usageNoOwnerHint: string
    usageEmbedImageTitle: string
    usageEmbedImageIntro: string
    usageEmbedImageEmpty: string
    usageEmbedTextTitle: string
    usageEmbedTextIntro: string
    usageEmbedTextEmpty: string
    usageEmbedTextSourceQuery: string
    usageEmbedColSource: string
    usageEmbedSourceInventory: string
    usageEmbedSourceGuest: string
    usageEmbedColPromptSum: string
    usageEmbedColTotalSum: string
    usageEmbedDetailTitle: string
    usageEmbedColInventoryId: string
    /** Thống kê Gemini tạo ảnh (chất liệu / thực tế) — tab Token API */
    usageImageGenTitle: string
    usageImageGenIntro: string
    usageImageGenEmpty: string
    usageImageGenColKind: string
    usageImageGenKindMaterial: string
    usageImageGenKindRealUse: string
    usageImageGenColCalls: string
    usageImageGenColTotalTokens: string
    usageImageGenTotalCallsLabel: string
    /** Tên gọi nội bộ / sản phẩm cho Gemini tạo ảnh inbox */
    usageNanoBananaBadge: string
    /** Gợi ý model — tab Token */
    usageNanoBananaModelHint: string
    /** Thống kê lượt gọi; placeholder {calls} */
    usageNanoBananaStatCalls: string
    /** Thống kê token; placeholder {tokens} */
    usageNanoBananaStatTokens: string
    enableLabel: string
    enableHint: string
    delayLabel: string
    delayHint: string
    typingMinLabel: string
    typingMaxLabel: string
    typingHint: string
    productConsultationContextLabel: string
    productConsultationContextHint: string
    productConsultationContextPlaceholder: string
    disclosureToggle: string
    disclosureSuffixLabel: string
    disclosureSuffixHint: string
    saveSettings: string
    loadError: string
    faqKeywordsLabel: string
    faqKeywordsHint: string
    faqAnswerLabel: string
    faqSortLabel: string
    faqActiveLabel: string
    inactiveBadge: string
    addFaq: string
    saveRow: string
    deleteRow: string
    cancelEdit: string
    inventoryName: string
    inventorySku: string
    inventoryDesc: string
    inventoryStock: string
    inventoryPrice: string
    inventorySort: string
    inventoryImageUrl: string
    inventoryImageUrlHint: string
    inventoryProductUrl: string
    inventoryProductUrlHint: string
    inventoryProductVideoUrl: string
    inventoryProductVideoUrlHint: string
    inventoryOpenProductPage: string
    inventoryOpenProductVideo: string
    /** Link /messaging/p/{slug}?ctx_* — mở chat tư vấn kèm ảnh SP */
    inventoryGuestConsultLink: string
    inventoryGuestConsultLinkHint: string
    inventoryGuestConsultLinkNeedSave: string
    inventoryGuestConsultLinkCopied: string
    inventoryConsultNote: string
    inventoryConsultNoteHint: string
    inventoryDescHint: string
    inventoryStockHint: string
    inventoryFieldsGuide: string
    /** Nút/link tới /dashboard/api-integration — Open Catalog */
    inventoryOpenApiLink: string
    inventoryOpenApiHint: string
    inventoryDownloadTemplate: string
    inventoryExportExcel: string
    inventoryImportExcel: string
    inventoryImportReplaceWarning: string
    /** {count} tổng dòng; {inserted} thêm mới; {updated} cập nhật; {deleted} đã xóa */
    inventoryImportSuccess: string
    inventoryImportFailed: string
    /** Tiến trình nhập Excel: đang gửi file (có thể kèm % trên UI) */
    inventoryExcelImportUploading: string
    /** Trình duyệt không báo được % — thanh không xác định */
    inventoryExcelImportSending: string
    inventoryErrInvalidXlsx: string
    inventoryErrEmptySheet: string
    inventoryErrMissingName: string
    inventoryErrNoRows: string
    inventoryErrNoFile: string
    inventoryErrFileTooLarge: string
    inventoryErrTooManyRows: string
    inventoryLoadMore: string
    /** Tìm kho bằng vector (tab Kho) */
    inventoryVectorSearchPlaceholder: string
    inventoryVectorSearchHint: string
    inventoryVectorSearchByText: string
    inventoryVectorSearchByImage: string
    inventoryVectorSearchClear: string
    inventoryVectorSearching: string
    inventoryVectorSearchFailed: string
    inventoryVectorSearchNoResults: string
    addInventory: string
    edit: string
    emptyFaq: string
    emptyInventory: string
    /** {count} = số dòng kho */
    inventoryProductCountSummary: string
    inventoryEmbeddingTitle: string
    inventoryEmbeddingSummary: string
    inventoryEmbeddingSyncNow: string
    inventoryEmbeddingSyncRunning: string
    inventoryEmbeddingSyncDoneTitle: string
    inventoryEmbeddingSyncDoneBody: string
    /** Gợi ý: đồng bộ tự động khi mở trang + cron nền */
    inventoryEmbeddingAutoHint: string
    inventoryTextEmbeddingTitle: string
    inventoryTextEmbeddingSummary: string
    inventoryTextEmbeddingAutoHint: string
    cronSetupHint: string
    /** Trạng thái nút gạt AI */
    toggleStatusOn: string
    toggleStatusOff: string
    aiEngineTitle: string
    /** Placeholder {model} = DEEPSEEK_MODEL hoặc mặc định */
    aiEngineDescription: string
    disclosureSwitchOn: string
    disclosureSwitchOff: string
    /** FAQ mẫu: giới thiệu dưới tab FAQ */
    faqPresetsIntro: string
    faqPresetSaveHint: string
    faqPresetAnswerRequired: string
    faqCustomSectionTitle: string
    faqCustomSectionIntro: string
    faqCustomAddTitle: string
    faqCustomQuestionLabel: string
    faqCustomQuestionHint: string
    faqCustomKeywordsRequired: string
    faqPresetQuestions: {
      stock: string
      shipping: string
      price: string
      size_fit: string
      payment: string
      return_policy: string
      order_track: string
      warranty: string
      authentic: string
      promo: string
    }
    visionSearchTitle: string
    visionSearchHint: string
    visionSearchEnable: string
    /** Chọn quốc gia shop → gợi ý vùng Vision */
    visionShopCountryLabel: string
    visionShopCountryHint: string
    visionShopCountryCustom: string
    visionShopCountryAdvancedHint: string
    visionLocationLabel: string
    visionCategoryLabel: string
    visionBucketOverrideLabel: string
    visionBucketOverrideHint: string
    /** {total} mặt hàng kho; {withImage} dòng URL ảnh https */
    visionWarehouseInventorySummary: string
    visionCatalogSyncStatsTitle: string
    /** {n} = số dòng */
    visionCatalogSyncStatsLineSynced: string
    visionCatalogSyncStatsLinePending: string
    visionCatalogSyncStatsLineNoHttps: string
    visionCatalogSyncStatsLineExcluded: string
    visionCatalogSyncStatsExplain: string
    visionSyncButton: string
    /** Gợi ý dưới nút đồng bộ: bật tính năng → tự đồng bộ nhiều lượt có giới hạn */
    visionSyncAutoWhenEnableHint: string
    visionSyncing: string
    visionSyncOk: string
    visionIndexReady: string
    visionIndexNotReady: string
    visionLastSynced: string
    visionSyncErrorLabel: string
    visionWarehouseReindexPending: string
    visionWarehouseCorpusUnsupportedType: string
    visionProductSearchMaintenanceTitle: string
    visionProductSearchMaintenanceDetail: string
    visionSyncToastImported: string
    visionSyncToastRemoved: string
    visionSyncToastMore: string
    visionSyncToastIdle: string
    /** Placeholder {n} = số lượt gọi API đồng bộ trong một chuỗi */
    visionSyncChainedRounds: string
    visionSyncChainedStoppedMaxRounds: string
    visionSyncChainedStoppedTimeout: string
    /** Chạm trần tuyệt đối số lượt — cần bấm đồng bộ hoặc kiểm tra lỗi */
    visionSyncChainedAbortedSafety: string
    /** Đồng bộ catalog Vision nền (cron VPS) */
    visionBgSyncTitle: string
    visionBgSyncHint: string
    visionBgSyncButton: string
    visionBgSyncUseResumeHint: string
    visionBgSyncCancel: string
    visionBgSyncDismiss: string
    visionBgSyncStatusQueued: string
    visionBgSyncStatusRunning: string
    visionBgSyncStatusDone: string
    visionBgSyncStatusError: string
    visionBgSyncStatusIdle: string
    visionBgSyncReportTitle: string
    visionBgSyncFieldRounds: string
    visionBgSyncFieldImported: string
    visionBgSyncFieldRemoved: string
    visionBgSyncFieldHasMore: string
    visionBgSyncFieldLastScanned: string
    visionBgSyncFieldStopped: string
    visionBgSyncFieldMessage: string
    visionBgSyncFieldServerError: string
    visionBgSyncBoolYes: string
    visionBgSyncBoolNo: string
    visionBgSyncPollingNote: string
    /** Tiến trình đăng chỉ mục Google (job queued/running) */
    visionBgSyncProgressTitle: string
    /** {imported} {total} */
    visionBgSyncProgressRatio: string
    visionBgSyncProgressHint: string
    visionBgSyncProgressNoImageRows: string
    /** Giải thích 0% khi queued — chưa có cron / chưa chạy lượt xử lý */
    visionBgSyncQueuedExplain: string
    /** POST trang cài đặt khi auto-refresh */
    visionBgSyncPostRefreshExplain: string
    visionBgSyncRunSliceButton: string
    visionBgSyncRunSliceHint: string
    /** {rounds} {partners} */
    visionBgSyncRunSliceOk: string
    visionBgSyncEnqueueOk: string
    visionBgSyncToastDone: string
    visionBgSyncToastError: string
    visionBgSyncAlreadyActive: string
    visionBgSyncAlreadyActiveRefreshHint: string
    visionBgSyncEnableVisionFirst: string
    visionBgSyncSaveSettingsFirst: string
    /** Map stoppedReason trong JSON báo cáo cron */
    visionBgSyncStopCompleted: string
    visionBgSyncStopError: string
    visionBgSyncStopCronSlice: string
    visionBgSyncStopBadCursor: string
    visionBgSyncServerErrCursor: string
    visionBgSyncMsgCompleted: string
    visionBgSyncMsgInProgress: string
    visionBgSyncMsgBadCursor: string
    visionHealthPanelTitle: string
    visionHealthStatusHealthy: string
    visionHealthStatusWarning: string
    visionHealthStatusStuck: string
    visionHealthStatusIdle: string
    visionHealthPendingCount: string
    visionHealthChecksumDone: string
    visionHealthLockAge: string
    visionHealthLockBusy: string
    visionHealthLockFree: string
    visionHealthLockOwner: string
    visionHealthOwnerUnknown: string
    visionHealthHeartbeatAge: string
    visionHealthHeartbeatAlive: string
    visionHealthHeartbeatNone: string
    visionHealthLastProgress: string
    visionHealthLastProgressNone: string
    visionHealthUnlockButton: string
    visionHealthUnlockOk: string
    visionEmergencyDisableButton: string
    visionEmergencyDisableConfirm: string
    visionEmergencyDisableOk: string
    /** Xóa dòng kho → tự gỡ Vision (thay cho file danh sách gỡ) */
    visionInventoryDeleteRemovesIndexNote: string
    imageSearchApiTitle: string
    imageSearchApiHint: string
    imageSearchApiEnable: string
    imageSearchApiKeyConfigured: string
    imageSearchApiKeyMissing: string
    imageSearchApiEndpointLabel: string
    imageSearchApiBaseUrlNote: string
    imageSearchApiDocHint: string
    imageSearchApiGenerate: string
    imageSearchApiGenerating: string
    imageSearchApiKeyCreated: string
    /** Link tới /dashboard/api-integration#partner-api-keys */
    imageSearchApiManageKeysLink: string
    guestPurchaseFlowLabel: string
    guestPurchaseFlowHint: string
    guestPurchaseFlowInChat: string
    guestPurchaseFlowExternal: string
  }
  /** /messaging/p/[slug] — khách chat với shop trên domain NanoAI */
  partnerGuestChat: {
    notFoundTitle: string
    notFoundDescription: string
    pageTitleSuffix: string
    metaDescription: string
    shopLabel: string
    subline: string
    placeholder: string
    send: string
    emptyThread: string
    loadError: string
    sendError: string
    pollNote: string
    guestAttachPhoto: string
    guestTakePhoto: string
    guestRemoveAttachment: string
    guestUploading: string
    guestImageTooLarge: string
    guestImageInvalidType: string
    guestCaptionHint: string
    loginPromptTitle: string
    loginPromptDescription: string
    signInWithGoogle: string
    linkMyShops: string
    /** Nút mở dialog đơn widget (cùng `messagingMyOrders`). */
    linkMyOrders: string
    /** Thanh công cụ widget nhúng / sheet giỏ — ngắn gọn. */
    widgetShoppingCart: string
    /** `aria-label` cho ô chọn ngôn ngữ (select) trên thanh widget. */
    widgetLanguageSelectAria: string
    sendKeyboardHint: string
    tryOnOpen: string
    tryOnTitle: string
    tryOnModelPhoto: string
    tryOnGarmentPhoto: string
    tryOnGarmentSourceTitle: string
    tryOnGarmentSourceDevice: string
    tryOnGarmentSourceRecent: string
    tryOnGarmentRecentEmpty: string
    tryOnGenerate: string
    tryOnGenerateWithCost: string
    tryOnPreparing: string
    tryOnNeedBoth: string
    tryOnGarmentLimitReached: string
    tryOnGarmentItemsLabel: string
    tryOnFailed: string
    tryOnReady: string
    tryOnChargedToast: string
    tryOnCreditsBalanceLabel: string
    tryOnTopUpCredits: string
    /** Sau thử đồ: mở lại dialog ảnh lớn từ ô soạn tin. */
    tryOnResultViewLarge: string
    /** Tải ảnh kết quả thử đồ trong dialog xem lớn. */
    tryOnResultDownload: string
    /** Nhãn ảnh trang phục khi widget tự điền từ ctx_image (không có SKU). */
    tryOnEmbedGarmentFromPage: string
    /** Nhãn khi có SKU — placeholder {sku}. */
    tryOnEmbedGarmentFromPageWithSku: string
    /** Mở từ widget data-primary=try_on: nhắc ảnh người / SP / credits trong iframe. */
    tryOnEmbedOnlyFlowHint: string
    /** Dialog đăng nhập OTP khi cần ví credit (thử đồ / nạp). */
    guestCreditWalletLoginTitle: string
    guestCreditWalletLoginDescription: string
    toastGuestTopUpLoginRequired: string
    toastTryOnInsufficientCredits: string
    guestAuthPromptTitle: string
    guestAuthPromptBody: string
    guestAuthEmailPlaceholder: string
    guestAuthSendMagicLink: string
    guestAuthSendOtp: string
    guestAuthOtpPlaceholder: string
    guestAuthVerifyOtp: string
    guestAuthRequiredAfterLimit: string
    guestAuthEmailSent: string
    guestAuthOtpInvalid: string
    guestAuthRateLimited: string
    /** Checkbox «tin cậy thiết bị» (OTP guest). */
    guestAuthRememberDeviceHint: string
    /** Đang chờ verify OTP (dialog / inline). */
    guestAuthVerifyingProgress: string
    /** Hiển thị khi shop/AI đang chuẩn bị trả lời sau tin của khách */
    shopTypingHint: string
    /** Khi mở link tư vấn — chờ gửi tin (vector + lời mở đầu) hiển thị */
    consultLinkShopPreparingHint: string
    /** Shop AI — tin cố định + carousel mẫu khác (vector kho). VI dùng anh/chị khi chưa có giới tính; có giới tính → `enforceConfiguredGenderAddressing`. */
    similarAlternativesTemplateMessage: string
    productSearchTemplateMessage: string
    visionPickHint: string
    visionPickBusy: string
    visionPickError: string
    visionProductLink: string
    /** Thẻ SP sau khi đã bấm «tư vấn» — mở form đặt hàng */
    visionProductBuy: string
    /** Mở trang sản phẩm trên thẻ (phía trên Tư vấn / Mua hàng) */
    visionProductViewDetails: string
    /** Ô video cạnh ảnh trên thẻ (khi kho có video) */
    visionProductVideo: string
    /** a11y đóng dialog video toàn màn hình */
    visionVideoCloseAria: string
    /** Nút mở danh sách sản phẩm đã xem / quan tâm gần đây */
    productShelfButton: string
    /** Chip tùy chọn: gửi ngữ cảnh SP từ trang (thumbnail) — không tự gửi khi mở chat */
    urlProductContextChipLabel: string
    urlProductContextChipAria: string
    /** Nút X đóng chip — không gửi ngữ cảnh SP từ trang */
    urlProductContextChipDismissAria: string
    productShelfTitle: string
    productShelfEmpty: string
    /** Tìm trên kệ SP (vector) */
    productShelfSearchPlaceholder: string
    productShelfSearchButton: string
    productShelfSearchImage: string
    productShelfSearchClear: string
    productShelfSearching: string
    productShelfSearchFailed: string
    productShelfSearchNoResults: string
    /** Nút «Mua» ngắn trên kệ SP (sau khi đã tư vấn) */
    productShelfBuy: string
    /** Toast khi chế độ mua trên web — đã mở tab */
    purchaseOpenSiteToast: string
    /** Chế độ web nhưng thiếu URL sản phẩm */
    purchaseMissingProductUrlToast: string
    /** Ghép «mã sản phẩm …» khi có SKU — thay `{sku}`. */
    productConsultProductRefFromSku: string
    /** Khi không có SKU — thay `{name}` (tên mẫu). */
    productConsultProductRefFromName: string
    /** Khách bấm Tư vấn (ưu tiên hỏi ship) — `{productRef}` từ hai chuỗi trên. */
    productConsultAskShipping: string
    /** Khách bấm Tư vấn (chung) — `{productRef}`. */
    productConsultAskDetail: string
    /** Khách bấm Tư vấn khi có SKU — thay `{sku}`. */
    productConsultAskDetailFromSku: string
    /** Mở chat từ link có ctx_inventory nhưng không có ctx_sku — không hiển thị UUID trong bubble (shop vẫn nhận trong pageContext). */
    pageContextInboundConsultNoSku: string
    /** Chỉ gửi ảnh ngữ cảnh, không có mã SP. */
    pageContextInboundImageOnlyNote: string
    guestProfileDialogTitle: string
    guestProfileDialogDescription: string
    guestProfileBirthLabel: string
    guestProfileBirthDayPlaceholder: string
    guestProfileBirthMonthPlaceholder: string
    guestProfileBirthYearPlaceholder: string
    guestProfileGenderLabel: string
    guestProfileGenderMale: string
    guestProfileGenderFemale: string
    guestProfileSave: string
    guestProfileRemindLater: string
    guestProfileInvalid: string
  }
  /** /messaging/my-chats — danh sách shop đã chat (tài khoản Google) */
  messagingMyChats: {
    pageTitle: string
    pageDescription: string
    emptyList: string
    openChat: string
    lastActivity: string
    loadFailed: string
    backHomeAria: string
  }
  /** /messaging/my-orders — đơn widget khi user đã liên kết tài khoản */
  messagingMyOrders: {
    pageTitle: string
    /** Nút «Đơn hàng» ngắn trên thanh nhập chat nhúng (khác `pageTitle` modal). */
    composerOrdersLabel: string
    pageDescription: string
    emptyList: string
    loadFailed: string
    backHomeAria: string
    openChat: string
    createdAt: string
    totalLabel: string
    payStatus: string
    shipStatus: string
    stAwaiting: string
    stChecking: string
    stPaid: string
    stManual: string
    stCancelled: string
    shPending: string
    shConfirmed: string
    shPacking: string
    shShipping: string
    shDelivered: string
    shReturned: string
    shCancelled: string
    orderIdLabel: string
    transferMemoLabel: string
    qtyLabel: string
    colorLabel: string
    sizeLabel: string
    noteLabel: string
    unitPriceLabel: string
    depositPctLabel: string
    amountDueLabel: string
    paidRecordedLabel: string
    /** Còn lại phải trả khi nhận hàng ≈ tổng đơn − đã ghi nhận */
    balanceOnDeliveryLabel: string
    shipToLabel: string
    productPhotoAlt: string
    /** Ảnh thumbnail màu/mẫu (palette) khách đã chọn — phần tiêu đề nhỏ phía trên lưới ảnh. */
    variantImagesSectionLabel: string
    /** Dòng tóm tắt khi có ≥2 mẫu: «Tổng số lượng: N». */
    totalQtySummaryLabel: string
    viewTimelineButton: string
    timelineTitle: string
    timelineLoadFailed: string
    timelineEmpty: string
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
  /** Trang /cai-dat-hien-thi-ket-qua-anh — cách hiển thị Trước/Sau */
  imageResultDisplay: {
    pageTitle: string
    pageIntro: string
    modeSplitTitle: string
    modeSplitDesc: string
    modeCompareTitle: string
    modeCompareDesc: string
    persistNote: string
  }
  /** Trang /dashboard/tasks — tác vụ & hàng đợi thống nhất */
  taskHub: {
    pageTitle: string
    pageDescription: string
    sectionRunning: string
    sectionRecent: string
    emptyRunning: string
    emptyRecent: string
    openTool: string
    batchSummary: string
    itemsCount: string
    worksheetSection: string
    worksheetParseSgk: string
    worksheetQuiz: string
    worksheetEssay: string
    worksheetUnknownType: string
    statusProcessing: string
    statusFailed: string
    statusCompleted: string
    statusCancelled: string
    statusMixed: string
    hintTranslateProgress: string
    linkProcessedImages: string
    linkTranslateHistory: string
    /** Link tới /dich-anh-tai-lieu/tien-trinh */
    linkTranslateProgress: string
    /** Gợi ý dưới tiêu đề khi bật poll client */
    autoRefreshNote: string
  }
  /** /ghi-am-bao-cao-cuoc-hop — ghi âm miễn phí, trừ credit khi tạo báo cáo AI */
  meetingRecorder: {
    cardTitle: string
    cardDescription: string
    freeRecordingNote: string
    /** Ghi âm tự dừng khi không có tiếng nói đủ lâu */
    silenceAutoStopNote: string
    /** Toast khi hệ thống tự dừng vì im lặng */
    autoStoppedBySilence: string
    /** Cứ ~5 phút tự ngắt đoạn và ghi tiếp trên client */
    segmentAutoSplitNote: string
    /** Toast khi vừa xoay đoạn 5 phút */
    segmentRotatedToast: string
    chargeNote: string
    /** {days} — số ngày lưu trên máy chủ */
    sessionNote: string
    meetingTitleLabel: string
    meetingTitlePlaceholder: string
    savingRecording: string
    saveRecordingFailed: string
    retrySaveRecording: string
    needServerRecording: string
    startRecording: string
    stopRecording: string
    stopRecordingConfirmTitle: string
    stopRecordingConfirmDescription: string
    stopRecordingConfirmOk: string
    stopRecordingConfirmContinue: string
    recording: string
    idleHint: string
    /** Đang ghi — {duration} mm:ss */
    recordingTimeLabel: string
    durationLabel: string
    createNewMeeting: string
    /** Tooltip khi đang ghi — nút tạo cuộc họp mới bị tắt */
    stopBeforeNewMeeting: string
    downloadRecording: string
    generateReport: string
    reportLanguageLabel: string
    estimatedCost: string
    costExplain: string
    needRecording: string
    processing: string
    reportHeading: string
    briefReportHeading: string
    fullReportHeading: string
    transcriptHeading: string
    copy: string
    copied: string
    downloadMd: string
    downloadBriefMd: string
    micError: string
    fileTooLarge: string
    genericError: string
    insufficientCredits: string
  }
  /** /flow-nhac-video-veo — video âm nhạc: Gemini Flash lời → nhiều clip Veo 8s độc lập */
  flowMusicVeo: {
    pageTitle: string
    metaDescription: string
    headline: string
    subtitle: string
    stepLyricsTitle: string
    stepLyricsBody: string
    lyricsModeLabel: string
    lyricsModeAllAtOnce: string
    lyricsModeProgressive: string
    lyricsProgressiveHelp: string
    /** {k} */
    openNextLyricsSegmentButton: string
    segmentVideoSubBlockHint: string
    progressiveStyleOnlyInStep1Note: string
    progressiveExtendStyleLockedNote: string
    lyricsGenreOnlyHelp: string
    veoStyleFieldsIntro: string
    progressiveVideoSectionTitle: string
    /** {k}{n} */
    generateNextSegmentButton: string
    /** {k}{n} */
    successLyricsOneSegment: string
    incrementalPlanFrozenHelp: string
    lyricsModeFrozenHint: string
    progressiveNoNextSegment: string
    hintLabel: string
    hintPlaceholder: string
    lyricsImageHelp: string
    generateLyricsButton: string
    generatingLyrics: string
    lyricsNeedHintOrImage: string
    successLyrics: string
    /** {n} */
    successLyricsBlocks: string
    lyricsBlockCountLabel: string
    lyricsBlockCountHelp: string
    openingLyricsLabel: string
    openingLyricsHelp: string
    fillOpeningButton: string
    assignOpeningToSegment1: string
    styleBlockTitle: string
    styleBlockBody: string
    genreLabel: string
    voiceGenderLabel: string
    voiceTimbreLabel: string
    voiceLangLabel: string
    bpmLabel: string
    structureLabel: string
    densityLabel: string
    videoBlockTitle: string
    videoBlockBody: string
    aspectLabel: string
    aspect169: string
    aspect916: string
    framesLabel: string
    framesHelpSingle: string
    framesHelpMulti: string
    visualExtraLabel: string
    visualExtraPlaceholder: string
    createClip8s: string
    creatingClip: string
    clip720Note: string
    needImage: string
    previewTitle: string
    downloadMp4: string
    /** {n} */
    segmentIndexLabel: string
    createSegment1VideoButton: string
    /** Dưới video vừa tạo — mở đoạn lời + thông số rồi nối Veo */
    addEightMoreVideoButton: string
    addEightMoreVideoHelp: string
    /** {k} */
    extendSegmentVideoButton: string
    /** {k} */
    extendingVeoSegmentBusy: string
    videoSequentialBlockIntro: string
    videoImagesOnlyStep3Note: string
    previewInStep4Note: string
    videoForSegmentLockedNote: string
    /** {k} */
    successExtendSegment: string
    /** {n} */
    partialSegmentsFail: string
    startOver: string
    veoAudioNote: string
    successClip: string
    segmentCountLockedHelp: string
    lyricsLockedNote: string
    segmentsCountSyncedNote: string
    /** {n}{seconds} */
    videoAfterSegmentLabel: string
    /** {n} */
    downloadMp4Step: string
    extendPerStepSectionTitle: string
    extendPerStepSectionBody: string
    /** {to} */
    extendBridgeLabel: string
    extendSegmentVisualLabel: string
    cameraHintLabel: string
    cameraHintPlaceholder: string
    characterStoryLabel: string
    characterStoryPlaceholder: string
    standaloneFramesNote: string
    mergeClipsSectionTitle: string
    mergeClipsSectionHelp: string
    mergeClipsButton: string
    mergingClips: string
    successMergedClip: string
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
    /** Chỉ mobile: mở /tao-bai-tap-ve-nha */
    mobileCreateHomework: string
    /** Hub + /lop/[id]/gan-phieu — tiêu đề thẻ: bài tập về nhà gắn lớp */
    assignWorksheet: string
    /** /lop/[id]/gan-phieu — chưa có phiên homework nào gắn lớp */
    classHomeworkListEmpty: string
    /** Nút/link tới /tao-bai-tap-ve-nha */
    classHomeworkListCreateCta: string
    /** Mở /lam-bai/[code] cho học sinh */
    classHomeworkOpenLamBai: string
    /** /lop/.../gan-phieu — gắn phiên bài tập về nhà sang lớp khác */
    classHomeworkAttachOtherClassButton: string
    classHomeworkAttachPickTitle: string
    classHomeworkAttachPickDescription: string
    classHomeworkAttachSessionLabel: string
    /** HS /lop/.../phieu-bai-tap — chưa có phiên bài tập về nhà (exam session) */
    classStudentHomeworkSessionsEmpty: string
    noWorksheets: string
    doWorksheet: string
    submit: string
    submitSuccess: string
    viewResult: string
    quizScore: string
    sampleAnswer: string
    submissions: string
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
    /** GV: nhóm phiên thi có chấm điểm (tách khỏi bài tập về nhà) */
    classExamsSubsectionGraded: string
    /** GV: nhóm bài tập về nhà (HS không xem điểm công khai) */
    classExamsSubsectionPracticeHomework: string
    /** HS: đã nộp bài tập về nhà — không hiển thị điểm trên danh sách lớp */
    studentClassHomeworkSubmittedCaption: string
    /** Nhãn nhỏ: phiên là bài tập về nhà */
    classSessionBadgeHomework: string
    /** SEO /lam-bai/[code]: hậu tố sau tên phiên (thi) */
    lamBaiSeoTitleSuffixExam: string
    lamBaiSeoTitleSuffixHomework: string
    lamBaiSeoDescriptionExam: string
    lamBaiSeoDescriptionHomework: string
    /** Từ khóa meta, phân tách bằng dấu phẩy */
    lamBaiSeoKeywordsExam: string
    lamBaiSeoKeywordsHomework: string
    lamBaiSeoFallbackTitle: string
    lamBaiSeoFallbackDescription: string
    lamBaiSeoFallbackKeywords: string
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
    /** Gắn bản sao đề sang lớp khác (mã & QR mới) */
    examAttachToOtherClassButton: string
    /** Danh sách đề đã tạo (vd. tạo giáo trình): gán vào lớp — nhãn ngắn */
    examAssignClassButton: string
    examAttachPickClassTitle: string
    examAttachPickClassDescription: string
    examAttachSelectClassLabel: string
    examAttachSelectClassPlaceholder: string
    examAttachSubmit: string
    examAttachLoadingClasses: string
    examAttachWorking: string
    examAttachNoClassesBody: string
    examAttachNoOtherClassesBody: string
    examAttachFailed: string
    /** Placeholder {classLine} — tên lớp, có thể kèm trường */
    examAttachSuccessSummary: string
    examAttachClose: string
    examAttachPickAnotherClass: string
    /** Nhãn tên đề trong popup gắn lớp */
    examAttachExamLabel: string
    /** Mọi lớp của GV đều đã có phiên của đề này */
    examAttachAllClassesAlreadyAttachedBody: string
    /** Gợi ý dưới dropdown: tạo lớp tab mới rồi làm mới */
    examAttachNeedDifferentClassHint: string
    examAttachReloadClassList: string
    /** Nút mở /lop/tao ở tab mới */
    examAttachOpenCreateClassNewTab: string
    /** API 409 / lớp đã có đề cùng lineage */
    examAttachClassAlreadyHasExam: string
    /** Trang lam-bai: đã có hồ sơ lớp — chỉ cần bấm bắt đầu */
    examIdentityFromClassHint: string
    examChangeIdentityManual: string
    examManualIdentityIntro: string
    examStartTestButton: string
    examOneAttemptNote: string
    /** Trang lam-bai — phiên bài tập về nhà */
    examStartHomeworkButton: string
    homeworkIdentityFromClassHint: string
    homeworkManualIdentityIntro: string
    homeworkEnrollGateTitle: string
    homeworkEnrollGateDescription: string
    homeworkEnrollSubmitButton: string
    homeworkDefaultTitle: string
    lamBaiLoadingNeutral: string
    lamBaiFiveMinWarning: string
    lamBaiTimerTimeUpAutoSubmittingExam: string
    lamBaiTimerTimeUpAutoSubmittingHomework: string
    /** Thanh đồng hồ gọn khi hết giờ */
    lamBaiTimerStickySubmittingExam: string
    lamBaiTimerStickySubmittingHomework: string
    /** Trang lam-bai đang làm — nhắc: chỉ thoát sau khi nộp; quay lại thì đồng hồ vẫn tính từ lúc bấm Bắt đầu */
    lamBaiExitBlockedBanner: string
    /** Trước khi bấm Bắt đầu — cảnh báo đóng/tải lại; có thể quay lại nhưng đồng hồ không dừng */
    lamBaiExitBlockedBeforeStartHint: string
    lamBaiExitBlockedDialogTitle: string
    lamBaiExitBlockedDialogDescription: string
    lamBaiExitBlockedSubmitNow: string
    lamBaiExitBlockedStay: string
    /** Sau khi tải lại trang — có phiên làm bài chưa nộp */
    lamBaiExamResumeNotice: string
    /** Nút Bắt đầu đang gọi API */
    examBeginStarting: string
    examBeginFailed: string
    examSubmitSending: string
    examSubmitButton: string
    homeworkSubmitSending: string
    homeworkSubmitButton: string
    homeworkLoadFailed: string
    /** Trang lam-bai — tiêu đề câu hỏi, placeholder {index} */
    lamBaiQuestionLabel: string
    /** Trang lam-bai: đã nộp trước (máy khác / phiên khác) — hiển thị kết quả đã lưu */
    examSubmittedTitle: string
    examSubmittedSavedEarlier: string
    /** Kết quả sau khi hết giờ server (tự nộp) */
    examSubmittedDueToDeadlineHint: string
    /** Bài tập về nhà (không hiển thị điểm cho HS) */
    homeworkSubmittedTitle: string
    homeworkSubmittedSavedEarlier: string
    homeworkSubmittedBody: string
    /** {correct}, {total} */
    homeworkMcCorrectOnlyLine: string
    /** {title} */
    homeworkShareLine: string
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
    /** Phiên đề / bài tập — {time} đã format (ngày giờ tạo) */
    examSessionCreatedAt: string
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
    /** Danh sách đề thi (trang con) */
    classExamsIndexTitle: string
    /** Chi tiết một phiên thi */
    classExamSessionPageTitle: string
    /** Danh sách đề thi: nút vào trang chấm từng phiên */
    classExamGoToSession: string
    /** SEO mô tả trang tổng /lop/[id] */
    classDetailSeoDescription: string
    /** Hub: mô tả thẻ bài tập về nhà (gan-phieu) */
    classHubCardAssignWorksheetDesc: string
    /** Tóm tắt một dòng khi chưa có môn/GV hiển thị cho HS */
    classPageStudentFacingNotSet: string
    /** Hub HS: mô tả thẻ bài tập về nhà (trang /lop/.../phieu-bai-tap) */
    classHubCardStudentWorksheetsDesc: string
    /** Hub GV: nút trong thẻ đề thi → /tao-bai-thi */
    classHubCardCreateExamButton: string
    /** Hub GV: nút trong thẻ bài tập → /tao-bai-tap-ve-nha */
    classHubCardCreateHomeworkButton: string
    /** Trang lam-bai: không parse được TN/TL */
    worksheetLamBaiNoInteractiveHint: string
    /** Trang lam-bai: nút về danh sách phiếu trong lớp */
    worksheetLamBaiBackToClassWorksheets: string
    worksheetLamBaiMcqSectionTitle: string
    worksheetLamBaiEssaySectionTitle: string
    worksheetLamBaiEssayPlaceholder: string
    /** Server / toast: chặn nộp khi không có câu hỏi tương tác */
    worksheetSubmitNoInteractiveError: string
    /** Trang gán phiếu: cảnh báo chưa có question_ids */
    assignWorksheetNoQuestionBankHint: string
    /** Trang gán phiếu: link mở phiếu trong công cụ soạn */
    assignWorksheetOpenInCurriculumTool: string
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
  /** /tao-thiep-moi-cuoi-ai — khoảng phát nhạc nền (file upload) */
  weddingCardAiMusic: {
    playStartLabel: string
    playEndLabel: string
    playStartPlaceholder: string
    playEndPlaceholder: string
    segmentHint: string
    /** Nút: ghi vị trí playhead vào ô «bắt đầu phát» */
    useCurrentPlaybackAsStart: string
    /** Khách xem thiệp: file nhạc không tải được (404 / mất file). */
    playbackLoadFailed: string
    /** FAB góc màn — trợ năng nhạc đang phát */
    publicFabPauseAria: string
    /** FAB góc màn — trợ năng nhạc đang tắt */
    publicFabPlayAria: string
    /** Thiệp công khai: tiêu đề iframe bản đồ (trợ năng) */
    publicMapEmbedTitle: string
  }
  /** Thiệp công khai / preview: khối lịch & giờ tiệc (save-the-date) */
  weddingCardCalendar: {
    sectionTitle: string
    introLine: string
    receptionLabel: string
    partyLabel: string
    /** Ô chờ khi chỉ có một mốc giờ được trích ra */
    timePlaceholderDash: string
  }
  /** Hộp mừng cưới + VietQR */
  weddingGiftBox: {
    boxTitle: string
    tapToOpen: string
    dialogTitle: string
    brideSection: string
    groomSection: string
    accountHolder: string
    accountNumber: string
    bankSelectPlaceholder: string
    vietqrFooterNote: string
    closeButton: string
    envelopeButtonAria: string
    editorHint: string
    legacyImageLabel: string
    legacyImageDesc: string
    saveNeedConfig: string
    qrAltBride: string
    qrAltGroom: string
    qrAltLegacy: string
  }
  /** /tao-thiep-moi-cuoi-ai — mô tả nội dung brief & auto-save */
  weddingCardAiBrief: {
    step2Description: string
    autoSavedLabel: string
    autoSaveFailedLabel: string
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
    /** Nút mở panel danh sách bài thi (trang tạo đề) */
    openCreatedExamsListButton: string
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
    /** Luồng /tao-bai-tap-ve-nha — cùng form tạo đề, không bắt tổng 100 điểm */
    homeworkPageTitle: string
    homeworkPageSubtitle: string
    defaultHomeworkTitle: string
    homeworkCreatedBadge: string
    createHomework: string
    createAnotherHomework: string
    createdHomeworkListTitle: string
    createdHomeworkHint: string
    openCreatedHomeworkListButton: string
    homeworkCreateSuccess: string
    homeworkCreateSuccessDesc: string
    homeworkEssayNo100Note: string
    /** Tiêu đề thẻ form — luồng homework */
    homeworkCardInfo: string
    homeworkFormCardDescription: string
    homeworkTitlePlaceholder: string
    /** Gợi ý dưới bảng gán số câu TN (không hiện phút/điểm) */
    homeworkQuizPartFooterHint: string
    noHomeworkSessionsYet: string
    /** {count} */
    homeworkCreatedResultLine: string
    /** {count} */
    homeworkSummaryMc: string
    /** {count} */
    homeworkSummaryEssay: string
    homeworkDeleteConfirm: string
    homeworkDeleted: string
    homeworkDeletedDesc: string
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
    inviteFriends: 'Mời bạn bè',
    viewPlan: 'Xem gói',
    topUpCredits: 'Nạp credit',
    tasksHub: 'Tác vụ & hàng đợi',
    supportChat: 'Chat hỗ trợ',
    partnerInbox: 'Kênh kinh doanh',
    partnerApiIntegration: 'Tích hợp API (chủ shop)',
    customerApiKeys: 'Thuê nền tảng AI',
    myChats: 'Tin của tôi',
    myOrders: 'Đơn hàng của tôi',
    downloadApp: 'Tải ứng dụng',
    downloadAppSubtitle:
      'Đây là bản web (PWA): cài lên màn hình chính giống app. Android dùng Chrome; iPhone/iPad dùng Safari.',
    downloadAndroidTitle: 'Android (Chrome)',
    downloadAndroidChromeHint:
      'Chrome thường hiện "Cài đặt ứng dụng" hoặc mục Thêm vào Màn hình chính trong menu.',
    downloadAndroidStep1: 'Mở trang NanoAI (nanoai.vn) trong Chrome.',
    downloadAndroidStep2: 'Chạm nút menu ⋮ (ba chấm) ở góc trên bên phải.',
    downloadAndroidStep3:
      'Chọn "Cài đặt ứng dụng" hoặc "Thêm vào Màn hình chính", rồi xác nhận.',
    downloadIosTitle: 'iPhone / iPad',
    downloadIosSafariHint: 'Nên dùng Safari.',
    downloadIosStep1: 'Mở trang NanoAI (nanoai.vn) trong Safari.',
    downloadIosStep2: 'Chạm nút Chia sẻ (ô vuông có mũi tên hướng lên) ở thanh công cụ dưới cùng.',
    downloadIosStep3:
      'Trong trình đơn, chọn "Thêm vào Màn hình chính", rồi chạm Thêm.',
  },
  home: {
    title: 'NanoAI - Sáng tạo không giới hạn cùng AI',
  },
  referral: {
    pageTitle: 'Mời bạn bè – nhận thưởng credit',
    metaDescription:
      'Chia sẻ NanoAI với bạn bè. Khi có người đăng ký mới qua link của bạn, chỉ bạn nhận 2 credit giới thiệu.',
    headline: 'Giới thiệu NanoAI cho bạn bè',
    description:
      'Sao chép liên kết cá nhân của bạn. Khi có người đăng ký tài khoản mới và tham gia qua link đó (trong 30 ngày kể từ khi họ tạo tài khoản), bạn nhận 2 credit — mỗi người được mời chỉ tính một lần.',
    yourLinkLabel: 'Liên kết giới thiệu của bạn',
    copyButton: 'Sao chép liên kết',
    copied: 'Đã sao chép',
    howItWorksTitle: 'Cách hoạt động',
    step1: 'Gửi liên kết có mã giới thiệu của bạn cho bạn bè.',
    step2: 'Họ mở link và đăng ký / đăng nhập NanoAI trong vòng 30 ngày kể từ khi tạo tài khoản.',
    step3: 'Hệ thống cộng 2 credit cho bạn (người mời). Người được mời không nhận credit từ chương trình giới thiệu này.',
    bonusNote:
      'Chỉ tài khoản mới đủ điều kiện mới kích hoạt thưởng cho người mời; mỗi người được mời chỉ được tính một lần.',
    inviteVisualYou: 'Bạn (người mời)',
    inviteVisualFriend: 'Người được mời',
    inviteeNoReferralCredit: 'Không có thưởng credit giới thiệu',
    errorGeneric: 'Không thể áp dụng giới thiệu lúc này. Thử lại sau nhé.',
  },
  accountPlan: {
    pageTitle: 'Gói dịch vụ',
    metaDescription:
      'Xem dùng thử 7 ngày và phí tháng giáo trình. Học tiếng Anh AI trả theo từng buổi; credit AI tính riêng.',
    headline: 'Gói đang dùng',
    billingPeriod: 'Kỳ phí tháng (lịch Việt Nam): {period}',
    trialSectionTitle: 'Dùng thử miễn phí',
    trialActiveLine:
      'Bạn đang trong thời gian dùng thử — không trừ phí tháng giáo trình (mục bên dưới).',
    trialTotalDaysNote: 'Thời lượng dùng thử: {days} ngày kể từ khi tạo tài khoản.',
    trialDaysLeft: 'Còn lại khoảng {days} ngày.',
    trialEndsAtLine: 'Hết hạn dùng thử (dự kiến): {datetime}',
    trialNotActive:
      'Bạn không còn trong 7 ngày dùng thử đầu tiên. Phí tháng giáo trình sẽ trừ bằng credit mỗi kỳ khi áp dụng.',
    servicesSectionTitle: 'Giáo trình — phí tháng (credit)',
    productEnglishCoach: 'Học tiếng Anh AI',
    englishCoachPayPerLesson:
      'Không có phí tháng. Mỗi buổi hoặc bài học trừ credit riêng khi bạn bắt đầu (mức cụ thể hiển thị trong phần học).',
    productCurriculum: 'Giáo trình & tạo bài',
    statusViaTrial: 'Đang dùng thử — chưa trừ phí tháng.',
    statusAccessOn: 'Đang có quyền truy cập dịch vụ.',
    statusPaidMonth: 'Đã trừ phí tháng cho kỳ {period}.',
    statusPendingPayment: 'Chưa trừ phí tháng — cần {credits} credit cho kỳ {period}.',
    noteSignupBonus: 'Khi đăng ký, tài khoản được tặng {credits} credit (dùng cho AI; tách với phí tháng).',
    noteAiCredits: 'Credit AI vẫn bị trừ riêng mỗi lần bạn dùng tính năng tạo nội dung / học có tốn model.',
    refresh: 'Làm mới',
    loading: 'Đang tải…',
    errorLoad: 'Không tải được thông tin gói. Thử làm mới trang.',
    errorConfig: 'Máy chủ chưa cấu hình đầy đủ. Thử lại sau.',
    monthlyCostLine: '{credits} credit / kỳ · ước tính ~{vnd}₫',
    backDashboard: 'Về bảng điều khiển',
    linkWallet: 'Mở ví để nạp credit',
  },
  push: {
    bannerTitle: 'Nhận thông báo trên điện thoại',
    bannerHint:
      'Bạn đang dùng NanoAI như ứng dụng (PWA). Bật thông báo để biết tin mới (nạp tiền, thưởng, xử lý báo cáo…) ngay cả khi không mở app.',
    enable: 'Bật thông báo',
    later: 'Để sau',
    enabledToast: 'Đã bật thông báo đẩy',
    bellEnableHint: 'Thông báo trong app khác thông báo hệ thống. Bật đẩy để nhận tin khi không mở NanoAI.',
    bellEnableButton: 'Bật thông báo đẩy',
    bellSubscribedShort: 'Đã bật thông báo đẩy trên thiết bị này',
    bellDeniedHint: 'Thông báo hệ thống đang tắt. Vào Cài đặt trình duyệt → NanoAI → Bật thông báo.',
    bellSyncHint: 'Trình duyệt đã cho phép thông báo nhưng máy chủ chưa lưu thiết bị. Nhấn để đồng bộ.',
  },
  supportChat: {
    pageTitle: 'Chat hỗ trợ',
    metaDescription:
      'Nhắn tin với đội ngũ NanoAI; đồng bộ với Facebook Messenger và Zalo OA khi đã tích hợp webhook.',
    brandBadge: 'NanoAI',
    headline: 'Hỗ trợ qua chat',
    subline:
      'Tin nhắn từ trang này vào cùng hộp thư chăm sóc khách hàng với Facebook và Zalo (nếu đã cấu hình trên máy chủ).',
    loginRequired: 'Đăng nhập để gửi tin nhắn tới đội ngũ hỗ trợ.',
    loginSupportingLine: 'Dùng tài khoản NanoAI của bạn; sau khi đăng nhập bạn soạn tin ngay tại đây.',
    loginLink: 'Đăng nhập',
    placeholder: 'Nhập nội dung…',
    send: 'Gửi',
    emptyThread: 'Chưa có tin nhắn. Gửi câu hỏi đầu tiên bên dưới.',
    loadError: 'Không tải được hội thoại.',
    sendError: 'Không gửi được tin nhắn.',
    pollNote: 'Phản hồi từ admin có thể hiện sau vài giây; bạn có thể tải lại trang.',
    sendKeyboardHint: 'Enter để gửi · Shift+Enter xuống dòng',
    messageProductCardOpenProduct: 'Xem sản phẩm',
    messageProductCardViewDetails: 'Xem chi tiết',
  },
  customerCareAdmin: {
    pageTitle: 'Chăm sóc khách hàng',
    pageDescription:
      'Chỉ hộp thư nền tảng NanoAI (support-chat và kênh Facebook/Zalo gắn nền tảng). Inbox từng shop: Bảng điều khiển → Nhắn tin. Khi bạn là khách của shop: Tin nhắn của tôi — không trộn vào đây.',
    inboxTitle: 'Hội thoại (nền tảng)',
    pickConversation: 'Chọn một hội thoại để xem tin nhắn.',
    replyPlaceholder: 'Soạn phản hồi…',
    send: 'Gửi',
    refresh: 'Làm mới',
    channelFacebook: 'Facebook',
    channelZalo: 'Zalo',
    channelInternal: 'NanoAI',
    channelWidget: 'Web (embed)',
    unknownUser: 'Khách',
    sendFailed: 'Gửi thất bại',
    noMessages: 'Chưa có tin nhắn.',
    sendKeyboardHint: 'Enter để gửi · Shift+Enter xuống dòng',
    messageProductCardOpenProduct: 'Xem sản phẩm',
    messageProductCardViewDetails: 'Xem chi tiết',
  },
  partnerMessaging: {
    pageTitle: 'Nhắn tin cho khách (đối tác)',
    pageDescription:
      'Một workspace cho shop của bạn: khách nhắn qua Facebook Page, Zalo OA, trang chat trên NanoAI hoặc API nhúng trên web — cùng một hộp thư.',
    cardTitle: 'Inbox khách (đối tác)',
    cardDescription: 'Facebook, Zalo, chat trên NanoAI và chat nhúng web — cùng một inbox.',
    createWorkspace: 'Tạo workspace nhắn tin',
    workspaceNameLabel: 'Tên shop / thương hiệu',
    workspaceLabel: 'Workspace',
    createButton: 'Tạo mới',
    saveOk: 'Đã lưu.',
    channelsSection: 'Kết nối kênh (Facebook & Zalo)',
    fbPageId: 'Facebook Page ID',
    fbPageToken: 'Page access token',
    fbVerifyToken: 'Verify token (webhook GET)',
    saveFacebook: 'Lưu Facebook',
    zaloSecret: 'Webhook secret (header)',
    zaloToken: 'OA access token',
    saveZalo: 'Lưu Zalo',
    embedSection: 'API chat ẩn danh trên web shop (tùy chọn)',
    embedHint:
      'Gọi API từ domain shop (CORS mở). Mỗi trình duyệt giữ UUID ổn định (localStorage) và gửi header X-Session-Id.',
    embedHeadersHelp:
      'Gửi header X-Embed-Key (khóa như trên) và X-Session-Id (UUID cố định trên trình duyệt khách).',
    embedAnonymousFootnote:
      'Luồng này không đăng nhập NanoAI: shop không biết danh tính thật và không đồng bộ với Google. Để khách dùng cùng đăng nhập như mở NanoAI trực tiếp (và có trang “Tin nhắn của tôi”), hãy gửi link chat NanoAI hoặc nhúng iframe ở mục trên.',
    inboxTitle: 'Hội thoại khách',
    inboxSearchPlaceholder: 'Tìm theo tên hoặc tin nhắn…',
    inboxNoSearchResults: 'Không có hội thoại khớp.',
    inboxSideInfoTab: 'Thông tin',
    inboxSideOrderTab: 'Tạo đơn',
    inboxSideNoNotes: 'Bạn chưa có ghi chú nào',
    inboxSideNotePlaceholder: 'Nhập ghi chú (Enter để gửi)',
    inboxSideOrderEmpty: 'Chưa có lịch sử đơn hàng',
    inboxSideCreateOrder: 'Tạo đơn',
    pickConversation: 'Chọn hội thoại.',
    replyPlaceholder: 'Soạn tin trả khách…',
    send: 'Gửi',
    refresh: 'Làm mới',
    channelFacebook: 'Facebook',
    channelZalo: 'Zalo',
    channelWidget: 'Web',
    unknownUser: 'Khách',
    noMessages: 'Chưa có tin.',
    inboxShopDrafting: 'Cửa hàng đang soạn tin',
    replyKeyboardHint: 'Enter gửi · Shift+Enter xuống dòng · Ctrl+V dán ảnh',
    messageProductCardOpenProduct: 'Xem sản phẩm',
    messageProductCardViewDetails: 'Xem chi tiết',
    partnerAttachPhoto: 'Ảnh từ máy',
    partnerTakePhoto: 'Chụp ảnh',
    partnerRemoveAttachmentAria: 'Bỏ ảnh đính kèm',
    partnerCaptionHint: 'Có thể thêm chú thích dưới đây trước khi gửi.',
    partnerUploading: 'Đang tải ảnh…',
    partnerImageTooLarge: 'Ảnh quá lớn (tối đa ~3 MB).',
    partnerImageInvalidType: 'Định dạng ảnh không được hỗ trợ.',
    nanoaiHostedSection: 'Chat trên NanoAI — cùng đăng nhập như dùng NanoAI trực tiếp (khuyến nghị)',
    nanoaiHostedHint:
      'Khách bắt buộc đăng nhập Google trên NanoAI giống khi dùng nền tảng trực tiếp: một tài khoản, đồng bộ tin nhắn giữa thiết bị, xem danh sách shop tại /messaging/my-chats. Shop vẫn nhận hội thoại trong inbox như hiện tại.',
    nanoaiHostedUrlLabel: 'Liên kết chat',
    nanoaiHostedIframeTitle: 'Nhúng lên web shop (iframe)',
    nanoaiHostedIframeTitleAttr: 'Chat NanoAI',
    nanoaiHostedIframeHelp:
      'Dán vào HTML trang của bạn. Khách chat và đăng nhập trong khung NanoAI (cookie first-party), không phụ thuộc API embed ẩn danh.',
    copyHostedChatLinkButton: 'Sao chép liên kết chat',
    hostedChatLinkCopiedToast: 'Đã sao chép liên kết chat.',
    copyIframeSnippetButton: 'Sao chép mã iframe',
    iframeSnippetCopiedToast: 'Đã sao chép mã nhúng.',
    integrationSectionTitle: 'Thẻ theo dõi & mã nhúng',
    integrationSectionHint:
      'Thiết kế khu vực để dán Google tag, Facebook Pixel và mã nhúng chat. Bạn có thể sao chép nhanh mã nhúng NanoAI bên dưới.',
    googleTagLabel: 'Google tag (GA4 / GTM)',
    googleTagPlaceholder: 'Ví dụ: G-XXXXXXXXXX hoặc GTM-XXXXXXX',
    facebookPixelLabel: 'Facebook Pixel / Meta Pixel',
    facebookPixelPlaceholder: 'Ví dụ: 123456789012345',
    metaConsultTrackingSection: 'Meta Pixel & Conversions API (tư vấn sản phẩm)',
    metaConsultTrackingHint:
      'Khi khách mở link tư vấn từng sản phẩm (trang /tu-van/… hoặc chat có ?ctx_inventory=), hệ thống gửi ViewContent trùng tham số trên Pixel và máy chủ (dedupe bằng event_id).',
    metaConsultCapiTokenLabel: 'Access token Conversions API (máy chủ)',
    metaConsultCapiTokenPlaceholder: 'Dán token từ Meta Events Manager',
    metaConsultCapiConfiguredBadge: 'Đã lưu token',
    metaConsultCapiSavedHint:
      'Sau khi lưu, ô này cố ý để trống — không hiển thị lại token vì bảo mật; token vẫn nằm trên máy chủ. Chỉ dán token mới khi muốn thay; để trống nếu chỉ đổi Pixel ID.',
    metaConsultSaveButton: 'Lưu Pixel & CAPI',
    shopGa4MeasurementLabel: 'Mã Google Analytics 4 (GA4)',
    shopGa4MeasurementHint:
      'Nhập mã G-… để đo lượt trên trang tư vấn/shop của bạn. Trong GA4 mở Báo cáo → Thời gian thực (Realtime) để xem có bao nhiêu người đang xem.',
    shopGa4MeasurementPlaceholder: 'Ví dụ: G-XXXXXXXXXX',
    shopGa4InvalidIdToast: 'Mã GA4 không hợp lệ. Định dạng: G-XXXXXXXXXX',
    shopGa4SaveButton: 'Lưu mã GA4',
    facebookCatalogFeedTitle: 'Facebook — link danh mục sản phẩm (CSV)',
    facebookCatalogFeedHint:
      'Dán URL này vào Commerce Manager khi chọn «URL hoặc Google Trang tính». CSV gồm sản phẩm đang bật; cột link là trang tư vấn trên NanoAI (không phải link web shop). Cần ảnh URL, giá VND; key = khóa nhúng (giữ bí mật).',
    facebookCatalogFeedCopyButton: 'Sao chép URL feed',
    facebookCatalogFeedCopiedToast: 'Đã sao chép URL feed danh mục.',
    nanoaiEmbedCodeLabel: 'Mã nhúng chat NanoAI',
    facebookChatEmbedCodeLabel: 'Mã nhúng chat Facebook',
    zaloChatEmbedCodeLabel: 'Mã nhúng chat Zalo',
    embedCodePlaceholder: 'Dán đoạn script/iframe hoặc mã plugin vào đây…',
    copyNanoaiEmbedButton: 'Sao chép mã chat NanoAI',
    copyFacebookChatEmbedButton: 'Sao chép mã Facebook chat',
    copyZaloChatEmbedButton: 'Sao chép mã Zalo chat',
    addAnotherWorkspace: 'Tạo thêm workspace',
    cancelAddWorkspace: 'Hủy',
    deleteWorkspaceButton: 'Xóa workspace',
    deleteWorkspaceConfirm:
      'Canh bao: xoa workspace nay se xoa vinh vien va KHONG THE KHOI PHUC. Hay go "XOA" de xac nhan.',
    deleteWorkspaceSuccess: 'Đã xóa workspace.',
    deleteWorkspaceOtpIntro:
      'Workspace sẽ được lên lịch xóa sau 7 ngày. Trong thời gian chờ shop không nhận tin khách. Chúng tôi gửi mã OTP tới email đăng nhập của bạn.',
    deleteWorkspaceOtpSend: 'Gửi mã OTP',
    deleteWorkspaceOtpLabel: 'Mã OTP (6 số)',
    deleteWorkspaceOtpConfirm: 'Xác nhận lên lịch xóa',
    deleteWorkspaceScheduledBanner:
      'Đang chờ xóa workspace — không nhận tin từ khách. Bạn có thể hủy trong Cài đặt nhắn tin trước khi hết hạn.',
    deleteWorkspaceCancelSchedule: 'Hủy lịch xóa',
    deleteWorkspaceOtpSentToast: 'Đã gửi mã OTP tới email của bạn.',
    deleteWorkspaceScheduleCancelled: 'Đã hủy lịch xóa workspace.',
    teamStaffSectionTitle: 'Nhân viên workspace',
    teamStaffSectionHint:
      'Mời bằng email đăng nhập của tài khoản NanoAI. Chọn quyền từng người; chỉ nên cho quyền nhạy cảm khi tin tưởng hoàn toàn.',
    badgeStaffWorkspace: 'được mời',
    teamInviteEmailLabel: 'Email đăng nhập',
    teamInviteEmailPlaceholder: 'email@vidu.com',
    teamInviteButton: 'Mời',
    teamStaffListTitle: 'Danh sách nhân viên',
    teamRemoveMember: 'Gỡ',
    teamSavePermissions: 'Lưu quyền',
    teamInviteErrorNotFound:
      'Không tìm thấy tài khoản với email này — người được mời cần đăng ký NanoAI và xác nhận email.',
    teamInviteErrorBadEmail: 'Email không hợp lệ.',
    teamInviteErrorOwner: 'Không thể mời chủ workspace hoặc chủ của shop này.',
    teamInviteOk: 'Đã mời nhân viên.',
    teamStaffRestrictedNote:
      'Đang vào vai trò nhân viên: chỉ chủ workspace mới xem/sửa thanh toán, API nhúng, xóa workspace và các mục nhạy cảm khác.',
    teamPermInbox: 'Hộp thư khách',
    teamPermOrders: 'Đơn hàng',
    teamPermInventory: 'Kho sản phẩm',
    teamPermAiSettings: 'Cài đặt AI',
    teamPermWorkspaceBranding: 'Thương hiệu & logo',
    teamPermWorkspacePayment: 'Thanh toán trong chat',
    teamPermIntegrationsChannels: 'Kênh Facebook / Zalo',
    teamPermIntegrationsAnalytics: 'Meta Pixel / GA4 / Catalog',
    teamPermUsageReports: 'Báo cáo sử dụng',
    integrationsAnalyticsOwnerOnly: 'Chỉ chủ workspace mới có thể lưu Pixel, CAPI và GA4.',
    teamRemoveMemberConfirm: 'Gỡ nhân viên này khỏi workspace?',
    fbLinkedLine: 'Facebook Page đã liên kết: {pageId}',
    zaloLinkedLine: 'Zalo OA đã cấu hình webhook & token.',
    credentialsKeepHint:
      'Để trống ô token hoặc secret nếu không đổi — hệ thống giữ giá trị đã lưu.',
    setupColumnTitle: 'Kết nối & trợ lý AI',
    chatColumnTitle: 'Hội thoại khách',
    messagingSettingsLink: 'Cài đặt kênh & AI',
    messagingSettingsPageTitle: 'Cài đặt nhắn tin (shop)',
    messagingInboxDescription:
      'Danh sách khách bên trái; khi mở một hội thoại, ô soạn tin cố định dưới cùng màn hình.',
    noWorkspaceInboxCta: 'Bạn chưa có workspace nhắn tin. Vào trang cài đặt để tạo shop và kết nối Facebook / Zalo / chat.',
    goToInbox: 'Về hộp thư',
    inboxMobileBackAria: 'Danh sách hội thoại',
    apiIntegrationGuideLink: 'Hướng dẫn tích hợp API (khóa & endpoint)',
    apiIntegrationGuideShort: 'Dành cho dev tích hợp web shop: nhúng chat, tìm ảnh sản phẩm, API thử đồ B2B.',
    messagingSettingsApiHubCardTitle: 'Nhúng chat & API',
    messagingSettingsApiHubCardBody:
      'URL hosted, mã iframe, endpoint embed, khóa X-Embed-Key / Bearer và tài liệu cho developer đã chuyển sang trang «Tích hợp API» — không còn hiển thị trên trang cài đặt này.',
    customerCareShopSetupGuideTitle: 'Hướng dẫn tạo shop chăm sóc khách hàng',
    customerCareShopSetupGuideBody:
      'Bước 1 — Vào Bảng điều khiển → Nhắn tin → Cài đặt kênh & AI (trang này).\n\nBước 2 — Ở mục «Tạo workspace nhắn tin», nhập tên hiển thị, tên thương hiệu, chọn ngành; có thể dán URL logo hoặc tải ảnh lên.\n\nBước 3 — Nhấn «Tạo mới». Đây là workspace của shop: mọi tin từ Facebook Page, Zalo OA, chat trên NanoAI và chat nhúng trên web shop đều vào cùng một inbox.\n\nBước 4 — Sau đó kết nối kênh (Facebook/Zalo), sao chép liên kết chat hoặc mã nhúng iframe, và tùy chọn bật trợ lý AI cùng kho hàng ngay trên trang cài đặt này.',
  },
  partnerMessagingOrders: {
    pageTitle: 'Quản lý đơn hàng chat',
    pageDescription: 'Danh sách đơn hàng được tạo trong widget chat.',
    introLine:
      'Theo dõi đơn đã tạo trong khung chat, xác nhận thủ công khi cần và cập nhật trạng thái.',
    allWorkspaces: 'Tất cả workspace',
    allStatuses: 'Tất cả trạng thái',
    searchPlaceholder: 'Tìm theo mã đơn / tên KH / SĐT / sản phẩm',
    exportExcel: 'Xuất Excel',
    exportExcelTitle:
      'Xuất tất cả đơn khớp bộ lọc workspace + trạng thái + khoảng ngày (nếu chọn; không theo ô tìm kiếm nhanh).',
    reload: 'Tải lại',
    filterCreatedFrom: 'Từ ngày',
    filterCreatedTo: 'Đến ngày',
    summaryTitle: 'Tóm tắt theo bộ lọc (workspace + trạng thái + ngày tạo đơn)',
    summaryDescription:
      'Toàn bộ đơn khớp bộ lọc (không giới hạn 200 dòng như danh sách bên dưới). Lọc ngày theo giờ Việt Nam (ngày tạo đơn). Để trống cả hai ô = không giới hạn ngày. Ô tìm nhanh chỉ lọc trên trang, không đổi các số này.',
    statOrders: 'Số đơn',
    statSubtotal: 'Tổng tiền hàng',
    statSubtotalHint: 'Tổng giá trị đơn (subtotal)',
    statRequired: 'Tiền cọc / khoản yêu cầu',
    statRequiredHint: 'Theo cấu hình từng đơn',
    statPaid: 'Đã thu (ghi nhận)',
    statPaidHint: 'Khách đã chuyển / hệ thống ghi nhận',
    statOutstanding: 'Còn phải thu (ước tính)',
    statOutstandingHint: 'Đơn chưa hủy: max(0, tiền hàng − đã thu)',
    statusAwaitingPayment: 'Chờ thanh toán',
    statusPaymentChecking: 'Đang đối soát',
    statusPaidVerified: 'Đã xác nhận TT',
    statusPendingManualReview: 'Cần duyệt tay',
    statusCancelled: 'Đã hủy',
    emptyList: 'Chưa có đơn hàng nào.',
    emptyFiltered: 'Không có đơn nào khớp bộ lọc.',
    shippingPending: 'Chờ xác nhận',
    shippingConfirmed: 'Đã xác nhận đơn',
    shippingPacking: 'Đang đóng gói',
    shippingShipping: 'Đang giao hàng',
    shippingDelivered: 'Đã giao thành công',
    shippingReturned: 'Hoàn / trả hàng',
    shippingCancelled: 'Đã hủy',
    proofVerified: 'Proof: khớp',
    proofManualReview: 'Proof: cần duyệt tay',
    proofFailed: 'Proof: không khớp',
    proofPending: 'Proof: đang xử lý',
    proofNone: 'Proof: chưa có',
    labelWorkspace: 'Workspace',
    labelCustomer: 'Khách',
    labelEmail: 'Email',
    labelAddress: 'Địa chỉ',
    labelProduct: 'Sản phẩm',
    labelMoneyPrefix: 'Tiền',
    moneyLine: 'Tổng {subtotal} · Cần thanh toán {required} · Đã ghi nhận {paid}',
    openProduct: 'Mở sản phẩm',
    openProofImage: 'Mở ảnh chứng từ',
    openInbox: 'Mở inbox',
    openChat: 'Mở chat',
    orderLocked: 'Đã khóa đơn',
    notePlaceholder: 'Ghi chú xác nhận / lý do (tùy chọn)',
    btnConfirmPaid: 'Xác nhận đã thanh toán',
    btnMarkManualReview: 'Đánh dấu cần duyệt tay',
    btnCancelOrder: 'Hủy đơn',
    btnViewTimeline: 'Xem timeline',
    timelineTitle: 'Lịch sử đơn hàng',
    timelinePickOrder: 'Chọn một đơn bên trái để xem lịch sử sự kiện.',
    timelineNoEvents: 'Chưa có sự kiện.',
    timelineLoading: 'Đang tải lịch sử…',
    toastStatusUpdated: 'Đã cập nhật trạng thái đơn.',
    toastShippingUpdated: 'Đã cập nhật giao hàng và thông báo về chat.',
    toastExportDone: 'Đã tải {count} đơn ({filename}).',
    depositNone: 'Chưa cọc',
    depositPartial: 'Cọc một phần',
    depositFull: 'Đã cọc đủ',
    pathSepay: '{shop} (tự động)',
    pathManual: 'CK ngân hàng · ảnh biên lai',
    sepayAutoHint: 'Đối soát tự động qua hệ thống của {shop} — không cần ảnh giao dịch.',
    proofReceiptShortVerified: 'Biên lai: khớp',
    proofReceiptShortPending: 'Biên lai: chờ xử lý',
    proofReceiptShortFailed: 'Biên lai: không khớp',
    proofReceiptShortManual: 'Biên lai: cần duyệt tay',
    proofReceiptShortNone: 'Biên lai: chưa có',
    tabAll: 'Tất cả',
    tabAwaitDeposit: 'Chờ đặt cọc',
    tabAwaitShip: 'Chờ gửi hàng',
    tabAwaitReceive: 'Chờ nhận hàng',
    tabReceived: 'Đã nhận hàng',
    tabReviewed: 'Đã đánh giá',
    tabCancelled: 'Đã hủy',
    tableColOrderCode: 'Mã đơn',
    tableColConsulted: 'Đã liên hệ tư vấn',
    tableColCustomer: 'Khách hàng',
    tableColSubtotal: 'Tổng tiền hàng',
    tableColDepositRequired: 'Tiền cọc cần thu',
    tableColPaidAmount: 'Đã thanh toán',
    tableColDueOnDelivery: 'Còn lại khi nhận hàng',
    tableColStatus: 'Trạng thái',
    tableColOrderDate: 'Ngày đặt',
    tableColActions: 'Thao tác',
    filterShippingLabel: 'Tất cả trạng thái',
    filterPaymentShort: 'TT thanh toán',
    clearTableFilters: 'Xóa bộ lọc',
    consultedAria: 'Đã liên hệ tư vấn (lưu trên trình duyệt này)',
    reviewedAria: 'Khách đã đánh giá (lưu trên trình duyệt này)',
    expandRow: 'Mở rộng',
    collapseRow: 'Thu gọn',
    listCapNote: 'Danh sách tối đa 200 đơn mới nhất theo bộ lọc ngày / workspace.',
    consultLocalHint: 'Ghi nhớ trên trình duyệt này; không đồng bộ giữa máy.',
    badgePayAwaiting: 'Chờ thanh toán',
    badgePayPartial: 'Đã đặt cọc',
    badgePayDone: 'Đã thanh toán đủ',
    btnConfirmDeposit: 'Xác nhận cọc',
    tableDetails: 'Chi tiết',
    modalTitle: 'Chi tiết đơn hàng',
    modalInternalIdLine: 'ID đơn nội bộ: {id}',
    modalConsultedCustomer: 'Đã liên hệ tư vấn khách',
    modalPaymentHeading: 'Thanh toán',
    modalOrderTotal: 'Tổng đơn',
    modalDepositNeed: 'Cần',
    modalDepositDeposited: 'Đã cọc',
    modalCodAfterDeposit: 'Số tiền thanh toán khi nhận hàng (sau cọc)',
    modalProductsHeading: 'Sản phẩm',
    modalColImage: 'Ảnh',
    modalColProduct: 'Sản phẩm',
    modalCopyAddress: 'Sao chép',
    toastAddressCopied: 'Đã sao chép địa chỉ',
    toastAddressCopyFailed: 'Không sao chép được địa chỉ',
    modalSkuPrefix: 'Mã SP (ID):',
    modalColor: 'Màu',
    modalSize: 'Size',
    modalQty: 'Số lượng',
    modalOrderUnavailable: 'Không thấy đơn trong danh sách hiện tại. Thử Tải lại hoặc đóng.',
    modalOrderNoteLabel: 'Ghi chú đơn',
    modalShippingAddressHeading: 'Địa chỉ nhận hàng',
    modalContactSectionTitle: 'Khách hàng & xử lý đơn',
  },
  partnerMessagingAi: {
    panelTitle: 'Trợ lý AI tự động',
    panelSubtitle:
      'Sau tin khách hệ thống chờ bạn trong khoảng thời gian cấu hình; hết giờ mà chưa trả lời thì AI dùng chính sách shop, giọng điệu và danh mục hàng trong kho để tư vấn. Một số tin được xử lý không qua model (danh sách đặt mua, hướng dẫn mua trong chat…).',
    tabSettings: 'Cài đặt',
    tabInventory: 'Hàng trong kho',
    tabUsage: 'Token API',
    usagePeriodLabel: 'Khoảng',
    usagePeriodDay: 'Ngày',
    usagePeriodWeek: 'Tuần',
    usagePeriodMonth: 'Tháng',
    usagePeriodScopeDay: 'trong 24 giờ qua',
    usagePeriodScopeWeek: 'trong 7 ngày gần nhất',
    usagePeriodScopeMonth: 'trong 30 ngày gần nhất',
    usageRangeModeLabel: 'Cách xem',
    usageRangeModeRolling: 'Theo khoảng lăn',
    usageRangeModeCalendar: 'Chọn ngày (UTC)',
    usageCalendarFromLabel: 'Từ ngày',
    usageCalendarToLabel: 'Đến ngày',
    usagePeriodScopeCalendar: 'từ {from} đến {to} (UTC, cả hai ngày tính trọn)',
    usageSectionCreditTitle: 'Trừ credit (ví & logo workspace)',
    usageSectionCreditIntro:
      'Các khoản đã trừ số dư trên tài khoản: nhật ký ví (giáo trình, English coach, …) và phí chuẩn hóa logo shop — khác với nhóm chỉ ghi nhận token API phía dưới.',
    usageSectionApiTitle: 'Gọi API (token / ảnh / embedding)',
    usageSectionApiIntro:
      'LLM inbox, tạo ảnh Nano Banana, embedding ảnh/văn bản, suy chất liệu từ ảnh sản phẩm… — thống kê theo usage đã ghi, không đi qua ví như phần trên.',
    tokenUsageIntro:
      'Tổng hợp {scope}. Mỗi dòng là một model API đã gọi khi AI trả lời bằng LLM (sau thời gian chờ).',
    tokenUsageEmpty: 'Chưa có lần gọi LLM nào trong khoảng thời gian này.',
    tokenUsageColProvider: 'Nhà cung cấp',
    tokenUsageColModel: 'Model',
    tokenUsageColCalls: 'Số lần gọi',
    tokenUsageColPrompt: 'Token đầu vào',
    tokenUsageColCompletion: 'Token đầu ra',
    tokenUsageColTotal: 'Tổng token',
    tokenUsageColEstimatedCost: 'Ước tính (₫)',
    tokenUsageCostDisclaimer:
      'Chi phí ước tính theo bảng giá Gemini Developer API (USD/1M token; có model bậc theo prompt >200k/lần gọi). Dòng thống kê gom nhiều lần gọi dùng bậc thấp (gần đúng). Model không khai báo dùng gemini-3-flash-preview. Tỷ giá: env PARTNER_AI_TOKEN_COST_USD_TO_VND.',
    tokenUsageEstimatedTotalLabel: 'Tổng ước tính (khoảng {amount} ₫)',
    tokenUsageDetailEstimatedTotalLabel: 'Cộng các dòng chi tiết (khoảng {amount} ₫)',
    tokenUsageByKindTitle: 'Theo loại gọi (usage_kind)',
    tokenUsageByKindIntro:
      'Gom tất cả lần ghi token LLM: inbox (job hội thoại), suy chất liệu, tạo ảnh inbox, v.v.',
    tokenUsageByDayTitle: 'Theo ngày (UTC)',
    tokenUsageByDayIntro: 'Tổng token và số lần gọi từng ngày theo giờ UTC.',
    tokenUsageColDay: 'Ngày (UTC)',
    tokenUsageCostByKindAndModelTitle: 'Chi tiết theo nhánh và model',
    tokenUsageCostByKindAndModelIntro:
      'Mỗi dòng là một cặp usage_kind + model; chi phí ước tính (₫) cộng từ token đã gom.',
    tokenUsageCostByWeekTitle: 'Theo tuần (UTC, từ thứ Hai)',
    tokenUsageCostByWeekIntro:
      'Gộp các ngày trong khoảng đã chọn theo tuần lịch UTC (tuần bắt đầu thứ Hai).',
    tokenUsageColWeekStart: 'Tuần từ (UTC)',
    tokenUsageCostByMonthTitle: 'Theo tháng (UTC)',
    tokenUsageCostByMonthIntro: 'Gộp theo tháng lịch UTC (YYYY-MM) trong khoảng đã chọn.',
    tokenUsageColMonthUtc: 'Tháng (UTC)',
    tokenUsageCostTablesNote:
      'Có thêm cột chi phí ước tính (₫) theo nhánh, ngày, tuần và tháng (UTC); cùng cách tính với tổng kỳ.',
    usageDetailApiTitle: 'Chi tiết từng lần gọi LLM (inbox)',
    usageDetailApiIntro:
      'Mỗi dòng là một lần gọi API sau thời gian chờ — ghi nhận token thực tế.',
    usageDetailColTime: 'Thời điểm',
    usageDetailColUsageKind: 'Nhánh',
    usageTokenKindInbox: 'LLM hội thoại',
    usageTokenKindMaterialInfer: 'Suy chất liệu (ảnh SP)',
    usageDetailEmpty: 'Chưa có lần gọi chi tiết trong khoảng này.',
    usageCreditLedgerTitle: 'Trừ credit (nhật ký ví — spend có ghi nhận)',
    usageCreditLedgerIntro:
      'Các khoản dùng cơ chế trừ idempotent trên tài khoản của bạn (ví dụ giáo trình, English coach). Khác với phần thống kê token API ở khối bên dưới.',
    usageCreditLedgerEmpty: 'Không có khoản trừ nào trong khoảng thời gian.',
    usageCreditColType: 'Loại (charge_type)',
    usageCreditColAmount: 'Tổng credit',
    usageCreditColCount: 'Số lần',
    usageCreditDetailTitle: 'Chi tiết các khoản trừ gần nhất',
    usageCreditColWhen: 'Lúc',
    usageCreditColSingle: 'Credit',
    usageLogoCreditTitle: 'Chuẩn hóa logo (workspace shop)',
    usageLogoCreditIntro: 'Trừ credit trực tiếp khi tạo/chỉnh logo brand; không đi qua bảng nhật ký spend ở trên.',
    usageLogoCreditEmpty: 'Chưa có lần chuẩn hóa logo có trừ credit trong khoảng này.',
    usageLogoColModel: 'Model',
    usageLogoColStatus: 'Trạng thái',
    usageNoOwnerHint: 'Workspace chưa gắn chủ tài khoản — không thống kê nhật ký trừ credit trên ví.',
    usageEmbedImageTitle: 'Embedding ảnh (Gemini) — tạo vector',
    usageEmbedImageIntro:
      'Mỗi lần gọi API embedContent cho ảnh: đồng bộ vector kho (inventory_sync) hoặc khách gửi ảnh tìm hàng (guest_image_search). Token lấy từ usageMetadata của Google, nếu thiếu thì ước lượng (xem GEMINI_IMAGE_EMBED_FALLBACK_TOKENS).',
    usageEmbedImageEmpty: 'Chưa có lần embed ảnh ghi nhận trong khoảng này.',
    usageEmbedTextTitle: 'Embedding văn bản (Gemini) — vector tìm kiếm',
    usageEmbedTextIntro:
      'Mỗi lần gọi API embedContent cho văn bản: đồng bộ vector kho (inventory_sync) hoặc embed tin khách để tìm hàng theo ngữ nghĩa (customer_query). Token lấy từ usageMetadata của Google.',
    usageEmbedTextEmpty: 'Chưa có lần embed văn bản ghi nhận trong khoảng này.',
    usageEmbedTextSourceQuery: 'Tin khách (tìm SP theo ngữ nghĩa)',
    usageEmbedColSource: 'Nguồn',
    usageEmbedSourceInventory: 'Đồng bộ kho',
    usageEmbedSourceGuest: 'Khách gửi ảnh (tìm SP)',
    usageEmbedColPromptSum: 'Tổng token (prompt)',
    usageEmbedColTotalSum: 'Tổng token (billable)',
    usageEmbedDetailTitle: 'Chi tiết từng lần embed',
    usageEmbedColInventoryId: 'Mã dòng kho',
    usageImageGenTitle: 'Nano Banana — tạo ảnh (inbox khách)',
    usageImageGenIntro:
      'Nano Banana là lối gọi nội bộ cho pipeline Gemini tạo ảnh (model gemini-3-pro-image-preview). Cả hai nhánh — ảnh chi tiết chất liệu/màu và ảnh thực tế / đời thường — đều lấy một ảnh sản phẩm trong kho làm đầu vào và model sinh một ảnh mới từ ảnh đó (không chỉ tái dùng file gốc). Mỗi lần gọi API sinh ảnh mới và lưu URL vào kho — cùng khoảng thời gian với bảng token LLM phía trên. Ảnh đã cache trong kho không tạo lại nên không tính thêm.',
    usageImageGenEmpty: 'Chưa có lượt tạo ảnh Nano Banana ghi nhận trong khoảng này.',
    usageImageGenColKind: 'Loại ảnh',
    usageImageGenKindMaterial: 'Chi tiết chất liệu / màu',
    usageImageGenKindRealUse: 'Ảnh thực tế / feedback khách',
    usageImageGenColCalls: 'Số lần gọi API',
    usageImageGenColTotalTokens: 'Tổng token (ước lượng billable)',
    usageImageGenTotalCallsLabel: 'Tổng lượt tạo ảnh (Nano Banana)',
    usageNanoBananaBadge: 'Nano Banana',
    usageNanoBananaModelHint: 'gemini-3-pro-image-preview · inbox',
    usageNanoBananaStatCalls: 'Lượt gọi tạo ảnh: {calls}',
    usageNanoBananaStatTokens: 'Tổng token (billable ước lượng): {tokens}',
    enableLabel: 'Bật trả lời tự động',
    enableHint: 'Khi tắt, chỉ còn tin nhắn thủ công từ bạn.',
    delayLabel: 'Chờ trước khi AI trả lời (giây)',
    delayHint:
      '0–30 giây: chờ trước khi lên lịch xử lý câu cần model AI (sau tin khách; không cộng thêm sau khi model đã trả lời). Mặc định 0. Nếu bạn trả lời trước, AI sẽ không gửi.',
    typingMinLabel: 'Độ trễ gõ tối thiểu (ms)',
    typingMaxLabel: 'Độ trễ gõ tối đa (ms)',
    typingHint:
      'Độ trễ ngẫu nhiên (ms) trước khi gửi tin điều phối tự động không đi qua model LLM (ví dụ gợi ý đặt mua, hướng dẫn mua trong chat). Tin DeepSeek không dùng bước này sau khi model đã trả kết quả. Đặt cả hai 0 để tắt.',
    productConsultationContextLabel: 'Ngữ cảnh & hướng dẫn AI của shop',
    productConsultationContextHint:
      'Một ô duy nhất cho toàn bộ thông tin AI luôn phải dùng: chính sách shop, giọng điệu trả lời, cách tư vấn, cách chốt đơn, đổi trả, cọc, giao hàng…',
    productConsultationContextPlaceholder:
      'Ví dụ: giọng lịch sự, xưng em — anh/chị. Luôn nhắc khách kiểm tra bảng size trước khi chốt. Hàng sale không đổi trả. Đơn may theo số đo cần cọc 50%. Khi khách lăn tăn, giải thích chính sách nhẹ nhàng, không ép mua…',
    disclosureToggle: 'Thêm dòng công bố tin nhắn từ AI',
    disclosureSuffixLabel: 'Nội dung công bố (cuối tin)',
    disclosureSuffixHint: 'Hiển thị ở cuối mỗi tin AI gửi để khách biết đây là trợ lý tự động.',
    saveSettings: 'Lưu cài đặt',
    loadError: 'Không tải được cấu hình AI.',
    faqKeywordsLabel: 'Từ khóa kích hoạt',
    faqKeywordsHint: 'Phân tách bằng dấu phẩy hoặc xuống dòng.',
    faqAnswerLabel: 'Câu trả lời',
    faqSortLabel: 'Thứ tự',
    faqActiveLabel: 'Đang dùng',
    inactiveBadge: 'Tắt',
    addFaq: 'Thêm FAQ',
    saveRow: 'Lưu',
    deleteRow: 'Xóa',
    cancelEdit: 'Hủy',
    inventoryName: 'Tên hàng / sản phẩm',
    inventorySku: 'Mã SKU (tuỳ chọn)',
    inventoryDesc: 'Thông số / mô tả ngắn',
    inventoryStock: 'Tồn kho / còn hàng',
    inventoryPrice: 'Giá (ghi chú text)',
    inventorySort: 'Thứ tự',
    inventoryImageUrl: 'Ảnh sản phẩm (URL)',
    inventoryImageUrlHint:
      'Dán link ảnh công khai bắt đầu bằng https:// (ví dụ ảnh trên drive, CDN, website). Hệ thống đưa URL vào ngữ cảnh AI; AI có thể gửi lại link cho khách.',
    inventoryProductUrl: 'Link trang sản phẩm (URL)',
    inventoryProductUrlHint:
      'Trang chi tiết trên website shop (https://…). Dùng trong kết quả tìm kiếm bằng ảnh và cột Excel “Link trang sản phẩm”.',
    inventoryProductVideoUrl: 'Video sản phẩm (URL)',
    inventoryProductVideoUrlHint:
      'Link YouTube (xem / embed) hoặc URL https://… tới file .mp4 / player CDN. Cùng cột “Video sản phẩm” trong Excel.',
    inventoryOpenProductPage: 'Mở trang sản phẩm',
    inventoryOpenProductVideo: 'Mở video',
    inventoryGuestConsultLink: 'Mở chat tư vấn',
    inventoryGuestConsultLinkHint:
      'Link trang chat NanoAI kèm ảnh & ngữ cảnh mặt hàng (đặt vào website, QR, quảng cáo). Khách mở sẽ tự gửi tin tư vấn kèm ảnh.',
    inventoryGuestConsultLinkNeedSave: 'Lưu mặt hàng trước để có link chat đầy đủ.',
    inventoryGuestConsultLinkCopied: 'Đã copy link chat.',
    inventoryConsultNote: 'Ghi chú khi tư vấn',
    inventoryConsultNoteHint:
      'Ví dụ: bảo hành 12 tháng, giao 2–3 ngày, đang giảm 10%, chỉ đổi nếu lỗi sản xuất, freeship đơn từ…',
    inventoryDescHint: 'Size, màu, chất liệu, kích thước, set/bộ gồm gì…',
    inventoryStockHint: 'Số lượng còn, hoặc “còn M/L”, “đặt thêm 5 ngày có hàng”…',
    inventoryFieldsGuide:
      'Gợi ý thêm (nhập vào mô tả hoặc ghi chú tư vấn): màu–size đang có; thời gian & phí giao; KM có thời hạn; đổi trả riêng từng mặt hàng; hướng dẫn bảo quản. Mọi dòng trong danh sách kho đều được đưa vào ngữ cảnh AI để tư vấn khách; muốn AI không nhắc tới một mặt hàng thì xóa dòng đó hoặc bỏ khỏi file nhập Excel. File mẫu có cột «Trạng thái»: 1 = thêm/cập nhật, 0 = xóa mặt hàng khỏi kho (khớp Mã SKU hoặc tên).',
    inventoryOpenApiLink: 'Hướng dẫn tích hợp API',
    inventoryOpenApiHint:
      'Backend website shop có thể đẩy kho vào NanoAI bằng JSON (chuẩn Open Catalog, tên trường gần Shopee). Cùng khóa Bearer với API tìm ảnh; không cần Vision.',
    inventoryDownloadTemplate: 'Tải file Excel mẫu',
    inventoryExportExcel: 'Xuất Excel',
    inventoryImportExcel: 'Nhập Excel',
    inventoryImportReplaceWarning:
      'Nhập Excel: trùng Mã SKU (không phân biệt hoa thường) với kho thì cập nhật, chưa có thì thêm mới. Không có SKU thì khớp theo tên với hàng trong kho cũng không SKU (nhiều dòng trùng tên: ưu tiên dòng đầu trùng trong kho). Cột «Trạng thái» (hoặc is_active): 1 = thêm/cập nhật; 0 = xóa mặt hàng đó khỏi kho (cần Mã SKU hoặc tên để khớp). Thứ tự hiển thị gán theo thứ tự dòng trong file nếu file không có cột Thứ tự. Hàng đang có mà không nằm trong file vẫn giữ nguyên. Tiếp tục?',
    inventoryImportSuccess: 'Đã xử lý {count} dòng: thêm {inserted}, cập nhật {updated}, xóa {deleted}.',
    inventoryImportFailed: 'Không nhập được từ Excel.',
    inventoryExcelImportUploading: 'Đang tải file Excel lên…',
    inventoryExcelImportSending: 'Đang gửi file…',
    inventoryErrInvalidXlsx: 'File không đúng định dạng Excel (.xlsx).',
    inventoryErrEmptySheet: 'Trang tính trống.',
    inventoryErrMissingName: 'Thiếu cột tên hàng (name / tên). Hãy dùng file mẫu.',
    inventoryErrNoRows:
      'Không có dòng dữ liệu hợp lệ (cần ít nhất một dòng có tên hàng để thêm/cập nhật, hoặc Trạng thái = 0 kèm Mã SKU hoặc tên để xóa).',
    inventoryErrNoFile: 'Chưa chọn file.',
    inventoryErrFileTooLarge: 'File quá lớn (tối đa ~20 MB).',
    inventoryErrTooManyRows: 'File có quá nhiều dòng. Tối đa {max} dòng mỗi lần import.',
    inventoryLoadMore: 'Tải thêm ({shown}/{total})',
    inventoryVectorSearchPlaceholder: 'Gõ mô tả (vd áo len, giày da…) — tìm ngữ nghĩa',
    inventoryVectorSearchHint:
      'Tìm theo vector văn bản (tên, giá, ghi chú) hoặc ảnh tương tự (vector ảnh). Cần đã «Đồng bộ ngay» và GOOGLE_API_KEY.',
    inventoryVectorSearchByText: 'Tìm',
    inventoryVectorSearchByImage: 'Ảnh',
    inventoryVectorSearchClear: 'Xóa lọc',
    inventoryVectorSearching: 'Đang tìm…',
    inventoryVectorSearchFailed: 'Không tìm được. Kiểm tra API key và vector đã đồng bộ.',
    inventoryVectorSearchNoResults: 'Không có mặt hàng khớp.',
    addInventory: 'Thêm mặt hàng',
    edit: 'Sửa',
    emptyFaq: 'Chọn câu hỏi mẫu bên dưới và chỉ cần nhập cách shop trả lời.',
    emptyInventory:
      'Chưa có mặt hàng nào. Thêm danh sách hàng có trong kho để AI chỉ tư vấn theo đúng hàng bạn khai báo.',
    inventoryProductCountSummary: 'Đang có {count} sản phẩm trong kho.',
    inventoryEmbeddingTitle: 'Tiến độ tạo vector ảnh',
    inventoryEmbeddingSummary: 'Đã tạo {done}/{eligible}. Còn thiếu {pending}. Lỗi {failed}.',
    inventoryEmbeddingSyncNow: 'Đồng bộ ngay',
    inventoryEmbeddingSyncRunning: 'Đang đồng bộ...',
    inventoryEmbeddingSyncDoneTitle: 'Đã chạy đồng bộ vector kho',
    inventoryEmbeddingSyncDoneBody: 'Đã xử lý {synced} mục (ảnh + văn bản). Lỗi {failed}.',
    inventoryEmbeddingAutoHint:
      'Trên trình duyệt: tự chạy nối nhiều lô khi trang Messaging → Cài đặt AI đang mở; đóng tab thì dừng. Chạy ngầm 24/7: bật cron — deploy Vercel (file vercel.json, biến CRON_SECRET + MESSAGING_INVENTORY_EMBED_CRON_SECRET) hoặc crontab curl POST /api/cron/messaging-inventory-embed-backfill — chi tiết .env.example.',
    inventoryTextEmbeddingTitle: 'Tiến độ tạo vector văn bản',
    inventoryTextEmbeddingSummary: 'Đã tạo {done}/{eligible}. Còn thiếu {pending}. Lỗi {failed}.',
    inventoryTextEmbeddingAutoHint:
      'Vector văn bản (tên + giá + ghi chú tư vấn) dùng cho tìm kiếm ngữ nghĩa trong chat. Cùng lệnh «Đồng bộ ngay» với vector ảnh; trang mở thì tự chạy nối lô khi còn thiếu ảnh hoặc văn bản; cron /api/cron/messaging-inventory-embed-backfill xử lý nền.',
    cronSetupHint:
      'Production: cấu hình cron gọi GET hoặc POST /api/cron/messaging-partner-ai kèm Bearer MESSAGING_PARTNER_AI_CRON_SECRET (ví dụ mỗi phút) và DEEPSEEK_API_KEY. Không có cron thì job vẫn tạo nhưng AI không bao giờ gửi. Môi trường `next dev` tự chạy xử lý job sau thời gian chờ (không cần cron). Chạy `next start` local mà chưa có cron: thêm MESSAGING_PARTNER_AI_DEV_WAKE=1 vào .env.',
    toggleStatusOn: 'Đang bật',
    toggleStatusOff: 'Đang tắt',
    aiEngineTitle: 'AI trả lời thông minh',
    aiEngineDescription:
      'Sau thời gian chờ, tin cần tư vấn gọi API DeepSeek (model {model}) với kho và chính sách bạn cài.',
    disclosureSwitchOn: 'Có ghi chú cuối tin',
    disclosureSwitchOff: 'Không ghi chú',
    faqPresetsIntro:
      'Các câu hỏi thường gặp khi mua đã được soạn sẵn. Bạn chỉ cần điền nội dung trả lời và bật “Đang dùng”; hệ thống tự nhận tin nhắn của khách tương tự (nhiều ngôn ngữ).',
    faqPresetSaveHint: 'Lưu từng mục sau khi chỉnh.',
    faqPresetAnswerRequired: 'Bật “Đang dùng” thì cần nhập nội dung trả lời.',
    faqCustomSectionTitle: 'Câu hỏi riêng của shop',
    faqCustomSectionIntro:
      'Thêm câu khách hay hỏi chỉ riêng cửa hàng bạn: ghi cách khách thường hỏi (để bạn nhớ), từ khóa để hệ thống nhận tin tương tự, và nội dung trả lời.',
    faqCustomAddTitle: 'Thêm câu hỏi riêng',
    faqCustomQuestionLabel: 'Cách khách hay hỏi (ghi nhớ cho bạn)',
    faqCustomQuestionHint: 'Tuỳ chọn. Ví dụ: “Có may thêm túi không?” — không dùng để tự động khớp tin.',
    faqCustomKeywordsRequired: 'Bật “Đang dùng” thì cần ít nhất một từ khóa (mỗi từ ≥ 2 ký tự), phân tách bằng dấu phẩy hoặc xuống dòng.',
    faqPresetQuestions: {
      stock: 'Còn hàng / hết hàng / còn size không?',
      shipping: 'Giao hàng, phí ship, bao lâu nhận được?',
      price: 'Giá bao nhiêu, có giảm giá không?',
      size_fit: 'Chọn size, có vừa không, bảng size?',
      payment: 'Thanh toán như thế nào (COD, chuyển khoản…)?',
      return_policy: 'Đổi trả, hoàn tiền thế nào?',
      order_track: 'Theo dõi đơn, mã vận đơn ở đâu?',
      warranty: 'Bảo hành ra sao?',
      authentic: 'Có phải hàng chính hãng không?',
      promo: 'Khuyến mãi, mã giảm giá hiện có?',
    },
    visionSearchTitle: 'Gợi ý sản phẩm khi khách gửi ảnh',
    visionSearchHint:
      'Dùng Vertex AI Vision Image Warehouse: mỗi shop lọc theo partner_id trong cùng corpus/index. Cần GCP (vùng us-central1 hoặc europe-west4), bucket GCS, service account có Vision AI + Storage; đặt GCS_VISION_CATALOG_BUCKET, VISION_WAREHOUSE_CORPUS_ID, VISION_WAREHOUSE_INDEX_ID, VISION_WAREHOUSE_INDEX_ENDPOINT_ID, tùy chọn GOOGLE_CLOUD_PROJECT_NUMBER. Cron analyze/reindex dùng cùng vùng với shop (lưu trong vision_warehouse_runner khi đồng bộ hoặc gỡ asset). Sau khi import ảnh, bắt buộc chạy cron /api/cron/vision-warehouse-reindex (cùng secret vision catalog) để analyze corpus và rebuild index — tìm theo ảnh chỉ đầy đủ sau bước này. Đồng bộ tích lũy; xóa dòng kho sẽ gỡ asset tương ứng và cần cron lại.',
    visionSearchEnable: 'Bật gợi ý theo ảnh',
    visionShopCountryLabel: 'Quốc gia / khu vực shop (gợi ý Vision)',
    visionShopCountryHint:
      'Chọn nơi shop chủ yếu hoạt động — hệ thống gợi ý vùng Google Cloud Vision phù hợp; gần đúng khu vực dự án GCP của bạn thì đồng bộ và tải dữ liệu ảnh catalog thường nhanh, ổn định hơn. Có thể chỉnh vùng thủ công bên dưới nếu biết rõ. Nếu không chắc, tránh chọn bừa — dùng «Tự chọn vùng Vision (nâng cao)» rồi nhờ người quản lý GCP/server chọn đúng vùng.',
    visionShopCountryCustom: 'Tự chọn vùng Vision (nâng cao)',
    visionShopCountryAdvancedHint:
      'Hãy chọn «Vùng Vision» và danh mục sản phẩm bên dưới cho đúng dự án GCP. Hiển thị khi không dùng preset quốc gia hoặc vùng đã lưu không khớp preset.',
    visionLocationLabel: 'Vùng Vision (region)',
    visionCategoryLabel: 'Danh mục sản phẩm (index)',
    visionBucketOverrideLabel: 'Bucket GCS (tuỳ chọn)',
    visionBucketOverrideHint: 'Để trống để dùng GCS_VISION_CATALOG_BUCKET trên server.',
    visionWarehouseInventorySummary:
      'Trong kho: {total} mặt hàng · {withImage} dòng có URL ảnh https (chỉ các dòng này mới được đưa lên Google Vision).',
    visionCatalogSyncStatsTitle: 'Trạng thái đồng bộ catalog ảnh (NanoAI → Google)',
    visionCatalogSyncStatsLineSynced: 'Đã khớp — lần đồng bộ sau sẽ bỏ qua (không tải lại): {n} dòng',
    visionCatalogSyncStatsLinePending: 'Còn chờ đẩy / cập nhật (đổi ảnh hoặc tên): {n} dòng',
    visionCatalogSyncStatsLineNoHttps: 'Không có URL ảnh https — không import được lên Vision: {n} dòng',
    visionCatalogSyncStatsLineExcluded: 'Đã loại trừ khỏi Vision: {n} dòng',
    visionCatalogSyncStatsExplain:
      'Hệ thống chỉ import các dòng «còn chờ»; dòng đã khớp checksum (ảnh + tên) được coi là đã đăng xong và không upload lại. Trên GCS, số file (object) thường khác số sản phẩm vì có thêm file jsonl và nhiều ảnh. Muốn biết đã có bao nhiêu asset trong corpus/index, xem Vision Warehouse trên Google Cloud. Link ảnh dạng //domain/... (không ghi https) vẫn dùng được: hệ thống tự thêm https.',
    visionSyncButton: 'Đồng bộ ảnh kho lên Google',
    visionSyncAutoWhenEnableHint:
      'Sau khi bật «Bật gợi ý theo ảnh» và lưu thành công, hệ thống tự đồng bộ liên tục (nhiều segment, resume) cho đến khi xong — thường không cần bấm thêm. Chỉ khi gặp lỗi hoặc trần an toàn tuyệt đối mới cần bấm «Đồng bộ ảnh kho lên Google».',
    visionSyncing: 'Đang đồng bộ…',
    visionSyncOk: 'Đã đồng bộ catalog ảnh.',
    visionIndexReady: 'Index sẵn sàng',
    visionIndexNotReady: 'Chưa đồng bộ hoặc lỗi index',
    visionLastSynced: 'Đồng bộ lần cuối',
    visionSyncErrorLabel: 'Lỗi gần nhất',
    visionWarehouseReindexPending:
      'Đã cập nhật ảnh trên Vision Warehouse; chờ cron rebuild chỉ mục (gọi /api/cron/vision-warehouse-reindex). Tìm theo ảnh sẽ đầy đủ sau khi cron chạy xong.',
    visionWarehouseCorpusUnsupportedType:
      'Corpus trong VISION_WAREHOUSE_CORPUS_ID không phải Image Warehouse loại ảnh (IMAGE): Google từ chối import (CORPUS_UNSUPPORTED_TYPE). Hãy tạo corpus Image Warehouse mới với type IMAGE theo tài liệu Google, gắn index/endpoint phù hợp, cập nhật ID trong .env và cài đặt AI, rồi đồng bộ lại. Corpus video hoặc loại khác không dùng được luồng ảnh này.',
    visionProductSearchMaintenanceTitle: 'Google Vision Product Search đang bảo trì / hạn chế',
    visionProductSearchMaintenanceDetail:
      'Google tạm không cho tạo hoặc cập nhật catalog qua Product Search cũ (lỗi phía Google). Tham khảo Image Warehouse: https://cloud.google.com/vision-ai/docs/image-warehouse-overview — Đơn xin dùng Product Search cũ: https://forms.gle/QPLzMdwSMCR2pPsq5 — NanoAI đã dùng Image Warehouse để đồng bộ ảnh kho; bạn chỉ thấy thông báo này khi phản hồi Google còn nhắc Product Search.',
    visionSyncToastImported: 'Đã đưa lên chỉ mục',
    visionSyncToastRemoved: 'Đã gỡ (mất URL ảnh hợp lệ)',
    visionSyncToastMore: 'Còn mặt hàng chưa xử lý — hãy bấm đồng bộ lần nữa.',
    visionSyncToastIdle: 'Không có thay đổi cần đồng bộ.',
    visionSyncChainedRounds: 'Đã gọi {n} lượt đồng bộ liên tiếp',
    visionSyncChainedStoppedMaxRounds:
      'Đã đạt giới hạn số lượt tự động — bấm đồng bộ để tiếp.',
    visionSyncChainedStoppedTimeout:
      'Đã dừng theo giới hạn thời gian (tránh treo trình duyệt) — bấm đồng bộ để tiếp.',
    visionSyncChainedAbortedSafety:
      'Đồng bộ tự động dừng do trần an toàn tuyệt đối — hãy bấm đồng bộ để tiếp hoặc kiểm tra lỗi.',
    visionBgSyncTitle: 'Đồng bộ nền lên Google (VPS / cron)',
    visionBgSyncHint:
      'Xếp hàng job trên server: VPS gọi định kỳ GET hoặc POST /api/cron/vision-catalog-sync kèm Bearer VISION_CATALOG_SYNC_CRON_SECRET (xem .env.example). Có thể đóng tab; khi xong hoặc lỗi, mở lại trang này để xem báo cáo chi tiết. Tuỳ chọn: crontab 1 lần/ngày gọi GET/POST /api/cron/vision-bg-sync-enqueue (cùng Bearer hoặc VISION_BG_SYNC_ENQUEUE_CRON_SECRET) để tự xếp hàng lại đồng bộ nền cho mọi shop đã bật gợi ý theo ảnh — không thay thế cron catalog-sync.',
    visionBgSyncButton: 'Bắt đầu đồng bộ nền',
    visionBgSyncUseResumeHint:
      'Nếu tab đang giữ cursor đồng bộ dở (đồng bộ trên trình duyệt trước đó), job nền sẽ tiếp từ cursor đó; nếu không có cursor, quét lại từ đầu.',
    visionBgSyncCancel: 'Hủy job nền',
    visionBgSyncDismiss: 'Đóng báo cáo',
    visionBgSyncStatusQueued: 'Đang chờ cron',
    visionBgSyncStatusRunning: 'Cron đang chạy',
    visionBgSyncStatusDone: 'Hoàn tất',
    visionBgSyncStatusError: 'Lỗi',
    visionBgSyncStatusIdle: 'Không có job nền',
    visionBgSyncReportTitle: 'Báo cáo đồng bộ nền',
    visionBgSyncFieldRounds: 'Số lượt API',
    visionBgSyncFieldImported: 'Đã đưa lên chỉ mục',
    visionBgSyncFieldRemoved: 'Đã gỡ',
    visionBgSyncFieldHasMore: 'Còn backlog',
    visionBgSyncFieldLastScanned: 'Cursor (mặt hàng cuối)',
    visionBgSyncFieldStopped: 'Lý do dừng',
    visionBgSyncFieldMessage: 'Thông điệp',
    visionBgSyncFieldServerError: 'Lỗi server',
    visionBgSyncBoolYes: 'Có',
    visionBgSyncBoolNo: 'Không',
    visionBgSyncPollingNote:
      'Đang chờ hoặc đang chạy nền: trang tự làm mới khoảng 8 giây (tab đang mở).',
    visionBgSyncProgressTitle: 'Tiến trình đăng sản phẩm lên Google',
    visionBgSyncProgressRatio: 'Đã đưa lên chỉ mục: {imported} / ~{total} mặt hàng có ảnh trong kho',
    visionBgSyncProgressHint:
      'Mẫu số ~ là số dòng kho đang có link ảnh (ước lượng). Số từ API có thể khác nếu một lượt xử lý nhiều thao tác.',
    visionBgSyncProgressNoImageRows: 'Kho chưa có mặt hàng nào có link ảnh — không ước lượng được tiến độ.',
    visionBgSyncQueuedExplain:
      '«Đang chờ cron» nghĩa là job đã xếp hàng trên database nhưng **chưa có lần xử lý nào** — số 0/500 là bình thường cho đến khi máy chủ gọi GET/POST `/api/cron/vision-catalog-sync` (Bearer secret) hoặc bạn bấm «Chạy một lượt trên server» bên dưới.',
    visionBgSyncPostRefreshExplain:
      'Các POST tới `/dashboard/messaging/settings` khoảng 8 giây/lần chỉ là **tải lại trạng thái** job (server action), không phải gọi Google Vision.',
    visionBgSyncRunSliceButton: 'Chạy một lượt trên server',
    visionBgSyncRunSliceHint:
      'Tương đương một lần gọi cron (có thể vài phút). Production vẫn nên cấu hình crontab trên VPS.',
    visionBgSyncRunSliceOk: 'Đã xử lý xong một lượt: {rounds} vòng API · {partners} shop trong hàng đợi được chạm tới.',
    visionBgSyncEnqueueOk: 'Đã xếp hàng đồng bộ nền. Cron VPS sẽ xử lý.',
    visionBgSyncToastDone: 'Đồng bộ nền Vision đã hoàn tất.',
    visionBgSyncToastError: 'Đồng bộ nền Vision gặp lỗi.',
    visionBgSyncAlreadyActive: 'Job nền đang chờ hoặc đang chạy.',
    visionBgSyncAlreadyActiveRefreshHint:
      'Đã làm mới trạng thái từ máy chủ. Nếu vẫn «Đang chờ» lâu, kiểm tra cron đồng bộ Vision trên VPS hoặc bấm «Hủy job nền».',
    visionBgSyncEnableVisionFirst: 'Hãy bật «Bật gợi ý theo ảnh» trước khi chạy đồng bộ nền.',
    visionBgSyncSaveSettingsFirst: 'Hãy lưu cài đặt AI (Messaging) ít nhất một lần trước.',
    visionBgSyncStopCompleted: 'Đã hoàn tất',
    visionBgSyncStopError: 'Lỗi xử lý',
    visionBgSyncStopCronSlice: 'Hết slice cron (lượt sau chạy tiếp)',
    visionBgSyncStopBadCursor: 'Cursor không hợp lệ',
    visionBgSyncServerErrCursor: 'Còn backlog nhưng thiếu id quét — đã dừng an toàn',
    visionBgSyncMsgCompleted: 'Đã đồng bộ xong catalog.',
    visionBgSyncMsgInProgress: 'Đang chạy — lượt cron sau sẽ tiếp tục.',
    visionBgSyncMsgBadCursor: 'Đã dừng: dữ liệu cursor từ máy chủ không nhất quán.',
    visionHealthPanelTitle: 'Health đồng bộ Vision',
    visionHealthStatusHealthy: 'Xanh',
    visionHealthStatusWarning: 'Vàng',
    visionHealthStatusStuck: 'Đỏ (kẹt)',
    visionHealthStatusIdle: 'Chưa có dữ liệu',
    visionHealthPendingCount: 'Pending cần xử lý: {n}',
    visionHealthChecksumDone: 'Checksum done: {done}/{total}',
    visionHealthLockAge: 'Tuổi lock',
    visionHealthLockBusy: 'Đang bị giữ ({sec}s)',
    visionHealthLockFree: 'Đang rảnh',
    visionHealthLockOwner: 'Lock owner',
    visionHealthOwnerUnknown: 'Không rõ owner',
    visionHealthHeartbeatAge: 'Tuổi heartbeat',
    visionHealthHeartbeatAlive: 'Đang sống ({sec}s)',
    visionHealthHeartbeatNone: 'Chưa có heartbeat',
    visionHealthLastProgress: 'Tiến triển gần nhất',
    visionHealthLastProgressNone: 'Chưa có',
    visionHealthUnlockButton: 'Mở khóa import',
    visionHealthUnlockOk: 'Đã mở khóa import Vision Warehouse.',
    visionEmergencyDisableButton: 'Tắt khẩn cấp Vision',
    visionEmergencyDisableConfirm:
      'Bạn có chắc muốn tắt toàn bộ Vision cho shop này? Hệ thống sẽ dừng đồng bộ nền, tắt gợi ý ảnh và mở khóa runner.',
    visionEmergencyDisableOk: 'Đã tắt toàn bộ Vision cho shop này.',
    visionInventoryDeleteRemovesIndexNote:
      'Xóa mặt hàng trong tab «Hàng trong kho» (nút xóa từng dòng) sẽ tự gỡ sản phẩm đó khỏi Google Vision — không cần tải file danh sách gỡ.',
    imageSearchApiTitle: 'API tìm sản phẩm bằng ảnh (cho website shop)',
    imageSearchApiHint:
      'Website khách gửi ảnh (multipart, field image hoặc file) kèm header Authorization: Bearer cùng khóa API. Trả về sản phẩm gần giống trong catalog Vision đã đồng bộ. Nên gọi từ backend shop để không lộ khóa trong trình duyệt.',
    imageSearchApiEnable: 'Bật API công khai',
    imageSearchApiKeyConfigured: 'Đã có khóa API.',
    imageSearchApiKeyMissing: 'Chưa có khóa — tạo và quản lý (che, xem, sao chép, xóa) tại trang Tích hợp API.',
    imageSearchApiEndpointLabel: 'Đường dẫn (thêm domain NanoAI của bạn phía trước)',
    imageSearchApiBaseUrlNote: 'Ví dụ: https://your-domain.com/api/messaging/partners/…/image-search',
    imageSearchApiDocHint:
      'POST, multipart: image (file). Tuỳ chọn: limit (1–25, mặc định 8). JSON: products[] gồm inventory_id, name, sku, image_url, product_url, score.',
    imageSearchApiGenerate: 'Tạo / làm mới khóa API',
    imageSearchApiGenerating: 'Đang tạo khóa…',
    imageSearchApiKeyCreated: 'Đã tạo khóa (đã thử copy vào clipboard). Lưu ngay — không hiện lại.',
    imageSearchApiManageKeysLink: 'Mở trang Tích hợp API — quản lý khóa',
    guestPurchaseFlowLabel: 'Cách khách mua hàng trên chat NanoAI',
    guestPurchaseFlowHint:
      '«Trong chat»: khách bấm Mua hàng và đặt/QR như hiện tại. «Trên website shop»: bấm Mua hàng mở trang sản phẩm (URL trong kho) trên tab mới — phù hợp khi thanh toán và vận chuyển đã cấu hình trên web.',
    guestPurchaseFlowInChat: 'Đặt trong chat (form + thanh toán NanoAI)',
    guestPurchaseFlowExternal: 'Mở trang shop (website) khi bấm Mua hàng',
  },
  partnerGuestChat: {
    notFoundTitle: 'Không tìm thấy trang chat',
    notFoundDescription: 'Liên kết không hợp lệ hoặc shop đã tắt tính năng.',
    pageTitleSuffix: 'Chat trên NanoAI',
    metaDescription: 'Nhắn tin với {shop} trên NanoAI — cùng hộp thư với Facebook, Zalo và web shop.',
    shopLabel: 'Cửa hàng',
    subline:
      'Bạn đang chat trên NanoAI; cửa hàng trả lời trong trang quản lý của họ. Đăng nhập Google để đồng bộ tin nhắn trên mọi thiết bị.',
    placeholder: 'Nhập tin nhắn…',
    send: 'Gửi',
    emptyThread: 'Chưa có tin nhắn. Gửi câu đầu tiên bên dưới.',
    loadError: 'Không tải được tin nhắn.',
    sendError: 'Không gửi được tin nhắn.',
    pollNote: 'Phản hồi từ cửa hàng có thể hiện sau vài giây.',
    guestAttachPhoto: 'Gửi ảnh',
    guestTakePhoto: 'Chụp ảnh',
    guestRemoveAttachment: 'Bỏ ảnh',
    guestUploading: 'Đang tải ảnh…',
    guestImageTooLarge: 'Ảnh quá lớn (tối đa ~10 MB).',
    guestImageInvalidType: 'Chỉ hỗ trợ JPG, PNG, WebP hoặc GIF.',
    guestCaptionHint: 'Có thể thêm chú thích kèm ảnh (tuỳ chọn).',
    loginPromptTitle: 'Đăng nhập để chat',
    loginPromptDescription:
      'Đăng nhập bằng email để nhắn tin với cửa hàng và xem lại hội thoại trên thiết bị khác.',
    signInWithGoogle: 'Đăng nhập',
    linkMyShops: 'Tin nhắn của tôi',
    linkMyOrders: 'Đơn hàng của tôi',
    widgetShoppingCart: 'Giỏ hàng',
    widgetLanguageSelectAria: 'Ngôn ngữ',
    sendKeyboardHint: 'Enter gửi · Shift+Enter xuống dòng · Ctrl+V dán ảnh',
    tryOnOpen: 'Thử đồ',
    tryOnTitle: 'Thử đồ ngay trong chat',
    tryOnModelPhoto: 'Ảnh người mẫu',
    tryOnGarmentPhoto: 'Ảnh trang phục',
    tryOnGarmentSourceTitle: 'Chọn nguồn ảnh trang phục',
    tryOnGarmentSourceDevice: 'Chọn ảnh trong máy',
    tryOnGarmentSourceRecent: 'Chọn từ 20 ảnh shop đề xuất gần nhất',
    tryOnGarmentRecentEmpty: 'Chưa có ảnh đề xuất gần đây.',
    tryOnGenerate: 'Tạo ảnh thử đồ',
    tryOnGenerateWithCost: 'Tạo ảnh thử đồ (-{credits} credits)',
    tryOnPreparing: 'Đang tạo ảnh thử đồ…',
    tryOnNeedBoth: 'Cần đủ ảnh người mẫu và ảnh trang phục.',
    tryOnGarmentLimitReached: 'Bạn chỉ có thể chọn tối đa {max} món trang phục.',
    tryOnGarmentItemsLabel: 'món',
    tryOnFailed: 'Không tạo được ảnh thử đồ.',
    tryOnReady: 'Đã tạo ảnh thử đồ. Bạn có thể gửi ngay trong chat.',
    tryOnChargedToast: 'Đã trừ {cost} credits. Còn lại {remaining} credits.',
    tryOnCreditsBalanceLabel: 'Số dư: {credits}',
    tryOnTopUpCredits: 'Nạp credit',
    tryOnResultViewLarge: 'Xem ảnh thử đồ lớn',
    tryOnResultDownload: 'Tải xuống',
    tryOnEmbedGarmentFromPage: 'Ảnh sản phẩm đang xem',
    tryOnEmbedGarmentFromPageWithSku: 'Sản phẩm đang xem (SKU: {sku})',
    tryOnEmbedOnlyFlowHint:
      'Chọn ảnh người của bạn (lần sau trình duyệt này nhớ trong khung chat). Ảnh trang phục đã lấy từ sản phẩm đang xem. Thử đồ tốn credits — nạp bằng nút trong cùng khung chat (cùng tab shop, không cần mở tab NanoAI riêng).',
    guestCreditWalletLoginTitle: 'Đăng nhập để dùng ví credit',
    guestCreditWalletLoginDescription:
      'Thử đồ và nạp credit cần xác thực email (mã OTP). Hoàn tất bên dưới để tiếp tục.',
    toastGuestTopUpLoginRequired: 'Vui lòng đăng nhập bằng email (OTP) trước khi nạp credit.',
    toastTryOnInsufficientCredits: 'Không đủ credit. Vui lòng nạp thêm rồi thử lại.',
    guestAuthPromptTitle: 'Đăng nhập để lưu lịch sử lâu dài',
    guestAuthPromptBody: 'Bạn vẫn có thể chat ngay. Đăng nhập giúp đồng bộ hội thoại khi đổi máy/trình duyệt.',
    guestAuthEmailPlaceholder: 'Nhập email của bạn',
    guestAuthSendMagicLink: 'Gửi link đăng nhập',
    guestAuthSendOtp: 'Gửi mã OTP',
    guestAuthOtpPlaceholder: 'Nhập mã OTP 6 số',
    guestAuthVerifyOtp: 'Đăng nhập',
    guestAuthRequiredAfterLimit: 'Bạn đã nhắn {count} tin. Vui lòng xác thực email để tiếp tục chat.',
    guestAuthEmailSent: 'Đã gửi email xác thực. Vui lòng kiểm tra hộp thư.',
    guestAuthOtpInvalid: 'Mã OTP không hợp lệ hoặc đã hết hạn.',
    guestAuthRateLimited: 'Bạn thao tác quá nhanh. Vui lòng thử lại sau {seconds} giây.',
    guestAuthRememberDeviceHint:
      'Tin cậy thiết bị/trình duyệt này lâu dài (đăng nhập lại cùng email sẽ bỏ qua OTP).',
    guestAuthVerifyingProgress: 'Đang đăng nhập, vui lòng chờ...',
    shopTypingHint: 'Cửa hàng đang soạn tin…',
    consultLinkShopPreparingHint: 'Cửa hàng đang gửi thông tin sản phẩm…',
    similarAlternativesTemplateMessage:
      'Bên em có thêm một số mẫu khác bên dưới, anh/chị tham khảo ạ.',
    productSearchTemplateMessage:
      'Dạ, em gửi anh/chị các mẫu phù hợp bên dưới ạ. Anh/chị xem thẻ, nếu ưng mẫu nào có thể bấm Mua ngay để lên đơn trong chat hoặc bấm Tư vấn để hỏi thêm nhé.',
    visionPickHint: '',
    visionPickBusy: 'Đang gửi…',
    visionPickError: 'Không gửi được lựa chọn. Thử lại.',
    visionProductLink: 'Tư vấn',
    visionProductBuy: 'Mua ngay',
    visionProductViewDetails: 'Xem chi tiết',
    visionProductVideo: 'Video',
    visionVideoCloseAria: 'Đóng video',
    productShelfButton: 'Sản phẩm',
    urlProductContextChipLabel: 'Gửi mã SP đang xem',
    urlProductContextChipAria:
      'Gửi shop ngữ cảnh sản phẩm trên trang này (mã, ảnh). Bỏ qua nếu bạn nhập tin nhắn khác trước.',
    urlProductContextChipDismissAria: 'Đóng — không gửi mã sản phẩm đang xem',
    productShelfTitle: 'Sản phẩm bạn quan tâm gần đây',
    productShelfEmpty:
      'Chưa có sản phẩm gợi ý. Xem tin từ shop hoặc gửi ảnh để nhận gợi ý nhé.',
    productShelfSearchPlaceholder: 'Tìm trong kho (mô tả, kiểu dáng…)',
    productShelfSearchButton: 'Tìm',
    productShelfSearchImage: 'Ảnh',
    productShelfSearchClear: 'Xóa lọc',
    productShelfSearching: 'Đang tìm…',
    productShelfSearchFailed: 'Không tìm được. Thử lại sau khi đồng bộ vector kho.',
    productShelfSearchNoResults: 'Không có sản phẩm khớp.',
    productShelfBuy: 'Mua',
    purchaseOpenSiteToast: 'Đã mở trang đặt hàng trên website shop trong tab mới.',
    purchaseMissingProductUrlToast: 'Mẫu này chưa có link trang sản phẩm — shop vui lòng thêm URL trong kho.',
    productConsultProductRefFromSku: 'mã sản phẩm {sku}',
    productConsultProductRefFromName: 'mẫu {name}',
    productConsultAskShipping:
      'Em nhận tin về {productRef} — anh/chị muốn hỏi giao hàng hay chi tiết sản phẩm trước ạ?',
    productConsultAskDetail:
      'Em nhận tin tư vấn về {productRef} — anh/chị muốn hỏi thêm điểm nào ạ?',
    productConsultAskDetailFromSku:
      'Mình quan tâm mẫu này "{sku}", shop tư vấn cho mình nhé.',
    pageContextInboundConsultNoSku:
      'Chào anh/chị! Anh/chị vừa vào từ trang sản phẩm — nhắn em thêm để em hỗ trợ đúng ý nhé ạ.',
    pageContextInboundImageOnlyNote:
      'Khách mở link sản phẩm — ảnh đã gửi kèm tin để shop tư vấn (giống đính ảnh).',
    guestProfileDialogTitle: 'Giúp shop xưng hô đúng ý bạn',
    guestProfileDialogDescription:
      'Thông tin lưu một lần trên tài khoản NanoAI (dùng cho mọi shop): ngày sinh và giới tính (nam hoặc nữ) để xưng hô anh/chị và gợi ý tư vấn phù hợp. Bạn có thể bỏ qua và nhập sau.',
    guestProfileBirthLabel: 'Ngày sinh',
    guestProfileBirthDayPlaceholder: 'Ngày',
    guestProfileBirthMonthPlaceholder: 'Tháng',
    guestProfileBirthYearPlaceholder: 'Năm',
    guestProfileGenderLabel: 'Giới tính',
    guestProfileGenderMale: 'Nam',
    guestProfileGenderFemale: 'Nữ',
    guestProfileSave: 'Lưu',
    guestProfileRemindLater: 'Để sau',
    guestProfileInvalid: 'Vui lòng chọn đủ ngày sinh và giới tính.',
  },
  messagingMyChats: {
    pageTitle: 'Tin nhắn của tôi',
    pageDescription: 'Các cửa hàng bạn đã nhắn qua NanoAI.',
    emptyList: 'Bạn chưa có hội thoại nào. Mở liên kết chat của cửa hàng để bắt đầu.',
    openChat: 'Mở chat',
    lastActivity: 'Hoạt động gần nhất',
    loadFailed: 'Không tải được danh sách.',
    backHomeAria: 'Về trang chủ',
  },
  messagingMyOrders: {
    pageTitle: 'Đơn hàng của tôi',
    composerOrdersLabel: 'Đơn hàng',
    pageDescription: 'Đơn đặt qua chat NanoAI — trạng thái thanh toán và giao hàng theo từng đơn.',
    emptyList: 'Chưa có đơn hàng. Đặt trong chat với shop để thấy đơn tại đây.',
    loadFailed: 'Không tải được danh sách.',
    backHomeAria: 'Về trang chủ',
    openChat: 'Mở chat',
    createdAt: 'Đặt lúc',
    totalLabel: 'Tổng đơn',
    payStatus: 'Thanh toán',
    shipStatus: 'Giao hàng',
    stAwaiting: 'Chờ đặt cọc (chuyển khoản)',
    stChecking: 'Đang xác nhận CK',
    stPaid: 'Đã thanh toán',
    stManual: 'Chờ shop xử lý',
    stCancelled: 'Đã hủy',
    shPending: 'Chờ xử lý',
    shConfirmed: 'Đã xác nhận',
    shPacking: 'Đang đóng gói',
    shShipping: 'Đang giao',
    shDelivered: 'Đã giao',
    shReturned: 'Hoàn / trả',
    shCancelled: 'Hủy giao',
    orderIdLabel: 'Mã đơn',
    transferMemoLabel: 'Mã CK (nội dung chuyển khoản)',
    qtyLabel: 'Số lượng',
    colorLabel: 'Màu / mẫu',
    sizeLabel: 'Size',
    noteLabel: 'Ghi chú',
    unitPriceLabel: 'Đơn giá',
    depositPctLabel: 'Tỷ lệ cọc',
    amountDueLabel: 'Cần thanh toán (cọc)',
    paidRecordedLabel: 'Đã thanh toán',
    balanceOnDeliveryLabel: 'Cần thanh toán khi nhận hàng (còn lại)',
    shipToLabel: 'Giao đến',
    productPhotoAlt: 'Ảnh sản phẩm đã đặt',
    variantImagesSectionLabel: 'Ảnh màu / mẫu đã chọn',
    totalQtySummaryLabel: 'Tổng số lượng',
    viewTimelineButton: 'Xem timeline đơn hàng',
    timelineTitle: 'Timeline đơn hàng',
    timelineLoadFailed: 'Không tải được lịch sử đơn.',
    timelineEmpty: 'Chưa có sự kiện nào.',
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
    education: 'Giáo dục & Đào tạo',
    image_edit: 'Chỉnh sửa ảnh',
    design_creative: 'Thiết kế & Sáng tạo',
    three_d_special: '3D & Chuyên dụng',
    music_ai: 'Âm nhạc AI',
    system: 'Hệ thống',
  },
  tool: {
    try_on: 'Thử đồ',
    restore_image: 'Phục dựng ảnh',
    enhance_image: 'Làm nét ảnh',
    beautify_image: 'Làm đẹp ảnh',
    merge_image: 'Ghép ảnh',
    create_banner: 'Tạo banner',
    wedding_invitation_ai: 'Tạo thiệp cưới AI',
    text_to_image: 'Tạo ảnh bằng chữ',
    infographic_from_book: 'Infographic từ sách',
    sketch_to_image: 'Dựng ảnh từ phác thảo',
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
    replace_product_bg: 'Thay nền ảnh',
    edit_image_by_request: 'Sửa ảnh theo yêu cầu',
    product_3d_sample: 'Ảnh sản phẩm mẫu 3D',
    model_3d_from_image: 'Mô hình 3D từ ảnh',
    create_video_from_image: 'Tạo video AI (Veo)',
    flow_music_veo_video: 'Video âm nhạc AI (Flash + Veo)',
    interior_exterior: 'Nội ngoại thất',
    my_house: 'Kiểu nhà bạn muốn xây',
    portrait_photo: 'Ảnh chân dung',
    expand_frame: 'Mở rộng khung hình',
    face_swap: 'Hoán đổi khuôn mặt',
    translate_document_image: 'Dịch ảnh tài liệu',
    lyria3_instrumental_song: 'Tạo bài nhạc (có lời / không lời)',
    meeting_recorder_report: 'Ghi âm & báo cáo cuộc họp',
    ai_language_learning: 'Học ngoại ngữ AI',
    create_curriculum: 'Tạo giáo trình',
    my_curricula: 'Giáo trình của tôi',
    online_exam: 'Tạo bài thi trực tuyến',
    homework_online: 'Tạo bài tập về nhà',
    classes: 'Lớp học',
    try_on_1: 'Thử đồ 1 người',
    try_on_2: 'Thử đồ 2 người',
    try_on_3: 'Thử đồ 3 người',
    try_on_4: 'Thử đồ 4 người',
    try_on_5: 'Thử đồ 5 người',
    image_result_display: 'Hiển thị kết quả ảnh',
    admin: 'Quản trị',
  },
  creationSidebar: {
    back: 'Quay lại',
    relatedTitle: 'Liên quan',
    popularTitle: 'Nhiều người dùng',
  },
  imageResultDisplay: {
    pageTitle: 'Cách xem ảnh trước & sau',
    pageIntro:
      'Mặc định: kéo so sánh một khung (giống Thiết kế nội ngoại thất). Có thể chọn hai ảnh cạnh nhau. Thiết lập áp cho mọi công cụ chỉnh ảnh; có thể đổi tạm ngay trên từng trang kết quả.',
    modeSplitTitle: 'Hai ảnh cạnh nhau',
    modeSplitDesc: 'Ảnh gốc và ảnh sau xử lý hiển thị riêng, bấm ảnh để xem phóng to như trước.',
    modeCompareTitle: 'Kéo so sánh (mặc định)',
    modeCompareDesc: 'Một khung: kéo thanh giữa — trái ảnh gốc, phải kết quả; có fullscreen như các công cụ ảnh khác đồng bộ kiểu này.',
    persistNote: 'Lưu trong trình duyệt của bạn (thiết bị này).',
  },
  taskHub: {
    pageTitle: 'Tác vụ & hàng đợi',
    pageDescription:
      'Theo dõi xử lý đang chạy (ảnh, video, dịch hàng loạt, giáo trình) và mở nhanh từng công cụ.',
    sectionRunning: 'Đang xử lý',
    sectionRecent: 'Vừa hoàn tất hoặc lỗi (7 ngày)',
    emptyRunning: 'Không có tác vụ đang chạy.',
    emptyRecent: 'Chưa có tác vụ hoàn tất gần đây trong 7 ngày.',
    openTool: 'Mở công cụ',
    batchSummary: '{done}/{total} xong',
    itemsCount: '{n} mục',
    worksheetSection: 'Bài tập / giáo trình (chạy nền)',
    worksheetParseSgk: 'Trích SGK',
    worksheetQuiz: 'Tạo quiz theo bước',
    worksheetEssay: 'Chấm / tạo bài luận',
    worksheetUnknownType: 'Tác vụ worksheet',
    statusProcessing: 'Đang chạy',
    statusFailed: 'Lỗi',
    statusCompleted: 'Xong',
    statusCancelled: 'Đã hủy',
    statusMixed: 'Một phần',
    hintTranslateProgress:
      'Lô dịch ảnh: mở trang công cụ để xem tiến độ chi tiết, tải ZIP và hủy lô.',
    linkProcessedImages: 'Ảnh đã xử lý',
    linkTranslateHistory: 'Lịch sử dịch ảnh',
    linkTranslateProgress: 'Tiến trình dịch ảnh',
    autoRefreshNote:
      'Có tác vụ đang chạy: tự làm mới khoảng 8 giây một lần (tab đang mở). Hết hàng đợi: chỉ cập nhật khi bạn chuyển lại tab này.',
  },
  meetingRecorder: {
    cardTitle: 'Ghi âm cuộc họp → báo cáo AI',
    cardDescription:
      'Ghi âm trên trình duyệt không tính phí. Tên cuộc họp tự lưu trên thiết bị khi bạn bấm bắt đầu ghi. Chỉ khi tạo báo cáo AI hệ thống mới trừ credits theo độ dài ghi âm.',
    freeRecordingNote: 'Ghi âm và lưu tên cuộc họp: không trừ credits.',
    silenceAutoStopNote:
      'Nếu không phát hiện tiếng nói trong 5 phút liên tục, ghi âm sẽ tự dừng và lưu bản ghi như khi bạn bấm dừng.',
    autoStoppedBySilence: 'Đã tự dừng ghi âm: không phát hiện tiếng nói trong 5 phút.',
    segmentAutoSplitNote:
      'Cứ mỗi 5 phút hệ thống tự kết thúc đoạn hiện tại và bắt đầu đoạn mới (cùng micro), không cần cắt file trên máy chủ.',
    segmentRotatedToast: 'Đã tự chuyển sang đoạn ghi mới (5 phút).',
    chargeNote:
      'Tạo báo cáo AI (biên bản + tóm tắt): 5 phút đầu 1 credit; từ phút thứ 6 trở đi mỗi phút thêm 0,2 credit (làm tròn lên phần vượt).',
    sessionNote:
      'Bản ghi được lưu trên máy chủ tối đa {days} ngày rồi tự xóa. Trong phiên này bạn vẫn nghe/tải file cục bộ; tên cuộc họp tự lưu trên thiết bị khi bạn bấm bắt đầu ghi.',
    meetingTitleLabel: 'Tên cuộc họp',
    meetingTitlePlaceholder: 'Ví dụ: Họp dự án Q1',
    savingRecording: 'Đang lưu bản ghi lên máy chủ…',
    saveRecordingFailed: 'Không lưu được bản ghi. Kiểm tra mạng và thử lại.',
    retrySaveRecording: 'Thử lưu lại bản ghi',
    needServerRecording: 'Cần lưu bản ghi lên máy chủ trước khi tạo báo cáo AI.',
    startRecording: 'Bắt đầu ghi',
    stopRecording: 'Dừng ghi',
    stopRecordingConfirmTitle: 'Xác nhận dừng ghi âm',
    stopRecordingConfirmDescription:
      'Chỉ bấm xác nhận khi cuộc họp đã thực sự ngừng. Bản ghi sẽ được lưu; credits chỉ trừ khi bạn tạo báo cáo AI.',
    stopRecordingConfirmOk: 'Xác nhận — cuộc họp đã ngừng',
    stopRecordingConfirmContinue: 'Tiếp tục ghi',
    recording: 'Đang ghi…',
    idleHint: 'Cho phép truy cập micro khi trình duyệt hỏi.',
    recordingTimeLabel: 'Đang ghi: {duration}',
    durationLabel: 'Thời lượng: {duration}',
    createNewMeeting: 'Tạo cuộc họp mới',
    stopBeforeNewMeeting: 'Dừng ghi âm trước khi tạo cuộc họp mới.',
    downloadRecording: 'Tải file ghi âm',
    generateReport: 'Tạo báo cáo AI',
    reportLanguageLabel: 'Ngôn ngữ báo cáo',
    estimatedCost: 'Ước tính: {credits} credits',
    costExplain:
      '5 phút đầu: 1 credit; sau đó mỗi phút (làm tròn lên phần thời gian vượt quá 5 phút) thêm 0,2 credit — ví dụ 5:47 ≈ 1,2 credit.',
    needRecording: 'Hãy ghi âm ít nhất vài giây trước khi tạo báo cáo.',
    processing: 'Đang phân tích âm thanh…',
    reportHeading: 'Báo cáo cuộc họp',
    briefReportHeading: 'Báo cáo ngắn (ý chính)',
    fullReportHeading: 'Báo cáo chi tiết',
    transcriptHeading: 'Phiên âm',
    copy: 'Sao chép',
    copied: 'Đã sao chép',
    downloadMd: 'Tải báo cáo (.md)',
    downloadBriefMd: 'Tải bản ngắn (.md)',
    micError: 'Không bật được micro. Kiểm tra quyền trình duyệt.',
    fileTooLarge: 'File âm thanh quá lớn (giới hạn 20MB).',
    genericError: 'Có lỗi xảy ra. Thử lại sau.',
    insufficientCredits: 'Không đủ credits.',
  },
  flowMusicVeo: {
    pageTitle: 'Tạo video âm nhạc AI (lời Flash + Veo)',
    metaDescription:
      'Sinh lời theo từng đoạn (Flash + JSON), phong cách Lyria có lời, clip đầu từ ảnh rồi Veo kéo dài nối tiếp — mỗi bước một prompt kèm lời đoạn đó. Một file MP4 liền. Âm thanh do Veo sinh.',
    headline: 'Video âm nhạc — lời (Flash) + hình & nhạc (Veo)',
    subtitle:
      'Bước 1: thể loại (Flash) + ảnh/gợi ý. Bước 4: các ô lời xếp liền; «Mở ô lời …» hoặc «Tạo video dài thêm ~8 giây» để thêm đoạn; sinh lời hoặc gõ tay — dưới mỗi đoạn là Veo (ảnh rồi nối video).',
    stepLyricsTitle: 'Bước 1 — Thể loại nhạc & gợi ý (Flash sinh lời)',
    stepLyricsBody:
      'Chỉ thể loại + ảnh + gợi ý cho Flash (không chọn giọng/tempo ở đây). Bước 4: các ô lời hiện cùng lúc; thêm ô bằng «Mở ô lời …» hoặc «Tạo video dài thêm ~8 giây» (tối đa 20). «Sinh lời đoạn …» hoặc gõ tay.',
    lyricsModeLabel: 'Cách sinh lời',
    lyricsModeAllAtOnce: 'Một lần — đủ N đoạn',
    lyricsModeProgressive: 'Từng đoạn — đến đâu sinh đến đó',
    lyricsProgressiveHelp:
      'Bước 1 — chọn thể loại → ảnh → gợi ý; xuống bước 4: các ô lời xếp liền từ trên xuống, bấm «Sinh lời đoạn …» tại ô đang cần. Giọng/tempo/cấu trúc chọn khi tạo video (Veo). «Mở ô lời đoạn …» thêm một hàng trống (tối đa 20). Mỗi lần sinh: {credits} credit — tách với nút video.',
    openNextLyricsSegmentButton: 'Mở ô lời đoạn {k}',
    segmentVideoSubBlockHint: 'Video Veo (luồng riêng, sau khi lời đã ổn):',
    progressiveStyleOnlyInStep1Note:
      'Bước 1 chỉ chọn thể loại nhạc cho Flash sinh lời; giọng, tempo, cấu trúc… chọn khi tạo video ở bước 4.',
    progressiveExtendStyleLockedNote:
      'Thể loại nhạc giữ như đã chọn khi sinh lời; chỉnh giọng/tempo/cấu trúc bên dưới cho từng bước Veo. Có thể thêm gợi ý hình / máy / nhân vật (tùy chọn).',
    lyricsGenreOnlyHelp:
      'Chỉ đưa vào prompt sinh lời (Flash). Giọng, tempo, cấu trúc… chọn khi tạo video (Veo), không gửi lúc sinh lời.',
    veoStyleFieldsIntro:
      'Giọng, ngôn ngữ hát, tempo và cấu trúc — gửi Veo cho clip này (không dùng khi sinh lời).',
    progressiveVideoSectionTitle: 'Tạo video — đoạn {k}',
    generateNextSegmentButton: 'Sinh lời đoạn {k} / {n}',
    successLyricsOneSegment: 'Đã sinh đoạn {k}/{n}. Tiếp tục hoặc xuống bước sau khi đủ các đoạn.',
    incrementalPlanFrozenHelp: 'Đã bắt đầu sinh từng đoạn — không đổi số đoạn. «Làm lại từ đầu» để đổi.',
    lyricsModeFrozenHint: 'Đã có lời từ AI — không đổi luồng sinh. Dùng «Làm lại từ đầu».',
    progressiveNoNextSegment: 'Đã đủ các ô đoạn — xuống bước 4 hoặc «Làm lại từ đầu».',
    hintLabel: 'Gợi ý chủ đề / câu chuyện (tùy chọn nếu có ảnh)',
    hintPlaceholder: 'VD: Bài pop tiếng Việt về mùa hè và biển, tâm trạng vui…',
    lyricsImageHelp: 'Ảnh tham chiếu tâm trạng (tùy chọn) — Flash đọc ảnh để gợi ý lời.',
    generateLyricsButton: 'Sinh lời (Flash)',
    generatingLyrics: 'Đang sinh lời…',
    lyricsNeedHintOrImage: 'Cần gợi ý ít nhất 4 ký tự hoặc một ảnh.',
    successLyrics: 'Đã sinh lời — hãy kiểm tra và chỉnh sửa.',
    successLyricsBlocks: 'Đã sinh {n} đoạn lời liên kết (JSON) — kiểm tra từng ô ở bước 4.',
    lyricsBlockCountLabel: 'Số đoạn lời / clip 8s',
    lyricsBlockCountHelp: 'Flash sinh đúng số đoạn này (JSON); nên trùng số ô lời ở bước 4 và số lần nối Veo.',
    openingLyricsLabel: 'Đoạn lời cho clip 8 giây đầu',
    openingLyricsHelp:
      'Nhập đủ vài dòng trong ô đoạn 1 (khoảng ~8 giây hát). Prompt Veo gồm đoạn này và mô tả phong cách ở phần tạo video.',
    fillOpeningButton: 'Lấy đoạn đầu từ toàn bộ lời',
    assignOpeningToSegment1: 'Đã gán lời đoạn đầu vào ô đoạn 1.',
    styleBlockTitle: 'Bước 2 — Phong cách âm nhạc (giống Lyria có lời)',
    styleBlockBody:
      'Các lựa chọn được đưa vào prompt Veo dạng mô tả tiếng Anh (thể loại, giọng, tempo, cấu trúc…). Không tạo file MP3 — Veo tự sinh âm thanh video.',
    genreLabel: 'Thể loại',
    voiceGenderLabel: 'Giọng (nam/nữ/…)',
    voiceTimbreLabel: 'Timbre / màu giọng',
    voiceLangLabel: 'Ngôn ngữ hát',
    bpmLabel: 'Tempo (BPM)',
    structureLabel: 'Cấu trúc bài',
    densityLabel: 'Độ dày phối khí',
    videoBlockTitle: 'Bước 3 — Ảnh & clip 8 giây (720p)',
    videoBlockBody:
      'Một ảnh: khung đầu image-to-video. Hai hoặc ba ảnh: chỉ dùng ảnh tham chiếu (API không kết hợp khung đầu + tham chiếu). Tối đa 3 file.',
    aspectLabel: 'Tỷ lệ',
    aspect169: '16:9',
    aspect916: '9:16',
    framesLabel: 'Ảnh (1–3)',
    framesHelpSingle: 'Một file: ảnh khung đầu video.',
    framesHelpMulti: 'Hai hoặc ba file: toàn bộ là ảnh tham chiếu (ASSET), không có khung đầu riêng.',
    visualExtraLabel: 'Gợi ý hình ảnh thêm (tùy chọn)',
    visualExtraPlaceholder: 'VD: Hoàng hôn, slow motion, góc máy gần mặt khi hát…',
    createClip8s: 'Tạo clip 8s (720p)',
    creatingClip: 'Đang tạo clip 8s (Veo)…',
    clip720Note:
      'Mỗi đoạn là một clip Veo ~8s độc lập (cùng bộ ảnh đoạn 1); sau đó ghép MP4 trên server. Mỗi clip ~8 credits; ghép không tốn credits.',
    needImage: 'Cần ít nhất một ảnh.',
    previewTitle: 'Ghi chú xem thử',
    downloadMp4: 'Tải file MP4',
    segmentIndexLabel: 'Đoạn {n}',
    createSegment1VideoButton: 'Tạo clip đoạn 1 từ ảnh (~8s, 720p)',
    addEightMoreVideoButton: 'Tạo video dài thêm ~8 giây',
    addEightMoreVideoHelp:
      'Mở ô lời đoạn tiếp theo: sinh lời hoặc gõ tay, rồi tạo clip ~8s độc lập cho đoạn đó (cùng ảnh đoạn 1). Cuối cùng có thể ghép các clip thành một MP4.',
    extendSegmentVideoButton: 'Tạo clip đoạn {k} (~8s, độc lập)',
    extendingVeoSegmentBusy: 'Đang tạo clip đoạn {k} (Veo) — có thể vài phút…',
    videoSequentialBlockIntro: 'Video và nút bước kế hiển thị ngay bên dưới từng đoạn.',
    videoImagesOnlyStep3Note:
      'Ảnh và tỷ lệ chọn ở đoạn 1 được dùng lại cho mọi clip đoạn sau (mỗi clip sinh riêng, không extend).',
    previewInStep4Note: 'Mỗi mốc video nằm ngay trong bước 4 (không gom chỗ khác).',
    videoForSegmentLockedNote:
      'Phần Veo của đoạn này mở sau khi bạn bấm «Tạo video dài thêm ~8 giây» và đã có clip đoạn trước.',
    successExtendSegment: 'Đã tạo xong clip đoạn {k}. Xem video bên dưới.',
    partialSegmentsFail: 'Dừng khi tạo đoạn {n} — các clip trước vẫn xem/tải/ghép được.',
    startOver: 'Làm lại từ đầu',
    veoAudioNote:
      'Âm thanh trong file MP4 do Veo sinh theo prompt (lời + mô tả phong cách), không phải file nhạc tải lên.',
    successClip: 'Đã tạo clip 8s.',
    segmentCountLockedHelp:
      'Đã mở thêm ô lời (hoặc sinh lời bằng AI) — không tự thu số đoạn. «Làm lại từ đầu» để đặt lại.',
    lyricsLockedNote: 'Lời các đoạn đã khóa (đúng thứ tự gửi Veo).',
    segmentsCountSyncedNote: 'Cùng số đoạn với bước 1: {n}.',
    videoAfterSegmentLabel: 'Sau đoạn lời {n} (ước tính ~{seconds}s)',
    downloadMp4Step: 'Tải MP4 — mốc {n}',
    extendPerStepSectionTitle: 'Tùy chọn mỗi clip đoạn',
    extendPerStepSectionBody:
      'Phong cách nhạc (bước 2) áp dụng cho mọi clip; góc máy / nhân vật có thể chỉnh trước mỗi lần tạo clip.',
    extendBridgeLabel: 'Clip ~8 giây độc lập cho đoạn {to} — cùng ảnh đoạn 1; ghép MP4 sau.',
    extendSegmentVisualLabel: 'Gợi ý hình (lần nối này)',
    cameraHintLabel: 'Góc máy / chuyển động camera',
    cameraHintPlaceholder: 'VD: Pan chậm sang trái, góc rộng, handheld nhẹ…',
    characterStoryLabel: 'Hành động nhân vật / diễn biến câu chuyện',
    characterStoryPlaceholder: 'VD: Nhìn ra biển, giơ tay, quay lưng bước đi…',
    standaloneFramesNote:
      'Dùng lại đúng bộ ảnh đã chọn ở đoạn 1. Có thể chỉnh góc máy / nhân vật cho prompt clip này.',
    mergeClipsSectionTitle: 'Ghép các clip đã tạo',
    mergeClipsSectionHelp:
      'Ghép theo thứ tự đoạn 1 → 2 → … thành một MP4. Không trừ credits; cần ffmpeg trên máy chủ.',
    mergeClipsButton: 'Ghép thành một MP4',
    mergingClips: 'Đang ghép video trên server…',
    successMergedClip: 'Đã ghép xong. Xem bên dưới hoặc trong lịch sử.',
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
    mobileCreateHomework: 'Tạo bài tập về nhà',
    assignWorksheet: 'Bài tập về nhà',
    classHomeworkListEmpty: 'Chưa có bài tập về nhà nào gắn lớp này.',
    classHomeworkListCreateCta: 'Tạo bài tập về nhà',
    classHomeworkOpenLamBai: 'Trang làm bài',
    classHomeworkAttachOtherClassButton: 'Gắn bài tập vào lớp khác',
    classHomeworkAttachPickTitle: 'Gắn bài tập về nhà vào lớp khác',
    classHomeworkAttachPickDescription:
      'Tạo phiên bài tập mới (mã và link riêng) với cùng nội dung, gắn vào lớp bạn chọn.',
    classHomeworkAttachSessionLabel: 'Bài tập về nhà',
    classStudentHomeworkSessionsEmpty: 'Chưa có bài tập về nhà nào từ giáo viên.',
    noWorksheets: 'Chưa có phiếu nào',
    noStudents: 'Chưa có học sinh',
    doWorksheet: 'Làm bài',
    submit: 'Nộp bài',
    submitSuccess: 'Đã nộp bài',
    viewResult: 'Xem kết quả',
    quizScore: 'Điểm trắc nghiệm',
    sampleAnswer: 'Đáp án mẫu',
    submissions: 'Bài nộp',
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
    classExamsSubsectionGraded: 'Bài thi (có chấm điểm)',
    classExamsSubsectionPracticeHomework: 'Bài tập về nhà (không hiển thị điểm cho học sinh)',
    studentClassHomeworkSubmittedCaption:
      'Đã nộp bài. Đây là bài tập về nhà — điểm không hiển thị tại đây.',
    classSessionBadgeHomework: 'Bài tập về nhà',
    lamBaiSeoTitleSuffixExam: 'Bài thi trực tuyến',
    lamBaiSeoTitleSuffixHomework: 'Bài tập về nhà',
    lamBaiSeoDescriptionExam:
      'Làm bài thi trực tuyến theo mã phiên: trắc nghiệm và tự luận, có chấm điểm.',
    lamBaiSeoDescriptionHomework:
      'Làm bài tập về nhà trực tuyến theo mã phiên — ôn luyện, không hiển thị điểm như bài thi.',
    lamBaiSeoKeywordsExam: 'bài thi, làm bài, trắc nghiệm, tự luận, NanoAI',
    lamBaiSeoKeywordsHomework: 'bài tập về nhà, ôn tập, NanoAI',
    lamBaiSeoFallbackTitle: 'Làm bài trực tuyến',
    lamBaiSeoFallbackDescription:
      'Đăng nhập để làm bài theo mã phiên hoặc liên kết giáo viên gửi.',
    lamBaiSeoFallbackKeywords: 'làm bài, NanoAI',
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
    examAttachToOtherClassButton: 'Gắn lớp khác',
    examAssignClassButton: 'Gán lớp',
    examAttachPickClassTitle: 'Gắn bài thi vào lớp khác',
    examAttachPickClassDescription:
      'Hệ thống tạo một phiên thi mới (mã và link riêng) với cùng câu hỏi, gắn vào lớp bạn chọn.',
    examAttachSelectClassLabel: 'Chọn lớp',
    examAttachSelectClassPlaceholder: '— Chọn lớp —',
    examAttachSubmit: 'Gắn vào lớp',
    examAttachLoadingClasses: 'Đang tải danh sách lớp…',
    examAttachWorking: 'Đang tạo phiên thi…',
    examAttachNoClassesBody:
      'Bạn chưa có lớp nào. Hãy tạo lớp trước, sau đó quay lại để gắn bài thi.',
    examAttachNoOtherClassesBody:
      'Bạn chưa có lớp nào khác ngoài lớp hiện tại. Tạo thêm lớp để gắn bản sao đề.',
    examAttachFailed: 'Không gắn được bài thi. Thử lại sau.',
    examAttachSuccessSummary: 'Phiên mới đã gắn vào: {classLine}.',
    examAttachClose: 'Đóng',
    examAttachPickAnotherClass: 'Gắn thêm lớp khác',
    examAttachExamLabel: 'Bài thi',
    examAttachAllClassesAlreadyAttachedBody:
      'Mọi lớp của bạn đã có phiên của bài thi này (cùng bộ câu hỏi). Không còn lớp nào để gắn thêm.',
    examAttachNeedDifferentClassHint:
      'Không thấy lớp cần gắn? Tạo lớp mới ở tab khác, rồi bấm «Làm mới danh sách lớp» bên dưới.',
    examAttachReloadClassList: 'Làm mới danh sách lớp',
    examAttachOpenCreateClassNewTab: 'Tạo lớp mới (tab mới)',
    examAttachClassAlreadyHasExam: 'Lớp này đã có bài thi này rồi.',
    examIdentityFromClassHint:
      'Hồ sơ trong lớp đã có họ tên và ngày sinh. Bấm Bắt đầu khi sẵn sàng làm bài; đồng hồ chỉ chạy sau khi bấm.',
    examChangeIdentityManual: 'Nhập họ tên và ngày sinh khác',
    examManualIdentityIntro:
      'Nhập thông tin và bấm Bắt đầu để làm bài. Đồng hồ chỉ chạy sau khi bấm Bắt đầu.',
    examStartTestButton: 'Bắt đầu bài kiểm tra',
    examOneAttemptNote:
      'Mỗi tài khoản một lượt: sau khi bấm Bắt đầu hệ thống khóa phiên trên máy chủ — không xem lại đề mới; muốn thoát cần nộp bài.',
    examStartHomeworkButton: 'Bắt đầu làm bài tập',
    homeworkIdentityFromClassHint:
      'Hồ sơ trong lớp đã có họ tên và ngày sinh. Bấm Bắt đầu khi sẵn sàng làm bài tập về nhà; đồng hồ chỉ chạy sau khi bấm.',
    homeworkManualIdentityIntro:
      'Nhập thông tin và bấm Bắt đầu để làm bài tập về nhà. Đồng hồ chỉ chạy sau khi bấm Bắt đầu.',
    homeworkEnrollGateTitle: 'Tham gia lớp để làm bài tập về nhà',
    homeworkEnrollGateDescription:
      'Bài tập về nhà này gắn với một lớp. Nhập họ tên và ngày sinh đúng như trong sổ lớp (không dùng tên mặc định tài khoản Google). Sau đó em có thể bắt đầu làm bài tập.',
    homeworkEnrollSubmitButton: 'Tham gia lớp và làm bài tập',
    homeworkDefaultTitle: 'Bài tập về nhà',
    lamBaiLoadingNeutral: 'Đang tải…',
    lamBaiFiveMinWarning: 'Còn 5 phút! Em rà soát đáp án trước khi hết giờ.',
    lamBaiTimerTimeUpAutoSubmittingExam: 'Hết giờ! Bài làm đang được tự động nộp.',
    lamBaiTimerTimeUpAutoSubmittingHomework: 'Hết giờ! Bài tập đang được gửi tự động.',
    lamBaiTimerStickySubmittingExam: 'Hết giờ — đang nộp…',
    lamBaiTimerStickySubmittingHomework: 'Hết giờ — đang gửi…',
    lamBaiExitBlockedBanner:
      'Bạn đang làm bài: chỉ nên rời trang sau khi đã nộp bài. Đóng tab, làm mới hoặc bấm Quay lại sẽ bị chặn hoặc nhắc — hãy nộp bài để kết thúc phiên làm bài. Nếu tạm thoát rồi mở lại, đồng hồ vẫn tính từ lúc bấm Bắt đầu.',
    lamBaiExitBlockedBeforeStartHint:
      'Sau khi bấm Bắt đầu, chỉ nên rời trang sau khi nộp bài. Trình duyệt sẽ cảnh báo nếu bạn đóng tab, tải lại hoặc rời trang. Bạn vẫn có thể thoát rồi quay lại, nhưng đồng hồ vẫn tính từ lúc bấm Bắt đầu.',
    lamBaiExitBlockedDialogTitle: 'Cần nộp bài để thoát',
    lamBaiExitBlockedDialogDescription:
      'Bạn đang trong phiên làm bài. Để thoát an toàn, hãy nộp bài. Bạn có thể bấm «Nộp bài ngay» bên dưới hoặc kéo xuống cuối trang để nộp.',
    lamBaiExitBlockedSubmitNow: 'Nộp bài ngay',
    lamBaiExitBlockedStay: 'Ở lại làm bài',
    lamBaiExamResumeNotice:
      'Bạn đang có phiên làm bài chưa nộp — đáp án đã lưu được khôi phục. Tiếp tục làm và nộp bài khi xong.',
    examBeginStarting: 'Đang bắt đầu…',
    examBeginFailed: 'Không bắt đầu được phiên làm bài. Vui lòng thử lại.',
    examSubmitSending: 'Đang nộp bài…',
    examSubmitButton: 'Nộp bài',
    homeworkSubmitSending: 'Đang gửi bài tập…',
    homeworkSubmitButton: 'Gửi bài tập',
    homeworkLoadFailed: 'Không tải được bài tập về nhà.',
    lamBaiQuestionLabel: 'Câu {index}.',
    examSubmittedTitle: 'Đã nộp bài',
    examSubmittedSavedEarlier: 'Bạn đã nộp bài thi này. Dưới đây là kết quả đã lưu.',
    examSubmittedDueToDeadlineHint:
      'Thời gian làm bài trên hệ thống đã hết — bài được nộp tự động theo đáp án đã lưu. Dưới đây là kết quả.',
    homeworkSubmittedTitle: 'Đã nộp bài tập về nhà',
    homeworkSubmittedSavedEarlier: 'Bạn đã nộp bài tập này. Thông tin đã lưu bên dưới.',
    homeworkSubmittedBody:
      'Đây là bài luyện tập, không hiển thị điểm hay thang điểm cho học sinh. Giáo viên vẫn xem bài và nhận xét trong lớp.',
    homeworkMcCorrectOnlyLine: 'Trắc nghiệm: {correct}/{total} câu đúng',
    homeworkShareLine: 'Đã nộp: {title}',
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
    examSessionCreatedAt: 'Tạo lúc {time}',
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
    classExamsIndexTitle: 'Đề thi trong lớp',
    classExamSessionPageTitle: 'Chi tiết đề thi',
    classExamGoToSession: 'Mở trang chấm thi',
    classDetailSeoDescription: 'Trang lớp: đề thi, học sinh, sổ điểm.',
    classHubCardAssignWorksheetDesc:
      'Các phiên bài tập về nhà đã tạo và gắn lớp này. Học sinh làm qua link hoặc mã.',
    classPageStudentFacingNotSet: 'Chưa thiết lập',
    classHubCardStudentWorksheetsDesc:
      'Bài tập về nhà giáo viên giao: mở link hoặc mã phiên để làm bài (trang làm bài).',
    classHubCardCreateExamButton: 'Tạo đề thi',
    classHubCardCreateHomeworkButton: 'Tạo bài tập',
    worksheetLamBaiNoInteractiveHint:
      'Phiếu chưa có phần trắc nghiệm hoặc tự luận làm được trên web (giáo viên cần gắn câu hỏi vào phiếu trong Tạo giáo trình). Bạn chưa thể nộp bài ở đây.',
    worksheetLamBaiBackToClassWorksheets: 'Về danh sách phiếu lớp',
    worksheetLamBaiMcqSectionTitle: 'Trắc nghiệm',
    worksheetLamBaiEssaySectionTitle: 'Tự luận',
    worksheetLamBaiEssayPlaceholder: 'Nhập câu trả lời…',
    worksheetSubmitNoInteractiveError:
      'Phiếu chưa có câu hỏi làm trực tuyến. Giáo viên cần gắn câu hỏi vào phiếu trước.',
    assignWorksheetNoQuestionBankHint:
      'Chưa gắn câu hỏi từ kho — học sinh không làm/nộp trên web được.',
    assignWorksheetOpenInCurriculumTool: 'Mở trong Tạo giáo trình',
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
  weddingCardAiMusic: {
    playStartLabel: 'Bắt đầu phát',
    playEndLabel: 'Kết thúc / lặp lại tại',
    playStartPlaceholder: 'Để trống hoặc 0 · 30 · 1:30 (trống = cả bài từ đầu)',
    playEndPlaceholder: 'Để trống = không cắt, phát đến hết bài',
    segmentHint:
      'Không nhập ô nào = phát nguyên bản cả nhạc từ đầu đến hết. Có ô mới vào chi tiết: giây (30) hoặc phút:giây (1:30). Nếu có mốc kết thúc, nhạc lặp trong đoạn đó. Nhấn «Lưu» để áp dụng trên thiệp.',
    useCurrentPlaybackAsStart: 'Dùng vị trí đang phát làm điểm bắt đầu',
    playbackLoadFailed:
      'Không tải được file nhạc (có thể đã xóa trên máy chủ). Chủ thiệp vui lòng vào trang chỉnh sửa và tải lại nhạc nền.',
    publicFabPauseAria: 'Tắt nhạc nền thiệp',
    publicFabPlayAria: 'Bật nhạc nền thiệp',
    publicMapEmbedTitle: 'Bản đồ địa điểm tiệc cưới',
  },
  weddingCardCalendar: {
    sectionTitle: 'THÔNG TIN TIỆC CƯỚI',
    introLine: 'TIỆC CƯỚI SẼ DIỄN RA VÀO LÚC:',
    receptionLabel: 'ĐÓN KHÁCH',
    partyLabel: 'KHAI TIỆC',
    timePlaceholderDash: '—',
  },
  weddingGiftBox: {
    boxTitle: 'Hộp Mừng Cưới',
    tapToOpen: 'Nhấn để mở',
    dialogTitle: 'Mừng cưới — quét VietQR',
    brideSection: 'Cô dâu',
    groomSection: 'Chú rể',
    accountHolder: 'Tên chủ tài khoản',
    accountNumber: 'Số tài khoản',
    bankSelectPlaceholder: 'Chọn ngân hàng',
    vietqrFooterNote: 'Quét bằng app ngân hàng (VietQR).',
    closeButton: 'Đóng',
    envelopeButtonAria: 'Mở hộp mừng cưới, xem mã quét',
    editorHint:
      'Bật hộp mừng cưới: điền đủ ngân hàng, số TK và tên chủ TK cho cả cô dâu và chú rể để tạo hai mã VietQR. Hoặc dán một URL ảnh QR dưới đây (cách cũ).',
    legacyImageLabel: 'URL ảnh QR một mã (tùy chọn)',
    legacyImageDesc: 'Chỉ dùng khi không dùng hai VietQR ở trên; thiệp sẽ hiển thị một QR duy nhất.',
    saveNeedConfig:
      'Đã bật QR mừng cưới: nhập đủ thông tin hai tài khoản (cô dâu + chú rể), hoặc điền URL ảnh QR.',
    qrAltBride: 'VietQR chuyển khoản — cô dâu',
    qrAltGroom: 'VietQR chuyển khoản — chú rể',
    qrAltLegacy: 'Mã QR mừng cưới',
  },
  weddingCardAiBrief: {
    step2Description:
      'Sửa nội dung và xem preview đều miễn phí. Thay đổi tự động lưu sau khoảng 1 giây; có thể vẫn nhấn «Lưu nội dung thiệp» để lưu ngay.',
    autoSavedLabel: 'Đã lưu tự động',
    autoSaveFailedLabel: 'Chưa lưu được. Kiểm tra mạng hoặc nhấn «Lưu nội dung thiệp».',
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
    openCreatedExamsListButton: 'Mở danh sách bài thi đã tạo',
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
    homeworkPageTitle: 'Tạo bài tập về nhà',
    homeworkPageSubtitle:
      'Cùng bước như bài thi trực tuyến (môn, lớp, câu hỏi, QR/link) nhưng không bắt tổng 100 điểm; học sinh không thấy điểm sau khi nộp.',
    defaultHomeworkTitle: 'Bài tập về nhà',
    homeworkCreatedBadge: 'Đã tạo bài tập về nhà',
    createHomework: 'Tạo bài tập về nhà',
    createAnotherHomework: 'Tạo bài tập về nhà khác',
    createdHomeworkListTitle: 'Bài tập về nhà đã tạo',
    createdHomeworkHint: 'Mở link hoặc QR để học sinh làm bài; gán sang lớp khác giống bài thi.',
    openCreatedHomeworkListButton: 'Xem danh sách bài tập về nhà',
    homeworkCreateSuccess: 'Đã tạo bài tập về nhà',
    homeworkCreateSuccessDesc: 'Chia sẻ link hoặc mã QR cho học sinh.',
    homeworkEssayNo100Note:
      'Chọn câu tự luận nếu cần. Học sinh không xem điểm sau khi nộp; không cần chỉnh phút hay điểm từng câu.',
    homeworkCardInfo: 'Thông tin bài tập về nhà',
    homeworkFormCardDescription:
      'Chọn môn, lớp và câu hỏi từ giáo trình. Không cần cài đặt điểm hay thời gian thi — hệ thống lưu bài làm, học sinh không xem điểm.',
    homeworkTitlePlaceholder: 'Bài tập Toán — ôn tập',
    homeworkQuizPartFooterHint:
      'Nhập số câu từng mức độ, rồi chọn đúng số câu trong danh sách bên dưới. Bài tập về nhà không cần chỉnh phút hay điểm ở đây.',
    noHomeworkSessionsYet: 'Chưa có bài tập về nhà nào.',
    homeworkCreatedResultLine: '{count} câu hỏi',
    homeworkSummaryMc: 'Trắc nghiệm: {count} câu',
    homeworkSummaryEssay: 'Tự luận: {count} câu',
    homeworkDeleteConfirm: 'Xóa bài tập về nhà này? Hành động này không thể hoàn tác.',
    homeworkDeleted: 'Đã xóa',
    homeworkDeletedDesc: 'Đã xóa bài tập về nhà.',
  },
  adminWorksheetVerify: {
    pageTitle: 'Báo cáo verify phiếu bài tập',
    pageDescription:
      'Trang này chủ yếu để đọc lại báo cáo các lượt verify tự động (cron): số phiếu trong hàng đợi, đã xử lý, số lần đóng verified và sửa nội dung. Bấm một dòng để xem chi tiết từng phiếu. Khi cần, có thể bấm "Bắt đầu quét mới" để chạy thủ công từng lô trên máy chủ.',
    reportScopeNote:
      'Mỗi lần verify ngầm sau khi tạo/sửa phiếu (Tạo giáo trình) cũng được ghi vào danh sách này khi máy chủ được cấu hình đầy đủ cho verify nền. Trước đây chỉ có quét lô/cron mới tạo dòng — nếu bạn đã verify nhưng không thấy báo cáo, hãy kiểm tra biến môi trường máy chủ và chạy verify lại một lần.',
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
    inviteFriends: 'Invite friends',
    viewPlan: 'View plan',
    topUpCredits: 'Top up credits',
    tasksHub: 'Tasks & queue',
    supportChat: 'Support chat',
    partnerInbox: 'Business channels',
    partnerApiIntegration: 'API integration (shop owner)',
    customerApiKeys: 'Rent AI platform',
    myChats: 'Messages with shops',
    myOrders: 'My orders',
    downloadApp: 'Download app',
    downloadAppSubtitle:
      'This is the web app (PWA)—add it to your Home Screen like a native app. Use Chrome on Android; Safari on iPhone/iPad.',
    downloadAndroidTitle: 'Android (Chrome)',
    downloadAndroidChromeHint:
      'Chrome usually offers Install app or Add to Home screen in the menu.',
    downloadAndroidStep1: 'Open the NanoAI site (nanoai.vn) in Chrome.',
    downloadAndroidStep2: 'Tap the menu (⋮, three dots) in the top-right corner.',
    downloadAndroidStep3: 'Choose Install app or Add to Home screen, then confirm.',
    downloadIosTitle: 'iPhone / iPad',
    downloadIosSafariHint: 'Use Safari for best results.',
    downloadIosStep1: 'Open the NanoAI site (nanoai.vn) in Safari.',
    downloadIosStep2: 'Tap the Share button (square with an arrow pointing up) in the toolbar.',
    downloadIosStep3: 'Choose “Add to Home Screen”, then tap Add.',
  },
  referral: {
    pageTitle: 'Invite friends – earn credits',
    metaDescription:
      'Share NanoAI. When someone signs up as a new user through your link, you receive 2 referral credits.',
    headline: 'Invite friends to NanoAI',
    description:
      'Copy your personal link. When a new user signs up and joins through that link (within 30 days of account creation), you get 2 credits — once per invited person.',
    yourLinkLabel: 'Your invite link',
    copyButton: 'Copy link',
    copied: 'Copied',
    howItWorksTitle: 'How it works',
    step1: 'Share your invite link with friends.',
    step2: 'They open the link and sign up / sign in to NanoAI within 30 days of account creation.',
    step3: 'We add 2 credits to you (the inviter). Invitees do not receive referral-program credits.',
    bonusNote: 'Only eligible new accounts trigger the inviter reward; each invitee counts only once.',
    inviteVisualYou: 'You (inviter)',
    inviteVisualFriend: 'Invitee',
    inviteeNoReferralCredit: 'No referral credits',
    errorGeneric: 'We could not apply the invite bonus right now. Please try again later.',
  },
  accountPlan: {
    pageTitle: 'Your plan',
    metaDescription:
      'See your 7-day trial and monthly curriculum access. English AI is pay-per session or lesson; AI credits are separate.',
    headline: 'Current plan',
    billingPeriod: 'Monthly billing period (Vietnam calendar): {period}',
    trialSectionTitle: 'Free trial',
    trialActiveLine:
      'You are in the free trial — no monthly curriculum fee is charged yet (see section below).',
    trialTotalDaysNote: 'Trial length: {days} days from account creation.',
    trialDaysLeft: 'About {days} day(s) left.',
    trialEndsAtLine: 'Trial ends (estimated): {datetime}',
    trialNotActive:
      'You are past the first 7-day trial. Monthly curriculum access is charged in credits each billing period when it applies.',
    servicesSectionTitle: 'Curriculum — monthly (credits)',
    productEnglishCoach: 'English AI learning',
    englishCoachPayPerLesson:
      'No monthly subscription. Each session or lesson deducts credits when you start (amounts are shown in the learning area).',
    productCurriculum: 'Curriculum & lesson tools',
    statusViaTrial: 'Free trial — monthly fee not charged yet.',
    statusAccessOn: 'You currently have access to this service.',
    statusPaidMonth: 'Monthly fee charged for period {period}.',
    statusPendingPayment: 'Not charged yet — {credits} credits needed for period {period}.',
    noteSignupBonus: 'New accounts receive {credits} welcome credits (for AI use; separate from monthly access).',
    noteAiCredits: 'AI credits are still deducted per use when features call the AI.',
    refresh: 'Refresh',
    loading: 'Loading…',
    errorLoad: 'Could not load plan info. Try refreshing.',
    errorConfig: 'Server is not fully configured. Please try again later.',
    monthlyCostLine: '{credits} credits / period · about {vnd}₫',
    backDashboard: 'Back to dashboard',
    linkWallet: 'Open wallet to top up credits',
  },
  push: {
    bannerTitle: 'Get phone notifications',
    bannerHint:
      'You are using NanoAI as an installed app (PWA). Turn on notifications for payments, rewards, and report updates even when the app is closed.',
    enable: 'Turn on',
    later: 'Not now',
    enabledToast: 'Push notifications enabled',
    bellEnableHint: 'In-app alerts are not the same as system notifications. Enable push to get updates when NanoAI is closed.',
    bellEnableButton: 'Enable push notifications',
    bellSubscribedShort: 'Push is on for this device',
    bellDeniedHint: 'Notifications are blocked. Open browser settings → NanoAI → Allow notifications.',
    bellSyncHint: 'Notifications are allowed but this device is not registered yet. Tap to sync.',
  },
  supportChat: {
    pageTitle: 'Support chat',
    metaDescription:
      'Message the NanoAI team; syncs with Facebook Messenger and Zalo OA when webhooks are configured.',
    brandBadge: 'NanoAI',
    headline: 'Support chat',
    subline:
      'Messages from this page go to the same customer-care inbox as Facebook and Zalo (when integrated on the server).',
    loginRequired: 'Sign in to send a message to our team.',
    loginSupportingLine: 'Use your NanoAI account; after signing in you can write messages here.',
    loginLink: 'Sign in',
    placeholder: 'Type your message…',
    send: 'Send',
    emptyThread: 'No messages yet. Send your first question below.',
    loadError: 'Could not load the conversation.',
    sendError: 'Could not send the message.',
    pollNote: 'Replies may appear after a few seconds; you can refresh the page.',
    sendKeyboardHint: 'Enter to send · Shift+Enter for a new line',
    messageProductCardOpenProduct: 'View product',
    messageProductCardViewDetails: 'View details',
  },
  customerCareAdmin: {
    pageTitle: 'Customer care',
    pageDescription:
      'Platform inbox only: NanoAI support (/support-chat) and platform-linked Facebook/Zalo. Each shop’s inbox is under Dashboard → Messaging; your chats as a customer are under My messages — kept separate.',
    inboxTitle: 'Conversations (platform)',
    pickConversation: 'Select a conversation to view messages.',
    replyPlaceholder: 'Write a reply…',
    send: 'Send',
    refresh: 'Refresh',
    channelFacebook: 'Facebook',
    channelZalo: 'Zalo',
    channelInternal: 'NanoAI',
    channelWidget: 'Web (embed)',
    unknownUser: 'Customer',
    sendFailed: 'Send failed',
    noMessages: 'No messages yet.',
    sendKeyboardHint: 'Enter to send · Shift+Enter for a new line',
    messageProductCardOpenProduct: 'View product',
    messageProductCardViewDetails: 'View details',
  },
  partnerMessaging: {
    pageTitle: 'Partner messaging inbox',
    pageDescription:
      'One workspace for your shop: Facebook Page, Zalo OA, NanoAI-hosted chat, or an embedded API on your site — same inbox.',
    cardTitle: 'Customer inbox (partner)',
    cardDescription: 'Facebook, Zalo, NanoAI web chat, and embedded chat — one inbox.',
    createWorkspace: 'Create messaging workspace',
    workspaceNameLabel: 'Shop / brand name',
    workspaceLabel: 'Workspace',
    createButton: 'Create',
    saveOk: 'Saved.',
    channelsSection: 'Channels (Facebook & Zalo)',
    fbPageId: 'Facebook Page ID',
    fbPageToken: 'Page access token',
    fbVerifyToken: 'Verify token (webhook GET)',
    saveFacebook: 'Save Facebook',
    zaloSecret: 'Webhook secret (header)',
    zaloToken: 'OA access token',
    saveZalo: 'Save Zalo',
    embedSection: 'Anonymous embed API on your site (optional)',
    embedHint:
      'Call the API from the shop domain (CORS enabled). Each browser keeps a stable UUID in localStorage and sends it as X-Session-Id.',
    embedHeadersHelp:
      'Send headers X-Embed-Key (key above) and X-Session-Id (stable UUID in the visitor browser).',
    embedAnonymousFootnote:
      'This path does not use NanoAI sign-in: the shop cannot see a real identity and it is not tied to Google. For the same login as opening NanoAI directly (and “My messages”), share the hosted link above or use the iframe snippet.',
    inboxTitle: 'Customer threads',
    inboxSearchPlaceholder: 'Search by name or message…',
    inboxNoSearchResults: 'No conversations match.',
    inboxSideInfoTab: 'Info',
    inboxSideOrderTab: 'Create order',
    inboxSideNoNotes: 'No notes yet',
    inboxSideNotePlaceholder: 'Type a note (Enter to save)',
    inboxSideOrderEmpty: 'No order history yet',
    inboxSideCreateOrder: 'Create order',
    pickConversation: 'Pick a conversation.',
    replyPlaceholder: 'Write a reply…',
    send: 'Send',
    refresh: 'Refresh',
    channelFacebook: 'Facebook',
    channelZalo: 'Zalo',
    channelWidget: 'Web',
    unknownUser: 'Guest',
    noMessages: 'No messages yet.',
    inboxShopDrafting: 'The shop is composing a reply',
    replyKeyboardHint: 'Enter to send · Shift+Enter for a new line · Ctrl+V / Cmd+V to paste an image',
    messageProductCardOpenProduct: 'View product',
    messageProductCardViewDetails: 'View details',
    partnerAttachPhoto: 'Photo library',
    partnerTakePhoto: 'Take photo',
    partnerRemoveAttachmentAria: 'Remove attached image',
    partnerCaptionHint: 'You can add a caption below before sending.',
    partnerUploading: 'Uploading image…',
    partnerImageTooLarge: 'Image is too large (max ~3 MB).',
    partnerImageInvalidType: 'Unsupported image format.',
    nanoaiHostedSection: 'Chat on NanoAI — same sign-in as using NanoAI directly (recommended)',
    nanoaiHostedHint:
      'Customers must sign in with Google on NanoAI, same as using the platform directly: one account, messages sync across devices, and they can open /messaging/my-chats. Threads still appear in your inbox as today.',
    nanoaiHostedUrlLabel: 'Chat link',
    nanoaiHostedIframeTitle: 'Embed on your website (iframe)',
    nanoaiHostedIframeTitleAttr: 'NanoAI chat',
    nanoaiHostedIframeHelp:
      'Paste into your page HTML. Customers chat and sign in inside the NanoAI frame (first-party cookies), without the anonymous embed API.',
    copyHostedChatLinkButton: 'Copy chat link',
    hostedChatLinkCopiedToast: 'Chat link copied.',
    copyIframeSnippetButton: 'Copy iframe code',
    iframeSnippetCopiedToast: 'Iframe code copied.',
    integrationSectionTitle: 'Tracking tags & embed codes',
    integrationSectionHint:
      'Designed area to paste Google tags, Facebook Pixel, and chat embed code. You can quickly copy the NanoAI chat embed code below.',
    googleTagLabel: 'Google tag (GA4 / GTM)',
    googleTagPlaceholder: 'Example: G-XXXXXXXXXX or GTM-XXXXXXX',
    facebookPixelLabel: 'Facebook Pixel / Meta Pixel',
    facebookPixelPlaceholder: 'Example: 123456789012345',
    metaConsultTrackingSection: 'Meta Pixel & Conversions API (product consult pages)',
    metaConsultTrackingHint:
      'When a guest opens a per-product consult link (/tu-van/… or chat with ?ctx_inventory=), ViewContent is sent on both Pixel and server with matching parameters (deduped via event_id).',
    metaConsultCapiTokenLabel: 'Conversions API access token (server)',
    metaConsultCapiTokenPlaceholder: 'Paste token from Meta Events Manager',
    metaConsultCapiConfiguredBadge: 'Token saved',
    metaConsultCapiSavedHint:
      'After saving, this field stays empty on purpose — stored tokens are never shown again. The token remains on the server. Paste a new value only to replace it; leave blank if you only change the Pixel ID.',
    metaConsultSaveButton: 'Save Pixel & CAPI',
    shopGa4MeasurementLabel: 'Google Analytics 4 (GA4) measurement ID',
    shopGa4MeasurementHint:
      'Enter your G-… ID to measure visits to your consult/shop page. In GA4 open Reports → Realtime to see active users.',
    shopGa4MeasurementPlaceholder: 'Example: G-XXXXXXXXXX',
    shopGa4InvalidIdToast: 'Invalid GA4 ID. Expected format: G-XXXXXXXXXX',
    shopGa4SaveButton: 'Save GA4 ID',
    facebookCatalogFeedTitle: 'Facebook — product catalog feed (CSV)',
    facebookCatalogFeedHint:
      'Paste this URL in Commerce Manager (scheduled feed). CSV lists active items; the link column is the NanoAI consult page, not your shop website. Requires image URL and VND price. The key query param is your embed key — keep it private.',
    facebookCatalogFeedCopyButton: 'Copy feed URL',
    facebookCatalogFeedCopiedToast: 'Catalog feed URL copied.',
    nanoaiEmbedCodeLabel: 'NanoAI chat embed code',
    facebookChatEmbedCodeLabel: 'Facebook chat embed code',
    zaloChatEmbedCodeLabel: 'Zalo chat embed code',
    embedCodePlaceholder: 'Paste script/iframe or plugin code here…',
    copyNanoaiEmbedButton: 'Copy NanoAI chat code',
    copyFacebookChatEmbedButton: 'Copy Facebook chat code',
    copyZaloChatEmbedButton: 'Copy Zalo chat code',
    addAnotherWorkspace: 'Add another workspace',
    cancelAddWorkspace: 'Cancel',
    deleteWorkspaceButton: 'Delete workspace',
    deleteWorkspaceConfirm:
      'Warning: deleting this workspace is permanent and cannot be undone. Type "XOA" to confirm.',
    deleteWorkspaceSuccess: 'Workspace deleted.',
    deleteWorkspaceOtpIntro:
      'Your workspace will be scheduled for deletion after a grace period. While waiting, the shop will not accept customer messages. We will email a one-time code to your login address.',
    deleteWorkspaceOtpSend: 'Send OTP email',
    deleteWorkspaceOtpLabel: 'OTP code (6 digits)',
    deleteWorkspaceOtpConfirm: 'Confirm scheduled deletion',
    deleteWorkspaceScheduledBanner:
      'This workspace is scheduled for deletion and is not accepting inbound messages. You can cancel from Messaging settings before the deadline.',
    deleteWorkspaceCancelSchedule: 'Cancel deletion schedule',
    deleteWorkspaceOtpSentToast: 'OTP sent to your email.',
    deleteWorkspaceScheduleCancelled: 'Scheduled deletion cancelled.',
    teamStaffSectionTitle: 'Workspace team',
    teamStaffSectionHint:
      'Invite people by their NanoAI login email. Choose permissions carefully; sensitive areas should only go to trusted users.',
    badgeStaffWorkspace: 'invited',
    teamInviteEmailLabel: 'Login email',
    teamInviteEmailPlaceholder: 'user@example.com',
    teamInviteButton: 'Invite',
    teamStaffListTitle: 'Team members',
    teamRemoveMember: 'Remove',
    teamSavePermissions: 'Save permissions',
    teamInviteErrorNotFound:
      'No account found for this email — the person needs a NanoAI account with a verified login email.',
    teamInviteErrorBadEmail: 'Invalid email.',
    teamInviteErrorOwner: 'Cannot invite the workspace owner for this shop.',
    teamInviteOk: 'Invite sent.',
    teamStaffRestrictedNote:
      'You are accessing this workspace as staff. Only the workspace owner can change payments, embedded API secrets, deletion, and some other sensitive sections.',
    teamPermInbox: 'Customer inbox',
    teamPermOrders: 'Orders',
    teamPermInventory: 'Inventory',
    teamPermAiSettings: 'AI settings',
    teamPermWorkspaceBranding: 'Branding & logo',
    teamPermWorkspacePayment: 'In-chat payments',
    teamPermIntegrationsChannels: 'Facebook / Zalo channels',
    teamPermIntegrationsAnalytics: 'Meta Pixel / GA4 / Catalog',
    teamPermUsageReports: 'Usage reports',
    integrationsAnalyticsOwnerOnly:
      'Only the workspace owner can save Pixel / Conversions API and Google Analytics.',
    teamRemoveMemberConfirm: 'Remove this person from this workspace?',
    fbLinkedLine: 'Facebook Page linked: {pageId}',
    zaloLinkedLine: 'Zalo OA webhook & token are saved.',
    credentialsKeepHint: 'Leave token or secret blank to keep the saved values.',
    setupColumnTitle: 'Channels & AI assistant',
    chatColumnTitle: 'Customer chat',
    messagingSettingsLink: 'Channel & AI settings',
    messagingSettingsPageTitle: 'Messaging setup (shop)',
    messagingInboxDescription:
      'Customer list on the left; when a thread is open, the composer stays fixed at the bottom of the screen.',
    noWorkspaceInboxCta: 'You have no messaging workspace yet. Open settings to create a shop and connect Facebook / Zalo / chat.',
    goToInbox: 'Back to inbox',
    inboxMobileBackAria: 'Back to conversations',
    apiIntegrationGuideLink: 'API integration guide (keys & endpoints)',
    apiIntegrationGuideShort: 'For developers integrating your shop site: embed chat, image product search, B2B try-on API.',
    messagingSettingsApiHubCardTitle: 'Embed chat & APIs',
    messagingSettingsApiHubCardBody:
      'Hosted URL, iframe snippet, embed endpoint, keys, and developer docs now live on the API integration page — they are no longer shown on this settings screen.',
    customerCareShopSetupGuideTitle: 'Set up your customer-care shop',
    customerCareShopSetupGuideBody:
      'Step 1 — Open Dashboard → Messaging → Channel & AI settings (this page).\n\nStep 2 — Under «Create messaging workspace», enter display name, brand name, and industry; you can paste a logo URL or upload an image.\n\nStep 3 — Click «Create». This is your shop workspace: messages from Facebook Page, Zalo OA, NanoAI-hosted chat, and embedded chat on your site all go to one inbox.\n\nStep 4 — Then connect channels (Facebook/Zalo), copy the hosted chat link or iframe snippet, and optionally enable the AI assistant and inventory on the same settings page.',
  },
  partnerMessagingOrders: {
    pageTitle: 'Chat order management',
    pageDescription: 'Orders created from the chat widget.',
    introLine: 'Track orders created in chat, confirm manually when needed, and update status.',
    allWorkspaces: 'All workspaces',
    allStatuses: 'All statuses',
    searchPlaceholder: 'Search by order ref / customer name / phone / product',
    exportExcel: 'Export Excel',
    exportExcelTitle:
      'Export all orders matching workspace + status + optional date range (not the quick search box).',
    reload: 'Reload',
    filterCreatedFrom: 'From',
    filterCreatedTo: 'To',
    summaryTitle: 'Summary for current filters (workspace + status + order date)',
    summaryDescription:
      'All orders matching the filters (not limited to 200 rows like the list below). Date filter uses Vietnam time (order created date). Leave both empty for no date limit. Quick search only filters this page and does not change these totals.',
    statOrders: 'Orders',
    statSubtotal: 'Gross merchandise',
    statSubtotalHint: 'Subtotal sum',
    statRequired: 'Deposit / amount due',
    statRequiredHint: 'Per order configuration',
    statPaid: 'Collected (recorded)',
    statPaidHint: 'Customer transfer / system recorded',
    statOutstanding: 'Outstanding (estimate)',
    statOutstandingHint: 'Non-cancelled orders: max(0, subtotal − collected)',
    statusAwaitingPayment: 'Awaiting payment',
    statusPaymentChecking: 'Payment checking',
    statusPaidVerified: 'Payment verified',
    statusPendingManualReview: 'Needs manual review',
    statusCancelled: 'Cancelled',
    emptyList: 'No orders yet.',
    emptyFiltered: 'No orders match your filters.',
    shippingPending: 'Pending confirmation',
    shippingConfirmed: 'Order confirmed',
    shippingPacking: 'Packing',
    shippingShipping: 'Shipping',
    shippingDelivered: 'Delivered',
    shippingReturned: 'Return / refund',
    shippingCancelled: 'Cancelled',
    proofVerified: 'Proof: matched',
    proofManualReview: 'Proof: manual review',
    proofFailed: 'Proof: mismatch',
    proofPending: 'Proof: pending',
    proofNone: 'Proof: none',
    labelWorkspace: 'Workspace',
    labelCustomer: 'Customer',
    labelEmail: 'Email',
    labelAddress: 'Address',
    labelProduct: 'Product',
    labelMoneyPrefix: 'Amounts',
    moneyLine: 'Subtotal {subtotal} · Due {required} · Recorded {paid}',
    openProduct: 'Open product',
    openProofImage: 'Open proof image',
    openInbox: 'Open inbox',
    openChat: 'Open chat',
    orderLocked: 'Order locked',
    notePlaceholder: 'Verification note / reason (optional)',
    btnConfirmPaid: 'Mark as paid',
    btnMarkManualReview: 'Flag for manual review',
    btnCancelOrder: 'Cancel order',
    btnViewTimeline: 'View timeline',
    timelineTitle: 'Order timeline',
    timelinePickOrder: 'Select an order on the left to see events.',
    timelineNoEvents: 'No events yet.',
    timelineLoading: 'Loading timeline…',
    toastStatusUpdated: 'Order status updated.',
    toastShippingUpdated: 'Shipping updated and chat notified.',
    toastExportDone: 'Downloaded {count} orders ({filename}).',
    depositNone: 'No deposit yet',
    depositPartial: 'Partial deposit',
    depositFull: 'Deposit paid',
    pathSepay: '{shop} (auto)',
    pathManual: 'Bank transfer · receipt photo',
    sepayAutoHint: 'Auto-matched via {shop} — no receipt photo needed.',
    proofReceiptShortVerified: 'Receipt: matched',
    proofReceiptShortPending: 'Receipt: pending',
    proofReceiptShortFailed: 'Receipt: mismatch',
    proofReceiptShortManual: 'Receipt: manual review',
    proofReceiptShortNone: 'Receipt: none',
    tabAll: 'All',
    tabAwaitDeposit: 'Awaiting deposit',
    tabAwaitShip: 'Ready to ship',
    tabAwaitReceive: 'Out for delivery',
    tabReceived: 'Received',
    tabReviewed: 'Reviewed',
    tabCancelled: 'Cancelled',
    tableColOrderCode: 'Order #',
    tableColConsulted: 'Consult done',
    tableColCustomer: 'Customer',
    tableColSubtotal: 'Order total',
    tableColDepositRequired: 'Deposit due',
    tableColPaidAmount: 'Paid',
    tableColDueOnDelivery: 'Balance on delivery',
    tableColStatus: 'Status',
    tableColOrderDate: 'Placed',
    tableColActions: 'Actions',
    filterShippingLabel: 'Shipping status',
    filterPaymentShort: 'Payment status',
    clearTableFilters: 'Clear filters',
    consultedAria: 'Consulted (stored in this browser)',
    reviewedAria: 'Customer reviewed (stored in this browser)',
    expandRow: 'Expand',
    collapseRow: 'Collapse',
    listCapNote: 'Showing up to 200 latest orders for the current workspace + date filters.',
    consultLocalHint: 'Saved in this browser only; not synced across devices.',
    badgePayAwaiting: 'Awaiting payment',
    badgePayPartial: 'Deposit placed',
    badgePayDone: 'Fully paid',
    btnConfirmDeposit: 'Confirm deposit',
    tableDetails: 'Details',
    modalTitle: 'Order details',
    modalInternalIdLine: 'Internal order ID: {id}',
    modalConsultedCustomer: 'Contacted customer for consultation',
    modalPaymentHeading: 'Payment',
    modalOrderTotal: 'Order total',
    modalDepositNeed: 'Required',
    modalDepositDeposited: 'Deposited',
    modalCodAfterDeposit: 'Amount due on delivery (after deposit)',
    modalProductsHeading: 'Products',
    modalColImage: 'Image',
    modalColProduct: 'Product',
    modalCopyAddress: 'Copy',
    toastAddressCopied: 'Address copied',
    toastAddressCopyFailed: 'Could not copy address',
    modalSkuPrefix: 'SKU (ID):',
    modalColor: 'Color',
    modalSize: 'Size',
    modalQty: 'Qty',
    modalOrderUnavailable: 'This order is not in the current list. Try reloading or close.',
    modalOrderNoteLabel: 'Order note',
    modalShippingAddressHeading: 'Shipping address',
    modalContactSectionTitle: 'Customer & order handling',
  },
  partnerMessagingAi: {
    panelTitle: 'AI auto-replies',
    panelSubtitle:
      'After a customer message we wait for you for the configured time; if no reply yet, the AI answers using your shop policy, tone, and in-stock inventory. Some messages are routed without LLM (purchase list prompts, buy-in-chat hints, …).',
    tabSettings: 'Settings',
    tabInventory: 'In-stock items',
    tabUsage: 'API tokens',
    usagePeriodLabel: 'Range',
    usagePeriodDay: 'Day',
    usagePeriodWeek: 'Week',
    usagePeriodMonth: 'Month',
    usagePeriodScopeDay: 'over the last 24 hours',
    usagePeriodScopeWeek: 'over the last 7 days',
    usagePeriodScopeMonth: 'over the last 30 days',
    usageRangeModeLabel: 'View',
    usageRangeModeRolling: 'Rolling window',
    usageRangeModeCalendar: 'Pick dates (UTC)',
    usageCalendarFromLabel: 'From',
    usageCalendarToLabel: 'To',
    usagePeriodScopeCalendar: 'from {from} through {to} (UTC calendar days, inclusive)',
    usageSectionCreditTitle: 'Credits deducted (wallet & logo)',
    usageSectionCreditIntro:
      'Balance deductions we record: your wallet spend ledger (e.g. curriculum, English coach) and shop logo normalization charges — separate from API token tallies below.',
    usageSectionApiTitle: 'API usage (tokens / images / embeddings)',
    usageSectionApiIntro:
      'Inbox LLM, Nano Banana renders, image/text embeddings, material inference from product photos — counted from usage logs, not routed like wallet credits above.',
    tokenUsageIntro:
      'Aggregated {scope}. Each row is an API model used when the AI replies via LLM (after the wait time).',
    tokenUsageEmpty: 'No LLM calls in this period yet.',
    tokenUsageColProvider: 'Provider',
    tokenUsageColModel: 'Model',
    tokenUsageColCalls: 'Calls',
    tokenUsageColPrompt: 'Prompt tokens',
    tokenUsageColCompletion: 'Completion tokens',
    tokenUsageColTotal: 'Total tokens',
    tokenUsageColEstimatedCost: 'Est. (₫)',
    tokenUsageCostDisclaimer:
      'Estimates use Gemini Developer API–style USD/1M token rates (some models tier at >200k prompt tokens per call). Aggregated rows use the lower tier as an approximation. Unknown models fall back to gemini-3-flash-preview. USD→VND: env PARTNER_AI_TOKEN_COST_USD_TO_VND.',
    tokenUsageEstimatedTotalLabel: 'Estimated total (~{amount} ₫)',
    tokenUsageDetailEstimatedTotalLabel: 'Sum of detail rows (~{amount} ₫)',
    tokenUsageByKindTitle: 'By call type (usage_kind)',
    tokenUsageByKindIntro:
      'Aggregates all LLM token rows: inbox chat jobs, material inference, inbox image generation, etc.',
    tokenUsageByDayTitle: 'By day (UTC)',
    tokenUsageByDayIntro: 'Calls and token totals per calendar day in UTC.',
    tokenUsageColDay: 'Day (UTC)',
    tokenUsageCostByKindAndModelTitle: 'By branch and model',
    tokenUsageCostByKindAndModelIntro:
      'Each row is a usage_kind + model pair; estimated cost (₫) from aggregated tokens.',
    tokenUsageCostByWeekTitle: 'By week (UTC, Monday start)',
    tokenUsageCostByWeekIntro:
      'Days in the selected range grouped by UTC week (weeks start on Monday).',
    tokenUsageColWeekStart: 'Week of (UTC)',
    tokenUsageCostByMonthTitle: 'By month (UTC)',
    tokenUsageCostByMonthIntro: 'Grouped by UTC calendar month (YYYY-MM) within the selected range.',
    tokenUsageColMonthUtc: 'Month (UTC)',
    tokenUsageCostTablesNote:
      'Extra columns show estimated cost (₫) by branch, day, week, and month (UTC), using the same formula as the period total.',
    usageDetailApiTitle: 'Per-call LLM usage (inbox)',
    usageDetailApiIntro:
      'Each row is one API call after the wait time — actual token counts.',
    usageDetailColTime: 'Time',
    usageDetailColUsageKind: 'Kind',
    usageTokenKindInbox: 'Inbox LLM',
    usageTokenKindMaterialInfer: 'Material (from photo)',
    usageDetailEmpty: 'No per-call records in this period.',
    usageCreditLedgerTitle: 'Credits deducted (wallet ledger — idempotent spend)',
    usageCreditLedgerIntro:
      'Spend events recorded on your account (e.g. curriculum, English coach). Separate from the inbox API token tallies in the section below.',
    usageCreditLedgerEmpty: 'No spend events in this period.',
    usageCreditColType: 'Type (charge_type)',
    usageCreditColAmount: 'Total credits',
    usageCreditColCount: 'Count',
    usageCreditDetailTitle: 'Recent spend events',
    usageCreditColWhen: 'When',
    usageCreditColSingle: 'Credits',
    usageLogoCreditTitle: 'Logo normalization (shop workspace)',
    usageLogoCreditIntro:
      'Credits charged directly when generating/editing brand logo; not routed through the spend ledger above.',
    usageLogoCreditEmpty: 'No logo normalization with credits in this period.',
    usageLogoColModel: 'Model',
    usageLogoColStatus: 'Status',
    usageNoOwnerHint:
      'Workspace has no linked owner account — wallet spend ledger cannot be shown.',
    usageEmbedImageTitle: 'Image embeddings (Gemini)',
    usageEmbedImageIntro:
      'Each embedContent call for product images: inventory vector sync (inventory_sync) or customer photo search (guest_image_search). Tokens come from Google usageMetadata when present; otherwise estimated (GEMINI_IMAGE_EMBED_FALLBACK_TOKENS).',
    usageEmbedImageEmpty: 'No image embedding calls recorded in this period.',
    usageEmbedTextTitle: 'Text embeddings (Gemini) — search vectors',
    usageEmbedTextIntro:
      'Each embedContent call for text: inventory vector sync (inventory_sync) or customer message for semantic product search (customer_query). Tokens from Google usageMetadata.',
    usageEmbedTextEmpty: 'No text embedding calls recorded in this period.',
    usageEmbedTextSourceQuery: 'Customer message (semantic search)',
    usageEmbedColSource: 'Source',
    usageEmbedSourceInventory: 'Inventory sync',
    usageEmbedSourceGuest: 'Customer image (search)',
    usageEmbedColPromptSum: 'Sum prompt tokens',
    usageEmbedColTotalSum: 'Sum billable tokens',
    usageEmbedDetailTitle: 'Per-call embedding log',
    usageEmbedColInventoryId: 'Inventory row',
    usageImageGenTitle: 'Nano Banana — inbox image generation',
    usageImageGenIntro:
      'Nano Banana is our label for the Gemini image pipeline (model gemini-3-pro-image-preview). Both branches — material/color detail collages and real-use / lifestyle shots — take one on-file product photo as input and generate a new image from it (not a simple reuse of the original file). Each row counts a new API generation saved to inventory — same window as the LLM token table above. Cached rows are not regenerated.',
    usageImageGenEmpty: 'No Nano Banana image generations recorded in this period.',
    usageImageGenColKind: 'Image type',
    usageImageGenKindMaterial: 'Material / color detail',
    usageImageGenKindRealUse: 'On-body / real-use preview',
    usageImageGenColCalls: 'API calls',
    usageImageGenColTotalTokens: 'Total tokens (billable est.)',
    usageImageGenTotalCallsLabel: 'Total image calls (Nano Banana)',
    usageNanoBananaBadge: 'Nano Banana',
    usageNanoBananaModelHint: 'gemini-3-pro-image-preview · inbox',
    usageNanoBananaStatCalls: 'Image generation calls: {calls}',
    usageNanoBananaStatTokens: 'Total tokens (billable est.): {tokens}',
    enableLabel: 'Enable auto-replies',
    enableHint: 'When off, only manual replies from you are sent.',
    delayLabel: 'Wait before AI replies (seconds)',
    delayHint:
      '0–30 seconds: wait before scheduling work that needs the model (after a customer message; not added after the model finishes). Default 0. If you reply first, the AI will not send.',
    typingMinLabel: 'Typing delay min (ms)',
    typingMaxLabel: 'Typing delay max (ms)',
    typingHint:
      'Random delay (ms) before sending automated messages that do not use the LLM (e.g. purchase list, buy-in-chat guidance). DeepSeek replies do not use this after the model returns. Set both to 0 to disable.',
    productConsultationContextLabel: 'Shop AI context & instructions',
    productConsultationContextHint:
      'One field for everything the AI must always use: shop policies, reply tone, consultation style, closing guidance, exchanges, deposits, shipping…',
    productConsultationContextPlaceholder:
      'e.g. use a polite and concise tone. Always ask customers to check the size chart before ordering. Sale items are final. Made-to-measure orders require a 50% deposit. Handle hesitation gently without pressuring customers…',
    disclosureToggle: 'Append an AI disclosure line',
    disclosureSuffixLabel: 'Disclosure text (end of message)',
    disclosureSuffixHint: 'Shown at the end of each AI message so customers know it is automated.',
    saveSettings: 'Save settings',
    loadError: 'Could not load AI settings.',
    faqKeywordsLabel: 'Trigger keywords',
    faqKeywordsHint: 'Separate with commas or new lines.',
    faqAnswerLabel: 'Answer',
    faqSortLabel: 'Order',
    faqActiveLabel: 'Active',
    inactiveBadge: 'Off',
    addFaq: 'Add FAQ',
    saveRow: 'Save',
    deleteRow: 'Delete',
    cancelEdit: 'Cancel',
    inventoryName: 'Product name',
    inventorySku: 'SKU (optional)',
    inventoryDesc: 'Specs / short description',
    inventoryStock: 'Stock / availability',
    inventoryPrice: 'Price (text note)',
    inventorySort: 'Order',
    inventoryImageUrl: 'Product image (URL)',
    inventoryImageUrlHint:
      'Paste a public image URL starting with https:// (e.g. from your CDN or store). It is passed to the AI as text; the AI may repeat the link for customers.',
    inventoryProductUrl: 'Product page (URL)',
    inventoryProductUrlHint:
      'Product detail page on your shop website (https://…). Returned in image search results and in the Excel column “Link trang sản phẩm”.',
    inventoryProductVideoUrl: 'Product video (URL)',
    inventoryProductVideoUrlHint:
      'YouTube watch/embed URL, or an https:// link to an .mp4 or hosted player (CDN). Same as the Excel “Video” column.',
    inventoryOpenProductPage: 'Open product page',
    inventoryOpenProductVideo: 'Open video',
    inventoryGuestConsultLink: 'Open consult chat',
    inventoryGuestConsultLinkHint:
      'NanoAI chat URL with this product’s image and context (website, QR, ads). Opens with an auto consult message.',
    inventoryGuestConsultLinkNeedSave: 'Save the item first to get the full chat link.',
    inventoryGuestConsultLinkCopied: 'Chat link copied.',
    inventoryConsultNote: 'Notes for advising customers',
    inventoryConsultNoteHint:
      'e.g. 12-month warranty, ships in 2–3 days, 10% off promo, exchange only for defects, free shipping over…',
    inventoryDescHint: 'Sizes, colors, material, dimensions, what is included in a set…',
    inventoryStockHint: 'Qty left, or “M/L in stock”, “backorder ~5 days”…',
    inventoryFieldsGuide:
      'Also useful (use description or advisory note): available colors/sizes; delivery time & fees; promo end dates; per-item return rules; care instructions. Every row in this inventory list is sent to the AI for customer replies; remove a row (or omit it from an import) if you do not want the AI to mention that product. The sample file includes a Status column: 1 = add/update, 0 = delete that row from inventory (match by SKU or name).',
    inventoryOpenApiLink: 'API integration guide',
    inventoryOpenApiHint:
      'Your shop backend can push inventory to NanoAI with JSON (Open Catalog schema, Shopee-like field names). Same Bearer key as image search; Vision is not required.',
    inventoryDownloadTemplate: 'Download sample Excel',
    inventoryExportExcel: 'Export Excel',
    inventoryImportExcel: 'Import Excel',
    inventoryImportReplaceWarning:
      'Excel import: rows matching an existing SKU (case-insensitive) are updated; otherwise inserted. Without a SKU, rows match by name to existing rows that also have no SKU (if several match, the first matching row is used). Status column (or is_active): 1 = add/update; 0 = delete that item from inventory (requires SKU or name to match). Display order follows row order in the file unless a Sort order column is present. Items already in stock that are not in the file stay unchanged. Continue?',
    inventoryImportSuccess: 'Processed {count} row(s): {inserted} added, {updated} updated, {deleted} removed.',
    inventoryImportFailed: 'Excel import failed.',
    inventoryExcelImportUploading: 'Uploading Excel file…',
    inventoryExcelImportSending: 'Sending file…',
    inventoryErrInvalidXlsx: 'Invalid Excel file (.xlsx).',
    inventoryErrEmptySheet: 'The sheet is empty.',
    inventoryErrMissingName: 'Missing product name column (name). Use the sample file.',
    inventoryErrNoRows:
      'No valid rows (need at least one row with a product name to add/update, or Status = 0 with SKU or name to delete).',
    inventoryErrNoFile: 'No file selected.',
    inventoryErrFileTooLarge: 'File is too large (max ~20 MB).',
    inventoryErrTooManyRows: 'File has too many rows. Maximum {max} rows per import.',
    inventoryLoadMore: 'Load more ({shown}/{total})',
    inventoryVectorSearchPlaceholder: 'Describe the product (e.g. wool sweater, leather shoes) — semantic search',
    inventoryVectorSearchHint:
      'Uses text vectors (name, price, notes) or image similarity (image vectors). Requires “Sync now” and GOOGLE_API_KEY.',
    inventoryVectorSearchByText: 'Search',
    inventoryVectorSearchByImage: 'Image',
    inventoryVectorSearchClear: 'Clear filter',
    inventoryVectorSearching: 'Searching…',
    inventoryVectorSearchFailed: 'Search failed. Check API key and embedding sync.',
    inventoryVectorSearchNoResults: 'No matching items.',
    addInventory: 'Add item',
    edit: 'Edit',
    emptyFaq: 'Pick a preset question below and enter how your shop replies.',
    emptyInventory:
      'No items yet. Add what you keep in stock so the AI only advises using that list.',
    inventoryProductCountSummary: '{count} product(s) in inventory.',
    inventoryEmbeddingTitle: 'Image embedding progress',
    inventoryEmbeddingSummary: 'Embedded {done}/{eligible}. Pending {pending}. Errors {failed}.',
    inventoryEmbeddingSyncNow: 'Sync now',
    inventoryEmbeddingSyncRunning: 'Syncing...',
    inventoryEmbeddingSyncDoneTitle: 'Inventory embedding sync completed',
    inventoryEmbeddingSyncDoneBody: 'Processed {synced} item(s) (image + text). Failed {failed}.',
    inventoryEmbeddingAutoHint:
      'In the browser: back-to-back batches while Messaging → AI settings stays open; closing the tab stops it. For 24/7 background runs: enable cron — on Vercel use vercel.json + CRON_SECRET and MESSAGING_INVENTORY_EMBED_CRON_SECRET; or use system crontab to POST /api/cron/messaging-inventory-embed-backfill. See .env.example.',
    inventoryTextEmbeddingTitle: 'Text embedding progress',
    inventoryTextEmbeddingSummary: 'Embedded {done}/{eligible}. Pending {pending}. Errors {failed}.',
    inventoryTextEmbeddingAutoHint:
      'Text vectors (name + price + consult note) power semantic search in chat. Uses the same “Sync now” as image vectors; while this page is open, batches continue until image or text backlog clears; cron /api/cron/messaging-inventory-embed-backfill covers background.',
    cronSetupHint:
      'Production: schedule GET or POST /api/cron/messaging-partner-ai with Authorization: Bearer MESSAGING_PARTNER_AI_CRON_SECRET (e.g. every minute) and set DEEPSEEK_API_KEY. Without cron, jobs stay pending and AI never sends. `next dev` auto-runs the processor after the delay (no cron). For `next start` locally without cron, set MESSAGING_PARTNER_AI_DEV_WAKE=1 in .env.',
    toggleStatusOn: 'On',
    toggleStatusOff: 'Off',
    aiEngineTitle: 'Smart reply AI',
    aiEngineDescription:
      'After the wait window, conversational replies call the DeepSeek API (model {model}) using your inventory and policies.',
    disclosureSwitchOn: 'Append note',
    disclosureSwitchOff: 'No note',
    faqPresetsIntro:
      'Common shopping questions are pre-written for you. Enter your reply and turn on “Active”; we detect similar customer messages in many languages.',
    faqPresetSaveHint: 'Save each item after editing.',
    faqPresetAnswerRequired: 'Turning on “Active” requires a reply.',
    faqCustomSectionTitle: 'Your own customer questions',
    faqCustomSectionIntro:
      'Add questions specific to your shop: a short note for yourself, keywords so similar messages match, and the reply text.',
    faqCustomAddTitle: 'Add a custom question',
    faqCustomQuestionLabel: 'How customers usually ask (your note)',
    faqCustomQuestionHint: 'Optional. Example: “Can you add a pocket?” — not used for automatic matching.',
    faqCustomKeywordsRequired:
      'When “Active” is on, add at least one keyword (each ≥ 2 characters), separated by commas or new lines.',
    faqPresetQuestions: {
      stock: 'In stock / out of stock / size available?',
      shipping: 'Shipping, fees, how long to receive?',
      price: 'How much, any discount?',
      size_fit: 'Sizing, fit, size chart?',
      payment: 'How to pay (COD, bank transfer, …)?',
      return_policy: 'Returns and refunds?',
      order_track: 'Track order, where is the tracking number?',
      warranty: 'Warranty details?',
      authentic: 'Is it genuine / authentic?',
      promo: 'Promotions, coupon codes?',
    },
    visionSearchTitle: 'Product suggestions when customers send a photo',
    visionSearchHint:
      'Uses Vertex AI Vision Image Warehouse: each shop is filtered by partner_id in a shared corpus/index. Requires GCP (us-central1 or europe-west4), a GCS bucket, and a service account with Vision AI + Storage; set GCS_VISION_CATALOG_BUCKET, VISION_WAREHOUSE_CORPUS_ID, VISION_WAREHOUSE_INDEX_ID, VISION_WAREHOUSE_INDEX_ENDPOINT_ID, optionally GOOGLE_CLOUD_PROJECT_NUMBER. The reindex cron uses the shop GCP region (stored in vision_warehouse_runner when sync or asset removal marks pending). After images are imported, run cron /api/cron/vision-warehouse-reindex (same secret as vision catalog cron) to analyze the corpus and rebuild the index — image search is complete only after that. Sync is incremental; deleting an inventory row removes the matching asset and needs the cron again.',
    visionSearchEnable: 'Enable image-based suggestions',
    visionShopCountryLabel: 'Shop country / region (Vision preset)',
    visionShopCountryHint:
      'Pick where your shop mainly operates — we suggest a matching Google Cloud Vision region. Staying close to your GCP project’s region usually makes catalog image sync and data transfer faster and more reliable. Override the region below if you know your setup. If unsure, don’t guess: use «Custom Vision region (advanced)» and ask whoever manages GCP, or set the correct region once confirmed.',
    visionShopCountryCustom: 'Custom Vision region (advanced)',
    visionShopCountryAdvancedHint:
      'Choose the Vision region and product category below to match your GCP project. Shown when no country preset is used or the saved region does not match the preset.',
    visionLocationLabel: 'Vision region',
    visionCategoryLabel: 'Product category (index)',
    visionBucketOverrideLabel: 'GCS bucket (optional)',
    visionBucketOverrideHint: 'Leave blank to use the server’s GCS_VISION_CATALOG_BUCKET.',
    visionWarehouseInventorySummary:
      'Inventory: {total} items · {withImage} rows with an https image URL (only these rows are uploaded to Google Vision).',
    visionCatalogSyncStatsTitle: 'Image catalog sync status (NanoAI → Google)',
    visionCatalogSyncStatsLineSynced: 'Up to date — skipped on the next sync (not re-uploaded): {n} row(s)',
    visionCatalogSyncStatsLinePending: 'Waiting to upload or update (image or name changed): {n} row(s)',
    visionCatalogSyncStatsLineNoHttps: 'No https image URL — cannot import to Vision: {n} row(s)',
    visionCatalogSyncStatsLineExcluded: 'Excluded from Vision: {n} row(s)',
    visionCatalogSyncStatsExplain:
      'Only “pending” rows are imported; rows whose checksum matches the current image + name are treated as already published and are not uploaded again. In GCS, the object count often differs from product count because of jsonl batch files and multiple images. For corpus/index asset counts, check Vision Warehouse in Google Cloud. Protocol-relative image URLs (//domain/...) are accepted; https is assumed.',
    visionSyncButton: 'Sync inventory images to Google',
    visionSyncAutoWhenEnableHint:
      'After you turn on image-based suggestions and save succeeds, the app keeps syncing automatically in segments (resume) until finished — you usually do not need to click again. Only if something errors or the absolute safety cap is hit, use «Sync inventory images».',
    visionSyncing: 'Syncing…',
    visionSyncOk: 'Image catalog synced.',
    visionIndexReady: 'Index ready',
    visionIndexNotReady: 'Not synced or index error',
    visionLastSynced: 'Last synced',
    visionSyncErrorLabel: 'Last error',
    visionWarehouseReindexPending:
      'Vision Warehouse data was updated; waiting for the index rebuild cron (/api/cron/vision-warehouse-reindex). Image search will be complete after the cron finishes.',
    visionWarehouseCorpusUnsupportedType:
      'The corpus in VISION_WAREHOUSE_CORPUS_ID is not an Image Warehouse corpus of type IMAGE — Google rejects import (CORPUS_UNSUPPORTED_TYPE). Create a new Image Warehouse corpus with type IMAGE per Google Cloud docs, attach a matching index and endpoint, update the IDs in .env and AI settings, then sync again. Video or other corpus types cannot use this image import flow.',
    visionProductSearchMaintenanceTitle: 'Google Vision Product Search is in maintenance / restricted',
    visionProductSearchMaintenanceDetail:
      'Google is temporarily blocking legacy Product Search catalog operations (Google-side). See Image Warehouse: https://cloud.google.com/vision-ai/docs/image-warehouse-overview — Legacy Product Search access request: https://forms.gle/QPLzMdwSMCR2pPsq5 — NanoAI catalog sync uses Image Warehouse; you only see this notice when a Google response still mentions Product Search.',
    visionSyncToastImported: 'Indexed',
    visionSyncToastRemoved: 'Removed (invalid/missing image URL)',
    visionSyncToastMore: 'More items may remain — run sync again.',
    visionSyncToastIdle: 'Nothing to sync right now.',
    visionSyncChainedRounds: 'Ran {n} sync batches in a row',
    visionSyncChainedStoppedMaxRounds: 'Automatic batch limit reached — click sync to continue.',
    visionSyncChainedStoppedTimeout:
      'Stopped after a time limit (keeps the tab responsive) — click sync to continue.',
    visionSyncChainedAbortedSafety:
      'Automatic sync stopped at the absolute safety limit — click sync to continue or check for errors.',
    visionBgSyncTitle: 'Background sync to Google (VPS / cron)',
    visionBgSyncHint:
      'Queues a server job: your VPS calls GET or POST /api/cron/vision-catalog-sync on a schedule with Bearer VISION_CATALOG_SYNC_CRON_SECRET (see .env.example). You can close the tab; reopen this page for the full report when finished or on error. Optional: once a day, call GET/POST /api/cron/vision-bg-sync-enqueue (same Bearer, or VISION_BG_SYNC_ENQUEUE_CRON_SECRET) to auto-queue background sync for every shop with image suggestions enabled — this does not replace the catalog-sync cron.',
    visionBgSyncButton: 'Start background sync',
    visionBgSyncUseResumeHint:
      'If this tab still holds a partial sync cursor (from an earlier browser sync), the background job resumes from it; otherwise it rescans from the start.',
    visionBgSyncCancel: 'Cancel background job',
    visionBgSyncDismiss: 'Dismiss report',
    visionBgSyncStatusQueued: 'Queued for cron',
    visionBgSyncStatusRunning: 'Cron running',
    visionBgSyncStatusDone: 'Completed',
    visionBgSyncStatusError: 'Error',
    visionBgSyncStatusIdle: 'No background job',
    visionBgSyncReportTitle: 'Background sync report',
    visionBgSyncFieldRounds: 'API rounds',
    visionBgSyncFieldImported: 'Indexed',
    visionBgSyncFieldRemoved: 'Removed',
    visionBgSyncFieldHasMore: 'Backlog remains',
    visionBgSyncFieldLastScanned: 'Cursor (last item)',
    visionBgSyncFieldStopped: 'Stop reason',
    visionBgSyncFieldMessage: 'Message',
    visionBgSyncFieldServerError: 'Server error',
    visionBgSyncBoolYes: 'Yes',
    visionBgSyncBoolNo: 'No',
    visionBgSyncPollingNote:
      'While queued or running in the background, this page refreshes about every 8 seconds (keep the tab open).',
    visionBgSyncProgressTitle: 'Progress uploading products to Google',
    visionBgSyncProgressRatio: 'Indexed so far: {imported} / ~{total} in-stock rows with an image URL',
    visionBgSyncProgressHint:
      '~ denominator counts inventory rows that currently have an image link. API totals may differ slightly per batch.',
    visionBgSyncProgressNoImageRows: 'No inventory rows have an image URL yet — progress cannot be estimated.',
    visionBgSyncQueuedExplain:
      '«Queued for cron» means the job is in the database but **no worker has run yet** — 0 / N is normal until the server calls GET/POST `/api/cron/vision-catalog-sync` (Bearer secret) or you tap «Run one server pass» below.',
    visionBgSyncPostRefreshExplain:
      'POSTs to `/dashboard/messaging/settings` about every 8s only **reload job status** (server actions), not Google Vision.',
    visionBgSyncRunSliceButton: 'Run one server pass',
    visionBgSyncRunSliceHint:
      'Same as one cron tick (may take a few minutes). You should still set up crontab on the VPS for production.',
    visionBgSyncRunSliceOk: 'Finished one pass: {rounds} API round(s) · {partners} partner job(s) touched.',
    visionBgSyncEnqueueOk: 'Background sync queued. Your VPS cron will pick it up.',
    visionBgSyncToastDone: 'Vision background sync finished.',
    visionBgSyncToastError: 'Vision background sync failed.',
    visionBgSyncAlreadyActive: 'Background job is already queued or running.',
    visionBgSyncAlreadyActiveRefreshHint:
      'Status refreshed from the server. If it stays queued for a long time, check the Vision sync cron on your VPS or tap «Cancel background job».',
    visionBgSyncEnableVisionFirst: 'Turn on image-based suggestions before starting background sync.',
    visionBgSyncSaveSettingsFirst: 'Save Messaging AI settings at least once first.',
    visionBgSyncStopCompleted: 'Completed',
    visionBgSyncStopError: 'Processing error',
    visionBgSyncStopCronSlice: 'Cron slice ended (will resume)',
    visionBgSyncStopBadCursor: 'Invalid cursor',
    visionBgSyncServerErrCursor: 'Backlog remains but scan cursor is missing — stopped safely',
    visionBgSyncMsgCompleted: 'Catalog sync finished.',
    visionBgSyncMsgInProgress: 'In progress — the next cron run will continue.',
    visionBgSyncMsgBadCursor: 'Stopped: inconsistent cursor from server.',
    visionHealthPanelTitle: 'Vision sync health',
    visionHealthStatusHealthy: 'Green',
    visionHealthStatusWarning: 'Yellow',
    visionHealthStatusStuck: 'Red (stuck)',
    visionHealthStatusIdle: 'No data yet',
    visionHealthPendingCount: 'Pending items: {n}',
    visionHealthChecksumDone: 'Checksum done: {done}/{total}',
    visionHealthLockAge: 'Lock age',
    visionHealthLockBusy: 'Busy ({sec}s)',
    visionHealthLockFree: 'Free',
    visionHealthLockOwner: 'Lock owner',
    visionHealthOwnerUnknown: 'Unknown owner',
    visionHealthHeartbeatAge: 'Heartbeat age',
    visionHealthHeartbeatAlive: 'Alive ({sec}s)',
    visionHealthHeartbeatNone: 'No heartbeat',
    visionHealthLastProgress: 'Last progress',
    visionHealthLastProgressNone: 'None',
    visionHealthUnlockButton: 'Unlock import lock',
    visionHealthUnlockOk: 'Vision Warehouse import lock released.',
    visionEmergencyDisableButton: 'Emergency disable Vision',
    visionEmergencyDisableConfirm:
      'Disable all Vision features for this shop now? This will stop background sync, disable image suggestions, and clear runner locks.',
    visionEmergencyDisableOk: 'Vision has been disabled for this shop.',
    visionInventoryDeleteRemovesIndexNote:
      'Deleting a row in the Inventory tab removes that product from Google Vision automatically — no purge list upload.',
    imageSearchApiTitle: 'Image product search API (for your shop website)',
    imageSearchApiHint:
      'Send a photo as multipart (field image or file) with Authorization: Bearer and your API key. Returns the closest matches from your synced Vision catalog. Prefer calling from your shop backend so the key is not exposed in the browser.',
    imageSearchApiEnable: 'Enable public API',
    imageSearchApiKeyConfigured: 'API key is set.',
    imageSearchApiKeyMissing:
      'No key yet — create and manage (mask, reveal, copy, delete) on the API integration page.',
    imageSearchApiEndpointLabel: 'Path (prefix with your NanoAI site domain)',
    imageSearchApiBaseUrlNote: 'Example: https://your-domain.com/api/messaging/partners/…/image-search',
    imageSearchApiDocHint:
      'POST multipart: image (file). Optional: limit (1–25, default 8). JSON: products[] with inventory_id, name, sku, image_url, product_url, score.',
    imageSearchApiGenerate: 'Generate / rotate API key',
    imageSearchApiGenerating: 'Generating key…',
    imageSearchApiKeyCreated: 'Key created (copied to clipboard if allowed). Save it now — it will not be shown again.',
    imageSearchApiManageKeysLink: 'Open API integration — manage keys',
    guestPurchaseFlowLabel: 'How customers check out on NanoAI chat',
    guestPurchaseFlowHint:
      'In chat: Buy opens the same order/QR flow as today. On shop website: Buy opens the product page (inventory URL) in a new tab — use when checkout and shipping live on your site.',
    guestPurchaseFlowInChat: 'Checkout in chat (form + NanoAI payment)',
    guestPurchaseFlowExternal: 'Open shop website when tapping Buy',
  },
  partnerGuestChat: {
    notFoundTitle: 'Chat page not found',
    notFoundDescription: 'Invalid link or the shop has disabled this feature.',
    pageTitleSuffix: 'Chat on NanoAI',
    metaDescription: 'Message {shop} on NanoAI — same inbox as Facebook, Zalo, and your web store.',
    shopLabel: 'Shop',
    subline:
      'You are chatting on NanoAI; the shop replies from their dashboard. Sign in with Google to sync your messages across devices.',
    placeholder: 'Type a message…',
    send: 'Send',
    emptyThread: 'No messages yet. Send the first one below.',
    loadError: 'Could not load messages.',
    sendError: 'Could not send the message.',
    pollNote: 'Replies from the shop may take a few seconds to appear.',
    guestAttachPhoto: 'Photo library',
    guestTakePhoto: 'Take photo',
    guestRemoveAttachment: 'Remove photo',
    guestUploading: 'Uploading photo…',
    guestImageTooLarge: 'Image is too large (max ~10 MB).',
    guestImageInvalidType: 'Only JPG, PNG, WebP, or GIF is supported.',
    guestCaptionHint: 'You can add an optional caption with the photo.',
    loginPromptTitle: 'Sign in to chat',
    loginPromptDescription:
      'Sign in with email to message the shop and continue the conversation on any device.',
    signInWithGoogle: 'Sign in',
    linkMyShops: 'My messages',
    linkMyOrders: 'My orders',
    widgetShoppingCart: 'Cart',
    widgetLanguageSelectAria: 'Language',
    sendKeyboardHint: 'Enter to send · Shift+Enter for a new line · Ctrl+V / Cmd+V to paste an image',
    tryOnOpen: 'AI try-on',
    tryOnTitle: 'Try on directly in chat',
    tryOnModelPhoto: 'Model photo',
    tryOnGarmentPhoto: 'Garment photo',
    tryOnGarmentSourceTitle: 'Choose garment image source',
    tryOnGarmentSourceDevice: 'Choose image from device',
    tryOnGarmentSourceRecent: 'Choose from 20 latest shop suggestions',
    tryOnGarmentRecentEmpty: 'No recent suggested images yet.',
    tryOnGenerate: 'Generate try-on image',
    tryOnGenerateWithCost: 'Generate try-on image (-{credits} credits)',
    tryOnPreparing: 'Generating try-on image…',
    tryOnNeedBoth: 'Both model and garment photos are required.',
    tryOnGarmentLimitReached: 'You can select up to {max} garment items.',
    tryOnGarmentItemsLabel: 'items',
    tryOnFailed: 'Could not generate the try-on image.',
    tryOnReady: 'Try-on image is ready. You can send it in chat.',
    tryOnChargedToast: 'Charged {cost} credits. Remaining {remaining} credits.',
    tryOnCreditsBalanceLabel: 'Balance: {credits}',
    tryOnTopUpCredits: 'Top up',
    tryOnResultViewLarge: 'View large try-on image',
    tryOnResultDownload: 'Download',
    tryOnEmbedGarmentFromPage: 'Product image from this page',
    tryOnEmbedGarmentFromPageWithSku: 'Product on this page (SKU: {sku})',
    tryOnEmbedOnlyFlowHint:
      'Choose your photo once; this browser remembers it in this chat frame next time. The garment image comes from the product on this page. Try-on uses credits — top up using the buttons inside this same chat frame (same tab as your shop; no separate NanoAI tab needed).',
    guestCreditWalletLoginTitle: 'Sign in to use your credit wallet',
    guestCreditWalletLoginDescription:
      'Try-on and top-ups require email verification (OTP code). Complete the steps below to continue.',
    toastGuestTopUpLoginRequired: 'Please sign in with email (OTP) before topping up credits.',
    toastTryOnInsufficientCredits: 'Not enough credits. Please top up and try again.',
    guestAuthPromptTitle: 'Sign in to keep chat history longer',
    guestAuthPromptBody: 'You can still chat now. Signing in lets you keep history across devices/browsers.',
    guestAuthEmailPlaceholder: 'Enter your email',
    guestAuthSendMagicLink: 'Send sign-in link',
    guestAuthSendOtp: 'Send OTP code',
    guestAuthOtpPlaceholder: 'Enter 6-digit OTP',
    guestAuthVerifyOtp: 'Sign in',
    guestAuthRequiredAfterLimit: 'You have sent {count} messages. Please verify your email to continue chatting.',
    guestAuthEmailSent: 'Verification email sent. Please check your inbox.',
    guestAuthOtpInvalid: 'OTP is invalid or expired.',
    guestAuthRateLimited: 'You are doing this too quickly. Please try again in {seconds} seconds.',
    guestAuthRememberDeviceHint:
      'Trust this device/browser long term (signing in again with the same email may skip OTP).',
    guestAuthVerifyingProgress: 'Signing in, please wait...',
    shopTypingHint: 'The shop is typing…',
    consultLinkShopPreparingHint: 'The shop is sending product details…',
    similarAlternativesTemplateMessage: 'Here are a few more styles for you below.',
    productSearchTemplateMessage:
      'Here are the matching products below. You can tap Buy now on any card to place an order in chat, or tap Consult to ask more.',
    visionPickHint: 'Choose the right product (or wait for a manual reply).',
    visionPickBusy: 'Sending…',
    visionPickError: 'Could not send your choice. Try again.',
    visionProductLink: 'Advice',
    visionProductBuy: 'Buy now',
    visionProductViewDetails: 'View details',
    visionProductVideo: 'Video',
    visionVideoCloseAria: 'Close video',
    productShelfButton: 'Products',
    urlProductContextChipLabel: 'Send viewed product',
    urlProductContextChipAria:
      'Share which product you are viewing on this page with the shop. Skip by typing a message first.',
    urlProductContextChipDismissAria: 'Dismiss — do not send viewed product context',
    productShelfTitle: 'Products you recently viewed',
    productShelfEmpty: 'No suggested products yet. Read the shop messages or send a photo to get picks.',
    productShelfSearchPlaceholder: 'Search inventory (style, description…)',
    productShelfSearchButton: 'Search',
    productShelfSearchImage: 'Image',
    productShelfSearchClear: 'Clear',
    productShelfSearching: 'Searching…',
    productShelfSearchFailed: 'Search failed. Try again after inventory embeddings sync.',
    productShelfSearchNoResults: 'No matching products.',
    productShelfBuy: 'Buy',
    purchaseOpenSiteToast: 'Opened the shop product page in a new tab.',
    purchaseMissingProductUrlToast: 'This item has no product URL — add it in inventory.',
    productConsultProductRefFromSku: 'product code {sku}',
    productConsultProductRefFromName: '{name}',
    productConsultAskShipping:
      "We're following up on {productRef} — shipping first, or product details?",
    productConsultAskDetail:
      "We're following up on {productRef} — what would you like to ask?",
    productConsultAskDetailFromSku:
      'I am interested in this item "{sku}". Please advise me.',
    pageContextInboundConsultNoSku:
      'Hi! You opened chat from a product page — tell us what you need and we will help.',
    pageContextInboundImageOnlyNote:
      'Opened a product link — the image is attached so the shop can advise (same as sending a photo).',
    guestProfileDialogTitle: 'Help us address you correctly',
    guestProfileDialogDescription:
      'Saved once on your NanoAI account (all shops): date of birth and gender (male or female) for natural honorifics and age-appropriate suggestions. You can skip and fill this in later.',
    guestProfileBirthLabel: 'Date of birth',
    guestProfileBirthDayPlaceholder: 'Day',
    guestProfileBirthMonthPlaceholder: 'Month',
    guestProfileBirthYearPlaceholder: 'Year',
    guestProfileGenderLabel: 'Gender',
    guestProfileGenderMale: 'Male',
    guestProfileGenderFemale: 'Female',
    guestProfileSave: 'Save',
    guestProfileRemindLater: 'Later',
    guestProfileInvalid: 'Please enter your date of birth and choose a gender.',
  },
  messagingMyChats: {
    pageTitle: 'My messages',
    pageDescription: 'Shops you have messaged on NanoAI.',
    emptyList: 'No conversations yet. Open a shop chat link to get started.',
    openChat: 'Open chat',
    lastActivity: 'Last activity',
    loadFailed: 'Could not load the list.',
    backHomeAria: 'Back to home',
  },
  messagingMyOrders: {
    pageTitle: 'My orders',
    composerOrdersLabel: 'Orders',
    pageDescription: 'Orders placed via NanoAI chat — payment and shipping status per order.',
    emptyList: 'No orders yet. Place an order in a shop chat to see it here.',
    loadFailed: 'Could not load the list.',
    backHomeAria: 'Back to home',
    openChat: 'Open chat',
    createdAt: 'Placed at',
    totalLabel: 'Order total',
    payStatus: 'Payment',
    shipStatus: 'Shipping',
    stAwaiting: 'Awaiting deposit (bank transfer)',
    stChecking: 'Verifying payment',
    stPaid: 'Paid',
    stManual: 'Pending shop review',
    stCancelled: 'Cancelled',
    shPending: 'Pending',
    shConfirmed: 'Confirmed',
    shPacking: 'Packing',
    shShipping: 'Shipping',
    shDelivered: 'Delivered',
    shReturned: 'Returned',
    shCancelled: 'Cancelled',
    orderIdLabel: 'Order ID',
    transferMemoLabel: 'Transfer memo',
    qtyLabel: 'Qty',
    colorLabel: 'Color',
    sizeLabel: 'Size',
    noteLabel: 'Note',
    unitPriceLabel: 'Unit price',
    depositPctLabel: 'Deposit',
    amountDueLabel: 'Due now (deposit)',
    paidRecordedLabel: 'Paid',
    balanceOnDeliveryLabel: 'Due on delivery (remaining)',
    shipToLabel: 'Ship to',
    productPhotoAlt: 'Ordered product',
    variantImagesSectionLabel: 'Selected color / variant images',
    totalQtySummaryLabel: 'Total quantity',
    viewTimelineButton: 'Order timeline',
    timelineTitle: 'Order timeline',
    timelineLoadFailed: 'Could not load order history.',
    timelineEmpty: 'No events yet.',
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
    education: 'Education & Training',
    image_edit: 'Image Editing',
    design_creative: 'Design & Creative',
    three_d_special: '3D & Specialized',
    music_ai: 'AI Music',
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
    wedding_invitation_ai: 'AI Wedding Invitation',
    text_to_image: 'Text-to-image',
    infographic_from_book: 'Infographic from book',
    sketch_to_image: 'Sketch to image',
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
    edit_image_by_request: 'Edit image by request',
    product_3d_sample: '3D Product Sample',
    model_3d_from_image: '3D Model from Image',
    create_video_from_image: 'AI video (Veo)',
    flow_music_veo_video: 'AI music video (Flash + Veo)',
    interior_exterior: 'Interior & Exterior',
    my_house: 'Home style preview',
    portrait_photo: 'Portrait Photo',
    expand_frame: 'Expand Frame',
    face_swap: 'Face Swap',
    translate_document_image: 'Translate Document Images',
    lyria3_instrumental_song: 'Create music (vocal or instrumental)',
    meeting_recorder_report: 'Meeting recording & AI report',
    ai_language_learning: 'AI Language Learning',
    create_curriculum: 'Create curriculum',
    my_curricula: 'My curricula',
    online_exam: 'Online exam (live session)',
    homework_online: 'Create homework',
    classes: 'Classes',
    try_on_1: 'Try-on 1 Person',
    try_on_2: 'Try-on 2 People',
    try_on_3: 'Try-on 3 People',
    try_on_4: 'Try-on 4 People',
    try_on_5: 'Try-on 5 People',
    image_result_display: 'Image result display',
    admin: 'Admin',
  },
  creationSidebar: {
    back: 'Back',
    relatedTitle: 'Related',
    popularTitle: 'Popular tools',
  },
  imageResultDisplay: {
    pageTitle: 'Before & after display',
    pageIntro:
      'Default: drag-to-compare in one frame (same interaction as interior/exterior design). Or choose side-by-side. Applies to all image tools; you can still switch per result page.',
    modeSplitTitle: 'Side by side',
    modeSplitDesc: 'Original and output side by side — tap to enlarge, same as before.',
    modeCompareTitle: 'Drag to compare (default)',
    modeCompareDesc:
      'One frame with a center handle — left: original, right: result; includes fullscreen like the aligned image tools.',
    persistNote: 'Saved in this browser on this device.',
  },
  taskHub: {
    pageTitle: 'Tasks & queue',
    pageDescription:
      'Track in-progress work (images, video, batch translation, curriculum) and open each tool quickly.',
    sectionRunning: 'In progress',
    sectionRecent: 'Recently finished or failed (7 days)',
    emptyRunning: 'Nothing is running right now.',
    emptyRecent: 'No finished tasks in the last 7 days.',
    openTool: 'Open tool',
    batchSummary: '{done}/{total} done',
    itemsCount: '{n} items',
    worksheetSection: 'Homework / curriculum (background)',
    worksheetParseSgk: 'Extract textbook',
    worksheetQuiz: 'Step-by-step quiz',
    worksheetEssay: 'Essay grading / generation',
    worksheetUnknownType: 'Worksheet job',
    statusProcessing: 'Running',
    statusFailed: 'Failed',
    statusCompleted: 'Done',
    statusCancelled: 'Cancelled',
    statusMixed: 'Partial',
    hintTranslateProgress:
      'Translation batches: open the tool page for detailed progress, ZIP download, and cancel.',
    linkProcessedImages: 'Processed images',
    linkTranslateHistory: 'Translation history',
    linkTranslateProgress: 'Translation queue',
    autoRefreshNote: 'This list refreshes about every 8 seconds while this tab is visible.',
  },
  meetingRecorder: {
    cardTitle: 'Record a meeting → AI report',
    cardDescription:
      'Recording in the browser costs no credits. The meeting title is saved on this device when you press start recording. Credits are charged only when you generate the AI report, based on recording length.',
    freeRecordingNote: 'Recording and saving the meeting name: no credits.',
    silenceAutoStopNote:
      'If no speech is detected for 5 minutes straight, recording stops automatically and saves like a manual stop.',
    autoStoppedBySilence: 'Recording stopped automatically: no speech detected for 5 minutes.',
    segmentAutoSplitNote:
      'Every 5 minutes the current segment ends and a new one starts automatically (same mic) — no server-side audio cutting.',
    segmentRotatedToast: 'Started a new 5-minute recording segment.',
    chargeNote:
      'AI report (minutes + summary): first 5 minutes = 1 credit; then +0.2 credit per minute (overage rounded up).',
    sessionNote:
      'Recordings are stored on the server for up to {days} days, then removed automatically. In this session you can still play/download locally; the meeting title is saved on this device when you press start recording.',
    meetingTitleLabel: 'Meeting title',
    meetingTitlePlaceholder: 'e.g. Q1 project sync',
    savingRecording: 'Saving recording to server…',
    saveRecordingFailed: 'Could not save the recording. Check your network and try again.',
    retrySaveRecording: 'Retry saving recording',
    needServerRecording: 'The recording must be saved on the server before generating an AI report.',
    startRecording: 'Start recording',
    stopRecording: 'Stop',
    stopRecordingConfirmTitle: 'Confirm stopping the recording',
    stopRecordingConfirmDescription:
      'Only confirm if the meeting has actually ended. The recording will be saved; credits are charged only when you generate the AI report.',
    stopRecordingConfirmOk: 'Confirm — meeting ended',
    stopRecordingConfirmContinue: 'Keep recording',
    recording: 'Recording…',
    idleHint: 'Allow microphone access when the browser asks.',
    recordingTimeLabel: 'Recording: {duration}',
    durationLabel: 'Duration: {duration}',
    createNewMeeting: 'Create new meeting',
    stopBeforeNewMeeting: 'Stop recording before starting a new meeting.',
    downloadRecording: 'Download recording',
    generateReport: 'Generate AI report',
    reportLanguageLabel: 'Report language',
    estimatedCost: 'Estimate: {credits} credits',
    costExplain:
      'First 5 minutes: 1 credit; after that +0.2 credit per minute (overage beyond 5 minutes rounded up) — e.g. 5:47 ≈ 1.2 credits.',
    needRecording: 'Record at least a few seconds before generating a report.',
    processing: 'Analyzing audio…',
    reportHeading: 'Meeting report',
    briefReportHeading: 'Short summary (key points)',
    fullReportHeading: 'Full report',
    transcriptHeading: 'Transcript',
    copy: 'Copy',
    copied: 'Copied',
    downloadMd: 'Download full report (.md)',
    downloadBriefMd: 'Download short summary (.md)',
    micError: 'Could not access the microphone. Check browser permissions.',
    fileTooLarge: 'Audio file is too large (20MB limit).',
    genericError: 'Something went wrong. Please try again.',
    insufficientCredits: 'Not enough credits.',
  },
  flowMusicVeo: {
    pageTitle: 'AI music video (Flash lyrics + Veo)',
    metaDescription:
      'Per-block lyrics (Flash JSON), Lyria-style controls, first ~8s from images then Veo extend for each next block — one prompt with that block’s lyrics per step. One stitched MP4. Veo-generated audio.',
    headline: 'Music video — lyrics (Flash) + picture & sound (Veo)',
    subtitle:
      'Step 1: genre (Flash) + image/hint. Step 4: lyric boxes listed in order; «Open lyrics …» or «Add ~8 more seconds» after a clip adds another row; generate or type — Veo under each segment (image first, then extend).',
    stepLyricsTitle: 'Step 1 — Genre & hints (Flash lyrics)',
    stepLyricsBody:
      'Only genre + optional image + theme for Flash (not voice/tempo here). Step 4 shows all lyric rows at once; add a row with «Open lyrics …» or «Add ~8 more seconds of video» after a clip (up to 20). «Generate lyrics — segment …» or type in any box.',
    lyricsModeLabel: 'Lyrics generation flow',
    lyricsModeAllAtOnce: 'All at once — N blocks in one run',
    lyricsModeProgressive: 'Step by step — generate the next block only',
    lyricsProgressiveHelp:
      'Step 1: pick style → image → hint; step 4 lists lyric boxes top to bottom — tap «Generate lyrics — segment …» on the row you need. Voice/tempo/structure are set when creating video (Veo). «Open lyrics …» adds an empty row (up to 20). {credits} credit per generation — separate from video buttons.',
    openNextLyricsSegmentButton: 'Open lyrics box — segment {k}',
    segmentVideoSubBlockHint: 'Veo video (separate flow once lyrics are ready):',
    progressiveStyleOnlyInStep1Note:
      'Genre / voice / tempo are only chosen here; the video section below does not repeat music picks.',
    lyricsGenreOnlyHelp:
      'Used only for the Flash lyrics prompt. Voice, tempo, structure, etc. are chosen in step 4 for Veo, not when generating lyrics.',
    veoStyleFieldsIntro:
      'Vocal style, language, tempo, structure — sent to Veo for this clip (not used for Flash lyrics).',
    progressiveExtendStyleLockedNote:
      'Music style stays as set when you generated segment 1 lyrics — only add optional visuals / camera / character notes.',
    progressiveVideoSectionTitle: 'Create video — segment {k}',
    generateNextSegmentButton: 'Generate lyrics — segment {k} / {n}',
    successLyricsOneSegment: 'Segment {k}/{n} generated. Continue or move on when all blocks are ready.',
    incrementalPlanFrozenHelp: 'Step-by-step generation started — block count is fixed. Use «Start over» to change.',
    lyricsModeFrozenHint: 'Lyrics from AI are in progress — switch flows disabled. Use «Start over».',
    progressiveNoNextSegment: 'All segment boxes are filled — go to step 4 or «Start over».',
    hintLabel: 'Theme / story hint (optional if you add an image)',
    hintPlaceholder: 'e.g. Vietnamese pop about summer and the beach, upbeat…',
    lyricsImageHelp: 'Optional mood image — Flash uses it to inspire lyrics.',
    generateLyricsButton: 'Generate lyrics (Flash)',
    generatingLyrics: 'Generating lyrics…',
    lyricsNeedHintOrImage: 'Add at least 4 characters of hint or one image.',
    successLyrics: 'Lyrics generated — please review and edit.',
    successLyricsBlocks: 'Generated {n} linked lyric blocks (JSON) — check each box in step 4.',
    lyricsBlockCountLabel: 'Lyric blocks / 8s clips',
    lyricsBlockCountHelp: 'Flash outputs this many segments (JSON); match the lyric boxes in step 4 and the Veo chain length.',
    openingLyricsLabel: 'Lyrics for the first 8-second clip',
    openingLyricsHelp:
      'Enter enough lines in segment 1 (~8s of singing). The Veo prompt uses this block plus the music-style fields.',
    fillOpeningButton: 'Fill opening from full lyrics',
    assignOpeningToSegment1: 'Opening lyrics copied to segment 1.',
    styleBlockTitle: 'Step 2 — Music style (like Lyria vocal mode)',
    styleBlockBody:
      'Choices are sent to Veo as an English description (genre, voice, tempo, structure). No MP3 file — Veo synthesizes audio for the video.',
    genreLabel: 'Genre',
    voiceGenderLabel: 'Vocal gender',
    voiceTimbreLabel: 'Timbre',
    voiceLangLabel: 'Singing language',
    bpmLabel: 'Tempo (BPM)',
    structureLabel: 'Song structure',
    densityLabel: 'Arrangement density',
    videoBlockTitle: 'Step 3 — Images & 8s clip (720p)',
    videoBlockBody:
      'One image: start frame for image-to-video. Two or three images: reference-only mode (no separate start frame). Max 3 files.',
    aspectLabel: 'Aspect ratio',
    aspect169: '16:9',
    aspect916: '9:16',
    framesLabel: 'Images (1–3)',
    framesHelpSingle: 'One file: video start frame.',
    framesHelpMulti: 'Two or three files: all are reference (ASSET) images.',
    visualExtraLabel: 'Extra visual direction (optional)',
    visualExtraPlaceholder: 'e.g. Golden hour, slow motion, close-up while singing…',
    createClip8s: 'Create 8s clip (720p)',
    creatingClip: 'Creating 8s clip (Veo)…',
    clip720Note:
      'Each block is its own ~8s Veo clip (same images as block 1), then clips are stitched on the server. ~8 credits per clip; merging costs no credits.',
    needImage: 'At least one image is required.',
    previewTitle: 'Preview note',
    downloadMp4: 'Download MP4',
    segmentIndexLabel: 'Segment {n}',
    createSegment1VideoButton: 'Create block-1 clip from images (~8s, 720p)',
    addEightMoreVideoButton: 'Add ~8 more seconds of video',
    addEightMoreVideoHelp:
      'Opens the next lyrics block — generate or type lyrics, then create a standalone ~8s clip for that block (same images as block 1). Stitch clips into one MP4 when ready.',
    extendSegmentVideoButton: 'Create block {k} clip (~8s, standalone)',
    extendingVeoSegmentBusy: 'Creating block {k} clip (Veo) — may take a few minutes…',
    videoSequentialBlockIntro: 'Each step shows its video and the next action right below.',
    videoImagesOnlyStep3Note:
      'Images and aspect from block 1 are reused for every later block (each clip is generated separately, not extend).',
    previewInStep4Note: 'Videos appear inside step 4 for each checkpoint.',
    videoForSegmentLockedNote:
      'Veo for this segment unlocks after you tap «Add ~8 more seconds of video» and the previous clip exists.',
    successExtendSegment: 'Block {k} clip is ready. Watch the video below.',
    partialSegmentsFail: 'Stopped while creating segment {n} — earlier clips can still be played, downloaded, or merged.',
    startOver: 'Start over',
    veoAudioNote: 'Audio in the MP4 is generated by Veo from the prompt (lyrics + style text), not an uploaded track.',
    successClip: '8s clip created.',
    segmentCountLockedHelp:
      'Segment count is fixed after you open more lyric boxes or use AI lyrics. Use «Start over» to reset.',
    lyricsLockedNote: 'Lyrics are locked to keep the Veo request order correct.',
    segmentsCountSyncedNote: 'Same as step 1: {n} segments.',
    videoAfterSegmentLabel: 'After lyric block {n} (about ~{seconds}s)',
    downloadMp4Step: 'Download MP4 — checkpoint {n}',
    extendPerStepSectionTitle: 'Options per clip',
    extendPerStepSectionBody:
      'Music style (step 2) applies to every clip; camera / character notes can be edited before each generate.',
    extendBridgeLabel: 'Standalone ~8s clip for segment {to} — same images as block 1; stitch MP4 afterwards.',
    extendSegmentVisualLabel: 'Visual notes (this extend)',
    cameraHintLabel: 'Camera angle / movement',
    cameraHintPlaceholder: 'e.g. Slow pan left, wide shot, light handheld…',
    characterStoryLabel: 'Character actions / story beats',
    characterStoryPlaceholder: 'e.g. Looks to the sea, raises hand, turns and walks away…',
    standaloneFramesNote:
      'Reuses the same images chosen for block 1. You can adjust camera / character notes for this clip’s prompt.',
    mergeClipsSectionTitle: 'Merge created clips',
    mergeClipsSectionHelp:
      'Concatenate in order (block 1 → 2 → …) into one MP4. No credits charged; requires ffmpeg on the server.',
    mergeClipsButton: 'Merge into one MP4',
    mergingClips: 'Merging video on the server…',
    successMergedClip: 'Merge complete. Watch below or find it in history.',
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
    mobileCreateHomework: 'Create homework',
    assignWorksheet: 'Homework',
    classHomeworkListEmpty: 'No homework sessions linked to this class yet.',
    classHomeworkListCreateCta: 'Create homework',
    classHomeworkOpenLamBai: 'Open student page',
    classHomeworkAttachOtherClassButton: 'Attach homework to another class',
    classHomeworkAttachPickTitle: 'Attach homework to another class',
    classHomeworkAttachPickDescription:
      'Creates a new homework session (new code and link) with the same content, linked to the class you pick.',
    classHomeworkAttachSessionLabel: 'Homework',
    classStudentHomeworkSessionsEmpty: 'No homework from your teacher yet.',
    noWorksheets: 'No worksheets yet',
    noStudents: 'No students yet',
    doWorksheet: 'Do worksheet',
    submit: 'Submit',
    submitSuccess: 'Submitted',
    viewResult: 'View result',
    quizScore: 'Quiz score',
    sampleAnswer: 'Sample answer',
    submissions: 'Submissions',
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
    classExamsSubsectionGraded: 'Exams (graded)',
    classExamsSubsectionPracticeHomework: 'Homework (scores not shown to students)',
    studentClassHomeworkSubmittedCaption:
      'Submitted. This is homework — scores are not shown here.',
    classSessionBadgeHomework: 'Homework',
    lamBaiSeoTitleSuffixExam: 'Online exam',
    lamBaiSeoTitleSuffixHomework: 'Homework',
    lamBaiSeoDescriptionExam:
      'Take an online exam with a session code: multiple choice and essay, with grading.',
    lamBaiSeoDescriptionHomework:
      'Complete online homework with a session code — practice; scores are not shown like a graded exam.',
    lamBaiSeoKeywordsExam: 'exam, online test, quiz, essay, NanoAI',
    lamBaiSeoKeywordsHomework: 'homework, practice, NanoAI',
    lamBaiSeoFallbackTitle: 'Take assignment online',
    lamBaiSeoFallbackDescription:
      'Sign in to complete the assignment using your session code or teacher link.',
    lamBaiSeoFallbackKeywords: 'exam, homework, NanoAI',
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
    examAttachToOtherClassButton: 'Attach to another class',
    examAssignClassButton: 'Assign class',
    examAttachPickClassTitle: 'Attach exam to another class',
    examAttachPickClassDescription:
      'Creates a new exam session (new code and link) with the same questions, linked to the class you pick.',
    examAttachSelectClassLabel: 'Class',
    examAttachSelectClassPlaceholder: '— Select a class —',
    examAttachSubmit: 'Attach to class',
    examAttachLoadingClasses: 'Loading your classes…',
    examAttachWorking: 'Creating exam session…',
    examAttachNoClassesBody:
      'You have no classes yet. Create a class first, then return here to attach the exam.',
    examAttachNoOtherClassesBody:
      'You have no other classes besides this one. Create another class to attach a copy of this exam.',
    examAttachFailed: 'Could not attach the exam. Please try again.',
    examAttachSuccessSummary: 'New session linked to: {classLine}.',
    examAttachClose: 'Close',
    examAttachPickAnotherClass: 'Attach to another class',
    examAttachExamLabel: 'Exam',
    examAttachAllClassesAlreadyAttachedBody:
      'Every class you teach already has a session for this exam (same questions). There are no classes left to attach.',
    examAttachNeedDifferentClassHint:
      'Do not see the right class? Create a new class in another tab, then tap “Refresh class list” below.',
    examAttachReloadClassList: 'Refresh class list',
    examAttachOpenCreateClassNewTab: 'Create class (new tab)',
    examAttachClassAlreadyHasExam: 'This class already has this exam.',
    examIdentityFromClassHint:
      'Your class profile already has your name and date of birth. Press Start when you are ready; the timer begins only after you start.',
    examChangeIdentityManual: 'Enter a different name and date of birth',
    examManualIdentityIntro:
      'Enter your details and press Start to begin. The timer starts only after you press Start.',
    examStartTestButton: 'Start test',
    examOneAttemptNote:
      'One attempt per account: after you start, the server locks your session—you cannot get a fresh shuffled copy; leaving requires submitting.',
    examStartHomeworkButton: 'Start homework',
    homeworkIdentityFromClassHint:
      'Your class profile already has your name and date of birth. Press Start when you are ready; the timer begins only after you start.',
    homeworkManualIdentityIntro:
      'Enter your details and press Start to begin your homework. The timer starts only after you press Start.',
    homeworkEnrollGateTitle: 'Join the class to do this homework',
    homeworkEnrollGateDescription:
      'This homework is linked to a class. Enter your name and date of birth exactly as in the class roster (not your Google account display name). Then you can start your homework.',
    homeworkEnrollSubmitButton: 'Join class and start homework',
    homeworkDefaultTitle: 'Homework',
    lamBaiLoadingNeutral: 'Loading…',
    lamBaiFiveMinWarning: '5 minutes left! Review your answers before time runs out.',
    lamBaiTimerTimeUpAutoSubmittingExam: "Time's up! Your answers are being submitted automatically.",
    lamBaiTimerTimeUpAutoSubmittingHomework: "Time's up! Your homework is being sent automatically.",
    lamBaiTimerStickySubmittingExam: "Time's up — submitting…",
    lamBaiTimerStickySubmittingHomework: "Time's up — sending…",
    lamBaiExitBlockedBanner:
      'You are taking this assignment: you should only leave after submitting. Closing the tab, refreshing, or going back will be blocked or warned — submit to finish. If you leave and return, the timer keeps counting from when you pressed Start.',
    lamBaiExitBlockedBeforeStartHint:
      'After you press Start, you should only leave the page after submitting. Your browser will warn you if you close the tab, reload, or leave the page. You may leave and come back, but the timer keeps counting from when you started.',
    lamBaiExitBlockedDialogTitle: 'Submit to leave',
    lamBaiExitBlockedDialogDescription:
      'You are in an active attempt. To leave safely, submit your answers. Use Submit now below or scroll down and press Submit.',
    lamBaiExitBlockedSubmitNow: 'Submit now',
    lamBaiExitBlockedStay: 'Stay and continue',
    lamBaiExamResumeNotice:
      'You have an unfinished attempt—saved answers were restored. Continue and submit when done.',
    examBeginStarting: 'Starting…',
    examBeginFailed: 'Could not start the session. Please try again.',
    examSubmitSending: 'Submitting…',
    examSubmitButton: 'Submit',
    homeworkSubmitSending: 'Sending homework…',
    homeworkSubmitButton: 'Send homework',
    homeworkLoadFailed: 'Could not load this homework.',
    lamBaiQuestionLabel: 'Question {index}.',
    examSubmittedTitle: 'Submitted',
    examSubmittedSavedEarlier: 'You already submitted this test. Your saved result is below.',
    examSubmittedDueToDeadlineHint:
      'The server time limit has ended — your attempt was submitted automatically using your saved answers. Your result is below.',
    homeworkSubmittedTitle: 'Homework submitted',
    homeworkSubmittedSavedEarlier: 'You already submitted this homework. Your saved info is below.',
    homeworkSubmittedBody:
      'This is practice homework: scores and grading scales are not shown to students. Teachers can still review work in class.',
    homeworkMcCorrectOnlyLine: 'Multiple choice: {correct}/{total} correct',
    homeworkShareLine: 'Submitted: {title}',
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
    examSessionCreatedAt: 'Created {time}',
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
    classExamsIndexTitle: 'Class exams',
    classExamSessionPageTitle: 'Exam details',
    classExamGoToSession: 'Open grading page',
    classDetailSeoDescription: 'Class home: exams, roster, gradebook.',
    classHubCardAssignWorksheetDesc:
      'Homework sessions created for this class. Students use the link or code to complete them.',
    classPageStudentFacingNotSet: 'Not set',
    classHubCardStudentWorksheetsDesc:
      'Homework from your teacher: open the link or session code to complete it on the assignment page.',
    classHubCardCreateExamButton: 'Create exam',
    classHubCardCreateHomeworkButton: 'Create homework',
    worksheetLamBaiNoInteractiveHint:
      'This worksheet has no supported multiple-choice or essay section for the web yet (your teacher needs to attach questions in the curriculum tool). You cannot submit here yet.',
    worksheetLamBaiBackToClassWorksheets: 'Back to class worksheets',
    worksheetLamBaiMcqSectionTitle: 'Multiple choice',
    worksheetLamBaiEssaySectionTitle: 'Written response',
    worksheetLamBaiEssayPlaceholder: 'Type your answer…',
    worksheetSubmitNoInteractiveError:
      'This worksheet has no online questions yet. The teacher needs to attach questions first.',
    assignWorksheetNoQuestionBankHint:
      'No questions attached from the bank — students cannot complete or submit on the web.',
    assignWorksheetOpenInCurriculumTool: 'Open in curriculum tool',
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
  weddingCardAiMusic: {
    playStartLabel: 'Start playback at',
    playEndLabel: 'End / loop at',
    playStartPlaceholder: 'Empty or 0 · 30 · 1:30 (empty = full track)',
    playEndPlaceholder: 'Empty = play to end (no crop)',
    segmentHint:
      'Leave both empty to play the full track unchanged from start to finish. Values set the segment (seconds like 30, or mm:ss like 1:30). With an end time set, audio loops inside that range. Press Save to apply.',
    useCurrentPlaybackAsStart: 'Use current playback position as start',
    playbackLoadFailed:
      'Could not load music (file missing or unreachable). Ask the invitation host to re-upload audio in the editor.',
    publicFabPauseAria: 'Turn off invitation background music',
    publicFabPlayAria: 'Turn on invitation background music',
    publicMapEmbedTitle: 'Wedding venue map',
  },
  weddingCardCalendar: {
    sectionTitle: 'WEDDING DETAILS',
    introLine: 'THE RECEPTION WILL BE HELD AT:',
    receptionLabel: 'GUEST ARRIVAL',
    partyLabel: 'RECEPTION BEGINS',
    timePlaceholderDash: '—',
  },
  weddingGiftBox: {
    boxTitle: 'Wedding Gift Box',
    tapToOpen: 'Tap to open',
    dialogTitle: 'Gift money — VietQR scan',
    brideSection: 'Bride',
    groomSection: 'Groom',
    accountHolder: 'Account holder',
    accountNumber: 'Account number',
    bankSelectPlaceholder: 'Choose bank',
    vietqrFooterNote: 'Scan with your banking app (VietQR).',
    closeButton: 'Close',
    envelopeButtonAria: 'Open wedding gift box to view QR codes',
    editorHint:
      'When enabled: enter bank, account number, and holder name for both bride and groom to generate two VietQR codes. Alternatively paste one QR image URL below (legacy).',
    legacyImageLabel: 'Single QR image URL (optional)',
    legacyImageDesc: 'Only if you are not using the two VietQR profiles above.',
    saveNeedConfig: 'Gift QR is on: fill both VietQR profiles (bride + groom), or enter a QR image URL.',
    qrAltBride: 'Bank transfer QR — bride',
    qrAltGroom: 'Bank transfer QR — groom',
    qrAltLegacy: 'Wedding gift QR',
  },
  weddingCardAiBrief: {
    step2Description:
      'Editing content and preview is free. Changes auto-save after about a second; you can still press Save to persist immediately.',
    autoSavedLabel: 'Auto-saved',
    autoSaveFailedLabel: 'Could not auto-save. Check your connection or press Save.',
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
    openCreatedExamsListButton: 'Open list of created exams',
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
    homeworkPageTitle: 'Create homework',
    homeworkPageSubtitle:
      'Same steps as the online exam (subject, class, questions, QR/link) but no 100-point total requirement; students do not see scores after submit.',
    defaultHomeworkTitle: 'Homework',
    homeworkCreatedBadge: 'Homework created',
    createHomework: 'Create homework',
    createAnotherHomework: 'Create another homework',
    createdHomeworkListTitle: 'Created homework',
    createdHomeworkHint: 'Open the link or QR for students; attach to another class like an exam.',
    openCreatedHomeworkListButton: 'View homework list',
    homeworkCreateSuccess: 'Homework created',
    homeworkCreateSuccessDesc: 'Share the link or QR code with students.',
    homeworkEssayNo100Note:
      'Add essay questions if needed. Students do not see a score after submit — no need to set minutes or points per question.',
    homeworkCardInfo: 'Homework details',
    homeworkFormCardDescription:
      'Choose subject, class, and questions from your curricula. No exam timer or scoring setup — work is saved and students do not see scores.',
    homeworkTitlePlaceholder: 'Algebra practice set',
    homeworkQuizPartFooterHint:
      'Enter counts per difficulty, then pick that many questions below. Homework does not require minutes or points here.',
    noHomeworkSessionsYet: 'No homework sessions yet.',
    homeworkCreatedResultLine: '{count} questions',
    homeworkSummaryMc: 'Multiple choice: {count} questions',
    homeworkSummaryEssay: 'Essay: {count} questions',
    homeworkDeleteConfirm: 'Delete this homework? This action cannot be undone.',
    homeworkDeleted: 'Deleted',
    homeworkDeletedDesc: 'Homework deleted.',
  },
  adminWorksheetVerify: {
    pageTitle: 'Worksheet verify reports',
    pageDescription:
      'Mainly for reviewing reports from automated verify runs (cron): queued/processed worksheets, verify marks, and content fixes. Expand a row for per-worksheet details. Use “Start new scan” to run an on-demand batch on the server when needed.',
    reportScopeNote:
      'Each background verify (after creating/editing a worksheet in the curriculum builder) is also logged here when the server is configured for background verify. Previously only batch/cron runs created rows—if you verified but saw no report, check your server environment and run verify once more.',
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
    inviteFriends: '邀请好友',
    viewPlan: '查看套餐',
    topUpCredits: '充值积分',
    tasksHub: '任务与队列',
    supportChat: '在线客服',
    partnerInbox: '业务渠道',
    partnerApiIntegration: 'API 集成（店主）',
    customerApiKeys: '租用 AI 平台',
    myChats: '与店铺消息',
    myOrders: '我的订单',
    downloadApp: '下载应用',
    downloadAppSubtitle:
      '这是网页应用（PWA），可像原生应用一样添加到主屏幕。Android 请用 Chrome；iPhone/iPad 请用 Safari。',
    downloadAndroidTitle: 'Android（Chrome）',
    downloadAndroidChromeHint: 'Chrome 菜单中通常有“安装应用”或“添加到主屏幕”。',
    downloadAndroidStep1: '在 Chrome 中打开 NanoAI 网站（nanoai.vn）。',
    downloadAndroidStep2: '点右上角菜单 ⋮（三个点）。',
    downloadAndroidStep3: '选择“安装应用”或“添加到主屏幕”，然后确认。',
    downloadIosTitle: 'iPhone / iPad',
    downloadIosSafariHint: '建议使用 Safari。',
    downloadIosStep1: '在 Safari 中打开 NanoAI 网站（nanoai.vn）。',
    downloadIosStep2: '轻点工具栏中的“分享”按钮（方框带向上箭头）。',
    downloadIosStep3: '选择“添加到主屏幕”，然后轻点“添加”。',
  },
  referral: {
    pageTitle: '邀请好友 – 获得积分',
    metaDescription: '分享 NanoAI。有新用户通过您的链接注册时，仅您获得 2 积分推荐奖励。',
    headline: '向好友推荐 NanoAI',
    description:
      '复制您的专属链接。有新用户通过该链接注册并加入（自创建账号起 30 天内），您可获得 2 积分——每位被邀请人仅计一次。',
    yourLinkLabel: '您的邀请链接',
    copyButton: '复制链接',
    copied: '已复制',
    howItWorksTitle: '如何运作',
    step1: '将带有您推荐码的链接发给好友。',
    step2: '对方打开链接，并在创建账号后 30 天内注册或登录 NanoAI。',
    step3: '系统为邀请人（您）增加 2 积分。被邀请人不获得本推荐活动的积分。',
    bonusNote: '仅符合条件的新账号可为邀请人触发奖励；每位被邀请人仅计一次。',
    inviteVisualYou: '您（邀请人）',
    inviteVisualFriend: '被邀请人',
    inviteeNoReferralCredit: '无推荐积分',
    errorGeneric: '暂时无法应用邀请奖励，请稍后再试。',
  },
  accountPlan: {
    pageTitle: '服务套餐',
    metaDescription: '查看 7 天试用与课程按月访问。英语 AI 按次/按课扣积分；AI 积分另计。',
    headline: '当前套餐',
    billingPeriod: '按月计费周期（越南历）：{period}',
    trialSectionTitle: '免费试用',
    trialActiveLine: '您正在免费试用期内——暂不收取下方课程的月度访问费。',
    trialTotalDaysNote: '试用时长：自注册起 {days} 天。',
    trialDaysLeft: '大约还剩 {days} 天。',
    trialEndsAtLine: '试用结束（预计）：{datetime}',
    trialNotActive: '您已超过首 7 天试用。课程按月访问在适用时每个周期扣除相应积分。',
    servicesSectionTitle: '课程 — 按月（积分）',
    productEnglishCoach: '英语 AI 学习',
    englishCoachPayPerLesson:
      '无月费。每次学习或每节课在开始时会单独扣积分（具体金额在学习页面显示）。',
    productCurriculum: '课程与出题工具',
    statusViaTrial: '试用中——尚未扣月费。',
    statusAccessOn: '当前可使用该服务。',
    statusPaidMonth: '已为周期 {period} 扣除月费。',
    statusPendingPayment: '尚未扣费——周期 {period} 需 {credits} 积分。',
    noteSignupBonus: '注册赠送 {credits} 积分（用于 AI；与月费分开）。',
    noteAiCredits: '使用会调用 AI 的功能时，仍会按次扣除 AI 积分。',
    refresh: '刷新',
    loading: '加载中…',
    errorLoad: '无法加载套餐信息，请刷新重试。',
    errorConfig: '服务器未完整配置，请稍后再试。',
    monthlyCostLine: '每周期 {credits} 积分 · 约 {vnd}₫',
    backDashboard: '返回控制台',
    linkWallet: '打开钱包充值积分',
  },
  push: {
    bannerTitle: '接收手机通知',
    bannerHint:
      '您正在以已安装应用（PWA）使用 NanoAI。开启通知后，即使未打开应用也能收到付款、奖励与处理结果等提醒。',
    enable: '开启通知',
    later: '稍后',
    enabledToast: '已开启推送通知',
    bellEnableHint: '应用内提醒与系统推送不同。开启推送后，即使未打开 NanoAI 也能收到通知。',
    bellEnableButton: '开启推送通知',
    bellSubscribedShort: '本设备已开启推送',
    bellDeniedHint: '通知已被阻止。请在浏览器设置中为 NanoAI 开启通知。',
    bellSyncHint: '已允许通知，但服务器尚未登记此设备。请点击同步。',
  },
  supportChat: {
    pageTitle: '在线客服',
    metaDescription: '向 NanoAI 团队发消息；配置 Webhook 后可与 Facebook Messenger、Zalo OA 同步。',
    brandBadge: 'NanoAI',
    headline: '在线客服聊天',
    subline: '本页消息与客服收件箱统一，可与 Facebook、Zalo 集成（需在服务器配置）。',
    loginRequired: '请登录后再联系支持团队。',
    loginSupportingLine: '请使用您的 NanoAI 账户；登录后即可在此发送消息。',
    loginLink: '登录',
    placeholder: '输入内容…',
    send: '发送',
    emptyThread: '暂无消息。请在下方发送第一条。',
    loadError: '无法加载会话。',
    sendError: '发送失败。',
    pollNote: '管理员回复可能延迟数秒；您也可以刷新页面。',
    sendKeyboardHint: 'Enter 发送 · Shift+Enter 换行',
    messageProductCardOpenProduct: '查看商品',
    messageProductCardViewDetails: '查看详情',
  },
  customerCareAdmin: {
    pageTitle: '客户关怀',
    pageDescription:
      '仅显示 NanoAI 平台收件箱（站内支持聊天及绑定在平台的 Facebook/Zalo）。各店铺收件箱在「控制台 → 消息」；您作为买家与店铺的聊天在「我的消息」— 互不混用。',
    inboxTitle: '会话（平台）',
    pickConversation: '选择一个会话查看消息。',
    replyPlaceholder: '撰写回复…',
    send: '发送',
    refresh: '刷新',
    channelFacebook: 'Facebook',
    channelZalo: 'Zalo',
    channelInternal: 'NanoAI',
    channelWidget: '网页嵌入',
    unknownUser: '访客',
    sendFailed: '发送失败',
    noMessages: '暂无消息。',
    sendKeyboardHint: 'Enter 发送 · Shift+Enter 换行',
    messageProductCardOpenProduct: '查看商品',
    messageProductCardViewDetails: '查看详情',
  },
  partnerMessaging: {
    pageTitle: '合作伙伴客户消息',
    pageDescription:
      '为店铺建立工作区：客户可通过 Facebook 主页、Zalo OA、NanoAI 网页聊天或网站 API 嵌入联系您，统一收件箱。',
    cardTitle: '客户收件箱（合作伙伴）',
    cardDescription: 'Facebook、Zalo、NanoAI 网页聊天与嵌入聊天，同一收件箱。',
    createWorkspace: '创建消息工作区',
    workspaceNameLabel: '店铺 / 品牌名称',
    workspaceLabel: '工作区',
    createButton: '创建',
    saveOk: '已保存。',
    channelsSection: '渠道（Facebook 与 Zalo）',
    fbPageId: 'Facebook Page ID',
    fbPageToken: '主页访问令牌',
    fbVerifyToken: '验证令牌（Webhook GET）',
    saveFacebook: '保存 Facebook',
    zaloSecret: 'Webhook 密钥（请求头）',
    zaloToken: 'OA 访问令牌',
    saveZalo: '保存 Zalo',
    embedSection: '店铺网站匿名嵌入 API（可选）',
    embedHint: '从店铺域名调用 API（已启用 CORS）。每个浏览器在 localStorage 保存固定 UUID，并通过 X-Session-Id 发送。',
    embedHeadersHelp: '请求头需包含 X-Embed-Key（上方密钥）和 X-Session-Id（访客浏览器中的固定 UUID）。',
    embedAnonymousFootnote:
      '此方式不使用 NanoAI 登录：店铺看不到真实身份，也无法与 Google 账号同步。若要与直接打开 NanoAI 相同的登录体验（含「我的消息」），请分享上方的 NanoAI 聊天链接或使用 iframe 代码。',
    inboxTitle: '客户会话',
    inboxSearchPlaceholder: '按姓名或消息搜索…',
    inboxNoSearchResults: '没有匹配的会话。',
    inboxSideInfoTab: '信息',
    inboxSideOrderTab: '创建订单',
    inboxSideNoNotes: '你还没有任何备注',
    inboxSideNotePlaceholder: '输入备注（Enter 发送）',
    inboxSideOrderEmpty: '暂无订单记录',
    inboxSideCreateOrder: '创建订单',
    pickConversation: '请选择会话。',
    replyPlaceholder: '撰写回复…',
    send: '发送',
    refresh: '刷新',
    channelFacebook: 'Facebook',
    channelZalo: 'Zalo',
    channelWidget: '网页',
    unknownUser: '访客',
    noMessages: '暂无消息。',
    inboxShopDrafting: '店铺正在输入回复',
    replyKeyboardHint: 'Enter 发送 · Shift+Enter 换行 · Ctrl+V 粘贴图片',
    messageProductCardOpenProduct: '查看商品',
    messageProductCardViewDetails: '查看详情',
    partnerAttachPhoto: '相册选图',
    partnerTakePhoto: '拍照',
    partnerRemoveAttachmentAria: '移除已选图片',
    partnerCaptionHint: '可在下方添加说明文字后再发送。',
    partnerUploading: '正在上传图片…',
    partnerImageTooLarge: '图片过大（最大约 3 MB）。',
    partnerImageInvalidType: '不支持的图片格式。',
    nanoaiHostedSection: '在 NanoAI 上聊天 — 与直接使用 NanoAI 相同登录（推荐）',
    nanoaiHostedHint:
      '客户须在 NanoAI 上使用 Google 登录，与直接使用平台一致：同一账号、跨设备同步消息，并可在 /messaging/my-chats 查看店铺列表。会话仍会出现在您的收件箱中。',
    nanoaiHostedUrlLabel: '聊天链接',
    nanoaiHostedIframeTitle: '嵌入到店铺网站（iframe）',
    nanoaiHostedIframeTitleAttr: 'NanoAI 聊天',
    nanoaiHostedIframeHelp: '粘贴到页面 HTML。客户在 NanoAI 框架内聊天与登录（第一方 cookie），不依赖匿名嵌入 API。',
    copyHostedChatLinkButton: '复制聊天链接',
    hostedChatLinkCopiedToast: '已复制聊天链接。',
    copyIframeSnippetButton: '复制 iframe 代码',
    iframeSnippetCopiedToast: '已复制 iframe 代码。',
    integrationSectionTitle: '跟踪标签与嵌入代码',
    integrationSectionHint:
      '用于粘贴 Google 标签、Facebook Pixel 与聊天嵌入代码。你也可以在下方快速复制 NanoAI 聊天嵌入代码。',
    googleTagLabel: 'Google 标签（GA4 / GTM）',
    googleTagPlaceholder: '例如：G-XXXXXXXXXX 或 GTM-XXXXXXX',
    facebookPixelLabel: 'Facebook Pixel / Meta Pixel',
    facebookPixelPlaceholder: '例如：123456789012345',
    metaConsultTrackingSection: 'Meta Pixel 与转化 API（商品咨询页）',
    metaConsultTrackingHint:
      '访客打开单商品咨询链接（/tu-van/… 或带 ?ctx_inventory= 的聊天）时，系统会在 Pixel 与服务器发送一致的 ViewContent（event_id 去重）。',
    metaConsultCapiTokenLabel: '转化 API 访问令牌（服务器）',
    metaConsultCapiTokenPlaceholder: '从 Meta Events Manager 粘贴令牌',
    metaConsultCapiConfiguredBadge: '已保存令牌',
    metaConsultCapiSavedHint:
      '保存后输入框会留空（出于安全不再次显示）。令牌仍在服务器。仅在更换令牌时粘贴；若只改 Pixel ID 请留空。',
    metaConsultSaveButton: '保存 Pixel 与 CAPI',
    shopGa4MeasurementLabel: 'Google Analytics 4 (GA4) 衡量 ID',
    shopGa4MeasurementHint:
      '输入 G-… 以统计咨询/店铺页访问。在 GA4 中打开「报告 → 实时」查看当前在线人数。',
    shopGa4MeasurementPlaceholder: '例如：G-XXXXXXXXXX',
    shopGa4InvalidIdToast: 'GA4 ID 无效。格式：G-XXXXXXXXXX',
    shopGa4SaveButton: '保存 GA4 ID',
    facebookCatalogFeedTitle: 'Facebook — 商品目录 Feed（CSV）',
    facebookCatalogFeedHint:
      '在商务管理平台粘贴此 Feed URL。CSV 中 link 列为 NanoAI 咨询页，不是店铺官网。需图片 URL 与越南盾价格。key 为嵌入密钥，请保密。',
    facebookCatalogFeedCopyButton: '复制 Feed URL',
    facebookCatalogFeedCopiedToast: '已复制目录 Feed URL。',
    nanoaiEmbedCodeLabel: 'NanoAI 聊天嵌入代码',
    facebookChatEmbedCodeLabel: 'Facebook 聊天嵌入代码',
    zaloChatEmbedCodeLabel: 'Zalo 聊天嵌入代码',
    embedCodePlaceholder: '在此粘贴 script / iframe / 插件代码…',
    copyNanoaiEmbedButton: '复制 NanoAI 聊天代码',
    copyFacebookChatEmbedButton: '复制 Facebook 聊天代码',
    copyZaloChatEmbedButton: '复制 Zalo 聊天代码',
    addAnotherWorkspace: '再创建一个工作区',
    cancelAddWorkspace: '取消',
    deleteWorkspaceButton: '删除工作区',
    deleteWorkspaceConfirm: '警告：删除工作区后将无法恢复。请输入 "XOA" 进行确认。',
    deleteWorkspaceSuccess: '工作区已删除。',
    deleteWorkspaceOtpIntro:
      'Your workspace will be scheduled for deletion after a grace period. While waiting, the shop will not accept customer messages. We will email a one-time code to your login address.',
    deleteWorkspaceOtpSend: 'Send OTP email',
    deleteWorkspaceOtpLabel: 'OTP code (6 digits)',
    deleteWorkspaceOtpConfirm: 'Confirm scheduled deletion',
    deleteWorkspaceScheduledBanner:
      'This workspace is scheduled for deletion and is not accepting inbound messages. You can cancel from Messaging settings before the deadline.',
    deleteWorkspaceCancelSchedule: 'Cancel deletion schedule',
    deleteWorkspaceOtpSentToast: 'OTP sent to your email.',
    deleteWorkspaceScheduleCancelled: 'Scheduled deletion cancelled.',
    teamStaffSectionTitle: '团队成员',
    teamStaffSectionHint: '按 NanoAI 登录邮箱邀请。按需勾选权限；敏感权限仅授予可信人员。',
    badgeStaffWorkspace: '受邀成员',
    teamInviteEmailLabel: '登录邮箱',
    teamInviteEmailPlaceholder: 'user@example.com',
    teamInviteButton: '邀请',
    teamStaffListTitle: '成员列表',
    teamRemoveMember: '移除',
    teamSavePermissions: '保存权限',
    teamInviteErrorNotFound:
      '未找到使用该邮箱的账户 — 被邀请者需先有 NanoAI 账号并完成邮箱验证。',
    teamInviteErrorBadEmail: '邮箱格式无效。',
    teamInviteErrorOwner: '不可邀请店主或店主账号。',
    teamInviteOk: '已邀请。',
    teamStaffRestrictedNote:
      '您以团队成员身份访问。仅店主可更改付款、嵌入式 API、删除店铺等敏感项。',
    teamPermInbox: '客户收件箱',
    teamPermOrders: '订单',
    teamPermInventory: '商品库存',
    teamPermAiSettings: 'AI 设置',
    teamPermWorkspaceBranding: '品牌与 logo',
    teamPermWorkspacePayment: '聊天内付款',
    teamPermIntegrationsChannels: 'Facebook / Zalo 渠道',
    teamPermIntegrationsAnalytics: 'Meta Pixel / GA4 / 目录',
    teamPermUsageReports: '用量报表',
    integrationsAnalyticsOwnerOnly: '只有店主可保存 Pixel、CAPI 与 GA4。',
    teamRemoveMemberConfirm: '从本工作区移除此成员？',
    fbLinkedLine: '已关联 Facebook Page：{pageId}',
    zaloLinkedLine: '已保存 Zalo OA webhook 与 token。',
    credentialsKeepHint: '不修改时请留空 token 或 secret — 将保留已保存的值。',
    setupColumnTitle: '渠道与 AI 助手',
    chatColumnTitle: '客户会话',
    messagingSettingsLink: '渠道与 AI 设置',
    messagingSettingsPageTitle: '消息设置（店铺）',
    messagingInboxDescription: '左侧为客户列表；打开会话后，输入框固定在屏幕底部。',
    noWorkspaceInboxCta: '您还没有消息工作区。前往设置创建店铺并连接 Facebook / Zalo / 聊天。',
    goToInbox: '返回收件箱',
    inboxMobileBackAria: '返回会话列表',
    apiIntegrationGuideLink: 'API 集成说明（密钥与接口）',
    apiIntegrationGuideShort: '供开发将店铺网站接入：嵌入聊天、以图搜商品、B2B 试衣 API。',
    messagingSettingsApiHubCardTitle: '嵌入聊天与 API',
    messagingSettingsApiHubCardBody:
      '托管链接、iframe 代码、嵌入接口、密钥与开发者文档已移至「API 集成」页面 — 本设置页不再展示。',
    customerCareShopSetupGuideTitle: '创建客服店铺指引',
    customerCareShopSetupGuideBody:
      '第 1 步 — 打开 控制台 → 消息 → 渠道与 AI 设置（本页）。\n\n第 2 步 — 在「创建消息工作区」中填写显示名称、品牌名称、选择行业；可填写 logo 链接或上传图片。\n\n第 3 步 — 点击「创建」。即店铺工作区：来自 Facebook 公共主页、Zalo OA、NanoAI 托管聊天与网站嵌入聊天的消息会进入同一收件箱。\n\n第 4 步 — 随后连接渠道（Facebook/Zalo）、复制托管聊天链接或 iframe 代码，并可在本页选择开启 AI 助手与库存。',
  },
  partnerMessagingOrders: {
    pageTitle: '聊天订单管理',
    pageDescription: '在聊天小组件中创建的订单列表。',
    introLine: '跟踪聊天中创建的订单，必要时人工确认并更新状态。',
    allWorkspaces: '全部工作区',
    allStatuses: '全部状态',
    searchPlaceholder: '按订单号 / 客户名 / 手机 / 商品搜索',
    exportExcel: '导出 Excel',
    exportExcelTitle: '导出符合工作区、状态与可选日期范围的全部订单（不含快速搜索框条件）。',
    reload: '重新加载',
    filterCreatedFrom: '开始日期',
    filterCreatedTo: '结束日期',
    summaryTitle: '按筛选汇总（工作区 + 状态 + 下单日期）',
    summaryDescription:
      '符合筛选的全部订单（不像下方列表限制 200 行）。日期按越南时区、以订单创建日为准；两项都留空表示不限制日期。快速搜索仅过滤本页列表，不改变此处数字。',
    statOrders: '订单数',
    statSubtotal: '商品总额',
    statSubtotalHint: '小计合计',
    statRequired: '定金 / 应付金额',
    statRequiredHint: '按各单配置',
    statPaid: '已收（入账）',
    statPaidHint: '客户已转款 / 系统记录',
    statOutstanding: '待收（估算）',
    statOutstandingHint: '未取消订单：max(0, 货款 − 已收)',
    statusAwaitingPayment: '待付款',
    statusPaymentChecking: '对账中',
    statusPaidVerified: '已确认收款',
    statusPendingManualReview: '需人工审核',
    statusCancelled: '已取消',
    emptyList: '暂无订单。',
    emptyFiltered: '没有符合筛选条件的订单。',
    shippingPending: '待确认',
    shippingConfirmed: '已确认订单',
    shippingPacking: '打包中',
    shippingShipping: '配送中',
    shippingDelivered: '已送达',
    shippingReturned: '退货/退款',
    shippingCancelled: '已取消',
    proofVerified: '凭证：匹配',
    proofManualReview: '凭证：需人工',
    proofFailed: '凭证：不匹配',
    proofPending: '凭证：处理中',
    proofNone: '凭证：无',
    labelWorkspace: '工作区',
    labelCustomer: '客户',
    labelEmail: '邮箱',
    labelAddress: '地址',
    labelProduct: '商品',
    labelMoneyPrefix: '金额',
    moneyLine: '小计 {subtotal} · 应付 {required} · 已记录 {paid}',
    openProduct: '打开商品',
    openProofImage: '打开凭证图',
    openInbox: '打开收件箱',
    openChat: '打开聊天',
    orderLocked: '订单已锁定',
    notePlaceholder: '确认备注 / 原因（可选）',
    btnConfirmPaid: '确认已付款',
    btnMarkManualReview: '标记需人工审核',
    btnCancelOrder: '取消订单',
    btnViewTimeline: '查看时间线',
    timelineTitle: '订单时间线',
    timelinePickOrder: '在左侧选择一个订单查看事件记录。',
    timelineNoEvents: '暂无事件。',
    timelineLoading: '正在加载记录…',
    toastStatusUpdated: '订单状态已更新。',
    toastShippingUpdated: '物流已更新并已通知聊天。',
    toastExportDone: '已下载 {count} 条订单（{filename}）。',
    depositNone: '未付定金',
    depositPartial: '部分定金',
    depositFull: '定金已付清',
    pathSepay: '{shop}（自动）',
    pathManual: '银行转账 · 回单照片',
    sepayAutoHint: '通过 {shop} 系统自动对账 — 无需交易截图。',
    proofReceiptShortVerified: '回单：已匹配',
    proofReceiptShortPending: '回单：处理中',
    proofReceiptShortFailed: '回单：不匹配',
    proofReceiptShortManual: '回单：需人工',
    proofReceiptShortNone: '回单：无',
    tabAll: '全部',
    tabAwaitDeposit: '待付定金',
    tabAwaitShip: '待发货',
    tabAwaitReceive: '待收货',
    tabReceived: '已收货',
    tabReviewed: '已评价',
    tabCancelled: '已取消',
    tableColOrderCode: '订单号',
    tableColConsulted: '已咨询',
    tableColCustomer: '客户',
    tableColSubtotal: '货款合计',
    tableColDepositRequired: '应付定金',
    tableColPaidAmount: '已付金额',
    tableColDueOnDelivery: '收货时剩余',
    tableColStatus: '状态',
    tableColOrderDate: '下单时间',
    tableColActions: '操作',
    filterShippingLabel: '物流状态',
    filterPaymentShort: '支付状态',
    clearTableFilters: '清除筛选',
    consultedAria: '已咨询（仅本浏览器）',
    reviewedAria: '客户已评价（仅本浏览器）',
    expandRow: '展开',
    collapseRow: '收起',
    listCapNote: '在当前工作区与日期筛选下，列表最多显示 200 条最新订单。',
    consultLocalHint: '仅保存在本浏览器，不会在设备间同步。',
    badgePayAwaiting: '待付款',
    badgePayPartial: '已付定金',
    badgePayDone: '已付清',
    btnConfirmDeposit: '确认定金',
    tableDetails: '详情',
    modalTitle: '订单详情',
    modalInternalIdLine: '内部订单 ID：{id}',
    modalConsultedCustomer: '已联系客户咨询',
    modalPaymentHeading: '支付',
    modalOrderTotal: '订单总额',
    modalDepositNeed: '应付',
    modalDepositDeposited: '已付定金',
    modalCodAfterDeposit: '收货时需付余额（扣除定金后）',
    modalProductsHeading: '商品',
    modalColImage: '图片',
    modalColProduct: '商品',
    modalCopyAddress: '复制',
    toastAddressCopied: '已复制地址',
    toastAddressCopyFailed: '无法复制地址',
    modalSkuPrefix: '商品码（ID）：',
    modalColor: '颜色',
    modalSize: '尺码',
    modalQty: '数量',
    modalOrderUnavailable: '当前列表中找不到此订单。请刷新或关闭。',
    modalOrderNoteLabel: '订单备注',
    modalShippingAddressHeading: '收货地址',
    modalContactSectionTitle: '客户与订单处理',
  },
  partnerMessagingAi: {
    panelTitle: 'AI 自动回复',
    panelSubtitle:
      '顾客发消息后，系统先在您设定的时间内等待人工回复；超时未回复则由 AI 结合店铺政策、语气与库存商品列表作答。少数消息不经大模型（下单提示、聊天内购买引导等）。',
    tabSettings: '设置',
    tabInventory: '库存商品',
    tabUsage: 'API 用量',
    usagePeriodLabel: '范围',
    usagePeriodDay: '日',
    usagePeriodWeek: '周',
    usagePeriodMonth: '月',
    usagePeriodScopeDay: '最近 24 小时',
    usagePeriodScopeWeek: '最近 7 天',
    usagePeriodScopeMonth: '最近 30 天',
    usageRangeModeLabel: '方式',
    usageRangeModeRolling: '滚动区间',
    usageRangeModeCalendar: '选择日期（UTC）',
    usageCalendarFromLabel: '开始',
    usageCalendarToLabel: '结束',
    usagePeriodScopeCalendar: '{from} 至 {to}（UTC，含首尾日）',
    usageSectionCreditTitle: '扣除积分（钱包与店铺 logo）',
    usageSectionCreditIntro:
      '已记录的余额扣减：钱包流水（课程、English coach 等）与店铺 logo 规范化费用 — 与下方仅统计 API token 不同。',
    usageSectionApiTitle: 'API 用量（token / 图片 / 向量）',
    usageSectionApiIntro:
      '收件箱 LLM、Nano Banana 出图、图片/文本向量、从商品图推断面料等 — 按 usage 记录统计，不经上方钱包扣费路径。',
    tokenUsageIntro:
      '{scope}的汇总。每一行表示在等待时间后通过 LLM 回复时使用的 API 模型。',
    tokenUsageEmpty: '此期间尚无 LLM 调用记录。',
    tokenUsageColProvider: '提供商',
    tokenUsageColModel: '模型',
    tokenUsageColCalls: '调用次数',
    tokenUsageColPrompt: '输入 token',
    tokenUsageColCompletion: '输出 token',
    tokenUsageColTotal: '总 token',
    tokenUsageColEstimatedCost: '估算 (₫)',
    tokenUsageCostDisclaimer:
      '按 Gemini Developer API 风格单价（USD/百万 token）估算；部分模型单次 prompt>20 万时分档。汇总行用低档近似。未知模型按 gemini-3-flash-preview。汇率：环境变量 PARTNER_AI_TOKEN_COST_USD_TO_VND。',
    tokenUsageEstimatedTotalLabel: '估算合计（约 {amount} ₫）',
    tokenUsageDetailEstimatedTotalLabel: '明细行合计（约 {amount} ₫）',
    tokenUsageByKindTitle: '按调用类型 (usage_kind)',
    tokenUsageByKindIntro: '汇总所有 LLM token 记录：收件箱、面料推断、收件箱出图等。',
    tokenUsageByDayTitle: '按日（UTC）',
    tokenUsageByDayIntro: '按 UTC 日历日汇总的调用次数与 token。',
    tokenUsageColDay: '日期（UTC）',
    tokenUsageCostByKindAndModelTitle: '按分支与模型',
    tokenUsageCostByKindAndModelIntro: '每行一对 usage_kind + 模型；费用 (₫) 由汇总 token 估算。',
    tokenUsageCostByWeekTitle: '按周（UTC，周一起）',
    tokenUsageCostByWeekIntro: '将所选范围内各日按 UTC 周合并（周从周一开始）。',
    tokenUsageColWeekStart: '周起始（UTC）',
    tokenUsageCostByMonthTitle: '按月（UTC）',
    tokenUsageCostByMonthIntro: '按 UTC 日历月 (YYYY-MM) 在所选范围内合并。',
    tokenUsageColMonthUtc: '月份（UTC）',
    tokenUsageCostTablesNote:
      '以下表格含按分支、日、周、月（UTC）估算的费用 (₫)，与期间总计算法一致。',
    usageDetailApiTitle: '每次 LLM 调用明细（收件箱）',
    usageDetailApiIntro:
      '每一行表示等待时间后的一次 API 调用及实际 token。',
    usageDetailColTime: '时间',
    usageDetailColUsageKind: '类型',
    usageTokenKindInbox: '会话 LLM',
    usageTokenKindMaterialInfer: '从商品图推断面料',
    usageDetailEmpty: '此期间尚无逐次调用记录。',
    usageCreditLedgerTitle: '扣除积分（钱包流水 — 幂等扣费）',
    usageCreditLedgerIntro:
      '记录在您账户上的消费（例如课程、English coach）。与下方收件箱 API token 统计是不同机制。',
    usageCreditLedgerEmpty: '此期间没有扣费记录。',
    usageCreditColType: '类型 (charge_type)',
    usageCreditColAmount: '总积分',
    usageCreditColCount: '次数',
    usageCreditDetailTitle: '最近扣费明细',
    usageCreditColWhen: '时间',
    usageCreditColSingle: '积分',
    usageLogoCreditTitle: 'Logo 规范化（店铺工作区）',
    usageLogoCreditIntro: '生成/编辑品牌 logo 时直接扣积分；不经过上方的消费流水表。',
    usageLogoCreditEmpty: '此期间没有产生扣费的 logo 规范化记录。',
    usageLogoColModel: '模型',
    usageLogoColStatus: '状态',
    usageNoOwnerHint: '工作区未关联账户所有者 — 无法显示钱包扣费流水。',
    usageEmbedImageTitle: '图片向量（Gemini）',
    usageEmbedImageIntro:
      '每次对商品图调用 embedContent：库存同步向量（inventory_sync）或顾客发图找货（guest_image_search）。优先使用 Google 返回的 usageMetadata；缺失时用环境变量估算。',
    usageEmbedImageEmpty: '此期间没有图片向量调用记录。',
    usageEmbedTextTitle: '文本向量（Gemini）— 检索',
    usageEmbedTextIntro:
      '每次文本 embedContent：库存向量同步（inventory_sync）或顾客消息语义找货（customer_query）。Token 来自 Google usageMetadata。',
    usageEmbedTextEmpty: '此期间没有文本向量调用记录。',
    usageEmbedTextSourceQuery: '顾客消息（语义找货）',
    usageEmbedColSource: '来源',
    usageEmbedSourceInventory: '库存同步',
    usageEmbedSourceGuest: '顾客发图（找商品）',
    usageEmbedColPromptSum: 'Prompt token 合计',
    usageEmbedColTotalSum: '计费 token 合计',
    usageEmbedDetailTitle: '每次向量调用明细',
    usageEmbedColInventoryId: '库存行 ID',
    usageImageGenTitle: 'Nano Banana — 收件箱生图',
    usageImageGenIntro:
      'Nano Banana 为内部名称，指 Gemini 生图流程（模型 gemini-3-pro-image-preview）：材质/颜色细节图与上身/使用示意。每次新调用并写入库存才计入——时间范围与上方 LLM token 表一致。已缓存不会重复生成。',
    usageImageGenEmpty: '此期间暂无 Nano Banana 生图记录。',
    usageImageGenColKind: '类型',
    usageImageGenKindMaterial: '材质 / 颜色细节',
    usageImageGenKindRealUse: '上身 / 使用示意',
    usageImageGenColCalls: 'API 调用次数',
    usageImageGenColTotalTokens: '总 token（估算）',
    usageImageGenTotalCallsLabel: '生图总次数（Nano Banana）',
    usageNanoBananaBadge: 'Nano Banana',
    usageNanoBananaModelHint: 'gemini-3-pro-image-preview · 收件箱',
    usageNanoBananaStatCalls: '生图调用次数：{calls}',
    usageNanoBananaStatTokens: '总 token（估算计费）：{tokens}',
    enableLabel: '启用自动回复',
    enableHint: '关闭后仅发送您手动编写的消息。',
    delayLabel: 'AI 回复前等待（秒）',
    delayHint:
      '0–30 秒：在需要模型处理前排队等待（顾客发消息后；最多 30；模型生成完成后不再叠加）。默认 0。若您先回复，AI 不会发送。',
    typingMinLabel: '输入延迟下限（毫秒）',
    typingMaxLabel: '输入延迟上限（毫秒）',
    typingHint:
      '不经大模型而自动发送的消息（如下单提示、聊天内购买引导）在发送前于该范围随机延迟（0–30000）。DeepSeek 正文不重复此步骤。两项均 0 则关闭。',
    productConsultationContextLabel: '店铺 AI 上下文与指引',
    productConsultationContextHint:
      '一个输入框填写 AI 必须始终参考的全部内容：店铺政策、回复语气、导购方式、促单方式、退换、定金、配送等。',
    productConsultationContextPlaceholder:
      '例如：语气礼貌简短；下单前提醒顾客查看尺码表；特价商品不退换；按尺寸定制需支付 50% 定金；顾客犹豫时温和说明政策，不强迫购买等。',
    disclosureToggle: '在末尾附加 AI 说明',
    disclosureSuffixLabel: '说明文字（消息末尾）',
    disclosureSuffixHint: '每条 AI 消息末尾显示，提示为自动回复。',
    saveSettings: '保存设置',
    loadError: '无法加载 AI 配置。',
    faqKeywordsLabel: '触发关键词',
    faqKeywordsHint: '用逗号或换行分隔。',
    faqAnswerLabel: '回答内容',
    faqSortLabel: '排序',
    faqActiveLabel: '启用',
    inactiveBadge: '已关闭',
    addFaq: '添加 FAQ',
    saveRow: '保存',
    deleteRow: '删除',
    cancelEdit: '取消',
    inventoryName: '商品名称',
    inventorySku: 'SKU（可选）',
    inventoryDesc: '规格 / 简述',
    inventoryStock: '库存 / 是否有货',
    inventoryPrice: '价格（文字备注）',
    inventorySort: '排序',
    inventoryImageUrl: '商品图片（URL）',
    inventoryImageUrlHint: '粘贴以 https:// 开头的公开图片链接。系统将其作为文本提供给 AI，AI 可转发给顾客。',
    inventoryProductUrl: '商品页链接（URL）',
    inventoryProductUrlHint:
      '店铺网站上的商品详情页（https://…）。用于以图搜商品结果及 Excel 列“Link trang sản phẩm”。',
    inventoryProductVideoUrl: '商品视频（URL）',
    inventoryProductVideoUrlHint:
      'YouTube 观看页/嵌入链接，或指向 .mp4 / CDN 播放器的 https:// 链接。与 Excel「Video」列一致。',
    inventoryOpenProductPage: '打开商品页',
    inventoryOpenProductVideo: '打开视频',
    inventoryGuestConsultLink: '打开咨询聊天',
    inventoryGuestConsultLinkHint:
      '带商品图片与上下文的 NanoAI 聊天链接（网站、二维码、广告）。顾客打开后会自动发送咨询消息。',
    inventoryGuestConsultLinkNeedSave: '请先保存商品以生成完整聊天链接。',
    inventoryGuestConsultLinkCopied: '已复制聊天链接。',
    inventoryConsultNote: '咨询补充说明',
    inventoryConsultNoteHint: '例如：保修 12 个月、2–3 天发货、限时折扣、仅质量问题退换、满额包邮等。',
    inventoryDescHint: '尺码、颜色、材质、尺寸、套装包含内容等。',
    inventoryStockHint: '剩余数量，或“M/L 有货”“预订约 5 天到货”等。',
    inventoryFieldsGuide:
      '建议在描述或咨询说明中补充：可选颜色/尺码；配送时效与运费；促销截止时间；单品退换规则；保养说明。列表中的每一行都会提供给 AI 用于回复顾客；若不希望 AI 提及某商品，请删除该行或从导入文件中去掉。模板含「状态」列：1 = 新增/更新，0 = 从库存删除该行（按 SKU 或名称匹配）。',
    inventoryOpenApiLink: 'API 集成说明',
    inventoryOpenApiHint:
      '店铺后端可用 JSON 将库存推送到 NanoAI（Open Catalog，字段命名接近 Shopee）。与以图搜商品共用 Bearer；无需 Vision。',
    inventoryDownloadTemplate: '下载 Excel 模板',
    inventoryExportExcel: '导出 Excel',
    inventoryImportExcel: '导入 Excel',
    inventoryImportReplaceWarning:
      '导入 Excel：与现有 SKU（不区分大小写）匹配则更新，否则新增。无 SKU 时按名称与同样无 SKU 的库存行匹配（多条同名时取库存中第一条匹配）。「状态」列（或 is_active）：1 = 新增/更新；0 = 从库存删除（需填写 SKU 或名称以匹配）。若无“排序”列，显示顺序按文件中的行顺序。未出现在文件中的现有商品将保留。是否继续？',
    inventoryImportSuccess: '已处理 {count} 行：新增 {inserted}，更新 {updated}，删除 {deleted}。',
    inventoryImportFailed: 'Excel 导入失败。',
    inventoryExcelImportUploading: '正在上传 Excel 文件…',
    inventoryExcelImportSending: '正在发送文件…',
    inventoryErrInvalidXlsx: '不是有效的 Excel 文件（.xlsx）。',
    inventoryErrEmptySheet: '工作表为空。',
    inventoryErrMissingName: '缺少商品名称列（name）。请使用模板文件。',
    inventoryErrNoRows: '没有有效数据行（至少需一行填写商品名称以新增/更新，或状态=0并填写 SKU 或名称以删除）。',
    inventoryErrNoFile: '未选择文件。',
    inventoryErrFileTooLarge: '文件过大（最大约 20 MB）。',
    inventoryErrTooManyRows: '文件行数过多。每次导入最多 {max} 行。',
    inventoryLoadMore: '加载更多（{shown}/{total}）',
    inventoryVectorSearchPlaceholder: '输入描述（如羊毛衫、皮鞋）— 语义搜索',
    inventoryVectorSearchHint: '文本向量（名称、价格、备注）或图片相似度。需已同步向量与 GOOGLE_API_KEY。',
    inventoryVectorSearchByText: '搜索',
    inventoryVectorSearchByImage: '图片',
    inventoryVectorSearchClear: '清除筛选',
    inventoryVectorSearching: '搜索中…',
    inventoryVectorSearchFailed: '搜索失败。请检查 API 与向量同步。',
    inventoryVectorSearchNoResults: '没有匹配的商品。',
    addInventory: '添加商品',
    edit: '编辑',
    emptyFaq: '请从下方预设问题中选择，并填写店铺回复内容。',
    emptyInventory: '暂无商品。请添加店内实际在售/有货列表，AI 将仅按该列表回答。',
    inventoryProductCountSummary: '当前库存共 {count} 个商品。',
    inventoryEmbeddingTitle: '图片向量进度',
    inventoryEmbeddingSummary: '已完成 {done}/{eligible}。待处理 {pending}。错误 {failed}。',
    inventoryEmbeddingSyncNow: '立即同步',
    inventoryEmbeddingSyncRunning: '同步中...',
    inventoryEmbeddingSyncDoneTitle: '库存向量同步已完成',
    inventoryEmbeddingSyncDoneBody: '已处理 {synced} 项（图片 + 文本）。失败 {failed}。',
    inventoryEmbeddingAutoHint:
      '在「消息 → AI 设置」页保持打开时会自动连续分批同步（约每批 1200 张）；关闭标签即停止。若需后台持续处理：请配置 cron 定期 POST /api/cron/messaging-inventory-embed-backfill（Bearer MESSAGING_INVENTORY_EMBED_CRON_SECRET），见 .env.example。',
    inventoryTextEmbeddingTitle: '文本向量进度',
    inventoryTextEmbeddingSummary: '已完成 {done}/{eligible}。待处理 {pending}。错误 {failed}。',
    inventoryTextEmbeddingAutoHint:
      '文本向量（名称 + 价格 + 咨询备注）用于对话中的语义检索。与图片向量共用「立即同步」；页面打开时会自动连跑直至图片或文本待处理清零；cron /api/cron/messaging-inventory-embed-backfill 负责后台。',
    cronSetupHint:
      '生产环境：配置定时任务 GET 或 POST /api/cron/messaging-partner-ai，请求头 Authorization: Bearer MESSAGING_PARTNER_AI_CRON_SECRET（建议每分钟），并设置 DEEPSEEK_API_KEY。无 cron 时任务会一直排队、AI 不会发出。`next dev` 会在等待时间后自动处理（无需 cron）。本地 `next start` 且无 cron 时，可在 .env 设置 MESSAGING_PARTNER_AI_DEV_WAKE=1。',
    toggleStatusOn: '已开启',
    toggleStatusOff: '已关闭',
    aiEngineTitle: '智能回复 AI',
    aiEngineDescription:
      '等待结束后，会话类消息调用 DeepSeek API（模型 {model}），并结合您配置的库存与政策。',
    disclosureSwitchOn: '附加文末说明',
    disclosureSwitchOff: '不附加',
    faqPresetsIntro:
      '常见购物问题已列好，您只需填写回复内容并开启“启用”；系统会自动识别顾客类似说法（支持多语言）。',
    faqPresetSaveHint: '每项修改后请单独保存。',
    faqPresetAnswerRequired: '开启“启用”时必须填写回复内容。',
    faqCustomSectionTitle: '店铺自定义问题',
    faqCustomSectionIntro:
      '添加仅适用于您店铺的问题：写顾客常问的说法（便于您识别）、用于匹配的关键词、以及回复内容。',
    faqCustomAddTitle: '添加自定义问题',
    faqCustomQuestionLabel: '顾客常问的说法（备忘）',
    faqCustomQuestionHint: '选填。例如：“能加口袋吗？”— 不用于自动匹配。',
    faqCustomKeywordsRequired: '开启“启用”时至少填写一个关键词（每个不少于 2 个字符），可用逗号或换行分隔。',
    faqPresetQuestions: {
      stock: '有货吗 / 缺货吗 / 这个尺码还有吗？',
      shipping: '发货、运费、多久能收到？',
      price: '多少钱、有没有优惠？',
      size_fit: '尺码怎么选、合身吗、有尺码表吗？',
      payment: '怎么付款（货到付款、转账等）？',
      return_policy: '退换货、退款规则？',
      order_track: '查物流、运单号在哪？',
      warranty: '保修怎么算？',
      authentic: '是否正品？',
      promo: '活动、优惠券有吗？',
    },
    visionSearchTitle: '顾客发图时推荐可能商品',
    visionSearchHint:
      '使用 Vertex AI Vision 图像仓库：各店铺在同一 corpus/index 内按 partner_id 过滤。需 GCP（us-central1 或 europe-west4）、GCS 桶、具备 Vision AI + Storage 的服务账号；设置 GCS_VISION_CATALOG_BUCKET、VISION_WAREHOUSE_CORPUS_ID、VISION_WAREHOUSE_INDEX_ID、VISION_WAREHOUSE_INDEX_ENDPOINT_ID，可选 GOOGLE_CLOUD_PROJECT_NUMBER。定时分析/重建索引用与店铺相同的区域（同步或删除资产写入 pending 时保存在 vision_warehouse_runner）。导入图片后必须定时调用 /api/cron/vision-warehouse-reindex（与 vision catalog cron 相同 secret）以分析 corpus 并重建索引 — 之后按图搜索才完整。同步为增量；删除库存行会移除对应资产并需再次跑 cron。',
    visionSearchEnable: '启用按图推荐',
    visionShopCountryLabel: '店铺国家/地区（Vision 预设）',
    visionShopCountryHint:
      '选择店铺主要面向的市场 — 我们会建议合适的 Google Cloud Vision 区域；与 GCP 项目区域一致时，图片目录同步与数据传输通常更快、更稳。熟悉 GCP 可在下方手动覆盖。若不确定，请勿随意选择 — 请用「自定义 Vision 区域（高级）」并咨询负责 GCP 的同事，确认后再填写正确区域。',
    visionShopCountryCustom: '自定义 Vision 区域（高级）',
    visionShopCountryAdvancedHint:
      '请在下方选择与实际 GCP 项目一致的 Vision 区域与商品类别。未使用国家预设，或已保存区域与预设不一致时会显示此项。',
    visionLocationLabel: 'Vision 区域',
    visionCategoryLabel: '商品类别（索引）',
    visionBucketOverrideLabel: 'GCS 存储桶（可选）',
    visionBucketOverrideHint: '留空则使用服务器的 GCS_VISION_CATALOG_BUCKET。',
    visionWarehouseInventorySummary:
      '库存：{total} 个商品 · {withImage} 行具有 https 图片 URL（仅这些行会上传到 Google Vision）。',
    visionCatalogSyncStatsTitle: '图片目录同步状态（NanoAI → Google）',
    visionCatalogSyncStatsLineSynced: '已匹配 — 下次同步将跳过（不重复上传）：{n} 行',
    visionCatalogSyncStatsLinePending: '等待上传或更新（图片或名称已改）：{n} 行',
    visionCatalogSyncStatsLineNoHttps: '无 https 图片 URL — 无法导入 Vision：{n} 行',
    visionCatalogSyncStatsLineExcluded: '已从 Vision 排除：{n} 行',
    visionCatalogSyncStatsExplain:
      '系统只导入「待处理」行；校验和与当前图片+名称一致的行视为已发布，不会再次上传。GCS 中的对象数通常不等于商品数（另有 jsonl 等文件、多图）。资产数量请在 Google Cloud 的 Vision Warehouse 中查看。以 // 开头的图片地址（省略 https）也视为可用，系统会自动按 https 处理。',
    visionSyncButton: '同步库存图片到 Google',
    visionSyncAutoWhenEnableHint:
      '开启「按图推荐」且保存成功后，会自动分段连续同步（resume）直到完成，一般无需再点。仅出错或触及绝对安全上限时再点「同步库存图片」。',
    visionSyncing: '正在同步…',
    visionSyncOk: '图片目录已同步。',
    visionIndexReady: '索引可用',
    visionIndexNotReady: '未同步或索引出错',
    visionLastSynced: '上次同步',
    visionSyncErrorLabel: '最近错误',
    visionWarehouseReindexPending:
      'Vision Warehouse 已更新图片；请等待定时任务重建索引（/api/cron/vision-warehouse-reindex）。完成后按图搜索才会完整。',
    visionWarehouseCorpusUnsupportedType:
      'VISION_WAREHOUSE_CORPUS_ID 中的 corpus 不是类型为 IMAGE 的图像仓库：Google 会拒绝导入（CORPUS_UNSUPPORTED_TYPE）。请按 Google Cloud 文档新建 type 为 IMAGE 的 Image Warehouse corpus，配置对应索引与端点，在 .env 与 AI 设置中更新 ID 后重新同步。视频或其他类型的 corpus 无法使用本图片导入流程。',
    visionProductSearchMaintenanceTitle: 'Google Vision Product Search 维护或受限中',
    visionProductSearchMaintenanceDetail:
      'Google 暂时限制旧版 Product Search 目录操作（Google 侧）。Image Warehouse 说明: https://cloud.google.com/vision-ai/docs/image-warehouse-overview — 旧版 Product Search 申请: https://forms.gle/QPLzMdwSMCR2pPsq5 — NanoAI 已用 Image Warehouse 同步库存图；仅当 Google 响应仍提及 Product Search 时会显示本提示。',
    visionSyncToastImported: '已写入索引',
    visionSyncToastRemoved: '已移除（无有效图片 URL）',
    visionSyncToastMore: '可能还有未处理项 — 请再次同步。',
    visionSyncToastIdle: '当前没有需要同步的更改。',
    visionSyncChainedRounds: '已连续同步 {n} 轮',
    visionSyncChainedStoppedMaxRounds: '已达自动轮次上限 — 请点击同步继续。',
    visionSyncChainedStoppedTimeout: '因时间上限已停止（避免页面卡住）— 请点击同步继续。',
    visionSyncChainedAbortedSafety:
      '自动同步因绝对安全上限已停止 — 请点击同步继续或检查错误。',
    visionBgSyncTitle: '后台同步到 Google（VPS / 定时任务）',
    visionBgSyncHint:
      '在服务器排队：VPS 定时 GET 或 POST /api/cron/vision-catalog-sync，请求头 Bearer VISION_CATALOG_SYNC_CRON_SECRET（见 .env.example）。可关闭此页；完成或出错后再打开查看完整报告。可选：每天一次调用 GET/POST /api/cron/vision-bg-sync-enqueue（同一 Bearer，或单独设置 VISION_BG_SYNC_ENQUEUE_CRON_SECRET）可为所有已开启「按图推荐」的店铺自动重新排队后台同步——不能替代 catalog-sync 定时任务。',
    visionBgSyncButton: '开始后台同步',
    visionBgSyncUseResumeHint:
      '若本页仍保留上次未完成的同步游标（浏览器同步），后台任务从该游标继续；否则从头扫描。',
    visionBgSyncCancel: '取消后台任务',
    visionBgSyncDismiss: '关闭报告',
    visionBgSyncStatusQueued: '等待定时任务',
    visionBgSyncStatusRunning: '定时任务运行中',
    visionBgSyncStatusDone: '已完成',
    visionBgSyncStatusError: '出错',
    visionBgSyncStatusIdle: '无后台任务',
    visionBgSyncReportTitle: '后台同步报告',
    visionBgSyncFieldRounds: 'API 轮次',
    visionBgSyncFieldImported: '已写入索引',
    visionBgSyncFieldRemoved: '已移除',
    visionBgSyncFieldHasMore: '仍有积压',
    visionBgSyncFieldLastScanned: '游标（最后一项）',
    visionBgSyncFieldStopped: '停止原因',
    visionBgSyncFieldMessage: '消息',
    visionBgSyncFieldServerError: '服务器错误',
    visionBgSyncBoolYes: '是',
    visionBgSyncBoolNo: '否',
    visionBgSyncPollingNote: '排队或后台运行期间：页面约每 8 秒自动刷新（请保持标签页打开）。',
    visionBgSyncProgressTitle: '商品上传到 Google 的进度',
    visionBgSyncProgressRatio: '已写入索引：{imported} / ~{total} 条有图片链接的库存',
    visionBgSyncProgressHint:
      '~ 分母为当前库存中有图片链接的行数（估算）。每批 API 的实际计数可能略有不同。',
    visionBgSyncProgressNoImageRows: '库存中还没有带图片链接的商品 — 无法估算进度。',
    visionBgSyncQueuedExplain:
      '«等待定时任务»表示任务已在数据库排队但**尚未执行** — 在服务器调用 `/api/cron/vision-catalog-sync`（Bearer）或点击下方「在服务器运行一轮」之前，0/N 是正常的。',
    visionBgSyncPostRefreshExplain:
      '约每 8 秒对 `/dashboard/messaging/settings` 的 POST 只是**刷新任务状态**（服务端动作），并非调用 Google Vision。',
    visionBgSyncRunSliceButton: '在服务器运行一轮',
    visionBgSyncRunSliceHint: '等同一次 cron（可能需数分钟）。生产环境仍建议在 VPS 配置定时任务。',
    visionBgSyncRunSliceOk: '已完成一轮：{rounds} 次 API 轮次 · 触及 {partners} 个店铺的排队任务。',
    visionBgSyncEnqueueOk: '已加入后台同步队列，VPS 定时任务将处理。',
    visionBgSyncToastDone: 'Vision 后台同步已完成。',
    visionBgSyncToastError: 'Vision 后台同步失败。',
    visionBgSyncAlreadyActive: '后台任务已在队列或运行中。',
    visionBgSyncAlreadyActiveRefreshHint:
      '已从服务器刷新状态。若长时间仍为「排队」，请检查 VPS 上的 Vision 同步定时任务，或点击「取消后台任务」。',
    visionBgSyncEnableVisionFirst: '请先启用「按图推荐」再开始后台同步。',
    visionBgSyncSaveSettingsFirst: '请先在 Messaging 中保存一次 AI 设置。',
    visionBgSyncStopCompleted: '已完成',
    visionBgSyncStopError: '处理出错',
    visionBgSyncStopCronSlice: '本次定时切片结束（将续跑）',
    visionBgSyncStopBadCursor: '游标无效',
    visionBgSyncServerErrCursor: '仍有积压但缺少扫描游标，已安全停止',
    visionBgSyncMsgCompleted: '目录同步已完成。',
    visionBgSyncMsgInProgress: '进行中 — 下次定时任务将继续。',
    visionBgSyncMsgBadCursor: '已停止：服务器返回的游标不一致。',
    visionHealthPanelTitle: 'Vision 同步健康状态',
    visionHealthStatusHealthy: '绿色',
    visionHealthStatusWarning: '黄色',
    visionHealthStatusStuck: '红色（卡住）',
    visionHealthStatusIdle: '暂无数据',
    visionHealthPendingCount: '待处理数量：{n}',
    visionHealthChecksumDone: '校验和完成：{done}/{total}',
    visionHealthLockAge: '锁持续时间',
    visionHealthLockBusy: '占用中（{sec}秒）',
    visionHealthLockFree: '空闲',
    visionHealthLockOwner: '锁持有者',
    visionHealthOwnerUnknown: '未知持有者',
    visionHealthHeartbeatAge: '心跳时长',
    visionHealthHeartbeatAlive: '存活中（{sec}秒）',
    visionHealthHeartbeatNone: '暂无心跳',
    visionHealthLastProgress: '最近进展',
    visionHealthLastProgressNone: '暂无',
    visionHealthUnlockButton: '解锁导入',
    visionHealthUnlockOk: '已释放 Vision Warehouse 导入锁。',
    visionEmergencyDisableButton: '紧急关闭 Vision',
    visionEmergencyDisableConfirm: '确定立即关闭该店铺全部 Vision 功能吗？系统将停止后台同步、关闭图片推荐并清空运行锁。',
    visionEmergencyDisableOk: '该店铺的 Vision 功能已关闭。',
    visionInventoryDeleteRemovesIndexNote:
      '在「库存」标签删除某一行后，系统会自动从 Google 图片索引移除该商品 — 无需上传移除清单。',
    imageSearchApiTitle: '以图搜商品 API（供店铺网站调用）',
    imageSearchApiHint:
      '以 multipart 上传图片（字段 image 或 file），请求头 Authorization: Bearer 加 API 密钥。返回与已同步 Vision 目录最接近的商品。建议从店铺后端调用以免密钥暴露在浏览器。',
    imageSearchApiEnable: '启用公开 API',
    imageSearchApiKeyConfigured: '已设置 API 密钥。',
    imageSearchApiKeyMissing: '尚未创建密钥 — 请在 API 集成页面创建并管理（掩码、显示、复制、删除）。',
    imageSearchApiEndpointLabel: '路径（前面加您的 NanoAI 站点域名）',
    imageSearchApiBaseUrlNote: '示例：https://your-domain.com/api/messaging/partners/…/image-search',
    imageSearchApiDocHint:
      'POST multipart：image（文件）。可选 limit（1–25，默认 8）。JSON：products[] 含 inventory_id、name、sku、image_url、product_url、score。',
    imageSearchApiGenerate: '生成 / 轮换 API 密钥',
    imageSearchApiGenerating: '正在生成密钥…',
    imageSearchApiKeyCreated: '已生成密钥（若允许已尝试复制到剪贴板）。请立即保存 — 不会再次显示。',
    imageSearchApiManageKeysLink: '打开 API 集成 — 管理密钥',
    guestPurchaseFlowLabel: '客户在 NanoAI 聊天中的购买方式',
    guestPurchaseFlowHint:
      '「聊天内」：点购买后使用当前下单/扫码流程。「店铺网站」：点购买在新标签打开商品页（库存中的 URL）— 适合已在网站配置支付与物流的店铺。',
    guestPurchaseFlowInChat: '在聊天内下单（表单 + NanoAI 支付）',
    guestPurchaseFlowExternal: '点「购买」时打开店铺网站',
  },
  partnerGuestChat: {
    notFoundTitle: '未找到聊天页面',
    notFoundDescription: '链接无效或店铺已关闭此功能。',
    pageTitleSuffix: 'NanoAI 聊天',
    metaDescription: '在 NanoAI 上联系 {shop} — 与 Facebook、Zalo 和网店使用同一收件箱。',
    shopLabel: '店铺',
    subline:
      '您正在 NanoAI 上与店铺聊天；店铺在其后台回复。请使用 Google 登录以在多台设备间同步消息。',
    placeholder: '输入消息…',
    send: '发送',
    emptyThread: '暂无消息。请在下方发送第一条。',
    loadError: '无法加载消息。',
    sendError: '发送失败。',
    pollNote: '店铺回复可能延迟数秒显示。',
    guestAttachPhoto: '相册选图',
    guestTakePhoto: '拍照',
    guestRemoveAttachment: '移除图片',
    guestUploading: '正在上传图片…',
    guestImageTooLarge: '图片过大（最大约 10 MB）。',
    guestImageInvalidType: '仅支持 JPG、PNG、WebP 或 GIF。',
    guestCaptionHint: '可为图片添加说明（选填）。',
    loginPromptTitle: '登录后开始聊天',
    loginPromptDescription: '使用邮箱登录与店铺沟通，并在其他设备上继续对话。',
    signInWithGoogle: '登录',
    linkMyShops: '我的消息',
    linkMyOrders: '我的订单',
    widgetShoppingCart: '购物车',
    widgetLanguageSelectAria: '语言',
    sendKeyboardHint: 'Enter 发送 · Shift+Enter 换行 · Ctrl+V 粘贴图片',
    tryOnOpen: 'AI 试穿',
    tryOnTitle: '在聊天中直接试穿',
    tryOnModelPhoto: '人物照片',
    tryOnGarmentPhoto: '服装照片',
    tryOnGarmentSourceTitle: '选择服装图片来源',
    tryOnGarmentSourceDevice: '从设备选择图片',
    tryOnGarmentSourceRecent: '从店铺最近 20 张推荐图中选择',
    tryOnGarmentRecentEmpty: '暂无最近推荐图片。',
    tryOnGenerate: '生成试穿图',
    tryOnGenerateWithCost: '生成试穿图（-{credits} 积分）',
    tryOnPreparing: '正在生成试穿图…',
    tryOnNeedBoth: '请同时上传人物照片和服装照片。',
    tryOnGarmentLimitReached: '最多可选择 {max} 件服装。',
    tryOnGarmentItemsLabel: '件',
    tryOnFailed: '试穿图生成失败。',
    tryOnReady: '试穿图已生成，可直接在聊天中发送。',
    tryOnChargedToast: '已扣除 {cost} 积分，剩余 {remaining} 积分。',
    tryOnCreditsBalanceLabel: '余额：{credits}',
    tryOnTopUpCredits: '充值',
    tryOnResultViewLarge: '大图查看试穿效果',
    tryOnResultDownload: '下载',
    tryOnEmbedGarmentFromPage: '当前页面的商品图',
    tryOnEmbedGarmentFromPageWithSku: '当前页面商品（SKU: {sku}）',
    tryOnEmbedOnlyFlowHint:
      '请上传本人照片（下次在同一浏览器、此聊天框架内会记住）。服装图来自当前页面商品。试穿消耗 credits — 在同一聊天框架内充值即可（与店铺同标签页，无需另开 NanoAI 标签页）。',
    guestCreditWalletLoginTitle: '登录以使用 credit 钱包',
    guestCreditWalletLoginDescription: '试穿与充值需验证邮箱（OTP）。请在下方完成验证。',
    toastGuestTopUpLoginRequired: '请先使用邮箱（OTP）登录，再充值 credit。',
    toastTryOnInsufficientCredits: 'Credit 不足，请充值后再试。',
    guestAuthPromptTitle: '登录以长期保存聊天记录',
    guestAuthPromptBody: '您仍可立即聊天。登录后可在更换设备/浏览器时同步历史。',
    guestAuthEmailPlaceholder: '请输入您的邮箱',
    guestAuthSendMagicLink: '发送登录链接',
    guestAuthSendOtp: '发送 OTP 验证码',
    guestAuthOtpPlaceholder: '输入 6 位 OTP',
    guestAuthVerifyOtp: '登录',
    guestAuthRequiredAfterLimit: '您已发送 {count} 条消息。请先验证邮箱再继续聊天。',
    guestAuthEmailSent: '验证邮件已发送，请检查收件箱。',
    guestAuthOtpInvalid: 'OTP 无效或已过期。',
    guestAuthRateLimited: '操作过于频繁，请在 {seconds} 秒后重试。',
    guestAuthRememberDeviceHint: '长期信任此设备/浏览器（同一邮箱再次登录可能免去 OTP）。',
    guestAuthVerifyingProgress: '正在登录，请稍候...',
    shopTypingHint: '店铺正在输入…',
    consultLinkShopPreparingHint: '店铺正在发送商品信息…',
    similarAlternativesTemplateMessage: '下方还有更多款式供您参考。',
    productSearchTemplateMessage:
      '下面是符合需求的商品。您可以点商品卡片上的“立即购买”在聊天中下单，也可以点“咨询”继续询问。',
    visionPickHint: '请选择正确商品（或等待人工回复）。',
    visionPickBusy: '发送中…',
    visionPickError: '无法提交选择，请重试。',
    visionProductLink: '咨询商品',
    visionProductBuy: '立即购买',
    visionProductViewDetails: '查看详情',
    visionProductVideo: '视频',
    visionVideoCloseAria: '关闭视频',
    productShelfButton: '商品',
    urlProductContextChipLabel: '发送当前商品',
    urlProductContextChipAria: '将本页正在浏览的商品信息发送给店铺。先输入其他消息则不会附带。',
    urlProductContextChipDismissAria: '关闭 — 不发送正在浏览的商品',
    productShelfTitle: '您最近关注的商品',
    productShelfEmpty: '暂无推荐。请查看店铺消息或发送图片以获取推荐。',
    productShelfSearchPlaceholder: '搜索库存（款式、描述等）',
    productShelfSearchButton: '搜索',
    productShelfSearchImage: '图片',
    productShelfSearchClear: '清除',
    productShelfSearching: '搜索中…',
    productShelfSearchFailed: '搜索失败。请同步库存向量后重试。',
    productShelfSearchNoResults: '没有匹配的商品。',
    productShelfBuy: '购买',
    purchaseOpenSiteToast: '已在新标签页打开店铺商品页。',
    purchaseMissingProductUrlToast: '该商品缺少商品链接 — 请在库存中填写 URL。',
    productConsultProductRefFromSku: '商品编号 {sku}',
    productConsultProductRefFromName: '{name}',
    productConsultAskShipping:
      '关于{productRef} — 想先了解配送还是商品详情？',
    productConsultAskDetail:
      '关于{productRef} — 您还想了解哪一点？',
    productConsultAskDetailFromSku:
      '我对这款商品“{sku}”感兴趣，请店铺帮我咨询一下。',
    pageContextInboundConsultNoSku:
      '您好！您从商品页进入 — 请留言说明需求，我们好协助您。',
    pageContextInboundImageOnlyNote:
      '客户通过商品链接进入 — 图片已随消息发送，便于店铺解答（与发送图片相同）。',
    guestProfileDialogTitle: '帮助我们正确称呼您',
    guestProfileDialogDescription:
      '信息仅保存在您的 NanoAI 账户一次（适用于所有店铺）：出生日期和性别（男或女），用于自然称呼与适龄建议。您也可以稍后再填。',
    guestProfileBirthLabel: '出生日期',
    guestProfileBirthDayPlaceholder: '日',
    guestProfileBirthMonthPlaceholder: '月',
    guestProfileBirthYearPlaceholder: '年',
    guestProfileGenderLabel: '性别',
    guestProfileGenderMale: '男',
    guestProfileGenderFemale: '女',
    guestProfileSave: '保存',
    guestProfileRemindLater: '稍后',
    guestProfileInvalid: '请填写出生日期并选择性别。',
  },
  messagingMyChats: {
    pageTitle: '我的消息',
    pageDescription: '您在 NanoAI 上联系过的店铺。',
    emptyList: '暂无会话。打开店铺的聊天链接即可开始。',
    openChat: '打开聊天',
    lastActivity: '最近活动',
    loadFailed: '无法加载列表。',
    backHomeAria: '返回首页',
  },
  messagingMyOrders: {
    pageTitle: '我的订单',
    composerOrdersLabel: '订单',
    pageDescription: '通过 NanoAI 聊天下单的订单 — 每笔订单的付款与发货状态。',
    emptyList: '暂无订单。在店铺聊天中下单后即可在此查看。',
    loadFailed: '无法加载列表。',
    backHomeAria: '返回首页',
    openChat: '打开聊天',
    createdAt: '下单时间',
    totalLabel: '订单总额',
    payStatus: '付款',
    shipStatus: '发货',
    stAwaiting: '待付定金（转账）',
    stChecking: '核对付款中',
    stPaid: '已付款',
    stManual: '待店铺处理',
    stCancelled: '已取消',
    shPending: '待处理',
    shConfirmed: '已确认',
    shPacking: '打包中',
    shShipping: '配送中',
    shDelivered: '已送达',
    shReturned: '退货',
    shCancelled: '已取消',
    orderIdLabel: '订单号',
    transferMemoLabel: '转账备注',
    qtyLabel: '数量',
    colorLabel: '颜色/款式',
    sizeLabel: '尺码',
    noteLabel: '备注',
    unitPriceLabel: '单价',
    depositPctLabel: '定金比例',
    amountDueLabel: '应付定金',
    paidRecordedLabel: '已付金额',
    balanceOnDeliveryLabel: '收货时需付（尾款）',
    shipToLabel: '收货地址',
    productPhotoAlt: '所购商品图',
    variantImagesSectionLabel: '所选颜色/款式图',
    totalQtySummaryLabel: '总数量',
    viewTimelineButton: '订单时间线',
    timelineTitle: '订单时间线',
    timelineLoadFailed: '无法加载订单记录。',
    timelineEmpty: '暂无事件。',
  },
  meetingRecorder: {
    cardTitle: '会议录音 → AI 纪要',
    cardDescription:
      '浏览器内录音不扣积分；开始录音时自动保存会议名称到本设备。仅当您生成 AI 纪要时，才按录音时长扣除积分。',
    freeRecordingNote: '录音与保存会议名：不扣积分。',
    silenceAutoStopNote:
      '若连续 5 分钟未检测到说话声，录音将自动停止并保存，效果与手动停止相同。',
    autoStoppedBySilence: '已自动停止录音：连续 5 分钟未检测到说话声。',
    segmentAutoSplitNote:
      '每满 5 分钟会自动结束当前片段并开始新片段（同一麦克风），无需在服务器上切割音频。',
    segmentRotatedToast: '已开始新的 5 分钟录音片段。',
    chargeNote:
      '生成 AI 纪要（纪要+摘要）：前 5 分钟 1 积分；超出部分按分钟向上取整，每分钟 +0.2 积分。',
    sessionNote:
      '录音在服务器最多保存 {days} 天后自动删除。本页仍可本地播放/下载；点击开始录音时会自动把会议名称保存在本设备。',
    meetingTitleLabel: '会议名称',
    meetingTitlePlaceholder: '例如：Q1 项目例会',
    savingRecording: '正在保存录音到服务器…',
    saveRecordingFailed: '保存失败，请检查网络后重试。',
    retrySaveRecording: '重试保存录音',
    needServerRecording: '需先将录音保存到服务器，再生成 AI 纪要。',
    startRecording: '开始录音',
    stopRecording: '停止',
    stopRecordingConfirmTitle: '确认停止录音',
    stopRecordingConfirmDescription:
      '请仅在会议确实已结束时确认。录音将保存；仅在生成 AI 纪要时扣除积分。',
    stopRecordingConfirmOk: '确认 — 会议已结束',
    stopRecordingConfirmContinue: '继续录音',
    recording: '正在录音…',
    idleHint: '请在浏览器提示时允许使用麦克风。',
    recordingTimeLabel: '录音中：{duration}',
    durationLabel: '时长：{duration}',
    createNewMeeting: '新建会议',
    stopBeforeNewMeeting: '请先停止录音再新建会议。',
    downloadRecording: '下载录音文件',
    generateReport: '生成 AI 纪要',
    reportLanguageLabel: '纪要语言',
    estimatedCost: '预估：{credits} 积分',
    costExplain:
      '前 5 分钟：1 积分；超出 5 分钟的部分按分钟向上取整，每分钟 +0.2 积分 — 例：5:47 ≈ 1.2 积分。',
    needRecording: '请至少录制数秒后再生成纪要。',
    processing: '正在分析音频…',
    reportHeading: '会议纪要',
    briefReportHeading: '简要纪要（要点）',
    fullReportHeading: '详细纪要',
    transcriptHeading: '转写',
    copy: '复制',
    copied: '已复制',
    downloadMd: '下载详细纪要（.md）',
    downloadBriefMd: '下载简要纪要（.md）',
    micError: '无法使用麦克风，请检查浏览器权限。',
    fileTooLarge: '音频文件过大（上限 20MB）。',
    genericError: '发生错误，请稍后重试。',
    insufficientCredits: '积分不足。',
  },
  flowMusicVeo: {
    pageTitle: 'AI 音乐视频（Flash 歌词 + Veo）',
    metaDescription:
      '分段歌词（Flash JSON）、Lyria 风格、首段由图生成约 8 秒，后续用 Veo 延长衔接——每步提示含该段歌词。一个连续 MP4。音频由 Veo 生成。',
    headline: '音乐视频 — 歌词（Flash）+ 画面与声音（Veo）',
    subtitle:
      '第 1 步：曲风（Flash）+ 图/提示。第 4 步：歌词格自上而下排列；「打开歌词格…」或成片后「再延长约 8 秒」增加一行；生成或手打 — 下为 Veo（先图后接视频）。',
    stepLyricsTitle: '第 1 步 — 曲风与提示（Flash 歌词）',
    stepLyricsBody:
      '此处仅曲风 + 图 + 主题给 Flash（人声/速度在 Veo）。第 4 步同时显示各歌词格；用「打开歌词格…」或「再延长约 8 秒视频」增加一行（最多 20）。逐格「生成歌词」或手打。',
    lyricsModeLabel: '歌词生成方式',
    lyricsModeAllAtOnce: '一次生成 — 共 N 段',
    lyricsModeProgressive: '逐段生成 — 写到哪里生成到哪里',
    lyricsProgressiveHelp:
      '第 1 步：曲风 → 图 → 提示；第 4 步歌词格自上而下排列，在需要的格点「生成歌词」。人声/速度/结构在做 Veo 视频时选。「打开歌词格…」增加空行（最多 20）。每次 {credits} 积分 — 与视频按钮分开。',
    openNextLyricsSegmentButton: '打开歌词格 — 第 {k} 段',
    segmentVideoSubBlockHint: 'Veo 视频（另一条流程，歌词就绪后使用）：',
    progressiveStyleOnlyInStep1Note: '曲风/人声/速度等仅在此选择；下方做视频不再选音乐项。',
    lyricsGenreOnlyHelp:
      '仅用于 Flash 写歌词。人声、速度、结构等在第四步做 Veo 视频时再选，写歌词时不发送。',
    veoStyleFieldsIntro: '人声、语言、速度、曲式 — 发给本段 Veo（不写歌词时用）。',
    progressiveExtendStyleLockedNote: '音乐风格与生成第 1 段歌词时一致 — 仅可补充画面/镜头/人物（可选）。',
    progressiveVideoSectionTitle: '生成视频 — 第 {k} 段',
    generateNextSegmentButton: '生成歌词 — 第 {k} / {n} 段',
    successLyricsOneSegment: '已生成第 {k}/{n} 段。继续生成或待全部完成后再进行下一步。',
    incrementalPlanFrozenHelp: '已开始逐段生成 — 段数不可改。请「从头开始」再调整。',
    lyricsModeFrozenHint: '已有 AI 歌词进度 — 不可切换方式。请「从头开始」。',
    progressiveNoNextSegment: '各段已填满 — 前往第 4 步或「从头开始」。',
    hintLabel: '主题/故事提示（有图时可不写长文）',
    hintPlaceholder: '例如：中文流行，关于夏天与海，轻快…',
    lyricsImageHelp: '可选情绪参考图 — Flash 据图启发歌词。',
    generateLyricsButton: '生成歌词（Flash）',
    generatingLyrics: '正在生成歌词…',
    lyricsNeedHintOrImage: '至少需要 4 字提示或一张图片。',
    successLyrics: '已生成歌词 — 请检查并修改。',
    successLyricsBlocks: '已生成 {n} 段连贯歌词（JSON）— 请在第 4 步核对每格。',
    lyricsBlockCountLabel: '歌词段数 / 8 秒片段数',
    lyricsBlockCountHelp: 'Flash 按此段数输出（JSON）；与第 4 步各格及 Veo 衔接次数一致。',
    openingLyricsLabel: '首段 8 秒歌词',
    openingLyricsHelp: '在第 1 格填写足够行数（约 8 秒演唱）。Veo 提示包含本段歌词与英文风格描述。',
    fillOpeningButton: '从完整歌词填充开头',
    assignOpeningToSegment1: '已将开头歌词填入第 1 段。',
    styleBlockTitle: '第 2 步 — 音乐风格（同 Lyria 有人声）',
    styleBlockBody: '选项会以英文描述发给 Veo（流派、人声、速度、结构等）。不生成 MP3 — 由 Veo 合成视频音轨。',
    genreLabel: '流派',
    voiceGenderLabel: '人声性别',
    voiceTimbreLabel: '音色',
    voiceLangLabel: '演唱语言',
    bpmLabel: '速度（BPM）',
    structureLabel: '曲式',
    densityLabel: '编曲密度',
    videoBlockTitle: '第 3 步 — 图片与 8 秒片段（720p）',
    videoBlockBody: '一张图：图生视频首帧。两张或三张：仅参考图模式（无单独首帧）。最多 3 个文件。',
    aspectLabel: '比例',
    aspect169: '16:9',
    aspect916: '9:16',
    framesLabel: '图片（1–3）',
    framesHelpSingle: '单文件：视频首帧。',
    framesHelpMulti: '两或三文件：均为参考（ASSET）图。',
    visualExtraLabel: '额外画面说明（可选）',
    visualExtraPlaceholder: '例如：黄金时刻、慢动作、演唱时特写…',
    createClip8s: '生成 8 秒片段（720p）',
    creatingClip: '正在生成 8 秒片段（Veo）…',
    clip720Note:
      '每段为独立的约 8 秒 Veo 片段（复用第 1 段图片），最后在服务器拼接 MP4。每片段约 8 积分；拼接不扣积分。',
    needImage: '至少需要一张图片。',
    previewTitle: '预览说明',
    downloadMp4: '下载 MP4',
    segmentIndexLabel: '第 {n} 段',
    createSegment1VideoButton: '用图片生成第 1 段（约 8 秒，720p）',
    addEightMoreVideoButton: '再延长约 8 秒视频',
    addEightMoreVideoHelp:
      '打开下一段歌词：可生成或手打，再为该段单独生成约 8 秒片段（同第 1 段图片）。完成后可将多段拼成一个 MP4。',
    extendSegmentVideoButton: '生成第 {k} 段片段（约 8 秒，独立）',
    extendingVeoSegmentBusy: '正在生成第 {k} 段（Veo）— 可能需要数分钟…',
    videoSequentialBlockIntro: '每步下方即该步视频与下一步操作。',
    videoImagesOnlyStep3Note: '第 1 段的图片与比例会用于后续每段（每段单独生成，非延长）。',
    previewInStep4Note: '各检查点视频显示在第 4 步内。',
    videoForSegmentLockedNote: '点击「再延长约 8 秒视频」且上一段已有成片后，本段 Veo 才会显示。',
    successExtendSegment: '第 {k} 段片段已生成。请在下方查看。',
    partialSegmentsFail: '生成第 {n} 段时中断 — 之前的片段仍可播放/下载/拼接。',
    startOver: '从头开始',
    veoAudioNote: 'MP4 内音频由 Veo 根据提示（歌词 + 风格文字）生成，非上传音轨。',
    successClip: '已生成 8 秒片段。',
    segmentCountLockedHelp: '已增加歌词格或使用 AI 生成后段数固定。需重设请「从头开始」。',
    lyricsLockedNote: '各段歌词已锁定，以保持发送 Veo 的顺序一致。',
    segmentsCountSyncedNote: '与第 1 步相同：{n} 段。',
    videoAfterSegmentLabel: '歌词第 {n} 段之后（约 {seconds} 秒）',
    downloadMp4Step: '下载 MP4 — 检查点 {n}',
    extendPerStepSectionTitle: '每段片段的选项',
    extendPerStepSectionBody: '第 2 步音乐风格适用于所有片段；机位/人物可在每次生成前修改。',
    extendBridgeLabel: '第 {to} 段独立约 8 秒片段 — 同第 1 段图片；之后可拼接 MP4。',
    extendSegmentVisualLabel: '画面说明（本次延长）',
    cameraHintLabel: '机位 / 镜头运动',
    cameraHintPlaceholder: '例：缓慢左摇、广角、轻微手持…',
    characterStoryLabel: '角色动作 / 情节',
    characterStoryPlaceholder: '例：望向大海、举手、转身离开…',
    standaloneFramesNote: '复用第 1 段所选图片；可为本片段提示调整机位/人物说明。',
    mergeClipsSectionTitle: '拼接已生成的片段',
    mergeClipsSectionHelp: '按第 1 → 2 → … 顺序合并为一个 MP4。不扣积分；服务器需安装 ffmpeg。',
    mergeClipsButton: '合并为一个 MP4',
    mergingClips: '正在服务器拼接视频…',
    successMergedClip: '拼接完成。在下方查看或到历史记录中查看。',
  },
  navGroup: {
    try_on: '试衣与穿搭',
    education: '教育与培训',
    image_edit: '图片编辑',
    design_creative: '设计与创意',
    three_d_special: '3D 与专业工具',
    music_ai: 'AI 音乐',
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
    wedding_invitation_ai: 'AI 婚礼请柬',
    text_to_image: '文生图',
    infographic_from_book: '书籍信息图',
    sketch_to_image: '草图生成图像',
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
    edit_image_by_request: '按要求编辑图片',
    product_3d_sample: '3D 商品样图',
    model_3d_from_image: '从图片生成 3D 模型',
    create_video_from_image: 'AI 视频（Veo）',
    flow_music_veo_video: 'AI 音乐视频（Flash+Veo）',
    interior_exterior: '室内与室外',
    my_house: '想建的房型',
    portrait_photo: '人像照片',
    expand_frame: '扩展画幅',
    face_swap: '换脸',
    translate_document_image: '文档图片翻译',
    lyria3_instrumental_song: '制作乐曲（人声或纯音乐）',
    meeting_recorder_report: '会议录音与 AI 纪要',
    ai_language_learning: 'AI 语言学习',
    create_curriculum: '创建课程',
    my_curricula: '我的课程',
    online_exam: '在线考试（课堂）',
    homework_online: '创建家庭作业',
    classes: '班级',
    try_on_1: '1 人试衣',
    try_on_2: '2 人试衣',
    try_on_3: '3 人试衣',
    try_on_4: '4 人试衣',
    try_on_5: '5 人试衣',
    image_result_display: '图片结果显示方式',
    admin: '管理',
  },
  creationSidebar: {
    back: '返回',
    relatedTitle: '相关',
    popularTitle: '常用工具',
  },
  imageResultDisplay: {
    pageTitle: '前后对比显示方式',
    pageIntro:
      '默认：单框拖动对比（与室内设计工具相同的交互）。也可选择并排。适用于各图片工具；每个结果页仍可临时切换。',
    modeSplitTitle: '并排',
    modeSplitDesc: '原图与处理后图片分列显示，点击图片可放大查看，与之前一致。',
    modeCompareTitle: '拖动对比（默认）',
    modeCompareDesc: '单框中间拖移：左为原图、右为结果；支持全屏，与其他已对齐的工具一致。',
    persistNote: '保存在本机浏览器中。',
  },
  taskHub: {
    pageTitle: '任务与队列',
    pageDescription: '查看进行中的处理（图片、视频、批量翻译、教材）并快速打开对应工具。',
    sectionRunning: '进行中',
    sectionRecent: '最近完成或失败（7 天）',
    emptyRunning: '当前没有进行中的任务。',
    emptyRecent: '近 7 天没有已完成的任务。',
    openTool: '打开工具',
    batchSummary: '{done}/{total} 已完成',
    itemsCount: '{n} 项',
    worksheetSection: '作业 / 教材（后台）',
    worksheetParseSgk: '提取教材',
    worksheetQuiz: '分步测验',
    worksheetEssay: '作文批改 / 生成',
    worksheetUnknownType: '工作表任务',
    statusProcessing: '运行中',
    statusFailed: '失败',
    statusCompleted: '完成',
    statusCancelled: '已取消',
    statusMixed: '部分完成',
    hintTranslateProgress: '图片翻译批次：在工具页查看详细进度、下载 ZIP 或取消批次。',
    linkProcessedImages: '已处理图片',
    linkTranslateHistory: '翻译记录',
    linkTranslateProgress: '翻译进度',
    autoRefreshNote:
      '有任务进行中时：约每 8 秒自动刷新（标签页可见）。无进行中任务时：仅在您切回此标签页时更新。',
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
    mobileCreateHomework: '创建家庭作业',
    assignWorksheet: '家庭作业',
    classHomeworkListEmpty: '本班级尚未关联任何家庭作业。',
    classHomeworkListCreateCta: '创建家庭作业',
    classHomeworkOpenLamBai: '学生做题页',
    classHomeworkAttachOtherClassButton: '将家庭作业关联到其他班级',
    classHomeworkAttachPickTitle: '将家庭作业关联到其他班级',
    classHomeworkAttachPickDescription:
      '将使用相同内容创建新的家庭作业场次（新代码与链接），并关联到您选择的班级。',
    classHomeworkAttachSessionLabel: '家庭作业',
    classStudentHomeworkSessionsEmpty: '老师尚未布置家庭作业。',
    noWorksheets: '暂无作业单',
    noStudents: '暂无学生',
    doWorksheet: '做作业',
    submit: '提交',
    submitSuccess: '已提交',
    viewResult: '查看结果',
    quizScore: '测验分数',
    sampleAnswer: '参考答案',
    submissions: '提交记录',
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
    classExamsSubsectionGraded: '测验（计分）',
    classExamsSubsectionPracticeHomework: '家庭作业（学生端不显示分数）',
    studentClassHomeworkSubmittedCaption: '已提交。此为家庭作业——此处不显示分数。',
    classSessionBadgeHomework: '家庭作业',
    lamBaiSeoTitleSuffixExam: '在线测验',
    lamBaiSeoTitleSuffixHomework: '家庭作业',
    lamBaiSeoDescriptionExam: '使用会话码在线完成测验：选择题与问答题，并计分。',
    lamBaiSeoDescriptionHomework:
      '使用会话码在线完成家庭作业——用于练习，不会像正式测验那样显示分数。',
    lamBaiSeoKeywordsExam: '测验, 在线考试, 选择题, 问答题, NanoAI',
    lamBaiSeoKeywordsHomework: '家庭作业, 练习, NanoAI',
    lamBaiSeoFallbackTitle: '在线答题',
    lamBaiSeoFallbackDescription: '登录后使用会话码或教师分享的链接完成答题。',
    lamBaiSeoFallbackKeywords: '答题, NanoAI',
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
    examAttachToOtherClassButton: '关联到其他班级',
    examAssignClassButton: '分配班级',
    examAttachPickClassTitle: '将试卷关联到其他班级',
    examAttachPickClassDescription:
      '系统将新建一场考试（新的代码与链接），题目相同，并关联到您选择的班级。',
    examAttachSelectClassLabel: '选择班级',
    examAttachSelectClassPlaceholder: '— 请选择班级 —',
    examAttachSubmit: '关联到班级',
    examAttachLoadingClasses: '正在加载班级列表…',
    examAttachWorking: '正在创建考试场次…',
    examAttachNoClassesBody: '您还没有班级。请先创建班级，然后再回来关联试卷。',
    examAttachNoOtherClassesBody: '除当前班级外您没有其他班级。请再创建一个班级以关联副本试卷。',
    examAttachFailed: '无法关联试卷，请稍后重试。',
    examAttachSuccessSummary: '新场次已关联至：{classLine}。',
    examAttachClose: '关闭',
    examAttachPickAnotherClass: '关联到其他班级',
    examAttachExamLabel: '试卷',
    examAttachAllClassesAlreadyAttachedBody:
      '您的每个班级都已有本场考试的场次（相同题目），没有可再关联的班级。',
    examAttachNeedDifferentClassHint:
      '找不到要关联的班级？请在新标签页创建班级，然后点击下方「刷新班级列表」。',
    examAttachReloadClassList: '刷新班级列表',
    examAttachOpenCreateClassNewTab: '新建班级（新标签页）',
    examAttachClassAlreadyHasExam: '该班级已有本场考试。',
    examIdentityFromClassHint:
      '班级档案中已有您的姓名与出生日期。准备好后点击开始；计时仅在点击开始后启动。',
    examChangeIdentityManual: '改用其他姓名与出生日期',
    examManualIdentityIntro: '请填写信息并点击开始答题；计时仅在点击开始后启动。',
    examStartTestButton: '开始测验',
    examOneAttemptNote:
      '每账号一次机会：点击开始后服务器会锁定作答，无法重新打乱题目；离开页面需提交答卷。',
    examStartHomeworkButton: '开始做作业',
    homeworkIdentityFromClassHint:
      '班级档案中已有姓名与出生日期。准备好后点击开始；计时仅在点击开始后启动。',
    homeworkManualIdentityIntro: '填写信息并点击开始以完成家庭作业；计时仅在点击开始后启动。',
    homeworkEnrollGateTitle: '加入班级后才能完成家庭作业',
    homeworkEnrollGateDescription:
      '此家庭作业已关联班级。请按班级名册填写姓名与出生日期（勿使用 Google 账号显示名）。随后即可开始作业。',
    homeworkEnrollSubmitButton: '加入班级并开始作业',
    homeworkDefaultTitle: '家庭作业',
    lamBaiLoadingNeutral: '加载中…',
    lamBaiFiveMinWarning: '还剩 5 分钟！请在结束前检查答案。',
    lamBaiTimerTimeUpAutoSubmittingExam: '时间到！答卷正在自动提交。',
    lamBaiTimerTimeUpAutoSubmittingHomework: '时间到！作业正在自动提交。',
    lamBaiTimerStickySubmittingExam: '时间到 — 提交中…',
    lamBaiTimerStickySubmittingHomework: '时间到 — 提交中…',
    lamBaiExitBlockedBanner:
      '正在答题：建议仅在提交后离开页面。关闭标签、刷新或返回会被拦截或提示——请提交以结束本次答题。若暂时离开后再打开，计时仍从点击「开始」起算。',
    lamBaiExitBlockedBeforeStartHint:
      '点击「开始」后，请先提交再离开页面。关闭标签、刷新或离开页面时，浏览器会发出警告。你可以暂时离开后再回来，但计时从点击「开始」起持续进行。',
    lamBaiExitBlockedDialogTitle: '需提交后才能离开',
    lamBaiExitBlockedDialogDescription:
      '你正在答题。要安全离开请先提交。可点击下方「立即提交」或滚动到页面底部提交。',
    lamBaiExitBlockedSubmitNow: '立即提交',
    lamBaiExitBlockedStay: '继续作答',
    lamBaiExamResumeNotice: '您有未提交的作答，已恢复已保存的答案。请继续作答并在完成后提交。',
    examBeginStarting: '正在开始…',
    examBeginFailed: '无法开始作答，请重试。',
    examSubmitSending: '正在提交…',
    examSubmitButton: '提交答卷',
    homeworkSubmitSending: '正在提交作业…',
    homeworkSubmitButton: '提交作业',
    homeworkLoadFailed: '无法加载家庭作业。',
    lamBaiQuestionLabel: '第 {index} 题.',
    examSubmittedTitle: '已提交',
    examSubmittedSavedEarlier: '您已提交过本场测验。以下是已保存的成绩。',
    examSubmittedDueToDeadlineHint:
      '系统作答时间已结束——已根据已保存的答案自动提交。以下为结果。',
    homeworkSubmittedTitle: '家庭作业已提交',
    homeworkSubmittedSavedEarlier: '您已提交过这份作业。以下是已保存的信息。',
    homeworkSubmittedBody: '此为练习型作业，不向学生显示分数或评分量表。教师仍可在课堂中查看与点评。',
    homeworkMcCorrectOnlyLine: '选择题：答对 {correct}/{total} 题',
    homeworkShareLine: '已提交：{title}',
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
    examSessionCreatedAt: '创建于 {time}',
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
    classExamsIndexTitle: '本班测验',
    classExamSessionPageTitle: '测验详情',
    classExamGoToSession: '打开批改页面',
    classDetailSeoDescription: '班级主页：测验、成员、成绩表。',
    classHubCardAssignWorksheetDesc: '已为本班创建并关联的家庭作业；学生通过链接或代码作答。',
    classPageStudentFacingNotSet: '未设置',
    classHubCardStudentWorksheetsDesc:
      '老师布置的家庭作业：通过链接或会话码在答题页面完成。',
    classHubCardCreateExamButton: '创建测验',
    classHubCardCreateHomeworkButton: '创建作业',
    worksheetLamBaiNoInteractiveHint:
      '本作业单暂无可在线完成的选择题或主观题（教师需先在课程工具中关联题目）。您暂时无法在此提交。',
    worksheetLamBaiBackToClassWorksheets: '返回班级作业单列表',
    worksheetLamBaiMcqSectionTitle: '选择题',
    worksheetLamBaiEssaySectionTitle: '主观题',
    worksheetLamBaiEssayPlaceholder: '请输入答案…',
    worksheetSubmitNoInteractiveError: '本作业单尚无在线题目，教师需先关联题目。',
    assignWorksheetNoQuestionBankHint: '尚未从题库关联题目 — 学生无法在线作答与提交。',
    assignWorksheetOpenInCurriculumTool: '在课程工具中打开',
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
  weddingCardAiMusic: {
    playStartLabel: '从此处开始播放',
    playEndLabel: '结束 / 循环点',
    playStartPlaceholder: '留空或 0 · 30 · 1:30（留空 = 整首从头播）',
    playEndPlaceholder: '留空 = 播到结尾，不裁剪',
    segmentHint:
      '两个都不填则按原曲从头播到尾。填写后表示区段：秒（30）或 分:秒（1:30）。若填写结束时间，则在该片段内循环。保存后生效。',
    useCurrentPlaybackAsStart: '将当前播放位置设为开始点',
    playbackLoadFailed: '音乐无法加载（文件可能不存在）。请柬主人请在编辑页重新上传背景音乐。',
    publicFabPauseAria: '关闭请柬背景音乐',
    publicFabPlayAria: '播放请柬背景音乐',
    publicMapEmbedTitle: '婚礼场地地图',
  },
  weddingCardCalendar: {
    sectionTitle: '婚礼信息',
    introLine: '婚礼将于以下时间举行：',
    receptionLabel: '迎宾',
    partyLabel: '开席',
    timePlaceholderDash: '—',
  },
  weddingGiftBox: {
    boxTitle: '礼金盒',
    tapToOpen: '点击打开',
    dialogTitle: '贺礼 — 扫描 VietQR',
    brideSection: '新娘',
    groomSection: '新郎',
    accountHolder: '开户姓名',
    accountNumber: '账号',
    bankSelectPlaceholder: '选择银行',
    vietqrFooterNote: '请使用手机银行 App 扫描（VietQR）。',
    closeButton: '关闭',
    envelopeButtonAria: '打开礼金盒查看二维码',
    editorHint:
      '开启后：分别为新娘与新郎填写银行、账号与户名，用于生成两个 VietQR。或在下方填写一张二维码图片链接（旧方式）。',
    legacyImageLabel: '单张二维码图片 URL（可选）',
    legacyImageDesc: '不使用上方双 VietQR 时可用；页面只显示一张码。',
    saveNeedConfig: '已启用礼金 QR：请填完两组 VietQR（新娘+新郎），或填写二维码图片 URL。',
    qrAltBride: '转账 QR — 新娘',
    qrAltGroom: '转账 QR — 新郎',
    qrAltLegacy: '贺礼 QR',
  },
  weddingCardAiBrief: {
    step2Description:
      '编辑内容与预览均为免费。约 1 秒后自动保存；您仍可手动按「保存」立即保存。',
    autoSavedLabel: '已自动保存',
    autoSaveFailedLabel: '未能自动保存。请检查网络或按下「保存」。',
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
    openCreatedExamsListButton: '打开已创建测验列表',
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
    homeworkPageTitle: '创建家庭作业',
    homeworkPageSubtitle:
      '与在线测验相同步骤（科目、班级、题目、二维码/链接），但不必凑满100分；学生提交后不显示成绩。',
    defaultHomeworkTitle: '家庭作业',
    homeworkCreatedBadge: '已创建家庭作业',
    createHomework: '创建家庭作业',
    createAnotherHomework: '再创建一份家庭作业',
    createdHomeworkListTitle: '已创建的家庭作业',
    createdHomeworkHint: '用链接或二维码让学生作答；可像测验一样挂到其他班级。',
    openCreatedHomeworkListButton: '查看家庭作业列表',
    homeworkCreateSuccess: '已创建家庭作业',
    homeworkCreateSuccessDesc: '请将链接或二维码发给学生。',
    homeworkEssayNo100Note:
      '可按需选择问答题。学生提交后看不到分数；无需设置每题时间或分值。',
    homeworkCardInfo: '家庭作业信息',
    homeworkFormCardDescription:
      '选择学科、班级与教纲中的题目。无需设置考试时长或分值 — 系统保存作答，学生不查看分数。',
    homeworkTitlePlaceholder: '数学家庭作业 — 复习',
    homeworkQuizPartFooterHint:
      '填写各难度题目数量，再在下方勾选对应数量的题目。家庭作业无需在此设置分钟或分值。',
    noHomeworkSessionsYet: '暂无家庭作业。',
    homeworkCreatedResultLine: '{count} 道题',
    homeworkSummaryMc: '选择题：{count} 道',
    homeworkSummaryEssay: '问答题：{count} 道',
    homeworkDeleteConfirm: '确定删除这份家庭作业吗？此操作不可撤销。',
    homeworkDeleted: '已删除',
    homeworkDeletedDesc: '已删除家庭作业。',
  },
  adminWorksheetVerify: {
    pageTitle: '作业单核验报告',
    pageDescription:
      '主要用于查看自动核验（cron）各次运行的报告：排队/已处理作业单数、核验标记与内容修正次数；展开行可看每张作业单明细。需要时也可点此「开始新扫描」在服务器上手动分批执行。',
    reportScopeNote:
      '在课程创建流程中每次后台核验也会写入此列表（需服务器已正确配置后台核验）。若之前只有批量/cron 才会出现记录，请检查服务器环境后重新触发一次核验。',
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
    inviteFriends: '友達を招待',
    viewPlan: 'プランを見る',
    topUpCredits: 'クレジットをチャージ',
    tasksHub: 'タスクとキュー',
    supportChat: 'サポートチャット',
    partnerInbox: 'ビジネスチャネル',
    partnerApiIntegration: 'API 連携（店主）',
    customerApiKeys: 'AI プラットフォーム利用',
    myChats: '店舗とのメッセージ',
    myOrders: '自分の注文',
    downloadApp: 'アプリを入手',
    downloadAppSubtitle:
      'Web アプリ（PWA）です。ホーム画面に追加してネイティブのように使えます。Android は Chrome、iPhone/iPad は Safari を使ってください。',
    downloadAndroidTitle: 'Android（Chrome）',
    downloadAndroidChromeHint:
      'Chrome のメニューに「アプリをインストール」や「ホーム画面に追加」が表示されることがあります。',
    downloadAndroidStep1: 'Chrome で NanoAI（nanoai.vn）を開きます。',
    downloadAndroidStep2: '右上のメニュー ⋮（縦の 3 点）をタップします。',
    downloadAndroidStep3: '「アプリをインストール」または「ホーム画面に追加」を選び、確認します。',
    downloadIosTitle: 'iPhone / iPad',
    downloadIosSafariHint: 'Safari の利用を推奨します。',
    downloadIosStep1: 'Safari で NanoAI（nanoai.vn）を開きます。',
    downloadIosStep2: '画面下のツールバーで「共有」（上向き矢印の四角）をタップします。',
    downloadIosStep3: '「ホーム画面に追加」を選び、「追加」をタップします。',
  },
  referral: {
    pageTitle: '友達招待 – クレジット獲得',
    metaDescription:
      'NanoAI を共有。リンク経由で新規登録があると、紹介者であるあなたにのみ 2 クレジット。',
    headline: '友達に NanoAI を紹介',
    description:
      '専用リンクをコピー。新規ユーザーがそのリンクから登録・参加すると（アカウント作成から 30 日以内）、あなたに 2 クレジット。被招待者 1 人につき 1 回。',
    yourLinkLabel: 'あなたの招待リンク',
    copyButton: 'リンクをコピー',
    copied: 'コピーしました',
    howItWorksTitle: '仕組み',
    step1: '紹介コード付きリンクを友達に送ります。',
    step2: '相手がリンクを開き、アカウント作成から 30 日以内に NanoAI に登録／ログインします。',
    step3: '招待したあなたに 2 クレジットを付与します。被招待者には本紹介プログラムのクレジットはありません。',
    bonusNote: '条件を満たす新規アカウントのみ紹介者への報酬の対象。被招待者は 1 人 1 回まで。',
    inviteVisualYou: 'あなた（紹介者）',
    inviteVisualFriend: '被招待者',
    inviteeNoReferralCredit: '紹介クレジットなし',
    errorGeneric: 'いま紹介ボーナスを適用できません。しばらくしてからお試しください。',
  },
  accountPlan: {
    pageTitle: 'ご利用プラン',
    metaDescription:
      '7 日間の無料トライアルと教材の月額アクセスを確認。英語 AI は回・レッスンごとに課金。AI クレジットは別途。',
    headline: '現在のプラン',
    billingPeriod: '月額の対象期間（ベトナム暦）：{period}',
    trialSectionTitle: '無料トライアル',
    trialActiveLine: 'トライアル中です。下記の教材の月額料はまだかかりません。',
    trialTotalDaysNote: 'トライアル期間：登録から {days} 日間。',
    trialDaysLeft: '残り約 {days} 日。',
    trialEndsAtLine: 'トライアル終了（目安）：{datetime}',
    trialNotActive:
      '初回 7 日のトライアルは終了しています。教材の月額は該当する期ごとにクレジットで支払われます。',
    servicesSectionTitle: '教材 — 月額（クレジット）',
    productEnglishCoach: '英語 AI 学習',
    englishCoachPayPerLesson:
      '月額はありません。セッションやレッスン開始時に都度クレジットが減ります（金額は学習画面に表示）。',
    productCurriculum: '教材・問題作成',
    statusViaTrial: 'トライアル中 — 月額は未請求。',
    statusAccessOn: '現在このサービスにアクセスできます。',
    statusPaidMonth: '期間 {period} の月額を差し引き済み。',
    statusPendingPayment: '未請求 — 期間 {period} に {credits} クレジットが必要です。',
    noteSignupBonus: '登録時に {credits} クレジットを進呈（AI 用。月額とは別）。',
    noteAiCredits: 'AI を使う機能では、都度 AI クレジットが減ります。',
    refresh: '更新',
    loading: '読み込み中…',
    errorLoad: 'プラン情報を読み込めませんでした。更新してください。',
    errorConfig: 'サーバー設定が不完全です。しばらくしてからお試しください。',
    monthlyCostLine: '期間あたり {credits} クレジット · 目安 {vnd}₫',
    backDashboard: 'ダッシュボードへ',
    linkWallet: 'ウォレットでチャージ',
  },
  push: {
    bannerTitle: 'スマホで通知を受け取る',
    bannerHint:
      'NanoAI をアプリ（PWA）として利用中です。通知をオンにすると、アプリを閉じていても入金・特典・報告の処理などのお知らせを受け取れます。',
    enable: '通知をオン',
    later: 'あとで',
    enabledToast: 'プッシュ通知を有効にしました',
    bellEnableHint: 'アプリ内のお知らせとシステム通知は別です。NanoAIを閉じていても届くようにプッシュをオンにしてください。',
    bellEnableButton: 'プッシュ通知をオン',
    bellSubscribedShort: 'この端末ではプッシュ通知がオンです',
    bellDeniedHint: '通知がブロックされています。ブラウザの設定で NanoAI の通知を許可してください。',
    bellSyncHint: '通知は許可済みですが、この端末が未登録です。同期をタップしてください。',
  },
  supportChat: {
    pageTitle: 'サポートチャット',
    metaDescription:
      'NanoAI チームにメッセージ。Webhook を設定すると Facebook Messenger・Zalo OA と同期できます。',
    brandBadge: 'NanoAI',
    headline: 'チャットでサポート',
    subline:
      'このページのメッセージはカスタマーケアの受信箱に集約されます（サーバー側で Facebook / Zalo と連携した場合）。',
    loginRequired: 'サポートに送るにはログインしてください。',
    loginSupportingLine: 'NanoAI のアカウントでログインすると、この画面からメッセージを送れます。',
    loginLink: 'ログイン',
    placeholder: 'メッセージを入力…',
    send: '送信',
    emptyThread: 'まだメッセージがありません。下から最初の質問を送ってください。',
    loadError: '会話を読み込めませんでした。',
    sendError: '送信に失敗しました。',
    pollNote: '管理者の返信は数秒遅れる場合があります。ページを更新しても構いません。',
    sendKeyboardHint: 'Enter で送信 · Shift+Enter で改行',
    messageProductCardOpenProduct: '商品ページを開く',
    messageProductCardViewDetails: '詳細を見る',
  },
  customerCareAdmin: {
    pageTitle: 'カスタマーケア',
    pageDescription:
      'NanoAI プラットフォーム向けの受信箱のみ（サポートチャットおよびプラットフォーム連携の Facebook/Zalo）。各ショップの受信箱は「ダッシュボード → メッセージ」、お客様としての店舗とのチャットは「マイメッセージ」— 混在しません。',
    inboxTitle: '会話（プラットフォーム）',
    pickConversation: '会話を選ぶとメッセージが表示されます。',
    replyPlaceholder: '返信を入力…',
    send: '送信',
    refresh: '更新',
    channelFacebook: 'Facebook',
    channelZalo: 'Zalo',
    channelInternal: 'NanoAI',
    channelWidget: 'Web（埋め込み）',
    unknownUser: 'ゲスト',
    sendFailed: '送信失敗',
    noMessages: 'メッセージはまだありません。',
    sendKeyboardHint: 'Enter で送信 · Shift+Enter で改行',
    messageProductCardOpenProduct: '商品ページを開く',
    messageProductCardViewDetails: '詳細を見る',
  },
  partnerMessaging: {
    pageTitle: 'パートナー向けメッセージ',
    pageDescription:
      'お店用のワークスペース：Facebook ページ、Zalo OA、NanoAI 上のチャット、またはサイト埋め込み API からのお客様を一つの受信箱で管理。',
    cardTitle: 'お客様受信箱（パートナー）',
    cardDescription: 'Facebook、Zalo、NanoAI のWebチャット、埋め込みチャットを同一受信箱で管理。',
    createWorkspace: 'メッセージワークスペースを作成',
    workspaceNameLabel: '店舗 / ブランド名',
    workspaceLabel: 'ワークスペース',
    createButton: '作成',
    saveOk: '保存しました。',
    channelsSection: 'チャネル（Facebook と Zalo）',
    fbPageId: 'Facebook Page ID',
    fbPageToken: 'ページアクセストークン',
    fbVerifyToken: '検証トークン（Webhook GET）',
    saveFacebook: 'Facebook を保存',
    zaloSecret: 'Webhook シークレット（ヘッダー）',
    zaloToken: 'OA アクセストークン',
    saveZalo: 'Zalo を保存',
    embedSection: '自サイト向け匿名埋め込み API（任意）',
    embedHint:
      'ショップのドメインから API を呼び出します（CORS 許可）。各ブラウザは localStorage の固定 UUID を X-Session-Id で送ります。',
    embedHeadersHelp:
      'ヘッダーに X-Embed-Key（上記のキー）と X-Session-Id（訪問者ブラウザの固定 UUID）を付与してください。',
    embedAnonymousFootnote:
      'NanoAI のログインは使いません。店舗側は本人を特定できず、Google アカウントとも連携しません。NanoAI を直接開くのと同じログイン（「自分のメッセージ」含む）にするには、上のリンクか iframe を利用してください。',
    inboxTitle: 'お客様スレッド',
    inboxSearchPlaceholder: '名前またはメッセージで検索…',
    inboxNoSearchResults: '該当する会話がありません。',
    inboxSideInfoTab: '情報',
    inboxSideOrderTab: '注文作成',
    inboxSideNoNotes: 'メモはまだありません',
    inboxSideNotePlaceholder: 'メモを入力（Enter で保存）',
    inboxSideOrderEmpty: '注文履歴はまだありません',
    inboxSideCreateOrder: '注文を作成',
    pickConversation: '会話を選択してください。',
    replyPlaceholder: '返信を入力…',
    send: '送信',
    refresh: '更新',
    channelFacebook: 'Facebook',
    channelZalo: 'Zalo',
    channelWidget: 'Web',
    unknownUser: 'ゲスト',
    noMessages: 'メッセージはまだありません。',
    inboxShopDrafting: '店舗が返信を入力中です',
    replyKeyboardHint: 'Enter で送信 · Shift+Enter で改行 · Ctrl+V / Cmd+V で画像を貼り付け',
    messageProductCardOpenProduct: '商品ページを開く',
    messageProductCardViewDetails: '詳細を見る',
    partnerAttachPhoto: 'ライブラリ',
    partnerTakePhoto: 'カメラで撮影',
    partnerRemoveAttachmentAria: '添付画像を削除',
    partnerCaptionHint: '送信前に下にキャプションを追加できます。',
    partnerUploading: '画像をアップロード中…',
    partnerImageTooLarge: '画像が大きすぎます（最大約 3 MB）。',
    partnerImageInvalidType: '対応していない画像形式です。',
    nanoaiHostedSection: 'NanoAI 上でチャット — 直接利用と同じログイン（推奨）',
    nanoaiHostedHint:
      'お客様は NanoAI で Google ログインが必要で、プラットフォームを直接使う場合と同じです。同一アカウントで端末間同期し、/messaging/my-chats で店舗一覧を確認できます。スレッドは従来どおり受信箱に表示されます。',
    nanoaiHostedUrlLabel: 'チャットリンク',
    nanoaiHostedIframeTitle: '自サイトへの埋め込み（iframe）',
    nanoaiHostedIframeTitleAttr: 'NanoAI チャット',
    nanoaiHostedIframeHelp:
      'HTML に貼り付けます。お客様は NanoAI の枠内でチャット・ログイン（ファーストパーティ Cookie）し、匿名 API には依存しません。',
    copyHostedChatLinkButton: 'チャットリンクをコピー',
    hostedChatLinkCopiedToast: 'チャットリンクをコピーしました。',
    copyIframeSnippetButton: 'iframe コードをコピー',
    iframeSnippetCopiedToast: 'iframe コードをコピーしました。',
    integrationSectionTitle: '計測タグと埋め込みコード',
    integrationSectionHint:
      'Google タグ、Facebook Pixel、チャット埋め込みコードを貼り付けるためのエリアです。下で NanoAI チャットの埋め込みコードをすぐコピーできます。',
    googleTagLabel: 'Google タグ（GA4 / GTM）',
    googleTagPlaceholder: '例: G-XXXXXXXXXX または GTM-XXXXXXX',
    facebookPixelLabel: 'Facebook Pixel / Meta Pixel',
    facebookPixelPlaceholder: '例: 123456789012345',
    metaConsultTrackingSection: 'Meta Pixel と Conversions API（商品相談ページ）',
    metaConsultTrackingHint:
      'お客様が商品ごとの相談リンク（/tu-van/… または ?ctx_inventory= 付きチャット）を開くと、Pixel とサーバーに同じ ViewContent を送信します（event_id で重複排除）。',
    metaConsultCapiTokenLabel: 'Conversions API アクセストークン（サーバー）',
    metaConsultCapiTokenPlaceholder: 'Meta Events Manager のトークンを貼り付け',
    metaConsultCapiConfiguredBadge: '保存済み',
    metaConsultCapiSavedHint:
      '保存後、フィールドは空のままです（再表示しません）。トークンはサーバーに残ります。差し替えるときだけ貼り付け、Pixel ID だけ変える場合は空のままにしてください。',
    metaConsultSaveButton: 'Pixel と CAPI を保存',
    shopGa4MeasurementLabel: 'Google Analytics 4（GA4）測定 ID',
    shopGa4MeasurementHint:
      'G-… を入力すると相談/ショップページの訪問を計測します。GA4 の「レポート → リアルタイム」で現在のユーザー数を確認できます。',
    shopGa4MeasurementPlaceholder: '例: G-XXXXXXXXXX',
    shopGa4InvalidIdToast: 'GA4 ID の形式が正しくありません。形式: G-XXXXXXXXXX',
    shopGa4SaveButton: 'GA4 ID を保存',
    facebookCatalogFeedTitle: 'Facebook — 商品カタログフィード（CSV）',
    facebookCatalogFeedHint:
      'Commerce Manager のデータソース URL に貼り付けます。link は NanoAI の相談ページで、店舗サイトの URL ではありません。画像 URL と VND 価格が必要です。key は埋め込みキーなので秘密にしてください。',
    facebookCatalogFeedCopyButton: 'フィード URL をコピー',
    facebookCatalogFeedCopiedToast: 'フィード URL をコピーしました。',
    nanoaiEmbedCodeLabel: 'NanoAI チャット埋め込みコード',
    facebookChatEmbedCodeLabel: 'Facebook チャット埋め込みコード',
    zaloChatEmbedCodeLabel: 'Zalo チャット埋め込みコード',
    embedCodePlaceholder: 'script / iframe / プラグインコードをここに貼り付け…',
    copyNanoaiEmbedButton: 'NanoAI チャットコードをコピー',
    copyFacebookChatEmbedButton: 'Facebook チャットコードをコピー',
    copyZaloChatEmbedButton: 'Zalo チャットコードをコピー',
    addAnotherWorkspace: 'ワークスペースを追加',
    cancelAddWorkspace: 'キャンセル',
    deleteWorkspaceButton: 'ワークスペースを削除',
    deleteWorkspaceConfirm: '警告: このワークスペースを削除すると元に戻せません。確認のため "XOA" と入力してください。',
    deleteWorkspaceSuccess: 'ワークスペースを削除しました。',
    deleteWorkspaceOtpIntro:
      'Your workspace will be scheduled for deletion after a grace period. While waiting, the shop will not accept customer messages. We will email a one-time code to your login address.',
    deleteWorkspaceOtpSend: 'Send OTP email',
    deleteWorkspaceOtpLabel: 'OTP code (6 digits)',
    deleteWorkspaceOtpConfirm: 'Confirm scheduled deletion',
    deleteWorkspaceScheduledBanner:
      'This workspace is scheduled for deletion and is not accepting inbound messages. You can cancel from Messaging settings before the deadline.',
    deleteWorkspaceCancelSchedule: 'Cancel deletion schedule',
    deleteWorkspaceOtpSentToast: 'OTP sent to your email.',
    deleteWorkspaceScheduleCancelled: 'Scheduled deletion cancelled.',
    teamStaffSectionTitle: 'ワークスペースのメンバー',
    teamStaffSectionHint:
      'NanoAI のログインメールで招待してください。権限は最小限にし、決済情報など機密機能は十分信頼できる人のみに許可しましょう。',
    badgeStaffWorkspace: '招待済み',
    teamInviteEmailLabel: 'ログインメール',
    teamInviteEmailPlaceholder: 'user@example.com',
    teamInviteButton: '招待',
    teamStaffListTitle: 'メンバー一覧',
    teamRemoveMember: '削除',
    teamSavePermissions: '権限を保存',
    teamInviteErrorNotFound:
      'このメールのユーザーが見つかりません。招待先には NanoAI のアカウントと確認済みメールが必要です。',
    teamInviteErrorBadEmail: 'メールの形式が正しくありません。',
    teamInviteErrorOwner: 'このワークスペースのオーナーは招待できません。',
    teamInviteOk: '招待しました。',
    teamStaffRestrictedNote:
      'スタッフ権限です。決済や埋め込み API・ワークスペース削除などの重要設定は店主のみ変更できます。',
    teamPermInbox: '受信箱',
    teamPermOrders: '注文',
    teamPermInventory: '在庫',
    teamPermAiSettings: 'AI 設定',
    teamPermWorkspaceBranding: 'ブランド／ロゴ',
    teamPermWorkspacePayment: 'チャット内決済',
    teamPermIntegrationsChannels: 'Facebook / Zalo チャネル',
    teamPermIntegrationsAnalytics: 'Meta Pixel／GA4／カタログ',
    teamPermUsageReports: '利用レポート',
    integrationsAnalyticsOwnerOnly:
      'Pixel、Conversions API、GA4 の保存はワークスペースの店主のみできます。',
    teamRemoveMemberConfirm: 'このメンバーをワークスペースから外しますか？',
    fbLinkedLine: 'Facebook Page を連携済み: {pageId}',
    zaloLinkedLine: 'Zalo OA の webhook とトークンを保存済みです。',
    credentialsKeepHint:
      '変更しないトークンやシークレットは空欄のままにしてください。保存済みの値が使われます。',
    setupColumnTitle: 'チャネルと AI アシスタント',
    chatColumnTitle: 'お客様チャット',
    messagingSettingsLink: 'チャネル・AI 設定',
    messagingSettingsPageTitle: 'メッセージ設定（店舗）',
    messagingInboxDescription: '左に顧客一覧。会話を開くと、入力欄は画面下に固定されます。',
    noWorkspaceInboxCta: 'メッセージ用ワークスペースがありません。設定で店舗を作成し Facebook / Zalo / チャットを接続してください。',
    goToInbox: '受信箱へ',
    inboxMobileBackAria: '会話一覧に戻る',
    apiIntegrationGuideLink: 'API 連携ガイド（キーとエンドポイント）',
    apiIntegrationGuideShort: '店舗サイト連携向け：埋め込みチャット、画像検索、B2B 試着 API。',
    messagingSettingsApiHubCardTitle: '埋め込みチャットと API',
    messagingSettingsApiHubCardBody:
      'ホスト URL、iframe スニペット、埋め込みエンドポイント、キー、開発者向けドキュメントは「API 連携」ページに移しました — 本設定画面には表示しません。',
    customerCareShopSetupGuideTitle: 'カスタマーケア店舗の作成手順',
    customerCareShopSetupGuideBody:
      '手順 1 — ダッシュボード → メッセージ → チャネル・AI 設定（このページ）を開きます。\n\n手順 2 — 「メッセージワークスペースを作成」に表示名・ブランド名・業種を入力します。ロゴは URL の入力または画像アップロードが可能です。\n\n手順 3 — 「作成」をクリックします。これが店舗ワークスペースです。Facebook ページ、Zalo OA、NanoAI 上のチャット、サイト埋め込みチャットのメッセージはすべて同じ受信箱に入ります。\n\n手順 4 — 続けてチャネル（Facebook/Zalo）を接続し、ホストされたチャットリンクまたは iframe コードをコピーし、同じ設定画面で AI アシスタントや在庫を任意で有効にします。',
  },
  partnerMessagingOrders: {
    pageTitle: 'チャット注文の管理',
    pageDescription: 'チャットウィジェットから作成された注文一覧です。',
    introLine: 'チャットで作成した注文を追跡し、必要に応じて手動確認し、ステータスを更新します。',
    allWorkspaces: 'すべてのワークスペース',
    allStatuses: 'すべてのステータス',
    searchPlaceholder: '注文番号 / 顧客名 / 電話 / 商品で検索',
    exportExcel: 'Excel に出力',
    exportExcelTitle:
      'ワークスペース・ステータス・日付範囲（任意）に一致する注文をすべて出力（クイック検索は対象外）。',
    reload: '再読み込み',
    filterCreatedFrom: '開始日',
    filterCreatedTo: '終了日',
    summaryTitle: 'フィルター別サマリー（ワークスペース + ステータス + 注文日）',
    summaryDescription:
      '条件に一致する注文の全体（下の一覧の 200 件制限なし）。日付はベトナム時間・注文作成日。両方空欄で日付制限なし。クイック検索はこのページの表示のみ絞り込み、ここの数値は変わりません。',
    statOrders: '注文件数',
    statSubtotal: '商品計',
    statSubtotalHint: '小計の合計',
    statRequired: '手付金 / 請求額',
    statRequiredHint: '注文ごとの設定に従う',
    statPaid: '入金済（記録）',
    statPaidHint: '顧客振込 / システム記録',
    statOutstanding: '未収（見積）',
    statOutstandingHint: '未キャンセル: max(0, 商品代 − 入金)',
    statusAwaitingPayment: '入金待ち',
    statusPaymentChecking: '照合中',
    statusPaidVerified: '入金確認済',
    statusPendingManualReview: '手動確認要',
    statusCancelled: 'キャンセル',
    emptyList: '注文はまだありません。',
    emptyFiltered: '条件に一致する注文がありません。',
    shippingPending: '未確認',
    shippingConfirmed: '注文確認済',
    shippingPacking: '梱包中',
    shippingShipping: '配送中',
    shippingDelivered: '配達完了',
    shippingReturned: '返品・返金',
    shippingCancelled: 'キャンセル',
    proofVerified: '証憑: 一致',
    proofManualReview: '証憑: 手動確認',
    proofFailed: '証憑: 不一致',
    proofPending: '証憑: 処理中',
    proofNone: '証憑: なし',
    labelWorkspace: 'ワークスペース',
    labelCustomer: '顧客',
    labelEmail: 'メール',
    labelAddress: '住所',
    labelProduct: '商品',
    labelMoneyPrefix: '金額',
    moneyLine: '小計 {subtotal} · 請求 {required} · 記録 {paid}',
    openProduct: '商品を開く',
    openProofImage: '証憑画像を開く',
    openInbox: '受信箱を開く',
    openChat: 'チャットを開く',
    orderLocked: '注文ロック済',
    notePlaceholder: '確認メモ / 理由（任意）',
    btnConfirmPaid: '入金を確認',
    btnMarkManualReview: '手動確認が必要にする',
    btnCancelOrder: '注文をキャンセル',
    btnViewTimeline: 'タイムライン',
    timelineTitle: '注文タイムライン',
    timelinePickOrder: '左の一覧で注文を選ぶとイベント履歴が表示されます。',
    timelineNoEvents: 'イベントはまだありません。',
    timelineLoading: '履歴を読み込み中…',
    toastStatusUpdated: '注文ステータスを更新しました。',
    toastShippingUpdated: '配送を更新しチャットに通知しました。',
    toastExportDone: '{count} 件をダウンロードしました（{filename}）。',
    depositNone: '未入金',
    depositPartial: '一部入金',
    depositFull: '手付け済み',
    pathSepay: '{shop}（自動）',
    pathManual: '銀行振込・領収写真',
    sepayAutoHint: '{shop} のシステムで自動照合 — 取引画像は不要です。',
    proofReceiptShortVerified: '領収：一致',
    proofReceiptShortPending: '領収：処理中',
    proofReceiptShortFailed: '領収：不一致',
    proofReceiptShortManual: '領収：要確認',
    proofReceiptShortNone: '領収：なし',
    tabAll: 'すべて',
    tabAwaitDeposit: '入金待ち（手付）',
    tabAwaitShip: '発送待ち',
    tabAwaitReceive: '受取待ち',
    tabReceived: '受取済み',
    tabReviewed: 'レビュー済み',
    tabCancelled: 'キャンセル',
    tableColOrderCode: '注文番号',
    tableColConsulted: '相談済',
    tableColCustomer: 'お客様',
    tableColSubtotal: '商品合計',
    tableColDepositRequired: '手付金（請求）',
    tableColPaidAmount: '入金済',
    tableColDueOnDelivery: '着払い残高',
    tableColStatus: 'ステータス',
    tableColOrderDate: '注文日時',
    tableColActions: '操作',
    filterShippingLabel: '配送ステータス',
    filterPaymentShort: '支払い状態',
    clearTableFilters: 'フィルターをクリア',
    consultedAria: '相談済（このブラウザのみ保存）',
    reviewedAria: 'レビュー済（このブラウザのみ保存）',
    expandRow: '展開',
    collapseRow: '折りたたむ',
    listCapNote: 'ワークスペースと日付の条件で、最新 200 件まで表示します。',
    consultLocalHint: 'このブラウザにのみ保存。端末間では同期されません。',
    badgePayAwaiting: '支払い待ち',
    badgePayPartial: '手付済',
    badgePayDone: '支払い完了',
    btnConfirmDeposit: '手付を確認',
    tableDetails: '詳細',
    modalTitle: '注文の詳細',
    modalInternalIdLine: '内部注文 ID: {id}',
    modalConsultedCustomer: '顧客へ相談連絡済み',
    modalPaymentHeading: 'お支払い',
    modalOrderTotal: '注文合計',
    modalDepositNeed: '必要額',
    modalDepositDeposited: '入金済（手付）',
    modalCodAfterDeposit: '受取時のお支払い額（手付控除後）',
    modalProductsHeading: '商品',
    modalColImage: '画像',
    modalColProduct: '商品',
    modalCopyAddress: 'コピー',
    toastAddressCopied: '住所をコピーしました',
    toastAddressCopyFailed: '住所をコピーできませんでした',
    modalSkuPrefix: 'SKU（ID）:',
    modalColor: '色',
    modalSize: 'サイズ',
    modalQty: '数量',
    modalOrderUnavailable: '現在の一覧に注文がありません。再読み込みするか閉じてください。',
    modalOrderNoteLabel: '注文メモ',
    modalShippingAddressHeading: 'お届け先住所',
    modalContactSectionTitle: 'お客様・注文の対応',
  },
  partnerMessagingAi: {
    panelTitle: 'AI 自動返信',
    panelSubtitle:
      'お客様の発言のあと、設定した時間だけ手動返信を待ちます；時間切れでも未返信なら、店舗ポリシー・トーン・在庫リストに基づき AI が返答します（一部メッセージは LLM 以外の処理）。',
    tabSettings: '設定',
    tabInventory: '在庫商品',
    tabUsage: 'API トークン',
    usagePeriodLabel: '期間',
    usagePeriodDay: '日',
    usagePeriodWeek: '週',
    usagePeriodMonth: '月',
    usagePeriodScopeDay: '過去 24 時間',
    usagePeriodScopeWeek: '過去 7 日間',
    usagePeriodScopeMonth: '過去 30 日間',
    usageRangeModeLabel: '表示',
    usageRangeModeRolling: 'ローリング',
    usageRangeModeCalendar: '日付指定（UTC）',
    usageCalendarFromLabel: '開始',
    usageCalendarToLabel: '終了',
    usagePeriodScopeCalendar: '{from}〜{to}（UTC・両端含む）',
    usageSectionCreditTitle: 'クレジット控除（ウォレットとロゴ）',
    usageSectionCreditIntro:
      '残高からの控除として記録されるもの：ウォレット台帳（カリキュラム、English coach など）と店舗ロゴの正規化 — 下の API トークン集計とは別です。',
    usageSectionApiTitle: 'API 利用（トークン / 画像 / 埋め込み）',
    usageSectionApiIntro:
      '受信トレイ LLM、Nano Banana 画像、画像/テキスト埋め込み、商品画像からの素材推定など — usage ログに基づき、上のウォレット経路とは別に集計します。',
    tokenUsageIntro:
      '{scope}の集計です。各行は待機時間後に LLM で返信したときの API モデルです。',
    tokenUsageEmpty: 'この期間に LLM 呼び出しはまだありません。',
    tokenUsageColProvider: 'プロバイダー',
    tokenUsageColModel: 'モデル',
    tokenUsageColCalls: '呼び出し回数',
    tokenUsageColPrompt: '入力トークン',
    tokenUsageColCompletion: '出力トークン',
    tokenUsageColTotal: '合計トークン',
    tokenUsageColEstimatedCost: '見積 (₫)',
    tokenUsageCostDisclaimer:
      'Gemini Developer API 基準の USD/100万トークン換算の目安（一部モデルは1リクエストで prompt>20万の段階料金）。集計行は低めの段階で近似。未登録は gemini-3-flash-preview。為替は PARTNER_AI_TOKEN_COST_USD_TO_VND。',
    tokenUsageEstimatedTotalLabel: '見積合計（約 {amount} ₫）',
    tokenUsageDetailEstimatedTotalLabel: '明細行の合計（約 {amount} ₫）',
    tokenUsageByKindTitle: '呼び出し種別（usage_kind）',
    tokenUsageByKindIntro:
      'LLM トークン記録の集計：受信トレイ、素材推定、受信トレイ画像生成など。',
    tokenUsageByDayTitle: '日別（UTC）',
    tokenUsageByDayIntro: 'UTC の暦日ごとの呼び出し回数とトークン合計。',
    tokenUsageColDay: '日付（UTC）',
    tokenUsageCostByKindAndModelTitle: '分岐とモデル別の内訳',
    tokenUsageCostByKindAndModelIntro:
      '各行は usage_kind + モデルの組；見積 (₫) は集計トークンから算出。',
    tokenUsageCostByWeekTitle: '週別（UTC・月曜始まり）',
    tokenUsageCostByWeekIntro:
      '選択範囲内の日を UTC 週にまとめます（週は月曜開始）。',
    tokenUsageColWeekStart: '週の開始（UTC）',
    tokenUsageCostByMonthTitle: '月別（UTC）',
    tokenUsageCostByMonthIntro: '選択範囲内を UTC 暦月 (YYYY-MM) でまとめます。',
    tokenUsageColMonthUtc: '月（UTC）',
    tokenUsageCostTablesNote:
      '分岐・日・週・月（UTC）ごとの見積費用 (₫) 列を表示します。期間合計と同じ計算式です。',
    usageDetailApiTitle: 'LLM 呼び出しごとの詳細（受信トレイ）',
    usageDetailApiIntro:
      '各行は待機時間後の 1 回の API 呼び出しと実トークンです。',
    usageDetailColTime: '日時',
    usageDetailColUsageKind: '種別',
    usageTokenKindInbox: '受信トレイ LLM',
    usageTokenKindMaterialInfer: '素材推定（商品画像）',
    usageDetailEmpty: 'この期間に詳細レコードはありません。',
    usageCreditLedgerTitle: 'クレジット控除（ウォレット台帳 — べき等な spend）',
    usageCreditLedgerIntro:
      'アカウントに記録される利用（例：カリキュラム、English coach）。下の受信トレイ API トークン集計とは別です。',
    usageCreditLedgerEmpty: 'この期間に控除はありません。',
    usageCreditColType: '種別 (charge_type)',
    usageCreditColAmount: '合計クレジット',
    usageCreditColCount: '回数',
    usageCreditDetailTitle: '直近の控除イベント',
    usageCreditColWhen: '日時',
    usageCreditColSingle: 'クレジット',
    usageLogoCreditTitle: 'ロゴ正規化（ショップワークスペース）',
    usageLogoCreditIntro:
      'ブランドロゴの生成・編集時に直接クレジットを控除します。上の spend 台帳とは経路が異なります。',
    usageLogoCreditEmpty: 'この期間に控除のあるロゴ正規化はありません。',
    usageLogoColModel: 'モデル',
    usageLogoColStatus: '状態',
    usageNoOwnerHint:
      'ワークスペースにオーナーアカウントが紐付いていないため、ウォレットの控除台帳を表示できません。',
    usageEmbedImageTitle: '画像埋め込み（Gemini）',
    usageEmbedImageIntro:
      '商品画像の embedContent ごと：在庫ベクトル同期（inventory_sync）または顧客が画像送信（guest_image_search）。トークンは Google の usageMetadata を優先、なければ環境変数で推定。',
    usageEmbedImageEmpty: 'この期間に画像埋め込みの記録がありません。',
    usageEmbedTextTitle: 'テキスト埋め込み（Gemini）— 検索ベクトル',
    usageEmbedTextIntro:
      'テキストの embedContent ごと：在庫ベクトル同期（inventory_sync）または顧客メッセージの意味検索（customer_query）。トークンは Google の usageMetadata。',
    usageEmbedTextEmpty: 'この期間にテキスト埋め込みの記録がありません。',
    usageEmbedTextSourceQuery: '顧客メッセージ（意味検索）',
    usageEmbedColSource: 'ソース',
    usageEmbedSourceInventory: '在庫同期',
    usageEmbedSourceGuest: '顧客画像（検索）',
    usageEmbedColPromptSum: 'プロンプトトークン計',
    usageEmbedColTotalSum: '課金トークン計',
    usageEmbedDetailTitle: '呼び出しごとのログ',
    usageEmbedColInventoryId: '在庫行 ID',
    usageImageGenTitle: 'Nano Banana — インボックス画像生成',
    usageImageGenIntro:
      'Nano Banana は内部名称です（モデル gemini-3-pro-image-preview）：素材・色の詳細画像と着用・使用イメージ。新規に生成して在庫に保存した API 呼び出しのみ——上の LLM トークン表と同じ期間。キャッシュ済みは再生成されません。',
    usageImageGenEmpty: 'この期間に Nano Banana の記録はありません。',
    usageImageGenColKind: '種類',
    usageImageGenKindMaterial: '素材・色の詳細',
    usageImageGenKindRealUse: '着用・使用イメージ',
    usageImageGenColCalls: 'API呼び出し回数',
    usageImageGenColTotalTokens: '合計トークン（概算）',
    usageImageGenTotalCallsLabel: '画像生成の合計回数（Nano Banana）',
    usageNanoBananaBadge: 'Nano Banana',
    usageNanoBananaModelHint: 'gemini-3-pro-image-preview · インボックス',
    usageNanoBananaStatCalls: '画像生成呼び出し: {calls}',
    usageNanoBananaStatTokens: '合計トークン（概算）: {tokens}',
    enableLabel: '自動返信を有効にする',
    enableHint: 'オフにすると、手動の返信のみ送信されます。',
    delayLabel: 'AI が返信するまでの待ち時間（秒）',
    delayHint:
      '0〜30 秒：モデル処理が必要な応答をスケジュールする前の待ち（顧客メッセージ後、最大 30；モデル完了後は足しません）。既定 0。先に返信した場合は AI は送りません。',
    typingMinLabel: '入力遅延 最小（ms）',
    typingMaxLabel: '入力遅延 最大（ms）',
    typingHint:
      'LLM を使わず送る自動メッセージ（購入一覧の案内、チャット内購入手順など）の送信前ランダム遅延（0〜30000）。DeepSeek の本文には適用しません。両方 0 でオフ。',
    productConsultationContextLabel: '店舗 AI の文脈・指示',
    productConsultationContextHint:
      'AI が常に参照する内容を1つの欄に入力します。店舗ポリシー、返信トーン、接客方針、購入案内、交換、手付け、配送など。',
    productConsultationContextPlaceholder:
      '例：丁寧で簡潔なトーン。注文前にサイズ表の確認を促す。セール品は返品交換不可。採寸オーダーは50%の手付けが必要。迷っているお客様には押し売りせず、やさしく説明する。',
    disclosureToggle: 'AI である旨を文末に付ける',
    disclosureSuffixLabel: '表示文（メッセージ末尾）',
    disclosureSuffixHint: '各 AI メッセージの末尾に表示し、自動返信であることを示します。',
    saveSettings: '設定を保存',
    loadError: 'AI 設定を読み込めませんでした。',
    faqKeywordsLabel: 'トリガー用キーワード',
    faqKeywordsHint: 'カンマまたは改行で区切ります。',
    faqAnswerLabel: '回答',
    faqSortLabel: '並び順',
    faqActiveLabel: '有効',
    inactiveBadge: 'オフ',
    addFaq: 'FAQ を追加',
    saveRow: '保存',
    deleteRow: '削除',
    cancelEdit: 'キャンセル',
    inventoryName: '商品名',
    inventorySku: 'SKU（任意）',
    inventoryDesc: '仕様・短い説明',
    inventoryStock: '在庫・在庫状況',
    inventoryPrice: '価格（テキスト）',
    inventorySort: '並び順',
    inventoryImageUrl: '商品画像（URL）',
    inventoryImageUrlHint:
      'https:// で始まる公開画像 URL を貼り付け。AI にはテキストとして渡され、必要なら顧客にリンクを送れます。',
    inventoryProductUrl: '商品ページ（URL）',
    inventoryProductUrlHint:
      '店舗サイト上の商品詳細ページ（https://…）。画像検索の結果と Excel の「Link trang sản phẩm」列に使われます。',
    inventoryProductVideoUrl: '商品動画（URL）',
    inventoryProductVideoUrlHint:
      'YouTube の視聴/埋め込み URL、または .mp4 / CDN プレーヤーへの https:// リンク。Excel の動画列と同じです。',
    inventoryOpenProductPage: '商品ページを開く',
    inventoryOpenProductVideo: '動画を開く',
    inventoryGuestConsultLink: '相談チャットを開く',
    inventoryGuestConsultLinkHint:
      '商品画像と文脈付きの NanoAI チャット URL（サイト・QR・広告）。開くと自動で相談メッセージが送られます。',
    inventoryGuestConsultLinkNeedSave: '先に商品を保存するとチャットリンクが揃います。',
    inventoryGuestConsultLinkCopied: 'チャットリンクをコピーしました。',
    inventoryConsultNote: '接客メモ',
    inventoryConsultNoteHint:
      '例：保証12ヶ月、2–3日で発送、10%オフ、不良時のみ交換、○○円以上送料無料 など。',
    inventoryDescHint: 'サイズ、色、素材、寸法、セット内容など。',
    inventoryStockHint: '在庫数、「M/L 在庫あり」「取り寄せ約5日」など。',
    inventoryFieldsGuide:
      '説明または接客メモに：取り扱い色/サイズ、配送目安と送料、セール期限、商品ごとの返品条件、お手入れ方法 など。この一覧の行はすべて AI の顧客返信用コンテキストに含まれます。AI に言及させたくない商品は行を削除するか、インポート対象から外してください。テンプレの「状態」列：1 = 追加/更新、0 = 在庫から削除（SKU または商品名で照合）。',
    inventoryOpenApiLink: 'API 連携ガイド',
    inventoryOpenApiHint:
      '店舗バックエンドから JSON で在庫を NanoAI に同期できます（Open Catalog、Shopee 風フィールド名）。画像検索と同じ Bearer。Vision は不要です。',
    inventoryDownloadTemplate: 'Excelテンプレをダウンロード',
    inventoryExportExcel: 'Excelに出力',
    inventoryImportExcel: 'Excelから取込',
    inventoryImportReplaceWarning:
      'Excel取込：既存の SKU（大文字小文字無視）と一致すれば更新、なければ新規追加。SKU がない行は、SKU なしの既存行と商品名で照合（複数ある場合は在庫の先頭一致を使用）。「状態」列（または is_active）：1 = 追加/更新、0 = 在庫から削除（SKU または商品名が必要）。「並び順」列がなければ表示順はファイルの行順です。ファイルに無い既存商品はそのまま残ります。続行しますか？',
    inventoryImportSuccess: '{count} 行を処理：新規 {inserted}、更新 {updated}、削除 {deleted}。',
    inventoryImportFailed: 'Excelの取込に失敗しました。',
    inventoryExcelImportUploading: 'Excelファイルをアップロード中…',
    inventoryExcelImportSending: 'ファイルを送信中…',
    inventoryErrInvalidXlsx: 'Excel（.xlsx）として読み取れません。',
    inventoryErrEmptySheet: 'シートが空です。',
    inventoryErrMissingName: '商品名列（name）がありません。テンプレを使ってください。',
    inventoryErrNoRows:
      '有効なデータ行がありません（追加/更新には商品名が必要。削除は状態=0かつ SKU または商品名が必要）。',
    inventoryErrNoFile: 'ファイルが選ばれていません。',
    inventoryErrFileTooLarge: 'ファイルが大きすぎます（最大約20MB）。',
    inventoryErrTooManyRows: '行数が多すぎます。1回のインポートは最大 {max} 行です。',
    inventoryLoadMore: 'さらに読み込む（{shown}/{total}）',
    inventoryVectorSearchPlaceholder: '説明を入力（例：ニット、革靴）— 意味検索',
    inventoryVectorSearchHint:
      'テキストベクトル（名前・価格・メモ）または画像の類似。同期と GOOGLE_API_KEY が必要です。',
    inventoryVectorSearchByText: '検索',
    inventoryVectorSearchByImage: '画像',
    inventoryVectorSearchClear: 'フィルタ解除',
    inventoryVectorSearching: '検索中…',
    inventoryVectorSearchFailed: '検索に失敗。API とベクトル同期を確認してください。',
    inventoryVectorSearchNoResults: '該当する商品がありません。',
    addInventory: '商品を追加',
    edit: '編集',
    emptyFaq: '下のよくある質問から選び、店舗の返信文だけ入力してください。',
    emptyInventory:
      '在庫商品がありません。店舗が持っている在庫リストを登録すると、AI はそのリストだけを根拠に案内します。',
    inventoryProductCountSummary: '在庫に {count} 件の商品があります。',
    inventoryEmbeddingTitle: '画像ベクトル進捗',
    inventoryEmbeddingSummary: '完了 {done}/{eligible}。未処理 {pending}。エラー {failed}。',
    inventoryEmbeddingSyncNow: '今すぐ同期',
    inventoryEmbeddingSyncRunning: '同期中...',
    inventoryEmbeddingSyncDoneTitle: '在庫ベクトル同期が完了しました',
    inventoryEmbeddingSyncDoneBody: '{synced}件を処理（画像+テキスト）。失敗 {failed}。',
    inventoryEmbeddingAutoHint:
      'Messaging → AI 設定ページを開いている間、自動で連続バッチ（約1200件ずつ）が走ります。タブを閉じると止まります。常時バックグラウンドで処理する場合は、cron で POST /api/cron/messaging-inventory-embed-backfill（Bearer MESSAGING_INVENTORY_EMBED_CRON_SECRET）を用意してください。.env.example を参照。',
    inventoryTextEmbeddingTitle: 'テキストベクトル進捗',
    inventoryTextEmbeddingSummary: '完了 {done}/{eligible}。未処理 {pending}。エラー {failed}。',
    inventoryTextEmbeddingAutoHint:
      'テキストベクトル（商品名+価格+相談メモ）はチャットの意味検索用です。画像と同じ「今すぐ同期」；ページ表示中は画像またはテキストの未処理がなくなるまで連続実行；cron でバックグラウンド処理。',
    cronSetupHint:
      '本番：GET または POST /api/cron/messaging-partner-ai を Authorization: Bearer MESSAGING_PARTNER_AI_CRON_SECRET で定期実行（例：毎分）し、DEEPSEEK_API_KEY を設定。cron がないとジョブは保留のまま AI は送りません。`next dev` は待機後に自動処理（cron 不要）。ローカルで `next start` かつ cron なしの場合は .env に MESSAGING_PARTNER_AI_DEV_WAKE=1。',
    toggleStatusOn: 'オン',
    toggleStatusOff: 'オフ',
    aiEngineTitle: 'スマート返信 AI',
    aiEngineDescription:
      '待機後、対話には DeepSeek API（モデル {model}）を呼び、在庫とポリシーを反映します。',
    disclosureSwitchOn: '文末に注記',
    disclosureSwitchOff: '注記なし',
    faqPresetsIntro:
      '購入時によくある質問は用意済みです。返信内容を入力し「有効」にすると、お客様の似た表現を多言語で検出します。',
    faqPresetSaveHint: '編集したら項目ごとに保存してください。',
    faqPresetAnswerRequired: '「有効」にするには返信内容が必要です。',
    faqCustomSectionTitle: '店舗独自の質問',
    faqCustomSectionIntro:
      'お店だけのよくある質問を追加：覚えやすい聞き方、一致判定用のキーワード、返信文を入力します。',
    faqCustomAddTitle: '独自の質問を追加',
    faqCustomQuestionLabel: 'お客様の聞き方（自分用メモ）',
    faqCustomQuestionHint: '任意。例：「ポケット追加できますか？」— 自動一致には使いません。',
    faqCustomKeywordsRequired:
      '「有効」にする場合はキーワードを1つ以上（各2文字以上）、カンマまたは改行で区切ってください。',
    faqPresetQuestions: {
      stock: '在庫・サイズの有無は？',
      shipping: '配送、送料、届くまでの日数は？',
      price: '価格、割引は？',
      size_fit: 'サイズ選び、フィット、サイズ表は？',
      payment: '支払い方法（代引き、振込など）は？',
      return_policy: '返品・返金は？',
      order_track: '注文追跡、送り状番号は？',
      warranty: '保証は？',
      authentic: '正規品ですか？',
      promo: 'キャンペーン、クーポンは？',
    },
    visionSearchTitle: '写真送信時の商品候補',
    visionSearchHint:
      'Vertex AI Vision Image Warehouse を使用：同一 corpus/index 内で partner_id により店舗を分離。GCP（us-central1 または europe-west4）、GCS バケット、Vision AI + Storage のサービスアカウントが必要。GCS_VISION_CATALOG_BUCKET、VISION_WAREHOUSE_CORPUS_ID、VISION_WAREHOUSE_INDEX_ID、VISION_WAREHOUSE_INDEX_ENDPOINT_ID、任意で GOOGLE_CLOUD_PROJECT_NUMBER を設定。再インデックス cron は店舗と同じ GCP リージョンを使います（同期またはアセット削除で pending になったとき vision_warehouse_runner に保存）。画像インポート後は /api/cron/vision-warehouse-reindex（vision catalog cron と同じ secret）で corpus 分析とインデックス再構築が必須 — その後に画像検索が完全になります。同期は増分；在庫行削除は対応アセット削除と再 cron が必要です。',
    visionSearchEnable: '写真からの候補を有効にする',
    visionShopCountryLabel: '店舗の国・地域（Vision プリセット）',
    visionShopCountryHint:
      '主な販売地域を選ぶと、適した Google Cloud Vision リージョンを提案します。GCP プロジェクトのリージョンに近いと、カタログ画像の同期・転送が速く安定しやすくなります。構成が分かる場合は下で上書きしてください。不明なときは適当に選ばず、「Vision リージョンを手動指定（上級）」にして GCP 担当者に確認してから設定してください。',
    visionShopCountryCustom: 'Vision リージョンを手動指定（上級）',
    visionShopCountryAdvancedHint:
      'GCP プロジェクトに合わせて下の Vision リージョンと商品カテゴリを選んでください。国プリセット未使用、または保存リージョンがプリセットと一致しない場合に表示されます。',
    visionLocationLabel: 'Vision リージョン',
    visionCategoryLabel: '商品カテゴリ（インデックス）',
    visionBucketOverrideLabel: 'GCS バケット（任意）',
    visionBucketOverrideHint: '空欄の場合はサーバーの GCS_VISION_CATALOG_BUCKET を使用します。',
    visionWarehouseInventorySummary:
      '在庫：{total} 件 · https の画像 URL がある行は {withImage} 行（これらのみ Google Vision にアップロードされます）。',
    visionCatalogSyncStatsTitle: '画像カタログ同期状況（NanoAI → Google）',
    visionCatalogSyncStatsLineSynced: '一致済み — 次回同期ではスキップ（再アップロードなし）：{n} 行',
    visionCatalogSyncStatsLinePending: '未アップロードまたは更新待ち（画像・名前変更）：{n} 行',
    visionCatalogSyncStatsLineNoHttps: 'https の画像 URL なし — Vision に取り込めません：{n} 行',
    visionCatalogSyncStatsLineExcluded: 'Vision から除外：{n} 行',
    visionCatalogSyncStatsExplain:
      '「待ち」の行だけをインポートします。チェックサムが現在の画像＋名前と一致する行は公開済みとみなし再アップロードしません。GCS のオブジェクト数は jsonl や複数画像のため商品数と一致しないことがあります。アセット数は Google Cloud の Vision Warehouse で確認してください。先頭が // の画像 URL（https 省略）も利用可能で、https として扱います。',
    visionSyncButton: '在庫画像を Google に同期',
    visionSyncAutoWhenEnableHint:
      '「写真からの候補」をオンに保存が成功すると、セグメントをまたいで自動的に同期が続き、完了まで通常は追加操作は不要です。エラーや絶対上限のときだけ「在庫画像を同期」を押してください。',
    visionSyncing: '同期中…',
    visionSyncOk: '画像カタログを同期しました。',
    visionIndexReady: 'インデックス準備完了',
    visionIndexNotReady: '未同期またはエラー',
    visionLastSynced: '最終同期',
    visionSyncErrorLabel: '直近のエラー',
    visionWarehouseReindexPending:
      'Vision Warehouse の画像を更新済みです。インデックス再構築用の cron（/api/cron/vision-warehouse-reindex）の完了をお待ちください。画像検索は完了後に有効になります。',
    visionWarehouseCorpusUnsupportedType:
      'VISION_WAREHOUSE_CORPUS_ID の corpus は種別 IMAGE の Image Warehouse ではありません。Google がインポートを拒否します（CORPUS_UNSUPPORTED_TYPE）。Google Cloud の手順に従い type が IMAGE の Image Warehouse corpus を新規作成し、対応するインデックスとエンドポイントを設定し、.env と AI 設定の ID を更新してから再同期してください。動画など別種別の corpus では本フローは使えません。',
    visionProductSearchMaintenanceTitle: 'Google Vision Product Search はメンテナンスまたは制限中です',
    visionProductSearchMaintenanceDetail:
      'Google 側で旧 Product Search のカタログ操作が一時的に制限される場合があります（店舗設定の問題ではありません）。Image Warehouse: https://cloud.google.com/vision-ai/docs/image-warehouse-overview — 旧 Product Search の申請: https://forms.gle/QPLzMdwSMcR2pPsq5 — NanoAI の在庫画像同期は Image Warehouse を使用します。本表示は Google の応答に Product Search が含まれる場合のみです。',
    visionSyncToastImported: 'インデックスに反映',
    visionSyncToastRemoved: '削除（有効な画像 URL なし）',
    visionSyncToastMore: '未処理が残っている可能性があります — 再度同期してください。',
    visionSyncToastIdle: '同期する変更はありません。',
    visionSyncChainedRounds: '連続 {n} 回同期しました',
    visionSyncChainedStoppedMaxRounds: '自動同期の回数上限に達しました — 同期を押して続行してください。',
    visionSyncChainedStoppedTimeout:
      '時間上限のため停止しました（タブを固まらせないため）— 同期を押して続行してください。',
    visionSyncChainedAbortedSafety:
      '絶対安全上限のため自動同期を停止しました — 同期を押すかエラーを確認してください。',
    visionBgSyncTitle: 'Google へのバックグラウンド同期（VPS / cron）',
    visionBgSyncHint:
      'サーバー側にジョブをキュー：VPS が定期的に GET または POST /api/cron/vision-catalog-sync を Bearer VISION_CATALOG_SYNC_CRON_SECRET で呼びます（.env.example 参照）。タブを閉じても構いません。完了・エラー後にこのページで詳細レポートを確認。任意：1 日 1 回 GET/POST /api/cron/vision-bg-sync-enqueue（同じ Bearer、または VISION_BG_SYNC_ENQUEUE_CRON_SECRET）で画像提案オン店舗のバックグラウンド同期を自動キュー — catalog-sync の定期呼び出しの代わりにはなりません。',
    visionBgSyncButton: 'バックグラウンド同期を開始',
    visionBgSyncUseResumeHint:
      'タブに未完了の同期カーソル（ブラウザ同期）があればそこから再開、なければ先頭からスキャンします。',
    visionBgSyncCancel: 'バックグラウンドジョブをキャンセル',
    visionBgSyncDismiss: 'レポートを閉じる',
    visionBgSyncStatusQueued: 'cron 待ち',
    visionBgSyncStatusRunning: 'cron 実行中',
    visionBgSyncStatusDone: '完了',
    visionBgSyncStatusError: 'エラー',
    visionBgSyncStatusIdle: 'バックグラウンドジョブなし',
    visionBgSyncReportTitle: 'バックグラウンド同期レポート',
    visionBgSyncFieldRounds: 'API 回数',
    visionBgSyncFieldImported: 'インデックス反映',
    visionBgSyncFieldRemoved: '削除',
    visionBgSyncFieldHasMore: '残件あり',
    visionBgSyncFieldLastScanned: 'カーソル（最後の商品）',
    visionBgSyncFieldStopped: '停止理由',
    visionBgSyncFieldMessage: 'メッセージ',
    visionBgSyncFieldServerError: 'サーバーエラー',
    visionBgSyncBoolYes: 'はい',
    visionBgSyncBoolNo: 'いいえ',
    visionBgSyncPollingNote:
      'キュー待ちまたはバックグラウンド実行中は、このページを約 8 秒ごとに自動更新します（タブを開いたままにしてください）。',
    visionBgSyncProgressTitle: 'Google への商品反映の進捗',
    visionBgSyncProgressRatio: 'インデックス反映: {imported} / ~{total} 件（画像 URL がある在庫行）',
    visionBgSyncProgressHint:
      '~ の分母は現在の在庫で画像リンクがある行数（目安）です。API の件数はバッチごとに多少ずれることがあります。',
    visionBgSyncProgressNoImageRows: '画像 URL のある在庫行がまだありません — 進捗を見積もれません。',
    visionBgSyncQueuedExplain:
      '「cron 待ち」は DB にキューされただけで**まだ処理されていない**状態です。サーバーが `/api/cron/vision-catalog-sync`（Bearer）を呼ぶか、下の「サーバーで1回実行」まで 0/N は正常です。',
    visionBgSyncPostRefreshExplain:
      '約8秒ごとの `/dashboard/messaging/settings` への POST は**状態の再読込**（サーバーアクション）であり、Google Vision の呼び出しではありません。',
    visionBgSyncRunSliceButton: 'サーバーで1回実行',
    visionBgSyncRunSliceHint: 'cron 1 回分と同等（数分かかる場合あり）。本番では VPS の crontab 設定を推奨します。',
    visionBgSyncRunSliceOk: '1 パス完了: API {rounds} 回 · キューに触れたパートナー {partners} 件。',
    visionBgSyncEnqueueOk: 'バックグラウンド同期をキューに入れました。VPS の cron が処理します。',
    visionBgSyncToastDone: 'Vision バックグラウンド同期が完了しました。',
    visionBgSyncToastError: 'Vision バックグラウンド同期が失敗しました。',
    visionBgSyncAlreadyActive: 'ジョブは既にキューまたは実行中です。',
    visionBgSyncAlreadyActiveRefreshHint:
      'サーバーから状態を更新しました。長時間「待機」のままなら、VPS の Vision 同期 cron を確認するか「バックグラウンドジョブをキャンセル」を押してください。',
    visionBgSyncEnableVisionFirst: 'バックグラウンド同期の前に「写真からの候補」をオンにしてください。',
    visionBgSyncSaveSettingsFirst: '先に Messaging の AI 設定を一度保存してください。',
    visionBgSyncStopCompleted: '完了',
    visionBgSyncStopError: 'エラー',
    visionBgSyncStopCronSlice: 'cron の実行枠が終了（続行）',
    visionBgSyncStopBadCursor: 'カーソルが無効',
    visionBgSyncServerErrCursor: '残件があるのにスキャンカーソルがありません — 安全のため停止',
    visionBgSyncMsgCompleted: 'カタログ同期が完了しました。',
    visionBgSyncMsgInProgress: '処理中 — 次の cron が継続します。',
    visionBgSyncMsgBadCursor: '停止: サーバーのカーソルが不整合です。',
    visionHealthPanelTitle: 'Vision 同期ヘルス',
    visionHealthStatusHealthy: '緑',
    visionHealthStatusWarning: '黄',
    visionHealthStatusStuck: '赤（スタック）',
    visionHealthStatusIdle: 'データなし',
    visionHealthPendingCount: '未処理件数: {n}',
    visionHealthChecksumDone: 'チェックサム完了: {done}/{total}',
    visionHealthLockAge: 'ロック経過',
    visionHealthLockBusy: '使用中（{sec}秒）',
    visionHealthLockFree: '空き',
    visionHealthLockOwner: 'ロック所有者',
    visionHealthOwnerUnknown: '所有者不明',
    visionHealthHeartbeatAge: 'ハートビート経過',
    visionHealthHeartbeatAlive: '生存中（{sec}秒）',
    visionHealthHeartbeatNone: 'ハートビートなし',
    visionHealthLastProgress: '最終進捗',
    visionHealthLastProgressNone: 'なし',
    visionHealthUnlockButton: 'インポートロックを解除',
    visionHealthUnlockOk: 'Vision Warehouse のインポートロックを解除しました。',
    visionEmergencyDisableButton: 'Vision を緊急停止',
    visionEmergencyDisableConfirm:
      'このショップの Vision 機能を今すぐすべて停止しますか？バックグラウンド同期を止め、画像候補を無効化し、ランナーロックを解除します。',
    visionEmergencyDisableOk: 'このショップの Vision 機能を停止しました。',
    visionInventoryDeleteRemovesIndexNote:
      '「在庫」タブで行を削除すると、Google Vision の画像インデックスからも自動で削除されます — リストアップロードは不要です。',
    imageSearchApiTitle: '画像で商品検索 API（店舗サイト向け）',
    imageSearchApiHint:
      'multipart で画像（フィールド image または file）を送り、Authorization: Bearer に API キーを付けます。同期済み Vision カタログに近い商品を返します。キーをブラウザに出さないよう店舗のバックエンドから呼び出すことを推奨します。',
    imageSearchApiEnable: '公開 API を有効にする',
    imageSearchApiKeyConfigured: 'API キーが設定されています。',
    imageSearchApiKeyMissing:
      'キー未作成 — API 連携ページで作成・管理（マスク、表示、コピー、削除）してください。',
    imageSearchApiEndpointLabel: 'パス（前に NanoAI のドメインを付ける）',
    imageSearchApiBaseUrlNote: '例: https://your-domain.com/api/messaging/partners/…/image-search',
    imageSearchApiDocHint:
      'POST multipart: image（ファイル）。任意 limit（1–25、既定 8）。JSON: products[]（inventory_id, name, sku, image_url, product_url, score）。',
    imageSearchApiGenerate: 'API キーを生成 / 再発行',
    imageSearchApiGenerating: 'キーを生成中…',
    imageSearchApiKeyCreated: 'キーを発行しました（可能ならクリップボードにコピー済み）。再表示されないので今すぐ保存してください。',
    imageSearchApiManageKeysLink: 'API 連携を開く — キー管理',
    guestPurchaseFlowLabel: 'NanoAIチャットでの購入方法',
    guestPurchaseFlowHint:
      '「チャット内」：購入で従来どおり注文/QR。「ショップサイト」：購入で商品ページ（在庫のURL）を新しいタブで開く — 決済・配送をサイト側で運用する場合向け。',
    guestPurchaseFlowInChat: 'チャット内で注文（フォーム＋NanoAI決済）',
    guestPurchaseFlowExternal: '「購入」でショップサイトを開く',
  },
  partnerGuestChat: {
    notFoundTitle: 'チャットページが見つかりません',
    notFoundDescription: 'リンクが無効か、店舗が機能をオフにしています。',
    pageTitleSuffix: 'NanoAI でチャット',
    metaDescription: 'NanoAI で {shop} にメッセージ — Facebook、Zalo、店舗サイトと同じ受信箱です。',
    shopLabel: '店舗',
    subline:
      'NanoAI 上で店舗とチャットしています。店舗は管理画面から返信します。Google でログインすると端末間で履歴が同期されます。',
    placeholder: 'メッセージを入力…',
    send: '送信',
    emptyThread: 'まだメッセージがありません。下から最初のメッセージを送ってください。',
    loadError: 'メッセージを読み込めませんでした。',
    sendError: '送信に失敗しました。',
    pollNote: '店舗からの返信が数秒遅れる場合があります。',
    guestAttachPhoto: 'ライブラリ',
    guestTakePhoto: 'カメラで撮影',
    guestRemoveAttachment: '写真を削除',
    guestUploading: 'アップロード中…',
    guestImageTooLarge: '画像が大きすぎます（最大約 10 MB）。',
    guestImageInvalidType: 'JPG / PNG / WebP / GIF のみ対応です。',
    guestCaptionHint: '写真に説明を添えられます（任意）。',
    loginPromptTitle: 'チャットするにはログイン',
    loginPromptDescription:
      'メールでログインすると、店舗へのメッセージを別の端末でも続けられます。',
    signInWithGoogle: 'ログイン',
    linkMyShops: '自分のメッセージ',
    linkMyOrders: '自分の注文',
    widgetShoppingCart: 'カート',
    widgetLanguageSelectAria: '言語',
    sendKeyboardHint: 'Enter で送信 · Shift+Enter で改行 · Ctrl+V / Cmd+V で画像を貼り付け',
    tryOnOpen: 'AI 試着',
    tryOnTitle: 'チャット内で試着',
    tryOnModelPhoto: '人物写真',
    tryOnGarmentPhoto: '服の写真',
    tryOnGarmentSourceTitle: '服画像の選択元',
    tryOnGarmentSourceDevice: '端末から画像を選択',
    tryOnGarmentSourceRecent: '店舗の最近20件のおすすめ画像から選択',
    tryOnGarmentRecentEmpty: '最近のおすすめ画像はありません。',
    tryOnGenerate: '試着画像を作成',
    tryOnGenerateWithCost: '試着画像を作成（-{credits} クレジット）',
    tryOnPreparing: '試着画像を作成中…',
    tryOnNeedBoth: '人物写真と服の写真の両方が必要です。',
    tryOnGarmentLimitReached: '服は最大 {max} 点まで選択できます。',
    tryOnGarmentItemsLabel: '点',
    tryOnFailed: '試着画像を作成できませんでした。',
    tryOnReady: '試着画像ができました。チャットで送信できます。',
    tryOnChargedToast: '{cost} クレジットを消費しました。残り {remaining} クレジット。',
    tryOnCreditsBalanceLabel: '残高: {credits}',
    tryOnTopUpCredits: 'チャージ',
    tryOnResultViewLarge: '試着画像を大きく表示',
    tryOnResultDownload: 'ダウンロード',
    tryOnEmbedGarmentFromPage: 'このページの商品画像',
    tryOnEmbedGarmentFromPageWithSku: '閲覧中の商品（SKU: {sku}）',
    tryOnEmbedOnlyFlowHint:
      'ご本人の写真を選んでください（次回もこのブラウザ・このチャット枠内で記憶します）。衣類画像は閲覧中の商品から取り込み済みです。試着は credits を消費します。チャージはこのチャット枠内のボタンから（ショップと同じタブ。別タブで NanoAI を開く必要はありません）。',
    guestCreditWalletLoginTitle: 'クレジットウォレット利用のためにログイン',
    guestCreditWalletLoginDescription:
      '試着とチャージにはメール認証（OTP）が必要です。下記で手続きしてください。',
    toastGuestTopUpLoginRequired: 'チャージの前にメール（OTP）でログインしてください。',
    toastTryOnInsufficientCredits: 'クレジットが不足しています。チャージしてから再度お試しください。',
    guestAuthPromptTitle: 'ログインして履歴を長期保存',
    guestAuthPromptBody: '今すぐチャットは可能です。ログインすると端末/ブラウザを変えても履歴を引き継げます。',
    guestAuthEmailPlaceholder: 'メールアドレスを入力',
    guestAuthSendMagicLink: 'ログインリンクを送信',
    guestAuthSendOtp: 'OTPコードを送信',
    guestAuthOtpPlaceholder: '6桁のOTPを入力',
    guestAuthVerifyOtp: 'ログイン',
    guestAuthRequiredAfterLimit: '{count}件送信しました。続けるにはメール認証が必要です。',
    guestAuthEmailSent: '認証メールを送信しました。受信箱をご確認ください。',
    guestAuthOtpInvalid: 'OTPが無効か期限切れです。',
    guestAuthRateLimited: '操作が速すぎます。{seconds}秒後に再試行してください。',
    guestAuthRememberDeviceHint:
      'この端末/ブラウザを長期間信頼する（同じメールで再ログイン時にOTPを省略する場合があります）。',
    guestAuthVerifyingProgress: 'ログイン処理中です。お待ちください…',
    shopTypingHint: '店舗が入力中…',
    consultLinkShopPreparingHint: '店舗が商品情報を送信中…',
    similarAlternativesTemplateMessage: '下にほかのデザインをいくつかご用意しました。',
    productSearchTemplateMessage:
      '条件に合う商品を下にお送りします。気に入った商品カードの「今すぐ購入」からチャット内で注文できます。追加で聞きたい場合は「相談」を押してください。',
    visionPickHint: '正しい商品を選ぶか、手動の返信をお待ちください。',
    visionPickBusy: '送信中…',
    visionPickError: '選択を送信できませんでした。もう一度お試しください。',
    visionProductLink: '相談',
    visionProductBuy: '今すぐ購入',
    visionProductViewDetails: '詳細を見る',
    visionProductVideo: '動画',
    visionVideoCloseAria: '動画を閉じる',
    productShelfButton: '商品',
    urlProductContextChipLabel: '閲覧中の商品を送る',
    urlProductContextChipAria:
      'このページで見ている商品の文脈（コード・画像）を店舗に送ります。先に別のメッセージを送ると付きません。',
    urlProductContextChipDismissAria: '閉じる — 閲覧中商品の文脈を送らない',
    productShelfTitle: '最近関心のある商品',
    productShelfEmpty: 'まだおすすめがありません。店舗のメッセージを見るか、写真を送ってください。',
    productShelfSearchPlaceholder: '在庫を検索（スタイル・説明）',
    productShelfSearchButton: '検索',
    productShelfSearchImage: '画像',
    productShelfSearchClear: '解除',
    productShelfSearching: '検索中…',
    productShelfSearchFailed: '検索に失敗。ベクトル同期後に再試行。',
    productShelfSearchNoResults: '該当する商品がありません。',
    productShelfBuy: '購入',
    purchaseOpenSiteToast: 'ショップの商品ページを新しいタブで開きました。',
    purchaseMissingProductUrlToast: '商品URLがありません。在庫にURLを追加してください。',
    productConsultProductRefFromSku: '商品コード {sku}',
    productConsultProductRefFromName: '{name}',
    productConsultAskShipping:
      '{productRef}について — 配送と商品詳細、どちらからよろしいですか？',
    productConsultAskDetail:
      '{productRef}について — 他に気になる点はありますか？',
    productConsultAskDetailFromSku:
      'この商品「{sku}」に興味があります。ショップに相談したいです。',
    pageContextInboundConsultNoSku:
      '商品ページからお越しですね。ご希望を一言メッセージでお知らせください。',
    pageContextInboundImageOnlyNote:
      '商品リンクからです。店舗が相談しやすいよう画像を付けて送信しています（写真送付と同様です）。',
    guestProfileDialogTitle: '適切な呼び方のために',
    guestProfileDialogDescription:
      'NanoAIアカウントに一度だけ保存されます（全店舗共通）：生年月日と性別（男性または女性）で自然な敬称と年齢に合った提案に使います。後からでも入力できます。',
    guestProfileBirthLabel: '生年月日',
    guestProfileBirthDayPlaceholder: '日',
    guestProfileBirthMonthPlaceholder: '月',
    guestProfileBirthYearPlaceholder: '年',
    guestProfileGenderLabel: '性別',
    guestProfileGenderMale: '男性',
    guestProfileGenderFemale: '女性',
    guestProfileSave: '保存',
    guestProfileRemindLater: 'あとで',
    guestProfileInvalid: '生年月日と性別を入力してください。',
  },
  messagingMyChats: {
    pageTitle: '自分のメッセージ',
    pageDescription: 'NanoAI でやり取りした店舗一覧です。',
    emptyList: 'まだ会話がありません。店舗のチャットリンクを開いてください。',
    openChat: 'チャットを開く',
    lastActivity: '最終アクティビティ',
    loadFailed: '一覧を読み込めませんでした。',
    backHomeAria: 'ホームへ戻る',
  },
  messagingMyOrders: {
    pageTitle: '自分の注文',
    composerOrdersLabel: '注文',
    pageDescription: 'NanoAI チャット経由の注文 — 支払いと発送の状況。',
    emptyList: '注文はまだありません。店舗チャットで注文するとここに表示されます。',
    loadFailed: '一覧を読み込めませんでした。',
    backHomeAria: 'ホームへ戻る',
    openChat: 'チャットを開く',
    createdAt: '注文日時',
    totalLabel: '合計',
    payStatus: '支払い',
    shipStatus: '配送',
    stAwaiting: '入金待ち（手付金）',
    stChecking: '入金確認中',
    stPaid: '支払い済み',
    stManual: '店舗確認待ち',
    stCancelled: 'キャンセル',
    shPending: '処理待ち',
    shConfirmed: '確認済み',
    shPacking: '梱包中',
    shShipping: '配送中',
    shDelivered: '配達済み',
    shReturned: '返品',
    shCancelled: 'キャンセル',
    orderIdLabel: '注文ID',
    transferMemoLabel: '振込備考',
    qtyLabel: '数量',
    colorLabel: '色・柄',
    sizeLabel: 'サイズ',
    noteLabel: 'メモ',
    unitPriceLabel: '単価',
    depositPctLabel: '手付け率',
    amountDueLabel: 'お支払い額（手付け）',
    paidRecordedLabel: '支払済み',
    balanceOnDeliveryLabel: '受取時のお支払い（残額）',
    shipToLabel: 'お届け先',
    productPhotoAlt: '注文商品画像',
    variantImagesSectionLabel: '選択した色・バリエーション画像',
    totalQtySummaryLabel: '合計数量',
    viewTimelineButton: '注文タイムライン',
    timelineTitle: '注文タイムライン',
    timelineLoadFailed: '履歴を読み込めませんでした。',
    timelineEmpty: 'イベントはまだありません。',
  },
  navGroup: {
    try_on: '試着・コーデ',
    education: '教育・研修',
    image_edit: '画像編集',
    design_creative: 'デザイン・クリエイティブ',
    three_d_special: '3D・専門ツール',
    music_ai: 'AI 音楽',
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
    wedding_invitation_ai: 'AI 結婚式招待状',
    text_to_image: 'テキストから画像',
    infographic_from_book: '教科書インフォグラフィック',
    sketch_to_image: 'スケッチから画像',
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
    edit_image_by_request: '要望に応じて画像編集',
    product_3d_sample: '3D 商品サンプル',
    model_3d_from_image: '画像から 3D モデル生成',
    create_video_from_image: 'AI動画（Veo）',
    flow_music_veo_video: 'AIミュージックビデオ（Flash+Veo）',
    interior_exterior: '内装・外装',
    my_house: '建てたい家のイメージ',
    portrait_photo: 'ポートレート写真',
    expand_frame: 'フレーム拡張',
    face_swap: '顔交換',
    translate_document_image: '書類画像翻訳',
    lyria3_instrumental_song: '楽曲を作成（ボーカル／インスト）',
    meeting_recorder_report: '会議録音とAI議事録',
    ai_language_learning: 'AI 語学学習',
    create_curriculum: 'カリキュラム作成',
    my_curricula: 'マイカリキュラム',
    online_exam: 'オンライン試験（授業）',
    homework_online: '宿題を作成',
    classes: 'クラス',
    try_on_1: '1人試着',
    try_on_2: '2人試着',
    try_on_3: '3人試着',
    try_on_4: '4人試着',
    try_on_5: '5人試着',
    image_result_display: '画像結果の表示',
    admin: '管理',
  },
  creationSidebar: {
    back: '戻る',
    relatedTitle: '関連',
    popularTitle: 'よく使うツール',
  },
  imageResultDisplay: {
    pageTitle: '前後の見え方',
    pageIntro:
      '既定は1つの枠でドラッグ比較（内装・外装デザインと同じ操作）。並べて表示も選べます。画像ツール全体に適用し、各結果画面でも切り替えできます。',
    modeSplitTitle: '並べて表示',
    modeSplitDesc: '元画像と結果を左右に表示。タップで拡大も従来どおりです。',
    modeCompareTitle: 'ドラッグで比較（既定）',
    modeCompareDesc:
      '1つの枠で中央ハンドルを動かします。左が元画像、右が結果。フル画面表示にも対応（他ツールと同一の体感）。',
    persistNote: 'このブラウザ（端末）に保存されます。',
  },
  taskHub: {
    pageTitle: 'タスクとキュー',
    pageDescription:
      '処理中の作業（画像・動画・一括翻訳・教材など）を一覧し、各ツールへすぐ移動できます。',
    sectionRunning: '処理中',
    sectionRecent: '直近の完了／失敗（7日）',
    emptyRunning: '実行中のタスクはありません。',
    emptyRecent: '過去7日に完了したタスクはありません。',
    openTool: 'ツールを開く',
    batchSummary: '{done}/{total} 完了',
    itemsCount: '{n} 件',
    worksheetSection: '宿題／教材（バックグラウンド）',
    worksheetParseSgk: '教科書の抽出',
    worksheetQuiz: 'ステップ式クイズ',
    worksheetEssay: '作文の採点・生成',
    worksheetUnknownType: 'ワークシートジョブ',
    statusProcessing: '実行中',
    statusFailed: '失敗',
    statusCompleted: '完了',
    statusCancelled: 'キャンセル',
    statusMixed: '一部のみ',
    hintTranslateProgress:
      '画像翻訳の一括処理：ツールページで詳細な進捗・ZIP ダウンロード・キャンセルができます。',
    linkProcessedImages: '処理済み画像',
    linkTranslateHistory: '翻訳履歴',
    linkTranslateProgress: '翻訳の進行状況',
    autoRefreshNote:
      '処理中のタスクがある間は約8秒ごとに自動更新（タブ表示中）。待ちなしのときは、このタブに戻ったときに更新されます。',
  },
  meetingRecorder: {
    cardTitle: '会議を録音 → AI 議事録',
    cardDescription:
      'ブラウザでの録音にクレジットはかかりません。録音開始時に会議名をこの端末へ自動保存します。AI 議事録を生成するときだけ、録音時間に応じてクレジットが減ります。',
    freeRecordingNote: '録音と会議名の保存：クレジット不要。',
    silenceAutoStopNote:
      '発話が 5 分間検出されない場合、録音は自動停止し、手動停止と同様に保存されます。',
    autoStoppedBySilence: '録音を自動停止しました：5 分間発話を検出できませんでした。',
    segmentAutoSplitNote:
      '5 分ごとに現在のセグメントを終了し、同じマイクで新しいセグメントを自動開始します（サーバー側でのカットは不要）。',
    segmentRotatedToast: '新しい 5 分セグメントの録音を開始しました。',
    chargeNote:
      'AI 議事録（文字起こし＋要約）：最初の 5 分は 1 クレジット。超過分は分単位（切り上げ）で 1 分あたり 0.2 クレジット。',
    sessionNote:
      '録音はサーバーに最大 {days} 日保存されたあと自動削除されます。この画面ではローカル再生・ダウンロード可能。録音開始時に会議名をこの端末へ自動保存します。',
    meetingTitleLabel: '会議名',
    meetingTitlePlaceholder: '例：Q1 プロジェクト定例',
    savingRecording: 'サーバーに録音を保存しています…',
    saveRecordingFailed: '保存に失敗しました。通信を確認して再試行してください。',
    retrySaveRecording: '録音の保存を再試行',
    needServerRecording: 'AI 議事録を出す前に、サーバーへ録音を保存する必要があります。',
    startRecording: '録音開始',
    stopRecording: '停止',
    stopRecordingConfirmTitle: '録音停止の確認',
    stopRecordingConfirmDescription:
      '会議が実際に終了した場合のみ確認してください。録音は保存されます。クレジットは AI 議事録を生成するときのみ消費されます。',
    stopRecordingConfirmOk: '確認 — 会議は終了した',
    stopRecordingConfirmContinue: '録音を続ける',
    recording: '録音中…',
    idleHint: 'ブラウザの案内に従いマイクを許可してください。',
    recordingTimeLabel: '録音中：{duration}',
    durationLabel: '時間：{duration}',
    createNewMeeting: '新しい会議を作成',
    stopBeforeNewMeeting: '録音を停止してから新しい会議を作成してください。',
    downloadRecording: '録音をダウンロード',
    generateReport: 'AI 議事録を生成',
    reportLanguageLabel: '議事録の言語',
    estimatedCost: '目安：{credits} クレジット',
    costExplain:
      '最初の 5 分：1 クレジット。5 分超の分は切り上げ、1 分ごとに 0.2 クレジット追加 — 例：5:47 ≈ 1.2 クレジット。',
    needRecording: '議事録を出す前に、数秒以上録音してください。',
    processing: '音声を解析しています…',
    reportHeading: '会議レポート',
    briefReportHeading: '簡潔サマリー（要点）',
    fullReportHeading: '詳細レポート',
    transcriptHeading: '文字起こし',
    copy: 'コピー',
    copied: 'コピーしました',
    downloadMd: '詳細レポートをダウンロード（.md）',
    downloadBriefMd: '簡潔サマリーをダウンロード（.md）',
    micError: 'マイクにアクセスできません。ブラウザの権限を確認してください。',
    fileTooLarge: '音声ファイルが大きすぎます（上限 20MB）。',
    genericError: 'エラーが発生しました。しばらくしてからお試しください。',
    insufficientCredits: 'クレジットが不足しています。',
  },
  flowMusicVeo: {
    pageTitle: 'AIミュージックビデオ（Flash歌詞 + Veo）',
    metaDescription:
      'ブロック別歌詞（Flash JSON）、Lyria風スタイル、最初は画像から約8秒、その後Veoで延長—各ステップにそのブロックの歌詞を含むプロンプト。1本のMP4。音声はVeo生成。',
    headline: 'ミュージックビデオ — 歌詞（Flash）+ 映像と音（Veo）',
    subtitle:
      '1: ジャンル（Flash）＋画像/ヒント。4: 歌詞欄を上から並べて表示；「歌詞欄を開く…」またはクリップ後「さらに約8秒」で行を追加；枠ごと生成または手入力 — 下はVeo（画像→延長）。',
    stepLyricsTitle: 'ステップ1 — ジャンルとヒント（Flash歌詞）',
    stepLyricsBody:
      'ここはジャンル＋画像＋テーマのみ（声/テンポはVeo側）。ステップ4は歌詞欄を一度に表示；「歌詞欄を開く…」または約8秒延長で行を追加（最大20）。「歌詞を生成」または手入力。',
    lyricsModeLabel: '歌詞の生成方法',
    lyricsModeAllAtOnce: '一括 — Nブロックを一度に',
    lyricsModeProgressive: '段階的 — 次のブロックだけ',
    lyricsProgressiveHelp:
      'ステップ1：曲風→画像→ヒント；ステップ4は歌詞欄を上から並べ、必要な行で「歌詞を生成」。声/テンポ/構成はVeo動画作成時。「歌詞欄を開く…」で空行追加（最大20）。1回{credits}クレジット — 動画ボタンとは別。',
    openNextLyricsSegmentButton: '歌詞欄を開く — ブロック {k}',
    segmentVideoSubBlockHint: 'Veo動画（別フロー、歌詞が整ってから）：',
    progressiveStyleOnlyInStep1Note: 'ジャンル/声/テンポ等はここでのみ選択。下の動画作成では音楽項目は出ません。',
    lyricsGenreOnlyHelp:
      'Flashの歌詞プロンプトにのみ使用。声・テンポ・構成などはステップ4のVeoで選び、歌詞生成時には送りません。',
    veoStyleFieldsIntro: '声・歌唱言語・テンポ・構成 — このクリップのVeo向け（歌詞生成には使いません）。',
    progressiveExtendStyleLockedNote: '曲風は1段目の歌詞生成時のまま — 映像・カメラ・動きの補足のみ任意で。',
    progressiveVideoSectionTitle: '動画を作成 — ブロック {k}',
    generateNextSegmentButton: '歌詞を生成 — ブロック {k} / {n}',
    successLyricsOneSegment: 'ブロック {k}/{n} を生成しました。続けるか、揃ったら次へ。',
    incrementalPlanFrozenHelp: '段階生成を開始済み — ブロック数は変更不可。「最初からやり直す」で変更。',
    lyricsModeFrozenHint: 'AI歌詞の途中 — 方式の切替は不可。「最初からやり直す」。',
    progressiveNoNextSegment: '各ブロックは埋まっています — ステップ4へ、または「最初からやり直す」。',
    hintLabel: 'テーマ/ストーリー（画像がある場合は短くてよい）',
    hintPlaceholder: '例: 日本語ポップ、夏と海、明るい雰囲気…',
    lyricsImageHelp: '任意の雰囲気参考画像 — Flashが歌詞のヒントに使います。',
    generateLyricsButton: '歌詞を生成（Flash）',
    generatingLyrics: '歌詞生成中…',
    lyricsNeedHintOrImage: '4文字以上のヒントか画像1枚が必要です。',
    successLyrics: '歌詞を生成しました — 確認・編集してください。',
    successLyricsBlocks: '{n}ブロックの連続した歌詞（JSON）を生成 — 第4ステップで各欄を確認。',
    lyricsBlockCountLabel: '歌詞ブロック数 / 8秒クリップ',
    lyricsBlockCountHelp: 'Flashはこの数でJSON出力。第4ステップの欄数とVeo延長回数に合わせる。',
    openingLyricsLabel: '最初の8秒分の歌詞',
    openingLyricsHelp: '1枠目に十分な行数（約8秒分）を書いてください。Veoには本ブロック＋英語のスタイル説明が送られます。',
    fillOpeningButton: '全文から冒頭を入れる',
    assignOpeningToSegment1: '冒頭の歌詞をクリップ1の欄に入れました。',
    styleBlockTitle: 'ステップ2 — 音楽スタイル（Lyria有人声相当）',
    styleBlockBody: '選択は英語の説明としてVeoに送られます（ジャンル、声、テンポ、構成）。MP3は作られずVeoが音声を合成。',
    genreLabel: 'ジャンル',
    voiceGenderLabel: '声の性',
    voiceTimbreLabel: '音色',
    voiceLangLabel: '歌唱言語',
    bpmLabel: 'テンポ（BPM）',
    structureLabel: '曲構成',
    densityLabel: '編曲の密度',
    videoBlockTitle: 'ステップ3 — 画像と8秒クリップ（720p）',
    videoBlockBody: '1枚: 開始フレームのI2V。2〜3枚: 参照画像のみ（別開始フレームなし）。最大3ファイル。',
    aspectLabel: 'アスペクト比',
    aspect169: '16:9',
    aspect916: '9:16',
    framesLabel: '画像（1〜3）',
    framesHelpSingle: '1ファイル: 動画の開始フレーム。',
    framesHelpMulti: '2〜3ファイル: すべて参照（ASSET）画像。',
    visualExtraLabel: '追加の映像指示（任意）',
    visualExtraPlaceholder: '例: ゴールデンアワー、スローモーション、歌唱のクローズアップ…',
    createClip8s: '8秒クリップ作成（720p）',
    creatingClip: '8秒クリップ作成中（Veo）…',
    clip720Note:
      '各ブロックは約8秒の独立したVeoクリップ（ブロック1と同じ画像）。最後にサーバーでMP4を結合。クリップごと約8クレジット；結合は無料。',
    needImage: '画像を1枚以上選んでください。',
    previewTitle: 'プレビュー注記',
    downloadMp4: 'MP4をダウンロード',
    segmentIndexLabel: 'クリップ {n}',
    createSegment1VideoButton: '画像から1ブロック目を作成（約8秒、720p）',
    addEightMoreVideoButton: 'さらに約8秒つなげる',
    addEightMoreVideoHelp:
      '次の歌詞欄を開きます。生成または手入力後、そのブロック用に約8秒の独立クリップを作成（ブロック1と同じ画像）。最後に1本のMP4へ結合できます。',
    extendSegmentVideoButton: 'ブロック{k}のクリップを作成（約8秒・独立）',
    extendingVeoSegmentBusy: 'ブロック{k}のクリップ作成中（Veo）— 数分かかる場合があります…',
    videoSequentialBlockIntro: '各ステップの動画と次のアクションはすぐ下に表示されます。',
    videoImagesOnlyStep3Note:
      'ブロック1の画像と比率が以降すべてに再利用（各クリップは個別生成、延長ではありません）。',
    previewInStep4Note: '各チェックポイントの動画はステップ4内に表示されます。',
    videoForSegmentLockedNote: '「さらに約8秒つなげる」を押し前のクリップがあると、この段のVeoが表示されます。',
    successExtendSegment: 'ブロック{k}のクリップができました。下の動画をご確認ください。',
    partialSegmentsFail: 'セグメント{n}の作成で停止 — それ以前のクリップは再生・DL・結合できます。',
    startOver: '最初からやり直す',
    veoAudioNote: 'MP4の音声はプロンプト（歌詞＋スタイル文）に基づきVeoが生成したものです。',
    successClip: '8秒クリップを作成しました。',
    segmentCountLockedHelp: '歌詞枠を増やした後やAI歌詞利用後は段数が固定。「最初からやり直す」で変更。',
    lyricsLockedNote: '各段の歌詞はロック済み（Veo送信順を保つため）。',
    segmentsCountSyncedNote: 'ステップ1と同じ：{n}段。',
    videoAfterSegmentLabel: '歌詞ブロック{n}の後（目安 ~{seconds}秒）',
    downloadMp4Step: 'MP4をダウンロード — チェックポイント{n}',
    extendPerStepSectionTitle: '各クリップのオプション',
    extendPerStepSectionBody: 'ステップ2の音楽スタイルは全クリップ共通。カメラ/キャラは各生成前に編集可能。',
    extendBridgeLabel: '段{to}用の独立約8秒クリップ — ブロック1と同じ画像；後でMP4結合。',
    extendSegmentVisualLabel: 'ビジュアル注記（この延長）',
    cameraHintLabel: 'カメラアングル / 動き',
    cameraHintPlaceholder: '例：ゆっくり左パン、ワイド、軽い手持ち…',
    characterStoryLabel: 'キャラの動き / ストーリー',
    characterStoryPlaceholder: '例：海を見る、手を上げる、背を向けて歩く…',
    standaloneFramesNote: 'ブロック1で選んだ画像を再利用。このクリップのプロンプト用にカメラ/キャラを調整できます。',
    mergeClipsSectionTitle: '作成済みクリップを結合',
    mergeClipsSectionHelp: '1→2→…の順で1本のMP4に。クレジット不要；サーバーにffmpegが必要です。',
    mergeClipsButton: '1本のMP4に結合',
    mergingClips: 'サーバーで動画を結合中…',
    successMergedClip: '結合完了。下で確認するか履歴から開けます。',
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
    mobileCreateHomework: '宿題を作成',
    assignWorksheet: '宿題',
    classHomeworkListEmpty: 'このクラスに紐づいた宿題はまだありません。',
    classHomeworkListCreateCta: '宿題を作成',
    classHomeworkOpenLamBai: '受験ページを開く',
    classHomeworkAttachOtherClassButton: '宿題を他クラスに紐づけ',
    classHomeworkAttachPickTitle: '宿題を他クラスに紐づける',
    classHomeworkAttachPickDescription:
      '同じ内容で新しい宿題セッション（コードとリンクは新規）を作成し、選んだクラスに紐づけます。',
    classHomeworkAttachSessionLabel: '宿題',
    classStudentHomeworkSessionsEmpty: '先生からの宿題はまだありません。',
    noWorksheets: 'ワークシートがありません',
    noStudents: '生徒がいません',
    doWorksheet: '問題を解く',
    submit: '提出',
    submitSuccess: '提出済み',
    viewResult: '結果を見る',
    quizScore: 'クイズ得点',
    sampleAnswer: '模範解答',
    submissions: '提出一覧',
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
    classExamsSubsectionGraded: 'テスト（採点あり）',
    classExamsSubsectionPracticeHomework: '宿題（生徒には点数を表示しません）',
    studentClassHomeworkSubmittedCaption:
      '提出済み。宿題のため、ここでは点数を表示しません。',
    classSessionBadgeHomework: '宿題',
    lamBaiSeoTitleSuffixExam: 'オンラインテスト',
    lamBaiSeoTitleSuffixHomework: '宿題',
    lamBaiSeoDescriptionExam:
      'セッションコードでオンラインテストに回答します。選択式・記述式、採点あり。',
    lamBaiSeoDescriptionHomework:
      'セッションコードでオンライン宿題に取り組みます。練習用で、本試験のように点数は表示しません。',
    lamBaiSeoKeywordsExam: 'テスト, オンライン試験, 選択問題, 記述, NanoAI',
    lamBaiSeoKeywordsHomework: '宿題, 復習, NanoAI',
    lamBaiSeoFallbackTitle: 'オンラインで解答',
    lamBaiSeoFallbackDescription:
      'ログインして、セッションコードまたは教師からのリンクから解答します。',
    lamBaiSeoFallbackKeywords: '解答, NanoAI',
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
    examAttachToOtherClassButton: '他クラスに紐づけ',
    examAssignClassButton: 'クラスに割り当て',
    examAttachPickClassTitle: 'テストを他クラスに紐づける',
    examAttachPickClassDescription:
      '同じ問題内容で新しい受験セッション（コードとリンクは新規）を作成し、選んだクラスに紐づけます。',
    examAttachSelectClassLabel: 'クラスを選択',
    examAttachSelectClassPlaceholder: '— クラスを選択 —',
    examAttachSubmit: 'クラスに紐づける',
    examAttachLoadingClasses: 'クラス一覧を読み込み中…',
    examAttachWorking: '受験セッションを作成中…',
    examAttachNoClassesBody:
      'クラスがありません。先にクラスを作成してから、ここに戻ってテストを紐づけてください。',
    examAttachNoOtherClassesBody:
      'このクラス以外にクラスがありません。コピーを紐づけるには別のクラスを作成してください。',
    examAttachFailed: 'テストを紐づけられませんでした。しばらくしてから再度お試しください。',
    examAttachSuccessSummary: '新しいセッションを次に紐づけました：{classLine}。',
    examAttachClose: '閉じる',
    examAttachPickAnotherClass: '他クラスにも紐づける',
    examAttachExamLabel: 'テスト',
    examAttachAllClassesAlreadyAttachedBody:
      '担当クラスにはすべてこのテストのセッション（同じ問題）があります。これ以上紐づけられるクラスはありません。',
    examAttachNeedDifferentClassHint:
      '目的のクラスがありませんか？新しいタブでクラスを作成し、下の「クラス一覧を更新」を押してください。',
    examAttachReloadClassList: 'クラス一覧を更新',
    examAttachOpenCreateClassNewTab: 'クラスを作成（新しいタブ）',
    examAttachClassAlreadyHasExam: 'このクラスにはすでにこのテストがあります。',
    examIdentityFromClassHint:
      'クラス名簿に氏名・生年月日が登録済みです。準備ができたら開始を押してください。タイマーは開始後に動きます。',
    examChangeIdentityManual: '別の氏名・生年月日を入力',
    examManualIdentityIntro: '情報を入力して開始を押してください。タイマーは開始後に動きます。',
    examStartTestButton: 'テストを開始',
    examOneAttemptNote:
      'アカウントごとに1回です。開始後はサーバー側でセッションが固定され、別の並びの問題は取得できません。退出するには提出が必要です。',
    examStartHomeworkButton: '宿題を始める',
    homeworkIdentityFromClassHint:
      'クラスに登録した氏名・生年月日があります。準備ができたら開始を押してください。タイマーは開始後に動きます。',
    homeworkManualIdentityIntro:
      '情報を入力して開始を押すと宿題に取り組みます。タイマーは開始後に動きます。',
    homeworkEnrollGateTitle: 'クラスに参加して宿題に取り組む',
    homeworkEnrollGateDescription:
      'この宿題はクラスに紐づいています。名簿と同じ氏名・生年月日を入力してください（Google の表示名は使わないでください）。その後、宿題を始められます。',
    homeworkEnrollSubmitButton: 'クラスに参加して宿題を始める',
    homeworkDefaultTitle: '宿題',
    lamBaiLoadingNeutral: '読み込み中…',
    lamBaiFiveMinWarning: '残り5分です。終了前に解答を確認してください。',
    lamBaiTimerTimeUpAutoSubmittingExam: '時間切れです。解答を自動送信しています。',
    lamBaiTimerTimeUpAutoSubmittingHomework: '時間切れです。宿題を自動送信しています。',
    lamBaiTimerStickySubmittingExam: '時間切れ — 送信中…',
    lamBaiTimerStickySubmittingHomework: '時間切れ — 送信中…',
    lamBaiExitBlockedBanner:
      '受験中です。提出後にページを離れるのが安全です。タブを閉じる・更新・戻るはブロックまたは警告されます。終了するには提出してください。一度離れて戻っても、タイマーは「開始」を押した時刻から進み続けます。',
    lamBaiExitBlockedBeforeStartHint:
      '「開始」を押した後は、提出してからページを離れるのがよいです。タブを閉じる・再読み込み・離脱しようとするとブラウザが警告します。一度離れて戻っても大丈夫ですが、タイマーは「開始」を押した時刻から進み続けます。',
    lamBaiExitBlockedDialogTitle: '提出が必要です',
    lamBaiExitBlockedDialogDescription:
      '受験中です。安全に離れるには提出してください。「今すぐ提出」か、ページ下部の提出ボタンを使ってください。',
    lamBaiExitBlockedSubmitNow: '今すぐ提出',
    lamBaiExitBlockedStay: '続ける',
    lamBaiExamResumeNotice:
      '未提出の受験があります。保存された解答を復元しました。続けて最後に提出してください。',
    examBeginStarting: '開始しています…',
    examBeginFailed: '受験を開始できませんでした。もう一度お試しください。',
    examSubmitSending: '送信中…',
    examSubmitButton: '提出する',
    homeworkSubmitSending: '宿題を送信中…',
    homeworkSubmitButton: '宿題を送る',
    homeworkLoadFailed: '宿題を読み込めませんでした。',
    lamBaiQuestionLabel: '問{index}.',
    examSubmittedTitle: '提出済み',
    examSubmittedSavedEarlier: 'このテストはすでに提出済みです。保存された結果は以下のとおりです。',
    examSubmittedDueToDeadlineHint:
      'サーバー上の制限時間が終了しました。保存された解答で自動提出されました。結果は以下です。',
    homeworkSubmittedTitle: '宿題を提出しました',
    homeworkSubmittedSavedEarlier: 'この宿題はすでに提出済みです。保存された情報は以下のとおりです。',
    homeworkSubmittedBody:
      '練習用の宿題のため、生徒には点数や評価尺度を表示しません。教師は授業で内容を確認・講評できます。',
    homeworkMcCorrectOnlyLine: '選択問題：{correct}/{total} 問正解',
    homeworkShareLine: '提出済み：{title}',
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
    examSessionCreatedAt: '作成 {time}',
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
    classExamsIndexTitle: 'クラスのテスト',
    classExamSessionPageTitle: 'テストの詳細',
    classExamGoToSession: '採点ページを開く',
    classDetailSeoDescription: 'クラスページ：テスト、メンバー、成績。',
    classHubCardAssignWorksheetDesc:
      'このクラス向けに作成・紐づけた宿題の一覧です。生徒はリンクまたはコードから取り組みます。',
    classPageStudentFacingNotSet: '未設定',
    classHubCardStudentWorksheetsDesc:
      '先生からの宿題：リンクまたはセッションコードから解答ページで取り組みます。',
    classHubCardCreateExamButton: 'テストを作成',
    classHubCardCreateHomeworkButton: '宿題を作成',
    worksheetLamBaiNoInteractiveHint:
      'このワークシートには、Web上で解答できる選択・記述形式の設問がありません（教師が教材ツールで設問を紐付ける必要があります）。ここでは提出できません。',
    worksheetLamBaiBackToClassWorksheets: 'クラスのワークシート一覧へ',
    worksheetLamBaiMcqSectionTitle: '選択問題',
    worksheetLamBaiEssaySectionTitle: '記述問題',
    worksheetLamBaiEssayPlaceholder: '回答を入力…',
    worksheetSubmitNoInteractiveError:
      'オンライン設問がありません。教師が先に設問を紐付けてください。',
    assignWorksheetNoQuestionBankHint:
      '問題バンクからの設問が未紐付けです。学生はWebで解答・提出できません。',
    assignWorksheetOpenInCurriculumTool: '教材ツールで開く',
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
  weddingCardAiMusic: {
    playStartLabel: '再生開始位置',
    playEndLabel: '終了 / ループ位置',
    playStartPlaceholder: '空欄か 0 · 30 · 1:30（空欄 = 曲の最初から最後まで）',
    playEndPlaceholder: '空欄 = 曲の終わりまで（トリムなし）',
    segmentHint:
      'どちらも未入力なら曲全体を最初から最後までそのまま再生します。入力すると区間指定：秒（30）または 分:秒（1:30）。終了を入れるとその範囲でループします。「保存」で反映します。',
    useCurrentPlaybackAsStart: '今の再生位置を開始に設定',
    playbackLoadFailed:
      '音楽を読み込めませんでした（ファイルがない可能性）。招待状の作成者は編集画面からBGMを再アップロードしてください。',
    publicFabPauseAria: 'BGMを停止',
    publicFabPlayAria: 'BGMを再生',
    publicMapEmbedTitle: '披露宴会場の地図',
  },
  weddingCardCalendar: {
    sectionTitle: '披露宴のご案内',
    introLine: 'パーティーのお時間:',
    receptionLabel: '受付・ご入場',
    partyLabel: '披露宴開始',
    timePlaceholderDash: '—',
  },
  weddingGiftBox: {
    boxTitle: 'ご祝儀ボックス',
    tapToOpen: 'タップして開く',
    dialogTitle: 'ご祝儀のお振込 — VietQR',
    brideSection: '新婦',
    groomSection: '新郎',
    accountHolder: '口座名義',
    accountNumber: '口座番号',
    bankSelectPlaceholder: '銀行を選択',
    vietqrFooterNote: '銀行アプリでスキャン（VietQR）してください。',
    closeButton: '閉じる',
    envelopeButtonAria: 'ご祝儀ボックスを開いてQRコードを表示',
    editorHint:
      'オンにしたら、新郎・新婦それぞれの銀行・口座番号・名義を入力すると2枚の VietQR が生成されます。または下にQR画像URL（従来方式）でも可。',
    legacyImageLabel: 'QR画像URL（オプション・1枚のみ）',
    legacyImageDesc: '上記の二つの VietQR を使わないとき用です。',
    saveNeedConfig:
      'ご祝儀QRオン：新郎・新婦の情報を両方入れるか、QR画像URLを入力してください。',
    qrAltBride: '振込用QR — 新婦',
    qrAltGroom: '振込用QR — 新郎',
    qrAltLegacy: 'ご祝儀QR',
  },
  weddingCardAiBrief: {
    step2Description:
      '内容の編集とプレビューは無料です。変更は約1秒後に自動保存されます。「保存」を押してすぐ保存することもできます。',
    autoSavedLabel: '自動保存しました',
    autoSaveFailedLabel: '自動保存できませんでした。接続を確認するか「保存」を押してください。',
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
    openCreatedExamsListButton: '作成済みテスト一覧を開く',
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
    homeworkPageTitle: '宿題を作成',
    homeworkPageSubtitle:
      'オンライン試験と同じ手順（科目・クラス・問題・QR/リンク）で、合計100点の配分は不要。提出後も生徒に点数は表示しません。',
    defaultHomeworkTitle: '宿題',
    homeworkCreatedBadge: '宿題を作成しました',
    createHomework: '宿題を作成',
    createAnotherHomework: '別の宿題を作成',
    createdHomeworkListTitle: '作成した宿題',
    createdHomeworkHint: 'リンクまたはQRで生徒に解答してもらえます。試験と同様に他クラスへも割り当て可能です。',
    openCreatedHomeworkListButton: '宿題一覧を見る',
    homeworkCreateSuccess: '宿題を作成しました',
    homeworkCreateSuccessDesc: 'リンクまたはQRコードを生徒に共有してください。',
    homeworkEssayNo100Note:
      '必要に応じて記述問題を選びます。提出後も得点は見せません。1問あたりの時間や配点の設定は不要です。',
    homeworkCardInfo: '宿題の情報',
    homeworkFormCardDescription:
      '教科・クラス・教師用カリキュラムから問題を選びます。試験時間や配点の設定は不要です。解答は保存され、生徒には得点を表示しません。',
    homeworkTitlePlaceholder: '数学の宿題 — 復習',
    homeworkQuizPartFooterHint:
      '難易度ごとの問題数を入力し、下の一覧から同数を選びます。宿題ではここで分や配点を調整する必要はありません。',
    noHomeworkSessionsYet: 'まだ宿題がありません。',
    homeworkCreatedResultLine: '全{count}問',
    homeworkSummaryMc: '選択問題：{count}問',
    homeworkSummaryEssay: '記述：{count}問',
    homeworkDeleteConfirm: 'この宿題を削除しますか？この操作は取り消せません。',
    homeworkDeleted: '削除しました',
    homeworkDeletedDesc: '宿題を削除しました。',
  },
  adminWorksheetVerify: {
    pageTitle: 'ワークシート検証レポート',
    pageDescription:
      '未検証の設問があるワークシートを走査し、AI（Gemini Flash）で検証してバッチごとに集計します。手動ステップまたは cron（.env.example 参照）で実行できます。',
    reportScopeNote:
      'カリキュラム作成後のバックグラウンド検証も、サーバーがバックグラウンド検証向けに設定されている場合はここに記録されます。以前はバッチ/cron のみでした。記録が無い場合は環境を確認し、検証を再実行してください。',
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
    inviteFriends: '친구 초대',
    viewPlan: '요금제 보기',
    topUpCredits: '크레딧 충전',
    tasksHub: '작업 및 대기열',
    supportChat: '고객 채팅',
    partnerInbox: '비즈니스 채널',
    partnerApiIntegration: 'API 연동(점주)',
    customerApiKeys: 'AI 플랫폼 임대',
    myChats: '매장과 메시지',
    myOrders: '내 주문',
    downloadApp: '앱 받기',
    downloadAppSubtitle:
      '웹 앱(PWA)입니다. 홈 화면에 추가해 네이티브처럼 쓸 수 있습니다. Android는 Chrome, iPhone/iPad는 Safari를 쓰세요.',
    downloadAndroidTitle: 'Android (Chrome)',
    downloadAndroidChromeHint:
      'Chrome 메뉴에 ‘앱 설치’ 또는 ‘홈 화면에 추가’가 나타나는 경우가 많습니다.',
    downloadAndroidStep1: 'Chrome에서 NanoAI(nanoai.vn)를 엽니다.',
    downloadAndroidStep2: '오른쪽 위 메뉴 ⋮(점 세 개)를 누릅니다.',
    downloadAndroidStep3: '‘앱 설치’ 또는 ‘홈 화면에 추가’를 고르고 확인합니다.',
    downloadIosTitle: 'iPhone / iPad',
    downloadIosSafariHint: 'Safari 사용을 권장합니다.',
    downloadIosStep1: 'Safari에서 NanoAI(nanoai.vn)를 엽니다.',
    downloadIosStep2: '하단 도구 모음에서 공유(위쪽 화살표가 있는 사각형)를 누릅니다.',
    downloadIosStep3: '「홈 화면에 추가」를 선택한 뒤 「추가」를 누릅니다.',
  },
  referral: {
    pageTitle: '친구 초대 – 크레딧 받기',
    metaDescription:
      'NanoAI를 공유하세요. 링크로 신규 가입이 있으면 초대한 분에게만 2 크레딧이 지급됩니다.',
    headline: '친구에게 NanoAI 소개',
    description:
      '개인 초대 링크를 복사하세요. 신규 사용자가 그 링크로 가입하면(계정 생성 후 30일 이내) 초대자인 여러분에게 2 크레딧. 피초대자 1인당 1회.',
    yourLinkLabel: '내 초대 링크',
    copyButton: '링크 복사',
    copied: '복사됨',
    howItWorksTitle: '이용 방법',
    step1: '초대 코드가 포함된 링크를 친구에게 보냅니다.',
    step2: '상대가 링크를 열고 계정 생성 후 30일 이내에 NanoAI에 가입/로그인합니다.',
    step3: '초대자(나)에게 2 크레딧을 지급합니다. 피초대자는 본 추천 프로그램 크레딧을 받지 않습니다.',
    bonusNote: '조건을 충족하는 신규 계정만 초대자 보상에 해당. 피초대자는 1인 1회만 집계.',
    inviteVisualYou: '나(초대자)',
    inviteVisualFriend: '피초대자',
    inviteeNoReferralCredit: '추천 크레딧 없음',
    errorGeneric: '지금은 초대 보너스를 적용할 수 없습니다. 잠시 후 다시 시도해 주세요.',
  },
  accountPlan: {
    pageTitle: '이용 요금제',
    metaDescription:
      '7일 무료 체험과 교과·출제 월 이용료를 확인합니다. 영어 AI는 회·수업마다 별도 차감. AI 크레딧은 별도입니다.',
    headline: '현재 요금제',
    billingPeriod: '월 정산 기간(베트남 달력): {period}',
    trialSectionTitle: '무료 체험',
    trialActiveLine: '체험 기간 중입니다. 아래 교과·출제의 월 이용료는 아직 차감되지 않습니다.',
    trialTotalDaysNote: '체험 기간: 가입 시점부터 {days}일.',
    trialDaysLeft: '약 {days}일 남음.',
    trialEndsAtLine: '체험 종료(예상): {datetime}',
    trialNotActive:
      '첫 7일 체험이 끝났습니다. 교과·출제 월 이용료는 해당 기간마다 크레딧으로 차감됩니다.',
    servicesSectionTitle: '교과·출제 — 월(크레딧)',
    productEnglishCoach: '영어 AI 학습',
    englishCoachPayPerLesson:
      '월 구독료는 없습니다. 세션이나 수업을 시작할 때마다 크레딧이 별도로 차감됩니다(금액은 학습 화면에 표시).',
    productCurriculum: '교과서·문제 만들기',
    statusViaTrial: '체험 중 — 월 이용료 미차감.',
    statusAccessOn: '현재 이 서비스를 이용할 수 있습니다.',
    statusPaidMonth: '기간 {period} 월 이용료 차감 완료.',
    statusPendingPayment: '미차감 — 기간 {period}에 {credits} 크레딧 필요.',
    noteSignupBonus: '가입 시 {credits} 크레딧 지급(AI용, 월 이용료와 별도).',
    noteAiCredits: 'AI를 쓰는 기능은 사용할 때마다 AI 크레딧이 별도로 차감됩니다.',
    refresh: '새로고침',
    loading: '불러오는 중…',
    errorLoad: '요금제 정보를 불러오지 못했습니다. 새로고침해 보세요.',
    errorConfig: '서버 설정이 완전하지 않습니다. 잠시 후 다시 시도하세요.',
    monthlyCostLine: '기간당 {credits} 크레딧 · 약 {vnd}₫',
    backDashboard: '대시보드로',
    linkWallet: '지갑에서 크레딧 충전',
  },
  push: {
    bannerTitle: '휴대폰 알림 받기',
    bannerHint:
      'NanoAI를 설치된 앱(PWA)으로 사용 중입니다. 알림을 켜면 앱을 열지 않아도 결제·보상·처리 결과 등을 바로 받을 수 있습니다.',
    enable: '알림 켜기',
    later: '나중에',
    enabledToast: '푸시 알림이 켜졌습니다',
    bellEnableHint: '앱 알림과 시스템 푸시는 다릅니다. NanoAI를 열지 않아도 받으려면 푸시를 켜세요.',
    bellEnableButton: '푸시 알림 켜기',
    bellSubscribedShort: '이 기기에서 푸시가 켜져 있습니다',
    bellDeniedHint: '알림이 차단되었습니다. 브라우저 설정에서 NanoAI 알림을 허용하세요.',
    bellSyncHint: '알림은 허용됐지만 서버에 이 기기가 없습니다. 동기화를 누르세요.',
  },
  supportChat: {
    pageTitle: '고객 지원 채팅',
    metaDescription:
      'NanoAI 팀에 메시지를 보냅니다. 웹훅을 설정하면 Facebook Messenger·Zalo OA와 동기화됩니다.',
    brandBadge: 'NanoAI',
    headline: '채팅으로 문의',
    subline:
      '이 페이지의 메시지는 고객 케어 수신함으로 모입니다(서버에서 Facebook/Zalo 연동 시).',
    loginRequired: '지원팀에 문의하려면 로그인하세요.',
    loginSupportingLine: 'NanoAI 계정으로 로그인한 뒤 이 페이지에서 메시지를 보낼 수 있습니다.',
    loginLink: '로그인',
    placeholder: '메시지 입력…',
    send: '보내기',
    emptyThread: '아직 메시지가 없습니다. 아래에서 첫 질문을 보내세요.',
    loadError: '대화를 불러오지 못했습니다.',
    sendError: '전송에 실패했습니다.',
    pollNote: '관리자 답변이 몇 초 지연될 수 있습니다. 페이지를 새로고침해도 됩니다.',
    sendKeyboardHint: 'Enter로 전송 · Shift+Enter로 줄 바꿈',
    messageProductCardOpenProduct: '상품 보기',
    messageProductCardViewDetails: '자세히 보기',
  },
  customerCareAdmin: {
    pageTitle: '고객 케어',
    pageDescription:
      'NanoAI 플랫폼 수신함만 표시(지원 채팅 및 플랫폼 연동 Facebook/Zalo). 각 샵 수신함은 대시보드 → 메시지; 고객으로 샵과 채팅은 내 메시지 — 서로 섞이지 않습니다.',
    inboxTitle: '대화(플랫폼)',
    pickConversation: '대화를 선택하면 메시지가 표시됩니다.',
    replyPlaceholder: '답장 작성…',
    send: '보내기',
    refresh: '새로고침',
    channelFacebook: 'Facebook',
    channelZalo: 'Zalo',
    channelInternal: 'NanoAI',
    channelWidget: '웹(임베드)',
    unknownUser: '고객',
    sendFailed: '전송 실패',
    noMessages: '메시지가 없습니다.',
    sendKeyboardHint: 'Enter로 전송 · Shift+Enter로 줄 바꿈',
    messageProductCardOpenProduct: '상품 보기',
    messageProductCardViewDetails: '자세히 보기',
  },
  partnerMessaging: {
    pageTitle: '파트너 고객 메시지',
    pageDescription:
      '매장용 워크스페이스: Facebook 페이지, Zalo OA, NanoAI 웹 채팅 또는 사이트 API 임베드로 고객 문의를 한 수신함에서 관리합니다.',
    cardTitle: '고객 수신함(파트너)',
    cardDescription: 'Facebook, Zalo, NanoAI 웹 채팅, 임베드 채팅을 한 수신함에서.',
    createWorkspace: '메시징 워크스페이스 만들기',
    workspaceNameLabel: '매장 / 브랜드 이름',
    workspaceLabel: '워크스페이스',
    createButton: '만들기',
    saveOk: '저장되었습니다.',
    channelsSection: '채널(Facebook 및 Zalo)',
    fbPageId: 'Facebook Page ID',
    fbPageToken: '페이지 액세스 토큰',
    fbVerifyToken: '검증 토큰(Webhook GET)',
    saveFacebook: 'Facebook 저장',
    zaloSecret: 'Webhook 시크릿(헤더)',
    zaloToken: 'OA 액세스 토큰',
    saveZalo: 'Zalo 저장',
    embedSection: '자사 사이트 익명 임베드 API(선택)',
    embedHint:
      '매장 도메인에서 API를 호출합니다(CORS 허용). 브라우저마다 localStorage의 고정 UUID를 X-Session-Id로 보냅니다.',
    embedHeadersHelp:
      '헤더에 X-Embed-Key(위 키)와 X-Session-Id(방문자 브라우저의 고정 UUID)를 보내세요.',
    embedAnonymousFootnote:
      'NanoAI 로그인을 쓰지 않습니다. 매장은 실제 신원을 알 수 없고 Google 계정과도 연동되지 않습니다. NanoAI를 직접 열 때와 같은 로그인(「내 메시지」 포함)을 원하면 위 링크나 iframe을 사용하세요.',
    inboxTitle: '고객 대화',
    inboxSearchPlaceholder: '이름 또는 메시지로 검색…',
    inboxNoSearchResults: '일치하는 대화가 없습니다.',
    inboxSideInfoTab: '정보',
    inboxSideOrderTab: '주문 생성',
    inboxSideNoNotes: '메모가 아직 없습니다',
    inboxSideNotePlaceholder: '메모 입력(Enter 저장)',
    inboxSideOrderEmpty: '주문 내역이 없습니다',
    inboxSideCreateOrder: '주문 생성',
    pickConversation: '대화를 선택하세요.',
    replyPlaceholder: '답장 작성…',
    send: '보내기',
    refresh: '새로고침',
    channelFacebook: 'Facebook',
    channelZalo: 'Zalo',
    channelWidget: '웹',
    unknownUser: '고객',
    noMessages: '메시지가 없습니다.',
    inboxShopDrafting: '매장에서 답장을 작성 중입니다',
    replyKeyboardHint: 'Enter로 전송 · Shift+Enter로 줄 바꿈 · Ctrl+V / Cmd+V로 이미지 붙여넣기',
    messageProductCardOpenProduct: '상품 보기',
    messageProductCardViewDetails: '자세히 보기',
    partnerAttachPhoto: '사진 보관함',
    partnerTakePhoto: '사진 촬영',
    partnerRemoveAttachmentAria: '첨부 이미지 제거',
    partnerCaptionHint: '보내기 전 아래에 설명을 추가할 수 있습니다.',
    partnerUploading: '이미지 업로드 중…',
    partnerImageTooLarge: '이미지가 너무 큽니다(최대 약 3 MB).',
    partnerImageInvalidType: '지원하지 않는 이미지 형식입니다.',
    nanoaiHostedSection: 'NanoAI에서 채팅 — 직접 이용과 동일한 로그인(권장)',
    nanoaiHostedHint:
      '고객은 NanoAI에서 Google 로그인이 필요하며, 플랫폼을 직접 쓸 때와 같습니다. 한 계정으로 기기 간 동기화되며 /messaging/my-chats에서 매장 목록을 볼 수 있습니다. 대화는 기존과 같이 수신함에 표시됩니다.',
    nanoaiHostedUrlLabel: '채팅 링크',
    nanoaiHostedIframeTitle: '자사 사이트에 넣기(iframe)',
    nanoaiHostedIframeTitleAttr: 'NanoAI 채팅',
    nanoaiHostedIframeHelp:
      'HTML에 붙여 넣으세요. 고객은 NanoAI 프레임 안에서 채팅·로그인(퍼스트파티 쿠키)하며 익명 임베드 API에 의존하지 않습니다.',
    copyHostedChatLinkButton: '채팅 링크 복사',
    hostedChatLinkCopiedToast: '채팅 링크를 복사했습니다.',
    copyIframeSnippetButton: 'iframe 코드 복사',
    iframeSnippetCopiedToast: 'iframe 코드를 복사했습니다.',
    integrationSectionTitle: '추적 태그 및 임베드 코드',
    integrationSectionHint:
      'Google 태그, Facebook Pixel, 채팅 임베드 코드를 붙여 넣는 영역입니다. 아래에서 NanoAI 채팅 임베드 코드를 빠르게 복사할 수 있습니다.',
    googleTagLabel: 'Google 태그 (GA4 / GTM)',
    googleTagPlaceholder: '예: G-XXXXXXXXXX 또는 GTM-XXXXXXX',
    facebookPixelLabel: 'Facebook Pixel / Meta Pixel',
    facebookPixelPlaceholder: '예: 123456789012345',
    metaConsultTrackingSection: 'Meta Pixel 및 Conversions API(상품 상담 페이지)',
    metaConsultTrackingHint:
      '고객이 상품별 상담 링크(/tu-van/… 또는 ?ctx_inventory= 채팅)를 열면 Pixel과 서버에 동일한 ViewContent를 보냅니다(event_id로 중복 제거).',
    metaConsultCapiTokenLabel: 'Conversions API 액세스 토큰(서버)',
    metaConsultCapiTokenPlaceholder: 'Meta Events Manager에서 토큰 붙여넣기',
    metaConsultCapiConfiguredBadge: '토큰 저장됨',
    metaConsultCapiSavedHint:
      '저장 후 입력란은 비워 둡니다(보안상 다시 표시하지 않음). 토큰은 서버에 남아 있습니다. 바꿀 때만 붙여 넣고, Pixel ID만 바꿀 때는 비워 두세요.',
    metaConsultSaveButton: 'Pixel 및 CAPI 저장',
    shopGa4MeasurementLabel: 'Google Analytics 4(GA4) 측정 ID',
    shopGa4MeasurementHint:
      'G-… ID를 입력하면 상담/샵 페이지 방문을 측정합니다. GA4에서 보고서 → 실시간으로 현재 사용자 수를 확인하세요.',
    shopGa4MeasurementPlaceholder: '예: G-XXXXXXXXXX',
    shopGa4InvalidIdToast: 'GA4 ID 형식이 올바르지 않습니다. 형식: G-XXXXXXXXXX',
    shopGa4SaveButton: 'GA4 ID 저장',
    facebookCatalogFeedTitle: 'Facebook — 상품 카탈로그 피드(CSV)',
    facebookCatalogFeedHint:
      '커머스 관리자 데이터 소스 URL에 붙여 넣습니다. link 열은 NanoAI 상담 페이지이며 쇼핑몰 사이트 링크가 아닙니다. 이미지 URL·VND 가격 필요. key는 임베드 키로 비공개 유지.',
    facebookCatalogFeedCopyButton: '피드 URL 복사',
    facebookCatalogFeedCopiedToast: '피드 URL을 복사했습니다.',
    nanoaiEmbedCodeLabel: 'NanoAI 채팅 임베드 코드',
    facebookChatEmbedCodeLabel: 'Facebook 채팅 임베드 코드',
    zaloChatEmbedCodeLabel: 'Zalo 채팅 임베드 코드',
    embedCodePlaceholder: 'script / iframe / 플러그인 코드를 여기에 붙여 넣으세요…',
    copyNanoaiEmbedButton: 'NanoAI 채팅 코드 복사',
    copyFacebookChatEmbedButton: 'Facebook 채팅 코드 복사',
    copyZaloChatEmbedButton: 'Zalo 채팅 코드 복사',
    addAnotherWorkspace: '워크스페이스 추가',
    cancelAddWorkspace: '취소',
    deleteWorkspaceButton: '워크스페이스 삭제',
    deleteWorkspaceConfirm: '경고: 이 워크스페이스를 삭제하면 복구할 수 없습니다. 확인하려면 "XOA"를 입력하세요.',
    deleteWorkspaceSuccess: '워크스페이스를 삭제했습니다.',
    deleteWorkspaceOtpIntro:
      'Your workspace will be scheduled for deletion after a grace period. While waiting, the shop will not accept customer messages. We will email a one-time code to your login address.',
    deleteWorkspaceOtpSend: 'Send OTP email',
    deleteWorkspaceOtpLabel: 'OTP code (6 digits)',
    deleteWorkspaceOtpConfirm: 'Confirm scheduled deletion',
    deleteWorkspaceScheduledBanner:
      'This workspace is scheduled for deletion and is not accepting inbound messages. You can cancel from Messaging settings before the deadline.',
    deleteWorkspaceCancelSchedule: 'Cancel deletion schedule',
    deleteWorkspaceOtpSentToast: 'OTP sent to your email.',
    deleteWorkspaceScheduleCancelled: 'Scheduled deletion cancelled.',
    teamStaffSectionTitle: '워크스페이스 팀원',
    teamStaffSectionHint:
      'NanoAI 로그인 이메일로 초대합니다. 권한은 최소만 부여하고, 민감 항목은 신뢰하는 사람에게만 허용하세요.',
    badgeStaffWorkspace: '초대됨',
    teamInviteEmailLabel: '로그인 이메일',
    teamInviteEmailPlaceholder: 'user@example.com',
    teamInviteButton: '초대',
    teamStaffListTitle: '팀원 목록',
    teamRemoveMember: '제거',
    teamSavePermissions: '권한 저장',
    teamInviteErrorNotFound:
      '해당 이메일 계정을 찾을 수 없습니다. 초대대상은 NanoAI 계정과 확인된 로그인 이메일이 필요합니다.',
    teamInviteErrorBadEmail: '이메일 형식이 올바르지 않습니다.',
    teamInviteErrorOwner: '워크스페이스 또는 샵 소유자 계정은 초대할 수 없습니다.',
    teamInviteOk: '초대되었습니다.',
    teamStaffRestrictedNote:
      '직원 역할입니다. 결제·임베드 API·워크스페이스 삭제 등 민감 설정은 소유자만 변경할 수 있습니다.',
    teamPermInbox: '고객 수신함',
    teamPermOrders: '주문',
    teamPermInventory: '재고',
    teamPermAiSettings: 'AI 설정',
    teamPermWorkspaceBranding: '브랜드·로고',
    teamPermWorkspacePayment: '채팅 결제',
    teamPermIntegrationsChannels: 'Facebook / Zalo 채널',
    teamPermIntegrationsAnalytics: 'Meta Pixel / GA4 / 카탈로그',
    teamPermUsageReports: '사용 리포트',
    integrationsAnalyticsOwnerOnly:
      'Pixel·Conversions API·GA4 저장은 워크스페이스 소유자만 할 수 있습니다.',
    teamRemoveMemberConfirm: '이 구성원을 워크스페이스에서 제거할까요?',
    fbLinkedLine: 'Facebook Page 연결됨: {pageId}',
    zaloLinkedLine: 'Zalo OA webhook 및 토큰이 저장되었습니다.',
    credentialsKeepHint: '바꾸지 않을 토큰이나 시크릿은 비워 두면 저장된 값이 유지됩니다.',
    setupColumnTitle: '채널 및 AI 어시스턴트',
    chatColumnTitle: '고객 채팅',
    messagingSettingsLink: '채널·AI 설정',
    messagingSettingsPageTitle: '메시지 설정(매장)',
    messagingInboxDescription: '왼쪽에 고객 목록. 대화를 열면 입력창이 화면 하단에 고정됩니다.',
    noWorkspaceInboxCta: '메시징 워크스페이스가 없습니다. 설정에서 매장을 만들고 Facebook / Zalo / 채팅을 연결하세요.',
    goToInbox: '받은편지함으로',
    inboxMobileBackAria: '대화 목록으로',
    apiIntegrationGuideLink: 'API 연동 안내(키 및 엔드포인트)',
    apiIntegrationGuideShort: '매장 사이트 연동용: 임베드 채팅, 이미지 상품 검색, B2B 피팅 API.',
    messagingSettingsApiHubCardTitle: '임베드 채팅 및 API',
    messagingSettingsApiHubCardBody:
      '호스팅 URL, iframe 스니펫, 임베드 엔드포인트, 키, 개발자 문서는 「API 연동」 페이지로 옮겼습니다 — 이 설정 화면에는 더 이상 표시하지 않습니다.',
    customerCareShopSetupGuideTitle: '고객 응대 매장 만들기 안내',
    customerCareShopSetupGuideBody:
      '1단계 — 대시보드 → 메시지 → 채널·AI 설정(이 페이지)으로 이동합니다.\n\n2단계 — «메시징 워크스페이스 만들기»에서 표시 이름, 브랜드 이름, 업종을 입력합니다. 로고는 URL을 넣거나 이미지를 업로드할 수 있습니다.\n\n3단계 — «만들기»를 누릅니다. 이것이 매장 워크스페이스입니다. Facebook 페이지, Zalo OA, NanoAI 호스팅 채팅, 사이트에 임베드한 채팅의 메시지가 모두 같은 받은편지함으로 들어옵니다.\n\n4단계 — 이어서 채널(Facebook/Zalo)을 연결하고 호스팅 채팅 링크 또는 iframe 코드를 복사한 뒤, 같은 설정 페이지에서 AI 어시스트와 재고를 선택적으로 켤 수 있습니다.',
  },
  partnerMessagingOrders: {
    pageTitle: '채팅 주문 관리',
    pageDescription: '채팅 위젯에서 생성된 주문 목록입니다.',
    introLine: '채팅에서 만든 주문을 추적하고, 필요 시 수동 확인 후 상태를 업데이트합니다.',
    allWorkspaces: '모든 워크스페이스',
    allStatuses: '모든 상태',
    searchPlaceholder: '주문번호 / 고객명 / 전화 / 상품으로 검색',
    exportExcel: 'Excel 내보내기',
    exportExcelTitle: '워크스페이스·상태·선택한 기간(선택)에 맞는 모든 주문 내보내기(빠른 검색 제외).',
    reload: '새로고침',
    filterCreatedFrom: '시작일',
    filterCreatedTo: '종료일',
    summaryTitle: '필터 요약(워크스페이스 + 상태 + 주문일)',
    summaryDescription:
      '필터에 맞는 전체 주문(아래 목록의 200건 제한 없음). 날짜는 베트남 시간·주문 생성일 기준. 둘 다 비우면 날짜 제한 없음. 빠른 검색은 이 페이지 목록만 걸러내며 여기 숫자는 바뀌지 않습니다.',
    statOrders: '주문 수',
    statSubtotal: '상품 합계',
    statSubtotalHint: '소계 합계',
    statRequired: '예치금 / 청구액',
    statRequiredHint: '주문별 설정',
    statPaid: '입금(기록)',
    statPaidHint: '고객 송금 / 시스템 기록',
    statOutstanding: '미수(추정)',
    statOutstandingHint: '미취소: max(0, 상품금액 − 입금)',
    statusAwaitingPayment: '결제 대기',
    statusPaymentChecking: '대사 중',
    statusPaidVerified: '결제 확인됨',
    statusPendingManualReview: '수동 검토 필요',
    statusCancelled: '취소됨',
    emptyList: '주문이 없습니다.',
    emptyFiltered: '필터와 일치하는 주문이 없습니다.',
    shippingPending: '확인 대기',
    shippingConfirmed: '주문 확인됨',
    shippingPacking: '포장 중',
    shippingShipping: '배송 중',
    shippingDelivered: '배송 완료',
    shippingReturned: '반품/환불',
    shippingCancelled: '취소됨',
    proofVerified: '증빙: 일치',
    proofManualReview: '증빙: 수동 검토',
    proofFailed: '증빙: 불일치',
    proofPending: '증빙: 처리 중',
    proofNone: '증빙: 없음',
    labelWorkspace: '워크스페이스',
    labelCustomer: '고객',
    labelEmail: '이메일',
    labelAddress: '주소',
    labelProduct: '상품',
    labelMoneyPrefix: '금액',
    moneyLine: '소계 {subtotal} · 청구 {required} · 기록 {paid}',
    openProduct: '상품 열기',
    openProofImage: '증빙 이미지 열기',
    openInbox: '받은편지함 열기',
    openChat: '채팅 열기',
    orderLocked: '주문 잠금',
    notePlaceholder: '확인 메모 / 사유(선택)',
    btnConfirmPaid: '결제 확인',
    btnMarkManualReview: '수동 검토 필요로 표시',
    btnCancelOrder: '주문 취소',
    btnViewTimeline: '타임라인 보기',
    timelineTitle: '주문 타임라인',
    timelinePickOrder: '왼쪽에서 주문을 선택하면 이벤트 기록을 볼 수 있습니다.',
    timelineNoEvents: '이벤트가 없습니다.',
    timelineLoading: '기록을 불러오는 중…',
    toastStatusUpdated: '주문 상태를 업데이트했습니다.',
    toastShippingUpdated: '배송을 업데이트하고 채팅에 알렸습니다.',
    toastExportDone: '{count}건을 다운로드했습니다({filename}).',
    depositNone: '미입금',
    depositPartial: '부분 입금',
    depositFull: '입금 완료',
    pathSepay: '{shop}(자동)',
    pathManual: '계좌이체 · 영수증 사진',
    sepayAutoHint: '{shop} 시스템으로 자동 대사 — 거래 캡처 불필요.',
    proofReceiptShortVerified: '영수증: 일치',
    proofReceiptShortPending: '영수증: 대기',
    proofReceiptShortFailed: '영수증: 불일치',
    proofReceiptShortManual: '영수증: 수동 검토',
    proofReceiptShortNone: '영수증: 없음',
    tabAll: '전체',
    tabAwaitDeposit: '예치금 대기',
    tabAwaitShip: '발송 대기',
    tabAwaitReceive: '수령 대기',
    tabReceived: '수령 완료',
    tabReviewed: '리뷰 작성',
    tabCancelled: '취소됨',
    tableColOrderCode: '주문번호',
    tableColConsulted: '상담 완료',
    tableColCustomer: '고객',
    tableColSubtotal: '상품 합계',
    tableColDepositRequired: '예치금(청구)',
    tableColPaidAmount: '결제 완료액',
    tableColDueOnDelivery: '수령 시 잔액',
    tableColStatus: '상태',
    tableColOrderDate: '주문일시',
    tableColActions: '작업',
    filterShippingLabel: '배송 상태',
    filterPaymentShort: '결제 상태',
    clearTableFilters: '필터 지우기',
    consultedAria: '상담 완료(이 브라우저에만 저장)',
    reviewedAria: '리뷰 작성됨(이 브라우저에만 저장)',
    expandRow: '펼치기',
    collapseRow: '접기',
    listCapNote: '워크스페이스·날짜 필터 기준 최신 200건까지 표시합니다.',
    consultLocalHint: '이 브라우저에만 저장되며 기기 간 동기화되지 않습니다.',
    badgePayAwaiting: '결제 대기',
    badgePayPartial: '예치 완료',
    badgePayDone: '결제 완료',
    btnConfirmDeposit: '예치 확인',
    tableDetails: '자세히',
    modalTitle: '주문 상세',
    modalInternalIdLine: '내부 주문 ID: {id}',
    modalConsultedCustomer: '고객 상담 연락 완료',
    modalPaymentHeading: '결제',
    modalOrderTotal: '주문 합계',
    modalDepositNeed: '필요 금액',
    modalDepositDeposited: '예치 완료',
    modalCodAfterDeposit: '수령 시 결제 금액(예치 차감 후)',
    modalProductsHeading: '상품',
    modalColImage: '이미지',
    modalColProduct: '상품',
    modalCopyAddress: '복사',
    toastAddressCopied: '주소를 복사했습니다',
    toastAddressCopyFailed: '주소를 복사하지 못했습니다',
    modalSkuPrefix: 'SKU(ID):',
    modalColor: '색상',
    modalSize: '사이즈',
    modalQty: '수량',
    modalOrderUnavailable: '현재 목록에 주문이 없습니다. 새로고침하거나 닫으세요.',
    modalOrderNoteLabel: '주문 메모',
    modalShippingAddressHeading: '배송지 주소',
    modalContactSectionTitle: '고객·주문 처리',
  },
  partnerMessagingAi: {
    panelTitle: 'AI 자동 답장',
    panelSubtitle:
      '고객 메시지 후 설정한 시간 동안 직접 회신을 기다립니다. 시간 내에 회신이 없으면 매장 정책·톤·재고 목록을 바탕으로 AI가 답합니다(일부 메시지는 LLM 외 처리).',
    tabSettings: '설정',
    tabInventory: '재고 상품',
    tabUsage: 'API 토큰',
    usagePeriodLabel: '범위',
    usagePeriodDay: '일',
    usagePeriodWeek: '주',
    usagePeriodMonth: '월',
    usagePeriodScopeDay: '최근 24시간',
    usagePeriodScopeWeek: '최근 7일',
    usagePeriodScopeMonth: '최근 30일',
    usageRangeModeLabel: '보기',
    usageRangeModeRolling: '슬라이딩 구간',
    usageRangeModeCalendar: '날짜 선택(UTC)',
    usageCalendarFromLabel: '시작',
    usageCalendarToLabel: '종료',
    usagePeriodScopeCalendar: '{from}~{to}(UTC, 양끝 포함)',
    usageSectionCreditTitle: '크레딧 차감(지갑·로고)',
    usageSectionCreditIntro:
      '잔액에서 차감된 기록: 지갑 원장(커리큘럼, English coach 등)과 매장 로고 정규화 — 아래 API 토큰 집계와는 별도입니다.',
    usageSectionApiTitle: 'API 사용(토큰·이미지·임베딩)',
    usageSectionApiIntro:
      '받은편지함 LLM, Nano Banana 이미지, 이미지/텍스트 임베딩, 상품 사진에서 소재 추론 등 — usage 로그 기준이며 위 지갑 차감과는 다릅니다.',
    tokenUsageIntro:
      '{scope} 요약입니다. 각 행은 대기 시간 후 LLM으로 답할 때 사용한 API 모델입니다.',
    tokenUsageEmpty: '이 기간에 LLM 호출이 없습니다.',
    tokenUsageColProvider: '제공자',
    tokenUsageColModel: '모델',
    tokenUsageColCalls: '호출 수',
    tokenUsageColPrompt: '입력 토큰',
    tokenUsageColCompletion: '출력 토큰',
    tokenUsageColTotal: '총 토큰',
    tokenUsageColEstimatedCost: '추정 (₫)',
    tokenUsageCostDisclaimer:
      'Gemini Developer API 스타일 단가(백만 토큰당 USD) 기준 추정(일부 모델은 호출당 prompt>20만 구간). 집계 행은 낮은 구간으로 근사. 미등록은 gemini-3-flash-preview. 환율: PARTNER_AI_TOKEN_COST_USD_TO_VND.',
    tokenUsageEstimatedTotalLabel: '추정 합계(약 {amount} ₫)',
    tokenUsageDetailEstimatedTotalLabel: '상세 행 합계(약 {amount} ₫)',
    tokenUsageByKindTitle: '호출 유형(usage_kind)',
    tokenUsageByKindIntro: '모든 LLM 토큰 기록 합산: 받은편지함, 소재 추론, 받은편지함 이미지 생성 등.',
    tokenUsageByDayTitle: '일별(UTC)',
    tokenUsageByDayIntro: 'UTC 기준 일자별 호출 수와 토큰 합계.',
    tokenUsageColDay: '날짜(UTC)',
    tokenUsageCostByKindAndModelTitle: '분기·모델별 상세',
    tokenUsageCostByKindAndModelIntro:
      '각 행은 usage_kind + 모델 쌍이며, 비용(₫)은 집계 토큰으로 산출합니다.',
    tokenUsageCostByWeekTitle: '주별(UTC, 월요일 시작)',
    tokenUsageCostByWeekIntro: '선택한 범위의 날짜를 UTC 주 단위로 묶습니다(주는 월요일 시작).',
    tokenUsageColWeekStart: '주 시작(UTC)',
    tokenUsageCostByMonthTitle: '월별(UTC)',
    tokenUsageCostByMonthIntro: '선택 범위 안에서 UTC 달력 월(YYYY-MM)으로 묶습니다.',
    tokenUsageColMonthUtc: '월(UTC)',
    tokenUsageCostTablesNote:
      '분기·일·주·월(UTC)별 추정 비용(₫) 열이 표시되며, 기간 합계와 동일한 방식으로 계산합니다.',
    usageDetailApiTitle: 'LLM 호출별 상세(받은편지함)',
    usageDetailApiIntro:
      '각 행은 대기 시간 후 한 번의 API 호출과 실제 토큰입니다.',
    usageDetailColTime: '시각',
    usageDetailColUsageKind: '구분',
    usageTokenKindInbox: '받은편지함 LLM',
    usageTokenKindMaterialInfer: '소재 추론(상품 사진)',
    usageDetailEmpty: '이 기간에 상세 호출 기록이 없습니다.',
    usageCreditLedgerTitle: '크레딧 차감(지갑 원장 — 멱등 spend)',
    usageCreditLedgerIntro:
      '계정에 기록되는 사용(예: 커리큘럼, English coach). 아래 받은편지함 API 토큰 집계와는 별도입니다.',
    usageCreditLedgerEmpty: '이 기간에 차감 내역이 없습니다.',
    usageCreditColType: '유형 (charge_type)',
    usageCreditColAmount: '합계 크레딧',
    usageCreditColCount: '건수',
    usageCreditDetailTitle: '최근 차감 내역',
    usageCreditColWhen: '시각',
    usageCreditColSingle: '크레딧',
    usageLogoCreditTitle: '로고 정규화(샵 워크스페이스)',
    usageLogoCreditIntro:
      '브랜드 로고 생성/편집 시 직접 크레딧을 차감합니다. 위 spend 원장과는 경로가 다릅니다.',
    usageLogoCreditEmpty: '이 기간에 차감이 있는 로고 정규화가 없습니다.',
    usageLogoColModel: '모델',
    usageLogoColStatus: '상태',
    usageNoOwnerHint: '워크스페이스에 소유자 계정이 연결되지 않아 지갑 차감 원장을 표시할 수 없습니다.',
    usageEmbedImageTitle: '이미지 임베딩(Gemini)',
    usageEmbedImageIntro:
      '상품 이미지 embedContent 호출마다: 재고 벡터 동기화(inventory_sync) 또는 고객 이미지 검색(guest_image_search). 토큰은 Google usageMetadata 우선, 없으면 환경 변수로 추정.',
    usageEmbedImageEmpty: '이 기간에 이미지 임베딩 기록이 없습니다.',
    usageEmbedTextTitle: '텍스트 임베딩(Gemini) — 검색 벡터',
    usageEmbedTextIntro:
      '텍스트 embedContent 호출마다: 재고 벡터 동기화(inventory_sync) 또는 고객 메시지 의미 검색(customer_query). 토큰은 Google usageMetadata.',
    usageEmbedTextEmpty: '이 기간에 텍스트 임베딩 기록이 없습니다.',
    usageEmbedTextSourceQuery: '고객 메시지(의미 검색)',
    usageEmbedColSource: '출처',
    usageEmbedSourceInventory: '재고 동기화',
    usageEmbedSourceGuest: '고객 이미지(검색)',
    usageEmbedColPromptSum: '프롬프트 토큰 합',
    usageEmbedColTotalSum: '과금 토큰 합',
    usageEmbedDetailTitle: '호출별 로그',
    usageEmbedColInventoryId: '재고 행 ID',
    usageImageGenTitle: 'Nano Banana — 수신함 이미지 생성',
    usageImageGenIntro:
      'Nano Banana는 내부 이름입니다(모델 gemini-3-pro-image-preview): 소재·색 디테일과 착용·사용 예시 이미지. 새로 생성해 재고에 저장한 API만 집계——위 LLM 토큰 표와 동일 기간. 캐시된 항목은 재생성되지 않습니다.',
    usageImageGenEmpty: '이 기간에 Nano Banana 기록이 없습니다.',
    usageImageGenColKind: '유형',
    usageImageGenKindMaterial: '소재 / 색 디테일',
    usageImageGenKindRealUse: '착용 / 사용 예시',
    usageImageGenColCalls: 'API 호출 수',
    usageImageGenColTotalTokens: '총 토큰(추정)',
    usageImageGenTotalCallsLabel: '이미지 생성 총 호출(Nano Banana)',
    usageNanoBananaBadge: 'Nano Banana',
    usageNanoBananaModelHint: 'gemini-3-pro-image-preview · 수신함',
    usageNanoBananaStatCalls: '이미지 생성 호출: {calls}',
    usageNanoBananaStatTokens: '총 토큰(추정): {tokens}',
    enableLabel: '자동 답장 사용',
    enableHint: '끄면 직접 보낸 메시지만 전송됩니다.',
    delayLabel: 'AI 답장 전 대기(초)',
    delayHint:
      '0–30초: 모델이 필요한 답변을 예약하기 전 대기(고객 메시지 후, 최대 30; 모델 응답 후에는 추가 안 함). 기본 0. 먼저 답하면 AI는 보내지 않습니다.',
    typingMinLabel: '입력 지연 최소(ms)',
    typingMaxLabel: '입력 지연 최대(ms)',
    typingHint:
      'LLM 없이 자동 발송되는 메시지(주문 목록 안내·채팅 내 구매 안내 등)만 전송 전 이 범위에서 무작위 지연(0–30000). DeepSeek 본문에는 적용하지 않음. 둘 다 0이면 끔.',
    productConsultationContextLabel: '매장 AI 컨텍스트 및 지침',
    productConsultationContextHint:
      'AI가 항상 참고해야 할 내용을 한 곳에 입력하세요: 매장 정책, 답변 톤, 상담 방식, 구매 유도 방식, 교환, 계약금, 배송 등.',
    productConsultationContextPlaceholder:
      '예: 정중하고 간결한 톤. 주문 전 사이즈표 확인 안내. 세일 상품은 교환/환불 불가. 맞춤 제작 주문은 50% 계약금 필요. 망설이는 고객에게는 부담을 주지 않고 부드럽게 설명.',
    disclosureToggle: '메시지 끝에 AI 안내 문구 추가',
    disclosureSuffixLabel: '안내 문구(메시지 끝)',
    disclosureSuffixHint: '각 AI 메시지 끝에 표시되어 자동 답장임을 알립니다.',
    saveSettings: '설정 저장',
    loadError: 'AI 설정을 불러오지 못했습니다.',
    faqKeywordsLabel: '트리거 키워드',
    faqKeywordsHint: '쉼표 또는 줄바꿈으로 구분.',
    faqAnswerLabel: '답변',
    faqSortLabel: '순서',
    faqActiveLabel: '사용',
    inactiveBadge: '끔',
    addFaq: 'FAQ 추가',
    saveRow: '저장',
    deleteRow: '삭제',
    cancelEdit: '취소',
    inventoryName: '상품명',
    inventorySku: 'SKU(선택)',
    inventoryDesc: '사양 / 짧은 설명',
    inventoryStock: '재고 / 재고 여부',
    inventoryPrice: '가격(텍스트)',
    inventorySort: '순서',
    inventoryImageUrl: '상품 이미지(URL)',
    inventoryImageUrlHint:
      'https:// 로 시작하는 공개 이미지 링크를 붙여 넣으세요. AI에는 텍스트로 전달되며 필요 시 고객에게 링크를 보낼 수 있습니다.',
    inventoryProductUrl: '상품 페이지(URL)',
    inventoryProductUrlHint:
      '매장 웹사이트의 상품 상세 페이지(https://…). 이미지 검색 결과와 Excel 열 “Link trang sản phẩm”에 사용됩니다.',
    inventoryProductVideoUrl: '상품 동영상(URL)',
    inventoryProductVideoUrlHint:
      'YouTube 시청/임베드 주소 또는 .mp4·CDN 플레이어용 https:// 링크. Excel 동영상 열과 동일합니다.',
    inventoryOpenProductPage: '상품 페이지 열기',
    inventoryOpenProductVideo: '동영상 열기',
    inventoryGuestConsultLink: '상담 채팅 열기',
    inventoryGuestConsultLinkHint:
      '상품 이미지·맥락이 포함된 NanoAI 채팅 링크(웹사이트·QR·광고). 열면 자동으로 상담 메시지가 전송됩니다.',
    inventoryGuestConsultLinkNeedSave: '먼저 상품을 저장하면 전체 채팅 링크를 받을 수 있습니다.',
    inventoryGuestConsultLinkCopied: '채팅 링크를 복사했습니다.',
    inventoryConsultNote: '상담 시 추가 안내',
    inventoryConsultNoteHint:
      '예: 보증 12개월, 2–3일 배송, 10% 할인, 불량 시에만 교환, ○○원 이상 무료배송 등.',
    inventoryDescHint: '사이즈, 색상, 소재, 치수, 세트 구성 등.',
    inventoryStockHint: '남은 수량, 또는 “M/L 재고 있음”, “주문 후 약 5일” 등.',
    inventoryFieldsGuide:
      '설명 또는 상담 메모에: 판매 색상·사이즈, 배송 기간·배송비, 프로모션 종료일, 품목별 교환·환불, 관리 방법 등. 목록의 모든 행은 고객 답변용 AI 컨텍스트에 포함됩니다. AI가 언급하지 않게 하려면 해당 행을 삭제하거나 가져오기 파일에서 제외하세요. 샘플의 «상태» 열: 1 = 추가/업데이트, 0 = 재고에서 삭제(SKU 또는 상품명으로 매칭).',
    inventoryOpenApiLink: 'API 연동 안내',
    inventoryOpenApiHint:
      '매장 백엔드에서 JSON으로 재고를 NanoAI에 동기화할 수 있습니다(Open Catalog, Shopee 스타일 필드명). 이미지 검색과 동일 Bearer. Vision 불필요.',
    inventoryDownloadTemplate: 'Excel 샘플 받기',
    inventoryExportExcel: 'Excel보내기',
    inventoryImportExcel: 'Excel 가져오기',
    inventoryImportReplaceWarning:
      'Excel 가져오기: 기존 SKU와 일치(대소문자 무시)하면 업데이트, 없으면 추가. SKU가 없으면 SKU 없는 기존 행과 상품명으로 매칭(여러 개면 재고에서 먼저 맞는 행). «상태» 열(또는 is_active): 1 = 추가/업데이트, 0 = 재고에서 삭제(SKU 또는 상품명 필요). «정렬» 열이 없으면 표시 순서는 파일 행 순서입니다. 파일에 없는 기존 상품은 유지됩니다. 계속할까요?',
    inventoryImportSuccess: '{count}행 처리: 추가 {inserted}, 업데이트 {updated}, 삭제 {deleted}.',
    inventoryImportFailed: 'Excel 가져오기에 실패했습니다.',
    inventoryExcelImportUploading: 'Excel 파일 업로드 중…',
    inventoryExcelImportSending: '파일 전송 중…',
    inventoryErrInvalidXlsx: '올바른 Excel(.xlsx) 파일이 아닙니다.',
    inventoryErrEmptySheet: '시트가 비어 있습니다.',
    inventoryErrMissingName: '상품명 열(name)이 없습니다. 샘플 파일을 사용하세요.',
    inventoryErrNoRows:
      '유효한 데이터 행이 없습니다(추가/업데이트에는 상품명이 필요하고, 삭제는 상태=0과 SKU 또는 상품명이 필요합니다).',
    inventoryErrNoFile: '파일을 선택하지 않았습니다.',
    inventoryErrFileTooLarge: '파일이 너무 큽니다(최대 약 20MB).',
    inventoryErrTooManyRows: '행 수가 너무 많습니다. 한 번에 최대 {max}행까지 가져올 수 있습니다.',
    inventoryLoadMore: '더 불러오기 ({shown}/{total})',
    inventoryVectorSearchPlaceholder: '설명 입력(예: 니트, 가죽 신발) — 의미 검색',
    inventoryVectorSearchHint:
      '텍스트 벡터(이름·가격·메모) 또는 이미지 유사도. 동기화와 GOOGLE_API_KEY가 필요합니다.',
    inventoryVectorSearchByText: '검색',
    inventoryVectorSearchByImage: '이미지',
    inventoryVectorSearchClear: '필터 해제',
    inventoryVectorSearching: '검색 중…',
    inventoryVectorSearchFailed: '검색 실패. API와 벡터 동기화를 확인하세요.',
    inventoryVectorSearchNoResults: '일치하는 상품이 없습니다.',
    addInventory: '상품 추가',
    edit: '편집',
    emptyFaq: '아래에서 미리 준비된 질문을 고르고 매장 답변만 입력하세요.',
    emptyInventory:
      '등록된 상품이 없습니다. 매장에 있는 재고 목록을 추가하면 AI는 그 목록만 근거로 안내합니다.',
    inventoryProductCountSummary: '재고에 상품 {count}개가 있습니다.',
    inventoryEmbeddingTitle: '이미지 벡터 진행률',
    inventoryEmbeddingSummary: '완료 {done}/{eligible}. 대기 {pending}. 오류 {failed}.',
    inventoryEmbeddingSyncNow: '지금 동기화',
    inventoryEmbeddingSyncRunning: '동기화 중...',
    inventoryEmbeddingSyncDoneTitle: '재고 벡터 동기화 완료',
    inventoryEmbeddingSyncDoneBody: '{synced}개 처리(이미지+텍스트). 실패 {failed}.',
    inventoryEmbeddingAutoHint:
      'Messaging → AI 설정 페이지를 연 상태에서 자동으로 연속 배치(약 1200개)가 실행됩니다. 탭을 닫으면 중지됩니다. 백그라운드 상시 처리는 cron으로 POST /api/cron/messaging-inventory-embed-backfill(Bearer MESSAGING_INVENTORY_EMBED_CRON_SECRET)을 구성하세요. .env.example 참고.',
    inventoryTextEmbeddingTitle: '텍스트 벡터 진행률',
    inventoryTextEmbeddingSummary: '완료 {done}/{eligible}. 대기 {pending}. 오류 {failed}.',
    inventoryTextEmbeddingAutoHint:
      '텍스트 벡터(이름+가격+상담 메모)는 채팅 의미 검색에 사용됩니다. 이미지와 같은 «지금 동기화»; 페이지가 열린 동안 이미지 또는 텍스트 대기가 없어질 때까지 연속 실행; cron으로 백그라운드.',
    cronSetupHint:
      '운영: GET 또는 POST /api/cron/messaging-partner-ai를 Authorization: Bearer MESSAGING_PARTNER_AI_CRON_SECRET으로 주기 호출(예: 매분)하고 DEEPSEEK_API_KEY를 설정하세요. cron이 없으면 작업이 대기만 하고 AI가 보내지 않습니다. `next dev`는 대기 시간 후 자동 처리(cron 불필요). 로컬 `next start`에 cron이 없으면 .env에 MESSAGING_PARTNER_AI_DEV_WAKE=1.',
    toggleStatusOn: '켜짐',
    toggleStatusOff: '꺼짐',
    aiEngineTitle: '스마트 답장 AI',
    aiEngineDescription:
      '대기 후 대화형 답장은 DeepSeek API(모델 {model})를 호출하며 재고·정책을 반영합니다.',
    disclosureSwitchOn: '맺음말 추가',
    disclosureSwitchOff: '맺음말 없음',
    faqPresetsIntro:
      '구매 시 자주 묻는 질문이 미리 준비되어 있습니다. 답변만 입력하고 “사용”을 켜면, 고객의 비슷한 표현을 여러 언어로 감지합니다.',
    faqPresetSaveHint: '수정한 항목마다 저장하세요.',
    faqPresetAnswerRequired: '“사용”을 켜려면 답변 내용이 필요합니다.',
    faqCustomSectionTitle: '매장만의 질문',
    faqCustomSectionIntro:
      '매장에만 해당하는 질문을 추가하세요: 기억용으로 고객이 묻는 방식, 매칭용 키워드, 답변 내용을 입력합니다.',
    faqCustomAddTitle: '맞춤 질문 추가',
    faqCustomQuestionLabel: '고객이 자주 묻는 말(메모용)',
    faqCustomQuestionHint: '선택. 예: “주머니 추가 가능해요?” — 자동 매칭에는 사용되지 않습니다.',
    faqCustomKeywordsRequired:
      '“사용”을 켤 때 키워드를 하나 이상(각 2자 이상), 쉼표 또는 줄바꿈으로 구분해 입력하세요.',
    faqPresetQuestions: {
      stock: '재고 / 사이즈 있나요?',
      shipping: '배송, 배송비, 며칠 걸리나요?',
      price: '가격, 할인 있나요?',
      size_fit: '사이즈 선택, 핏, 사이즈표?',
      payment: '결제 방법(착불, 계좌이체 등)?',
      return_policy: '교환·환불 규정?',
      order_track: '배송 조회, 운송장 번호?',
      warranty: '보증은?',
      authentic: '정품인가요?',
      promo: '프로모션, 쿠폰 코드?',
    },
    visionSearchTitle: '고객이 사진을 보낼 때 상품 추천',
    visionSearchHint:
      'Vertex AI Vision Image Warehouse 사용: 동일 corpus/index에서 partner_id로 매장을 구분합니다. GCP(us-central1 또는 europe-west4), GCS 버킷, Vision AI + Storage 서비스 계정 필요. GCS_VISION_CATALOG_BUCKET, VISION_WAREHOUSE_CORPUS_ID, VISION_WAREHOUSE_INDEX_ID, VISION_WAREHOUSE_INDEX_ENDPOINT_ID, 선택 GOOGLE_CLOUD_PROJECT_NUMBER. 재인덱스 cron은 매장과 동일한 GCP 리전을 사용합니다(동기화 또는 에셋 제거로 pending 시 vision_warehouse_runner에 저장). 이미지 가져오기 후 /api/cron/vision-warehouse-reindex(vision catalog cron과 동일 secret)로 corpus 분석·인덱스 재빌드 필수 — 이후 이미지 검색이 완전해집니다. 동기화는 증분; 재고 행 삭제 시 해당 에셋 제거 후 cron 다시 필요.',
    visionSearchEnable: '사진 기반 추천 사용',
    visionShopCountryLabel: '매장 국가/지역(Vision 프리셋)',
    visionShopCountryHint:
      '매장이 주로 운영되는 지역을 고르면 맞는 Google Cloud Vision 리전을 제안합니다. GCP 프로젝트 리전과 가까울수록 카탈로그 이미지 동기화·전송이 보통 더 빠르고 안정적입니다. 구성을 알면 아래에서 직접 바꿀 수 있습니다. 잘 모르겠으면 아무거나 고르지 말고 «Vision 리전 직접 선택(고급)»으로 두고 GCP 담당자에게 확인한 뒤 올바른 리전을 설정하세요.',
    visionShopCountryCustom: 'Vision 리전 직접 선택(고급)',
    visionShopCountryAdvancedHint:
      'GCP 프로젝트에 맞게 아래 Vision 리전과 상품 카테고리를 선택하세요. 국가 프리셋을 쓰지 않거나 저장된 리전이 프리셋과 다를 때 표시됩니다.',
    visionLocationLabel: 'Vision 리전',
    visionCategoryLabel: '상품 카테고리(인덱스)',
    visionBucketOverrideLabel: 'GCS 버킷(선택)',
    visionBucketOverrideHint: '비우면 서버의 GCS_VISION_CATALOG_BUCKET을 사용합니다.',
    visionWarehouseInventorySummary:
      '재고: {total}개 품목 · https 이미지 URL이 있는 행 {withImage}개(Google Vision에 올라가는 행).',
    visionCatalogSyncStatsTitle: '이미지 카탈로그 동기화 상태(NanoAI → Google)',
    visionCatalogSyncStatsLineSynced: '일치 — 다음 동기화에서 건너뜀(재업로드 없음): {n}행',
    visionCatalogSyncStatsLinePending: '업로드/갱신 대기(이미지 또는 이름 변경): {n}행',
    visionCatalogSyncStatsLineNoHttps: 'https 이미지 URL 없음 — Vision 가져오기 불가: {n}행',
    visionCatalogSyncStatsLineExcluded: 'Vision에서 제외: {n}행',
    visionCatalogSyncStatsExplain:
      '「대기 중」인 행만 가져옵니다. 체크섬이 현재 이미지+이름과 일치하면 이미 게시된 것으로 보아 다시 올리지 않습니다. GCS 객체 수는 jsonl·다중 이미지 때문에 상품 수와 다를 수 있습니다. 자산 수는 Google Cloud Vision Warehouse에서 확인하세요. // 로 시작하는 이미지 URL(https 생략)도 허용되며 https로 간주합니다.',
    visionSyncButton: '재고 이미지를 Google에 동기화',
    visionSyncAutoWhenEnableHint:
      '「사진 기반 추천」을 켜고 저장이 완료되면 세그먼트를 이어 자동 동기화가 끝날 때까지 진행되며 보통 추가 클릭이 필요 없습니다. 오류나 절대 안전 한도일 때만 «재고 이미지를 Google에 동기화»를 누르세요.',
    visionSyncing: '동기화 중…',
    visionSyncOk: '이미지 카탈로그를 동기화했습니다.',
    visionIndexReady: '인덱스 준비됨',
    visionIndexNotReady: '동기화 안 됨 또는 오류',
    visionLastSynced: '마지막 동기화',
    visionSyncErrorLabel: '최근 오류',
    visionWarehouseReindexPending:
      'Vision Warehouse 이미지가 갱신되었습니다. 인덱스 재빌드 cron(/api/cron/vision-warehouse-reindex)이 끝날 때까지 기다려 주세요. 이미지 검색은 완료 후 정상입니다.',
    visionWarehouseCorpusUnsupportedType:
      'VISION_WAREHOUSE_CORPUS_ID의 corpus가 IMAGE 유형 Image Warehouse가 아닙니다. Google이 가져오기를 거부합니다(CORPUS_UNSUPPORTED_TYPE). Google Cloud 문서에 따라 type이 IMAGE인 Image Warehouse corpus를 새로 만들고, 일치하는 인덱스와 엔드포인트를 연결한 뒤 .env와 AI 설정의 ID를 갱신하고 다시 동기화하세요. 동영상 등 다른 유형 corpus는 이 이미지 가져오기 흐름을 사용할 수 없습니다.',
    visionProductSearchMaintenanceTitle: 'Google Vision Product Search가 점검/제한 중입니다',
    visionProductSearchMaintenanceDetail:
      'Google이 구 Product Search 카탈로그 작업을 일시적으로 막을 수 있습니다(매장 설정 문제 아님). Image Warehouse: https://cloud.google.com/vision-ai/docs/image-warehouse-overview — 구 Product Search 신청: https://forms.gle/QPLzMdwSMCR2pPsq5 — NanoAI 재고 이미지 동기화는 Image Warehouse를 사용합니다. Google 응답에 Product Search가 언급될 때만 이 안내가 표시됩니다.',
    visionSyncToastImported: '색인에 반영됨',
    visionSyncToastRemoved: '제거됨(유효한 이미지 URL 없음)',
    visionSyncToastMore: '처리할 항목이 더 있을 수 있습니다 — 동기화를 다시 실행하세요.',
    visionSyncToastIdle: '동기화할 변경이 없습니다.',
    visionSyncChainedRounds: '연속 {n}회 동기화함',
    visionSyncChainedStoppedMaxRounds: '자동 동기화 횟수 한도에 도달했습니다 — 동기화를 눌러 계속하세요.',
    visionSyncChainedStoppedTimeout:
      '시간 한도로 중단했습니다(탭 멈춤 방지) — 동기화를 눌러 계속하세요.',
    visionSyncChainedAbortedSafety:
      '절대 안전 한도로 자동 동기화가 중단되었습니다 — 동기화를 누르거나 오류를 확인하세요.',
    visionBgSyncTitle: 'Google 백그라운드 동기화(VPS / cron)',
    visionBgSyncHint:
      '서버에 작업을 대기열에 넣습니다: VPS가 주기적으로 GET 또는 POST /api/cron/vision-catalog-sync를 Bearer VISION_CATALOG_SYNC_CRON_SECRET으로 호출합니다(.env.example 참고). 탭을 닫아도 됩니다. 완료·오류 후 이 페이지에서 상세 보고서를 확인하세요. 선택: 하루 1회 GET/POST /api/cron/vision-bg-sync-enqueue(동일 Bearer 또는 VISION_BG_SYNC_ENQUEUE_CRON_SECRET)로 이미지 추천이 켜진 모든 매장의 백그라운드 동기화를 자동 대기열에 넣습니다 — catalog-sync 주기 호출을 대체하지 않습니다.',
    visionBgSyncButton: '백그라운드 동기화 시작',
    visionBgSyncUseResumeHint:
      '탭에 이전 브라우저 동기화의 커서가 있으면 그 지점부터 이어가고, 없으면 처음부터 스캔합니다.',
    visionBgSyncCancel: '백그라운드 작업 취소',
    visionBgSyncDismiss: '보고서 닫기',
    visionBgSyncStatusQueued: 'cron 대기',
    visionBgSyncStatusRunning: 'cron 실행 중',
    visionBgSyncStatusDone: '완료',
    visionBgSyncStatusError: '오류',
    visionBgSyncStatusIdle: '백그라운드 작업 없음',
    visionBgSyncReportTitle: '백그라운드 동기화 보고서',
    visionBgSyncFieldRounds: 'API 라운드',
    visionBgSyncFieldImported: '색인 반영',
    visionBgSyncFieldRemoved: '제거',
    visionBgSyncFieldHasMore: '백로그 남음',
    visionBgSyncFieldLastScanned: '커서(마지막 품목)',
    visionBgSyncFieldStopped: '중지 사유',
    visionBgSyncFieldMessage: '메시지',
    visionBgSyncFieldServerError: '서버 오류',
    visionBgSyncBoolYes: '예',
    visionBgSyncBoolNo: '아니오',
    visionBgSyncPollingNote:
      '대기 또는 백그라운드 실행 중에는 이 페이지가 약 8초마다 자동으로 새로고침됩니다(탭을 열어 두세요).',
    visionBgSyncProgressTitle: 'Google에 상품 반영 진행 상황',
    visionBgSyncProgressRatio: '색인 반영: {imported} / ~{total}개(이미지 URL이 있는 재고 행)',
    visionBgSyncProgressHint:
      '~ 분모는 현재 재고 중 이미지 링크가 있는 행 수(추정)입니다. 배치마다 API 집계가 약간 다를 수 있습니다.',
    visionBgSyncProgressNoImageRows: '이미지 URL이 있는 재고 행이 없어 진행률을 추정할 수 없습니다.',
    visionBgSyncQueuedExplain:
      '«cron 대기»는 DB에만 대기 중이고 **아직 실행되지 않음**을 뜻합니다. 서버가 `/api/cron/vision-catalog-sync`(Bearer)를 호출하거나 아래 «서버에서 한 번 실행»을 누르기 전까지 0/N은 정상입니다.',
    visionBgSyncPostRefreshExplain:
      '약 8초마다 `/dashboard/messaging/settings`로 가는 POST는 **상태 새로고침**(서버 액션)일 뿐 Google Vision 호출이 아닙니다.',
    visionBgSyncRunSliceButton: '서버에서 한 번 실행',
    visionBgSyncRunSliceHint: 'cron 한 번과 동일(수 분 걸릴 수 있음). 운영 환경에서는 VPS crontab 설정을 권장합니다.',
    visionBgSyncRunSliceOk: '한 번 처리 완료: API {rounds}라운드 · 대기 작업이 있는 파트너 {partners}곳.',
    visionBgSyncEnqueueOk: '백그라운드 동기화가 대기열에 추가되었습니다. VPS cron이 처리합니다.',
    visionBgSyncToastDone: 'Vision 백그라운드 동기화가 완료되었습니다.',
    visionBgSyncToastError: 'Vision 백그라운드 동기화가 실패했습니다.',
    visionBgSyncAlreadyActive: '작업이 이미 대기열에 있거나 실행 중입니다.',
    visionBgSyncAlreadyActiveRefreshHint:
      '서버에서 상태를 새로고침했습니다. 오래 «대기 중»이면 VPS의 Vision 동기화 cron을 확인하거나 «백그라운드 작업 취소»를 누르세요.',
    visionBgSyncEnableVisionFirst: '백그라운드 동기화 전에 «사진 기반 추천»을 켜 주세요.',
    visionBgSyncSaveSettingsFirst: '먼저 Messaging에서 AI 설정을 한 번 저장하세요.',
    visionBgSyncStopCompleted: '완료',
    visionBgSyncStopError: '오류',
    visionBgSyncStopCronSlice: 'cron 구간 종료(이어서 실행)',
    visionBgSyncStopBadCursor: '커서 무효',
    visionBgSyncServerErrCursor: '백로그가 남았지만 스캔 커서가 없어 안전하게 중지',
    visionBgSyncMsgCompleted: '카탈로그 동기화가 끝났습니다.',
    visionBgSyncMsgInProgress: '진행 중 — 다음 cron이 이어갑니다.',
    visionBgSyncMsgBadCursor: '중지: 서버 커서가 일치하지 않습니다.',
    visionHealthPanelTitle: 'Vision 동기화 상태',
    visionHealthStatusHealthy: '초록',
    visionHealthStatusWarning: '노랑',
    visionHealthStatusStuck: '빨강(멈춤)',
    visionHealthStatusIdle: '데이터 없음',
    visionHealthPendingCount: '대기 항목: {n}',
    visionHealthChecksumDone: '체크섬 완료: {done}/{total}',
    visionHealthLockAge: '락 경과',
    visionHealthLockBusy: '점유 중({sec}초)',
    visionHealthLockFree: '유휴',
    visionHealthLockOwner: '락 소유자',
    visionHealthOwnerUnknown: '소유자 알 수 없음',
    visionHealthHeartbeatAge: '하트비트 경과',
    visionHealthHeartbeatAlive: '정상 동작({sec}초)',
    visionHealthHeartbeatNone: '하트비트 없음',
    visionHealthLastProgress: '최근 진행',
    visionHealthLastProgressNone: '없음',
    visionHealthUnlockButton: '가져오기 잠금 해제',
    visionHealthUnlockOk: 'Vision Warehouse 가져오기 잠금을 해제했습니다.',
    visionEmergencyDisableButton: 'Vision 긴급 중지',
    visionEmergencyDisableConfirm:
      '이 상점의 Vision 기능을 즉시 모두 중지하시겠습니까? 백그라운드 동기화 중지, 이미지 추천 비활성화, 러너 잠금 해제를 수행합니다.',
    visionEmergencyDisableOk: '이 상점의 Vision 기능이 중지되었습니다.',
    visionInventoryDeleteRemovesIndexNote:
      '«재고» 탭에서 행을 삭제하면 Google Vision 이미지 색인에서도 자동으로 제거됩니다 — 제거용 목록 파일을 올릴 필요가 없습니다.',
    imageSearchApiTitle: '이미지로 상품 검색 API(매장 웹사이트용)',
    imageSearchApiHint:
      'multipart로 이미지(필드 image 또는 file)를 보내고 Authorization: Bearer에 API 키를 넣습니다. 동기화된 Vision 카탈로그와 가장 비슷한 상품을 반환합니다. 키 노출을 피하려면 매장 백엔드에서 호출하는 것을 권장합니다.',
    imageSearchApiEnable: '공개 API 사용',
    imageSearchApiKeyConfigured: 'API 키가 설정되어 있습니다.',
    imageSearchApiKeyMissing:
      '키 없음 — API 연동 페이지에서 생성·관리(가리기, 보기, 복사, 삭제)하세요.',
    imageSearchApiEndpointLabel: '경로(앞에 NanoAI 사이트 도메인 추가)',
    imageSearchApiBaseUrlNote: '예: https://your-domain.com/api/messaging/partners/…/image-search',
    imageSearchApiDocHint:
      'POST multipart: image(파일). 선택 limit(1–25, 기본 8). JSON: products[](inventory_id, name, sku, image_url, product_url, score).',
    imageSearchApiGenerate: 'API 키 생성 / 재발급',
    imageSearchApiGenerating: '키 생성 중…',
    imageSearchApiKeyCreated: '키가 생성되었습니다(가능하면 클립보드에 복사됨). 다시 표시되지 않으니 지금 저장하세요.',
    imageSearchApiManageKeysLink: 'API 연동 열기 — 키 관리',
    guestPurchaseFlowLabel: 'NanoAI 채팅에서 구매 진행 방식',
    guestPurchaseFlowHint:
      '「채팅 내»: 구매 버튼으로 기존 주문/QR 흐름. 「쇼핑몰 사이트»: 구매 시 상품 페이지(재고 URL)를 새 탭으로 — 결제/배송을 웹에서 처리할 때 적합.',
    guestPurchaseFlowInChat: '채팅에서 주문 (양식 + NanoAI 결제)',
    guestPurchaseFlowExternal: '구매 시 쇼핑몰 사이트 열기',
  },
  partnerGuestChat: {
    notFoundTitle: '채팅 페이지를 찾을 수 없습니다',
    notFoundDescription: '링크가 잘못되었거나 매장이 기능을 껐습니다.',
    pageTitleSuffix: 'NanoAI 채팅',
    metaDescription: 'NanoAI에서 {shop}에 메시지 — Facebook, Zalo, 웹 매장과 같은 수신함입니다.',
    shopLabel: '매장',
    subline:
      'NanoAI에서 매장과 채팅합니다. 매장은 대시보드에서 답장합니다. Google로 로그인하면 기기 간에 메시지가 동기화됩니다.',
    placeholder: '메시지 입력…',
    send: '보내기',
    emptyThread: '아직 메시지가 없습니다. 아래에서 첫 메시지를 보내세요.',
    loadError: '메시지를 불러오지 못했습니다.',
    sendError: '전송에 실패했습니다.',
    pollNote: '매장 답변이 몇 초 지연될 수 있습니다.',
    guestAttachPhoto: '사진 보관함',
    guestTakePhoto: '카메라로 촬영',
    guestRemoveAttachment: '사진 제거',
    guestUploading: '사진 업로드 중…',
    guestImageTooLarge: '이미지가 너무 큽니다(최대 약 10 MB).',
    guestImageInvalidType: 'JPG, PNG, WebP, GIF만 지원합니다.',
    guestCaptionHint: '사진에 설명을 덧붙일 수 있습니다(선택).',
    loginPromptTitle: '채팅하려면 로그인',
    loginPromptDescription:
      '이메일로 로그인하면 매장과의 대화를 다른 기기에서도 이어갈 수 있습니다.',
    signInWithGoogle: '로그인',
    linkMyShops: '내 메시지',
    linkMyOrders: '내 주문',
    widgetShoppingCart: '장바구니',
    widgetLanguageSelectAria: '언어',
    sendKeyboardHint: 'Enter로 전송 · Shift+Enter로 줄 바꿈 · Ctrl+V / Cmd+V로 이미지 붙여넣기',
    tryOnOpen: 'AI 피팅',
    tryOnTitle: '채팅에서 바로 가상 피팅',
    tryOnModelPhoto: '인물 사진',
    tryOnGarmentPhoto: '의류 사진',
    tryOnGarmentSourceTitle: '의류 이미지 소스 선택',
    tryOnGarmentSourceDevice: '기기에서 이미지 선택',
    tryOnGarmentSourceRecent: '매장의 최근 추천 이미지 20개에서 선택',
    tryOnGarmentRecentEmpty: '최근 추천 이미지가 없습니다.',
    tryOnGenerate: '피팅 이미지 생성',
    tryOnGenerateWithCost: '피팅 이미지 생성 (-{credits} 크레딧)',
    tryOnPreparing: '피팅 이미지를 생성하는 중…',
    tryOnNeedBoth: '인물 사진과 의류 사진이 모두 필요합니다.',
    tryOnGarmentLimitReached: '의류는 최대 {max}개까지 선택할 수 있습니다.',
    tryOnGarmentItemsLabel: '개',
    tryOnFailed: '피팅 이미지를 만들지 못했습니다.',
    tryOnReady: '피팅 이미지가 준비되었습니다. 채팅에서 바로 보낼 수 있습니다.',
    tryOnChargedToast: '{cost} 크레딧이 차감되었습니다. 잔액 {remaining} 크레딧.',
    tryOnCreditsBalanceLabel: '잔액: {credits}',
    tryOnTopUpCredits: '충전',
    tryOnResultViewLarge: '피팅 이미지 크게 보기',
    tryOnResultDownload: '다운로드',
    tryOnEmbedGarmentFromPage: '현재 페이지 상품 이미지',
    tryOnEmbedGarmentFromPageWithSku: '보고 있는 상품 (SKU: {sku})',
    tryOnEmbedOnlyFlowHint:
      '본인 사진을 선택하세요(다음에도 이 브라우저·이 채팅 창에서 기억합니다). 의류 이미지는 보고 있는 상품에서 가져옵니다. 피팅은 credits가 필요합니다. 같은 채팅 창 안에서 충전하세요(샵과 같은 탭, 별도 NanoAI 탭 불필요).',
    guestCreditWalletLoginTitle: '크레딧 지갑 사용을 위해 로그인',
    guestCreditWalletLoginDescription:
      '피팅과 충전에는 이메일 인증(OTP)이 필요합니다. 아래에서 진행해 주세요.',
    toastGuestTopUpLoginRequired: '충전 전에 이메일(OTP)로 로그인해 주세요.',
    toastTryOnInsufficientCredits: '크레딧이 부족합니다. 충전 후 다시 시도해 주세요.',
    guestAuthPromptTitle: '로그인하고 채팅 기록 오래 보관',
    guestAuthPromptBody: '지금도 채팅할 수 있습니다. 로그인하면 기기/브라우저를 바꿔도 기록이 동기화됩니다.',
    guestAuthEmailPlaceholder: '이메일을 입력하세요',
    guestAuthSendMagicLink: '로그인 링크 보내기',
    guestAuthSendOtp: 'OTP 코드 보내기',
    guestAuthOtpPlaceholder: '6자리 OTP 입력',
    guestAuthVerifyOtp: '로그인',
    guestAuthRequiredAfterLimit: '메시지 {count}개를 보냈습니다. 계속하려면 이메일 인증이 필요합니다.',
    guestAuthEmailSent: '인증 메일을 보냈습니다. 받은편지함을 확인하세요.',
    guestAuthOtpInvalid: 'OTP가 유효하지 않거나 만료되었습니다.',
    guestAuthRateLimited: '요청이 너무 빠릅니다. {seconds}초 후 다시 시도해 주세요.',
    guestAuthRememberDeviceHint:
      '이 기기/브라우저를 장기간 신뢰(동일 이메일로 다시 로그인하면 OTP를 생략할 수 있음).',
    guestAuthVerifyingProgress: '로그인 중입니다. 잠시만 기다려 주세요...',
    shopTypingHint: '매장이 입력 중…',
    consultLinkShopPreparingHint: '매장이 상품 정보를 보내는 중…',
    similarAlternativesTemplateMessage: '아래에 다른 스타일을 더 준비했습니다.',
    productSearchTemplateMessage:
      '아래에 조건에 맞는 상품을 보내드렸습니다. 마음에 드는 상품 카드에서 바로구매를 눌러 채팅에서 주문하거나, 상담을 눌러 더 문의하실 수 있어요.',
    visionPickHint: '맞는 상품을 고르거나 직접 답장을 기다려 주세요.',
    visionPickBusy: '보내는 중…',
    visionPickError: '선택을 보낼 수 없습니다. 다시 시도해 주세요.',
    visionProductLink: '상담',
    visionProductBuy: '바로 구매',
    visionProductViewDetails: '자세히 보기',
    visionProductVideo: '동영상',
    visionVideoCloseAria: '동영상 닫기',
    productShelfButton: '상품',
    urlProductContextChipLabel: '보는 상품 보내기',
    urlProductContextChipAria:
      '이 페이지에서 보고 있는 상품 정보를 매장에 보냅니다. 먼저 다른 메시지를 보내면 포함되지 않습니다.',
    urlProductContextChipDismissAria: '닫기 — 보는 상품 정보 보내지 않음',
    productShelfTitle: '최근 관심 상품',
    productShelfEmpty: '아직 추천이 없습니다. 매장 메시지를 보거나 사진을 보내 주세요.',
    productShelfSearchPlaceholder: '재고 검색(스타일·설명)',
    productShelfSearchButton: '검색',
    productShelfSearchImage: '이미지',
    productShelfSearchClear: '필터 해제',
    productShelfSearching: '검색 중…',
    productShelfSearchFailed: '검색 실패. 벡터 동기화 후 다시 시도하세요.',
    productShelfSearchNoResults: '일치하는 상품이 없습니다.',
    productShelfBuy: '구매',
    purchaseOpenSiteToast: '쇼핑몰 상품 페이지를 새 탭에서 열었습니다.',
    purchaseMissingProductUrlToast: '상품 URL이 없습니다. 재고에 URL을 추가하세요.',
    productConsultProductRefFromSku: '상품 코드 {sku}',
    productConsultProductRefFromName: '{name}',
    productConsultAskShipping:
      '{productRef} — 배송이 먼저일까요, 상품 상세가 먼저일까요?',
    productConsultAskDetail:
      '{productRef} — 더 궁금한 점이 있으신가요?',
    productConsultAskDetailFromSku:
      '이 상품 "{sku}"에 관심이 있어요. 상담 부탁드려요.',
    pageContextInboundConsultNoSku:
      '상품 페이지에서 오셨어요. 필요하신 내용을 남겨 주시면 도와드릴게요.',
    pageContextInboundImageOnlyNote:
      '상품 링크로 연결되었습니다. 매장 상담을 위해 이미지가 함께 전송됩니다(사진 전송과 동일).',
    guestProfileDialogTitle: '호칭을 맞추기 위해',
    guestProfileDialogDescription:
      'NanoAI 계정에 한 번만 저장됩니다(모든 매장 공통): 생년월일과 성별(남성 또는 여성)로 자연스러운 호칭과 나이에 맞는 추천에 씁니다. 나중에 입력해도 됩니다.',
    guestProfileBirthLabel: '생년월일',
    guestProfileBirthDayPlaceholder: '일',
    guestProfileBirthMonthPlaceholder: '월',
    guestProfileBirthYearPlaceholder: '년',
    guestProfileGenderLabel: '성별',
    guestProfileGenderMale: '남성',
    guestProfileGenderFemale: '여성',
    guestProfileSave: '저장',
    guestProfileRemindLater: '나중에',
    guestProfileInvalid: '생년월일과 성별을 선택해 주세요.',
  },
  messagingMyChats: {
    pageTitle: '내 메시지',
    pageDescription: 'NanoAI에서 메시지를 주고받은 매장입니다.',
    emptyList: '대화가 없습니다. 매장 채팅 링크를 열어 시작하세요.',
    openChat: '채팅 열기',
    lastActivity: '최근 활동',
    loadFailed: '목록을 불러오지 못했습니다.',
    backHomeAria: '홈으로',
  },
  messagingMyOrders: {
    pageTitle: '내 주문',
    composerOrdersLabel: '주문',
    pageDescription: 'NanoAI 채팅으로 주문한 내역 — 결제 및 배송 상태.',
    emptyList: '주문이 없습니다. 매장 채팅에서 주문하면 여기에 표시됩니다.',
    loadFailed: '목록을 불러오지 못했습니다.',
    backHomeAria: '홈으로',
    openChat: '채팅 열기',
    createdAt: '주문 시각',
    totalLabel: '주문 합계',
    payStatus: '결제',
    shipStatus: '배송',
    stAwaiting: '입금 대기 (계약금)',
    stChecking: '입금 확인 중',
    stPaid: '결제 완료',
    stManual: '매장 확인 대기',
    stCancelled: '취소됨',
    shPending: '처리 대기',
    shConfirmed: '확인됨',
    shPacking: '포장 중',
    shShipping: '배송 중',
    shDelivered: '배송 완료',
    shReturned: '반품',
    shCancelled: '취소',
    orderIdLabel: '주문 ID',
    transferMemoLabel: '입금 통장 메모',
    qtyLabel: '수량',
    colorLabel: '색상',
    sizeLabel: '사이즈',
    noteLabel: '메모',
    unitPriceLabel: '단가',
    depositPctLabel: '계약금 비율',
    amountDueLabel: '결제할 금액(계약금)',
    paidRecordedLabel: '결제 완료 금액',
    balanceOnDeliveryLabel: '수령 시 추가 결제(잔액)',
    shipToLabel: '배송지',
    productPhotoAlt: '주문 상품 이미지',
    variantImagesSectionLabel: '선택한 색상/스타일 이미지',
    totalQtySummaryLabel: '총 수량',
    viewTimelineButton: '주문 타임라인',
    timelineTitle: '주문 타임라인',
    timelineLoadFailed: '주문 기록을 불러오지 못했습니다.',
    timelineEmpty: '이벤트가 없습니다.',
  },
  navGroup: {
    try_on: '가상 피팅·스타일링',
    education: '교육·연수',
    image_edit: '이미지 편집',
    design_creative: '디자인·크리에이티브',
    three_d_special: '3D·전문 도구',
    music_ai: 'AI 음악',
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
    wedding_invitation_ai: 'AI 청첩장',
    text_to_image: '텍스트로 이미지',
    infographic_from_book: '교과서 인포그래픽',
    sketch_to_image: '스케치로 이미지',
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
    edit_image_by_request: '요청 기반 이미지 편집',
    product_3d_sample: '3D 상품 샘플',
    model_3d_from_image: '이미지로 3D 모델 생성',
    create_video_from_image: 'AI 비디오 (Veo)',
    flow_music_veo_video: 'AI 뮤직비디오 (Flash+Veo)',
    interior_exterior: '인테리어·익스테리어',
    my_house: '짓고 싶은 집 스타일',
    portrait_photo: '인물 사진',
    expand_frame: '프레임 확장',
    face_swap: '얼굴 교체',
    translate_document_image: '문서 이미지 번역',
    lyria3_instrumental_song: '음악 만들기 (보컬/인스트루멘탈)',
    meeting_recorder_report: '회의 녹음·AI 회의록',
    ai_language_learning: 'AI 외국어 학습',
    create_curriculum: '교육과정 생성',
    my_curricula: '내 교육과정',
    online_exam: '온라인 시험(수업)',
    homework_online: '숙제 만들기',
    classes: '수업',
    try_on_1: '1인 피팅',
    try_on_2: '2인 피팅',
    try_on_3: '3인 피팅',
    try_on_4: '4인 피팅',
    try_on_5: '5인 피팅',
    image_result_display: '이미지 결과 표시',
    admin: '관리',
  },
  creationSidebar: {
    back: '돌아가기',
    relatedTitle: '관련',
    popularTitle: '자주 쓰는 도구',
  },
  imageResultDisplay: {
    pageTitle: '전·후 이미지 표시 방식',
    pageIntro:
      '기본: 한 프레임에서 드래그 비교(인테리어·외관 디자인과 같은 방식). 나란히 보기도 선택할 수 있습니다. 이미지 도구 전체에 적용되며 결과 페이지에서도 바꿀 수 있습니다.',
    modeSplitTitle: '나란히',
    modeSplitDesc: '원본과 결과를 나란히 표시 — 이미지를 눌러 확대하는 방식은 동일합니다.',
    modeCompareTitle: '드래그로 비교 (기본)',
    modeCompareDesc: '한 프레임 중앙 핸들: 왼쪽 원본 · 오른쪽 결과. 다른 정렬 도구처럼 전체 화면도 지원합니다.',
    persistNote: '이 브라우저(기기)에 저장됩니다.',
  },
  taskHub: {
    pageTitle: '작업 및 대기열',
    pageDescription:
      '진행 중인 작업(이미지·동영상·일괄 번역·교육과정 등)을 한곳에서 보고 각 도구로 바로 이동합니다.',
    sectionRunning: '진행 중',
    sectionRecent: '최근 완료 또는 실패(7일)',
    emptyRunning: '진행 중인 작업이 없습니다.',
    emptyRecent: '최근 7일 안에 완료된 작업이 없습니다.',
    openTool: '도구 열기',
    batchSummary: '{done}/{total} 완료',
    itemsCount: '{n}개 항목',
    worksheetSection: '숙제 / 교육과정(백그라운드)',
    worksheetParseSgk: '교과서 추출',
    worksheetQuiz: '단계별 퀴즈',
    worksheetEssay: '논술 채점·생성',
    worksheetUnknownType: '워크시트 작업',
    statusProcessing: '실행 중',
    statusFailed: '실패',
    statusCompleted: '완료',
    statusCancelled: '취소됨',
    statusMixed: '일부만',
    hintTranslateProgress:
      '이미지 번역 일괄: 도구 페이지에서 상세 진행률, ZIP 다운로드, 일괄 취소를 할 수 있습니다.',
    linkProcessedImages: '처리된 이미지',
    linkTranslateHistory: '번역 기록',
    linkTranslateProgress: '번역 진행 상황',
    autoRefreshNote:
      '진행 중 작업이 있을 때: 탭이 보이는 동안 약 8초마다 새로고침. 대기열이 비면 이 탭으로 돌아올 때만 갱신됩니다.',
  },
  meetingRecorder: {
    cardTitle: '회의 녹음 → AI 회의록',
    cardDescription:
      '브라우저에서 녹음할 때는 크레딧이 차감되지 않습니다. 녹음 시작 시 회의 제목이 이 기기에 자동 저장됩니다. AI 회의록을 만들 때만 녹음 길이에 따라 크레딧이 차감됩니다.',
    freeRecordingNote: '녹음 및 회의명 저장: 크레딧 없음.',
    silenceAutoStopNote:
      '5분 동안 말소리가 감지되지 않으면 녹음이 자동으로 중지되며, 수동 중지와 같이 저장됩니다.',
    autoStoppedBySilence: '녹음이 자동 중지되었습니다: 5분 동안 말소리가 없었습니다.',
    segmentAutoSplitNote:
      '5분마다 현재 구간을 마치고 같은 마이크로 새 구간을 자동 시작합니다. 서버에서 파일을 자를 필요가 없습니다.',
    segmentRotatedToast: '새 5분 녹음 구간을 시작했습니다.',
    chargeNote:
      'AI 회의록(전사+요약): 처음 5분 1 크레딧; 초과분은 분 단위(올림)마다 0.2 크레딧 추가.',
    sessionNote:
      '녹음은 서버에 최대 {days}일 보관 후 자동 삭제됩니다. 이 세션에서는 로컬 재생·다운로드가 가능합니다. 녹음 시작 시 회의 제목이 이 기기에 자동 저장됩니다.',
    meetingTitleLabel: '회의 제목',
    meetingTitlePlaceholder: '예: Q1 프로젝트 회의',
    savingRecording: '서버에 녹음 저장 중…',
    saveRecordingFailed: '저장하지 못했습니다. 네트워크를 확인하고 다시 시도하세요.',
    retrySaveRecording: '녹음 저장 다시 시도',
    needServerRecording: 'AI 회의록을 만들기 전에 서버에 녹음을 저장해야 합니다.',
    startRecording: '녹음 시작',
    stopRecording: '중지',
    stopRecordingConfirmTitle: '녹음 중지 확인',
    stopRecordingConfirmDescription:
      '회의가 실제로 끝났을 때만 확인하세요. 녹음은 저장됩니다. 크레딧은 AI 회의록을 만들 때만 차감됩니다.',
    stopRecordingConfirmOk: '확인 — 회의 종료됨',
    stopRecordingConfirmContinue: '계속 녹음',
    recording: '녹음 중…',
    idleHint: '브라우저에서 물으면 마이크를 허용해 주세요.',
    recordingTimeLabel: '녹음 중: {duration}',
    durationLabel: '길이: {duration}',
    createNewMeeting: '새 회의 만들기',
    stopBeforeNewMeeting: '새 회의를 만들려면 먼저 녹음을 중지하세요.',
    downloadRecording: '녹음 파일 받기',
    generateReport: 'AI 회의록 만들기',
    reportLanguageLabel: '회의록 언어',
    estimatedCost: '예상: {credits} 크레딧',
    costExplain:
      '첫 5분: 1 크레딧. 5분 초과분은 분 단위(올림)마다 0.2 크레딧 — 예: 5:47 ≈ 1.2 크레딧.',
    needRecording: '회의록을 만들기 전에 몇 초 이상 녹음하세요.',
    processing: '오디오 분석 중…',
    reportHeading: '회의 보고',
    briefReportHeading: '짧은 요약 (핵심)',
    fullReportHeading: '상세 보고',
    transcriptHeading: '전사',
    copy: '복사',
    copied: '복사됨',
    downloadMd: '상세 보고 받기(.md)',
    downloadBriefMd: '짧은 요약 받기(.md)',
    micError: '마이크를 사용할 수 없습니다. 브라우저 권한을 확인하세요.',
    fileTooLarge: '오디오 파일이 너무 큽니다(최대 20MB).',
    genericError: '오류가 발생했습니다. 잠시 후 다시 시도하세요.',
    insufficientCredits: '크레딧이 부족합니다.',
  },
  flowMusicVeo: {
    pageTitle: 'AI 뮤직비디오 (Flash 가사 + Veo)',
    metaDescription:
      '블록별 가사(Flash JSON), Lyria형 스타일, 첫 약 8초는 이미지로 생성 후 Veo로 연장—매 단계 프롬프트에 해당 블록 가사. 하나의 MP4. 오디오는 Veo 생성.',
    headline: '뮤직비디오 — 가사(Flash) + 영상·소리(Veo)',
    subtitle:
      '1단계: 장르(Flash)+이미지/힌트. 4단계: 가사 칸을 위에서 아래로 한꺼번에 표시; «가사 칸 열기…» 또는 영상 후 «약 8초 더 이어 붙이기»로 행 추가; 칸마다 생성 또는 직접 입력 — 아래 Veo(이미지 후 연장).',
    stepLyricsTitle: '1단계 — 장르·힌트 (Flash 가사)',
    stepLyricsBody:
      '여기서는 장르+이미지+주제만(보컬/템포는 Veo). 4단계는 모든 가사 칸을 동시에 표시; «가사 칸 열기…» 또는 «약 8초 더 이어 붙이기»로 행 추가(최대 20). «가사 생성» 또는 직접 입력.',
    lyricsModeLabel: '가사 생성 방식',
    lyricsModeAllAtOnce: '한 번에 — N블록',
    lyricsModeProgressive: '단계별 — 다음 블록만',
    lyricsProgressiveHelp:
      '1단계: 스타일→이미지→힌트; 4단계는 가사 칸을 위에서 아래로 나열, 필요한 칸에서 «가사 생성». 보컬/템포/구성은 Veo 영상 단계에서. «가사 칸 열기…»로 빈 행 추가(최대 20). 회당 {credits} 크레딧 — 영상 버튼과 별개.',
    openNextLyricsSegmentButton: '가사 칸 열기 — {k}블록',
    segmentVideoSubBlockHint: 'Veo 영상(별도 흐름, 가사 준비 후):',
    progressiveStyleOnlyInStep1Note: '장르/보컬/템포 등은 여기서만 선택. 아래 영상 단계에서는 음악 항목을 다시 고르지 않습니다.',
    lyricsGenreOnlyHelp:
      'Flash 가사 프롬프트에만 사용. 보컬·템포·구조 등은 4단계 Veo에서 선택하며 가사 생성 시에는 보내지 않습니다.',
    veoStyleFieldsIntro: '보컬·언어·템포·구성 — 이 클립의 Veo용(가사 생성에는 미사용).',
    progressiveExtendStyleLockedNote: '음악 스타일은 1블록 가사 생성 때와 동일 — 화면/카메라/캐릭터만 선택적으로 추가.',
    progressiveVideoSectionTitle: '영상 만들기 — {k}블록',
    generateNextSegmentButton: '가사 생성 — 블록 {k} / {n}',
    successLyricsOneSegment: '{k}/{n}블록을 생성했습니다. 계속하거나 모두 채운 뒤 다음 단계로.',
    incrementalPlanFrozenHelp: '단계별 생성 시작됨 — 블록 수 변경 불가. «처음부터»로 초기화.',
    lyricsModeFrozenHint: 'AI 가사 진행 중 — 방식 전환 불가. «처음부터».',
    progressiveNoNextSegment: '모든 칸이 채워졌습니다 — 4단계로 가거나 «처음부터».',
    hintLabel: '주제/스토리 힌트(이미지가 있으면 짧게 가능)',
    hintPlaceholder: '예: 한국어 팝, 여름과 바다, 밝은 분위기…',
    lyricsImageHelp: '선택 참고 이미지 — Flash가 가사에 반영합니다.',
    generateLyricsButton: '가사 생성 (Flash)',
    generatingLyrics: '가사 생성 중…',
    lyricsNeedHintOrImage: '힌트 4자 이상 또는 이미지 1장이 필요합니다.',
    successLyrics: '가사가 생성되었습니다 — 확인·수정하세요.',
    successLyricsBlocks: '연결된 {n}개 블록 가사(JSON) 생성 — 4단계에서 칸별 확인.',
    lyricsBlockCountLabel: '가사 블록 수 / 8초 클립',
    lyricsBlockCountHelp: 'Flash가 이 개수로 JSON 출력. 4단계 칸 수·Veo 연장 횟수와 맞출 것.',
    openingLyricsLabel: '첫 8초 구간 가사',
    openingLyricsHelp: '1번 칸에 충분한 줄(약 8초 분량)을 입력하세요. Veo에는 이 블록 + 영어 스타일 설명이 전달됩니다.',
    fillOpeningButton: '전체에서 앞부분 채우기',
    assignOpeningToSegment1: '앞부분 가사를 1번 칸에 넣었습니다.',
    styleBlockTitle: '2단계 — 음악 스타일 (Lyria 보컬과 동일)',
    styleBlockBody: '선택 항목은 영어 설명으로 Veo에 전달됩니다. MP3는 만들지 않고 Veo가 오디오를 합성합니다.',
    genreLabel: '장르',
    voiceGenderLabel: '보컬 성별',
    voiceTimbreLabel: '음색',
    voiceLangLabel: '노래 언어',
    bpmLabel: '템포 (BPM)',
    structureLabel: '곡 구조',
    densityLabel: '편곡 밀도',
    videoBlockTitle: '3단계 — 이미지와 8초 클립 (720p)',
    videoBlockBody: '1장: 시작 프레임 I2V. 2~3장: 참조 전용(별도 시작 프레임 없음). 최대 3개 파일.',
    aspectLabel: '비율',
    aspect169: '16:9',
    aspect916: '9:16',
    framesLabel: '이미지 (1~3)',
    framesHelpSingle: '1개: 영상 시작 프레임.',
    framesHelpMulti: '2~3개: 모두 참조(ASSET) 이미지.',
    visualExtraLabel: '추가 영상 지시 (선택)',
    visualExtraPlaceholder: '예: 골든아워, 슬로모션, 노래할 때 클로즈업…',
    createClip8s: '8초 클립 만들기 (720p)',
    creatingClip: '8초 클립 생성 중(Veo)…',
    clip720Note:
      '각 블록은 약 8초짜리 독립 Veo 클립(1블록과 같은 이미지). 마지막에 서버에서 MP4로 합칩니다. 클립당 약 8 크레딧; 합치기는 무료.',
    needImage: '이미지를 1장 이상 선택하세요.',
    previewTitle: '미리보기 안내',
    downloadMp4: 'MP4 다운로드',
    segmentIndexLabel: '클립 {n}',
    createSegment1VideoButton: '이미지로 1블록 클립 만들기(약 8초, 720p)',
    addEightMoreVideoButton: '영상을 약 8초 더 이어 붙이기',
    addEightMoreVideoHelp:
      '다음 가사 칸을 엽니다. 생성하거나 직접 입력한 뒤 해당 블록용 약 8초 독립 클립을 만듭니다(1블록과 같은 이미지). 나중에 하나의 MP4로 합칠 수 있습니다.',
    extendSegmentVideoButton: '{k}블록 클립 만들기(약 8초, 독립)',
    extendingVeoSegmentBusy: '{k}블록 클립 생성 중(Veo) — 몇 분 걸릴 수 있습니다…',
    videoSequentialBlockIntro: '각 단계의 영상과 다음 동작이 바로 아래에 표시됩니다.',
    videoImagesOnlyStep3Note: '1블록의 이미지·비율이 이후 모든 클립에 재사용(각각 별도 생성, 연장 아님).',
    previewInStep4Note: '각 체크포인트 영상은 4단계 안에 표시됩니다.',
    videoForSegmentLockedNote: '«영상을 약 8초 더 이어 붙이기»를 누르고 이전 클립이 있으면 이 구간 Veo가 표시됩니다.',
    successExtendSegment: '{k}블록 클립이 준비되었습니다. 아래 영상을 확인하세요.',
    partialSegmentsFail: '구간 {n} 생성 중 중단 — 이전 클립은 재생·다운로드·합치기 가능.',
    startOver: '처음부터',
    veoAudioNote: 'MP4 오디오는 프롬프트(가사+스타일 문구)로 Veo가 생성한 것입니다.',
    successClip: '8초 클립을 만들었습니다.',
    segmentCountLockedHelp: '가사 칸을 늘린 뒤 또는 AI 가사 사용 후 구간 수가 고정됩니다. «처음부터»로 초기화.',
    lyricsLockedNote: '구간별 가사가 잠겨 있어 Veo 전송 순서가 유지됩니다.',
    segmentsCountSyncedNote: '1단계와 동일: {n}구간.',
    videoAfterSegmentLabel: '가사 블록 {n} 이후 (약 {seconds}초)',
    downloadMp4Step: 'MP4 다운로드 — 체크포인트 {n}',
    extendPerStepSectionTitle: '클립마다 옵션',
    extendPerStepSectionBody: '2단계 음악 스타일은 모든 클립에 적용. 카메라/캐릭터는 생성 전마다 수정 가능.',
    extendBridgeLabel: '구간 {to}용 독립 약 8초 클립 — 1블록과 같은 이미지; 이후 MP4 합치기.',
    extendSegmentVisualLabel: '화면 메모 (이번 연장)',
    cameraHintLabel: '카메라 앵글 / 움직임',
    cameraHintPlaceholder: '예: 천천히 왼쪽 팬, 와이드, 가벼운 핸드헬드…',
    characterStoryLabel: '캐릭터 동작 / 스토리',
    characterStoryPlaceholder: '예: 바다를 바라봄, 손을 듦, 돌아서 걸어감…',
    standaloneFramesNote: '1블록에서 고른 이미지를 다시 사용합니다. 이 클립 프롬프트용으로 카메라/캐릭터를 조정할 수 있습니다.',
    mergeClipsSectionTitle: '만든 클립 합치기',
    mergeClipsSectionHelp: '1→2→… 순서로 하나의 MP4로 합칩니다. 크레딧 없음; 서버에 ffmpeg 필요.',
    mergeClipsButton: '하나의 MP4로 합치기',
    mergingClips: '서버에서 영상 합치는 중…',
    successMergedClip: '합치기 완료. 아래에서 보거나 기록에서 열 수 있습니다.',
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
    mobileCreateHomework: '숙제 만들기',
    assignWorksheet: '숙제',
    classHomeworkListEmpty: '이 수업에 연결된 숙제가 아직 없습니다.',
    classHomeworkListCreateCta: '숙제 만들기',
    classHomeworkOpenLamBai: '학생 풀이 페이지',
    classHomeworkAttachOtherClassButton: '숙제를 다른 반에 연결',
    classHomeworkAttachPickTitle: '숙제를 다른 반에 연결',
    classHomeworkAttachPickDescription:
      '동일한 내용으로 새 숙제 세션(새 코드·링크)을 만들어 선택한 반에 연결합니다.',
    classHomeworkAttachSessionLabel: '숙제',
    classStudentHomeworkSessionsEmpty: '선생님이 낸 숙제가 아직 없습니다.',
    noWorksheets: '워크시트가 없습니다',
    noStudents: '학생이 없습니다',
    doWorksheet: '문제 풀기',
    submit: '제출',
    submitSuccess: '제출됨',
    viewResult: '결과 보기',
    quizScore: '퀴즈 점수',
    sampleAnswer: '모범 답안',
    submissions: '제출 목록',
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
    classExamsSubsectionGraded: '시험(채점)',
    classExamsSubsectionPracticeHomework: '숙제(학생에게 점수 미표시)',
    studentClassHomeworkSubmittedCaption:
      '제출했습니다. 숙제이므로 여기서는 점수를 보여주지 않습니다.',
    classSessionBadgeHomework: '숙제',
    lamBaiSeoTitleSuffixExam: '온라인 시험',
    lamBaiSeoTitleSuffixHomework: '숙제',
    lamBaiSeoDescriptionExam:
      '세션 코드로 온라인 시험을 봅니다. 객관식·서술형, 채점이 있습니다.',
    lamBaiSeoDescriptionHomework:
      '세션 코드로 온라인 숙제를 합니다. 연습용이며 정식 시험처럼 점수를 보여주지 않습니다.',
    lamBaiSeoKeywordsExam: '시험, 온라인 시험, 객관식, 서술형, NanoAI',
    lamBaiSeoKeywordsHomework: '숙제, 복습, NanoAI',
    lamBaiSeoFallbackTitle: '온라인으로 풀기',
    lamBaiSeoFallbackDescription:
      '로그인 후 세션 코드나 교사가 보낸 링크로 과제를 완료하세요.',
    lamBaiSeoFallbackKeywords: '시험, 숙제, NanoAI',
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
    examAttachToOtherClassButton: '다른 반에 연결',
    examAssignClassButton: '반에 배정',
    examAttachPickClassTitle: '시험을 다른 반에 연결',
    examAttachPickClassDescription:
      '같은 문항으로 새 시험 세션(코드·링크는 새로)을 만들어 선택한 반에 연결합니다.',
    examAttachSelectClassLabel: '반 선택',
    examAttachSelectClassPlaceholder: '— 반을 선택하세요 —',
    examAttachSubmit: '반에 연결',
    examAttachLoadingClasses: '반 목록 불러오는 중…',
    examAttachWorking: '시험 세션 만드는 중…',
    examAttachNoClassesBody: '아직 만든 반이 없습니다. 먼저 반을 만든 뒤 다시 와서 시험을 연결하세요.',
    examAttachNoOtherClassesBody:
      '현재 반 외에 다른 반이 없습니다. 사본을 연결하려면 반을 하나 더 만드세요.',
    examAttachFailed: '시험을 연결하지 못했습니다. 잠시 후 다시 시도하세요.',
    examAttachSuccessSummary: '새 세션이 다음에 연결되었습니다: {classLine}.',
    examAttachClose: '닫기',
    examAttachPickAnotherClass: '다른 반에도 연결',
    examAttachExamLabel: '시험',
    examAttachAllClassesAlreadyAttachedBody:
      '담당 반마다 이미 이 시험 세션(동일 문항)이 있습니다. 더 연결할 반이 없습니다.',
    examAttachNeedDifferentClassHint:
      '원하는 반이 없나요? 새 탭에서 반을 만든 뒤 아래 «반 목록 새로고침»을 누르세요.',
    examAttachReloadClassList: '반 목록 새로고침',
    examAttachOpenCreateClassNewTab: '새 반 만들기(새 탭)',
    examAttachClassAlreadyHasExam: '이 반에는 이미 이 시험이 있습니다.',
    examIdentityFromClassHint:
      '수업 명단에 이름과 생년월일이 이미 있습니다. 준비되면 시작을 누르세요. 타이머는 시작 후에만 작동합니다.',
    examChangeIdentityManual: '다른 이름·생년월일 입력',
    examManualIdentityIntro: '정보를 입력하고 시작을 누르세요. 타이머는 시작 후에만 작동합니다.',
    examStartTestButton: '시험 시작',
    examOneAttemptNote:
      '계정당 한 번입니다. 시작 후 서버에서 세션이 고정되며 새로 섞인 문제를 받을 수 없습니다. 나가려면 제출해야 합니다.',
    examStartHomeworkButton: '숙제 시작',
    homeworkIdentityFromClassHint:
      '수업 프로필에 이름과 생년월이 있습니다. 준비되면 시작을 누르세요. 타이머는 시작 후에만 작동합니다.',
    homeworkManualIdentityIntro:
      '정보를 입력하고 시작을 누르면 숙제를 진행합니다. 타이머는 시작 후에만 작동합니다.',
    homeworkEnrollGateTitle: '수업에 참가해 숙제하기',
    homeworkEnrollGateDescription:
      '이 숙제는 수업에 연결되어 있습니다. 명단과 동일한 이름·생년월일을 입력하세요(Google 표시 이름 사용 금지). 이후 숙제를 시작할 수 있습니다.',
    homeworkEnrollSubmitButton: '수업 참가 후 숙제 시작',
    homeworkDefaultTitle: '숙제',
    lamBaiLoadingNeutral: '불러오는 중…',
    lamBaiFiveMinWarning: '5분 남았습니다! 마감 전 답을 확인하세요.',
    lamBaiTimerTimeUpAutoSubmittingExam: '시간이 끝났습니다. 답안을 자동 제출합니다.',
    lamBaiTimerTimeUpAutoSubmittingHomework: '시간이 끝났습니다. 숙제를 자동 제출합니다.',
    lamBaiTimerStickySubmittingExam: '시간 종료 — 제출 중…',
    lamBaiTimerStickySubmittingHomework: '시간 종료 — 제출 중…',
    lamBaiExitBlockedBanner:
      '시험 진행 중입니다. 제출한 뒤에만 페이지를 벗어나는 것이 좋습니다. 탭 닫기·새로고침·뒤로 가기는 차단되거나 경고됩니다. 제출로 종료하세요. 잠시 나갔다 돌아와도 타이머는 «시작»을 누른 시각부터 계속 흐릅니다.',
    lamBaiExitBlockedBeforeStartHint:
      '«시작»을 누른 뒤에는 제출한 다음 페이지를 떠나는 것이 좋습니다. 탭을 닫거나 새로고침·이탈을 시도하면 브라우저가 경고합니다. 나갔다 돌아와도 되지만, 타이머는 시작을 누른 시각부터 계속 흐릅니다.',
    lamBaiExitBlockedDialogTitle: '제출해야 나갈 수 있음',
    lamBaiExitBlockedDialogDescription:
      '시험 진행 중입니다. 안전하게 나가려면 제출하세요. 아래 «지금 제출» 또는 페이지 하단 제출을 누르세요.',
    lamBaiExitBlockedSubmitNow: '지금 제출',
    lamBaiExitBlockedStay: '계속 풀기',
    lamBaiExamResumeNotice:
      '미제출 시험이 있습니다. 저장된 답안을 복구했습니다. 이어서 풀고 마치면 제출하세요.',
    examBeginStarting: '시작하는 중…',
    examBeginFailed: '시험을 시작할 수 없습니다. 다시 시도하세요.',
    examSubmitSending: '제출 중…',
    examSubmitButton: '제출하기',
    homeworkSubmitSending: '숙제 제출 중…',
    homeworkSubmitButton: '숙제 제출',
    homeworkLoadFailed: '숙제를 불러올 수 없습니다.',
    lamBaiQuestionLabel: '{index}번.',
    examSubmittedTitle: '제출 완료',
    examSubmittedSavedEarlier: '이미 이 시험을 제출했습니다. 아래는 저장된 결과입니다.',
    examSubmittedDueToDeadlineHint:
      '서버 제한 시간이 종료되어 저장된 답안으로 자동 제출되었습니다. 아래는 결과입니다.',
    homeworkSubmittedTitle: '숙제 제출 완료',
    homeworkSubmittedSavedEarlier: '이미 이 숙제를 제출했습니다. 아래는 저장된 정보입니다.',
    homeworkSubmittedBody:
      '연습용 숙제로, 학생에게는 점수나 채점 척도를 보여주지 않습니다. 교사는 수업에서 확인·피드백할 수 있습니다.',
    homeworkMcCorrectOnlyLine: '객관식: {correct}/{total}문제 정답',
    homeworkShareLine: '제출함: {title}',
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
    examSessionCreatedAt: '생성 {time}',
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
    classExamsIndexTitle: '수업 시험',
    classExamSessionPageTitle: '시험 상세',
    classExamGoToSession: '채점 페이지 열기',
    classDetailSeoDescription: '수업 홈: 시험, 명단, 성적표.',
    classHubCardAssignWorksheetDesc:
      '이 수업에 만들고 연결된 숙제입니다. 학생은 링크나 코드로 풉니다.',
    classPageStudentFacingNotSet: '설정 안 됨',
    classHubCardStudentWorksheetsDesc:
      '선생님이 낸 숙제: 링크나 세션 코드로 풀이 페이지에서 완료합니다.',
    classHubCardCreateExamButton: '시험 만들기',
    classHubCardCreateHomeworkButton: '숙제 만들기',
    worksheetLamBaiNoInteractiveHint:
      '이 워크시트에는 웹에서 풀 수 있는 객관식·서술형 문항이 없습니다(교사가 교재 도구에서 문항을 연결해야 합니다). 여기서는 제출할 수 없습니다.',
    worksheetLamBaiBackToClassWorksheets: '반 워크시트 목록으로',
    worksheetLamBaiMcqSectionTitle: '객관식',
    worksheetLamBaiEssaySectionTitle: '서술형',
    worksheetLamBaiEssayPlaceholder: '답을 입력하세요…',
    worksheetSubmitNoInteractiveError: '온라인 문항이 없습니다. 교사가 먼저 문항을 연결해야 합니다.',
    assignWorksheetNoQuestionBankHint:
      '문항이 연결되지 않았습니다. 학생은 웹에서 풀고 제출할 수 없습니다.',
    assignWorksheetOpenInCurriculumTool: '교재 도구에서 열기',
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
  weddingCardAiMusic: {
    playStartLabel: '재생 시작',
    playEndLabel: '종료 / 반복 지점',
    playStartPlaceholder: '비움 또는 0 · 30 · 1:30 (비움 = 처음부터 전곡 재생)',
    playEndPlaceholder: '비움 = 끝까지 재생(자르기 없음)',
    segmentHint:
      '두 칸 모두 비우면 원본 그대로 처음부터 끝까지 재생합니다. 입력 시 구간 지정: 초(30) 또는 분:초(1:30). 종료 시각을 넣으면 해당 구간에서 반복합니다. 저장 시 청첩장에 적용됩니다.',
    useCurrentPlaybackAsStart: '현재 재생 위치를 시작으로 사용',
    playbackLoadFailed:
      '음악을 불러오지 못했습니다(파일이 없을 수 있습니다). 청첩장 주인이 편집 화면에서 배경음을 다시 올려 주세요.',
    publicFabPauseAria: '배경음 끄기',
    publicFabPlayAria: '배경음 켜기',
    publicMapEmbedTitle: '예식 장소 지도',
  },
  weddingCardCalendar: {
    sectionTitle: '예식 정보',
    introLine: '피로연이 다음 시간에 진행됩니다:',
    receptionLabel: '하객 맞이',
    partyLabel: '피로연 시작',
    timePlaceholderDash: '—',
  },
  weddingGiftBox: {
    boxTitle: '축의금 박스',
    tapToOpen: '눌러서 열기',
    dialogTitle: '축의금 — VietQR 스캔',
    brideSection: '신부',
    groomSection: '신랑',
    accountHolder: '예금주',
    accountNumber: '계좌번호',
    bankSelectPlaceholder: '은행 선택',
    vietqrFooterNote: '뱅킹 앱으로 스캔하세요 (VietQR).',
    closeButton: '닫기',
    envelopeButtonAria: '축의금 박스를 열어 QR 코드 보기',
    editorHint:
      '켜면 신부·신랑 각각 은행, 계좌번호, 예금주를 입력해 VietQR 두 개를 만듭니다. 또는 아래에 QR 이미지 URL(구 방식)을 넣을 수 있습니다.',
    legacyImageLabel: 'QR 이미지 URL(선택, 한 장)',
    legacyImageDesc: '위의 이중 VietQR을 쓰지 않을 때만 사용합니다.',
    saveNeedConfig: '축의 QR 켜짐: 신부+신랑 정보를 모두 입력하거나 QR 이미지 URL을 넣으세요.',
    qrAltBride: '이체 QR — 신부',
    qrAltGroom: '이체 QR — 신랑',
    qrAltLegacy: '축의 QR',
  },
  weddingCardAiBrief: {
    step2Description:
      '내용 수정과 미리보기는 무료입니다. 약 1초 후 자동 저장되며, «저장»을 눌러 바로 저장할 수 있습니다.',
    autoSavedLabel: '자동 저장됨',
    autoSaveFailedLabel: '자동 저장에 실패했습니다. 네트워크를 확인하거나 «저장»을 누르세요.',
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
    openCreatedExamsListButton: '만든 시험 목록 열기',
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
    homeworkPageTitle: '숙제 만들기',
    homeworkPageSubtitle:
      '온라인 시험과 같은 단계(과목·학급·문항·QR/링크)이며 총점 100점 맞출 필요 없음. 제출 후 학생에게는 점수를 표시하지 않습니다.',
    defaultHomeworkTitle: '숙제',
    homeworkCreatedBadge: '숙제가 만들어졌습니다',
    createHomework: '숙제 만들기',
    createAnotherHomework: '다른 숙제 만들기',
    createdHomeworkListTitle: '만든 숙제',
    createdHomeworkHint: '링크나 QR로 학생이 풀게 하세요. 시험처럼 다른 학급에도 붙일 수 있습니다.',
    openCreatedHomeworkListButton: '숙제 목록 보기',
    homeworkCreateSuccess: '숙제를 만들었습니다',
    homeworkCreateSuccessDesc: '학생에게 링크나 QR 코드를 공유하세요.',
    homeworkEssayNo100Note:
      '필요하면 서술형 문항을 고릅니다. 제출 후 학생에게 점수가 보이지 않으며, 문항별 시간·배점을 맞출 필요가 없습니다.',
    homeworkCardInfo: '숙제 정보',
    homeworkFormCardDescription:
      '과목·수업·교사용 교안에서 문항을 고릅니다. 시험 시간이나 배점 설정은 필요 없고, 답안은 저장되며 학생에게 점수가 표시되지 않습니다.',
    homeworkTitlePlaceholder: '수학 숙제 — 복습',
    homeworkQuizPartFooterHint:
      '난이도별 문항 수를 입력한 뒤 아래 목록에서 같은 개수만큼 고릅니다. 숙제는 여기서 분·배점을 맞출 필요가 없습니다.',
    noHomeworkSessionsYet: '아직 숙제가 없습니다.',
    homeworkCreatedResultLine: '문항 {count}개',
    homeworkSummaryMc: '객관식: {count}문항',
    homeworkSummaryEssay: '서술형: {count}문항',
    homeworkDeleteConfirm: '이 숙제를 삭제할까요? 이 작업은 되돌릴 수 없습니다.',
    homeworkDeleted: '삭제됨',
    homeworkDeletedDesc: '숙제가 삭제되었습니다.',
  },
  adminWorksheetVerify: {
    pageTitle: '워크시트 검증 보고서',
    pageDescription:
      '주로 자동 검증(cron) 실행 결과 보고서를 다시 보는 페이지입니다. 대기/처리 워크시트 수, 검증 표시·내용 수정 횟수를 보여 주며 행을 펼치면 워크시트별 상세를 볼 수 있습니다. 필요 시 «새 스캔 시작»으로 서버에서 수동 배치 실행도 가능합니다.',
    reportScopeNote:
      '교육과정 생성 후 백그라운드 검증도 서버가 백그라운드 검증에 맞게 설정된 경우 여기에 기록됩니다. 이전에는 배치/cron만 기록되었습니다. 보고서가 없으면 서버 환경을 확인한 뒤 검증을 한 번 더 실행하세요.',
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

