import type { WebLocale } from '@/lib/i18n/config'
import type { LanguagePairCode } from '@/lib/hoc-ngoai-ngu/samples'
import { patchFreeLiveOffer } from '@/lib/english-coach-free-lessons'

export type LanguageLandingMode = {
  id: 'live' | 'preset' | 'words'
  name: string
  price: string
  detail: string
  href: string
  action: string
}

export type LanguageLandingCopy = {
  home: string
  eyebrow: string
  h1: string
  lead: string
  cta: string
  ctaSecondary: string
  factsTitle: string
  facts: Array<{ term: string; detail: string }>
  modesTitle: string
  modesLead: string
  modes: LanguageLandingMode[]
  switchNative: string
  switchTarget: string
  sampleTitle: string
  sampleLead: string
  roleTeacher: string
  roleLearner: string
  roleFix: string
  roleGloss: string
  stepsTitle: string
  steps: Array<{ name: string; text: string }>
  faqTitle: string
  faqs: Array<{ question: string; answer: string }>
  reviewTitle: string
  reviewLead: string
  reviewPlaceholder: string
  reviewSend: string
  reviewLogin: string
  reviewThanks: string
  reviewError: string
  closeTitle: string
  closeLead: string
  relatedHref: string
  relatedLabel: string
  secondRelatedHref?: string
  secondRelatedLabel?: string
  thirdRelatedHref?: string
  thirdRelatedLabel?: string
  fourthRelatedHref?: string
  fourthRelatedLabel?: string
  parentHref?: string
  parentLabel?: string
  langLabels: Record<LanguagePairCode, string>
}

const PATHS = {
  live: '/hoc-tieng-anh-ai/luyen-noi',
  preset: '/hoc-bai-hoc-co-san',
  words: '/hoc-tieng-anh-ai/tu-moi',
} as const

function withPrices(copy: LanguageLandingCopy, livePrice: string, presetPrice: string): LanguageLandingCopy {
  const fill = (value: string) => value.replaceAll('{live}', livePrice).replaceAll('{preset}', presetPrice)
  return {
    ...copy,
    lead: fill(copy.lead),
    facts: copy.facts.map((fact) => ({ term: fact.term, detail: fill(fact.detail) })),
    modes: copy.modes.map((mode) => ({ ...mode, price: fill(mode.price), detail: fill(mode.detail) })),
    steps: copy.steps.map((step) => ({ name: step.name, text: fill(step.text) })),
    faqs: copy.faqs.map((item) => ({ question: item.question, answer: fill(item.answer) })),
    closeLead: fill(copy.closeLead),
  }
}

