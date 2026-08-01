import type { WebLocale } from '@/lib/i18n/config'

export type PartnerWebsiteCopy = {
  pageTitle: string
  pageDescription: string
  selectPartner: string
  noPartnerTitle: string
  noPartnerBody: string
  createChannelLink: string
  generateSectionTitle: string
  generateSectionHint: string
  titleLabel: string
  briefLabel: string
  briefPlaceholder: string
  briefTooShort: string
  logoLabel: string
  logoHint: string
  logoUrlPlaceholder: string
  logoUpload: string
  logoRemove: string
  refImagesLabel: string
  refImagesHint: string
  refImagesUpload: string
  refImagesPlaceholder: string
  refImageRemove: string
  imageInvalidType: string
  uploadFailed: string
  generateButton: string
  generating: string
  generateSuccess: string
  fallbackGenerated: string
  publishSectionTitle: string
  publishSectionHint: string
  emptyState: string
  autoProvisionTitle: string
  autoProvisionHint: string
  provisioning: string
  publishedBadge: string
  draftBadge: string
  slugLabel: string
  filesGenerated: string
  publishToView: string
  publishButton: string
  unpublishButton: string
  publishSuccess: string
  unpublishSuccess: string
  previewButton: string
  publishNoteDeploy: string
  previewTitle: string
  previewEmpty: string
  viewDesktop: string
  viewTablet: string
  viewMobile: string
  previewPublicLink: string
  openChatLink: string
  fileTreeTitle: string
  fileTreeHint: string
  fileTreeEmpty: string
  errorGeneric: string
  chatSectionTitle: string
  chatSectionHint: string
  chatModelLabel: string
  chatInputPlaceholder: string
  chatSend: string
  chatThinking: string
  chatWelcome: string
  chatWelcomeExisting: string
  chatMessageTooShort: string
  chatAssetsToggle: string
  chatAssetsHide: string
  chatSuggestCreate: string
  chatSuggestEditHero: string
  chatSuggestEditColor: string
  quickEditButton: string
  quickEditHeroColor: string
  quickEditHeroTitle: string
  quickEditAddFaq: string
  quickEditChatCta: string
  quickEditMobile: string
  quickEditFooter: string
  restoreButton: string
  revisionHistory: string
  restoreSuccess: string
  restoreNone: string
  restoring: string
  viewCode: string
  viewDiff: string
  diffTitle: string
  diffEmpty: string
  agentStepsTitle: string
  fileChanged: string
  templateModeBadge: string
  sectionsPanelTitle: string
  sectionsPanelHint: string
  sectionsPanelLockedNote: string
  leadsPanelTitle: string
  leadsPanelHint: string
  leadsEmpty: string
  leadsLoading: string
  leadsMarkRead: string
  tenantNavEditor: string
  tenantNavLeads: string
  tenantNavSections: string
  tenantNavPublicSite: string
  noWebsitePermTitle: string
  noWebsitePermBody: string
  legacyMigrateTitle: string
  legacyMigrateHint: string
  legacyMigrateButton: string
  legacyMigrating: string
  legacyMigrateSuccess: string
  legacyMigrateAlready: string
}

