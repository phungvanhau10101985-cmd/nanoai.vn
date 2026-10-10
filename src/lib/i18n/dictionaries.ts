import { DEFAULT_WEB_LOCALE, type WebLocale } from '@/lib/i18n/config'
import type { LegalPagesBundle } from '@/lib/i18n/dictionary-legal-pages'
import { LEGAL_PAGES_BY_LOCALE } from '@/lib/i18n/dictionary-legal-pages'

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
  | 'curriculum_plan'
  | 'online_exam'
  | 'homework_online'
  | 'classes'
  | 'try_on_1'
  | 'try_on_2'
  | 'try_on_3'
  | 'try_on_4'
  | 'try_on_5'
  | 'image_result_display'
  | 'catalog_photo_pack'
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
    personalSection: string
    messagesSection: string
    businessSection: string
    historySection: string
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
    /** Menu tài khoản → trang phí tháng giáo trình */
    viewPlan: string
    /** Nút / mục menu nạp thêm credit */
    topUpCredits: string
    /** Trung tâm tác vụ / hàng đợi */
    tasksHub: string
    /** Menu → /support-chat */
    supportChat: string
    /** Menu → /dashboard/messaging (kênh kinh doanh của đối tác) */
    partnerInbox: string
    /** Menu → /dashboard/messaging/website (AI tạo web/landing cho shop) */
    messagingWebsite: string
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
  hubChat: {
    title: string
    subtitle: string
    placeholder: string
    modeChat: string
    modeWorkflow: string
    workflowAll: string
    modelLabel: string
    send: string
    thinking: string
    openTool: string
    suggested: string
    suggestedExamplePrefix: string
    loginRequired: string
    errorGeneric: string
    creditNote: string
    fallbackReply: string
    workflowPick: string
    clearReply: string
    modePipeline: string
    modeStudio: string
    studioSubtitle: string
    studioPlaceholder: string
    studioProcessTitle: string
    studioProcessForwardOnlyHint: string
    studioNavigateStepHint: string
    studioNavigatedToStep: string
    studioStepSavedStay: string
    studioNavigateStepBlocked: string
    studioRegenerate: string
    studioRegenerateDialogTitle: string
    studioRegeneratePromptLabel: string
    studioRegeneratePromptHint: string
    /** design_recreate: optional add-on notes when regenerating the single board image */
    studioDesignRecreateRegenerateTitle: string
    studioDesignRecreateRegeneratePromptLabel: string
    studioDesignRecreateRegeneratePromptHint: string
    studioRegenerateConfirm: string
    studioExistingStepHint: string
    studioUseReference: string
    studioImageCredit: string
    studioGenerating: string
    studioSampleLabel: string
    studioSamplePrompt: string
    studioApprovedNext: string
    studioApprovedGenerated: string
    studioReferenceWillUse: string
    studioReferenceTitle: string
    studioReferenceLimit: string
    studioReferenceRemoved: string
    studioBriefUpdated: string
    studioFacePrintStyleConfirmed: string
    studioDiscoveryBriefConfirmed: string
    studioBoxFaceConfirmed: string
    studioEditStep: string
    studioEditSave: string
    studioEditCancel: string
    studioEditStepUnknown: string
    studioEditCredit: string
    studioReferenceRemove: string
    studioReferenceAttachHint: string
    studioReferenceCount: string
    studioGenRefPickerTitle: string
    studioGenRefPickerHint: string
    studioGenRefApprovedSection: string
    studioGenRefProductSection: string
    studioGenRefProductLabel: string
    studioGenRefProductUploadNote: string
    studioGenProductUploaded: string
    studioGenRefStyleSection: string
    studioGenRefStyleLabel: string
    studioGenRefStyleUploadNote: string
    studioGenRefStyleRemove: string
    studioStyleRefUploaded: string
    studioStyleRefWrongStep: string
    studioGenRefAttachCount: string
    studioLogoFirst: string
    studioNeedLogoReference: string
    studioLogoApprovedNext: string
    studioStartWithLogo: string
    studioLogoUploadHint: string
    studioLogoUploadBtn: string
    studioLogoUploadUserLabel: string
    studioLogoUploadNeedFile: string
    studioLogoUploadWrongStep: string
    studioLogoUploadAlready: string
    studioFaceUploadNeedFile: string
    studioFaceUploadWrongStep: string
    studioFaceUploadSaved: string
    studioFaceUploadUserLabel: string
    studioFaceUploadReplaceBtn: string
    studioFaceUploadConfirmTitle: string
    studioFaceUploadConfirmFaceField: string
    studioFaceUploadConfirmSizeField: string
    studioFaceUploadConfirmFile: string
    studioFaceUploadConfirmHint: string
    studioFaceUploadConfirmOk: string
    studioFaceUploadConfirmSizeUnknown: string
    studioGeneratedStep: string
    studioGenerateCurrent: string
    studioGenerateFace: string
    studioGenerateMusic: string
    studioGenerateArtifact: string
    studioNewFlowConfirmTitle: string
    studioNewFlowConfirmBody: string
    studioNewFlowConfirmOk: string
    studioNewFlowConfirmCancel: string
    studioNewFlowThreadRequired: string
    advisoryFeatureOpenConfirmTitle: string
    advisoryFeatureOpenConfirmBody: string
    advisoryFeatureOpenConfirmOk: string
    advisoryFeatureOpenConfirmCancel: string
    advisoryOpenFeature: string
    advisoryStandaloneFeatureBody: string
    featureGroupStudioInline: string
    featurePickerHint: string
    featureFeedbackOpen: string
    featureFeedbackTitle: string
    featureFeedbackHint: string
    featureFeedbackPlaceholder: string
    featureFeedbackSend: string
    featureFeedbackClose: string
    featureFeedbackSent: string
    featureFeedbackNeedText: string
    unmatchedSentToAdmin: string
    studioLogoPendingApprove: string
    studioStepPendingApprove: string
    studioApproveBeforeNext: string
    studioRegenerated: string
    studioAllDone: string
    studioPostFlowSuggestHint: string
    planCreated: string
    startStep: string
    continueNextStep: string
    planBannerTitle: string
    planStepProgress: string
    planCompleteStep: string
    planSkipStep: string
    planCancel: string
    planOpenQueue: string
    viewTaskQueue: string
    newThread: string
    newThreadFlowHint: string
    chatHistory: string
    chatHistoryEmpty: string
    chatHistoryLoadFailed: string
    chatHistoryDelete: string
    chatHistoryDeleted: string
    chatHistoryDeleteFailed: string
    chatHistoryClose: string
    autoRunTitle: string
    autoRunEstimate: string
    autoRunUpload: string
    autoRunImagesSelected: string
    autoRunStart: string
    autoRunRunning: string
    autoRunDone: string
    autoRunNeedImage: string
    studioNeedUpload: string
    studioBannerSavedCreateNext: string
    studioBannerNeedRatio: string
    studioBannerNeedCopy: string
    studioBannerLogoNeedFile: string
    studioBannerLogoWrongStep: string
    studioBannerOptimizeAi: string
    studioBannerOptimizeEmpty: string
    studioBannerOptimizeDone: string
    studioBannerOptimizeDoneDesc: string
    studioBannerOptimizeFailed: string
    studioBannerOptimizeNoDeepSeek: string
    studioBannerPromptBuildFailed: string
    studioBannerBatchMax: string
    studioBannerBatchSelected: string
    studioBannerBatchGenerated: string
    studioBannerBatchProgress: string
    studioBannerNext: string
    studioBannerBatchApproveNext: string
    studioGenerateBanner: string
    studioGenerateMenu: string
    studioGenerateLanding: string
    studioMenuNeedFormat: string
    studioMenuNeedDishes: string
    studioMenuPromptBuildFailed: string
    studioMenuLogoNeedFile: string
    studioMenuLogoWrongStep: string
    studioLandingNeedCopy: string
    studioLandingNeedLogo: string
    studioLandingCopySaved: string
    studioLandingLogoNeedFile: string
    studioLandingLogoWrongStep: string
    studioLandingLogoNeedBrief: string
    studioLandingLogoGenerated: string
    studioLogoStripBg: string
    studioUploadBtn: string
    studioImagesUploaded: string
    studioMusicCredit: string
    studioContinue: string
    studioNoPreview: string
    studioNoPrompt: string
    studioMinChars: string
    studioViewLarge: string
    studioDownload: string
    studioDownloadPng: string
    studioDownloadJpeg: string
    studioDownloadFailed: string
    studioDownloadFailedHint: string
    studioCropImage: string
    studioCropSizeDisplay: string
    studioCropTargetDisplay: string
    studioCropTitle: string
    studioCropSave: string
    studioCropDone: string
    studioCropCancel: string
    studioCropZoom: string
    studioCropTargetSize: string
    studioCropResultSize: string
    studioCropDragHint: string
    studioCropRatioLocked: string
    studioCropFillEdgeColor: string
    studioCropFillEdgeColorOff: string
    studioCropOutpaintBackground: string
    studioCropOutpaintBusy: string
    studioCropOutpaintNeedGaps: string
    studioCropOutpaintDone: string
    studioCropOutpaintCredit: string
    studioCropBlendSeams: string
    studioCropBlendSeamsBusy: string
    studioCropEraser: string
    studioCropAdjustFrame: string
    studioCropFrameModeFree: string
    studioCropFrameModePrint: string
    studioCropDragHintFree: string
    studioCropRatioFree: string
    studioCropEraserSize: string
    studioCropEraserUndo: string
    studioCropEraserUndoHint: string
    studioCropMagicEraser: string
    studioCropMagicEraserBusy: string
    studioCropMagicEraserHint: string
    studioCropMagicEraserModeBox: string
    studioCropMagicEraserModeBrush: string
    studioCropMagicEraserBoxHint: string
    studioEditAddText: string
    studioEditAddImage: string
    studioEditAddSticker: string
    studioEditOverlayHint: string
    studioEditTextPlaceholder: string
    studioEditTextColor: string
    studioEditColorOk: string
    studioEditDeleteLayer: string
    studioEditRevertOriginal: string
    studioEditReverted: string
    studioCropApplied: string
    studioCropSizeLine: string
    studioDiscoveryBlocked: string
    studioPresets: {
      mobile_shop: { title: string; sample: string; steps: Record<string, string> }
      sale_banner: { title: string; sample: string; steps: Record<string, string> }
      brand_kit: { title: string; sample: string; steps: Record<string, string> }
      landing_page: { title: string; sample: string; steps: Record<string, string> }
      product_listing: { title: string; sample: string; uploadHint: string; steps: Record<string, string> }
      wedding_invite: { title: string; sample: string; steps: Record<string, string> }
      ad_music: { title: string; sample: string; steps: Record<string, string> }
      lookbook: { title: string; sample: string; uploadHint: string; steps: Record<string, string> }
      packaging_kit: { title: string; sample: string; steps: Record<string, string> }
      interior_design: { title: string; sample: string; uploadHint: string; steps: Record<string, string> }
      social_media_kit: { title: string; sample: string; steps: Record<string, string> }
      story_with_images: { title: string; sample: string; steps: Record<string, string> }
      infographic_series: { title: string; sample: string; uploadHint: string; steps: Record<string, string> }
      fashion_campaign: { title: string; sample: string; uploadHint: string; steps: Record<string, string> }
      design_recreate: { title: string; sample: string; uploadHint: string; steps: Record<string, string> }
      profile_photo_pack: { title: string; sample: string; uploadHint: string; steps: Record<string, string> }
    }
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
  /** /privacy, /terms, /data-deletion — URL công khai cho Meta Developer & minh bạch */
  legal: LegalPagesBundle
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
    channelsSectionDesc: string
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
    shopFacebookPixelHint: string
    shopFacebookCapiHint: string
    shopFacebookPixelInvalidToast: string
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
    shopGoogleAdsIdLabel: string
    shopGoogleAdsIdHint: string
    shopGoogleAdsIdPlaceholder: string
    shopGoogleAdsInvalidIdToast: string
    shopGoogleAdsSaveButton: string
    shopGcrMerchantIdLabel: string
    shopGcrMerchantIdHint: string
    shopGcrMerchantIdPlaceholder: string
    shopGcrInvalidIdToast: string
    shopGcrSaveButton: string
    shopTiktokPixelLabel: string
    shopTiktokPixelHint: string
    shopTiktokPixelPlaceholder: string
    shopTiktokPixelInvalidIdToast: string
    shopTiktokPixelSaveButton: string
    shopGtmContainerLabel: string
    shopGtmContainerHint: string
    shopGtmContainerPlaceholder: string
    shopGtmContainerInvalidIdToast: string
    shopGtmContainerSaveButton: string
    shopAdsConversionLabelsTitle: string
    shopAdsConversionLabelsHint: string
    shopAdsConversionPdpLabel: string
    shopAdsConversionAddToCartLabel: string
    shopAdsConversionBeginCheckoutLabel: string
    shopAdsConversionDepositPageLabel: string
    shopAdsConversionPurchaseLabel: string
    shopAdsConversionPlaceholder: string
    shopAdsConversionInvalidToast: string
    shopAdsConversionSaveButton: string
    shopVerifyTagsTitle: string
    shopVerifyTagsHint: string
    shopSearchConsoleVerifyLabel: string
    shopMerchantCenterVerifyLabel: string
    shopFacebookDomainVerifyLabel: string
    shopVerifyPlaceholder: string
    shopVerifyInvalidToast: string
    shopSitemapTitle: string
    shopSitemapHint: string
    shopSitemapIndexUrlLabel: string
    shopSitemapPathToSubmitLabel: string
    shopSitemapCopyFullUrl: string
    shopSitemapCopyPath: string
    shopSitemapOpenGsc: string
    shopSitemapViewXml: string
    shopSitemapCopiedToast: string
    shopSitemapDraftWarning: string
    shopSitemapReadyBadge: string
    shopSitemapDraftBadge: string
    shopSitemapSubfilesLabel: string
    shopSitemapPagesLabel: string
    shopSitemapProductsLabel: string
    shopSitemapInstructionsTitle: string
    shopSitemapStep1: string
    shopSitemapStep2: string
    shopSitemapStep3: string
    shopCustomHtmlTitle: string
    shopCustomHtmlHint: string
    shopCustomHtmlHeadLabel: string
    shopCustomHtmlBodyOpenLabel: string
    shopCustomHtmlBodyCloseLabel: string
    shopTrackingExtrasSaveButton: string
    shopTiktokEventsTokenLabel: string
    shopTiktokEventsTokenHint: string
    shopTiktokEventsTokenPlaceholder: string
    shopTiktokEventsTokenConfiguredBadge: string
    shopTiktokEventsTokenSavedHint: string
    /** S0.10 */
    shopDefaultCurrencyLabel: string
    shopDefaultCurrencyHint: string
    shopDefaultCurrencySaveButton: string
    shopDefaultCurrencyInvalidToast: string
    shopContactChannelsTitle: string
    shopContactChannelsHint: string
    shopContactPhoneLabel: string
    shopContactZaloLabel: string
    shopContactMessengerLabel: string
    shopContactInstagramLabel: string
    shopContactChannelsSaveButton: string
    shopShippingCarrierLabel: string
    shopShippingCarrierHint: string
    shopShippingCarrierPlaceholder: string
    /** M3.3 */
    messagingSettingsWebhookCardTitle: string
    messagingSettingsWebhookCardBody: string
    messagingSettingsWebhookOpenButton: string
    /** S0.1 */
    customDomainRefreshStatusButton: string
    customDomainStatusHintPending: string
    customDomainStatusHintDnsOk: string
    customDomainStatusHintSslActive: string
    customDomainStatusHintError: string
    customDomainLastErrorTitle: string
    /** URL feed CSV cho Meta Commerce / Facebook danh mục sản phẩm */
    facebookCatalogFeedTitle: string
    facebookCatalogFeedHint: string
    facebookCatalogFeedCopyButton: string
    facebookCatalogFeedCopiedToast: string
    googleMerchantCatalogFeedTitle: string
    googleMerchantCatalogFeedHint: string
    googleMerchantCatalogFeedCopyButton: string
    googleMerchantCatalogFeedCopiedToast: string
    tiktokCatalogFeedTitle: string
    tiktokCatalogFeedHint: string
    tiktokCatalogFeedCopyButton: string
    tiktokCatalogFeedCopiedToast: string
    catalogFeedsPageHint: string
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
    teamInviteOkEmailFailed: string
    teamInviteMailSubject: string
    teamInviteMailTitle: string
    teamInviteMailBody: string
    teamInviteMailCta: string
    teamInviteMailNeedLogin: string
    teamInviteMailOrLink: string
    teamInviteMailIgnore: string
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
    teamPermMarketingCampaigns: string
    teamPermWebsite: string
    /** Staff có quyền analytics chỉ xem Pixel/GA4; chỉ chủ được lưu. */
    integrationsAnalyticsOwnerOnly: string
    teamRemoveMemberConfirm: string
    fbLinkedLine: string
    fbLoginWithFacebook: string
    fbLoginHint: string
    fbPickPagesTitle: string
    fbPickPagesDesc: string
    fbPickPagesSearch: string
    fbPickPagesSelectAll: string
    fbPickPagesConnect: string
    fbPickPagesConnecting: string
    fbPickPagesEmpty: string
    fbPickPagesLater: string
    fbConnectedHeading: string
    fbUnlinkPage: string
    fbManualTokenToggle: string
    fbConnectPartial: string
    zaloLinkedLine: string
    credentialsKeepHint: string
    /** Bố cục trang: cột cấu hình */
    setupColumnTitle: string
    /** Bố cục trang: cột chat */
    chatColumnTitle: string
    /** Nút/link tới /dashboard/messaging/settings */
    messagingSettingsLink: string
    marketingCampaignsLink: string
    notificationsLink: string
    emailManagementLink: string
    /** Link tới /dashboard/messaging/website */
    messagingWebsiteLink: string
    messagingOrdersLink: string
    messagingProfitLink: string
    messagingAnalyticsLink: string
    messagingSettingsPageTitle: string
    /** Ô chọn shop trên thanh header trang quản trị */
    settingsHeaderShopSelect: string
    messagingInboxDescription: string
    noWorkspaceInboxCta: string
    goToInbox: string
    /** Nút quay lại danh sách hội thoại (inbox shop, mobile) */
    inboxMobileBackAria: string
    /** Link tới /dashboard/api-integration */
    apiIntegrationGuideLink: string
    apiIntegrationGuideShort: string
    /** Link tới /dashboard/messaging/partner-site-login */
    partnerSiteLoginGuideLink: string
    partnerSiteLoginGuideShort: string
    /** /dashboard/messaging/settings — thẻ dẫn sang trang tích hợp API (nhúng/keys không còn trên trang này) */
    messagingSettingsApiHubCardTitle: string
    messagingSettingsApiHubCardBody: string
    /** Hướng dẫn tạo workspace shop chăm sóc khách (đa ngôn ngữ) */
    customerCareShopSetupGuideTitle: string
    customerCareShopSetupGuideBody: string
    /** Sidebar trang /dashboard/messaging/settings */
    settingsSidebarTitle: string
    /** Nút X / lớp phủ đóng drawer quản trị (mobile) */
    settingsCloseSidebar: string
    /** Nhóm link vận hành (Marketing, Đơn hàng) trên sidebar Quản trị */
    settingsNavOperationsTitle: string
    settingsNavOperationsDesc: string
    /** Nhóm quản trị website trên sidebar Quản trị */
    settingsNavWebsiteTitle: string
    settingsNavShopTitle: string
    settingsNavSalesTitle: string
    settingsNavWorkspace: string
    settingsNavGoLive: string
    settingsNavGoLiveDesc: string
    settingsNavIsolation: string
    settingsNavIsolationDesc: string
    /** Chú giải màu trường: nội bộ / cấp ra / nhận vào */
    settingsDataRoleLegendTitle: string
    settingsDataRoleLegendInternal: string
    settingsDataRoleLegendIssued: string
    settingsDataRoleLegendInbound: string
    settingsDataRoleBadgeInternal: string
    settingsDataRoleBadgeIssued: string
    settingsDataRoleBadgeInbound: string
    settingsNavBrandDesc: string
    settingsNavWebsiteEditor: string
    settingsNavConnectTitle: string
    settingsNavCustomersTitle: string
    settingsNavAiGroupTitle: string
    settingsNavPaymentDesc: string
    /** Nút mở website công khai (trang Quản trị) */
    settingsOpenWebsiteButton: string
    settingsManageWebsiteButton: string
    settingsCreateWebsiteButton: string
    settingsNavPayment: string
    sepayHmacLabel: string
    sepayHmacHint: string
    sepayHmacPlaceholder: string
    sepayHmacConfiguredBadge: string
    sepayHmacSavedHint: string
    sepayHmacKeepHint: string
    settingsNavShipping: string
    settingsNavShippingDesc: string
    settingsNavShippingFeeTitle: string
    settingsShippingOpenFromPayment: string
    settingsNavShippingSaveFee: string
    settingsNavEmsOps: string
    settingsNavEmsOpsDesc: string
    settingsNavAffiliate: string
    settingsNavLoyalty: string
    settingsNavLoyaltyDesc: string
    settingsNavPromotions: string
    settingsNavPromotionsDesc: string
    settingsNavAnalyticsMeta: string
    settingsNavAnalyticsMetaDesc: string
    settingsNavAnalyticsGoogleMerchant: string
    settingsNavAnalyticsGoogleMerchantDesc: string
    settingsNavAnalyticsTiktokCatalog: string
    settingsNavAnalyticsTiktokCatalogDesc: string
    settingsNavAnalyticsAds: string
    settingsNavAnalyticsAdsDesc: string
    settingsNavSheets: string
    settingsNavSheetsDesc: string
    settingsNavAiUsage: string
    settingsNavAiUsageDesc: string
    settingsNavInventoryDesc: string
    settingsNavInventoryGroupTitle: string
    settingsNavInventoryCatalog: string
    settingsNavInventoryStudio: string
    settingsNavInventoryStudioDesc: string
    settingsNavListingFacetCache: string
    settingsNavListingFacetCacheDesc: string
    settingsNavSearchCache: string
    settingsNavSearchCacheDesc: string
    settingsNavCustomDomain: string
    customDomainSectionTitle: string
    customDomainSectionDesc: string
    customDomainGuideTitle: string
    customDomainGuideBody: string
    customDomainStep1: string
    customDomainStep2: string
    customDomainStep3: string
    customDomainStep4: string
    customDomainHostnameLabel: string
    customDomainHostnamePlaceholder: string
    customDomainUseForChat: string
    customDomainUseForSite: string
    customDomainCnameTitle: string
    customDomainCnameHint: string
    customDomainApexTitle: string
    customDomainApexHint: string
    customDomainCopyApexIp: string
    customDomainSslTitle: string
    customDomainSslHint: string
    customDomainSaveButton: string
    customDomainVerifyButton: string
    customDomainRemoveButton: string
    customDomainCopyTarget: string
    customDomainCopyFailed: string
    customDomainStatusPending: string
    customDomainStatusDnsOk: string
    customDomainStatusSslActive: string
    customDomainStatusError: string
    customDomainPreviewTitle: string
    customDomainPreviewChat: string
    customDomainPreviewSite: string
    customDomainPreviewPendingTitle: string
    customDomainPreviewPendingHint: string
    customDomainInvalidHostname: string
    customDomainHostnameTaken: string
    customDomainSaveFailed: string
    customDomainSavedOk: string
    customDomainRemovedOk: string
    shopSsoSectionTitle: string
    shopSsoSectionDesc: string
    shopSsoLoginOriginLabel: string
    shopSsoLoginOriginPlaceholder: string
    shopSsoLoginPathLabel: string
    shopSsoLoginPathPlaceholder: string
    shopSsoSaveButton: string
    shopSsoSavedOk: string
    shopSsoInvalidOrigin: string
    customDomainVerifyOk: string
    customDomainVerifyDnsFail: string
    customDomainVerifySslPending: string
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
    /** W1.7 */
    refundSectionTitle: string
    refundAmountLabel: string
    refundNoteLabel: string
    btnMarkRefunded: string
    toastRefundUpdated: string
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
    /** Tiêu đề cột tư vấn rút gọn trên bảng desktop */
    tableColConsultedShort: string
    tableColCustomer: string
    tableColSubtotal: string
    /** Theo cấu hình đơn (khoản cọc / thanh toán ngay) */
    tableColDepositRequired: string
    /** Đã ghi nhận thanh toán */
    tableColPaidAmount: string
    /** max(0, tổng tiền hàng − đã thanh toán) */
    tableColDueOnDelivery: string
    /** Tiêu đề cột còn thu rút gọn trên bảng desktop */
    tableColDueOnDeliveryShort: string
    /** Thanh cuộn ngang phía trên bảng đơn */
    tableHScrollAria: string
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
    kpiTodayRevenue: string
    kpiWaitingDeposit: string
    kpiDepositedOrders: string
    kpiDepositedRevenue: string
    kpiDepositCollected: string
    kpiShippingNow: string
    depositPercentStatsTitle: string
    depositPercentStatsHint: string
    depositPercentColShare: string
    revenueReportTitle: string
    revenueReportDesc: string
    revenueModeDay: string
    revenueModeWeek: string
    revenueModeMonth: string
    revenueModeYear: string
    revenueModeRange: string
    revenuePickDay: string
    revenueToday: string
    revenueThisWeek: string
    revenueLastWeek: string
    revenueThisMonth: string
    revenueLastMonth: string
    revenuePickMonth: string
    revenueViewMonth: string
    revenueYear: string
    revenueViewYear: string
    revenueViewRange: string
    revenuePeriod: string
    revenueAmount: string
    revenueOrderCount: string
    revenueCancelledReturned: string
    revenueLoading: string
    revenuePickPeriod: string
    revenueNeedDay: string
    revenueNeedWeek: string
    revenueNeedMonth: string
    revenueNeedYear: string
    revenueNeedRange: string
    revenueInvalidMonth: string
    revenueInvalidYear: string
    revenueLoadError: string
    tabReturned: string
    tableColDeposit: string
    tableColPayment: string
    depositNeed: string
    depositPaid: string
    depositNotRequired: string
    pageSize25: string
    pageSize50: string
    pageSize100: string
    pageSizeAria: string
    paginationSummary: string
    paginationSearchHint: string
    paginationFirst: string
    paginationPrev: string
    paginationNext: string
    paginationLast: string
    loadingOrders: string
    filterPayFailed: string
    confirmDepositTitle: string
    confirmDepositBody: string
    confirmDepositNoTxn: string
    confirmDepositManualHint: string
    confirmDepositReceivedLabel: string
    confirmDepositReceivedHint: string
    confirmDepositRemainingPreview: string
    confirmDepositRemainingFormula: string
    confirmDepositAmountRequired: string
    confirmDepositNoteLabel: string
    confirmDepositNotePlaceholder: string
    btnRejectDeposit: string
    btnConfirmDepositReceived: string
    btnCancelModal: string
    btnMarkShipping: string
    btnComplete: string
    btnApproveReturn: string
    btnRefundDeposit: string
    btnClose: string
    noAddress: string
    customerCodeLabel: string
    internalIdLabel: string
    paymentWhenReceive: string
    colQty: string
    colUnitPrice: string
    colLineTotal: string
    skuLabel: string
    modalImageLink: string
    modalChinaLink: string
    modalShopLink: string
    modalNoShopSlug: string
    modalOpenVariantImage: string
    timelineHeading: string
    timelineEmpty: string
    filterFulfillmentAll: string
    filterFulfillmentVietnam: string
    filterFulfillmentChina: string
    filterFulfillmentChinaNoDeposit: string
    filterFulfillmentNeedsReview: string
    badgeVietnam: string
    badgeChina: string
    badgeNeedsReview: string
    badgeSla4h: string
    badgeSla24h: string
    badgeDepositException: string
    siblingOrdersLabel: string
    btnClearCustoms: string
    btnStartVnPacking: string
    btnMarkOutForConfirm: string
    shipmentTrackingLabel: string
    shipmentProviderLabel: string
    emsLatestLabel: string
    shipmentWaitingLabel: string
    shipmentActorSystem: string
    shipmentActorSeller: string
    shipmentActorCarrier: string
    shipmentActorBuyer: string
    shipmentCarrierMeta: string
    shipmentStepConfirmed: string
    shipmentStepChinaPreparing: string
    shipmentStepChinaWarehouse: string
    shipmentStepInternational: string
    shipmentStepCustoms: string
    shipmentStepDomestic: string
    shipmentStepVietnamPicking: string
    shipmentStepVietnamPacked: string
    shipmentStepAwaitingBuyer: string
  }
  /** /dashboard/messaging/analytics — S0.8 dashboard doanh thu/conversion/UTM */
  partnerMessagingAnalytics: {
    pageTitle: string
    pageDescription: string
    allWorkspaces: string
    dateFrom: string
    dateTo: string
    applyFilter: string
    statRevenue: string
    statRevenueHint: string
    statOrders: string
    statOrdersHint: string
    statAvgOrderValue: string
    statVisitors: string
    statVisitorsHint: string
    statConversionRate: string
    revenueByDayTitle: string
    revenueByUtmTitle: string
    utmSourceColumn: string
    utmCampaignColumn: string
    topProductsTitle: string
    productColumn: string
    quantityColumn: string
    revenueColumn: string
    ordersColumn: string
    noData: string
  }
  /** /dashboard/messaging/marketing — remarketing hàng loạt (widget chat) */
  partnerMessagingMarketing: {
    pageTitle: string
    pageDescription: string
    workspaceLabel: string
    safeModeNote: string
    stepAudience: string
    audienceHint: string
    segmentPresetLabel: string
    segmentChat90d: string
    recipientCount: string
    loadingCount: string
    refreshPreview: string
    stepContent: string
    contentHint: string
    offerPercentLabel: string
    templateLabel: string
    mergeFieldsLabel: string
    personalizationNote: string
    channelEmailLabel: string
    channelEmailHint: string
    emailIntroLabel: string
    emailIntroPlaceholder: string
    emailStatsLabel: string
    testOptOutTitle: string
    optOutCountLabel: string
    testEmailLabel: string
    testEmailPlaceholder: string
    sendTestButton: string
    testEmailSent: string
    testEmailInvalid: string
    testEmailNotCustomer: string
    smtpNotConfigured: string
    stepSend: string
    sendHint: string
    sendButton: string
    saveDraft: string
    queueSuccessTitle: string
    queueSuccessDescription: string
    noRecipients: string
    draftSaved: string
    cancelled: string
    campaignHistory: string
    campaignHistoryHint: string
    reload: string
    noCampaigns: string
    statsLine: string
    viewLog: string
    cancelCampaign: string
    deliveryLog: string
    colRecipient: string
    colStatus: string
    colReason: string
    viewAllRecipients: string
    recipientListTitle: string
    colName: string
    colEmail: string
    colLastChat: string
    sendLimitsThisMonth: string
    exportCustomerEmailsExcel: string
    exportCustomerEmailsCsv: string
    exportCustomerEmailsHint: string
    exportCustomerEmailsEmpty: string
    exportCustomerEmailsDone: string
    exportCustomerEmailsLoading: string
    noWorkspace: string
  }
  /** /dashboard/messaging/notifications — tạo thông báo + email giống 188 */
  partnerMessagingNotifications: {
    pageTitle: string
    pageDescription: string
    workspaceLabel: string
    composeTitle: string
    composeHint: string
    titleLabel: string
    bodyLabel: string
    scheduleLabel: string
    expireHint: string
    sendEmailLabel: string
    pushHint: string
    smtpMissing: string
    audienceCount: string
    sendButton: string
    sending: string
    composeSuccess: string
    importTitle: string
    importHint: string
    colPhone: string
    colTitle: string
    colContent: string
    colTime: string
    colEmailOptional: string
    downloadTemplate: string
    importButton: string
    importing: string
    importSuccess: string
    resultTitle: string
    resultTotal: string
    resultSuccess: string
    resultError: string
    resultEmail: string
    historyTitle: string
    historyEmpty: string
    historyWhen: string
    historySource: string
    sourceCompose: string
    sourceImport: string
    noWorkspace: string
    errorGeneric: string
    errorMissingFile: string
    errorInvalidFile: string
    errorReadFile: string
    errorMissingColumns: string
    errorEmptySheet: string
    errorNoRecipients: string
    errorInvalidSchedule: string
  }
  /** /dashboard/messaging/settings — Quản lý gửi email (warmup + newsletter) */
  partnerMessagingEmail: {
    pageTitle: string
    pageDescription: string
    tabManage: string
    tabList: string
    warmupTitle: string
    warmupHint: string
    warmupEnabled: string
    startLimit: string
    dailyIncrement: string
    maxLimit: string
    maxLimitHint: string
    saveSettings: string
    saving: string
    saved: string
    smtpMissing: string
    statsTitle: string
    warmupDay: string
    dailyLimit: string
    sentToday: string
    birthdayToday: string
    marketingToday: string
    remainingToday: string
    unlimited: string
    birthdayAllTime: string
    activeSubscribers: string
    cronTitle: string
    birthdayCron: string
    runBirthdayNow: string
    runningBirthday: string
    birthdayRunOk: string
    channelsTitle: string
    cartEmail: string
    comebackEmail: string
    newsletterWelcome: string
    testTitle: string
    testEmail: string
    testKind: string
    testBirthday: string
    testCart: string
    testComeback: string
    testNewsletter: string
    testBroadcast: string
    sendTest: string
    testOk: string
    logTitle: string
    logEmpty: string
    logWhen: string
    logKind: string
    logTo: string
    logStatus: string
    logSubject: string
    subscribersTitle: string
    searchPlaceholder: string
    filterAll: string
    filterActive: string
    filterInactive: string
    importTitle: string
    importHint: string
    importTextPlaceholder: string
    importFile: string
    importButton: string
    importing: string
    importResult: string
    exportCsv: string
    composeTitle: string
    composeHint: string
    subjectLabel: string
    bodyLabel: string
    sendBroadcast: string
    confirmBroadcast: string
    broadcasting: string
    broadcastOk: string
    noWorkspace: string
    errorGeneric: string
    errorSmtp: string
    errorWarmup: string
    errorInvalidEmail: string
    statusSent: string
    statusFailed: string
    statusSkipped: string
    colEmail: string
    colName: string
    colSource: string
    colStatus: string
    colWhen: string
    unsubscribe: string
    active: string
    inactive: string
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
    /** {from} {to} ngày YYYY-MM-DD ICT */
    usagePeriodScopeCalendar: string
    usagePresetToday: string
    usagePresetYesterday: string
    usagePresetThisWeek: string
    usagePresetLastWeek: string
    usagePresetThisMonth: string
    usagePresetLastMonth: string
    usagePresetYear: string
    usagePresetAll: string
    usageCreditHeroKicker: string
    usageCreditHeroHint: string
    usageApiHeroKicker: string
    usageApiHeroHint: string
    usageApiEmbedImageLine: string
    usageApiEmbedTextLine: string
    usageApiModelTableNote: string
    usageColYear: string
    usageCreditTypeFromImage: string
    usageCreditTypeSlideVerify: string
    usageCreditTypeLessonSlides: string
    usageCreditTypeInfographic: string
    usageCreditTypeMonthlyCurriculum: string
    usageCreditTypeEnglishLiveStart: string
    usageCreditTypeEnglishLiveUnlock: string
    usageCreditTypeEnglishPreset: string
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
    /** Trung bình mỗi lần gọi */
    tokenUsageKpiAvg: string
    /** Cột % chi phí */
    tokenUsageColShare: string
    /** {detailAmount} {periodAmount} khi bảng chi tiết bị cắt */
    tokenUsageDetailMismatchNote: string
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
    /** Tab chi tiết thống kê token shop */
    usageSliceOverview: string
    usageSliceTime: string
    usageSliceCalls: string
    usageSliceMedia: string
    usageDetailApiTitle: string
    usageDetailApiIntro: string
    usageDetailColTime: string
    usageDetailColUsageKind: string
    usageTokenKindInbox: string
    usageTokenKindMaterialInfer: string
    usageTokenKindLandingImage: string
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
    usageLogoCreditCappedNote: string
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
    afterSalesReturnAddressLabel: string
    afterSalesReturnAddressHint: string
    afterSalesReturnAddressPlaceholder: string
    shippingLookupTitle: string
    shippingLookupHint: string
    shippingLookupUrlLabel: string
    shippingLookupUrlPlaceholder: string
    shippingLookupKeyLabel: string
    shippingLookupKeyHint: string
    shippingLookupKeyPlaceholder: string
    shippingLookupKeyConfigured: string
    shippingLookupKeyMissing: string
    shippingLookupTestButton: string
    shippingLookupClearKey: string
    shippingLookupGuideLink: string
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
    inventoryListCount: string
    inventoryListScrollHint: string
    inventoryColId: string
    inventoryColWeb: string
    inventoryColMainImage: string
    inventoryColGallery: string
    inventoryColDetailImages: string
    inventoryColSlug: string
    inventoryColBrand: string
    inventoryColQty: string
    inventoryColStatus: string
    inventoryColSourceStock: string
    inventoryColImageI18n: string
    inventoryColActions: string
    inventoryDeleteSelected: string
    inventoryDeleteSelectedBusy: string
    inventoryDeleteSelectedConfirm: string
    inventoryDeleteSelectedOk: string
    inventoryDeleteSelectedFailed: string
    inventoryStatusShown: string
    inventoryStatusHidden: string
    inventoryViewWeb: string
    inventoryViewDetail: string
    inventoryDetailTitle: string
    inventoryDetailBack: string
    inventoryDetailLoading: string
    inventoryDetailFailed: string
    inventoryDetailEmbeddingOmitted: string
    inventoryEmptyCell: string
    inventoryClearanceBadge: string
    /** Link /messaging/p/{slug}?ctx_* — mở chat tư vấn kèm ảnh SP */
    inventoryGuestConsultLink: string
    inventoryGuestConsultLinkHint: string
    inventoryGuestConsultLinkNeedSave: string
    inventoryGuestConsultLinkCopied: string
    inventoryConsultNote: string
    inventoryConsultNoteHint: string
    inventoryDescHint: string
    inventoryStockHint: string
    inventoryMaterialNote: string
    inventoryMaterialNoteHint: string
    inventoryMaterialDetailImageUrl: string
    inventoryMaterialDetailImageUrlHint: string
    inventoryRealUseImageUrl: string
    inventoryRealUseImageUrlHint: string
    inventoryRealUseImageUrl2: string
    inventoryRealUseImageUrl2Hint: string
    inventoryRemarketingId: string
    inventoryRemarketingIdHint: string
    inventoryFieldsGuide: string
    /** Nút/link tới /dashboard/api-integration — Open Catalog */
    inventoryOpenApiLink: string
    inventoryOpenApiHint: string
    listingImportTitle: string
    listingImportIntro: string
    listingImportCookieTitle: string
    listingImportCookieHint: string
    listingImportCookiePaste: string
    listingImportCookieSave: string
    listingImportCookieClear: string
    listingImportPandamallUser: string
    listingImportPandamallPass: string
    listingImportPandamallPassKeep: string
    listingImportDraftEditHint: string
    /** Nút trên đợt cào: mở nháp done để đăng lên kho shop */
    listingImportProductsButton: string
    listingImportProductsButtonBusy: string
    listingImportProductsButtonTitle: string
    /** {n} = số nháp đang chọn */
    listingImportProductsSubmit: string
    /** {done} {total} tiến trình import */
    listingImportProductsSubmitting: string
    /** Nút teal: chọn file .xlsx catalog 41 cột — cùng API kho, overwrite=false */
    listingImportExcelButton: string
    listingImportExcelButtonBusy: string
    listingImportExcelButtonTitle: string
    listingImportExcelUploading: string
    /** {mb} kích thước file */
    listingImportExcelUploadingLarge: string
    /** {pct} {loaded} {total} MB */
    listingImportExcelUploadPct: string
    listingImportExcelProcessing: string
    listingImportExcelCancel: string
    listingImportExcelCancelling: string
    listingImportExcelHideTrack: string
    listingImportExcelClose: string
    /** {inserted} {updated} {deleted} — {deleted} có thể rỗng */
    listingImportExcelSuccess: string
    /** {n} số dòng xóa — gắn vào {deleted} */
    listingImportExcelSuccessDeleted: string
    listingImportExcelFailedTitle: string
    listingImportExcelFailedToast: string
    listingImportExcelOkTitle: string
    listingImportExcelDoneTitle: string
    /** {n} số cảnh báo */
    listingImportExcelWarnings: string
    listingImportExcelCancelTitle: string
    listingImportExcelCancelBody: string
    listingImportExcelCancelToast: string
    sourceStockTitle: string
    sourceStockIntro: string
    sourceStockApiError: string
    sourceStockClose: string
    sourceStockDomainLabel: string
    sourceStockDomainCssbuy: string
    sourceStockDomainVipomall: string
    sourceStockTestHeading: string
    sourceStockTestHint: string
    sourceStockTestRunning: string
    sourceStockTestRun: string
    sourceStockTestPlaceholder: string
    sourceStockEligible: string
    sourceStockIneligible: string
    sourceStockMerged: string
    sourceStockWorkerHeading: string
    sourceStockOn: string
    sourceStockOff: string
    sourceStockPauseFlag: string
    sourceStockDaemon: string
    sourceStockRunning: string
    sourceStockIdle: string
    sourceStockWorkerLoading: string
    sourceStockWriting: string
    sourceStockPause: string
    sourceStockResume: string
    sourceStockPausedOk: string
    sourceStockResumedOk: string
    sourceStockChecking: string
    sourceStockCheckingHint: string
    sourceStockCheckingEmpty: string
    sourceStockLastDone: string
    sourceStockLastDoneHint: string
    sourceStockLastDoneEmpty: string
    sourceStockUpcoming: string
    sourceStockUpcomingHint: string
    sourceStockUpcomingEmpty: string
    sourceStockRefreshingQueue: string
    sourceStockRefreshQueue: string
    sourceStockRefreshingReport: string
    sourceStockRefreshReport: string
    sourceStockResetPdp: string
    sourceStockStatTotal: string
    sourceStockStatEligible: string
    sourceStockStatTraffic: string
    sourceStockStatCooldown: string
    sourceStockStatNever: string
    sourceStockStatRescan: string
    sourceStockStatNoPdp: string
    sourceStockTtlHint: string
    sourceStockReportHeading: string
    sourceStockCountTtl: string
    sourceStockCountChecked: string
    sourceStockCountOos: string
    sourceStockCountIn: string
    sourceStockCountQtyPos: string
    sourceStockCountQtyZero: string
    sourceStockOosTable: string
    sourceStockSelectAll: string
    sourceStockClearSel: string
    sourceStockDeleteDb: string
    sourceStockClearFlag: string
    sourceStockRecheck: string
    sourceStockDeleteAllWindow: string
    sourceStockClearAllWindow: string
    sourceStockRecheckAllWindow: string
    sourceStockColName: string
    sourceStockColQty: string
    sourceStockOosEmpty: string
    sourceStockInTable: string
    sourceStockInEmpty: string
    sourceStockTtlTable: string
    sourceStockTtlEmpty: string
    sourceStockResetTitle: string
    sourceStockResetBody: string
    sourceStockResetType: string
    sourceStockCancel: string
    sourceStockResetting: string
    sourceStockResetConfirm: string
    sourceStockResetOk: string
    sourceStockDeleteTitle: string
    sourceStockDeleteBody: string
    sourceStockDeleting: string
    sourceStockDeleteConfirm: string
    sourceStockDeletedOk: string
    sourceStockClearedOk: string
    sourceStockRecheckOk: string
    sourceStockPlatformLabel: string
    sourceStockLinkLabel: string
    sourceStockStartedLabel: string
    sourceStockStatusLabel: string
    sourceStockNormalizedLabel: string
    sourceStockJustNow: string
    sourceStockMinutesAgo: string
    sourceStockHoursAgo: string
    sourceStockDaysAgo: string
    imageLocTitle: string
    imageLocIntro: string
    imageLocRefresh: string
    imageLocAiOffBanner: string
    imageLocBulkHint: string
    imageLocModeLabel: string
    imageLocModeLocal: string
    imageLocModeLocalHint: string
    imageLocModeGemini: string
    imageLocModeGeminiHint: string
    imageLocModeOpenai: string
    imageLocModeOpenaiHint: string
    imageLocNeedSelect: string
    imageLocAiOff: string
    imageLocCustomModel: string
    imageLocGeminiModel: string
    imageLocGeminiModelHint: string
    imageLocGeminiSize: string
    imageLocGeminiSizeHint: string
    imageLocEnvDefault: string
    imageLocOpenaiModel: string
    imageLocOpenaiOut: string
    imageLocLanguage: string
    imageLocLangVi: string
    imageLocLangEn: string
    imageLocLangTh: string
    imageLocLangId: string
    imageLocSelectedOnly: string
    imageLocForce: string
    imageLocStatPending: string
    imageLocStatDone: string
    imageLocStatError: string
    imageLocStatSkip: string
    imageLocStatRun: string
    imageLocOffPeak: string
    imageLocOffPeakHint: string
    imageLocLogoLabel: string
    imageLocLogoHint: string
    imageLocLogoUpload: string
    imageLocLogoSave: string
    imageLocLogoSaved: string
    imageLocTestProduct: string
    imageLocAllPending: string
    imageLocErrorDetails: string
    imageLocPeakWaitTitle: string
    imageLocPeakNowTitle: string
    imageLocStart: string
    imageLocStarting: string
    imageLocStartMore: string
    imageLocQueued: string
    imageLocJobsHeading: string
    imageLocJobsEmpty: string
    imageLocJobsLoading: string
    imageLocCancelGraceful: string
    imageLocCancelForce: string
    imageLocDelete: string
    imageLocDeleteTerminal: string
    imageLocSelectRequired: string
    imageLocSelectProduct: string
    inventoryExternalSyncTitle: string
    inventoryExternalSyncIntro: string
    inventoryExternalSyncReconcileHint: string
    inventoryExternalSyncListUrlLabel: string
    inventoryExternalSyncListUrlHint: string
    inventoryExternalSyncColNano: string
    inventoryExternalSyncColCustomer: string
    inventoryExternalSyncColSample: string
    inventoryExternalSyncColCustomerHint: string
    inventoryExternalSyncSampleHint: string
    inventoryExternalSyncVectorCol: string
    inventoryExternalSyncVectorImage: string
    inventoryExternalSyncVectorText: string
    inventoryExternalSyncVectorFootnote: string
    inventoryExternalSyncSave: string
    inventoryExternalSyncSaveRunning: string
    inventoryExternalSyncSaved: string
    inventoryExternalSyncLoadError: string
    inventoryExternalSyncPreset188: string
    inventoryExternalSyncRowRemarketing: string
    inventoryExternalSyncRowStockQty: string
    inventoryExternalSyncRowSlug: string
    inventoryExternalSyncRowIsActive: string
    inventoryExternalSyncRowImageConsult: string
    /** Màu sắc dạng JSON mảng — map tới trường API khách (vd colors) */
    inventoryExternalSyncRowColorsJson: string
    /** Đồng bộ GET từ kho khách — cron + nút tay */
    inventoryExternalSyncAutoLabel: string
    inventoryExternalSyncAutoHint: string
    inventoryExternalSyncIntervalLabel: string
    inventoryExternalSyncIntervalHint: string
    inventoryExternalSyncRemarketingSnapshotHint: string
    inventoryExternalSyncRunNow: string
    inventoryExternalSyncRunPending: string
    inventoryExternalSyncRunSuccess: string
    inventoryExternalSyncLastSuccess: string
    inventoryExternalSyncNeverSynced: string
    inventoryExternalSyncLastErrorLabel: string
    inventoryExternalSyncInitialPending: string
    inventoryExternalSyncInitialProgress: string
    inventoryExternalSyncErrNoPartnerId: string
    inventoryExternalSyncErrMissingListUrl: string
    inventoryExternalSyncErrInvalidListUrl: string
    inventoryExternalSyncErrNotJsonObject: string
    inventoryExternalSyncErrNoProductsArray: string
    inventoryExternalSyncErrFetchTimeout: string
    inventoryExternalSyncErrFetchFailed: string
    inventoryExternalSyncErrNoValidRows: string
    inventoryExternalSyncErrListInventoryFailed: string
    inventoryExternalSyncErrUpsertFailed: string
    /** Báo cáo sau mỗi lần đồng bộ GET kho khách (thông báo + email + push) */
    inventoryExternalCatalogSyncReportTitleOk: string
    inventoryExternalCatalogSyncReportTitleFail: string
    inventoryExternalCatalogSyncReportSourceManual: string
    inventoryExternalCatalogSyncReportSourceCron: string
    /**
     * {time} ISO · {source} · {shop} · {fetched}{mapped}{remarketing}{inserted}{updated}{deleted}{embedNote}{extraNote}
     */
    inventoryExternalCatalogSyncReportBodyOk: string
    /**
     * {time} · {source} · {shop} · {code} · {detail}
     */
    inventoryExternalCatalogSyncReportBodyFail: string
    inventoryExternalCatalogSyncReportEmbedDeferred: string
    inventoryExternalCatalogSyncReportEmbedSync: string
    inventoryExternalCatalogSyncReportExtraEmptyApi: string
    inventoryDownloadTemplate: string
    inventoryExportExcel: string
    inventoryImportExcel: string
    /** File mẫu / import khớp ~41 cột Excel 188 + file kho 12 cột cũ */
    inventoryExcel188Hint: string
    /** Tải lại 9 sản phẩm demo (túi/giày/quần áo) sau khi merchant đã xóa */
    inventoryReloadDemoProducts: string
    inventoryReloadDemoHint: string
    /** {count} = số sản phẩm vừa thêm */
    inventoryReloadDemoSuccess: string
    inventoryReloadDemoNone: string
    inventoryReloadDemoFailed: string
    /** PS.10 — Product Studio: nút mở wizard đăng sản phẩm thủ công/AI */
    productStudioOpenButton: string
    productStudioTitle: string
    productStudioManualTab: string
    productStudioAiTab: string
    productStudioFieldName: string
    productStudioFieldPrice: string
    productStudioFieldMaterial: string
    productStudioFieldStyle: string
    productStudioFieldGender: string
    productStudioFieldProductType: string
    productStudioFieldSizes: string
    productStudioFieldNoSize: string
    productStudioFieldColors: string
    productStudioAddColor: string
    productStudioColorName: string
    productStudioColorImage: string
    productStudioFieldMainImage: string
    productStudioFieldGallery: string
    productStudioFieldDescription: string
    productStudioFieldNotes: string
    productStudioFieldStock: string
    productStudioUploadButton: string
    productStudioUploading: string
    productStudioSubmit: string
    productStudioSubmitting: string
    productStudioSuccess: string
    productStudioCancel: string
    productStudioRemove: string
    productStudioRequiredName: string
    productStudioRequiredImage: string
    productStudioRequiredPrice: string
    productStudioAiComingSoon: string
    productStudioRefImagesLabel: string
    productStudioColorNamesLabel: string
    productStudioModelPresenceLabel: string
    productStudioShotStyleLabel: string
    productStudioAspectRatioLabel: string
    productStudioImageModelLabel: string
    productStudioImageModelPro: string
    productStudioImageModelFlash: string
    productStudioImageModelFlash3: string
    productStudioCreditPerImage: string
    productStudioMaterialCreditNote: string
    productStudioGalleryCountLabel: string
    productStudioDetailCountLabel: string
    productStudioStartStudio: string
    productStudioApprove: string
    productStudioRegenerate: string
    productStudioStudioDone: string
    productStudioSuggestName: string
    productStudioSuggestedName: string
    productStudioStepAttrs: string
    productStudioStepStudioSettings: string
    productStudioStepStudio: string
    productStudioStepImages: string
    productStudioStepPublish: string
    productStudioManualModeHint: string
    productStudioColorRowHint: string
    productStudioRequiredColor: string
    productStudioColorNameMissing: string
    productStudioRequiredGallery: string
    productStudioStartPublish: string
    productStudioNamePlaceholder: string
    productStudioColorNamePlaceholder: string
    productStudioImageEmpty: string
    productStudioFieldGalleryMin: string
    productStudioManualAiDescHint: string
    productStudioNext: string
    productStudioBack: string
    productStudioRequiredMaterial: string
    productStudioRequiredSizes: string
    productStudioRequiredModelFields: string
    productStudioAiModeHint: string
    productStudioTypeApparel: string
    productStudioTypeShoes: string
    productStudioTypeAccessory: string
    productStudioTypeHousehold: string
    productStudioTypeFood: string
    productStudioTypeOther: string
    productStudioGenderFemale: string
    productStudioGenderMale: string
    productStudioGenderUnisex: string
    productStudioShotStudio: string
    productStudioShotLifestyle: string
    productStudioShotOutdoor: string
    productStudioModelNone: string
    productStudioModelYes: string
    productStudioModelGender: string
    productStudioModelAge: string
    productStudioModelEthnicity: string
    productStudioModelAgeBaby: string
    productStudioModelAgeChild: string
    productStudioModelAgeTeen: string
    productStudioModelAgeAdult: string
    productStudioModelAgeMiddle: string
    productStudioModelEthnicityAsian: string
    productStudioModelEthnicityWestern: string
    productStudioNonWearableHint: string
    productStudioTabColor: string
    productStudioTabGallery: string
    productStudioTabMaterial: string
    productStudioTabDetail: string
    productStudioTabDetailOptional: string
    productStudioColorFirstHint: string
    productStudioColorNextHint: string
    productStudioGalleryHint: string
    productStudioDetailHint: string
    productStudioMaterialHint: string
    productStudioSampleImage: string
    productStudioSampleImageNew: string
    productStudioPickRefs: string
    productStudioGenerate: string
    productStudioApproveContinue: string
    productStudioFaceLockLabel: string
    productStudioProgressTitle: string
    productStudioProgressColor: string
    productStudioProgressGallery: string
    productStudioProgressMaterial: string
    productStudioProgressDetail: string
    productStudioSelectGalleryStep: string
    productStudioSelectDetailStep: string
    productStudioConfirmSelection: string
    productStudioSkipDetail: string
    productStudioResumeTitle: string
    productStudioResumeContinue: string
    productStudioResumeDelete: string
    productStudioNoUploadHere: string
    productStudioSizeChipPlaceholder: string
    productStudioNeedAttach: string
    productStudioNeedRefs: string
    productStudioSeoName: string
    productStudioShotLocked: string
    productStudioSwitchTabHint: string
    productStudioMinPublishHint: string
    productStudioPromptColorPlaceholder: string
    productStudioGalleryMinHint: string
    productStudioDetailOptionalHint: string
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
    inventoryEmbeddingErrorsTitle: string
    inventoryEmbeddingErrorsSummary: string
    inventoryEmbeddingErrorsEmpty: string
    inventoryEmbeddingErrorsColSku: string
    inventoryEmbeddingErrorsColName: string
    inventoryEmbeddingErrorsColImageError: string
    inventoryEmbeddingErrorsColTextError: string
    inventoryEmbeddingErrorsColUpdatedAt: string
    inventoryEmbeddingErrorsLoadMore: string
    inventoryEmbeddingErrorsExportCsv: string
    inventoryEmbeddingErrorsExporting: string
    inventoryEmbeddingErrorsExportDone: string
    inventoryEmbeddingErrorsExportEmpty: string
    inventoryEmbeddingErrorsLoadFailed: string
    inventoryEmbeddingErrorsCsvHeaderSku: string
    inventoryEmbeddingErrorsCsvHeaderName: string
    inventoryEmbeddingErrorsCsvHeaderId: string
    inventoryEmbeddingErrorsCsvHeaderImageUrl: string
    inventoryEmbeddingErrorsCsvHeaderImageError: string
    inventoryEmbeddingErrorsCsvHeaderImageErrorAt: string
    inventoryEmbeddingErrorsCsvHeaderTextError: string
    inventoryEmbeddingErrorsCsvHeaderTextErrorAt: string
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
    guestPurchaseFlowExternalCart: string
    guestExternalCartUrlTemplateLabel: string
    guestExternalCartUrlTemplateHint: string
    guestExternalCartUrlTemplatePlaceholder: string
    guestExternalCartUrlTemplateSaveHint: string
    guestPurchaseFlowSaasLinkedHint: string
    guestPurchaseFlowDualHint: string
    guestPurchaseFlowNeedWebsite: string
    guestPurchaseFlowSaasPreviewLabel: string
    shopCheckoutLoginLabel: string
    shopCheckoutLoginHint: string
    shopCheckoutLoginRequiredOn: string
    shopCheckoutLoginRequiredOff: string
    usagePanelTitle: string
    usagePanelSubtitle: string
    birthdayPromoSettingsTitle: string
    birthdayPromoSettingsDesc: string
    birthdayPromoSettingsHint: string
    birthdayDiscountLabel: string
    birthdayDaysMaxLabel: string
    birthdayDaysMinLabel: string
    birthdayEnableAria: string
    birthdayPromoAutoSaveHint: string
    birthdayPromoSaveFailed: string
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
    /** Trang chat hosted trên nanoai.vn — về trang chủ. */
    backHome: string
    backHomeAria: string
    /** Mở danh sách công cụ NanoAI khác (sidebar / sheet mobile). */
    exploreToolsButton: string
    exploreToolsTitle: string
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
    guestAuthCheckEmailSpamTrashHint: string
    guestAuthOpenGmail: string
    guestAuthOpenMailbox: string
    guestAuthOtpInvalid: string
    guestAuthAccountLocked: string
    guestAuthRateLimited: string
    /** Checkbox «tin cậy thiết bị» (OTP guest). */
    guestAuthRememberDeviceHint: string
    /** Đang chờ verify OTP (dialog / inline). */
    guestAuthVerifyingProgress: string
    /** Hiển thị khi shop/AI đang chuẩn bị trả lời sau tin của khách. `{shop}` = tên shop. */
    shopTypingHint: string
    /** Khi mở link tư vấn — chờ gửi tin (vector + lời mở đầu) hiển thị */
    consultLinkShopPreparingHint: string
    /** Shop AI — tin cố định + carousel mẫu khác (vector kho). VI dùng anh/chị khi chưa có giới tính; có giới tính → `enforceConfiguredGenderAddressing`. */
    similarAlternativesTemplateMessage: string
    productSearchTemplateMessage: string
    photoAngleDetailTemplateMessage: string
    visionPickHint: string
    visionPickBusy: string
    visionPickError: string
    visionProductLink: string
    /** Thẻ SP sau khi đã bấm «tư vấn» — mở form đặt hàng */
    visionProductBuy: string
    /** Nút thêm giỏ trên thẻ SP / carousel (theo chế độ mua khách). */
    guestProductAddToCart: string
    /** Nút đặt hàng trong modal «muốn mua sản phẩm nào». */
    guestProductPlaceOrder: string
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
    /** Chế độ link giỏ web — đã mở tab */
    purchaseOpenCartUrlToast: string
    /** Chế độ web nhưng thiếu URL sản phẩm */
    purchaseMissingProductUrlToast: string
    /** Chế độ link giỏ nhưng thiếu SKU trên thẻ */
    purchaseMissingSkuToast: string
    /** Chế độ link giỏ nhưng shop chưa cấu hình mẫu URL */
    purchaseMissingCartTemplateToast: string
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
    /** Thanh nhập: gợi ý ưu đãi sinh nhật — `{percent}`. */
    birthdayPromoComposerHint: string
    /** Bubble shop (cục bộ): chúc SN — `{shopName}`, `{percent}`; dùng `\\n` xuống dòng. */
    birthdayPromoChatGreeting: string
    /** Toast khi vào chat có ưu đãi — `{percent}`. */
    birthdayPromoEnterToastTitle: string
    birthdayPromoEnterToastDescription: string
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
    /** Liên kết chân trang → /privacy */
    privacyPolicyLink: string
    /** Liên kết chân trang → /terms */
    termsOfServiceLink: string
    /** Liên kết chân trang → /data-deletion (Facebook: user data deletion URL) */
    dataDeletionLink: string
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
  /** Toast khi server action hoàn tất nhưng client không nhận được URL hoặc lỗi mạng */
  imageGenerationClient: {
    unexpectedNoUrl: string
    clientFault: string
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
    sectionHubPlans: string
    emptyHubPlans: string
    hubPlanSteps: string
    hubPlanContinue: string
    hubPlanCancel: string
    hubPlanStatusActive: string
    hubPlanStatusCompleted: string
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
    libraryHeading: string
    libraryHint: string
    uploadLabel: string
    sharedUploadNote: string
    seedCredit: string
    chooseMusic: string
    chooseAgain: string
    previewListen: string
    stopPreview: string
    confirmPick: string
    pickerTitle: string
  }
  /** Thiệp công khai / preview: khối lịch & giờ tiệc (save-the-date) */
  weddingCardCalendar: {
    sectionTitle: string
    introLine: string
    receptionLabel: string
    partyLabel: string
    /** Ô chờ khi chỉ có một mốc giờ được trích ra */
    timePlaceholderDash: string
    countdownTitle: string
    countdownDay: string
    countdownDays: string
    countdownHour: string
    countdownHours: string
    countdownMinute: string
    countdownMinutes: string
    countdownSecond: string
    countdownSeconds: string
    countdownPast: string
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
    downloadQr: string
  }
  /** /tao-thiep-moi-cuoi-ai — mô tả nội dung brief & auto-save */
  weddingCardAiBrief: {
    step2Description: string
    autoSavingLabel: string
    autoSavedLabel: string
    autoSaveFailedLabel: string
    dateFormatHint: string
    dateSelectedPrefix: string
    guestInviteVenueLabel: string
    guestInviteVenueHint: string
    effectsToggleLabel: string
    effectsToggleDesc: string
    loginGateLead: string
    loginGateHint: string
    loginGateCta: string
  }
  weddingCardAiImage: {
    customReferenceLabel: string
    customReferenceHint: string
    customReferenceChoose: string
    customReferenceRemove: string
    customReferenceUrlPlaceholder: string
    customReferenceEmpty: string
    chooseBackground: string
    chooseBackgroundAgain: string
    backgroundPickedOk: string
    backgroundPickedTitle: string
    backgroundSectionTitle: string
    backgroundSectionHint: string
    backgroundLibraryTitle: string
    backgroundLibraryHint: string
    backgroundLibraryEmpty: string
    createBackgroundAi: string
    createBackgroundModalTitle: string
    createBackgroundButton: string
    createBackgroundAgain: string
    pickOutsideBackground: string
    backgroundEmptyPreview: string
    downloadCreated: string
    back: string
  }
  weddingCardAiStyle: {
    sectionTitle: string
    sectionDescription: string
  }
  weddingCardAiCover: {
    sectionTitle: string
    sectionDescription: string
    tagNew: string
    tagHot: string
    previewLabel: string
    previewGuestPrefix: string
    previewOpenButton: string
    uploadLabel: string
    choosePhoto: string
    chooseFrame: string
    changePhoto: string
    coverPhotoZoomOut: string
    coverPhotoZoomIn: string
    uploadHint: string
    removeCustomCover: string
    aiCoverHint: string
    aiFrameButton: string
    aiFrameHint: string
    aiFramePromptPlaceholder: string
    aiFrameDone: string
    aiFrameDoneDetail: string
    aiFrameUsing: string
    aiFrameUseStock: string
    coverLibraryHint: string
    coverUploadDevice: string
    coverLibraryEmpty: string
    aiFrameLibraryHeading: string
    aiFrameLibraryHint: string
    aiFrameLibraryEmpty: string
    aiFrameLibraryApplied: string
    frameModeNone: string
    frameModePick: string
    frameModeAi: string
    photoOpenLabel: string
    frameOpenLabel: string
    photoOpenNone: string
    photoOpenRise: string
    photoOpenFade: string
    photoOpenZoom: string
    photoOpenAssemble: string
    frameOpenNone: string
    frameOpenFade: string
    frameOpenBloom: string
    frameOpenAssemble: string
    frameShapeLabel: string
    frameShapeCircle: string
    frameShapeEllipse: string
    frameShapeHeart: string
    frameShapeArch: string
    frameShapeDiamond: string
    frameShapeRounded: string
  }
  weddingCardPublic: {
    invitation: string
    openInvitation: string
    openEnvelope: string
    navInvitation: string
    navEvent: string
    navStory: string
    navRsvp: string
    cordiallyInvites: string
    guestInviteVenueGroom: string
    guestInviteVenueBride: string
    guestInviteVenueNone: string
    guestInviteViewMap: string
    weddingInvitation: string
    dateFallback: string
    timeFallback: string
    defaultInvitation: string
    defaultCoupleIntro: string
    familiesIntro: string
    groomFamily: string
    brideFamily: string
    groomRole: string
    brideRole: string
    letterViewAsk: string
    letterViewBoth: string
    hometownLabel: string
    coupleIntroTitle: string
    timelineTitle: string
    defaultTimeline: string
    dressCodeTitle: string
    musicTitle: string
    openMaps: string
    storyTitle: string
    albumTitle: string
    albumHint: string
    albumAlt: string
    rsvpTitle: string
    guestNameLabel: string
    guestNamePlaceholder: string
    attendYes: string
    attendNo: string
    coverAttendYes: string
    coverAttendNo: string
    coverRsvpSavedYes: string
    coverRsvpSavedNo: string
    guestCountLabel: string
    rsvpAdultLabel: string
    rsvpChildLabel: string
    coverPartyConfirm: string
    coverPartyClose: string
    coverReminderOptIn: string
    wishLabel: string
    wishPlaceholder: string
    wishPresetOpen: string
    wishPresetList: string
    submitResponse: string
    submitErrorTitle: string
    submitSuccessTitle: string
    submitSuccessDesc: string
    wishesTitle: string
    noWishes: string
    noWishesPersonal: string
    thankYouTitle: string
    defaultThankYou: string
    closeGallery: string
    coverPhotoAlt: string
    contactLabel: string
    addToGoogleCalendar: string
    downloadCalendarFile: string
    shareZalo: string
    calendarEventTitle: string
    calendarEventDescription: string
    reminderTitle: string
    reminderHint: string
    reminderEmailLabel: string
    reminderEmailPlaceholder: string
    reminderDaysLabel: string
    reminderDaysPlaceholder: string
    reminderDaysHint: string
    reminderSubmit: string
    reminderSuccessTitle: string
    reminderSuccessDesc: string
    reminderErrorTitle: string
    reminderErrorInvalidEmail: string
    reminderErrorInvalidDays: string
    reminderErrorNoDate: string
    reminderErrorPassed: string
    reminderErrorDaysTooLarge: string
    reminderErrorGeneric: string
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

export const VI_DICTIONARY: Dictionary = {
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
    personalSection: 'Cá nhân',
    messagesSection: 'Tin nhắn & đơn hàng',
    businessSection: 'Công cụ kinh doanh',
    historySection: 'Lịch sử',
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
    viewPlan: 'Gói giáo trình',
    topUpCredits: 'Nạp credit',
    tasksHub: 'Tác vụ & hàng đợi',
    supportChat: 'Hỗ trợ từ NanoAI',
    partnerInbox: 'Kênh kinh doanh',
    messagingWebsite: 'Tạo web & landing',
    partnerApiIntegration: 'Tích hợp API (chủ shop)',
    customerApiKeys: 'Thuê nền tảng AI',
    myChats: 'Tin nhắn với cửa hàng',
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
  hubChat: {
    title: 'Trợ lý NanoAI',
    subtitle: 'Mô tả việc cần làm — AI gợi ý công cụ phù hợp và điền sẵn prompt.',
    placeholder: 'Ví dụ: làm banner sale áo thun, làm nét ảnh chân dung, tạo giáo trình Toán lớp 10…',
    modeChat: 'Chat tư vấn',
    modeWorkflow: 'Workflow',
    workflowAll: 'Tất cả nhóm',
    modelLabel: 'Model',
    send: 'Gửi',
    thinking: 'Đang suy nghĩ…',
    openTool: 'Mở công cụ',
    suggested: 'Ví dụ gợi ý nhanh',
    suggestedExamplePrefix: 'Ví dụ:',
    loginRequired: 'Đăng nhập để dùng trợ lý AI (0,1 credit/lượt).',
    errorGeneric: 'Không gửi được. Thử lại sau.',
    creditNote: '0,1 credit / lượt chat hoặc sửa bước',
    fallbackReply: 'Bạn có thể chọn một công cụ bên dưới hoặc mô tả rõ hơn nhu cầu.',
    workflowPick: 'Nhóm workflow',
    clearReply: 'Xóa',
    modePipeline: 'Đa bước',
    modeStudio: 'Thiết kế liền mạch',
    studioSubtitle: 'Thiết kế ngay trong chat — app, banner, brand kit, ảnh SP, thiệp, nhạc quảng cáo. AI hỏi từng bước, bạn duyệt và tiếp tục.',
    studioPlaceholder: 'Hôm nay bạn muốn làm gì?',
    studioProcessTitle: 'Quy trình thiết kế',
    studioProcessForwardOnlyHint: 'Quy trình chỉ đi tiến — hoàn thành từng bước theo thứ tự.',
    studioNavigateStepHint: 'Bấm bước đã xong để quay lại sửa — các bước sau vẫn giữ nguyên.',
    studioNavigatedToStep: 'Đang xem/sửa **{screen}**. Mô tả thay đổi hoặc bấm bước khác trên quy trình để chuyển.',
    studioStepSavedStay: 'Đã lưu **{screen}**. Bấm bước khác trên quy trình để tiếp tục.',
    studioNavigateStepBlocked: 'Chưa thể chuyển tới bước này — chỉ các bước đã hoàn thành mới bấm được.',
    studioRegenerate: 'Tạo lại',
    studioRegenerateDialogTitle: 'Tạo lại — xem & chọn nội dung',
    studioRegeneratePromptLabel: 'Mô tả / nội dung tạo ảnh',
    studioRegeneratePromptHint: 'Chỉnh mô tả nếu cần — đây là nội dung AI sẽ dùng để tạo phiên bản mới.',
    studioDesignRecreateRegenerateTitle: 'Tạo lại bản thiết kế',
    studioDesignRecreateRegeneratePromptLabel: 'Nội dung muốn thêm vào ảnh (tuỳ chọn)',
    studioDesignRecreateRegeneratePromptHint:
      'Ví dụ: đổi màu cổ áo, thêm chi tiết thêu, tên thiết kế… Có thể để trống rồi bấm Tạo lại.',
    studioRegenerateConfirm: 'Tạo lại ngay',
    studioExistingStepHint: 'Ảnh đã tạo — giữ nguyên hoặc bấm Tạo lại nếu muốn phiên bản khác.',
    studioUseReference: 'Chọn làm tham chiếu và tiếp',
    studioImageCredit: 'Tạo ảnh: {n} credits',
    studioGenerating: 'AI đang xử lý…',
    studioSampleLabel: 'App mobile bán hàng',
    studioSamplePrompt: 'Tôi muốn thiết kế giao diện app mobile bán hàng thời trang, phong cách hiện đại',
    studioApprovedNext: 'Đã lưu ảnh tham chiếu cho {screen}. Tiếp theo: {next} — bạn muốn màn hình này trông như thế nào?',
    studioApprovedGenerated: 'Đã lưu tham chiếu {screen}. Đã tạo {next} — xem và duyệt tiếp nhé.',
    studioReferenceWillUse: 'Khi tạo, AI sẽ dùng {n} ảnh tham chiếu đã duyệt bên dưới để giữ đồng bộ style.',
    studioReferenceTitle: 'Ảnh tham chiếu đã duyệt',
    studioReferenceLimit: 'Đã đủ {max} ảnh tham chiếu. Gỡ bớt một ảnh trước khi chọn thêm.',
    studioReferenceRemoved: 'Đã gỡ ảnh tham chiếu: {screen}. Bạn có thể chọn lại ảnh cho bước này.',
    studioBriefUpdated: 'Đã cập nhật brief {screen}. Tiếp tục bước hiện tại bên dưới.',
    studioFacePrintStyleConfirmed: 'Đã chọn phong cách hình ảnh: **{style}** — áp dụng đồng bộ cho cả 6 mặt hộp.',
    studioDiscoveryBriefConfirmed: 'Đã ghi nhận: **{value}**',
    studioBoxFaceConfirmed: 'Đã xác nhận kích thước mặt hộp.',
    studioEditStep: 'Sửa',
    studioEditSave: 'Lưu',
    studioEditCancel: 'Hủy',
    studioEditStepUnknown: 'Không xác định được bước cần sửa.',
    studioEditCredit: '0,1 credit / lượt sửa',
    studioReferenceRemove: 'Gỡ ảnh tham chiếu',
    studioReferenceAttachHint: 'Mỗi lần tạo, AI chỉ gửi tối đa {n} ảnh (ưu tiên Logo + các bước gần nhất) để tránh loãng style.',
    studioReferenceCount: '({count}/{max})',
    studioGenRefPickerTitle: 'Ảnh ghép lên bao bì (lần tạo này)',
    studioGenRefPickerHint:
      'Tối đa {max} ảnh/lần: Logo + ảnh mặt 1 (neo màu/style từ mặt 2) + ảnh SP ghép.',
    studioGenRefApprovedSection: 'Logo + mặt 1 (neo style)',
    studioGenRefStyleSection: 'Ảnh tham khảo phong cách (mặt đầu tiên)',
    studioGenRefStyleLabel: 'Thêm ảnh tham khảo style',
    studioGenRefStyleUploadNote:
      'AI đọc màu sắc, kiểu dáng, layout rồi chuyển thành hướng dẫn text. Không gửi ảnh này khi tạo mặt 1 — style mặt 1 lấy từ các bước brief đã chọn.',
    studioGenRefStyleRemove: 'Gỡ ảnh tham khảo style',
    studioStyleRefUploaded: 'Đã phân tích ảnh tham khảo phong cách — style dùng chung cả 6 mặt.',
    studioStyleRefWrongStep: 'Chỉ thêm ảnh tham khảo phong cách ở mặt hộp đầu tiên.',
    studioGenRefProductSection: 'Ảnh sản phẩm ghép phẳng',
    studioGenRefProductLabel: 'Thêm ảnh SP (ghép lên thiết kế)',
    studioGenRefProductUploadNote:
      'Chỉ ghép lên mặt AI đang tạo — không thay toàn bộ file mặt in. Muốn dùng sẵn file thiết kế từ máy? Xem mục «Thay mặt in» bên dưới.',
    studioGenProductUploaded: 'Đã thêm {n} ảnh sản phẩm cho lần tạo.',
    studioGenRefAttachCount: '{n}/{max} ảnh',
    studioLogoFirst: 'Cần tạo và chọn Logo làm tham chiếu trước khi tạo các trang giao diện.',
    studioNeedLogoReference: 'Chưa có Logo tham chiếu — tải logo lên hoặc mô tả để AI tạo, rồi bấm «Chọn làm tham chiếu và tiếp».',
    studioLogoApprovedNext: 'Đã lưu Logo làm tham chiếu. Tiếp theo: {next} — mô tả yêu cầu (Logo đồng bộ trên các bước sau).',
    studioStartWithLogo:
      'Brief đã đủ. Bước Logo (bắt buộc): **đã có logo** → bấm **Tải logo** làm tham chiếu; **chưa có** → mô tả bên dưới để AI tạo. Phải có logo duyệt trước khi sang bước sau.',
    studioLogoUploadHint: 'Bắt buộc có logo: tải file ảnh lên — hoặc mô tả bên dưới để AI tạo logo mới.',
    studioLogoUploadBtn: 'Tải logo',
    studioLogoUploadUserLabel: '📎 Tải logo làm tham chiếu',
    studioLogoUploadNeedFile: 'Vui lòng chọn file ảnh logo.',
    studioLogoUploadWrongStep: 'Chỉ tải logo khi đang ở bước Logo.',
    studioLogoUploadAlready: 'Logo tham chiếu đã được lưu.',
    studioFaceUploadNeedFile: 'Vui lòng chọn file ảnh mặt hộp.',
    studioFaceUploadWrongStep: 'Chỉ tải ảnh khi đang ở bước thiết kế một mặt hộp.',
    studioFaceUploadSaved: 'Đã lưu ảnh mặt **{screen}** từ máy.',
    studioFaceUploadUserLabel: '📎 Tải ảnh mặt {face}',
    studioFaceUploadReplaceBtn: 'Thay toàn bộ mặt in',
    studioFaceUploadConfirmTitle: 'Xác nhận ảnh mặt in',
    studioFaceUploadConfirmFaceField: 'Mặt hộp',
    studioFaceUploadConfirmSizeField: 'Kích thước chuẩn in',
    studioFaceUploadConfirmFile: 'File',
    studioFaceUploadConfirmHint:
      'Ảnh này sẽ **thay toàn bộ** mặt in ở trên. Kiểm tra đúng mặt và đúng kích thước trước khi xác nhận.',
    studioFaceUploadConfirmOk: 'Đúng — dùng làm mặt in',
    studioFaceUploadConfirmSizeUnknown: 'Chưa xác định — hãy kiểm tra kích thước hộp ở bước trước',
    studioGeneratedStep: 'Đã tạo {screen} theo mô tả của bạn. Xem bên dưới — ổn thì bấm «Chọn làm tham chiếu và tiếp».',
    studioGenerateCurrent: 'Tạo ảnh cho bước này',
    studioGenerateFace: 'Tạo ảnh mặt hộp',
    studioGenerateMusic: 'Tạo nhạc cho bước này',
    studioGenerateArtifact: 'Tạo đầu ra bước này',
    studioNewFlowConfirmTitle: 'Bắt đầu dự án thiết kế mới?',
    studioNewFlowConfirmBody: 'Bạn đang làm “{current}”. Chuyển sang “{target}” sẽ mở một hội thoại mới; dự án hiện tại vẫn được giữ nguyên trong lịch sử.',
    studioNewFlowConfirmOk: 'Mở dự án mới',
    studioNewFlowConfirmCancel: 'Tiếp tục dự án hiện tại',
    studioNewFlowThreadRequired: 'Flow mới phải được mở trong một hội thoại mới để không trộn dữ liệu với dự án hiện tại.',
    advisoryFeatureOpenConfirmTitle: 'Mở công cụ riêng?',
    advisoryFeatureOpenConfirmBody: 'Tính năng “{feature}” chưa có flow chat đầy đủ. Bạn sẽ chuyển sang trang công cụ để thực hiện — có thể quay lại hub bất cứ lúc nào.',
    advisoryFeatureOpenConfirmOk: 'Mở công cụ',
    advisoryFeatureOpenConfirmCancel: 'Ở lại tư vấn',
    advisoryOpenFeature: 'Mở tính năng',
    advisoryStandaloneFeatureBody:
      'Bạn muốn dùng “{feature}”. Tính năng này chạy trên trang công cụ riêng — bấm “Mở tính năng” bên dưới để xác nhận và bắt đầu.',
    featureGroupStudioInline: 'Thiết kế trong chat',
    featurePickerHint: 'Chọn tính năng — hệ thống mở đúng flow theo lập trình',
    featureFeedbackOpen: 'Góp ý tính năng còn thiếu',
    featureFeedbackTitle: 'Góp ý tính năng còn thiếu',
    featureFeedbackHint: 'Viết việc bạn cần mà NanoAI chưa có. Đội ngũ nhận trên chuông thông báo.',
    featureFeedbackPlaceholder: 'Ví dụ: xuất PDF giáo trình theo từng lớp…',
    featureFeedbackSend: 'Gửi góp ý',
    featureFeedbackClose: 'Đóng',
    featureFeedbackSent: 'Đã gửi góp ý. Cảm ơn bạn.',
    featureFeedbackNeedText: 'Viết vài chữ về tính năng còn thiếu.',
    unmatchedSentToAdmin: 'Mình chưa khớp được tính năng có sẵn. Câu của bạn đã được gửi cho đội ngũ NanoAI.',
    studioLogoPendingApprove: 'Logo đã được tạo sẵn bên dưới — bấm «Chọn làm tham chiếu và tiếp» nếu ổn, hoặc «Tạo lại» để thử phiên bản khác.',
    studioStepPendingApprove: '{screen} đã được tạo sẵn bên dưới — bấm «Chọn làm tham chiếu và tiếp» nếu ổn, hoặc «Tạo lại» để thử phiên bản khác.',
    studioApproveBeforeNext: 'Bấm «Chọn làm tham chiếu và tiếp» cho {screen} trước — sau đó hệ thống sẽ chuyển sang bước tiếp theo.',
    studioRegenerated: 'Đã tạo lại giao diện {screen}. Bạn thấy ổn chưa?',
    studioAllDone: 'Đã hoàn tất toàn bộ quy trình thiết kế. Bạn có thể yêu cầu chỉnh sửa thêm bất kỳ màn hình nào.',
    studioPostFlowSuggestHint: 'Muốn làm tác vụ khác? Bấm tính năng bên dưới — hệ thống sẽ mở hội thoại mới.',
    planCreated: 'Đã tạo kế hoạch {n} bước',
    startStep: 'Bắt đầu bước 1',
    continueNextStep: 'Tiếp tục bước {n}',
    planBannerTitle: 'Kế hoạch: {title}',
    planStepProgress: 'Bước {current}/{total} · đã xong {done}',
    planCompleteStep: 'Hoàn thành bước',
    planSkipStep: 'Bỏ qua',
    planCancel: 'Hủy kế hoạch',
    planOpenQueue: 'Hàng đợi',
    viewTaskQueue: 'Xem hàng đợi tác vụ',
    newThread: 'Hội thoại mới',
    newThreadFlowHint: 'Flow khác → tạo hội thoại mới',
    chatHistory: 'Danh sách đã chat',
    chatHistoryEmpty: 'Chưa có hội thoại nào.',
    chatHistoryLoadFailed: 'Không tải được danh sách hội thoại.',
    chatHistoryDelete: 'Xóa hội thoại',
    chatHistoryDeleted: 'Đã xóa hội thoại.',
    chatHistoryDeleteFailed: 'Không xóa được hội thoại.',
    chatHistoryClose: 'Đóng danh sách chat',
    autoRunTitle: 'Chạy tự động (NanoAI Agent)',
    autoRunEstimate: 'Ước tính ~{n} credits cho toàn bộ kế hoạch',
    autoRunUpload: 'Chọn ảnh sản phẩm',
    autoRunImagesSelected: 'Đã chọn {n} ảnh',
    autoRunStart: 'Chạy tự động',
    autoRunRunning: 'Đang chạy tự động các bước…',
    autoRunDone: 'Đã chạy xong kế hoạch tự động',
    autoRunNeedImage: 'Cần chọn ít nhất 1 ảnh sản phẩm.',
    studioNeedUpload: 'Vui lòng tải ảnh sản phẩm/mẫu lên trước khi tạo.',
    studioBannerSavedCreateNext:
      'Đã lưu **Banner {n}**. Chọn tỷ lệ, ảnh ghép và nội dung chữ bên dưới để tạo banner tiếp, hoặc bấm «Hoàn tất quy trình».',
    studioBannerNeedRatio: 'Vui lòng chọn ít nhất 1 tỷ lệ banner (tối đa 4 mỗi lần tạo).',
    studioBannerNeedCopy: 'Vui lòng nhập nội dung chữ hiển thị trên banner.',
    studioBannerLogoNeedFile: 'Vui lòng chọn file ảnh logo.',
    studioBannerLogoWrongStep: 'Chỉ tải logo khi đang ở bước Thiết kế banner.',
    studioBannerOptimizeAi: 'Tối ưu AI',
    studioBannerOptimizeEmpty: 'Nhập sơ ý nội dung & bố cục banner trước khi tối ưu.',
    studioBannerOptimizeDone: 'Đã tối ưu bằng AI',
    studioBannerOptimizeDoneDesc: 'Bạn có thể chỉnh thêm hoặc bấm lại nếu chưa ưng ý.',
    studioBannerOptimizeFailed: 'Không tối ưu được nội dung banner. Thử lại sau.',
    studioBannerOptimizeNoDeepSeek:
      'Chưa cấu hình DEEPSEEK_API_KEY trên server — không thể tối ưu copy banner.',
    studioBannerPromptBuildFailed: 'Không tạo được prompt ảnh banner. Thử lại sau.',
    studioBannerBatchMax: 'Mỗi lần tạo tối đa 4 tỷ lệ banner.',
    studioBannerBatchSelected: 'Đã chọn {n} tỷ lệ → tạo {n} banner một lúc.',
    studioBannerBatchGenerated: 'Đã tạo {n} banner — xem tất cả bên dưới, bấm Tiếp khi xong.',
    studioBannerBatchProgress: 'Đang duyệt banner {index}/{total} — bấm Tiếp tục để xem banner tiếp theo.',
    studioBannerNext: 'Tiếp',
    studioBannerBatchApproveNext: 'Đã lưu banner. Xem banner {index}/{total} trong lô — duyệt hoặc tạo lại.',
    studioGenerateBanner: 'Tạo banner',
    studioGenerateMenu: 'Tạo menu',
    studioGenerateLanding: 'Tạo ảnh phân đoạn',
    studioMenuNeedFormat: 'Vui lòng chọn kiểu menu (tỷ lệ in hoặc màn hình).',
    studioMenuNeedDishes: 'Vui lòng nhập ít nhất một món (tên món và giá VND).',
    studioMenuPromptBuildFailed: 'Không tạo được prompt thiết kế menu. Thử lại sau.',
    studioMenuLogoNeedFile: 'Vui lòng chọn file ảnh logo.',
    studioMenuLogoWrongStep: 'Chỉ tải logo khi đang ở bước Thiết kế menu.',
    studioLandingNeedCopy: 'Nhập mô tả phân đoạn trước khi tạo ảnh.',
    studioLandingNeedLogo: 'Tải hoặc tạo logo trước — ảnh Hero desktop (phân đoạn đầu) cần ghép logo vào header.',
    studioLandingCopySaved:
      'Đã lưu mô tả {screen}. Bấm «Tạo ảnh phân đoạn» để AI vẽ mockup.',
    studioLandingLogoNeedFile: 'Vui lòng chọn file ảnh logo.',
    studioLandingLogoWrongStep: 'Logo landing chỉ dùng sau khi hoàn tất brief thương hiệu.',
    studioLandingLogoNeedBrief: 'Nhập prompt logo (wordmark, icon, màu…) hoặc hoàn tất tên thương hiệu ở brief trước.',
    studioLandingLogoGenerated: 'Đã tạo logo — ghép vào header preview landing.',
    studioLogoStripBg: 'Xóa nền (PNG trong suốt, +1.5 credits)',
    studioUploadBtn: 'Tải ảnh lên',
    studioImagesUploaded: 'Đã tải {n} ảnh. Mô tả yêu cầu cho bước tiếp theo.',
    studioMusicCredit: 'Nhạc: {n} credits',
    studioContinue: 'Tiếp tục',
    studioNoPreview: 'Không có nội dung để duyệt.',
    studioNoPrompt: 'Không có prompt để tạo lại.',
    studioMinChars: 'Nhập ít nhất 2 ký tự.',
    studioViewLarge: 'Xem to',
    studioDownload: 'Tải xuống',
    studioDownloadPng: 'PNG (chất lượng cao)',
    studioDownloadJpeg: 'JPG (chất lượng cao)',
    studioDownloadFailed: 'Không tải được ảnh',
    studioDownloadFailedHint: 'Đã mở ảnh trong tab mới — giữ ảnh để lưu.',
    studioCropImage: 'Cắt / sửa',
    studioCropSizeDisplay: 'Ảnh đã sửa: {size}',
    studioCropTargetDisplay: 'Kích thước mặt hộp: {size}',
    studioCropTitle: 'Chỉnh sửa ảnh mặt in',
    studioCropSave: 'Áp dụng',
    studioCropDone: 'Xong',
    studioCropCancel: 'Hủy',
    studioCropZoom: 'Thu phóng',
    studioCropTargetSize: 'Mặt hộp (mục tiêu): {size}',
    studioCropResultSize: 'Vùng in sau cắt: {size}',
    studioCropDragHint: 'Kéo khung đỏ để di chuyển — kéo góc để phóng to/thu nhỏ. Vùng trống có thể lấp bằng màu viền ảnh (nút bên dưới).',
    studioCropRatioLocked: 'Tỷ lệ khung cắt luôn khớp mặt in: {size}',
    studioCropFillEdgeColor: 'Lấp màu nền',
    studioCropFillEdgeColorOff: 'Vùng trống trắng',
    studioCropOutpaintBackground: 'Vẽ nền AI',
    studioCropOutpaintBusy: 'Đang vẽ nền AI…',
    studioCropOutpaintNeedGaps: 'Kéo khung ra ngoài ảnh để mở rộng trước.',
    studioCropOutpaintDone: 'Đã vẽ nền AI cho vùng mở rộng — xem preview và bấm Lưu nếu ổn.',
    studioCropOutpaintCredit: '{n} credits',
    studioCropBlendSeams: 'Làm mượt vùng nối',
    studioCropBlendSeamsBusy: 'Đang làm mượt vùng nối…',
    studioCropEraser: 'Cục tẩy',
    studioCropAdjustFrame: 'Chỉnh khung cắt',
    studioCropFrameModeFree: 'Tùy ý',
    studioCropFrameModePrint: 'Chuẩn in hộp',
    studioCropDragHintFree: 'Kéo khung đỏ tùy ý — kéo góc để đổi rộng/cao độc lập, không khóa tỷ lệ.',
    studioCropRatioFree: 'Khung tùy ý — có thể lệch tỷ lệ mặt in trên hộp.',
    studioCropEraserSize: 'Cỡ tẩy',
    studioCropEraserUndo: 'Quay lại',
    studioCropEraserUndoHint: 'Ctrl+Z hoặc Quay lại để hoàn tác nét tẩy',
    studioCropMagicEraser: 'Xóa magic',
    studioCropMagicEraserBusy: 'Đang lấp vùng…',
    studioCropMagicEraserHint: 'Tô vùng cần xóa — tự lấp bằng màu xung quanh (như Photoshop)',
    studioCropMagicEraserModeBox: 'Chọn ô',
    studioCropMagicEraserModeBrush: 'Tô vùng',
    studioCropMagicEraserBoxHint: 'Kéo chuột vẽ khung chữ nhật — thả tay để xóa và lấp vùng trong khung.',
    studioEditAddText: 'Thêm chữ',
    studioEditAddImage: 'Chèn ảnh',
    studioEditAddSticker: 'Chèn nhãn dán',
    studioEditOverlayHint: 'Chạm/chọn lớp để kéo — kéo góc tím để phóng to/thu nhỏ nhãn dán hoặc ảnh chèn.',
    studioEditTextPlaceholder: 'Nội dung chữ',
    studioEditTextColor: 'Màu chữ',
    studioEditColorOk: 'OK',
    studioEditDeleteLayer: 'Xóa lớp',
    studioEditRevertOriginal: 'Quay lại ảnh gốc',
    studioEditReverted: 'Đã khôi phục ảnh gốc AI ({screen}).',
    studioCropApplied: 'Đã cập nhật ảnh sau khi cắt ({screen}).',
    studioCropSizeLine: 'Kích thước ảnh đã sửa: {size}',
    studioDiscoveryBlocked: 'Đang thu thập brief — chưa tạo ảnh ở bước này.',
    studioPresets: {
      mobile_shop: {
        title: 'App bán hàng',
        sample: 'Thiết kế app mobile bán thời trang nữ, tone pastel',
        steps: {
          home: 'Trang chủ',
          product_list: 'Danh sách SP',
          product_detail: 'Chi tiết SP',
          cart: 'Giỏ hàng',
          checkout: 'Thanh toán',
          profile: 'Tài khoản',
        },
      },
      sale_banner: {
        title: 'Banner sale',
        sample: 'Bộ banner khai trương shop thời trang, màu đỏ vàng',
        steps: { banner_main: 'Banner chính', banner_square: 'Vuông 1:1', banner_story: 'Story 9:16' },
      },
      brand_kit: {
        title: 'Bộ thương hiệu',
        sample: 'Brand kit cafe artisan, tone nâu kem',
        steps: { logo: 'Logo', banner: 'Banner', product_label: 'Nhãn SP', sticker: 'Sticker' },
      },
      landing_page: {
        title: 'Mockup landing bán hàng & dịch vụ',
        sample: 'Landing đa ngành — shop bán SP + dịch vụ, ghép preview desktop/mobile',
        steps: { hero: 'Hero', features: 'Sản phẩm & dịch vụ', pricing: 'SP / gói giá', faq: 'FAQ', cta: 'CTA' },
      },
      product_listing: {
        title: 'Ảnh sản phẩm',
        sample: 'Ảnh sản phẩm túi xách đăng Shopee, nền trắng',
        uploadHint: 'Tải ảnh sản phẩm gốc',
        steps: { product_clean: 'Nền trắng', product_lifestyle: 'Lifestyle', promo_banner: 'Banner KM' },
      },
      wedding_invite: {
        title: 'Thiệp mời',
        sample: 'Thiệp cưới tone hồng pastel, phong cách tối giản',
        steps: { cover: 'Mặt trước', inside: 'Mặt trong', story: 'Story' },
      },
      ad_music: {
        title: 'Nhạc quảng cáo',
        sample: 'Nhạc nền quảng cáo mỹ phẩm, vui tươi, 30–60 giây feel',
        steps: { track_main: 'Bản chính', track_alt: 'Bản phụ' },
      },
      lookbook: {
        title: 'Lookbook',
        sample: 'Lookbook BST Thu Đông, tone be ấm',
        uploadHint: 'Tải ảnh look/mẫu',
        steps: { hero_look: 'Hero look', grid_look: 'Lưới look', detail_look: 'Chi tiết' },
      },
      packaging_kit: {
        title: 'Bộ đóng gói',
        sample: 'Bao bì mỹ phẩm organic, hộp vuông, tem niêm phong',
        steps: { logo: 'Logo', body_strip: 'Đủ 6 mặt hộp', box_3d: 'Mockup 3D', dieline: 'Dieline PDF', label: 'Nhãn' },
      },
      interior_design: {
        title: 'Nội thất',
        sample: 'Căn hộ 80m² phong cách Japandi, phòng khách ấm',
        uploadHint: 'Tải mặt bằng hoặc ảnh phòng',
        steps: { living: 'Phòng khách', kitchen: 'Bếp', bedroom: 'Ngủ', facade: 'Mặt tiền' },
      },
      social_media_kit: {
        title: 'Social media',
        sample: 'Bộ feed shop mỹ phẩm, tone hồng pastel',
        steps: { avatar: 'Avatar', post: 'Post', story: 'Story', cover: 'Cover FB' },
      },
      story_with_images: {
        title: 'Kể chuyện bằng hình',
        sample: 'Truyện tranh trẻ em về chú mèo dũng cảm, watercolor',
        steps: { character: 'Nhân vật', page1: 'Trang 1', cover: 'Bìa' },
      },
      infographic_series: {
        title: 'Infographic',
        sample: 'Tóm tắt sách kinh doanh thành 5 slide infographic',
        uploadHint: 'Tải ảnh sách/tài liệu',
        steps: { hook: 'Hook', body: 'Nội dung', summary: 'Tổng kết' },
      },
      fashion_campaign: {
        title: 'Campaign thời trang',
        sample: 'Campaign BST hè, try-on 2 outfit + banner sale',
        uploadHint: 'Tải ảnh mẫu/trang phục',
        steps: { hero: 'Hero', try1: 'Try-on 1', banner: 'Banner sale' },
      },
      design_recreate: {
        title: 'Dựng lại thiết kế từ mẫu',
        sample: 'Dựng lại áo dài cách tân từ ảnh mẫu — bảng concept đầy đủ',
        uploadHint: 'Tải ảnh mẫu sản phẩm — tối đa 4 góc',
        steps: { concept: 'Concept board', detail: 'Chi tiết', technical: 'Kỹ thuật' },
      },
      profile_photo_pack: {
        title: 'Ảnh thẻ / profile',
        sample: 'Bộ ảnh LinkedIn cho marketing, tone chuyên nghiệp',
        uploadHint: 'Tải ảnh chân dung gốc',
        steps: { id_white: 'Thẻ trắng', id_blue: 'Thẻ xanh', linkedin: 'LinkedIn', banner: 'Banner' },
      },
    },
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
  legal: LEGAL_PAGES_BY_LOCALE.vi,
  accountPlan: {
    pageTitle: 'Gói giáo trình',
    metaDescription:
      'Xem dùng thử 18 ngày, phí tháng và credit AI trong tính năng giáo trình & tạo bài.',
    headline: 'Gói giáo trình',
    billingPeriod: 'Kỳ phí tháng (lịch Việt Nam): {period}',
    trialSectionTitle: 'Dùng thử miễn phí',
    trialActiveLine:
      'Bạn đang trong thời gian dùng thử — chưa trừ phí tháng giáo trình.',
    trialTotalDaysNote: 'Thời lượng dùng thử: {days} ngày kể từ khi tạo tài khoản.',
    trialDaysLeft: 'Còn lại khoảng {days} ngày.',
    trialEndsAtLine: 'Hết hạn dùng thử (dự kiến): {datetime}',
    trialNotActive:
      'Bạn không còn trong 18 ngày dùng thử đầu tiên. Phí tháng giáo trình sẽ trừ bằng credit mỗi kỳ khi áp dụng.',
    servicesSectionTitle: 'Phí tháng giáo trình (credit)',
    productCurriculum: 'Giáo trình & tạo bài',
    statusViaTrial: 'Đang dùng thử — chưa trừ phí tháng.',
    statusAccessOn: 'Đang có quyền truy cập giáo trình.',
    statusPaidMonth: 'Đã trừ phí tháng cho kỳ {period}.',
    statusPendingPayment: 'Chưa trừ phí tháng — cần {credits} credit cho kỳ {period}.',
    noteSignupBonus: 'Khi đăng ký, tài khoản được tặng {credits} credit (dùng trong giáo trình).',
    noteAiCredits:
      'Phí tháng chỉ mở quyền dùng giáo trình. Tạo nội dung bằng AI (slide, infographic, tạo bài…) vẫn trừ credit riêng theo lượt — lần đầu infographic/slide trong bài miễn phí, tạo lại mới trừ credit.',
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
    channelsSection: 'Thu tin Zalo & Facebook',
    channelsSectionDesc:
      'Kéo tin khách nhắn trên Zalo OA và Facebook Page vào hộp thư NanoAI để AI và nhân viên trả lời.',
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
    shopFacebookPixelHint:
      'Chỉ nhập Pixel ID (số). Dùng chung cho chuyển đổi và tiếp thị động trên web shop. Dán snippet Meta cũng được — hệ thống tự lấy số.',
    shopFacebookCapiHint:
      'Events Manager → Cài đặt → Conversions API. Token chỉ dùng trên máy chủ, không gắn vào HTML. Ô trống giữ token đã lưu.',
    shopFacebookPixelInvalidToast: 'Pixel ID không hợp lệ. Nhập số Pixel (ít nhất 10 chữ số) hoặc dán snippet Meta.',
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
    shopGoogleAdsIdLabel: 'Mã Google Ads (AW-...)',
    shopGoogleAdsIdHint:
      'Thẻ chuyển đổi / tiếp thị lại động trên website shop — gửi view_item, add_to_cart, purchase.',
    shopGoogleAdsIdPlaceholder: 'Ví dụ: AW-123456789',
    shopGoogleAdsInvalidIdToast: 'Mã Google Ads không hợp lệ. Định dạng: AW-XXXXXXXXX',
    shopGoogleAdsSaveButton: 'Lưu mã Google Ads',
    shopGcrMerchantIdLabel: 'Mã Google Customer Reviews (Merchant ID)',
    shopGcrMerchantIdHint:
      'Mã số Merchant Center — hiện hộp thoại đánh giá Google sau khi khách đặt hàng (COD) hoặc sau khi đặt cọc thành công.',
    shopGcrMerchantIdPlaceholder: 'Ví dụ: 123456789',
    shopGcrInvalidIdToast: 'Merchant ID không hợp lệ. Chỉ nhập số nguyên dương.',
    shopGcrSaveButton: 'Lưu Google Customer Reviews',
    shopTiktokPixelLabel: 'TikTok Pixel',
    shopTiktokPixelHint: 'Pixel TikTok Ads — PageView, ViewContent, AddToCart, CompletePayment trên shop.',
    shopTiktokPixelPlaceholder: 'Ví dụ: CXXXXXXXXXXXXXXXXX',
    shopTiktokPixelInvalidIdToast: 'TikTok Pixel ID không hợp lệ.',
    shopTiktokPixelSaveButton: 'Lưu TikTok Pixel',
    shopGtmContainerLabel: 'GTM Container ID',
    shopGtmContainerHint: 'Nhập ID container Google Tag Manager (GTM-XXXXXXX) — hệ thống tự sinh script chèn vào trang shop.',
    shopGtmContainerPlaceholder: 'GTM-XXXXXXX',
    shopGtmContainerInvalidIdToast: 'GTM Container ID không hợp lệ (phải dạng GTM-XXXXXXX).',
    shopGtmContainerSaveButton: 'Lưu GTM Container',
    shopAdsConversionLabelsTitle: 'Nhãn chuyển đổi Google Ads (AW-/label)',
    shopAdsConversionLabelsHint:
      'Dán send_to từng bước như 188: xem sản phẩm, thêm giỏ, giỏ hàng, trang cọc, mua. Để trống nếu chưa có nhãn.',
    shopAdsConversionPdpLabel: 'Xem sản phẩm (PDP)',
    shopAdsConversionAddToCartLabel: 'Thêm giỏ',
    shopAdsConversionBeginCheckoutLabel: 'Bắt đầu thanh toán (giỏ)',
    shopAdsConversionDepositPageLabel: 'Trang đặt cọc',
    shopAdsConversionPurchaseLabel: 'Mua hàng',
    shopAdsConversionPlaceholder: 'AW-123456789/AbCdEfGh',
    shopAdsConversionInvalidToast: 'Nhãn chuyển đổi không hợp lệ. Định dạng: AW-123456789/label',
    shopAdsConversionSaveButton: 'Lưu nhãn Ads',
    shopVerifyTagsTitle: 'Thẻ xác minh tên miền',
    shopVerifyTagsHint: 'Dán chuỗi content, hoặc dán cả thẻ meta Google/Facebook — hệ thống tự lấy content và gắn thẻ.',
    shopSearchConsoleVerifyLabel: 'Google Search Console',
    shopMerchantCenterVerifyLabel: 'Google Merchant Center',
    shopFacebookDomainVerifyLabel: 'Facebook domain verification',
    shopVerifyPlaceholder: 'Chuỗi xác minh',
    shopVerifyInvalidToast: 'Chuỗi xác minh không hợp lệ (chỉ chữ, số, gạch).',
    shopSitemapTitle: 'Sơ đồ trang web (Sitemap XML) cho Google Search Console',
    shopSitemapHint:
      'Sitemap tự động cập nhật danh mục, trang tĩnh và toàn bộ sản phẩm đang bán. Nộp link này vào Google Search Console để Google lập chỉ mục nhanh.',
    shopSitemapIndexUrlLabel: 'URL sơ đồ trang web chính (Sitemap Index)',
    shopSitemapPathToSubmitLabel: 'Đường dẫn nộp vào ô Search Console',
    shopSitemapCopyFullUrl: 'Sao chép toàn bộ URL',
    shopSitemapCopyPath: 'Sao chép sitemap.xml',
    shopSitemapOpenGsc: 'Mở Google Search Console Sitemaps',
    shopSitemapViewXml: 'Xem tệp XML',
    shopSitemapCopiedToast: 'Đã sao chép vào bộ nhớ tạm',
    shopSitemapDraftWarning: 'Website của shop đang ở trạng thái Bản nháp. Hãy xuất bản website để Google có thể truy cập sitemap.xml.',
    shopSitemapReadyBadge: 'Sẵn sàng nộp',
    shopSitemapDraftBadge: 'Bản nháp',
    shopSitemapSubfilesLabel: 'Các sơ đồ trang thành phần tự động:',
    shopSitemapPagesLabel: 'Trang tĩnh & Danh mục sản phẩm',
    shopSitemapProductsLabel: 'Danh sách sản phẩm (tự động phân trang 5.000 sản phẩm/tệp)',
    shopSitemapInstructionsTitle: 'Hướng dẫn nộp lên Google Search Console:',
    shopSitemapStep1: 'Bấm nút "Mở Google Search Console Sitemaps" ở trên hoặc truy cập Search Console của tên miền shop.',
    shopSitemapStep2: 'Tại mục "Thêm sơ đồ trang web mới", dán "sitemap.xml" vào ô nhập liệu.',
    shopSitemapStep3: 'Bấm "Gửi" (Submit). Google sẽ tự động đọc sơ đồ trang chính và lập chỉ mục các trang thành phần.',
    shopCustomHtmlTitle: 'HTML tùy chỉnh',
    shopCustomHtmlHint:
      'Tối đa script/meta/link/noscript từ Google / Meta / TikTok. Sửa nhanh không nhúng mã này. Script ads chờ khách đồng ý cookie.',
    shopCustomHtmlHeadLabel: 'Head',
    shopCustomHtmlBodyOpenLabel: 'Đầu body',
    shopCustomHtmlBodyCloseLabel: 'Cuối body',
    shopTrackingExtrasSaveButton: 'Lưu thẻ Ads / xác minh / HTML',
    shopTiktokEventsTokenLabel: 'TikTok Events API token',
    shopTiktokEventsTokenHint: 'Chỉ lưu — chưa gửi server (giống 188). Pixel TikTok phía trên vẫn bắn trên web.',
    shopTiktokEventsTokenPlaceholder: 'Dán token Events API',
    shopTiktokEventsTokenConfiguredBadge: 'Đã lưu token',
    shopTiktokEventsTokenSavedHint: 'Ô trống = giữ token đã lưu. Dán token mới khi muốn đổi.',
    shopDefaultCurrencyLabel: "Tiền tệ cửa hàng",
    shopDefaultCurrencyHint: "Dùng cho hiển thị và sự kiện theo dõi (GA4/Meta/TikTok). Không quy đổi tỷ giá.",
    shopDefaultCurrencySaveButton: "Lưu tiền tệ",
    shopDefaultCurrencyInvalidToast: "Mã tiền tệ không hợp lệ.",
    shopContactChannelsTitle: "Liên hệ công khai (shop)",
    shopContactChannelsHint: "Hiện nút gọi/Zalo/Messenger/Instagram trên trang shop. Không dùng token webhook.",
    shopContactPhoneLabel: "Số điện thoại",
    shopContactZaloLabel: "Link Zalo (zalo.me/...)",
    shopContactMessengerLabel: "Link Messenger (m.me/...)",
    shopContactInstagramLabel: "Link Instagram",
    shopContactChannelsSaveButton: "Lưu liên hệ công khai",
    shopShippingCarrierLabel: "Đơn vị vận chuyển (nhãn)",
    shopShippingCarrierHint: "Chỉ hiển thị cho khách — không kết nối API GHN/GHTK.",
    shopShippingCarrierPlaceholder: "Ví dụ: GHN, GHTK, Viettel Post",
    messagingSettingsWebhookCardTitle: "Webhook outbound & API key",
    messagingSettingsWebhookCardBody: "Cấu hình URL nhận sự kiện (lead/order/payment), signing secret và khoá API tại trang Tích hợp API.",
    messagingSettingsWebhookOpenButton: "Mở cấu hình Webhook / API",
    customDomainRefreshStatusButton: "Làm mới trạng thái DNS/SSL",
    customDomainStatusHintPending: "Chưa xác minh DNS — thêm CNAME rồi bấm xác minh hoặc làm mới.",
    customDomainStatusHintDnsOk: "DNS đúng — hệ thống đang chờ cấp chứng chỉ SSL.",
    customDomainStatusHintSslActive: "Domain đã sẵn sàng với HTTPS.",
    customDomainStatusHintError: "Xác minh thất bại — kiểm tra CNAME và thử làm mới lại.",
    customDomainLastErrorTitle: "Chi tiết lỗi gần nhất",
    facebookCatalogFeedTitle: 'Facebook — danh mục sản phẩm (CSV)',
    facebookCatalogFeedHint:
      'Dán URL này vào Commerce Manager khi chọn «URL hoặc Google Trang tính». CSV gồm sản phẩm đang bật; cột link là trang sản phẩm web shop đã đăng. Đủ trường: giá/sale, ảnh, danh mục Google, màu, size, chất liệu, giới tính, video, nhãn tuỳ chỉnh. key = khóa nhúng (giữ bí mật).',
    facebookCatalogFeedCopyButton: 'Sao chép URL feed',
    facebookCatalogFeedCopiedToast: 'Đã sao chép URL feed danh mục.',
    googleMerchantCatalogFeedTitle: 'Google Merchant Center — feed sản phẩm (TSV)',
    googleMerchantCatalogFeedHint:
      'Dán URL này vào Merchant Center: Sản phẩm → Nguồn dữ liệu → Lấy theo lịch. TSV đủ cột như catalog 188 (id, giá/sale, ảnh, danh mục, màu, size, MPN, video…). id khớp remarketing với Meta/TikTok. key = khóa nhúng (giữ bí mật).',
    googleMerchantCatalogFeedCopyButton: 'Sao chép URL feed',
    googleMerchantCatalogFeedCopiedToast: 'Đã sao chép URL feed Google Merchant Center.',
    tiktokCatalogFeedTitle: 'TikTok — danh mục sản phẩm (CSV)',
    tiktokCatalogFeedHint:
      'Dán URL này vào TikTok Ads Manager: Tài sản → Catalog → Nguồn dữ liệu → Feed theo lịch. CSV đủ trường (sku_id, giá/sale, danh mục, màu, size, video…). sku_id khớp id Meta/Google. key = khóa nhúng (giữ bí mật).',
    tiktokCatalogFeedCopyButton: 'Sao chép URL feed',
    tiktokCatalogFeedCopiedToast: 'Đã sao chép URL feed danh mục TikTok.',
    catalogFeedsPageHint:
      'Ba URL dưới đây là nguồn cấp dữ liệu catalog (scheduled fetch) cho Facebook, Google Merchant Center và TikTok. Cùng kho sản phẩm, đủ trường: tiêu đề, mô tả, giá, giá sale, ảnh, danh mục, màu, size, chất liệu, giới tính, tồn kho, video và nhãn tuỳ chỉnh. Cột link là trang sản phẩm web shop đã đăng.',
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
      'Mời bằng Gmail/email. Chưa có tài khoản NanoAI thì hệ thống tạo khi họ đăng nhập Google trên web shop. Email kèm link quản trị. Mỗi ô là một mục con trên sidebar quản trị, không cấp cả nhóm. Chỉ nên cho quyền nhạy cảm khi tin tưởng hoàn toàn.',
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
    teamInviteOk: 'Đã mời nhân viên. Email kèm link quản trị shop đã được gửi.',
    teamInviteOkEmailFailed:
      'Đã thêm nhân viên. Không gửi được email — kiểm tra SMTP hoặc bấm Mời lại để gửi link quản trị.',
    teamInviteMailSubject: '{shop} — lời mời quản trị shop',
    teamInviteMailTitle: 'Bạn được mời quản trị {shop}',
    teamInviteMailBody:
      '{inviter} đã mời bạn làm quản trị viên shop {shop}. Bấm nút bên dưới để vào trang quản trị shop.',
    teamInviteMailCta: 'Vào trang quản trị shop',
    teamInviteMailNeedLogin:
      'Đăng nhập bằng đúng email được mời rồi mở liên kết. Nếu chưa có tài khoản, hãy đăng ký bằng email này.',
    teamInviteMailOrLink: 'Hoặc mở liên kết:',
    teamInviteMailIgnore: 'Nếu bạn không nhận lời mời này, hãy bỏ qua email.',
    teamStaffRestrictedNote:
      'Đang vào vai trò nhân viên: chỉ chủ workspace mới xem/sửa thanh toán, API nhúng, xóa workspace và các mục nhạy cảm khác.',
    teamPermInbox: 'Hộp thư khách',
    teamPermOrders: 'Đơn hàng',
    teamPermInventory: 'Kho sản phẩm',
    teamPermAiSettings: 'Cài đặt AI',
    teamPermWorkspaceBranding: 'Thương hiệu & logo',
    teamPermWorkspacePayment: 'Thanh toán trong chat',
    teamPermIntegrationsChannels: 'Thu tin Zalo / Facebook',
    teamPermIntegrationsAnalytics: 'Meta Pixel / GA4 / Catalog',
    teamPermUsageReports: 'Báo cáo sử dụng',
    teamPermMarketingCampaigns: 'Campaign marketing',
    teamPermWebsite: 'Website & landing shop',
    integrationsAnalyticsOwnerOnly: 'Chỉ chủ workspace mới có thể lưu Pixel, CAPI và GA4.',
    teamRemoveMemberConfirm: 'Gỡ nhân viên này khỏi workspace?',
    fbLinkedLine: 'Facebook Page đã liên kết: {pageId}',
    fbLoginWithFacebook: 'Đăng nhập bằng Facebook',
    fbLoginHint: 'Đăng nhập Facebook, rồi chọn Page để nhận tin và trả lời ngay trên Messenger.',
    fbPickPagesTitle: 'Chọn Facebook Page',
    fbPickPagesDesc: 'Chọn một hoặc nhiều Page. Tin nhắn vào hộp thư shop và câu trả lời gửi lại Messenger.',
    fbPickPagesSearch: 'Tìm Page',
    fbPickPagesSelectAll: 'Chọn tất cả',
    fbPickPagesConnect: 'Kết nối',
    fbPickPagesConnecting: 'Đang kết nối…',
    fbPickPagesEmpty: 'Tài khoản Facebook này chưa quản trị Page nào.',
    fbPickPagesLater: 'Để sau',
    fbConnectedHeading: 'Page đã kết nối',
    fbUnlinkPage: 'Gỡ',
    fbManualTokenToggle: 'Nhập Page token thủ công',
    fbConnectPartial: 'Đã kết nối {ok} Page. {fail} Page không lưu được.',
    zaloLinkedLine: 'Zalo OA đã cấu hình webhook & token.',
    credentialsKeepHint:
      'Để trống ô token hoặc secret nếu không đổi — hệ thống giữ giá trị đã lưu.',
    setupColumnTitle: 'Kết nối & trợ lý AI',
    chatColumnTitle: 'Hội thoại khách',
    messagingSettingsLink: 'Quản trị',
    marketingCampaignsLink: 'Remarketing chat',
    notificationsLink: 'Thông báo khách web',
    emailManagementLink: 'Quản lý gửi email',
    messagingWebsiteLink: 'Tạo web & landing',
    messagingOrdersLink: 'Đơn hàng',
    messagingProfitLink: 'Lợi nhuận',
    messagingAnalyticsLink: 'Doanh thu',
    messagingSettingsPageTitle: 'Quản trị shop',
    settingsHeaderShopSelect: 'Chọn shop',
    messagingInboxDescription:
      'Danh sách khách bên trái; khi mở một hội thoại, ô soạn tin cố định dưới cùng màn hình.',
    noWorkspaceInboxCta: 'Bạn chưa có workspace nhắn tin. Vào Quản trị để tạo shop và kết nối Facebook / Zalo / chat.',
    goToInbox: 'Về hộp thư',
    inboxMobileBackAria: 'Danh sách hội thoại',
    apiIntegrationGuideLink: 'Hướng dẫn tích hợp API (khóa & endpoint)',
    apiIntegrationGuideShort: 'Dành cho dev tích hợp web shop: nhúng chat, tìm ảnh sản phẩm, API thử đồ B2B.',
    partnerSiteLoginGuideLink: 'Đăng nhập tự động — khách đã login web shop',
    partnerSiteLoginGuideShort:
      'Ký token trên server shop, truyền vào widget — inbox hiển thị đúng tên khách (không còn Guest).',
    messagingSettingsApiHubCardTitle: 'Nhúng chat & API',
    messagingSettingsApiHubCardBody:
      'URL hosted, mã iframe, endpoint embed, khóa X-Embed-Key / Bearer và tài liệu cho developer đã chuyển sang trang «Tích hợp API» — không còn hiển thị trên trang cài đặt này.',
    customerCareShopSetupGuideTitle: 'Hướng dẫn tạo shop chăm sóc khách hàng',
    customerCareShopSetupGuideBody:
      'Bước 1 — Vào Bảng điều khiển → Nhắn tin → Quản trị (trang này).\n\nBước 2 — Ở mục «Tạo workspace nhắn tin», nhập tên hiển thị, tên thương hiệu, chọn ngành; có thể dán URL logo hoặc tải ảnh lên.\n\nBước 3 — Nhấn «Tạo mới». Đây là workspace của shop: mọi tin từ Facebook Page, Zalo OA, chat trên NanoAI và chat nhúng trên web shop đều vào cùng một inbox.\n\nBước 4 — Sau đó kết nối kênh (Facebook/Zalo), sao chép liên kết chat hoặc mã nhúng iframe, và tùy chọn bật trợ lý AI cùng kho hàng ngay trên trang quản trị này.',
    settingsSidebarTitle: 'Danh mục quản trị',
    settingsCloseSidebar: 'Đóng menu quản trị',
    settingsNavOperationsTitle: 'Vận hành',
    settingsNavOperationsDesc: 'Đơn hàng, thông báo khách và chiến dịch marketing.',
    settingsNavWebsiteTitle: 'Quản trị website',
    settingsNavShopTitle: 'Cửa hàng',
    settingsNavSalesTitle: 'Bán hàng',
    settingsNavWorkspace: 'Shop & nhân viên',
    settingsNavGoLive: 'Checklist mở bán',
    settingsNavGoLiveDesc: 'Các mục bắt buộc trước khi nhận đơn trên web shop.',
    settingsNavIsolation: 'Tách bạch shop',
    settingsNavIsolationDesc: 'Khi cài shop mới: tên miền, pháp lý, quảng cáo và ảnh không trùng workspace khác.',
    settingsDataRoleLegendTitle: 'Màu trường thông tin',
    settingsDataRoleLegendInternal: 'Đen — thông tin dùng nội bộ trên nền tảng.',
    settingsDataRoleLegendIssued: 'Xanh dương — khóa / dữ liệu nền tảng cấp sang hệ thống khác (dán bên kia).',
    settingsDataRoleLegendInbound: 'Xanh lá — cần dữ liệu từ nền tảng khác điền vào đây để hoạt động.',
    settingsDataRoleBadgeInternal: 'Nội bộ',
    settingsDataRoleBadgeIssued: 'Cấp ra',
    settingsDataRoleBadgeInbound: 'Nhận vào',
    settingsNavBrandDesc:
      'Tên hiển thị, ngành hàng, logo chat, favicon và logo header / chân trang trên website.',
    settingsNavWebsiteEditor: 'Giao diện web shop',
    settingsNavConnectTitle: 'Kết nối',
    settingsNavCustomersTitle: 'Khách hàng',
    settingsNavAiGroupTitle: 'AI',
    settingsNavPaymentDesc: 'Tài khoản nhận tiền, đặt cọc và SePay cho đơn trên web/chat.',
    settingsOpenWebsiteButton: 'Xem web',
    settingsManageWebsiteButton: 'Chỉnh web',
    settingsCreateWebsiteButton: 'Tạo web',
    settingsNavPayment: 'Cài đặt thanh toán',
    sepayHmacLabel: 'Secret Key HMAC-SHA256 (whsec_)',
    sepayHmacHint:
      'SePay → Webhooks của shop → Bảo mật → HMAC-SHA256 → bấm mắt, copy Secret Key (whsec_…). Không dùng merchant key spsk_. Để trống ô này nếu không đổi key đã lưu.',
    sepayHmacPlaceholder: 'whsec_…',
    sepayHmacConfiguredBadge: 'Đã lưu HMAC',
    sepayHmacSavedHint: 'Key hiện tại kết thúc bằng ****{last4}. Điền key mới bên dưới nếu muốn thay.',
    sepayHmacKeepHint: 'Chưa lưu Secret Key HMAC. Webhook shop vẫn nhận theo token; bật HMAC trên SePay thì dán whsec_ vào đây.',
    settingsNavShipping: 'Cài đặt vận chuyển',
    settingsNavShippingDesc:
      'Hai phần: (1) quản lý vận chuyển/COD web shop (EMS, đối soát, hoàn hàng); (2) cổng API tra cứu đơn của website khách khác hệ thống.',
    settingsNavShippingFeeTitle: 'Phí vận chuyển (đơn trên chat)',
    settingsShippingOpenFromPayment: 'Phí ship, đơn vị vận chuyển, địa chỉ hoàn và cổng tra cứu đơn → Quản lý vận chuyển',
    settingsNavShippingSaveFee: 'Lưu phí vận chuyển',
    settingsNavEmsOps: 'Vận chuyển EMS',
    settingsNavEmsOpsDesc:
      'Import EMS, đối soát COD/cước, xác nhận hoàn và nhập kho — cùng bảng với Cài đặt vận chuyển, đặt cạnh danh sách đơn.',
    settingsNavAffiliate: 'Affiliate',
    settingsNavLoyalty: 'Thành viên thân quen',
    settingsNavLoyaltyDesc:
      'Tính hạng theo chi tiêu của khách trong cửa sổ thời gian và tự động giảm giá khi chốt đơn.',
    settingsNavPromotions: 'Ưu đãi sinh nhật',
    settingsNavPromotionsDesc: 'Email và giảm giá sinh nhật khách hàng — tách với voucher trên website.',
    settingsNavAnalyticsMeta: 'Nguồn cấp dữ liệu',
    settingsNavAnalyticsMetaDesc: 'Feed catalog Facebook, Google Merchant Center và TikTok — cùng kho sản phẩm, đủ trường thông tin.',
    settingsNavAnalyticsGoogleMerchant: 'Google Merchant Center',
    settingsNavAnalyticsGoogleMerchantDesc: 'Feed TSV sản phẩm để đồng bộ catalog Google Merchant Center.',
    settingsNavAnalyticsTiktokCatalog: 'TikTok Catalog',
    settingsNavAnalyticsTiktokCatalogDesc: 'Feed CSV sản phẩm để đồng bộ catalog TikTok Ads.',
    settingsNavAnalyticsAds: 'Pixel theo dõi',
    settingsNavAnalyticsAdsDesc:
      'Meta Pixel, Conversions API, Google Analytics 4, Google Ads và TikTok Pixel — không phải feed catalog.',
    settingsNavSheets: 'Google Sheet',
    settingsNavSheetsDesc: 'Đồng bộ đơn hàng từ chat lên Google Sheet của shop.',
    settingsNavAiUsage: 'Token API AI',
    settingsNavAiUsageDesc: 'Thống kê token LLM, embedding, tạo ảnh và chi phí ước tính.',
    settingsNavInventoryDesc: 'Bảng kho, Excel, tìm vector ảnh/chữ — AI tư vấn dùng dữ liệu này.',
    settingsNavInventoryGroupTitle: 'Kho hàng & tìm kiếm',
    settingsNavInventoryCatalog: 'Sản phẩm',
    settingsNavInventoryStudio: 'Đăng sản phẩm',
    settingsNavInventoryStudioDesc: 'Đăng thủ công hoặc bằng AI — cùng engine danh mục + SEO khi công tắc tự tạo bật.',
    settingsNavListingFacetCache: 'Cache bộ lọc',
    settingsNavListingFacetCacheDesc: 'Snapshot size / màu / kiểu / giá cho listing danh mục và từ khóa tìm.',
    settingsNavSearchCache: 'Cache tìm kiếm',
    settingsNavSearchCacheDesc: 'Thống kê từ khóa khách và cache danh sách id listing / catalog shop.',
    settingsNavCustomDomain: 'Tên miền riêng (SSL)',
    customDomainSectionTitle: 'Tên miền thương hiệu',
    customDomainSectionDesc:
      'Dùng domain của shop (vd. shop.188.com.vn) thay link nanoai.vn — khách thấy HTTPS trên tên miền của bạn.',
    customDomainGuideTitle: 'Hướng dẫn gắn tên miền riêng',
    customDomainGuideBody:
      'Sau khi cấu hình, chat tư vấn và website shop có thể mở trên domain của bạn với chứng chỉ SSL do nền tảng cấp tự động (không cần tự mua cert).',
    customDomainStep1: 'Bước 1 — Nhập hostname (không gõ https://), chọn dùng cho chat và/hoặc website shop, bấm Lưu.',
    customDomainStep2:
      'Bước 2 — Vào nhà cung cấp domain (Cloudflare, GoDaddy, tenten…): CNAME www (hoặc subdomain) tới {target}. Tên miền gốc không www (vd. tiemanhai.vn) thêm bản ghi A trỏ IP VPS.',
    customDomainStep3:
      'Bước 3 — Chờ DNS cập nhật (5–30 phút, đôi khi đến 24h), quay lại đây bấm «Kiểm tra DNS & SSL».',
    customDomainStep4:
      'Bước 4 — Khi trạng thái «SSL đang hoạt động», cập nhật link nhúng chat / marketing sang domain mới (xem ô xem trước bên dưới).',
    customDomainHostnameLabel: 'Hostname (tên miền shop)',
    customDomainHostnamePlaceholder: 'shop.example.com hoặc chat.188.com.vn',
    customDomainUseForChat: 'Dùng cho chat tư vấn (hosted + embed)',
    customDomainUseForSite: 'Dùng cho website shop (trang /site)',
    customDomainCnameTitle: 'Bản ghi DNS (CNAME)',
    customDomainCnameHint:
      'Tạo CNAME: hostname shop (thường www) → {target}. Tên miền gốc không www dùng bản ghi A ở ô bên dưới.',
    customDomainApexTitle: 'Bản ghi DNS gốc (A) — gõ không www cũng vào được',
    customDomainApexHint:
      'Tạo A record: tên miền gốc (@) → {ip}. Đây là URL SEO chính (https://tên-miền/). www sẽ chuyển 301 về bản không www. Không dùng CNAME ở root.',
    customDomainCopyApexIp: 'Sao chép IP',
    customDomainSslTitle: 'SSL (HTTPS)',
    customDomainSslHint:
      'NanoAI cấp HTTPS trên domain của bạn qua reverse proxy sau khi CNAME đúng. Khách luôn truy cập https:// — không cần cài Let\'s Encrypt trên server shop.',
    customDomainSaveButton: 'Lưu tên miền',
    customDomainVerifyButton: 'Kiểm tra DNS & SSL',
    customDomainRemoveButton: 'Gỡ tên miền',
    customDomainCopyTarget: 'Sao chép CNAME đích',
    customDomainCopyFailed: 'Không sao chép được.',
    customDomainStatusPending: 'Chờ DNS',
    customDomainStatusDnsOk: 'DNS OK · chờ SSL',
    customDomainStatusSslActive: 'SSL hoạt động',
    customDomainStatusError: 'Lỗi DNS/SSL',
    customDomainPreviewTitle: 'URL công khai trên domain riêng',
    customDomainPreviewChat: 'Chat tư vấn:',
    customDomainPreviewSite: 'Website shop:',
    customDomainPreviewPendingTitle: 'Link website (chờ DNS / SSL)',
    customDomainPreviewPendingHint:
      'Nút «Xem web» và link bên dưới dùng tên miền này. Trang chỉ mở được sau khi CNAME đúng và SSL hoạt động.',
    customDomainInvalidHostname: 'Tên miền không hợp lệ (không dùng nanoai.vn hoặc localhost).',
    customDomainHostnameTaken: 'Tên miền này đã được shop khác đăng ký.',
    customDomainSaveFailed: 'Không lưu được tên miền. Thử lại sau.',
    customDomainSavedOk: 'Đã lưu tên miền — hãy cấu hình CNAME rồi kiểm tra.',
    customDomainRemovedOk: 'Đã gỡ tên miền riêng.',
    shopSsoSectionTitle: 'Đăng nhập Google trên website shop',
    shopSsoSectionDesc:
      'Để trống «Website đăng nhập» → dùng tên miền riêng ở trên (sau khi SSL hoạt động). Điền URL nếu trang login nằm trên domain khác (vd. https://188.com.vn).',
    shopSsoLoginOriginLabel: 'Website đăng nhập (tuỳ chọn)',
    shopSsoLoginOriginPlaceholder: 'https://shop.example.com',
    shopSsoLoginPathLabel: 'Đường dẫn trang đăng nhập',
    shopSsoLoginPathPlaceholder: '/dang-nhap',
    shopSsoSaveButton: 'Lưu cấu hình đăng nhập',
    shopSsoSavedOk: 'Đã lưu cấu hình đăng nhập Google.',
    shopSsoInvalidOrigin: 'URL website đăng nhập không hợp lệ.',
    customDomainVerifyOk: 'DNS và SSL đã sẵn sàng trên domain của bạn.',
    customDomainVerifyDnsFail: 'Chưa thấy CNAME hoặc A record đúng — kiểm tra lại DNS (www = CNAME, không www = A).',
    customDomainVerifySslPending: 'DNS đã đúng — SSL có thể cần thêm vài phút, thử lại sau.',
  },
  partnerMessagingOrders: {
    pageTitle: 'Quản lý đơn hàng',
    pageDescription: 'Quản lý và xử lý đơn hàng, đặt cọc',
    introLine:
      'Theo dõi đơn đã tạo trong khung chat, xác nhận thủ công khi cần và cập nhật trạng thái.',
    allWorkspaces: 'Tất cả workspace',
    allStatuses: 'Tất cả trạng thái',
    searchPlaceholder: 'Tìm theo mã đơn, tên, SĐT...',
    exportExcel: 'Xuất Excel',
    exportExcelTitle:
      'Xuất tất cả đơn khớp bộ lọc workspace + trạng thái + khoảng ngày (nếu chọn; không theo ô tìm kiếm nhanh).',
    reload: 'Làm mới',
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
    refundSectionTitle: 'Hoàn tiền',
    refundAmountLabel: 'Số tiền hoàn (VND)',
    refundNoteLabel: 'Ghi chú hoàn tiền',
    btnMarkRefunded: 'Đánh dấu đã hoàn tiền',
    toastRefundUpdated: 'Đã cập nhật hoàn tiền và thông báo về chat.',
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
    tableColConsultedShort: 'Tư vấn',
    tableColCustomer: 'Khách hàng',
    tableColSubtotal: 'Tổng tiền',
    tableColDepositRequired: 'Tiền cọc cần thu',
    tableColPaidAmount: 'Đã thanh toán',
    tableColDueOnDelivery: 'Số tiền cần thanh toán khi nhận hàng',
    tableColDueOnDeliveryShort: 'Còn thu khi nhận',
    tableHScrollAria: 'Cuộn ngang danh sách đơn hàng',
    tableColStatus: 'Trạng thái',
    tableColOrderDate: 'Ngày đặt',
    tableColActions: 'Thao tác',
    filterShippingLabel: 'Tất cả trạng thái',
    filterPaymentShort: 'TT thanh toán',
    clearTableFilters: 'Xóa bộ lọc',
    consultedAria: 'Đã liên hệ tư vấn (lưu trên cửa hàng)',
    reviewedAria: 'Khách đã đánh giá (lưu trên trình duyệt này)',
    expandRow: 'Mở rộng',
    collapseRow: 'Thu gọn',
    listCapNote: 'Danh sách tối đa 200 đơn mới nhất theo bộ lọc ngày / workspace.',
    consultLocalHint: 'Ghi trên cửa hàng, đồng bộ mọi máy nhân viên.',
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
    kpiTodayRevenue: 'Doanh thu hôm nay',
    kpiWaitingDeposit: 'Chờ đặt cọc',
    kpiDepositedOrders: 'Số đơn đã cọc',
    kpiDepositedRevenue: 'Doanh thu đơn đã cọc',
    kpiDepositCollected: 'Cọc đã thu',
    kpiShippingNow: 'Đang giao hàng',
    depositPercentStatsTitle: 'Thống kê % đặt cọc',
    depositPercentStatsHint: 'Số đơn theo mức cọc khách chọn (0% là không cọc). Cùng kỳ với báo cáo doanh thu.',
    depositPercentColShare: 'Tỷ lệ đơn',
    revenueReportTitle: 'Báo cáo doanh thu',
    revenueReportDesc: 'Tổng doanh thu và số đơn theo ngày, tuần, tháng, năm hoặc khoảng ngày. Đơn trùng cùng khách, cùng tiền và cùng hàng chỉ tính một lần; trong nhóm trùng thì chỉ tính đơn đã đặt cọc.',
    revenueModeDay: 'Theo ngày',
    revenueModeWeek: 'Theo tuần',
    revenueModeMonth: 'Theo tháng',
    revenueModeYear: 'Theo năm',
    revenueModeRange: 'Khoảng ngày',
    revenuePickDay: 'Chọn ngày',
    revenueToday: 'Hôm nay',
    revenueThisWeek: 'Tuần này',
    revenueLastWeek: 'Tuần trước',
    revenueThisMonth: 'Tháng này',
    revenueLastMonth: 'Tháng trước',
    revenuePickMonth: 'Chọn tháng',
    revenueViewMonth: 'Xem tháng',
    revenueYear: 'Năm',
    revenueViewYear: 'Xem theo năm',
    revenueViewRange: 'Xem khoảng ngày',
    revenuePeriod: 'Kỳ báo cáo',
    revenueAmount: 'Doanh thu',
    revenueOrderCount: 'Số đơn hàng',
    revenueCancelledReturned: '{cancelled} hủy · {returned} hoàn',
    revenueLoading: 'Đang tải báo cáo…',
    revenuePickPeriod: 'Chọn kỳ để xem báo cáo.',
    revenueNeedDay: 'Chọn ngày hoặc bấm «Hôm nay».',
    revenueNeedWeek: 'Chọn «Tuần này» hoặc «Tuần trước».',
    revenueNeedMonth: 'Chọn tháng hoặc bấm «Tháng này» / «Tháng trước».',
    revenueNeedYear: 'Năm không hợp lệ.',
    revenueNeedRange: 'Chọn ít nhất ngày bắt đầu.',
    revenueInvalidMonth: 'Tháng không hợp lệ.',
    revenueInvalidYear: 'Năm không hợp lệ.',
    revenueLoadError: 'Không tải được báo cáo doanh thu',
    tabReturned: 'Đơn hoàn đã trả shop',
    tableColDeposit: 'Đặt cọc',
    tableColPayment: 'Thanh toán',
    depositNeed: 'Cần',
    depositPaid: 'Đã cọc',
    depositNotRequired: 'Không cần cọc',
    pageSize25: '25 / trang',
    pageSize50: '50 / trang',
    pageSize100: '100 / trang',
    pageSizeAria: 'Số đơn mỗi trang',
    paginationSummary: 'Hiển thị {from}–{to} / {total} đơn · Trang {page} / {pages}',
    paginationSearchHint: ' · tra «{q}»',
    paginationFirst: 'Đầu',
    paginationPrev: 'Trước',
    paginationNext: 'Sau',
    paginationLast: 'Cuối',
    loadingOrders: 'Đang tải...',
    filterPayFailed: 'Thanh toán thất bại',
    confirmDepositTitle: 'Xác nhận đặt cọc',
    confirmDepositBody: 'Đơn {code}.',
    confirmDepositNoTxn: 'Chưa có giao dịch cọc.',
    confirmDepositManualHint: 'Nhập đúng số khách đã chuyển (số bất kỳ). Còn thu khi nhận hàng = tổng đơn trừ số đã cọc, không trừ theo % cọc.',
    confirmDepositReceivedLabel: 'Số tiền đã nhận cọc',
    confirmDepositReceivedHint: 'Không bắt buộc đúng số % cọc trên web. Nhập số thực đã nhận.',
    confirmDepositRemainingPreview: 'Còn thu khi nhận hàng: {amount}',
    confirmDepositRemainingFormula: '{total} − {paid} = {remaining}',
    confirmDepositAmountRequired: 'Nhập số tiền đã nhận cọc.',
    confirmDepositNoteLabel: 'Ghi chú',
    confirmDepositNotePlaceholder: 'Ghi chú...',
    btnRejectDeposit: 'Từ chối cọc',
    btnConfirmDepositReceived: 'Xác nhận đã nhận cọc',
    btnCancelModal: 'Hủy',
    btnMarkShipping: 'Chuyển đang giao (thủ công)',
    btnComplete: 'Hoàn thành',
    btnApproveReturn: 'Xác nhận đơn hoàn đã trả shop',
    btnRefundDeposit: 'Duyệt hoàn cọc',
    btnClose: 'Đóng',
    noAddress: 'Chưa có địa chỉ',
    customerCodeLabel: 'Mã đơn (hiển thị khách)',
    internalIdLabel: 'ID đơn nội bộ: #{id}',
    paymentWhenReceive: 'Số tiền thanh toán khi nhận hàng',
    colQty: 'SL',
    colUnitPrice: 'Đơn giá',
    colLineTotal: 'Thành tiền',
    skuLabel: 'Mã SP (SKU): {sku}',
    modalImageLink: 'Link ảnh',
    modalChinaLink: 'Link Trung Quốc',
    modalShopLink: 'Link shop',
    modalNoShopSlug: 'Không có slug — không tạo link trang SP',
    modalOpenVariantImage: 'Mở ảnh biến thể',
    timelineHeading: 'Lịch trình đơn hàng',
    timelineEmpty: 'Chưa có lịch trình.',
    filterFulfillmentAll: 'Mọi nguồn',
    filterFulfillmentVietnam: 'Việt Nam',
    filterFulfillmentChina: 'Trung Quốc',
    filterFulfillmentChinaNoDeposit: 'TQ không cọc',
    filterFulfillmentNeedsReview: 'Cần rà nguồn',
    badgeVietnam: 'VN',
    badgeChina: 'TQ',
    badgeNeedsReview: 'Rà nguồn',
    badgeSla4h: 'SLA 4h',
    badgeSla24h: 'SLA 24h',
    badgeDepositException: 'Ngoại lệ cọc',
    siblingOrdersLabel: 'Mã nhóm',
    btnClearCustoms: 'Thông quan',
    btnStartVnPacking: 'Bắt đầu soạn hàng',
    btnMarkOutForConfirm: 'Gửi shipper / chờ nhận',
    shipmentTrackingLabel: 'Mã vận đơn',
    shipmentProviderLabel: 'Hãng',
    emsLatestLabel: 'EMS',
    shipmentWaitingLabel: 'Đang chờ: {step} · {actor}',
    shipmentActorSystem: 'Hệ thống',
    shipmentActorSeller: 'Shop',
    shipmentActorCarrier: 'Hãng vận chuyển',
    shipmentActorBuyer: 'Khách mua',
    shipmentCarrierMeta: 'Nguồn hãng: {source} · {time}',
    shipmentStepConfirmed: 'Đã xác nhận đơn',
    shipmentStepChinaPreparing: 'Chuẩn bị hàng tại Trung Quốc',
    shipmentStepChinaWarehouse: 'Hàng về kho Trung Quốc',
    shipmentStepInternational: 'Vận chuyển quốc tế',
    shipmentStepCustoms: 'Thông quan',
    shipmentStepDomestic: 'Vận chuyển về shop',
    shipmentStepVietnamPicking: 'Lấy hàng / kiểm kho',
    shipmentStepVietnamPacked: 'Đóng gói',
    shipmentStepAwaitingBuyer: 'Chờ khách xác nhận nhận hàng',
  },
  partnerMessagingAnalytics: {
    pageTitle: 'Doanh thu & Chuyển đổi',
    pageDescription: 'Theo dõi doanh thu, tỉ lệ chuyển đổi và hiệu quả nguồn khách theo UTM.',
    allWorkspaces: 'Tất cả workspace',
    dateFrom: 'Từ ngày',
    dateTo: 'Đến ngày',
    applyFilter: 'Áp dụng',
    statRevenue: 'Doanh thu',
    statRevenueHint: 'Đơn đã xác nhận thanh toán + đã giao thành công',
    statOrders: 'Đơn hàng',
    statOrdersHint: 'Tổng số đơn trong khoảng thời gian',
    statAvgOrderValue: 'Giá trị đơn trung bình',
    statVisitors: 'Khách truy cập (ước tính)',
    statVisitorsHint: 'Số khách vãng lai ghi nhận được — không phải số liệu tuyệt đối chính xác',
    statConversionRate: 'Tỉ lệ chuyển đổi (ước tính)',
    revenueByDayTitle: 'Doanh thu theo ngày',
    revenueByUtmTitle: 'Doanh thu theo nguồn (UTM)',
    utmSourceColumn: 'Nguồn',
    utmCampaignColumn: 'Chiến dịch',
    topProductsTitle: 'Sản phẩm bán chạy',
    productColumn: 'Sản phẩm',
    quantityColumn: 'Số lượng',
    revenueColumn: 'Doanh thu',
    ordersColumn: 'Đơn',
    noData: 'Chưa có dữ liệu trong khoảng thời gian này.',
  },
  partnerMessagingMarketing: {
    pageTitle: 'Marketing remarketing',
    pageDescription:
      'Gửi tin ưu đãi trong hội thoại widget cho khách đã từng nhắn tin — an toàn, có giới hạn tần suất.',
    workspaceLabel: 'Chọn workspace',
    safeModeNote:
      'Chỉ gửi trong chat widget tới khách đã tương tác (≤90 ngày hoặc có đơn). Tối đa 1 campaign / 14 ngày / khách. Không dùng AI viết lại toàn bộ nội dung.',
    stepAudience: '1. Đối tượng',
    audienceHint: 'Preset: khách đã chat widget trong 90 ngày gần nhất (hoặc có đơn hàng) và có email.',
    segmentPresetLabel: 'Preset',
    segmentChat90d: 'Đã chat 90 ngày · có email',
    recipientCount: '{count} khách có email đủ điều kiện',
    loadingCount: 'Đang đếm…',
    refreshPreview: 'Làm mới xem trước',
    stepContent: '2. Nội dung',
    contentHint: 'Template + biến cá nhân hóa (tên, SP quan tâm, ưu đãi). Mỗi khách nhận nội dung khác nhau nhờ merge field.',
    offerPercentLabel: '% giảm (tùy chọn)',
    templateLabel: 'Nội dung tin chat',
    mergeFieldsLabel: 'Biến hỗ trợ',
    personalizationNote:
      'Không cần AI viết từng tin — hệ thống điền tên, sản phẩm đã xem và ưu đãi theo dữ liệu thật của từng khách.',
    channelEmailLabel: 'Gửi kèm email nhắc (khi khách offline)',
    channelEmailHint:
      'Chỉ gửi email cho khách đang không mở chat, có email, chưa hủy nhận. Email kèm ảnh + link sản phẩm quan tâm, nút mở lại chat, và link hủy nhận. Tối đa 1 email / khách / 7 ngày.',
    emailIntroLabel: 'Câu mở đầu email (tùy chọn)',
    emailIntroPlaceholder: 'Ví dụ: Shop thấy bạn đang quan tâm vài mẫu, nhắn lại để được tư vấn nhé.',
    emailStatsLabel: 'Đã gửi email: {sentEmail}',
    testOptOutTitle: 'Kiểm tra & Hủy nhận',
    optOutCountLabel: 'Khách đã hủy nhận email: {count}',
    testEmailLabel: 'Gửi email thử tới',
    testEmailPlaceholder: 'email@noi-bo.com',
    sendTestButton: 'Gửi email thử',
    testEmailSent: 'Đã gửi email thử tới {to}.',
    testEmailInvalid: 'Email không hợp lệ.',
    testEmailNotCustomer: 'Email này chưa từng nhắn tin với shop nên không gửi thử được. Hãy nhập email của một khách đã chat.',
    smtpNotConfigured: 'Chưa cấu hình SMTP trên máy chủ.',
    stepSend: '3. Gửi',
    sendHint: 'Tin được đưa vào hàng đợi; cron gửi ~1 khách / 2 giây. Chat là kênh chính, email chỉ là kênh phụ khi khách offline.',
    sendButton: 'Gửi campaign',
    saveDraft: 'Lưu nháp',
    queueSuccessTitle: 'Đã xếp hàng gửi',
    queueSuccessDescription: '{count} khách trong hàng đợi. Tiến trình cập nhật khi cron chạy.',
    noRecipients: 'Không có khách có email đủ điều kiện trong segment.',
    draftSaved: 'Đã lưu nháp.',
    cancelled: 'Đã hủy campaign.',
    campaignHistory: 'Lịch sử campaign',
    campaignHistoryHint: 'Theo dõi trạng thái và log từng người nhận.',
    reload: 'Tải lại',
    noCampaigns: 'Chưa có campaign nào.',
    statsLine: 'Hàng đợi: {queued} · Đã gửi chat: {sent} · Bỏ qua: {skipped} · Lỗi: {failed}',
    viewLog: 'Xem log',
    cancelCampaign: 'Hủy',
    deliveryLog: 'Log gửi',
    colRecipient: 'Người nhận',
    colStatus: 'Trạng thái',
    colReason: 'Lý do',
    viewAllRecipients: 'Xem danh sách tất cả ({count})',
    recipientListTitle: 'Danh sách khách đủ điều kiện',
    colName: 'Tên',
    colEmail: 'Email',
    colLastChat: 'Chat gần nhất',
    sendLimitsThisMonth:
      'Tháng này: đã gửi {emailsSent} email, {chatSent} tin chat. Giới hạn mỗi khách: 1 email / {emailDays} ngày (~{emailPerMonth} email/tháng), 1 tin chat / {chatDays} ngày.',
    exportCustomerEmailsExcel: 'Xuất Excel',
    exportCustomerEmailsCsv: 'Xuất CSV',
    exportCustomerEmailsHint:
      'Xuất toàn bộ khách đã nhắn tin widget với shop và có email (không giới hạn 90 ngày).',
    exportCustomerEmailsEmpty: 'Không có khách nào có email để xuất.',
    exportCustomerEmailsDone: 'Đã xuất {count} khách → {filename}',
    exportCustomerEmailsLoading: 'Đang xuất…',
    noWorkspace: 'Chưa có workspace. Tạo workspace trong Cài đặt nhắn tin.',
  },
  partnerMessagingNotifications: {
    pageTitle: 'Thông báo khách hàng',
    pageDescription: 'Tạo thông báo trong tài khoản shop, gửi email và Web Push — giống 188.com.vn.',
    workspaceLabel: 'Chọn workspace',
    composeTitle: 'Tạo thông báo',
    composeHint: 'Gửi tới mọi khách đã có tài khoản shop. Thông báo hiện trong Trung tâm thông báo, có thể gửi kèm email, và đẩy ra trình duyệt nếu khách đã bật.',
    titleLabel: 'Tiêu đề',
    bodyLabel: 'Nội dung',
    scheduleLabel: 'Thời điểm gửi',
    expireHint: 'Thông báo tự xóa sau 15 ngày kể từ thời điểm gửi.',
    sendEmailLabel: 'Gửi kèm email cho khách có địa chỉ email',
    pushHint: 'Khách đã bật thông báo trình duyệt sẽ nhận Web Push khi đến giờ gửi (không gửi sớm nếu hẹn lịch).',
    smtpMissing: 'Chưa cấu hình SMTP trên máy chủ — vẫn tạo thông báo trong app.',
    audienceCount: '{count} khách có tài khoản shop',
    sendButton: 'Tạo và gửi',
    sending: 'Đang gửi…',
    composeSuccess: 'Đã tạo thông báo.',
    importTitle: 'Import thông báo từ Excel/CSV',
    importHint: 'Mỗi dòng một khách — tìm theo số điện thoại hoặc email đã đăng ký shop.',
    colPhone: 'Cột 1: phone (Số điện thoại)',
    colTitle: 'Cột 2: title (Tiêu đề)',
    colContent: 'Cột 3: content (Nội dung)',
    colTime: 'Cột 4: time_will_send (Thời gian gửi: dd/mm/yyyy HH:MM:SS)',
    colEmailOptional: 'Cột 5 (tuỳ chọn): email — dùng khi không có số điện thoại',
    downloadTemplate: 'Tải file mẫu',
    importButton: 'Upload và Import',
    importing: 'Đang xử lý…',
    importSuccess: 'Đã import thông báo.',
    resultTitle: 'Kết quả Import:',
    resultTotal: 'Tổng số dòng',
    resultSuccess: 'Thành công',
    resultError: 'Lỗi',
    resultEmail: 'Đã gửi email',
    historyTitle: 'Lịch sử gửi',
    historyEmpty: 'Chưa có đợt gửi nào.',
    historyWhen: 'Thời điểm',
    historySource: 'Nguồn',
    sourceCompose: 'Soạn tay',
    sourceImport: 'Excel/CSV',
    noWorkspace: 'Chưa có workspace shop. Tạo workspace trong Quản trị.',
    errorGeneric: 'Không gửi được thông báo.',
    errorMissingFile: 'Chưa chọn file.',
    errorInvalidFile: 'Định dạng file không hợp lệ. Hãy tải Excel hoặc CSV.',
    errorReadFile: 'Không đọc được file.',
    errorMissingColumns: 'Thiếu cột: phone, title, content, time_will_send.',
    errorEmptySheet: 'File không có dòng dữ liệu.',
    errorNoRecipients: 'Chưa có khách có tài khoản shop.',
    errorInvalidSchedule: 'Thời điểm gửi không hợp lệ.',
  },
  partnerMessagingEmail: {
    pageTitle: 'Quản lý gửi email',
    pageDescription: 'Warmup SMTP, email sinh nhật / giỏ / quay lại, danh sách nhận tin và gửi chiến dịch — cùng engine mọi shop.',
    tabManage: 'Quản lý gửi',
    tabList: 'Danh sách email',
    warmupTitle: 'Warmup gửi email',
    warmupHint: 'Giới hạn số mail mỗi ngày theo shop, tăng dần để bảo vệ SMTP. CMSN được ưu tiên trong hạn mức.',
    warmupEnabled: 'Bật warmup',
    startLimit: 'Hạn mức ngày 1',
    dailyIncrement: 'Tăng mỗi ngày',
    maxLimit: 'Trần tối đa',
    maxLimitHint: 'Để trống = không trần.',
    saveSettings: 'Lưu cài đặt',
    saving: 'Đang lưu…',
    saved: 'Đã lưu cài đặt email.',
    smtpMissing: 'Chưa cấu hình SMTP trên máy chủ — không gửi được email.',
    statsTitle: 'Hôm nay',
    warmupDay: 'Ngày warmup',
    dailyLimit: 'Hạn mức hôm nay',
    sentToday: 'Đã gửi',
    birthdayToday: 'Sinh nhật',
    marketingToday: 'Marketing',
    remainingToday: 'Còn lại',
    unlimited: 'Không giới hạn',
    birthdayAllTime: 'CMSN đã gửi (mọi thời điểm)',
    activeSubscribers: 'Đang nhận tin',
    cronTitle: 'Cron sinh nhật T-7',
    birthdayCron: 'Cho phép cron gửi mail CMSN',
    runBirthdayNow: 'Chạy batch CMSN ngay',
    runningBirthday: 'Đang chạy…',
    birthdayRunOk: 'Đã gửi {sent}, bỏ qua {skipped}, hết hạn mức {deferred}.',
    channelsTitle: 'Kênh email tự động',
    cartEmail: 'Email bỏ giỏ',
    comebackEmail: 'Email quay lại',
    newsletterWelcome: 'Email chào khi đăng ký nhận tin',
    testTitle: 'Gửi thử',
    testEmail: 'Email nhận thử',
    testKind: 'Loại mail',
    testBirthday: 'Sinh nhật',
    testCart: 'Bỏ giỏ',
    testComeback: 'Quay lại',
    testNewsletter: 'Chào nhận tin',
    testBroadcast: 'Chiến dịch (dùng ô soạn bên tab Danh sách)',
    sendTest: 'Gửi thử',
    testOk: 'Đã gửi mail thử.',
    logTitle: 'Log gửi gần đây',
    logEmpty: 'Chưa có log.',
    logWhen: 'Thời điểm',
    logKind: 'Loại',
    logTo: 'Đến',
    logStatus: 'Trạng thái',
    logSubject: 'Tiêu đề',
    subscribersTitle: 'Người nhận tin',
    searchPlaceholder: 'Tìm email / tên',
    filterAll: 'Tất cả',
    filterActive: 'Đang nhận',
    filterInactive: 'Đã hủy',
    importTitle: 'Import email',
    importHint: 'Mỗi dòng một email. Tự sửa gmail.con / gmial.com. File txt hoặc CSV cột đầu là email.',
    importTextPlaceholder: 'email1@gmail.com\nemail2@yahoo.com',
    importFile: 'Hoặc chọn file',
    importButton: 'Import',
    importing: 'Đang import…',
    importResult: 'Hợp lệ {parsed}: thêm {created}, kích hoạt lại {reactivated}, đã có {skipped}. Sửa gõ nhầm {corrected}. Không hợp lệ {invalid}. Trùng trong file {dup}.',
    exportCsv: 'Xuất CSV',
    composeTitle: 'Gửi chiến dịch',
    composeHint: 'Gửi tới mọi email đang nhận tin. Tôn trọng warmup và hủy nhận.',
    subjectLabel: 'Tiêu đề',
    bodyLabel: 'Nội dung',
    sendBroadcast: 'Gửi tới danh sách',
    confirmBroadcast: 'Gửi tới {count} email đang nhận tin?',
    broadcasting: 'Đang gửi…',
    broadcastOk: 'Đã gửi {sent}, bỏ qua {skipped}, lỗi {failed}.',
    noWorkspace: 'Chưa chọn workspace.',
    errorGeneric: 'Không thực hiện được.',
    errorSmtp: 'Chưa cấu hình SMTP.',
    errorWarmup: 'Hết hạn mức warmup hôm nay.',
    errorInvalidEmail: 'Email không hợp lệ.',
    statusSent: 'Đã gửi',
    statusFailed: 'Lỗi',
    statusSkipped: 'Bỏ qua',
    colEmail: 'Email',
    colName: 'Tên',
    colSource: 'Nguồn',
    colStatus: 'Trạng thái',
    colWhen: 'Đăng ký',
    unsubscribe: 'Hủy nhận',
    active: 'Đang nhận',
    inactive: 'Đã hủy',
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
    usageRangeModeCalendar: 'Chọn ngày (giờ Việt Nam)',
    usageCalendarFromLabel: 'Từ ngày',
    usageCalendarToLabel: 'Đến ngày',
    usagePeriodScopeCalendar: 'từ {from} đến {to} (giờ Việt Nam, cả hai ngày tính trọn)',
    usagePresetToday: 'Hôm nay',
    usagePresetYesterday: 'Hôm qua',
    usagePresetThisWeek: 'Tuần này',
    usagePresetLastWeek: 'Tuần trước',
    usagePresetThisMonth: 'Tháng này',
    usagePresetLastMonth: 'Tháng trước',
    usagePresetYear: 'Năm nay',
    usagePresetAll: 'Tất cả',
    usageCreditHeroKicker: 'Đã trừ credit',
    usageCreditHeroHint:
      'Credit đã trừ trên ví chủ shop (giáo trình, English coach…) và logo. Không phải tiền gọi API.',
    usageApiHeroKicker: 'API chưa trừ credit',
    usageApiHeroHint:
      'Ước tính tiền nhà cung cấp (₫) cho LLM, tạo ảnh và embedding. Shop không bị trừ ví cho các lần gọi này.',
    usageApiEmbedImageLine: 'Embedding ảnh',
    usageApiEmbedTextLine: 'Embedding chữ',
    usageApiModelTableNote:
      'Bảng model bên dưới là LLM và tạo ảnh. Embedding được cộng vào tổng API phía trên, không nằm trong bảng đó.',
    usageColYear: 'Năm',
    usageCreditTypeFromImage: 'Giáo trình — tạo từ ảnh',
    usageCreditTypeSlideVerify: 'Giáo trình — kiểm tra đề xuất slide',
    usageCreditTypeLessonSlides: 'Giáo trình — tạo slide tiết',
    usageCreditTypeInfographic: 'Giáo trình — infographic',
    usageCreditTypeMonthlyCurriculum: 'Gói tháng — giáo trình',
    usageCreditTypeEnglishLiveStart: 'Học ngoại ngữ — bắt đầu live',
    usageCreditTypeEnglishLiveUnlock: 'Học ngoại ngữ — mở thêm lượt live',
    usageCreditTypeEnglishPreset: 'Học ngoại ngữ — bài có sẵn',
    usageSectionCreditTitle: 'Trừ credit (ví & logo workspace)',
    usageSectionCreditIntro:
      'Các khoản đã trừ số dư trên tài khoản: nhật ký ví (giáo trình, English coach, …) và phí chuẩn hóa logo shop — khác với nhóm chỉ ghi nhận token API phía dưới.',
    usageSectionApiTitle: 'Gọi API (token / ảnh / embedding)',
    usageSectionApiIntro:
      'LLM inbox, tạo ảnh Nano Banana, embedding ảnh/văn bản, suy chất liệu từ ảnh sản phẩm… — thống kê theo usage đã ghi, không đi qua ví như phần trên.',
    tokenUsageIntro:
      'Khoảng {scope} (giờ Việt Nam). Thẻ vàng là credit đã trừ. Thẻ xanh là ước tính tiền API, shop không bị trừ ví.',
    tokenUsageEmpty: 'Chưa có lần gọi API nào trong khoảng này.',
    tokenUsageColProvider: 'Nhà cung cấp',
    tokenUsageColModel: 'Model',
    tokenUsageColCalls: 'Số lần gọi',
    tokenUsageColPrompt: 'Token đầu vào',
    tokenUsageColCompletion: 'Token đầu ra',
    tokenUsageColTotal: 'Tổng token',
    tokenUsageColEstimatedCost: 'Ước tính (₫)',
    tokenUsageCostDisclaimer:
      'Ước tính theo bảng giá Gemini, DeepSeek và OpenAI (USD/1M token). Dòng gom nhiều lần gọi dùng bậc thấp. Model chưa có trong bảng dùng gemini-3-flash-preview. Tỷ giá: env PARTNER_AI_TOKEN_COST_USD_TO_VND.',
    tokenUsageEstimatedTotalLabel: 'Tổng ước tính (khoảng {amount} ₫)',
    tokenUsageKpiAvg: 'Trung bình mỗi lần gọi',
    tokenUsageColShare: 'Tỷ lệ',
    tokenUsageDetailMismatchNote:
      'Cộng các dòng chi tiết đang hiện là {detailAmount}. Tổng kỳ là {periodAmount}. Bảng chi tiết chỉ giữ 250 lần gọi mới nhất.',
    tokenUsageDetailEstimatedTotalLabel: 'Cộng các dòng chi tiết (khoảng {amount} ₫)',
    tokenUsageByKindTitle: 'Theo loại gọi (usage_kind)',
    tokenUsageByKindIntro:
      'Gom tất cả lần ghi token LLM: inbox (job hội thoại), suy chất liệu, tạo ảnh inbox, v.v.',
    tokenUsageByDayTitle: 'Theo ngày (giờ Việt Nam)',
    tokenUsageByDayIntro: 'Tổng token và số lần gọi từng ngày theo lịch giờ Việt Nam.',
    tokenUsageColDay: 'Ngày',
    tokenUsageCostByKindAndModelTitle: 'Chi tiết theo nhánh và model',
    tokenUsageCostByKindAndModelIntro:
      'Mỗi dòng là một cặp usage_kind + model; chi phí ước tính (₫) cộng từ token đã gom.',
    tokenUsageCostByWeekTitle: 'Theo tuần (từ thứ Hai)',
    tokenUsageCostByWeekIntro:
      'Gộp các ngày trong khoảng đã chọn theo tuần lịch giờ Việt Nam (tuần bắt đầu thứ Hai).',
    tokenUsageColWeekStart: 'Tuần từ',
    tokenUsageCostByMonthTitle: 'Theo tháng',
    tokenUsageCostByMonthIntro: 'Gộp theo tháng lịch giờ Việt Nam (YYYY-MM) trong khoảng đã chọn.',
    tokenUsageColMonthUtc: 'Tháng',
    tokenUsageCostTablesNote:
      'Có thêm cột chi phí ước tính (₫) theo nhánh, ngày, tuần và tháng; cùng cách tính với tổng kỳ.',
    usageSliceOverview: 'Theo việc',
    usageSliceTime: 'Theo thời gian',
    usageSliceCalls: 'Từng lần gọi',
    usageSliceMedia: 'Ảnh và embedding',
    usageDetailApiTitle: 'Chi tiết từng lần gọi',
    usageDetailApiIntro:
      'Mỗi dòng là một lần gọi đã ghi — hội thoại, suy chất liệu hoặc tạo ảnh. Bảng giữ 250 lần mới nhất.',
    usageDetailColTime: 'Thời điểm',
    usageDetailColUsageKind: 'Nhánh',
    usageTokenKindInbox: 'LLM hội thoại',
    usageTokenKindMaterialInfer: 'Suy chất liệu (ảnh SP)',
    usageTokenKindLandingImage: 'Ảnh chất liệu landing',
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
    usageLogoCreditCappedNote:
      'Bảng dưới là các lần gần nhất. Số trên thẻ vàng là tổng đủ trong khoảng đang xem.',
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
      'Nano Banana là lối gọi nội bộ cho pipeline Gemini tạo ảnh (model gemini-3-pro-image). Cả hai nhánh — ảnh chi tiết chất liệu/màu và ảnh thực tế / đời thường — đều lấy một ảnh sản phẩm trong kho làm đầu vào và model sinh một ảnh mới từ ảnh đó (không chỉ tái dùng file gốc). Mỗi lần gọi API sinh ảnh mới và lưu URL vào kho — cùng khoảng thời gian với bảng token LLM phía trên. Ảnh đã cache trong kho không tạo lại nên không tính thêm.',
    usageImageGenEmpty: 'Chưa có lượt tạo ảnh Nano Banana ghi nhận trong khoảng này.',
    usageImageGenColKind: 'Loại ảnh',
    usageImageGenKindMaterial: 'Chi tiết chất liệu / màu',
    usageImageGenKindRealUse: 'Ảnh thực tế / feedback khách',
    usageImageGenColCalls: 'Số lần gọi API',
    usageImageGenColTotalTokens: 'Tổng token (ước lượng billable)',
    usageImageGenTotalCallsLabel: 'Tổng lượt tạo ảnh (Nano Banana)',
    usageNanoBananaBadge: 'Nano Banana',
    usageNanoBananaModelHint: 'gemini-3-pro-image · inbox',
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
      'AI luôn đọc ô này + Cài đặt thanh toán (có cọc hay không, %). Ghi thời gian giao sau khi shop gửi, đổi trả, giọng điệu, cách chốt. Không bịa % cọc của shop khác.',
    productConsultationContextPlaceholder:
      'Ví dụ: giọng lịch sự, xưng em — anh/chị. Hàng thường giao 7–12 ngày sau khi shop gửi. Đổi size 1 lần nếu không vừa số đo. Shop không cọc thì ghi rõ; nếu có cọc thì khớp Cài đặt thanh toán. Hàng sale không đổi trả…',
    afterSalesReturnAddressLabel: 'Địa chỉ nhận hàng hoàn / đổi size / trả hàng',
    afterSalesReturnAddressHint:
      'Địa chỉ shop nhận khi khách gửi hàng hoàn, đổi size hoặc trả hàng. AI sẽ gửi địa chỉ này trong chat hậu mãi. Để trống thì AI vẫn hướng dẫn quy trình, không tự bịa địa chỉ.',
    afterSalesReturnAddressPlaceholder:
      'Ví dụ: 188 Fashion — số …, phường …, quận …, Hà Nội. SĐT nhận hàng: …',
    shippingLookupTitle: 'Cổng API tra cứu vận chuyển (web shop)',
    shippingLookupHint:
      'NanoAI gọi API này từ máy chủ (không lộ key) khi khách gửi mã đơn, SĐT hoặc mã vận. Điền URL + key shop cấp. Xem hướng dẫn tích hợp để web shop triển khai cùng contract.',
    shippingLookupUrlLabel: 'URL tra cứu vận chuyển',
    shippingLookupUrlPlaceholder: 'https://188.com.vn/api/v1/shipping/lookup',
    shippingLookupKeyLabel: 'API key (shop cấp cho NanoAI)',
    shippingLookupKeyHint:
      'Header X-Api-Key hoặc Authorization Bearer. Để trống khi lưu nếu đã có key. Không đưa key vào frontend public.',
    shippingLookupKeyPlaceholder: 'Dán key mới — để trống để giữ key đã lưu',
    shippingLookupKeyConfigured: 'Đã lưu API key.',
    shippingLookupKeyMissing: 'Chưa có API key.',
    shippingLookupTestButton: 'Thử kết nối',
    shippingLookupClearKey: 'Xóa key',
    shippingLookupGuideLink: 'Hướng dẫn tích hợp cổng vận chuyển',
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
    inventoryDesc: 'Size (JSON)',
    inventoryStock: 'Màu sắc (JSON)',
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
    inventoryListCount: '{n} sản phẩm trong danh sách',
    inventoryListScrollHint: '↔ Cuộn ngang để xem đủ cột',
    inventoryColId: 'ID',
    inventoryColWeb: 'Web',
    inventoryColMainImage: 'Ảnh đại diện',
    inventoryColGallery: 'Thư viện ảnh',
    inventoryColDetailImages: 'Ảnh chi tiết SP',
    inventoryColSlug: 'Slug',
    inventoryColBrand: 'Thương hiệu',
    inventoryColQty: 'Tồn',
    inventoryColStatus: 'Trạng thái',
    inventoryColSourceStock: 'Nguồn hàng',
    inventoryColImageI18n: 'Ảnh i18n',
    inventoryColActions: 'Thao tác',
    inventoryDeleteSelected: 'Xóa ({n})',
    inventoryDeleteSelectedBusy: 'Đang xóa...',
    inventoryDeleteSelectedConfirm: 'Xóa {n} sản phẩm đang chọn?',
    inventoryDeleteSelectedOk: 'Đã xóa {n} sản phẩm',
    inventoryDeleteSelectedFailed: 'Không xóa được sản phẩm nào',
    inventoryStatusShown: 'Hiển thị',
    inventoryStatusHidden: 'Ẩn',
    inventoryViewWeb: 'Xem web',
    inventoryViewDetail: 'Chi tiết',
    inventoryDetailTitle: 'Chi tiết sản phẩm',
    inventoryDetailBack: 'Quay lại danh sách',
    inventoryDetailLoading: 'Đang tải thông tin sản phẩm…',
    inventoryDetailFailed: 'Không tải được thông tin sản phẩm.',
    inventoryDetailEmbeddingOmitted: 'Vector embedding ảnh và chữ được lưu trong kho nhưng không in ra trang này.',
    inventoryEmptyCell: '—',
    inventoryClearanceBadge: 'Kho thanh lý',
    inventoryGuestConsultLink: 'Mở chat tư vấn',
    inventoryGuestConsultLinkHint:
      'Link trang chat NanoAI kèm ảnh & ngữ cảnh mặt hàng (đặt vào website, QR, quảng cáo). Khách mở sẽ tự gửi tin tư vấn kèm ảnh.',
    inventoryGuestConsultLinkNeedSave: 'Lưu mặt hàng trước để có link chat đầy đủ.',
    inventoryGuestConsultLinkCopied: 'Đã copy link chat.',
    inventoryConsultNote: 'Ghi chú khi tư vấn',
    inventoryConsultNoteHint:
      'Mô tả ngắn hiển thị trên web shop + ghi chú AI tư vấn (bảo hành, giao hàng, KM…).',
    inventoryDescHint: 'JSON mảng size, vd: ["S","M","L","XL"] hoặc ["38","39","40"]. Dùng cho chọn size trên shop.',
    inventoryStockHint:
      'JSON mảng màu + ảnh, vd: [{"name":"Đen","img":"https://..."}]. Dùng cho chọn màu trên shop.',
    inventoryMaterialNote: 'Mô tả chi tiết sản phẩm',
    inventoryMaterialNoteHint:
      'Mô tả dài trên trang shop (nhiều đoạn, xuống dòng). Chất liệu, form, bảo quản, đi kèm…',
    inventoryMaterialDetailImageUrl: 'Ảnh chi tiết chất liệu (URL)',
    inventoryMaterialDetailImageUrlHint:
      'Ảnh cận cảnh vải, da, đế giày… Hiển thị trong gallery và mục ảnh chi tiết shop.',
    inventoryRealUseImageUrl: 'Ảnh thực tế 1 (URL)',
    inventoryRealUseImageUrlHint: 'Ảnh mặc / sử dụng thực tế — gallery shop.',
    inventoryRealUseImageUrl2: 'Ảnh thực tế 2 (URL)',
    inventoryRealUseImageUrl2Hint: 'Góc chụp lifestyle bổ sung — gallery shop.',
    inventoryRemarketingId: 'Id remarketing',
    inventoryRemarketingIdHint: 'Mã content/remarketing (Meta/Google) — dùng đồng bộ catalog và marketing.',
    inventoryFieldsGuide:
      'Trường shop web: Size/Màu (JSON), mô tả ngắn (ghi chú tư vấn), mô tả chi tiết, ảnh chính + ảnh chi tiết/thực tế, video. Mọi dòng trong danh sách kho đều được đưa vào ngữ cảnh AI; muốn AI không nhắc tới một mặt hàng thì xóa dòng đó hoặc bỏ khỏi file nhập Excel. File mẫu có cột «Trạng thái»: 1 = thêm/cập nhật, 0 = xóa (khớp Mã SKU hoặc tên).',
    inventoryOpenApiLink: 'Hướng dẫn tích hợp API',
    inventoryOpenApiHint:
      'Backend website shop có thể đẩy kho vào NanoAI bằng JSON (chuẩn Open Catalog, tên trường gần Shopee). Cùng khóa Bearer với API tìm ảnh; không cần Vision.',
    listingImportTitle: 'Cào listing Taobao / 1688',
    listingImportIntro:
      'Dán HTML listing Taobao/Tmall/1688 (cùng mặt admin 188), chọn dòng, lấy thông tin qua Vipomall/PandaMall, rồi đăng lên kho shop. Mọi workspace cùng một engine — không khóa slug 188.',
    listingImportCookieTitle: 'Cookie scrape + tài khoản PandaMall',
    listingImportCookieHint:
      'Dán JSON cookie Chrome (EditThisCookie / Cookie-Editor) khi đã đăng nhập vipomall.vn / pandamall.vn. Không dùng cookie shop NanoAI.',
    listingImportCookiePaste: 'JSON cookie',
    listingImportCookieSave: 'Lưu cookie',
    listingImportCookieClear: 'Xóa cookie workspace',
    listingImportPandamallUser: 'Tài khoản PandaMall',
    listingImportPandamallPass: 'Mật khẩu PandaMall',
    listingImportPandamallPassKeep: 'Để trống = giữ mật khẩu đã lưu',
    listingImportDraftEditHint: 'Sửa tên/danh mục trên modal này rồi đăng, hoặc dùng bảng Kho hàng bên dưới.',
    listingImportProductsButton: 'Chọn để đăng web…',
    listingImportProductsButtonBusy: 'Đang tải nháp…',
    listingImportProductsButtonTitle:
      'Mở danh sách nháp đã crawl xong — chọn rồi đăng lên cửa hàng (cùng luồng Import 1688).',
    listingImportProductsSubmit: 'Import {n} sản phẩm',
    listingImportProductsSubmitting: 'Đang import ({done}/{total})…',
    listingImportExcelButton: 'Import Excel dữ liệu SP',
    listingImportExcelButtonBusy: 'Đang import…',
    listingImportExcelButtonTitle:
      'Chọn file .xlsx dữ liệu sản phẩm (cùng mẫu «Tải Excel nhập web») để tạo/cập nhật sản phẩm trên web. Trùng id/SKU thì cập nhật; listed=0 thì xóa; không xóa hàng không có trong file.',
    listingImportExcelUploading: 'Đang tải file lên server…',
    listingImportExcelUploadingLarge: 'Đang tải file ({mb} MB)… File lớn có thể vài phút.',
    listingImportExcelUploadPct: 'Đang tải lên {pct}% ({loaded} / {total} MB)',
    listingImportExcelProcessing: 'Đã nhận file, đang xử lý trên server (file lớn có thể vài phút)…',
    listingImportExcelCancel: 'Hủy ngay',
    listingImportExcelCancelling: 'Đang hủy…',
    listingImportExcelHideTrack: 'Ẩn theo dõi',
    listingImportExcelClose: 'Đóng',
    listingImportExcelSuccess: 'Import xong: {inserted} mới, {updated} cập nhật, {skipped} bỏ qua (trùng mã 1688/Tmall){deleted}',
    listingImportExcelSuccessDeleted: ', {n} đã xóa',
    listingImportExcelFailedTitle: 'Import thất bại',
    listingImportExcelFailedToast: 'Import lỗi — xem chi tiết phía dưới ô Import.',
    listingImportExcelOkTitle: 'Import xong',
    listingImportExcelDoneTitle: 'Import xong — có cảnh báo',
    listingImportExcelWarnings: 'Có {n} dòng cần rà soát.',
    listingImportExcelCancelTitle: 'Import đã hủy',
    listingImportExcelCancelBody: 'Đã hủy lúc đang tải file. Các dòng chưa ghi thì không vào kho.',
    listingImportExcelCancelToast: 'Đã hủy import Excel.',
    sourceStockTitle: 'Kiểm tra nguồn hàng',
    sourceStockIntro:
      'Worker Vipomall → PandaMall → CSSBuy. Còn hàng hoặc hết hàng thì dừng. Chỉ Cloudflare/CAPTCHA mới chuyển nền. Cả ba bị chặn thì worker dừng và gửi email quản trị shop. Hết hàng khi bấm giỏ thấy nhãn ở vùng giá, hoặc PandaMall báo không tìm thấy sản phẩm. Trang chưa hiện giá, tên hoặc ảnh thì không gắn hết hàng. Hết hàng → tồn 0; về hàng sau OOS → 500.',
    sourceStockApiError: 'Lỗi API kiểm tra nguồn',
    sourceStockClose: 'Đóng',
    sourceStockDomainLabel: 'Lọc hàng đợi / báo cáo theo miền URL',
    sourceStockDomainCssbuy: 'CSSBuy (và 1688/Taobao quy đổi)',
    sourceStockDomainVipomall: 'Vipomall',
    sourceStockTestHeading: 'Thử URL (không ghi DB)',
    sourceStockTestHint: 'Dán 1688 / Taobao / Tmall / CSSBuy / Vipomall / PandaMall. Worker chạy Vipomall trước, rồi PandaMall, rồi CSSBuy. Chỉ Cloudflare mới chuyển nền.',
    sourceStockTestRunning: 'Đang mở Playwright…',
    sourceStockTestRun: 'Thử URL',
    sourceStockTestPlaceholder: 'https://detail.1688.com/offer/… hoặc cssbuy.com/item-…',
    sourceStockEligible: 'Đủ điều kiện worker',
    sourceStockIneligible: 'Không đủ điều kiện',
    sourceStockMerged: 'Kết luận',
    sourceStockWorkerHeading: 'Worker kiểm tra nguồn',
    sourceStockOn: 'bật',
    sourceStockOff: 'tắt',
    sourceStockPauseFlag: 'Pause DB',
    sourceStockDaemon: 'Daemon',
    sourceStockRunning: 'đang chạy',
    sourceStockIdle: 'đang nghỉ',
    sourceStockWorkerLoading: 'Đang đọc trạng thái worker…',
    sourceStockWriting: 'Đang ghi…',
    sourceStockPause: 'Tạm dừng',
    sourceStockResume: 'Tiếp tục',
    sourceStockPausedOk: 'Đã tạm dừng worker của workspace này.',
    sourceStockResumedOk: 'Đã tiếp tục worker của workspace này.',
    sourceStockChecking: 'Đang kiểm',
    sourceStockCheckingHint: 'SP Playwright đang mở.',
    sourceStockCheckingEmpty: 'Không có SP đang kiểm.',
    sourceStockLastDone: 'Vừa xong',
    sourceStockLastDoneHint: 'Lần commit kho gần nhất.',
    sourceStockLastDoneEmpty: 'Chưa có lần kiểm trong process này.',
    sourceStockUpcoming: 'Tiếp theo',
    sourceStockUpcomingHint: 'Ưu tiên RAM rồi hàng DB đến hạn.',
    sourceStockUpcomingEmpty: 'Hàng chờ trống hoặc đang pause.',
    sourceStockRefreshingQueue: 'Đang tải hàng đợi…',
    sourceStockRefreshQueue: 'Làm mới hàng đợi',
    sourceStockRefreshingReport: 'Đang tải báo cáo…',
    sourceStockRefreshReport: 'Làm mới báo cáo 30 ngày',
    sourceStockResetPdp: 'Reset chu kỳ PDP',
    sourceStockStatTotal: 'Trong phạm vi',
    sourceStockStatEligible: 'Đủ ĐK',
    sourceStockStatTraffic: 'Có PDP 30 ngày',
    sourceStockStatCooldown: 'TTL / cooldown',
    sourceStockStatNever: 'Chưa quét',
    sourceStockStatRescan: 'Hết TTL',
    sourceStockStatNoPdp: 'Chưa PDP',
    sourceStockTtlHint: 'TTL batch {n} ngày. Hết hàng → stock_qty=0; về hàng sau OOS → 500.',
    sourceStockReportHeading: 'Báo cáo {n} ngày',
    sourceStockCountTtl: 'Đóng dấu TTL',
    sourceStockCountChecked: 'Đã kiểm',
    sourceStockCountOos: 'Hết hàng nguồn',
    sourceStockCountIn: 'Còn hàng nguồn',
    sourceStockCountQtyPos: 'Tồn > 0',
    sourceStockCountQtyZero: 'Tồn ≤ 0',
    sourceStockOosTable: 'Hết hàng nguồn (cửa sổ)',
    sourceStockSelectAll: 'Chọn trang này',
    sourceStockClearSel: 'Bỏ chọn',
    sourceStockDeleteDb: 'Xóa khỏi kho',
    sourceStockClearFlag: 'Xóa cờ OOS',
    sourceStockRecheck: 'Kiểm lại',
    sourceStockDeleteAllWindow: 'Xóa tất cả OOS cửa sổ',
    sourceStockClearAllWindow: 'Gỡ cờ (tất cả)',
    sourceStockRecheckAllWindow: 'Kiểm lại (tất cả)',
    sourceStockColName: 'Tên',
    sourceStockColQty: 'Tồn',
    sourceStockOosEmpty: 'Không có SP hết hàng nguồn trong cửa sổ.',
    sourceStockInTable: 'Còn hàng nguồn (mẫu)',
    sourceStockInEmpty: 'Không có mẫu còn hàng.',
    sourceStockTtlTable: 'Đóng dấu TTL gần đây',
    sourceStockTtlEmpty: 'Không có dấu TTL trong cửa sổ.',
    sourceStockResetTitle: 'Reset chu kỳ kiểm tra nguồn',
    sourceStockResetBody:
      'Đưa source_stock về unknown (bỏ queued/checking), xóa hàng RAM. Worker sẽ quét lại SP đủ điều kiện. Gõ đúng cụm xác nhận.',
    sourceStockResetType: 'Gõ',
    sourceStockCancel: 'Hủy',
    sourceStockResetting: 'Đang reset…',
    sourceStockResetConfirm: 'Reset',
    sourceStockResetOk: 'Đã reset {n} sản phẩm.',
    sourceStockDeleteTitle: 'Xóa sản phẩm khỏi kho?',
    sourceStockDeleteBody: 'Xóa {n} dòng khỏi kho workspace này. Không hoàn tác.',
    sourceStockDeleting: 'Đang xóa…',
    sourceStockDeleteConfirm: 'Xóa',
    sourceStockDeletedOk: 'Đã xóa {n} dòng.',
    sourceStockClearedOk: 'Đã xóa cờ hết hàng nguồn.',
    sourceStockRecheckOk: 'Đã đưa vào hàng kiểm lại.',
    sourceStockPlatformLabel: 'Nền',
    sourceStockLinkLabel: 'Liên kết',
    sourceStockStartedLabel: 'Bắt đầu',
    sourceStockStatusLabel: 'Trạng thái',
    sourceStockNormalizedLabel: 'Chuẩn hóa',
    sourceStockJustNow: 'vừa ghi',
    sourceStockMinutesAgo: '{n} phút trước',
    sourceStockHoursAgo: '{n} giờ trước',
    sourceStockDaysAgo: '{n} ngày trước',
    imageLocTitle: 'Bản địa hóa ảnh',
    imageLocIntro: 'Xử lý ảnh cột O/P/Q/T: biến thể, thư viện, ảnh chi tiết và ảnh chính cho sản phẩm chưa bản địa hóa.',
    imageLocRefresh: 'Làm mới trạng thái',
    imageLocAiOffBanner: 'Đang chỉ bật pipeline DeepSeek + vẽ local (OCR → dịch → vẽ chữ). GPT ảnh tạm tắt trên server.',
    imageLocBulkHint: 'Chạy hàng loạt (không chọn SP): chỉ DeepSeek + vẽ local. GPT Image chỉ bật khi đã tick chọn sản phẩm trong bảng.',
    imageLocModeLabel: 'Sinh/sửa ảnh (chữ Trung → bản địa)',
    imageLocModeLocal: 'DeepSeek + vẽ local (không AI ảnh GPT)',
    imageLocModeLocalHint: 'OCR (Vision) → DeepSeek dịch → vẽ local chữ trên ảnh. Không cần key OpenAI.',
    imageLocModeGemini: 'Gemini API (GEMINI_API_KEY)',
    imageLocModeGeminiHint: 'Bảng size và hướng dẫn giặt tẩy mặc định dịch bằng Gemini rồi lưu. Cùng shop Trung Quốc, shop này và danh mục cấp 2 thì dùng ảnh đã lưu. Ảnh size có người mẫu thì xóa người mẫu, giữ số đo. Cần GEMINI_API_KEY.',
    imageLocModeOpenai: 'OpenAI GPT Image (OPENAI_API_KEY)',
    imageLocModeOpenaiHint: 'Bảng size và hướng dẫn giặt tẩy dịch bằng GPT Image rồi lưu. Cùng shop Trung Quốc, shop này và danh mục cấp 2 thì dùng ảnh đã lưu. Ảnh size có người mẫu thì xóa người mẫu, giữ số đo. Cần OPENAI_API_KEY.',
    imageLocNeedSelect: 'chọn SP trong bảng',
    imageLocAiOff: 'tạm tắt',
    imageLocCustomModel: 'Tùy chỉnh…',
    imageLocGeminiModel: 'Chọn nhanh model Gemini',
    imageLocGeminiModelHint: 'Để trống = model mặc định trên server (.env).',
    imageLocGeminiSize: 'Độ phân giải (imageSize)',
    imageLocGeminiSizeHint: 'Chỉ 2K và 4K.',
    imageLocEnvDefault: 'Mặc định (.env)',
    imageLocOpenaiModel: 'Chọn nhanh model GPT Image',
    imageLocOpenaiOut: 'Đầu ra — chất lượng & kích thước',
    imageLocLanguage: 'Ngôn ngữ bản địa',
    imageLocLangVi: 'Tiếng Việt',
    imageLocLangEn: 'English',
    imageLocLangTh: 'Thai',
    imageLocLangId: 'Indonesian',
    imageLocSelectedOnly: 'Chỉ chạy {n} sản phẩm đang chọn',
    imageLocForce: 'Chạy lại cả ảnh đã xử lý',
    imageLocStatPending: 'Pending',
    imageLocStatDone: 'Done',
    imageLocStatError: 'Error',
    imageLocStatSkip: 'Bỏ qua',
    imageLocStatRun: 'Đang chạy',
    imageLocOffPeak: 'Chờ giờ thấp điểm DeepSeek',
    imageLocOffPeakHint: 'Bật: job chờ hết giờ cao điểm (08–11h, 13–17h VN) rồi mới OCR/DeepSeek. Tắt: chạy ngay dù giá ×2.',
    imageLocLogoLabel: 'Logo đóng trên ảnh đã dịch',
    imageLocLogoHint: 'Không bắt buộc. Chỉ ảnh đã dịch và tải lên CDN NanoAI mới được đóng logo; để trống thì không đóng logo.',
    imageLocLogoUpload: 'Tải logo',
    imageLocLogoSave: 'Lưu logo',
    imageLocLogoSaved: 'Đã lưu logo bản địa hóa ảnh.',
    imageLocTestProduct: 'Sản phẩm kiểm thử',
    imageLocAllPending: 'Tất cả sản phẩm đang chờ',
    imageLocErrorDetails: 'Chi tiết lỗi gần nhất',
    imageLocPeakWaitTitle: 'Giờ cao điểm DeepSeek — job sẽ chờ',
    imageLocPeakNowTitle: 'Giờ cao điểm DeepSeek — giá ×2',
    imageLocStart: 'Chạy bản địa hóa ảnh',
    imageLocStarting: 'Đang gửi job…',
    imageLocStartMore: 'Chạy thêm job ảnh',
    imageLocQueued: 'Đã xếp hàng bản địa hóa ảnh.',
    imageLocJobsHeading: 'Tiến trình job',
    imageLocJobsEmpty: 'Không có job trên server. Bấm Chạy bản địa hóa ảnh để bắt đầu — job vẫn chạy nền khi đóng trình duyệt.',
    imageLocJobsLoading: 'Đang tải job từ server…',
    imageLocCancelGraceful: 'Hủy sau SP hiện tại',
    imageLocCancelForce: 'Hủy ngay',
    imageLocDelete: 'Xóa',
    imageLocDeleteTerminal: 'Xóa job đã xong',
    imageLocSelectRequired: 'Chọn sản phẩm trong bảng kho trước khi dùng GPT Image.',
    imageLocSelectProduct: 'Chọn sản phẩm để bản địa hóa',
    inventoryExternalSyncTitle: 'Tích hợp kho web khách → kho NanoAI',
    inventoryExternalSyncIntro:
      'So khớp từng trường kho trên NanoAI với tên trường JSON trên API kho khách (dùng dấu chấm cho object lồng, ví dụ product_info). Link trang sản phẩm lấy từ trường map tới slug — hỗ trợ URL đầy đủ. Lưu để backend/script đồng bộ Open Catalog dùng thống nhất.',
    inventoryExternalSyncReconcileHint:
      'Open Catalog: kho khách là nguồn chuẩn. Mỗi POST phải gửi snapshot «items» đầy đủ từ API khách; NanoAI thêm/cập nhật từng dòng và xóa khỏi kho những mặt hàng đã có nhưng không còn trong danh sách (ưu tiên khớp SKU; không SKU thì khớp tên). Không gửi từng đợt thiếu catalog — dễ xóa nhầm.',
    inventoryExternalSyncListUrlLabel: 'URL danh sách sản phẩm (REST)',
    inventoryExternalSyncListUrlHint:
      'Gợi ý cho đội kỹ thuật/cron: endpoint GET phân trang, ví dụ https://shop.example/api/v1/products/',
    inventoryExternalSyncColNano: 'Trường kho NanoAI',
    inventoryExternalSyncColCustomer: 'Trường JSON kho khách',
    inventoryExternalSyncColSample: 'Giá trị mẫu (hình dạng API khách)',
    inventoryExternalSyncColCustomerHint: 'Tên trường hoặc path (dot). Để trống một dòng thì khi đồng bộ có thể bỏ qua trường đó (tuỳ script).',
    inventoryExternalSyncSampleHint:
      'Cột mẫu luôn hiển thị dữ liệu tham chiếu kiểu 188.com.vn; web khách phải trả đúng kiểu tại trường đã map (không cần trùng nguyên văn).',
    inventoryExternalSyncVectorCol: 'Vector',
    inventoryExternalSyncVectorImage: 'Ảnh',
    inventoryExternalSyncVectorText: 'Văn bản',
    inventoryExternalSyncVectorFootnote:
      'Cột Vector: «Ảnh» = trường map tới ảnh (embed URL ảnh). «Văn bản» = tên + giá + ghi chú tư vấn trên kho được ghép rồi embed. Các dòng «—» không dùng làm nguồn vector.',
    inventoryExternalSyncSave: 'Lưu bảng so khớp',
    inventoryExternalSyncSaveRunning: 'Đang lưu…',
    inventoryExternalSyncSaved: 'Đã lưu cấu hình so khớp kho khách.',
    inventoryExternalSyncLoadError: 'Không tải được cấu hình so khớp.',
    inventoryExternalSyncPreset188: 'Điền sẵn preset API kiểu 188',
    inventoryExternalSyncRowRemarketing: 'Remarketing / content ID',
    inventoryExternalSyncRowStockQty: 'Số lượng tồn (stock_qty)',
    inventoryExternalSyncRowSlug: 'Slug (đoạn URL sản phẩm)',
    inventoryExternalSyncRowIsActive: 'Đang bán (trạng thái)',
    inventoryExternalSyncRowImageConsult: 'Chữ trên ảnh (tư vấn)',
    inventoryExternalSyncRowColorsJson:
      'Màu sắc (JSON) — vd [{"name":"Đen","img":"https://..."}]',
    inventoryExternalSyncAutoLabel: 'Tự động đồng bộ từ API kho khách',
    inventoryExternalSyncAutoHint:
      'Khi bật, máy chủ gọi URL danh sách sản phẩm mỗi ngày theo giờ Việt Nam (cần cron VPS / Vercel trỏ tới endpoint). Bạn vẫn có thể bấm «Đồng bộ ngay».',
    inventoryExternalSyncIntervalLabel: 'Giờ chạy (VN)',
    inventoryExternalSyncIntervalHint:
      'Chọn giờ Việt Nam (Asia/Ho_Chi_Minh). Cron chỉ chạy 1 lần/ngày khi đã tới giờ và có URL danh sách.',
    inventoryExternalSyncRemarketingSnapshotHint:
      'Đồng bộ GET tăng tiến: lấy sản phẩm có updated_since = lần thành công gần nhất. Mã Remarketing/content ID đã có được cập nhật, mã mới được thêm; is_deleted=true sẽ xóa. API có thể trả lại item đúng mốc thời gian; UPSERT theo ID an toàn, không tạo trùng.',
    inventoryExternalSyncRunNow: 'Đồng bộ ngay',
    inventoryExternalSyncRunPending: 'Đang đồng bộ…',
    inventoryExternalSyncRunSuccess:
      'Đã đồng bộ {fetched} sản phẩm từ kho khách: thêm {inserted}, cập nhật {updated}, xóa {deleted}.',
    inventoryExternalSyncLastSuccess: 'Lần đồng bộ gần nhất: {time}',
    inventoryExternalSyncNeverSynced: 'Chưa có lần đồng bộ hoàn tất.',
    inventoryExternalSyncLastErrorLabel: 'Lỗi gần nhất',
    inventoryExternalSyncInitialPending: 'Đồng bộ đầy đủ ban đầu đang chờ chạy.',
    inventoryExternalSyncInitialProgress: 'Đồng bộ đầy đủ ban đầu: trang {page}/{total}.',
    inventoryExternalSyncErrNoPartnerId: 'Thiếu mã shop.',
    inventoryExternalSyncErrMissingListUrl: 'Chưa có URL danh sách sản phẩm (REST).',
    inventoryExternalSyncErrInvalidListUrl: 'URL danh sách không hợp lệ (chỉ https công khai).',
    inventoryExternalSyncErrNotJsonObject: 'Phản hồi API không phải JSON object.',
    inventoryExternalSyncErrNoProductsArray: 'JSON thiếu mảng products / items / data.',
    inventoryExternalSyncErrFetchTimeout: 'Hết thời gian khi tải danh sách từ kho khách.',
    inventoryExternalSyncErrFetchFailed: 'Không tải được danh sách: {detail}',
    inventoryExternalSyncErrNoValidRows: 'Không map được dòng kho hợp lệ (ví dụ thiếu tên sản phẩm).',
    inventoryExternalSyncErrListInventoryFailed: 'Không đọc được kho hiện tại: {detail}',
    inventoryExternalSyncErrUpsertFailed: 'Không cập nhật được kho: {detail}',
    inventoryExternalCatalogSyncReportTitleOk: 'Đồng bộ kho từ API khách — thành công',
    inventoryExternalCatalogSyncReportTitleFail: 'Đồng bộ kho từ API khách — thất bại',
    inventoryExternalCatalogSyncReportSourceManual: 'Nút «Đồng bộ ngay» trên Cài đặt',
    inventoryExternalCatalogSyncReportSourceCron: 'Lịch tự động (cron)',
    inventoryExternalCatalogSyncReportBodyOk:
      'Thời gian: {time}\nNguồn: {source}\nCửa hàng: {shop}\n\nKết quả: Thành công\n• Sản phẩm API trả về: {fetched}\n• Dòng map được (có tên SP): {mapped}\n• Số mã Remarketing trong đợt: {remarketing}\n• Thêm / Cập nhật / Xóa: {inserted} / {updated} / {deleted}\n• Embedding (ảnh + văn bản): {embedNote}\n{extraNote}',
    inventoryExternalCatalogSyncReportBodyFail:
      'Thời gian: {time}\nNguồn: {source}\nCửa hàng: {shop}\n\nKết quả: Thất bại\n• Mã: {code}\n• Chi tiết: {detail}',
    inventoryExternalCatalogSyncReportEmbedDeferred:
      'Đang xếp hàng — cron/「Đồng bộ ngay» vector sẽ xử lý (deferEmbeddings).',
    inventoryExternalCatalogSyncReportEmbedSync: 'Đã kích hoạt đồng bộ vector trong phiên này.',
    inventoryExternalCatalogSyncReportExtraEmptyApi:
      'Ghi chú: API trả 0 sản phẩm — kho không đổi (không xóa).\n',
    inventoryDownloadTemplate: 'Tải file Excel mẫu',
    inventoryExportExcel: 'Xuất Excel',
    inventoryImportExcel: 'Nhập Excel',
    inventoryExcel188Hint:
      'File mẫu / xuất Excel dùng đủ cột catalog (id, sku, mô tả, biến thể, thư viện ảnh, 3 cấp danh mục, chất liệu, listed…). File kho 12 cột cũ vẫn nhập được. Cột A mã 1688 (A…) hoặc Tmall (T…) đã có thì bỏ qua. Mã khác khớp Id, rồi SKU, rồi tên. listed=0 xóa theo id/SKU/tên.',
    inventoryReloadDemoProducts: 'Tải lại sản phẩm demo',
    inventoryReloadDemoHint:
      '9 sản phẩm mẫu từ catalog thời trang (3 túi nhiều màu, 3 giày nhiều màu·size, 3 quần áo nhiều màu·size) — đủ cột giống 188.com.vn. Có thể xóa rồi tải lại.',
    inventoryReloadDemoSuccess: 'Đã thêm {count} sản phẩm demo.',
    inventoryReloadDemoNone: 'Sản phẩm demo đã có đủ trong kho. Xóa bớt rồi tải lại nếu muốn.',
    inventoryReloadDemoFailed: 'Không tải được sản phẩm demo.',
    productStudioOpenButton: 'Đăng sản phẩm',
    productStudioTitle: 'Đăng sản phẩm',
    productStudioManualTab: 'Thủ công',
    productStudioAiTab: 'Bằng AI',
    productStudioFieldName: 'Tên sản phẩm',
    productStudioFieldPrice: 'Giá (đ)',
    productStudioFieldMaterial: 'Chất liệu',
    productStudioFieldStyle: 'Kiểu dáng',
    productStudioFieldGender: 'Giới tính',
    productStudioFieldProductType: 'Loại sản phẩm',
    productStudioFieldSizes: 'Size',
    productStudioFieldNoSize: 'Không phân size',
    productStudioFieldColors: 'Màu sắc',
    productStudioAddColor: 'Thêm màu',
    productStudioColorName: 'Tên màu',
    productStudioColorImage: 'Ảnh màu',
    productStudioFieldMainImage: 'Ảnh chính',
    productStudioFieldGallery: 'Ảnh phụ (gallery)',
    productStudioFieldDescription: 'Mô tả sản phẩm',
    productStudioFieldNotes: 'Ghi chú thêm (không hiển thị khách)',
    productStudioFieldStock: 'Tồn kho',
    productStudioUploadButton: 'Tải ảnh lên',
    productStudioUploading: 'Đang tải ảnh…',
    productStudioSubmit: 'Đăng sản phẩm',
    productStudioSubmitting: 'Đang đăng…',
    productStudioSuccess: 'Đã đăng sản phẩm thành công!',
    productStudioCancel: 'Huỷ',
    productStudioRemove: 'Xoá',
    productStudioRequiredName: 'Vui lòng nhập tên sản phẩm.',
    productStudioRequiredImage: 'Vui lòng tải lên ít nhất 1 ảnh.',
    productStudioRequiredPrice: 'Vui lòng nhập giá hợp lệ.',
    productStudioAiComingSoon: 'Đăng bằng AI sẽ mở trong bản cập nhật tới — dùng Thủ công để đăng ngay.',
    productStudioRefImagesLabel: 'Ảnh tham chiếu (không hiển thị cho khách, tối đa 3)',
    productStudioColorNamesLabel: 'Tên màu muốn tạo (cách nhau bằng dấu phẩy)',
    productStudioModelPresenceLabel: 'Có người mẫu trong ảnh',
    productStudioShotStyleLabel: 'Bối cảnh chụp',
    productStudioAspectRatioLabel: 'Tỉ lệ ảnh',
    productStudioImageModelLabel: 'Model tạo ảnh',
    productStudioImageModelPro: 'Pro (chất lượng cao)',
    productStudioImageModelFlash: 'Flash 2.5 (nhanh)',
    productStudioImageModelFlash3: 'Flash 3',
    productStudioCreditPerImage: '{n} credit/ảnh',
    productStudioMaterialCreditNote: 'Chất liệu luôn dùng Gemini Pro: {n} credit/ảnh',
    productStudioGalleryCountLabel: 'Số ảnh gallery',
    productStudioDetailCountLabel: 'Số ảnh chi tiết',
    productStudioStartStudio: 'Bắt đầu tạo ảnh bằng AI',
    productStudioApprove: 'Duyệt ảnh này',
    productStudioRegenerate: 'Tạo lại',
    productStudioStudioDone: 'Đã đủ ảnh — sẵn sàng đăng sản phẩm',
    productStudioSuggestName: 'Đặt tên bằng AI',
    productStudioSuggestedName: 'Tên do AI đề xuất',
    productStudioStepAttrs: 'Thuộc tính',
    productStudioStepStudioSettings: 'Cài đặt Studio',
    productStudioStepStudio: 'Studio ảnh',
    productStudioStepImages: 'Ảnh',
    productStudioStepPublish: 'Đăng',
    productStudioManualModeHint:
      'Upload ảnh chính, gallery và ảnh từng màu từ máy. AI viết mô tả khi đăng.',
    productStudioColorRowHint: 'Mỗi dòng: tên + ảnh',
    productStudioRequiredColor: 'Cần ít nhất 1 ảnh màu (có tên + ảnh).',
    productStudioColorNameMissing: 'Mỗi ảnh màu cần có tên màu.',
    productStudioRequiredGallery: 'Cần ít nhất 2 ảnh gallery.',
    productStudioStartPublish: 'Bắt đầu đăng sản phẩm',
    productStudioNamePlaceholder: 'VD: Áo sơ mi linen nữ form rộng…',
    productStudioColorNamePlaceholder: 'VD: Đen, Be, Hồng phấn…',
    productStudioImageEmpty: 'Ảnh',
    productStudioFieldGalleryMin: 'Ảnh gallery * (tối thiểu 2)',
    productStudioManualAiDescHint: 'Không cần nhập mô tả — AI sẽ viết khi đăng.',
    productStudioNext: 'Tiếp',
    productStudioBack: 'Quay lại',
    productStudioRequiredMaterial: 'Vui lòng nhập chất liệu.',
    productStudioRequiredSizes: 'Thêm size (Enter sau mỗi size) hoặc chọn «Không phân size».',
    productStudioRequiredModelFields: 'Chọn «Có người mẫu» thì cần giới tính, tuổi và gốc người mẫu.',
    productStudioAiModeHint:
      'Không nhập tên sản phẩm ở bước này. Sang Studio: upload ảnh mẫu từng màu — AI tự đọc tên màu. Ảnh màu đầu: AI đọc luôn tên SEO.',
    productStudioTypeApparel: 'Quần áo',
    productStudioTypeShoes: 'Giày dép',
    productStudioTypeAccessory: 'Phụ kiện',
    productStudioTypeHousehold: 'Gia dụng',
    productStudioTypeFood: 'Thực phẩm',
    productStudioTypeOther: 'Khác',
    productStudioGenderFemale: 'Nữ',
    productStudioGenderMale: 'Nam',
    productStudioGenderUnisex: 'Unisex',
    productStudioShotStudio: 'Studio chuyên nghiệp (nền sạch)',
    productStudioShotLifestyle: 'Lifestyle trong nhà',
    productStudioShotOutdoor: 'Phong cảnh / ngoài trời',
    productStudioModelNone: 'Không người mẫu — chỉ sản phẩm',
    productStudioModelYes: 'Có người mẫu mặc đồ / cầm SP',
    productStudioModelGender: 'Giới tính người mẫu',
    productStudioModelAge: 'Tuổi người mẫu',
    productStudioModelEthnicity: 'Quốc tịch / gốc người mẫu',
    productStudioModelAgeBaby: 'Em bé (0–3 tuổi)',
    productStudioModelAgeChild: 'Trẻ em (4–12 tuổi)',
    productStudioModelAgeTeen: 'Thiếu niên (13–17 tuổi)',
    productStudioModelAgeAdult: 'Người lớn (18–35 tuổi)',
    productStudioModelAgeMiddle: 'Trung niên (35–55 tuổi)',
    productStudioModelEthnicityAsian: 'Châu Á',
    productStudioModelEthnicityWestern: 'Châu Âu / phương Tây',
    productStudioNonWearableHint: 'Loại này chụp ảnh sản phẩm tĩnh, không có người mẫu mặc/đeo/dùng.',
    productStudioTabColor: 'Ảnh màu',
    productStudioTabGallery: 'Ảnh gallery',
    productStudioTabMaterial: 'Ảnh chất liệu',
    productStudioTabDetail: 'Ảnh chi tiết',
    productStudioTabDetailOptional: 'tuỳ chọn',
    productStudioColorFirstHint:
      'Ảnh màu đầu tiên: upload ảnh mẫu SP — AI tự đọc tên SP + tên màu, giữ góc nhìn/tư thế như ảnh mẫu.',
    productStudioColorNextHint:
      'Ảnh màu tiếp theo: upload ảnh mẫu SP mới — AI lấy kiểu/màu từ ảnh này, giữ khuôn mặt từ ảnh màu #1.',
    productStudioGalleryHint: 'Chọn ảnh ref rồi Tạo mới — AI tạo cùng sản phẩm nhưng góc ảnh khác. Cần đủ 2 ảnh gallery trước khi đăng.',
    productStudioDetailHint: 'Ảnh chi tiết tuỳ chọn — chọn ref rồi Tạo mới; AI cận cảnh góc khác ref.',
    productStudioMaterialHint:
      'Collage chi tiết chất liệu — chọn ảnh tham khảo rồi Tạo mới. Bắt buộc 1 ảnh chất liệu trước khi đăng.',
    productStudioSampleImage: 'Ảnh mẫu sản phẩm',
    productStudioSampleImageNew: 'Ảnh mẫu sản phẩm mới',
    productStudioPickRefs: 'Chọn ảnh tham khảo (tối đa 3)',
    productStudioGenerate: 'Tạo mới',
    productStudioApproveContinue: 'OK — Tiếp',
    productStudioFaceLockLabel: 'Khuôn mẫu người mẫu (từ ảnh màu #1)',
    productStudioProgressTitle: 'Tiến độ ảnh trước khi đăng',
    productStudioProgressColor: 'Ảnh màu',
    productStudioProgressGallery: 'Gallery',
    productStudioProgressMaterial: 'Ảnh chất liệu',
    productStudioProgressDetail: 'Ảnh chi tiết',
    productStudioSelectGalleryStep: 'Bước 1: Chọn ảnh gallery',
    productStudioSelectDetailStep: 'Bước 2: Chọn ảnh chi tiết',
    productStudioConfirmSelection: 'Xác nhận lựa chọn',
    productStudioSkipDetail: 'Bỏ qua ảnh chi tiết',
    productStudioResumeTitle: 'Có phiên tạo sản phẩm đang dở',
    productStudioResumeContinue: 'Tiếp tục',
    productStudioResumeDelete: 'Xóa',
    productStudioNoUploadHere:
      'Không upload ảnh ở bước này. Sang Studio ảnh, mỗi màu bạn upload ảnh tham chiếu riêng khi bấm Tạo.',
    productStudioSizeChipPlaceholder: 'Gõ size rồi Enter (VD: S hoặc 39)',
    productStudioNeedAttach: 'Upload ảnh mẫu sản phẩm — AI tự đọc tên màu.',
    productStudioNeedRefs: 'Chọn ít nhất 1 ảnh tham khảo hoặc upload ảnh kèm.',
    productStudioSeoName: 'Tên SEO',
    productStudioShotLocked: 'Bối cảnh cố định',
    productStudioSwitchTabHint: 'Chuyển tab bất kỳ lúc nào — hệ thống không tự nhảy sang mục khác khi đã đủ ảnh tối thiểu.',
    productStudioMinPublishHint: 'Bắt buộc trước khi đăng: 1 ảnh màu, 2 gallery, 1 ảnh chất liệu. Ảnh chi tiết tuỳ chọn.',
    productStudioPromptColorPlaceholder: 'Để trống → AI giữ góc nhìn như ảnh mẫu. Hoặc nhập thêm chi tiết (cầm túi, cổ V…).',
    productStudioGalleryMinHint: 'Gallery đã chọn — tối thiểu 2 ảnh.',
    productStudioDetailOptionalHint: 'Chi tiết đã chọn — không chọn gì cũng được (bỏ qua).',
    inventoryImportReplaceWarning:
      'Nhập Excel catalog: cột A (Id) là mã 1688 (A…) hoặc Tmall (T…) đã có trên kho thì bỏ qua — không cập nhật, không tạo mới. Mã khác trùng Id hoặc SKU thì cập nhật; chưa có thì thêm. Không có id/SKU thì khớp theo tên. listed = 0 vẫn xóa. Hàng không có trong file vẫn giữ. Tiếp tục?',
    inventoryImportSuccess: 'Đã xử lý {count} dòng: thêm {inserted}, cập nhật {updated}, bỏ qua {skipped} (trùng mã 1688/Tmall), xóa {deleted}.',
    inventoryImportFailed: 'Không nhập được từ Excel.',
    inventoryExcelImportUploading: 'Đang tải file Excel lên…',
    inventoryExcelImportSending: 'Đang gửi file…',
    inventoryErrInvalidXlsx: 'File không đúng định dạng Excel (.xlsx).',
    inventoryErrEmptySheet: 'Trang tính trống.',
    inventoryErrMissingName: 'Thiếu cột tên hàng (name / Tên) hoặc Id sản phẩm trên file catalog. Hãy dùng file mẫu.',
    inventoryErrNoRows:
      'Không có dòng dữ liệu hợp lệ (cần tên hoặc id để thêm/cập nhật; listed=0 cần id, SKU hoặc tên để xóa).',
    inventoryErrNoFile: 'Chưa chọn file.',
    inventoryErrFileTooLarge: 'File quá lớn (tối đa 80 MB).',
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
    inventoryEmbeddingErrorsTitle: 'Danh sách lỗi vector',
    inventoryEmbeddingErrorsSummary: '{count} sản phẩm có lỗi tạo vector (ảnh hoặc văn bản).',
    inventoryEmbeddingErrorsEmpty: 'Không có sản phẩm lỗi vector.',
    inventoryEmbeddingErrorsColSku: 'SKU',
    inventoryEmbeddingErrorsColName: 'Tên sản phẩm',
    inventoryEmbeddingErrorsColImageError: 'Lỗi vector ảnh',
    inventoryEmbeddingErrorsColTextError: 'Lỗi vector văn bản',
    inventoryEmbeddingErrorsColUpdatedAt: 'Lần thử gần nhất',
    inventoryEmbeddingErrorsLoadMore: 'Tải thêm',
    inventoryEmbeddingErrorsExportCsv: 'Xuất CSV',
    inventoryEmbeddingErrorsExporting: 'Đang xuất...',
    inventoryEmbeddingErrorsExportDone: 'Đã xuất {count} dòng → {filename}',
    inventoryEmbeddingErrorsExportEmpty: 'Không có dòng lỗi để xuất.',
    inventoryEmbeddingErrorsLoadFailed: 'Không tải được danh sách lỗi vector.',
    inventoryEmbeddingErrorsCsvHeaderSku: 'SKU',
    inventoryEmbeddingErrorsCsvHeaderName: 'Ten san pham',
    inventoryEmbeddingErrorsCsvHeaderId: 'ID',
    inventoryEmbeddingErrorsCsvHeaderImageUrl: 'URL anh',
    inventoryEmbeddingErrorsCsvHeaderImageError: 'Loi vector anh',
    inventoryEmbeddingErrorsCsvHeaderImageErrorAt: 'Thoi diem loi anh',
    inventoryEmbeddingErrorsCsvHeaderTextError: 'Loi vector van ban',
    inventoryEmbeddingErrorsCsvHeaderTextErrorAt: 'Thoi diem loi van ban',
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
    guestPurchaseFlowLabel: 'Khách mua hàng từ chat',
    guestPurchaseFlowHint:
      'Nút Chat mua vẫn mở hộp chat. Chọn mua luôn trong chat, hoặc khi khách bấm Mua / Thêm giỏ thì mở modal giỏ trên đúng web đang chat. Shop có cả web khách ngoài hệ thống và web cùng nền tảng thì hai nhánh độc lập.',
    guestPurchaseFlowInChat: 'Mua ngay trên chat',
    guestPurchaseFlowExternal: 'Mở trang chi tiết sản phẩm',
    guestPurchaseFlowExternalCart: 'Mở modal giỏ trên web shop',
    guestExternalCartUrlTemplateLabel: 'URL giỏ web khách (ngoài hệ thống)',
    guestExternalCartUrlTemplateHint:
      'Dán vào đây khi shop thêm web nằm ngoài NanoAI. Bắt buộc {sku}. Ví dụ: https://188.com.vn/cart/add/{sku}?from=nanoai. Để trống nếu chỉ có web trên hệ thống — đường dẫn xanh dương phía trên đã đủ. Chat trên web ngoài dùng link đã dán; chat trên tên miền cùng hệ thống vẫn mở giỏ tên miền đó.',
    guestExternalCartUrlTemplatePlaceholder: 'https://shop.vn/cart/add/{sku}?from=nanoai',
    guestExternalCartUrlTemplateSaveHint:
      'Điền link thật của shop → click ra ngoài ô (hoặc bấm «Lưu cài đặt») để lưu chế độ mở giỏ web.',
    guestPurchaseFlowSaasLinkedHint:
      'Đã liên kết web shop trên hệ thống. Mua / Thêm giỏ trên tên miền này dùng đường dẫn xanh dương, không cần dán. Muốn thêm web khách ngoài: dán URL giỏ của web đó vào ô xanh lá bên dưới. Nút Chat mua vẫn mở chat.',
    guestPurchaseFlowDualHint:
      'Shop có cả web khách ngoài hệ thống và web cùng nền tảng. Chat nhúng trên web khách giữ URL giỏ web khách. Chat mua trên tên miền cùng hệ thống thì Mua / Thêm giỏ mở giỏ trên tên miền đó — hai nhánh độc lập.',
    guestPurchaseFlowNeedWebsite:
      'Chưa có website shop trên hệ thống. Đăng web trong Tạo web & landing, hoặc dán URL giỏ của web khách bên ngoài.',
    guestPurchaseFlowSaasPreviewLabel: 'Đường dẫn tự liên kết',
    shopCheckoutLoginLabel: 'Thanh toán trên website shop',
    shopCheckoutLoginHint:
      'Áp dụng trang /site/… của shop. Bật: khách xác minh email (OTP) trước khi đặt hàng. Tắt: chỉ cần họ tên, SĐT và địa chỉ giao hàng.',
    shopCheckoutLoginRequiredOn: 'Yêu cầu đăng nhập OTP',
    shopCheckoutLoginRequiredOff: 'Khách mua không cần đăng nhập',
    usagePanelTitle: 'Thống kê token API',
    usagePanelSubtitle: 'Theo dõi lượng gọi LLM, embedding, tạo ảnh và chi phí ước tính theo khoảng thời gian.',
    birthdayPromoSettingsTitle: 'Chúc mừng sinh nhật — email & ưu đãi',
    birthdayPromoSettingsDesc:
      'Gửi email và giảm giá tự động cho khách có ngày sinh trên tài khoản trong khoảng ngày bạn chọn.',
    birthdayPromoSettingsHint:
      'Gửi email cho khách đã chat, đã đăng nhập và có ngày sinh; giá sản phẩm trong kho giảm theo % khi đặt qua chat — tự động, không cần mã. Cron chạy hằng ngày (cần SMTP).',
    birthdayDiscountLabel: 'Giảm giá (%)',
    birthdayDaysMaxLabel: 'Trước SN — từ (ngày)',
    birthdayDaysMinLabel: 'Trước SN — đến (ngày)',
    birthdayEnableAria: 'Bật chương trình sinh nhật',
    birthdayPromoAutoSaveHint: 'Công tắc và các số trên được lưu tự động (ô số lưu sau khi bạn ngừng gõ ~0,5 giây).',
    birthdayPromoSaveFailed: 'Không lưu được cài đặt khuyến mãi sinh nhật.',
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
    guestImageTooLarge: 'Ảnh quá lớn (tối đa ~15 MB).',
    guestImageInvalidType: 'Chỉ hỗ trợ JPG, PNG, WebP hoặc GIF.',
    guestCaptionHint: 'Có thể thêm chú thích kèm ảnh (tuỳ chọn).',
    loginPromptTitle: 'Đăng nhập để chat',
    loginPromptDescription:
      'Đăng nhập bằng email để nhắn tin với cửa hàng và xem lại hội thoại trên thiết bị khác.',
    signInWithGoogle: 'Đăng nhập',
    linkMyShops: 'Tin nhắn của tôi',
    linkMyOrders: 'Đơn hàng của tôi',
    backHome: 'Về trang chủ',
    backHomeAria: 'Về trang chủ',
    exploreToolsButton: 'Công cụ NanoAI',
    exploreToolsTitle: 'Công cụ khác của NanoAI',
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
    guestAuthCheckEmailSpamTrashHint:
      'Vui lòng kiểm tra mã OTP trong Hộp thư đến, Thư rác (Spam) hoặc Thùng rác (Trash). Nếu không thấy, hãy tìm mã cả ở Thùng rác.',
    guestAuthOpenGmail: 'Mở Gmail kiểm tra mã',
    guestAuthOpenMailbox: 'Mở hộp thư kiểm tra mã',
    guestAuthOtpInvalid: 'Mã OTP không hợp lệ hoặc đã hết hạn.',
    guestAuthAccountLocked: 'Tài khoản đã bị khóa.',
    guestAuthRateLimited: 'Bạn thao tác quá nhanh. Vui lòng thử lại sau {seconds} giây.',
    guestAuthRememberDeviceHint:
      'Tin cậy thiết bị/trình duyệt này lâu dài (đăng nhập lại cùng email sẽ bỏ qua OTP).',
    guestAuthVerifyingProgress: 'Đang đăng nhập, vui lòng chờ...',
    shopTypingHint: 'Shop {shop} đang soạn thông tin để gửi…',
    consultLinkShopPreparingHint: 'Cửa hàng đang gửi thông tin sản phẩm…',
    similarAlternativesTemplateMessage:
      'Bên em có thêm một số mẫu khác bên dưới, anh/chị tham khảo ạ.',
    productSearchTemplateMessage:
      'Dạ, em gửi anh/chị các mẫu phù hợp bên dưới ạ. Anh/chị xem thẻ, nếu ưng mẫu nào có thể bấm Mua ngay để lên đơn trong chat hoặc bấm Tư vấn để hỏi thêm nhé.',
    photoAngleDetailTemplateMessage:
      'Dạ với góc ảnh chi tiết như anh/chị đang hỏi, anh/chị bấm "Xem chi tiết" trên thẻ sản phẩm bên dưới giúp em để xem đầy đủ ảnh và thông tin trên web nhé.',
    visionPickHint: '',
    visionPickBusy: 'Đang gửi…',
    visionPickError: 'Không gửi được lựa chọn. Thử lại.',
    visionProductLink: 'Tư vấn',
    visionProductBuy: 'Mua ngay',
    guestProductAddToCart: 'Thêm giỏ',
    guestProductPlaceOrder: 'Đặt hàng',
    visionProductViewDetails: 'Xem chi tiết',
    visionProductVideo: 'Video',
    visionVideoCloseAria: 'Đóng video',
    productShelfButton: 'Sản phẩm',
    urlProductContextChipLabel: 'Gửi mã SP đang xem',
    urlProductContextChipAria:
      'Gửi shop ngữ cảnh sản phẩm trên trang này (mã, ảnh). Bỏ qua nếu bạn nhập tin nhắn khác trước.',
    urlProductContextChipDismissAria: 'Đóng — không gửi mã sản phẩm đang xem',
    productShelfTitle: 'Gợi ý tương tự cho bạn',
    productShelfEmpty:
      'Chưa có gợi ý tương tự. Chat với shop (hoặc gửi ảnh SP) để nhận gợi ý, hoặc tìm trong kho bên trên.',
    productShelfSearchPlaceholder: 'Tìm trong kho (mô tả, kiểu dáng…)',
    productShelfSearchButton: 'Tìm',
    productShelfSearchImage: 'Ảnh',
    productShelfSearchClear: 'Xóa lọc',
    productShelfSearching: 'Đang tìm…',
    productShelfSearchFailed: 'Không tìm được. Thử lại sau khi đồng bộ vector kho.',
    productShelfSearchNoResults: 'Không có sản phẩm khớp.',
    productShelfBuy: 'Mua',
    purchaseOpenSiteToast: 'Đã mở trang sản phẩm trên website shop.',
    purchaseOpenCartUrlToast: 'Đã mở trang thêm giỏ trên website shop.',
    purchaseMissingProductUrlToast: 'Mẫu này chưa có link trang sản phẩm — shop vui lòng thêm URL trong kho.',
    purchaseMissingSkuToast: 'Mẫu này chưa có mã SKU — shop vui lòng thêm SKU trong kho.',
    purchaseMissingCartTemplateToast:
      'Chưa liên kết được giỏ web. Đăng website shop trên hệ thống, hoặc dán URL giỏ của web khách có {sku}.',
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
    birthdayPromoComposerHint:
      'Ưu đãi sinh nhật: giảm {percent}% — áp dụng tự động cho giá các sản phẩm trong kho trong tuần trước sinh nhật khi đặt qua chat, không cần mã giảm giá.',
    birthdayPromoChatGreeting:
      'Chúc mừng sinh nhật bạn!\n{shopName} gửi lời chúc và tặng bạn ưu đãi giảm {percent}% trên giá sản phẩm trong kho khi đặt qua chat — áp dụng tự động trong tuần trước sinh nhật, không cần mã giảm giá.',
    birthdayPromoEnterToastTitle: 'Ưu đãi sinh nhật {percent}%',
    birthdayPromoEnterToastDescription: 'Giá trên kệ đã giảm tự động. Chúc bạn mua sắm vui vẻ!',
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
    privacyPolicyLink: 'Chính sách quyền riêng tư',
    termsOfServiceLink: 'Điều khoản dịch vụ',
    dataDeletionLink: 'Xóa dữ liệu người dùng',
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
    text_to_image: 'Tạo ảnh bằng ý tưởng',
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
    curriculum_plan: 'Gói giáo trình',
    online_exam: 'Tạo bài thi trực tuyến',
    homework_online: 'Tạo bài tập về nhà',
    classes: 'Lớp học',
    try_on_1: 'Thử đồ 1 người',
    try_on_2: 'Thử đồ 2 người',
    try_on_3: 'Thử đồ 3 người',
    try_on_4: 'Thử đồ 4 người',
    try_on_5: 'Thử đồ 5 người',
    image_result_display: 'Hiển thị kết quả ảnh',
    catalog_photo_pack: 'Tạo ảnh đăng Facebook',
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
  imageGenerationClient: {
    unexpectedNoUrl:
      'Máy chủ có thể đã xử lý xong nhưng trình duyệt không nhận được link ảnh. Mở mục Ảnh đã xử lý trong Dashboard để xem kết quả hoặc thử lại.',
    clientFault:
      'Lỗi kết nối hoặc hết thời gian chờ. Ảnh có thể đã được lưu — kiểm tra Ảnh đã xử lý hoặc thử lại.',
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
    sectionHubPlans: 'Kế hoạch đa bước (NanoAI Assistant)',
    emptyHubPlans: 'Chưa có kế hoạch đa bước đang chạy.',
    hubPlanSteps: '{done}/{total} bước',
    hubPlanContinue: 'Tiếp tục',
    hubPlanCancel: 'Hủy',
    hubPlanStatusActive: 'Đang thực hiện',
    hubPlanStatusCompleted: 'Hoàn tất',
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
    libraryHeading: 'Kho nhạc nền',
    libraryHint: 'Bấm «Chọn nhạc» để mở kho. Hoặc tải file của bạn. Bài tải lên được lưu vào kho để mọi người cùng chọn.',
    uploadLabel: 'Tải nhạc lên',
    sharedUploadNote: 'File bạn tải sẽ vào kho dùng chung. Người tạo thiệp khác cũng chọn được bài này.',
    seedCredit: 'Bài có sẵn: Kevin MacLeod (incompetech.com), giấy phép CC BY 4.0.',
    chooseMusic: 'Chọn nhạc',
    chooseAgain: 'Chọn lại',
    previewListen: 'Nghe thử',
    stopPreview: 'Dừng',
    confirmPick: 'OK',
    pickerTitle: 'Chọn nhạc nền',
  },
  weddingCardCalendar: {
    sectionTitle: 'THÔNG TIN TIỆC CƯỚI',
    introLine: 'TIỆC CƯỚI SẼ DIỄN RA VÀO LÚC:',
    receptionLabel: 'ĐÓN KHÁCH',
    partyLabel: 'KHAI TIỆC',
    timePlaceholderDash: '—',
    countdownTitle: 'CÙNG ĐẾM NGƯỢC',
    countdownDay: 'ngày',
    countdownDays: 'ngày',
    countdownHour: 'giờ',
    countdownHours: 'giờ',
    countdownMinute: 'phút',
    countdownMinutes: 'phút',
    countdownSecond: 'giây',
    countdownSeconds: 'giây',
    countdownPast: 'Ngày cưới đã đến — hẹn gặp bạn tại tiệc!',
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
    downloadQr: 'Tải mã QR',
  },
  weddingCardAiBrief: {
    step2Description:
      'Sửa nội dung và xem preview đều miễn phí. Mọi thay đổi tự lưu, không cần bấm Lưu.',
    autoSavingLabel: 'Đang lưu…',
    autoSavedLabel: 'Đã lưu tự động',
    autoSaveFailedLabel: 'Chưa lưu được. Kiểm tra mạng rồi sửa lại một chỗ để lưu tiếp.',
    dateFormatHint:
      'Chọn ngày cưới trên lịch. «Giờ đón khách» và «Giờ khai tiệc» hiển thị trên khối thông tin tiệc.',
    dateSelectedPrefix: 'Đã chọn:',
    guestInviteVenueLabel: 'Mời đến tại',
    guestInviteVenueHint: 'Hiển thị cùng tên khách trên thiệp (ví dụ: Đến tại nhà trai).',
    effectsToggleLabel: 'Bật hiệu ứng thiệp',
    effectsToggleDesc: 'Bao gồm: tự động cuộn sau khi mở thiệp, nút nhạc nổi và tự động phát nhạc. Tắt nếu muốn thiệp tĩnh hoàn toàn.',
    loginGateLead:
      'Đăng nhập để tạo thiệp cưới AI, xem trước nội dung miễn phí và xuất bản link RSVP cho khách mời.',
    loginGateHint: 'Chọn phong cách, soạn lời mời tiếng Việt và gửi thiệp điện tử chỉ với một đường dẫn. Chỉ tốn credit khi AI sinh ảnh mới.',
    loginGateCta: 'Đăng nhập để tạo thiệp',
  },
  weddingCardAiImage: {
    customReferenceLabel: 'Ảnh tham khảo tùy chỉnh (tùy chọn)',
    customReferenceHint:
      'AI lấy tông màu, họa tiết và không khí từ ảnh này — không sao chép bố cục hay chữ. Dùng khi tạo ảnh nền chính cho cả thiệp. Không tốn credit cho việc chọn ảnh.',
    customReferenceChoose: 'Chọn ảnh tham khảo',
    customReferenceRemove: 'Gỡ ảnh',
    customReferenceUrlPlaceholder: 'Hoặc dán URL ảnh tham khảo (https://...)',
    customReferenceEmpty: 'Chưa chọn ảnh tham khảo',
    chooseBackground: 'Chọn nền',
    chooseBackgroundAgain: 'Chọn lại',
    backgroundPickedOk: 'OK',
    backgroundPickedTitle: 'Đã chọn nền',
    backgroundSectionTitle: 'Nền thiệp',
    backgroundSectionHint: 'Ảnh nền dùng chung cho cả thiệp. Bấm Chọn nền để xem kho, hoặc tạo nền mới bằng AI.',
    backgroundLibraryTitle: 'Kho ảnh nền',
    backgroundLibraryHint: 'Bấm một ảnh đã tạo để dùng làm ảnh chính cho cả thiệp. Không trừ credit. Tạo mới vẫn 1 credit và ảnh mới được lưu vào kho. Ảnh chọn từ máy chỉ dùng cho thiệp này, không vào kho.',
    backgroundLibraryEmpty: 'Kho còn trống. Tạo nền mới để lưu vào kho — lần sau chọn lại không mất credit.',
    createBackgroundAi: 'Tạo nền mới AI',
    createBackgroundModalTitle: 'Tạo nền mới bằng AI',
    createBackgroundButton: 'Tạo ảnh nền - 1 credit',
    createBackgroundAgain: 'Tạo lại ảnh nền - 1 credit',
    pickOutsideBackground: 'Chọn ảnh ngoài · 0 credit',
    backgroundEmptyPreview: 'Chưa có ảnh nền. Chọn trong kho hoặc tạo nền mới.',
    downloadCreated: 'Tải ảnh đã tạo',
    back: 'Quay lại',
  },
  weddingCardAiStyle: {
    sectionTitle: '1. Chọn phong cách',
    sectionDescription:
      'Chọn chủ đề màu và cảm giác cho nền AI — miễn phí, không tốn credit. Mỗi phong cách có thumbnail mô phỏng để dễ nhận biết.',
  },
  weddingCardAiCover: {
    sectionTitle: '1b. Chọn vỏ thiệp',
    sectionDescription:
      'Mỗi vỏ là một khung khác nhau, lỗ giữa để ảnh — miễn phí, không tốn credit. Ảnh nền full màn vẫn dùng chung một ảnh nền chính.',
    tagNew: 'Mới',
    tagHot: 'Hot',
    previewLabel: 'Thiệp mời',
    previewGuestPrefix: 'Thân mời',
    previewOpenButton: 'Mở thiệp',
    uploadLabel: 'Ảnh cặp đôi trên vỏ thiệp',
    choosePhoto: 'Chọn ảnh',
    chooseFrame: 'Chọn khung',
    changePhoto: 'Đổi ảnh',
    coverPhotoZoomOut: 'Thu nhỏ',
    coverPhotoZoomIn: 'Phóng to',
    uploadHint: 'Chưa có ảnh thì bấm Chọn ảnh. Đã có ảnh thì bấm Đổi ảnh, kéo trong khung để đổi vị trí, nút zoom để phóng hoặc thu nhỏ. Ảnh AI nằm trong kho chung — khách khác chọn lại không tốn credit. Ảnh tải từ máy chỉ của thiệp này.',
    removeCustomCover: 'Gỡ ảnh giữa thiệp',
    aiCoverHint: 'Nền phía sau khung thiệp là ảnh nền chính, dùng chung cả thiệp. Bấm Chọn nền ở trên.',
    aiFrameButton: 'Tạo khung AI',
    aiFrameHint: 'AI vẽ khung rồi xóa nền bằng công cụ có sẵn, lỗ giữa trong suốt để đặt ảnh. Chỉ trừ 2,5 credit khi khung dùng được.',
    aiFramePromptPlaceholder: 'Gợi ý thêm (tùy chọn): hoa mẫu đơn, viền vàng…',
    aiFrameDone: 'Đã tạo khung AI',
    aiFrameDoneDetail: 'Đã trừ 2,5 credit. Khung vào kho chung — khách sau chọn lại không tốn credit.',
    aiFrameUsing: 'Đang dùng khung AI. Chọn một vỏ có sẵn để trở lại khung mẫu.',
    aiFrameUseStock: 'Dùng khung có sẵn',
    coverLibraryHint: 'Chọn ảnh AI trong kho chung, hoặc tải ảnh từ máy. Ảnh kho không tốn credit. Ảnh từ máy chỉ gắn thiệp này.',
    coverUploadDevice: 'Tải từ máy',
    coverLibraryEmpty: 'Kho ảnh AI còn trống. Tạo ảnh chính ở bước sau — ảnh đó vào kho cho mọi khách.',
    aiFrameLibraryHeading: 'Kho khung AI',
    aiFrameLibraryHint: 'Bấm một khung đã tạo để dùng. Không trừ credit. Tạo mới vẫn 2,5 credit và khung mới vào kho chung.',
    aiFrameLibraryEmpty: 'Kho khung còn trống. Tạo khung AI để lưu — khách sau chọn lại không mất credit.',
    aiFrameLibraryApplied: 'Đã chọn khung từ kho. Không trừ credit.',
    frameModeNone: 'Không khung',
    frameModePick: 'Chọn khung',
    frameModeAi: 'Tạo khung AI',
    photoOpenLabel: 'Hiệu ứng mở ảnh',
    frameOpenLabel: 'Hiệu ứng mở khung',
    photoOpenNone: 'Hiện nhẹ',
    photoOpenRise: 'Trượt lên',
    photoOpenFade: 'Hiện dần',
    photoOpenZoom: 'Phóng từ trong',
    photoOpenAssemble: 'Ghép lại',
    frameOpenNone: 'Hiện nhẹ',
    frameOpenFade: 'Hiện dần',
    frameOpenBloom: 'Nở ra',
    frameOpenAssemble: 'Ghép lại',
    frameShapeLabel: 'Hình lỗ khung',
    frameShapeCircle: 'Tròn',
    frameShapeEllipse: 'Elip',
    frameShapeHeart: 'Trái tim',
    frameShapeArch: 'Vòm',
    frameShapeDiamond: 'Thoi',
    frameShapeRounded: 'Chữ nhật',
  },
  weddingCardPublic: {
    invitation: 'Thiệp mời / Invitation',
    openInvitation: 'Mở thiệp',
    openEnvelope: 'Mở phong bì',
    navInvitation: 'Thiệp',
    navEvent: 'Sự kiện',
    navStory: 'Câu chuyện',
    navRsvp: 'Khách mời',
    cordiallyInvites: 'Thân mời',
    guestInviteVenueGroom: 'Đến tại nhà trai',
    guestInviteVenueBride: 'Đến tại nhà gái',
    guestInviteVenueNone: '— Chưa chọn —',
    guestInviteViewMap: 'Xem địa chỉ trên Google Maps',
    weddingInvitation: 'Wedding Invitation',
    dateFallback: 'Ngày cưới',
    timeFallback: 'Giờ cưới',
    defaultInvitation: 'Trân trọng kính mời quý khách đến dự lễ thành hôn của {couple}.',
    defaultCoupleIntro: 'Cảm ơn bạn đã hiện diện trong ngày đặc biệt của {couple} và cùng chúng tôi lưu giữ khoảnh khắc yêu thương này.',
    familiesIntro: 'Gia đình hai bên',
    groomFamily: 'Nhà trai',
    brideFamily: 'Nhà gái',
    groomRole: 'Chú rể',
    brideRole: 'Cô dâu',
    letterViewAsk: 'Xem thiệp nhà nào?',
    letterViewBoth: 'Gộp 2 nhà',
    hometownLabel: 'Quê quán',
    coupleIntroTitle: 'Câu chuyện của chúng tôi',
    timelineTitle: 'Lịch trình buổi tiệc',
    defaultTimeline: 'Đón khách, chụp ảnh lưu niệm và cùng nâng ly chúc mừng trong không gian ấm áp của ngày cưới.',
    dressCodeTitle: 'Dress code',
    musicTitle: 'Nhạc nền thiệp',
    openMaps: 'Mở Google Maps',
    storyTitle: 'Album / Story',
    albumTitle: 'Album ảnh cô dâu chú rể',
    albumHint: 'Vuốt ngang hoặc bấm mũi tên để xem từng ảnh.',
    albumAlt: 'Ảnh album cưới',
    rsvpTitle: 'Xác nhận tham dự',
    guestNameLabel: 'Họ tên',
    guestNamePlaceholder: 'Tên của bạn',
    attendYes: 'Sẽ tham dự',
    attendNo: 'Không tham dự',
    coverAttendYes: 'Có đi',
    coverAttendNo: 'Không đi',
    coverRsvpSavedYes: 'Đã xác nhận có đi',
    coverRsvpSavedNo: 'Đã xác nhận không đi',
    guestCountLabel: 'Số khách',
    rsvpAdultLabel: 'Số người lớn đi cùng',
    rsvpChildLabel: 'Số trẻ con đi cùng',
    coverPartyConfirm: 'Xác nhận',
    coverPartyClose: 'Đóng',
    coverReminderOptIn: 'Nhắc lịch cưới (tùy chọn)',
    wishLabel: 'Lời chúc',
    wishPlaceholder: 'Gửi lời chúc đến cô dâu chú rể...',
    wishPresetOpen: 'Câu chúc có sẵn',
    wishPresetList:
      'Chúc hai bạn trăm năm hạnh phúc, luôn bên nhau thật lâu.\nChúc cô dâu chú rể sớm có tổ ấm bình an và đủ đầy.\nChúc mừng ngày trọng đại. Mong hai bạn luôn cười thật tươi.\nChúc hai bạn sức khỏe, bình an và hạnh phúc mãi mãi.\nCảm ơn lời mời. Chúc ngày cưới thật trọn vẹn và đáng nhớ.\nChúc hai bạn luôn đồng lòng, cùng đi hết những ngày đẹp nhất.',
    submitResponse: 'Gửi phản hồi',
    submitErrorTitle: 'Chưa gửi được',
    submitSuccessTitle: 'Cảm ơn bạn!',
    submitSuccessDesc: 'Phản hồi đã được ghi nhận.',
    wishesTitle: 'Lời chúc',
    noWishes: 'Quý khách là niềm vinh hạnh của gia đình hai bên và ngày cưới {couple} — sự hiện diện của bạn là món quà quý giá nhất.',
    noWishesPersonal: '{guest} là khách quý đối với gia đình hai bên và ngày cưới {couple} — sự có mặt của {guest} là niềm vinh hạnh lớn lao.',
    thankYouTitle: 'Trân trọng cảm ơn',
    defaultThankYou:
      '{couple} xin chân thành cảm ơn quý gia đình, người thân, bạn bè và toàn thể quý khách đã dành thời gian quý báu đến chung vui trong ngày trọng đại của chúng tôi.\n\nSự hiện diện, lời chúc phúc và tình cảm của mọi người là món quà vô cùng ý nghĩa, giúp ngày cưới của chúng tôi trở nên trọn vẹn và đáng nhớ hơn.\n\nKính chúc quý khách thật nhiều sức khỏe, bình an và hạnh phúc.',
    closeGallery: 'Đóng · về thiệp',
    coverPhotoAlt: 'Ảnh cặp đôi trên vỏ thiệp',
    contactLabel: 'Liên hệ',
    addToGoogleCalendar: 'Thêm vào Google Calendar',
    downloadCalendarFile: 'Tải file lịch (.ics)',
    shareZalo: 'Chia sẻ Zalo',
    calendarEventTitle: 'Tiệc cưới {groom} & {bride}',
    calendarEventDescription: 'Trân trọng kính mời bạn đến dự lễ thành hôn của {couple}.',
    reminderTitle: 'Nhắc lịch đám cưới',
    reminderHint: 'Nhập email và số ngày trước ngày cưới — hệ thống sẽ gửi mail nhắc kèm nút xem lại thiệp.',
    reminderEmailLabel: 'Email nhận nhắc',
    reminderEmailPlaceholder: 'email@example.com',
    reminderDaysLabel: 'Nhắc trước bao nhiêu ngày?',
    reminderDaysPlaceholder: 'Ví dụ: 3',
    reminderDaysHint: 'Từ 1 đến 90 ngày trước ngày cưới.',
    reminderSubmit: 'Đăng ký nhắc lịch',
    reminderSuccessTitle: 'Đã đăng ký nhắc lịch',
    reminderSuccessDesc: 'Chúng tôi sẽ gửi email nhắc trước {days} ngày kèm link mở thiệp cưới.',
    reminderErrorTitle: 'Chưa đăng ký được',
    reminderErrorInvalidEmail: 'Vui lòng nhập email hợp lệ.',
    reminderErrorInvalidDays: 'Số ngày nhắc phải từ 1 đến 90.',
    reminderErrorNoDate: 'Thiệp chưa có ngày cưới để đặt nhắc lịch.',
    reminderErrorPassed: 'Ngày cưới đã qua, không thể đăng ký nhắc lịch.',
    reminderErrorDaysTooLarge: 'Số ngày nhắc phải nhỏ hơn số ngày còn lại đến ngày cưới.',
    reminderErrorGeneric: 'Không thể đăng ký nhắc lịch. Vui lòng thử lại.',
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
const DICTIONARIES: Partial<Record<WebLocale, Dictionary>> = { vi: VI_DICTIONARY }

/**
 * Only Vietnamese ships in the browser bundle (~1/5 of all copy). The server keeps every
 * locale; browsers on another locale load `/i18n-dict/<locale>` (blocking, cached) before
 * hydration, which fills `window.__NANOAI_DICTS__`.
 */
if (typeof window === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Object.assign(DICTIONARIES, require('@/lib/i18n/dictionary-extra-locales').EXTRA_LOCALE_DICTIONARIES)
}

declare global {
  interface Window {
    __NANOAI_DICTS__?: Partial<Record<WebLocale, Dictionary>>
  }
}

export function getDictionary(locale: WebLocale | null | undefined): Dictionary {
  if (!locale) return VI_DICTIONARY
  const hit = DICTIONARIES[locale]
  if (hit) return hit
  if (typeof window !== 'undefined') {
    const loaded = window.__NANOAI_DICTS__?.[locale] || loadClientDictionarySync(locale)
    if (loaded) {
      DICTIONARIES[locale] = loaded
      return loaded
    }
  }
  return DICTIONARIES[DEFAULT_WEB_LOCALE] || VI_DICTIONARY
}

/** Safety net when a page renders a locale the root layout did not preload (copy must never fall back). */
function loadClientDictionarySync(locale: WebLocale): Dictionary | undefined {
  try {
    const xhr = new XMLHttpRequest()
    xhr.open('GET', `/api/i18n-dict/${locale}`, false)
    xhr.send()
    if (xhr.status !== 200) return undefined
    new Function(xhr.responseText)()
    return window.__NANOAI_DICTS__?.[locale]
  } catch {
    return undefined
  }
}

export function hasDictionaryLoaded(locale: WebLocale): boolean {
  return Boolean(DICTIONARIES[locale] || (typeof window !== 'undefined' && window.__NANOAI_DICTS__?.[locale]))
}