const VI: LanguageLandingCopy = {
  home: 'Trang chủ',
  eyebrow: 'Học ngoại ngữ trên NanoAI',
  h1: 'Học ngoại ngữ AI, nói trực tiếp và được sửa lỗi',
  lead: 'Bạn chọn tiếng mẹ đẻ và tiếng muốn học, rồi nói với giáo viên AI. Câu sai được sửa ngay trong hội thoại. Buổi live {live}. Bài có sẵn {preset}.',
  cta: 'Luyện nói ngay',
  ctaSecondary: 'Xem ba cách học',
  factsTitle: 'Thông tin dịch vụ',
  facts: [
    { term: 'Tên dịch vụ', detail: 'Học ngoại ngữ AI trên NanoAI' },
    { term: 'Tiếng mẹ đẻ', detail: 'Người học tự chọn: tiếng Việt, Anh, Trung, Nhật, Hàn, Thái hoặc Hindi. Không cố định tiếng Việt.' },
    { term: 'Tiếng đang học', detail: 'Tiếng Anh, Trung, Hindi, Thái, Nhật, Hàn hoặc tiếng Việt cho người nước ngoài.' },
    { term: 'Buổi live', detail: 'Hội thoại mới. Giá {live} cho một buổi. Cần micro trên trình duyệt.' },
    { term: 'Bài có sẵn', detail: 'Bài đã lưu theo lộ trình, tách khỏi buổi live. Giá {preset} một bài.' },
    { term: 'Từ mới', detail: 'Từ lưu từ buổi học. Mở danh sách không trừ thêm credit.' },
    { term: 'Cách sửa', detail: 'Câu người học nói được chỉ ra chỗ sai và câu đúng hơn, kèm chú thích bằng tiếng mẹ đẻ.' },
    { term: 'Giáo viên tiếng Anh', detail: 'Chọn giọng nam hoặc nữ, Anh hoặc Mỹ, trong phòng luyện nói.' },
  ],
  modesTitle: 'Ba cách học',
  modesLead: 'Bấm một nút để đổi cách mở. Cả ba cách đều ghi giá và việc nó làm.',
  modes: [
    { id: 'live', name: 'Buổi live', price: '{live}', detail: 'Nói chuyện mới. Giáo viên hỏi, bạn trả lời, câu sai được sửa trong lượt đó.', href: PATHS.live, action: 'Luyện nói ngay' },
    { id: 'preset', name: 'Bài có sẵn', price: '{preset}', detail: 'Mở bài đã soạn. Bạn luyện theo câu lưu sẵn, không phải buổi hội thoại mới.', href: PATHS.preset, action: 'Mở bài có sẵn' },
    { id: 'words', name: 'Từ mới', price: 'Xem lại', detail: 'Danh sách từ đã lưu. Mở trang này không trừ thêm credit.', href: PATHS.words, action: 'Xem từ mới' },
  ],
  switchNative: 'Tiếng mẹ đẻ',
  switchTarget: 'Tiếng đang học',
  sampleTitle: 'Một lượt sửa câu',
  sampleLead: 'Bấm nút để đổi tiếng mẹ đẻ và tiếng đang học. Câu giáo viên và câu đúng nằm ở tiếng đang học. Chú thích nằm ở tiếng mẹ đẻ.',
  roleTeacher: 'Giáo viên',
  roleLearner: 'Người học',
  roleFix: 'Câu sửa',
  roleGloss: 'Chú thích',
  stepsTitle: 'Ba bước',
  steps: [
    { name: 'Chọn hai thứ tiếng', text: 'Chọn tiếng mẹ đẻ, rồi chọn tiếng muốn học. Hai nút không được trùng nhau.' },
    { name: 'Mở một cách học', text: 'Buổi live để nói mới. Bài có sẵn để luyện câu đã lưu. Từ mới để xem lại từ.' },
    { name: 'Nói và nghe câu sửa', text: 'Nói vào micro. Câu sai được thay bằng câu đúng hơn, rồi lưu từ cần ôn.' },
  ],
  faqTitle: 'Câu hỏi thường gặp',
  faqs: [
    { question: 'Tiếng mẹ đẻ có phải tiếng Việt không?', answer: 'Không. Người học chọn tiếng Việt, Anh, Trung, Nhật, Hàn, Thái hoặc Hindi.' },
    { question: 'Một buổi live giá bao nhiêu?', answer: 'Một buổi live là {live}. Credit trừ khi mở buổi.' },
    { question: 'Bài có sẵn khác buổi live thế nào?', answer: 'Bài có sẵn mở transcript đã lưu, giá {preset} một bài. Buổi live là hội thoại mới, giá {live}.' },
    { question: 'Câu nói sai được sửa ra sao?', answer: 'Trong lượt hội thoại, câu sai được chỉ ra và thay bằng câu đúng hơn. Chú thích viết bằng tiếng mẹ đẻ đã chọn.' },
    { question: 'Xem từ mới có mất thêm tiền không?', answer: 'Không. Danh sách từ đã lưu mở không trừ thêm credit.' },
    { question: 'Cần micro không?', answer: 'Buổi nói cần micro. Trình duyệt hỏi quyền một lần. Phòng ồn thì nói lại câu đó.' },
  ],
  reviewTitle: 'Người học nói về buổi luyện',
  reviewLead: 'Lướt ngang để đọc. Ai đã học một buổi có thể gửi đánh giá của mình.',
  reviewPlaceholder: 'Buổi bạn học tiếng nào, câu nào được sửa, micro có nghe rõ không...',
  reviewSend: 'Gửi đánh giá',
  reviewLogin: 'Đăng nhập để đánh giá',
  reviewThanks: 'Đã đăng đánh giá.',
  reviewError: 'Chưa gửi được. Viết từ 12 đến 600 ký tự.',
  closeTitle: 'Nói một câu và nghe câu sửa',
  closeLead: 'Mở buổi live nếu cần hội thoại mới. Mở bài có sẵn nếu muốn luyện câu đã lưu.',
  relatedHref: '/hoc-tieng-viet',
  relatedLabel: 'Học tiếng Việt cho người nước ngoài',
  secondRelatedHref: '/hoc-tieng-trung',
  secondRelatedLabel: 'Học tiếng Trung với AI',
  thirdRelatedHref: '/hoc-tieng-nhat',
  thirdRelatedLabel: 'Học tiếng Nhật với AI',
  fourthRelatedHref: '/hoc-tieng-han',
  fourthRelatedLabel: 'Học tiếng Hàn với AI',
  langLabels: {
    vi: 'Tiếng Việt',
    en: 'Tiếng Anh',
    zh: 'Tiếng Trung',
    ja: 'Tiếng Nhật',
    ko: 'Tiếng Hàn',
    th: 'Tiếng Thái',
    hi: 'Tiếng Hindi',
  },
}