const COPY: Record<WebLocale, PartnerWebsiteCopy> = {
  vi: {
    pageTitle: 'Tạo web & landing',
    pageDescription:
      'Chat AI bên trái để chỉnh giao diện; tab bên dưới quản lý lead, block và publish.',
    selectPartner: 'Chọn kênh bán hàng',
    noPartnerTitle: 'Chưa có kênh bán hàng',
    noPartnerBody: 'Tạo workspace nhắn tin trước, sau đó quay lại để tạo website cho shop.',
    createChannelLink: 'Tạo kênh bán hàng',
    generateSectionTitle: 'AI tạo dự án web',
    generateSectionHint:
      'Mỗi lần tạo sẽ sinh các file index.html, css/main.css, js/main.js (và file phụ nếu cần).',
    titleLabel: 'Tên website / thương hiệu',
    briefLabel: 'Mô tả yêu cầu',
    briefPlaceholder:
      'Ví dụ:\nShop thời trang nữ\nƯu điểm: form đẹp, giao nhanh\nKhách: nữ 20–35 tuổi\nPhong cách: tối giản, màu be\nCTA: chat mua hàng',
    briefTooShort: 'Mô tả cần ít nhất vài dòng để AI hiểu yêu cầu.',
    logoLabel: 'Logo thương hiệu',
    logoHint: 'Tải file logo hoặc dán link ảnh — AI ghép vào header website.',
    logoUrlPlaceholder: 'https://... hoặc bấm Tải logo',
    logoUpload: 'Tải logo',
    logoRemove: 'Xóa logo',
    refImagesLabel: 'Ảnh tham khảo',
    refImagesHint: 'Tải ảnh mẫu hoặc dán link (mỗi dòng một URL). Tối đa 8 ảnh.',
    refImagesUpload: 'Tải ảnh tham khảo',
    refImagesPlaceholder: 'https://...\nhttps://...',
    refImageRemove: 'Xóa ảnh',
    imageInvalidType: 'Chỉ chấp nhận file ảnh.',
    uploadFailed: 'Tải ảnh thất bại.',
    generateButton: 'Tạo dự án web bằng AI',
    generating: 'Đang tạo dự án…',
    generateSuccess: 'Đã tạo dự án web',
    fallbackGenerated: 'AI chưa chỉnh được — xem tin nhắn chat để biết chi tiết.',
    publishSectionTitle: 'Publish website',
    publishSectionHint: 'Sau khi publish, khách truy cập qua /site/[slug].',
    emptyState: 'Đang tải website shop…',
    autoProvisionTitle: 'Đã tạo landing shop sẵn dùng',
    autoProvisionHint:
      'Website mẫu đầy đủ block đã sẵn sàng — gõ yêu cầu bên trái để chỉnh giao diện (màu, text, section). Backend do NanoAI quản lý.',
    provisioning: 'Đang tạo website mẫu…',
    publishedBadge: 'Đang public',
    draftBadge: 'Nháp',
    slugLabel: 'Slug',
    filesGenerated: 'Số file',
    publishToView: 'Publish để có link công khai.',
    publishButton: 'Publish website',
    unpublishButton: 'Gỡ publish',
    publishSuccess: 'Website đã được publish.',
    unpublishSuccess: 'Website đã gỡ khỏi public.',
    previewButton: 'Xem thử (tab mới)',
    publishNoteDeploy:
      'Link /site/... công khai cần deploy code + migration trên server. Xem trước ngay bên dưới không cần publish.',
    previewTitle: 'Xem trước website',
    previewEmpty: 'Tạo dự án web để xem preview tại đây.',
    viewDesktop: 'Desktop',
    viewTablet: 'Máy tính bảng',
    viewMobile: 'Mobile',
    previewPublicLink: 'Link công khai',
    openChatLink: 'Mở chat shop',
    fileTreeTitle: 'Cấu trúc dự án',
    fileTreeHint: 'Các file do AI tạo — xem nội dung từng file bên dưới.',
    fileTreeEmpty: 'Chưa có file — chat để AI tạo dự án web.',
    errorGeneric: 'Không thực hiện được. Thử lại sau.',
    chatSectionTitle: 'Chat tạo & chỉnh web',
    chatSectionHint: 'Chat với AI — mỗi lần gửi sẽ cập nhật preview bên phải ngay lập tức.',
    chatModelLabel: 'Model AI',
    chatInputPlaceholder: 'Mô tả website hoặc yêu cầu chỉnh sửa…',
    chatSend: 'Gửi',
    chatThinking: 'AI đang tạo / chỉnh website…',
    chatWelcome:
      'Landing shop đã sẵn sàng! Gõ yêu cầu để chỉnh giao diện — ví dụ: "Đổi màu hero cam", "Thêm FAQ". Chỉ sửa phần hiển thị; chat & form dùng backend có sẵn.',
    chatWelcomeExisting:
      'Chỉnh giao diện bằng chat — màu, nội dung, block. Backend (chat, form, sản phẩm từ kho) do NanoAI quản lý.',
    chatMessageTooShort: 'Tin nhắn quá ngắn — mô tả rõ hơn một chút.',
    chatAssetsToggle: 'Logo & ảnh tham khảo',
    chatAssetsHide: 'Ẩn logo & ảnh',
    chatSuggestCreate: 'Tạo landing shop thời trang',
    chatSuggestEditHero: 'Đổi tiêu đề hero sang màu cam',
    chatSuggestEditColor: 'Thêm section FAQ và nút chat',
    quickEditButton: 'Sửa nhanh',
    quickEditHeroColor: 'Đổi màu hero',
    quickEditHeroTitle: 'Viết lại tiêu đề hero',
    quickEditAddFaq: 'Thêm FAQ',
    quickEditChatCta: 'Thêm nút chat mua hàng',
    quickEditMobile: 'Tối ưu giao diện mobile',
    quickEditFooter: 'Chỉnh footer',
    restoreButton: 'Quay lại bản trước',
    revisionHistory: 'Lịch sử phiên bản',
    restoreSuccess: 'Đã khôi phục bản trước — xem preview bên phải.',
    restoreNone: 'Chưa có bản lưu. Từ giờ mỗi lần AI chỉnh web sẽ tự lưu snapshot.',
    restoring: 'Đang khôi phục…',
    viewCode: 'Code',
    viewDiff: 'Diff',
    diffTitle: 'Thay đổi dòng code',
    diffEmpty: 'Chọn file đã sửa để xem diff.',
    agentStepsTitle: 'Agent',
    fileChanged: 'đã sửa',
    templateModeBadge: 'Template (chỉ giao diện)',
    sectionsPanelTitle: 'Block giao diện',
    sectionsPanelHint: 'Khách chỉnh qua chat — backend/chat do NanoAI quản lý.',
    sectionsPanelLockedNote: 'Nút chat & xử lý đơn hàng nằm trong code platform — không sửa được từ đây.',
    leadsPanelTitle: 'Lead từ form website',
    leadsPanelHint: 'Khách gửi từ form liên hệ trên landing — xử lý qua inbox/điện thoại.',
    leadsEmpty: 'Chưa có lead nào.',
    leadsLoading: 'Đang tải lead…',
    leadsMarkRead: 'Đã xử lý',
    tenantNavEditor: 'Chỉnh web',
    tenantNavLeads: 'Lead form',
    tenantNavSections: 'Block giao diện',
    tenantNavPublicSite: 'Xem site công khai',
    noWebsitePermTitle: 'Chưa có quyền quản trị website',
    noWebsitePermBody:
      'Chủ workspace cần bật quyền "Website & landing shop" cho nhân viên trong Cài đặt → Nhóm.',
    legacyMigrateTitle: 'Website đang ở chế độ code cũ (legacy)',
    legacyMigrateHint:
      'Chuyển sang landing shop template đầy đủ block — chat chỉnh giao diện dễ hơn, form lead & chat CTA tích hợp sẵn. Giữ slug và trạng thái publish.',
    legacyMigrateButton: 'Chuyển sang landing template',
    legacyMigrating: 'Đang chuyển…',
    legacyMigrateSuccess: 'Đã chuyển sang landing template — xem preview bên phải.',
    legacyMigrateAlready: 'Website đã ở chế độ template.',
  },
  en: {
    pageTitle: 'Website & landing builder',
    pageDescription:
      'Edit the site with AI chat on the left; use the tabs below for leads, blocks, and publish.',
    selectPartner: 'Select sales channel',
    noPartnerTitle: 'No sales channel yet',
    noPartnerBody: 'Create a messaging workspace first, then return here to build your shop website.',
    createChannelLink: 'Create sales channel',
    generateSectionTitle: 'AI web project',
    generateSectionHint: 'Each run creates index.html, css/main.css, js/main.js (plus extras when needed).',
    titleLabel: 'Website / brand name',
    briefLabel: 'Requirements brief',
    briefPlaceholder:
      'Example:\nWomen fashion boutique\nValue: great fit, fast shipping\nAudience: women 20–35\nStyle: minimal, beige palette\nCTA: chat to buy',
    briefTooShort: 'Brief must be at least a few lines for AI to understand.',
    logoLabel: 'Brand logo',
    logoHint: 'Upload a logo file or paste an image URL — AI uses it in the site header.',
    logoUrlPlaceholder: 'https://... or click Upload logo',
    logoUpload: 'Upload logo',
    logoRemove: 'Remove logo',
    refImagesLabel: 'Reference images',
    refImagesHint: 'Upload sample images or paste URLs (one per line). Max 8 images.',
    refImagesUpload: 'Upload reference images',
    refImagesPlaceholder: 'https://...\nhttps://...',
    refImageRemove: 'Remove image',
    imageInvalidType: 'Images only.',
    uploadFailed: 'Upload failed.',
    generateButton: 'Generate web project with AI',
    generating: 'Generating project…',
    generateSuccess: 'Web project created',
    fallbackGenerated: 'Used fallback HTML template (AI did not respond).',
    publishSectionTitle: 'Publish website',
    publishSectionHint: 'After publish, visitors open /site/[slug].',
    emptyState: 'Loading your shop website…',
    autoProvisionTitle: 'Ready-to-use shop landing created',
    autoProvisionHint:
      'Full template is ready — type on the left to edit UI (colors, copy, sections). Backend is managed by NanoAI.',
    provisioning: 'Creating default website…',
    publishedBadge: 'Live',
    draftBadge: 'Draft',
    slugLabel: 'Slug',
    filesGenerated: 'Files',
    publishToView: 'Publish to get a public URL.',
    publishButton: 'Publish website',
    unpublishButton: 'Unpublish',
    publishSuccess: 'Website is live.',
    unpublishSuccess: 'Website unpublished.',
    previewButton: 'Preview (new tab)',
    publishNoteDeploy:
      'Public /site/... links need production deploy. Live preview below works without publish.',
    previewTitle: 'Website preview',
    previewEmpty: 'Generate a project to preview here.',
    viewDesktop: 'Desktop',
    viewTablet: 'Tablet',
    viewMobile: 'Mobile',
    previewPublicLink: 'Public link',
    openChatLink: 'Open shop chat',
    fileTreeTitle: 'Project files',
    fileTreeHint: 'AI-generated files — select a path to view content.',
    fileTreeEmpty: 'No files yet — chat with AI to generate the web project.',
    errorGeneric: 'Something went wrong. Try again.',
    chatSectionTitle: 'Chat to build & edit',
    chatSectionHint: 'Chat with AI — each message updates the live preview on the right.',
    chatModelLabel: 'AI model',
    chatInputPlaceholder: 'Describe your site or request edits…',
    chatSend: 'Send',
    chatThinking: 'AI is building / updating your site…',
    chatWelcome:
      'Your shop landing is ready! Type to edit UI — e.g. "Change hero to orange", "Add FAQ". Display only; chat & forms use the platform backend.',
    chatWelcomeExisting:
      'Edit the UI via chat — colors, copy, blocks. Backend (chat, forms, inventory products) is managed by NanoAI.',
    chatMessageTooShort: 'Message too short — add a bit more detail.',
    chatAssetsToggle: 'Logo & reference images',
    chatAssetsHide: 'Hide logo & images',
    chatSuggestCreate: 'Create a fashion shop landing',
    chatSuggestEditHero: 'Change hero headline to orange theme',
    chatSuggestEditColor: 'Add FAQ section and chat button',
    quickEditButton: 'Quick edit',
    quickEditHeroColor: 'Change hero color',
    quickEditHeroTitle: 'Rewrite hero headline',
    quickEditAddFaq: 'Add FAQ section',
    quickEditChatCta: 'Add shop chat button',
    quickEditMobile: 'Optimize for mobile',
    quickEditFooter: 'Update footer',
    restoreButton: 'Restore previous version',
    revisionHistory: 'Version history',
    restoreSuccess: 'Previous version restored — check the preview.',
    restoreNone: 'No saved versions yet. Snapshots are saved on each AI edit from now on.',
    restoring: 'Restoring…',
    viewCode: 'Code',
    viewDiff: 'Diff',
    diffTitle: 'Line changes',
    diffEmpty: 'Select a changed file to view diff.',
    agentStepsTitle: 'Agent',
    fileChanged: 'changed',
    templateModeBadge: 'Template (UI only)',
    sectionsPanelTitle: 'UI blocks',
    sectionsPanelHint: 'Edit via chat — chat/backend is managed by NanoAI platform.',
    sectionsPanelLockedNote: 'Chat button & order logic live in platform code — not editable here.',
    leadsPanelTitle: 'Website form leads',
    leadsPanelHint: 'Submitted from the landing contact form.',
    leadsEmpty: 'No leads yet.',
    leadsLoading: 'Loading leads…',
    leadsMarkRead: 'Mark handled',
    tenantNavEditor: 'Edit site',
    tenantNavLeads: 'Form leads',
    tenantNavSections: 'UI blocks',
    tenantNavPublicSite: 'View public site',
    noWebsitePermTitle: 'No website admin access',
    noWebsitePermBody:
      'The workspace owner must enable "Website & landing shop" for staff in Settings → Team.',
    legacyMigrateTitle: 'Site is on legacy HTML mode',
    legacyMigrateHint:
      'Switch to the full landing template — easier AI UI edits, built-in lead form and chat CTA. Keeps slug and publish state.',
    legacyMigrateButton: 'Switch to landing template',
    legacyMigrating: 'Migrating…',
    legacyMigrateSuccess: 'Switched to landing template — check the preview.',
    legacyMigrateAlready: 'Site is already on template mode.',
  },
  zh: {
    pageTitle: '网站与落地页',
    pageDescription: '左侧 AI 聊天编辑网站；下方标签管理线索、区块与发布。',
    selectPartner: '选择销售渠道',
    noPartnerTitle: '尚无销售渠道',
    noPartnerBody: '请先创建消息 workspace，再回来创建店铺网站。',
    createChannelLink: '创建销售渠道',
    generateSectionTitle: 'AI 网页项目',
    generateSectionHint: '每次生成 index.html、css/main.css、js/main.js 等文件。',
    titleLabel: '网站/品牌名称',
    briefLabel: '需求说明',
    briefPlaceholder: '示例：女装店、简约风格、目标用户、主色、CTA 聊天购买',
    briefTooShort: '说明至少需要几行文字。',
    logoLabel: '品牌 Logo',
    logoHint: '上传 Logo 或粘贴图片链接 — AI 用于网站页眉。',
    logoUrlPlaceholder: 'https://... 或点击上传 Logo',
    logoUpload: '上传 Logo',
    logoRemove: '删除 Logo',
    refImagesLabel: '参考图',
    refImagesHint: '上传参考图或粘贴链接（每行一个）。最多 8 张。',
    refImagesUpload: '上传参考图',
    refImagesPlaceholder: 'https://...',
    refImageRemove: '删除图片',
    imageInvalidType: '仅支持图片文件。',
    uploadFailed: '上传失败。',
    generateButton: 'AI 生成网页项目',
    generating: '正在生成…',
    generateSuccess: '已创建网页项目',
    fallbackGenerated: '已使用备用 HTML 模板。',
    publishSectionTitle: '发布网站',
    publishSectionHint: '发布后访问 /site/[slug]。',
    emptyState: '正在加载网站…',
    autoProvisionTitle: '已创建可用店铺落地页',
    autoProvisionHint: '完整模板已就绪 — 在左侧输入以编辑界面。后端由 NanoAI 管理。',
    provisioning: '正在创建默认网站…',
    publishedBadge: '已发布',
    draftBadge: '草稿',
    slugLabel: 'Slug',
    filesGenerated: '文件数',
    publishToView: '发布后可获得公开链接。',
    publishButton: '发布网站',
    unpublishButton: '取消发布',
    publishSuccess: '网站已发布。',
    unpublishSuccess: '已取消发布。',
    previewButton: '新标签预览',
    publishNoteDeploy: '公开链接需部署。下方可即时预览，无需发布。',
    previewTitle: '网站预览',
    previewEmpty: '生成项目后可在此预览。',
    viewDesktop: '桌面',
    viewTablet: '平板',
    viewMobile: '手机',
    previewPublicLink: '公开链接',
    openChatLink: '打开店铺聊天',
    fileTreeTitle: '项目结构',
    fileTreeHint: 'AI 生成的文件列表。',
    fileTreeEmpty: '尚无文件 — 通过聊天让 AI 生成网站项目。',
    errorGeneric: '操作失败，请重试。',
    chatSectionTitle: '聊天创建与编辑',
    chatSectionHint: '与 AI 对话 — 每次发送立即更新右侧预览。',
    chatModelLabel: 'AI 模型',
    chatInputPlaceholder: '描述网站或提出修改…',
    chatSend: '发送',
    chatThinking: 'AI 正在生成/更新网站…',
    chatWelcome: '落地页已就绪！输入要求修改界面（颜色、文案、区块）。聊天与表单使用平台后端。',
    chatWelcomeExisting: '已有网站。可要求改颜色、文案、布局… 右侧预览即时更新。',
    chatMessageTooShort: '消息太短 — 请补充说明。',
    chatAssetsToggle: 'Logo 与参考图',
    chatAssetsHide: '隐藏 Logo 与参考图',
    chatSuggestCreate: '创建时尚店铺落地页',
    chatSuggestEditHero: '将主标题改为橙色主题',
    chatSuggestEditColor: '添加 FAQ 与聊天按钮',
    quickEditButton: '快速编辑',
    quickEditHeroColor: '更改主视觉颜色',
    quickEditHeroTitle: '重写主标题',
    quickEditAddFaq: '添加 FAQ',
    quickEditChatCta: '添加聊天购买按钮',
    quickEditMobile: '优化移动端',
    quickEditFooter: '更新页脚',
    restoreButton: '恢复上一版本',
    revisionHistory: '版本历史',
    restoreSuccess: '已恢复上一版本 — 请查看预览。',
    restoreNone: '尚无保存版本。此后每次 AI 修改都会自动保存快照。',
    restoring: '正在恢复…',
    viewCode: '代码',
    viewDiff: 'Diff',
    diffTitle: '行级变更',
    diffEmpty: '选择已修改文件查看 diff。',
    agentStepsTitle: 'Agent',
    fileChanged: '已修改',
    templateModeBadge: '模板（仅 UI）',
    sectionsPanelTitle: 'UI 区块',
    sectionsPanelHint: '通过聊天编辑 — 聊天/后端由 NanoAI 平台管理。',
    sectionsPanelLockedNote: '聊天按钮与订单逻辑在平台代码中 — 此处不可编辑。',
    leadsPanelTitle: '表单线索',
    leadsPanelHint: '来自落地页联系表单。',
    leadsEmpty: '暂无线索。',
    leadsLoading: '加载中…',
    leadsMarkRead: '已处理',
    tenantNavEditor: '编辑网站',
    tenantNavLeads: '表单线索',
    tenantNavSections: '界面区块',
    tenantNavPublicSite: '查看公开站点',
    noWebsitePermTitle: '暂无网站管理权限',
    noWebsitePermBody: '工作区所有者需在设置 → 团队中为员工开启「网站与落地页」权限。',
    legacyMigrateTitle: '网站处于旧版 HTML 模式',
    legacyMigrateHint: '切换到完整落地页模板 — AI 编辑更方便，内置表单线索与聊天按钮。保留 slug 与发布状态。',
    legacyMigrateButton: '切换到落地页模板',
    legacyMigrating: '正在切换…',
    legacyMigrateSuccess: '已切换到落地页模板 — 请查看预览。',
    legacyMigrateAlready: '网站已是模板模式。',
  },
  ja: {
    pageTitle: 'Web・ランディング作成',
    pageDescription: '左のAIチャットで編集。下のタブでリード・ブロック・公開を管理。',
    selectPartner: '販売チャネルを選択',
    noPartnerTitle: '販売チャネルがありません',
    noPartnerBody: '先にメッセージworkspaceを作成してください。',
    createChannelLink: 'チャネルを作成',
    generateSectionTitle: 'AI Webプロジェクト',
    generateSectionHint: 'index.html、css/main.css、js/main.js などを生成します。',
    titleLabel: 'サイト/ブランド名',
    briefLabel: '要件',
    briefPlaceholder: '例：店舗概要、強み、ターゲット、トーン、CTA',
    briefTooShort: '要件は数行以上入力してください。',
    logoLabel: 'ブランドロゴ',
    logoHint: 'ロゴファイルまたは画像URL — サイトヘッダーに使用。',
    logoUrlPlaceholder: 'https://... またはロゴをアップロード',
    logoUpload: 'ロゴをアップロード',
    logoRemove: 'ロゴを削除',
    refImagesLabel: '参考画像',
    refImagesHint: '参考画像をアップロードまたはURLを貼付（1行1URL）。最大8枚。',
    refImagesUpload: '参考画像をアップロード',
    refImagesPlaceholder: 'https://...',
    refImageRemove: '画像を削除',
    imageInvalidType: '画像ファイルのみ。',
    uploadFailed: 'アップロードに失敗しました。',
    generateButton: 'AIでWebプロジェクト生成',
    generating: '生成中…',
    generateSuccess: 'プロジェクトを作成しました',
    fallbackGenerated: 'フォールバックHTMLを使用しました。',
    publishSectionTitle: '公開',
    publishSectionHint: '公開後 /site/[slug] でアクセス。',
    emptyState: 'サイトを読み込み中…',
    autoProvisionTitle: 'ショップLPを作成しました',
    autoProvisionHint: 'テンプレート完成 — 左のチャットでUI編集。バックエンドはプラットフォーム管理。',
    provisioning: 'デフォルトサイト作成中…',
    publishedBadge: '公開中',
    draftBadge: '下書き',
    slugLabel: 'Slug',
    filesGenerated: 'ファイル数',
    publishToView: '公開するとURLが表示されます。',
    publishButton: 'サイトを公開',
    unpublishButton: '公開解除',
    publishSuccess: '公開しました。',
    unpublishSuccess: '公開を解除しました。',
    previewButton: '別タブでプレビュー',
    publishNoteDeploy: '公開URLはデプロイが必要。下のプレビューは公開前でも表示できます。',
    previewTitle: 'サイトプレビュー',
    previewEmpty: 'プロジェクト生成後にここでプレビュー。',
    viewDesktop: 'デスクトップ',
    viewTablet: 'タブレット',
    viewMobile: 'モバイル',
    previewPublicLink: '公開リンク',
    openChatLink: 'ショップチャット',
    fileTreeTitle: 'プロジェクト構成',
    fileTreeHint: 'AIが生成したファイル一覧。',
    fileTreeEmpty: 'ファイルがありません — チャットでWebプロジェクトを生成してください。',
    errorGeneric: 'エラーが発生しました。',
    chatSectionTitle: 'チャットで作成・編集',
    chatSectionHint: 'AIとチャット — 送信のたびに右のプレビューが更新されます。',
    chatModelLabel: 'AIモデル',
    chatInputPlaceholder: 'サイトの説明または修正依頼…',
    chatSend: '送信',
    chatThinking: 'AIがサイトを生成/更新中…',
    chatWelcome: 'LP準備完了！UI変更はチャットで（色・文案・セクション）。チャット/フォームはプラットフォーム后端。',
    chatWelcomeExisting: 'サイトは既にあります。色・文案・レイアウトの変更を依頼できます。',
    chatMessageTooShort: 'メッセージが短すぎます。',
    chatAssetsToggle: 'ロゴと参考画像',
    chatAssetsHide: 'ロゴと画像を隠す',
    chatSuggestCreate: 'ファッションショップのLPを作成',
    chatSuggestEditHero: 'ヒーローをオレンジテーマに',
    chatSuggestEditColor: 'FAQとチャットボタンを追加',
    quickEditButton: 'クイック編集',
    quickEditHeroColor: 'ヒーローの色を変更',
    quickEditHeroTitle: 'ヒーロー見出しを書き直す',
    quickEditAddFaq: 'FAQを追加',
    quickEditChatCta: 'チャット購入ボタンを追加',
    quickEditMobile: 'モバイル最適化',
    quickEditFooter: 'フッターを更新',
    restoreButton: '前のバージョンに戻す',
    revisionHistory: 'バージョン履歴',
    restoreSuccess: '前のバージョンを復元しました。',
    restoreNone: '保存されたバージョンがありません。',
    restoring: '復元中…',
    viewCode: 'コード',
    viewDiff: 'Diff',
    diffTitle: '行の変更',
    diffEmpty: '変更ファイルを選択して diff を表示。',
    agentStepsTitle: 'Agent',
    fileChanged: '変更',
    templateModeBadge: 'テンプレート（UIのみ）',
    sectionsPanelTitle: 'UIブロック',
    sectionsPanelHint: 'チャットで編集 — チャット/バックエンドはプラットフォーム管理。',
    sectionsPanelLockedNote: 'チャットボタンと処理ロジックはプラットフォームコード — ここでは編集不可。',
    leadsPanelTitle: 'フォームリード',
    leadsPanelHint: 'ランディングのお問い合わせフォームから。',
    leadsEmpty: 'リードはまだありません。',
    leadsLoading: '読み込み中…',
    leadsMarkRead: '対応済み',
    tenantNavEditor: 'サイト編集',
    tenantNavLeads: 'フォームリード',
    tenantNavSections: 'UIブロック',
    tenantNavPublicSite: '公開サイト',
    noWebsitePermTitle: 'サイト管理権限がありません',
    noWebsitePermBody:
      'オーナーが設定 → チームで「ウェブサイト・ランディング」権限を付与する必要があります。',
    legacyMigrateTitle: 'レガシー HTML モードのサイト',
    legacyMigrateHint:
      'フルLPテンプレートに切替 — AI編集が容易、リードフォーム・チャットCTA内蔵。slugと公開状態を維持。',
    legacyMigrateButton: 'LPテンプレートに切替',
    legacyMigrating: '切替中…',
    legacyMigrateSuccess: 'LPテンプレートに切替しました — プレビューを確認。',
    legacyMigrateAlready: 'すでにテンプレートモードです。',
  },
  ko: {
    pageTitle: '웹·랜딩 페이지',
    pageDescription: '왼쪽 AI 채팅으로 편집. 아래 탭에서 리드·블록·게시를 관리합니다.',
    selectPartner: '판매 채널 선택',
    noPartnerTitle: '판매 채널 없음',
    noPartnerBody: '먼저 메시징 workspace를 만든 후 돌아오세요.',
    createChannelLink: '채널 만들기',
    generateSectionTitle: 'AI 웹 프로젝트',
    generateSectionHint: 'index.html, css/main.css, js/main.js 등을 생성합니다.',
    titleLabel: '사이트/브랜드명',
    briefLabel: '요구사항',
    briefPlaceholder: '예: shop 소개, 강점, 타깃, 스타일, CTA',
    briefTooShort: '요구사항을 몇 줄 이상 입력하세요.',
    logoLabel: '브랜드 로고',
    logoHint: '로고 파일 업로드 또는 이미지 URL — 사이트 헤더에 사용.',
    logoUrlPlaceholder: 'https://... 또는 로고 업로드',
    logoUpload: '로고 업로드',
    logoRemove: '로고 삭제',
    refImagesLabel: '참고 이미지',
    refImagesHint: '참고 이미지 업로드 또는 URL 붙여넣기(한 줄에 하나). 최대 8장.',
    refImagesUpload: '참고 이미지 업로드',
    refImagesPlaceholder: 'https://...',
    refImageRemove: '이미지 삭제',
    imageInvalidType: '이미지 파일만 가능합니다.',
    uploadFailed: '업로드 실패.',
    generateButton: 'AI로 웹 프로젝트 생성',
    generating: '생성 중…',
    generateSuccess: '프로젝트가 생성되었습니다',
    fallbackGenerated: '대체 HTML 템플릿을 사용했습니다.',
    publishSectionTitle: '게시',
    publishSectionHint: '게시 후 /site/[slug] 로 접속.',
    emptyState: '웹사이트 불러오는 중…',
    autoProvisionTitle: '샵 랜딩이 생성되었습니다',
    autoProvisionHint: '템플릿 준비 완료 — 왼쪽 채팅으로 UI 수정. 백엔드는 NanoAI 관리.',
    provisioning: '기본 사이트 생성 중…',
    publishedBadge: '게시됨',
    draftBadge: '초안',
    slugLabel: 'Slug',
    filesGenerated: '파일 수',
    publishToView: '게시하면 공개 URL이 표시됩니다.',
    publishButton: '웹사이트 게시',
    unpublishButton: '게시 취소',
    publishSuccess: '게시되었습니다.',
    unpublishSuccess: '게시가 취소되었습니다.',
    previewButton: '새 탭 미리보기',
    publishNoteDeploy: '공개 URL은 배포 필요. 아래 미리보기는 게시 없이 가능.',
    previewTitle: '웹사이트 미리보기',
    previewEmpty: '프로젝트 생성 후 여기서 미리보기.',
    viewDesktop: '데스크톱',
    viewTablet: '태블릿',
    viewMobile: '모바일',
    previewPublicLink: '공개 링크',
    openChatLink: '샵 채팅',
    fileTreeTitle: '프로젝트 구조',
    fileTreeHint: 'AI가 생성한 파일 목록.',
    fileTreeEmpty: '파일 없음 — 채팅으로 웹 프로젝트를 생성하세요.',
    errorGeneric: '오류가 발생했습니다.',
    chatSectionTitle: '채팅으로 생성·편집',
    chatSectionHint: 'AI와 대화 — 전송할 때마다 오른쪽 미리보기가 갱신됩니다.',
    chatModelLabel: 'AI 모델',
    chatInputPlaceholder: '사이트 설명 또는 수정 요청…',
    chatSend: '보내기',
    chatThinking: 'AI가 사이트 생성/수정 중…',
    chatWelcome: '랜딩 준비됨! UI 수정은 채팅으로 (색상, 문구, 섹션). 채팅/폼은 플랫폼 백엔드 사용.',
    chatWelcomeExisting: '이미 사이트가 있습니다. 색상, 문구, 레이아웃 수정을 요청하세요.',
    chatMessageTooShort: '메시지가 너무 짧습니다.',
    chatAssetsToggle: '로고 및 참고 이미지',
    chatAssetsHide: '로고·이미지 숨기기',
    chatSuggestCreate: '패션 shop 랜딩 생성',
    chatSuggestEditHero: '히어로를 오렌지 테마로',
    chatSuggestEditColor: 'FAQ와 채팅 버튼 추가',
    quickEditButton: '빠른 편집',
    quickEditHeroColor: '히어로 색상 변경',
    quickEditHeroTitle: '히어로 제목 다시 쓰기',
    quickEditAddFaq: 'FAQ 추가',
    quickEditChatCta: '채팅 구매 버튼 추가',
    quickEditMobile: '모바일 최적화',
    quickEditFooter: '푸터 업데이트',
    restoreButton: '이전 버전으로 복원',
    revisionHistory: '버전 기록',
    restoreSuccess: '이전 버전을 복원했습니다.',
    restoreNone: '저장된 버전이 없습니다.',
    restoring: '복원 중…',
    viewCode: '코드',
    viewDiff: 'Diff',
    diffTitle: '줄 변경',
    diffEmpty: '변경된 파일을 선택해 diff를 보세요.',
    agentStepsTitle: 'Agent',
    fileChanged: '변경됨',
    templateModeBadge: '템플릿 (UI만)',
    sectionsPanelTitle: 'UI 블록',
    sectionsPanelHint: '채팅으로 편집 — 채팅/백엔드는 NanoAI 플랫폼 관리.',
    sectionsPanelLockedNote: '채팅 버튼과 처리 로직은 플랫폼 코드 — 여기서 편집 불가.',
    leadsPanelTitle: '폼 리드',
    leadsPanelHint: '랜딩 문의 폼에서 접수.',
    leadsEmpty: '리드 없음.',
    leadsLoading: '로딩 중…',
    leadsMarkRead: '처리 완료',
    tenantNavEditor: '사이트 편집',
    tenantNavLeads: '폼 리드',
    tenantNavSections: 'UI 블록',
    tenantNavPublicSite: '공개 사이트',
    noWebsitePermTitle: '웹사이트 관리 권한 없음',
    noWebsitePermBody:
      '워크스페이스 소유자가 설정 → 팀에서 「웹사이트·랜딩」 권한을 켜야 합니다.',
    legacyMigrateTitle: '레거시 HTML 모드 사이트',
    legacyMigrateHint:
      '전체 랜딩 템플릿으로 전환 — AI UI 편집 용이, 리드 폼·채팅 CTA 내장. slug·게시 상태 유지.',
    legacyMigrateButton: '랜딩 템플릿으로 전환',
    legacyMigrating: '전환 중…',
    legacyMigrateSuccess: '랜딩 템플릿으로 전환됨 — 미리보기를 확인하세요.',
    legacyMigrateAlready: '이미 템플릿 모드입니다.',
  },
}

export function getPartnerWebsiteCopy(locale: WebLocale): PartnerWebsiteCopy {
  return COPY[locale] ?? COPY.vi
}