const EN: LanguageLandingCopy = {
  home: 'Home',
  eyebrow: 'Language learning on NanoAI',
  h1: 'Learn a language with AI and get the line corrected',
  lead: 'Pick your native language and the language you want to speak, then talk with an AI teacher. A wrong line is corrected in the same turn. A live session is {live}. A saved lesson is {preset}.',
  cta: 'Start speaking',
  ctaSecondary: 'See the three ways',
  factsTitle: 'Service facts',
  facts: [
    { term: 'Service name', detail: 'NanoAI language learning' },
    { term: 'Native language', detail: 'The learner chooses Vietnamese, English, Chinese, Japanese, Korean, Thai, or Hindi. It is not fixed to Vietnamese.' },
    { term: 'Language being learned', detail: 'English, Chinese, Hindi, Thai, Japanese, Korean, or Vietnamese for learners from abroad.' },
    { term: 'Live session', detail: 'A new conversation. Price {live} for one session. The browser needs a microphone.' },
    { term: 'Saved lesson', detail: 'A prepared lesson, separate from live talk. Price {preset} for one lesson.' },
    { term: 'Saved words', detail: 'Words kept from a session. Opening the list does not charge again.' },
    { term: 'Correction', detail: 'The spoken line is marked and replaced with a better line, with a note in the native language.' },
    { term: 'English teacher voice', detail: 'In the practice room, choose a male or female voice, UK or US.' },
  ],
  modesTitle: 'Three ways to study',
  modesLead: 'Press a button to switch the way you start. Each way lists its price and what it does.',
  modes: [
    { id: 'live', name: 'Live session', price: '{live}', detail: 'A new conversation. The teacher asks, you answer, and a wrong line is corrected in that turn.', href: PATHS.live, action: 'Start speaking' },
    { id: 'preset', name: 'Saved lesson', price: '{preset}', detail: 'Open a prepared lesson and practice the stored lines. This is not a new live conversation.', href: PATHS.preset, action: 'Open a saved lesson' },
    { id: 'words', name: 'Saved words', price: 'Review', detail: 'The list of words you kept. Opening this page does not charge again.', href: PATHS.words, action: 'Review saved words' },
  ],
  switchNative: 'Native language',
  switchTarget: 'Language being learned',
  sampleTitle: 'One corrected turn',
  sampleLead: 'Press a button to change the native language and the language being learned. The teacher line and the fix stay in the language being learned. The note stays in the native language.',
  roleTeacher: 'Teacher',
  roleLearner: 'Learner',
  roleFix: 'Corrected line',
  roleGloss: 'Note',
  stepsTitle: 'Three steps',
  steps: [
    { name: 'Choose both languages', text: 'Choose the native language, then the language you want to learn. The two buttons cannot be the same language.' },
    { name: 'Open one way to study', text: 'A live session is for new talk. A saved lesson repeats stored lines. Saved words are for review.' },
    { name: 'Speak and hear the fix', text: 'Speak into the microphone. A wrong line is replaced with a better one, and the word can be saved.' },
  ],
  faqTitle: 'Common questions',
  faqs: [
    { question: 'Is the native language always Vietnamese?', answer: 'No. The learner chooses Vietnamese, English, Chinese, Japanese, Korean, Thai, or Hindi.' },
    { question: 'How much is one live session?', answer: 'One live session is {live}. The credit is charged when the session opens.' },
    { question: 'How is a saved lesson different from live?', answer: 'A saved lesson opens a stored transcript and costs {preset}. A live session is a new conversation and costs {live}.' },
    { question: 'How is a wrong sentence fixed?', answer: 'In the same turn, the wrong line is marked and replaced with a better line. The note is written in the native language you chose.' },
    { question: 'Does opening saved words cost more?', answer: 'No. The saved-word list opens without another charge.' },
    { question: 'Do I need a microphone?', answer: 'Speaking needs a microphone. The browser asks once. If the room is noisy, say the line again.' },
  ],
  reviewTitle: 'What learners say about a session',
  reviewLead: 'Scroll sideways to read. Anyone who has finished a session can send a review.',
  reviewPlaceholder: 'Which language you practiced, which line was corrected, and whether the microphone heard you...',
  reviewSend: 'Send review',
  reviewLogin: 'Sign in to review',
  reviewThanks: 'Review posted.',
  reviewError: 'Not sent. Write 12 to 600 characters.',
  closeTitle: 'Say one line and hear the correction',
  closeLead: 'Open a live session for new talk. Open a saved lesson to practice lines you already have.',
  relatedHref: '/hoc-tieng-viet',
  relatedLabel: 'Learn Vietnamese, for speakers of other languages',
  secondRelatedHref: '/hoc-tieng-trung',
  secondRelatedLabel: 'Learn Chinese with AI',
  thirdRelatedHref: '/hoc-tieng-nhat',
  thirdRelatedLabel: 'Learn Japanese with AI',
  fourthRelatedHref: '/hoc-tieng-han',
  fourthRelatedLabel: 'Learn Korean with AI',
  langLabels: {
    vi: 'Vietnamese',
    en: 'English',
    zh: 'Chinese',
    ja: 'Japanese',
    ko: 'Korean',
    th: 'Thai',
    hi: 'Hindi',
  },
}

const ZH: LanguageLandingCopy = {
  home: '首页',
  eyebrow: 'NanoAI 外语学习',
  h1: '用 AI 学外语，说错当场改正',
  lead: '先选母语和要学的语言，再和 AI 老师说话。错句在同一轮被改正。直播课 {live}。已有课程 {preset}。',
  cta: '开始说话',
  ctaSecondary: '看三种学法',
  factsTitle: '服务信息',
  facts: [
    { term: '服务名称', detail: 'NanoAI 外语学习' },
    { term: '母语', detail: '学习者自己选：越南语、英语、中文、日语、韩语、泰语或印地语。不固定为越南语。' },
    { term: '在学的语言', detail: '英语、中文、印地语、泰语、日语、韩语，或给外国学习者的越南语。' },
    { term: '直播课', detail: '一段新对话。一节 {live}。浏览器需要麦克风。' },
    { term: '已有课程', detail: '按路径保存的课，和直播分开。一课 {preset}。' },
    { term: '生词', detail: '从课堂留下的词。打开列表不再扣积分。' },
    { term: '改正方式', detail: '说出的句子会被标出，并换成更好的一句，注释用母语写。' },
    { term: '英语老师声音', detail: '在练习室里选男声或女声，英式或美式。' },
  ],
  modesTitle: '三种学法',
  modesLead: '按一个按钮换开课方式。三种都写明价格和做什么。',
  modes: [
    { id: 'live', name: '直播课', price: '{live}', detail: '新的对话。老师问，你答，错句在这一轮被改正。', href: PATHS.live, action: '开始说话' },
    { id: 'preset', name: '已有课程', price: '{preset}', detail: '打开已写好的课，按保存的句子练。这不是一段新的直播。', href: PATHS.preset, action: '打开已有课程' },
    { id: 'words', name: '生词', price: '复习', detail: '已保存的词。打开这一页不再扣积分。', href: PATHS.words, action: '看生词' },
  ],
  switchNative: '母语',
  switchTarget: '在学的语言',
  sampleTitle: '一轮改句',
  sampleLead: '按按钮换母语和在学的语言。老师的话和改正句用在学的语言。注释用母语。',
  roleTeacher: '老师',
  roleLearner: '学习者',
  roleFix: '改正句',
  roleGloss: '注释',
  stepsTitle: '三步',
  steps: [
    { name: '选两种语言', text: '先选母语，再选要学的语言。两个按钮不能是同一种语言。' },
    { name: '打开一种学法', text: '直播用来新对话。已有课程用来练保存的句子。生词用来复习。' },
    { name: '说并听改正', text: '对着麦克风说。错句换成更好的一句，需要的词可以留下。' },
  ],
  faqTitle: '常见问题',
  faqs: [
    { question: '母语是不是一定是越南语？', answer: '不是。学习者可选越南语、英语、中文、日语、韩语、泰语或印地语。' },
    { question: '一节直播多少钱？', answer: '一节直播是 {live}。打开课时扣除积分。' },
    { question: '已有课程和直播有什么不同？', answer: '已有课程打开保存的课文，一课 {preset}。直播是新对话，一节 {live}。' },
    { question: '说错的句子怎么改？', answer: '同一轮里，错句被标出并换成更好的一句。注释用你选的母语写。' },
    { question: '看生词还要再付钱吗？', answer: '不用。已保存的词列表打开不再扣积分。' },
    { question: '需要麦克风吗？', answer: '说话需要麦克风。浏览器问一次权限。房间吵就再说一遍。' },
  ],
  reviewTitle: '学习者怎么说这节课',
  reviewLead: '横向滑动阅读。上过一节课的人可以留下评价。',
  reviewPlaceholder: '你练了哪种语言，哪一句被改正，麦克风是否听清...',
  reviewSend: '发送评价',
  reviewLogin: '登录后评价',
  reviewThanks: '评价已发布。',
  reviewError: '还没发出。请写 12 到 600 个字符。',
  closeTitle: '说一句，听改正',
  closeLead: '要新对话就开直播。要练已经有的句子就开已有课程。',
  relatedHref: '/hoc-tieng-viet',
  relatedLabel: '给外国人学越南语',
  secondRelatedHref: '/hoc-tieng-trung',
  secondRelatedLabel: '用 AI 学中文',
  thirdRelatedHref: '/hoc-tieng-nhat',
  thirdRelatedLabel: '用 AI 学日语',
  fourthRelatedHref: '/hoc-tieng-han',
  fourthRelatedLabel: '用 AI 学韩语',
  langLabels: {
    vi: '越南语',
    en: '英语',
    zh: '中文',
    ja: '日语',
    ko: '韩语',
    th: '泰语',
    hi: '印地语',
  },
}

const JA: LanguageLandingCopy = {
  home: 'ホーム',
  eyebrow: 'NanoAI の語学',
  h1: 'AI で外国語を話し、その場で文を直す',
  lead: '母語と学びたい言語を選び、AI の先生と話します。間違った文はそのターンで直されます。ライブは {live}。用意されたレッスンは {preset}。',
  cta: '話し始める',
  ctaSecondary: '3つの学び方を見る',
  factsTitle: 'サービスの情報',
  facts: [
    { term: 'サービス名', detail: 'NanoAI の語学' },
    { term: '母語', detail: '学ぶ人が選びます。ベトナム語、英語、中国語、日本語、韓国語、タイ語、ヒンディー語。ベトナム語に固定しません。' },
    { term: '学んでいる言語', detail: '英語、中国語、ヒンディー語、タイ語、日本語、韓国語、または外国の学習者向けのベトナム語。' },
    { term: 'ライブ', detail: '新しい会話です。1回 {live}。ブラウザのマイクが要ります。' },
    { term: '用意されたレッスン', detail: 'ライブとは別の、保存されたレッスンです。1課 {preset}。' },
    { term: '新しい語', detail: '授業で残した語です。一覧を開いても追加のクレジットはかかりません。' },
    { term: '直し方', detail: '話した文が示され、よりよい文に替わります。注釈は母語です。' },
    { term: '英語の先生の声', detail: '練習室で男性か女性、イギリスかアメリカを選べます。' },
  ],
  modesTitle: '3つの学び方',
  modesLead: 'ボタンで開き方を変えます。3つとも料金と中身を書いてあります。',
  modes: [
    { id: 'live', name: 'ライブ', price: '{live}', detail: '新しい会話です。先生が聞き、あなたが答え、間違いはそのターンで直されます。', href: PATHS.live, action: '話し始める' },
    { id: 'preset', name: '用意されたレッスン', price: '{preset}', detail: '用意された課を開き、保存された文を練習します。新しいライブではありません。', href: PATHS.preset, action: '用意されたレッスンを開く' },
    { id: 'words', name: '新しい語', price: '復習', detail: '残した語の一覧です。このページを開いても追加のクレジットはかかりません。', href: PATHS.words, action: '新しい語を見る' },
  ],
  switchNative: '母語',
  switchTarget: '学んでいる言語',
  sampleTitle: '1ターンの訂正',
  sampleLead: 'ボタンで母語と学んでいる言語を変えます。先生の文と訂正は学んでいる言語です。注釈は母語です。',
  roleTeacher: '先生',
  roleLearner: '学習者',
  roleFix: '訂正した文',
  roleGloss: '注釈',
  stepsTitle: '3つの手順',
  steps: [
    { name: '2つの言語を選ぶ', text: '母語を選び、次に学びたい言語を選びます。同じ言語にはできません。' },
    { name: '学び方を1つ開く', text: 'ライブは新しい会話です。用意されたレッスンは保存された文です。新しい語は復習です。' },
    { name: '話して訂正を聞く', text: 'マイクに話します。間違った文はよりよい文に替わり、必要な語は残せます。' },
  ],
  faqTitle: 'よくある質問',
  faqs: [
    { question: '母語はベトナム語だけですか？', answer: 'いいえ。ベトナム語、英語、中国語、日本語、韓国語、タイ語、ヒンディー語から選びます。' },
    { question: 'ライブ1回はいくらですか？', answer: 'ライブ1回は {live} です。開いたときにクレジットを引かれます。' },
    { question: '用意されたレッスンとライブの違いは？', answer: '用意されたレッスンは保存された文を開き、1課 {preset} です。ライブは新しい会話で、1回 {live} です。' },
    { question: '間違った文はどう直されますか？', answer: '同じターンで間違った文が示され、よりよい文に替わります。注釈は選んだ母語です。' },
    { question: '新しい語を見ると追加料金ですか？', answer: 'いいえ。残した語の一覧は追加のクレジットなしで開けます。' },
    { question: 'マイクは要りますか？', answer: '話すにはマイクが要ります。ブラウザが一度許可を求めます。部屋がうるさいときはもう一度言います。' },
  ],
  reviewTitle: '学習者が授業について書いたこと',
  reviewLead: '横に送って読みます。1回学んだ人は評価を送れます。',
  reviewPlaceholder: 'どの言語を練習し、どの文が直され、マイクが聞こえたか...',
  reviewSend: '評価を送る',
  reviewLogin: 'ログインして評価',
  reviewThanks: '評価を掲載しました。',
  reviewError: 'まだ送れません。12文字から600文字で書いてください。',
  closeTitle: '一文を言って、訂正を聞く',
  closeLead: '新しい会話ならライブを開きます。残してある文を練習するなら用意されたレッスンを開きます。',
  relatedHref: '/hoc-tieng-viet',
  relatedLabel: '外国の人のためのベトナム語',
  secondRelatedHref: '/hoc-tieng-trung',
  secondRelatedLabel: 'AI で中国語',
  thirdRelatedHref: '/hoc-tieng-nhat',
  thirdRelatedLabel: 'AI で日本語',
  fourthRelatedHref: '/hoc-tieng-han',
  fourthRelatedLabel: 'AI で韓国語',
  langLabels: {
    vi: 'ベトナム語',
    en: '英語',
    zh: '中国語',
    ja: '日本語',
    ko: '韓国語',
    th: 'タイ語',
    hi: 'ヒンディー語',
  },
}

const KO: LanguageLandingCopy = {
  home: '홈',
  eyebrow: 'NanoAI 외국어 학습',
  h1: 'AI와 외국어를 말하고, 그 자리에서 문장을 고칩니다',
  lead: '모국어와 배울 언어를 고른 뒤 AI 선생님과 말합니다. 틀린 문장은 같은 차례에 고쳐집니다. 라이브는 {live}. 준비된 수업은 {preset}.',
  cta: '말하기 시작',
  ctaSecondary: '세 가지 방법 보기',
  factsTitle: '서비스 정보',
  facts: [
    { term: '서비스 이름', detail: 'NanoAI 외국어 학습' },
    { term: '모국어', detail: '배우는 사람이 고릅니다. 베트남어, 영어, 중국어, 일본어, 한국어, 태국어, 힌디어. 베트남어로 고정하지 않습니다.' },
    { term: '배우는 언어', detail: '영어, 중국어, 힌디어, 태국어, 일본어, 한국어, 또는 외국인 학습자용 베트남어.' },
    { term: '라이브', detail: '새 대화입니다. 한 번에 {live}. 브라우저 마이크가 필요합니다.' },
    { term: '준비된 수업', detail: '라이브와 분리된, 저장해 둔 수업입니다. 한 수업 {preset}.' },
    { term: '새 단어', detail: '수업에서 남긴 단어입니다. 목록을 열어도 크레딧이 더 빠지지 않습니다.' },
    { term: '고치는 방식', detail: '말한 문장을 표시하고 더 나은 문장으로 바꿉니다. 주석은 모국어입니다.' },
    { term: '영어 선생님 목소리', detail: '연습실에서 남성 또는 여성, 영국 또는 미국을 고릅니다.' },
  ],
  modesTitle: '세 가지 공부 방법',
  modesLead: '버튼으로 여는 방법을 바꿉니다. 세 가지 모두 가격과 하는 일을 적습니다.',
  modes: [
    { id: 'live', name: '라이브', price: '{live}', detail: '새 대화입니다. 선생님이 묻고, 당신이 답하고, 틀린 문장은 그 차례에 고쳐집니다.', href: PATHS.live, action: '말하기 시작' },
    { id: 'preset', name: '준비된 수업', price: '{preset}', detail: '준비된 수업을 열고 저장된 문장을 연습합니다. 새 라이브가 아닙니다.', href: PATHS.preset, action: '준비된 수업 열기' },
    { id: 'words', name: '새 단어', price: '복습', detail: '남겨 둔 단어 목록입니다. 이 페이지를 열어도 크레딧이 더 빠지지 않습니다.', href: PATHS.words, action: '새 단어 보기' },
  ],
  switchNative: '모국어',
  switchTarget: '배우는 언어',
  sampleTitle: '한 차례의 교정',
  sampleLead: '버튼으로 모국어와 배우는 언어를 바꿉니다. 선생님 문장과 고친 문장은 배우는 언어입니다. 주석은 모국어입니다.',
  roleTeacher: '선생님',
  roleLearner: '학습자',
  roleFix: '고친 문장',
  roleGloss: '주석',
  stepsTitle: '세 단계',
  steps: [
    { name: '두 언어를 고른다', text: '모국어를 고르고, 다음에 배울 언어를 고릅니다. 두 버튼은 같은 언어가 될 수 없습니다.' },
    { name: '공부 방법을 하나 연다', text: '라이브는 새 대화입니다. 준비된 수업은 저장된 문장입니다. 새 단어는 복습입니다.' },
    { name: '말하고 고친 문장을 듣는다', text: '마이크에 말합니다. 틀린 문장은 더 나은 문장으로 바뀌고, 필요한 단어는 남길 수 있습니다.' },
  ],
  faqTitle: '자주 묻는 질문',
  faqs: [
    { question: '모국어는 베트남어만인가요?', answer: '아닙니다. 베트남어, 영어, 중국어, 일본어, 한국어, 태국어, 힌디어 중에서 고릅니다.' },
    { question: '라이브 한 번은 얼마인가요?', answer: '라이브 한 번은 {live}입니다. 열 때 크레딧이 빠집니다.' },
    { question: '준비된 수업과 라이브는 어떻게 다른가요?', answer: '준비된 수업은 저장된 글을 열고 한 수업 {preset}입니다. 라이브는 새 대화이고 한 번 {live}입니다.' },
    { question: '틀린 문장은 어떻게 고쳐지나요?', answer: '같은 차례에 틀린 문장이 표시되고 더 나은 문장으로 바뀝니다. 주석은 고른 모국어로 씁니다.' },
    { question: '새 단어를 보면 돈이 더 드나요?', answer: '아닙니다. 남긴 단어 목록은 추가 크레딧 없이 엽니다.' },
    { question: '마이크가 필요한가요?', answer: '말하려면 마이크가 필요합니다. 브라우저가 한 번 권한을 묻습니다. 방이 시끄러우면 그 문장을 다시 말합니다.' },
  ],
  reviewTitle: '학습자가 수업에 대해 쓴 말',
  reviewLead: '옆으로 밀어 읽습니다. 한 번 배운 사람은 평가를 보낼 수 있습니다.',
  reviewPlaceholder: '어떤 언어를 연습했는지, 어느 문장이 고쳐졌는지, 마이크가 들렸는지...',
  reviewSend: '평가 보내기',
  reviewLogin: '로그인 후 평가',
  reviewThanks: '평가를 올렸습니다.',
  reviewError: '아직 보내지 못했습니다. 12자에서 600자로 쓰세요.',
  closeTitle: '한 문장을 말하고 고친 문장을 듣기',
  closeLead: '새 대화는 라이브를 엽니다. 이미 있는 문장을 연습하려면 준비된 수업을 엽니다.',
  relatedHref: '/hoc-tieng-viet',
  relatedLabel: '외국인을 위한 베트남어',
  secondRelatedHref: '/hoc-tieng-trung',
  secondRelatedLabel: 'AI로 중국어',
  thirdRelatedHref: '/hoc-tieng-nhat',
  thirdRelatedLabel: 'AI로 일본어',
  fourthRelatedHref: '/hoc-tieng-han',
  fourthRelatedLabel: 'AI로 한국어',
  langLabels: {
    vi: '베트남어',
    en: '영어',
    zh: '중국어',
    ja: '일본어',
    ko: '한국어',
    th: '태국어',
    hi: '힌디어',
  },
}

const COPY: Record<WebLocale, LanguageLandingCopy> = { vi: VI, en: EN, zh: ZH, ja: JA, ko: KO }

export function languageLandingCopy(locale: WebLocale, livePrice: string, presetPrice: string): LanguageLandingCopy {
  return patchFreeLiveOffer(withPrices(COPY[locale] ?? VI, livePrice, presetPrice), locale)
}
