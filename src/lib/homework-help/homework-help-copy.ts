import type { WebLocale } from '@/lib/i18n/config'

export type HomeworkHelpCopy = {
  intro: string
  empty: string
  placeholder: string
  send: string
  showTools: string
  emoji: string
  replying: string
  newThread: string
  history: string
  historyEmpty: string
  historyClose: string
  historyLoading: string
  photoTurn: string
  pickPhoto: string
  takePhoto: string
  statement: string
  knowledge: string
  thinking: string
  nextHint: string
  showAnswer: string
  answer: string
  attemptLabel: string
  attemptPlaceholder: string
  reviewButton: string
  reviewing: string
  gap: string
  checkOk: string
  checkBad: string
  emptyPhoto: string
  removeImage: string
  cropTitle: string
  cropHint: string
  cropConfirm: string
  cropCancel: string
  cropWhole: string
  cropFailed: string
  cropProgress: string
  knowledgeHeld: string
  explain: string
  practice: string
  tagLoading: string
  answerHeld: string
  cachedFromDb: string
  errors: Record<string, string>
}

const VI: HomeworkHelpCopy = {
  intro:
    'Chat riêng để làm bài. Gõ hoặc chụp một câu. Giáo viên nêu kiến thức liên quan và hướng tư duy. Gợi ý mở từng bước. Đáp án chỉ hiện khi bạn bấm bước cuối.',
  empty: 'Gõ hoặc chụp một câu bạn đang làm. Giáo viên hướng cho riêng bạn.',
  placeholder: 'Gõ một câu bài tập…',
  send: 'Gửi',
  showTools: 'Hiện nút',
  emoji: 'Biểu cảm',
  replying: 'Giáo viên đang trả lời',
  newThread: 'Hội thoại mới',
  history: 'Lịch sử làm bài tập',
  historyEmpty: 'Chưa có hội thoại bài tập nào.',
  historyClose: 'Đóng danh sách',
  historyLoading: 'Đang tải danh sách…',
  photoTurn: 'Ảnh bài tập',
  pickPhoto: 'Chọn ảnh',
  takePhoto: 'Chụp bài',
  statement: 'Đề',
  knowledge: 'Kiến thức liên quan',
  thinking: 'Hướng tư duy',
  nextHint: 'Gợi ý tiếp',
  showAnswer: 'Xem đáp án',
  answer: 'Đáp án',
  attemptLabel: 'Bài làm của bạn',
  attemptPlaceholder: 'Gõ lời giải bạn đã làm',
  reviewButton: 'Chữa giúp',
  reviewing: 'Đang chữa…',
  gap: 'Chỗ cần xem lại',
  checkOk: 'Đúng hướng',
  checkBad: 'Chưa đúng',
  emptyPhoto: 'Không thấy câu bài tập trong ảnh. Chụp rõ một câu.',
  removeImage: 'Gỡ ảnh',
  cropTitle: 'Chọn vùng cần gửi',
  cropHint: 'Kéo khung hoặc các góc để chỉ giữ phần bài. Phần ngoài khung không gửi lên máy chủ.',
  cropConfirm: 'Dùng vùng này',
  cropCancel: 'Hủy',
  cropWhole: 'Chọn cả ảnh',
  cropFailed: 'Không cắt được vùng này. Thử lại.',
  cropProgress: 'Ảnh {current}/{total}',
  knowledgeHeld: 'Chưa đủ chắc để hiện kiến thức của câu này.',
  explain: 'Giải thích',
  practice: 'Áp dụng thực tế',
  tagLoading: 'Đang mở kiến thức…',
  answerHeld: 'Chưa đủ chắc để hiện đáp án.',
  cachedFromDb: 'Đoạn này lấy từ cache đã lưu.',
  errors: {
    unauthorized: 'Đăng nhập để dùng hỗ trợ làm bài.',
    missing_image: 'Chọn hoặc chụp ảnh bài trước.',
    too_large: 'Ảnh quá lớn. Mỗi ảnh tối đa 6MB.',
    bad_type: 'Chỉ nhận ảnh JPEG, PNG hoặc WebP.',
    too_many: 'Tối đa 3 ảnh mỗi lượt.',
    ai_unavailable: 'Chưa đọc được bài. Thử lại sau.',
    unreadable: 'Không đọc được nội dung ảnh. Chụp rõ hơn rồi thử lại.',
    missing_attempt: 'Gõ bài làm của bạn trước khi chữa.',
    missing_text: 'Gõ đề bài trước.',
    new_thread_failed: 'Không tạo được hội thoại mới.',
    payment_required: 'Gói học sinh chưa mở cho kỳ này. Mua gói để dùng hỗ trợ làm bài.',
    paste_failed: 'Không lấy được ảnh từ clipboard hoặc link. Thử lại, hoặc chọn ảnh từ máy.',
  },
}

const EN: HomeworkHelpCopy = {
  intro:
    'A private chat for homework. Type or photograph one question. The teacher lists the related knowledge and a way to think it through. Hints open one step at a time. The answer appears only when you open the last step.',
  empty: 'Type or photograph one question you are working on. The teacher guides only you.',
  placeholder: 'Type one homework question…',
  send: 'Send',
  showTools: 'Show buttons',
  emoji: 'Emoji',
  replying: 'The teacher is answering',
  newThread: 'New chat',
  history: 'Homework history',
  historyEmpty: 'No homework chats yet.',
  historyClose: 'Close the list',
  historyLoading: 'Loading chats…',
  photoTurn: 'Homework photo',
  pickPhoto: 'Choose photo',
  takePhoto: 'Take photo',
  statement: 'Problem',
  knowledge: 'Related knowledge',
  thinking: 'How to think',
  nextHint: 'Next hint',
  showAnswer: 'Show answer',
  answer: 'Answer',
  attemptLabel: 'Your work',
  attemptPlaceholder: 'Type the solution you already tried',
  reviewButton: 'Check my work',
  reviewing: 'Checking…',
  gap: 'What to revisit',
  checkOk: 'On track',
  checkBad: 'Not yet',
  emptyPhoto: 'No homework question in this photo. Photograph one question clearly.',
  removeImage: 'Remove',
  cropTitle: 'Choose what to send',
  cropHint: 'Drag the frame or its corners so only the work stays inside. Anything outside is not sent to the server.',
  cropConfirm: 'Use this area',
  cropCancel: 'Cancel',
  cropWhole: 'Select the whole photo',
  cropFailed: 'Could not crop this area. Try again.',
  cropProgress: 'Photo {current}/{total}',
  knowledgeHeld: 'This knowledge is not sure enough to show.',
  explain: 'Explanation',
  practice: 'In real life',
  tagLoading: 'Opening this topic…',
  answerHeld: 'The answer is not sure enough to show.',
  cachedFromDb: 'This part is from the saved cache.',
  errors: {
    unauthorized: 'Sign in to use homework help.',
    missing_image: 'Choose or take a photo first.',
    too_large: 'Photo is too large. Each photo can be up to 6MB.',
    bad_type: 'Use a JPEG, PNG, or WebP photo.',
    too_many: 'Up to 3 photos at a time.',
    ai_unavailable: 'Could not read the problem. Try again shortly.',
    unreadable: 'Could not read this photo. Take a clearer picture and try again.',
    missing_attempt: 'Type your work before asking for a check.',
    missing_text: 'Type the problem first.',
    new_thread_failed: 'Could not start a new chat.',
    payment_required: 'The student plan is not active this period. Buy it to use homework help.',
    paste_failed: 'Could not read that image from the clipboard or link. Try again, or choose a file.',
  },
}

const ZH: HomeworkHelpCopy = {
  intro: '单独聊天来做作业。输入或拍一道题。老师列出相关知识和思考步骤。提示逐条打开。答案只在最后一步出现。',
  empty: '输入或拍一道你正在做的题。老师只辅导你。',
  placeholder: '输入一道作业题…',
  send: '发送',
  showTools: '显示按钮',
  emoji: '表情',
  replying: '老师正在回答',
  newThread: '新对话',
  history: '作业记录',
  historyEmpty: '还没有作业对话。',
  historyClose: '关闭列表',
  historyLoading: '正在加载列表…',
  photoTurn: '作业照片',
  pickPhoto: '选择照片',
  takePhoto: '拍照',
  statement: '题目',
  knowledge: '相关知识',
  thinking: '思考方向',
  nextHint: '下一条提示',
  showAnswer: '查看答案',
  answer: '答案',
  attemptLabel: '你的解答',
  attemptPlaceholder: '写下你已经做过的步骤',
  reviewButton: '帮我看',
  reviewing: '正在批改…',
  gap: '需要再看的地方',
  checkOk: '方向对',
  checkBad: '还不对',
  emptyPhoto: '照片里没有题目。请拍清楚一道题。',
  removeImage: '移除',
  cropTitle: '选择要发送的区域',
  cropHint: '拖动方框或四角，只保留要交的内容。框外的部分不会发到服务器。',
  cropConfirm: '使用此区域',
  cropCancel: '取消',
  cropWhole: '选择整张照片',
  cropFailed: '无法裁切这块区域。请重试。',
  cropProgress: '照片 {current}/{total}',
  knowledgeHeld: '这条知识还不够确定，所以先不显示。',
  explain: '说明',
  practice: '生活里的例子',
  tagLoading: '正在打开这条知识…',
  answerHeld: '答案还不够确定，所以先不显示。',
  cachedFromDb: '这一段来自已保存的缓存。',
  errors: {
    unauthorized: '登录后才能使用作业辅导。',
    missing_image: '请先选择或拍摄作业照片。',
    too_large: '照片太大。每张最多 6MB。',
    bad_type: '只接受 JPEG、PNG 或 WebP。',
    too_many: '每次最多 3 张照片。',
    ai_unavailable: '暂时读不了题目。请稍后再试。',
    unreadable: '读不清这张照片。请拍清楚再试。',
    missing_attempt: '先写下你的解答，再请批改。',
    missing_text: '请先输入题目。',
    new_thread_failed: '无法新建对话。',
    payment_required: '本期学生套餐未开通。购买后才能使用作业辅导。',
    paste_failed: '无法从剪贴板或链接读取图片。请重试，或从设备选择图片。',
  },
}

const JA: HomeworkHelpCopy = {
  intro:
    '宿題用の個別チャットです。問題を入力するか撮影します。先生が関連知識と考え方を出します。ヒントは一段ずつ開き、答えは最後のステップでだけ表示します。',
  empty: '取り組んでいる問題を入力するか撮影してください。先生はあなただけに案内します。',
  placeholder: '問題を入力…',
  send: '送信',
  showTools: 'ボタンを表示',
  emoji: '絵文字',
  replying: '先生が回答しています',
  newThread: '新しい会話',
  history: '宿題の履歴',
  historyEmpty: '宿題の会話はまだありません。',
  historyClose: '一覧を閉じる',
  historyLoading: '一覧を読み込んでいます…',
  photoTurn: '宿題の写真',
  pickPhoto: '写真を選ぶ',
  takePhoto: '撮影する',
  statement: '問題',
  knowledge: '関連する知識',
  thinking: '考え方',
  nextHint: '次のヒント',
  showAnswer: '答えを見る',
  answer: '答え',
  attemptLabel: '自分の解答',
  attemptPlaceholder: 'すでに考えた解き方を書く',
  reviewButton: '見てほしい',
  reviewing: '見ています…',
  gap: '見直すところ',
  checkOk: '方向は合っている',
  checkBad: 'まだ違う',
  emptyPhoto: '写真に問題がありません。1問をはっきり撮ってください。',
  removeImage: '外す',
  cropTitle: '送る範囲を選ぶ',
  cropHint: '枠や角をドラッグして、必要な部分だけ残してください。枠の外はサーバーに送りません。',
  cropConfirm: 'この範囲を使う',
  cropCancel: 'キャンセル',
  cropWhole: '写真全体を選ぶ',
  cropFailed: 'この範囲を切り取れませんでした。もう一度お試しください。',
  cropProgress: '写真 {current}/{total}',
  knowledgeHeld: 'この知識はまだ確実ではないので表示しません。',
  explain: '説明',
  practice: '実生活での例',
  tagLoading: 'この知識を開いています…',
  answerHeld: '答えはまだ確実ではないので表示しません。',
  cachedFromDb: 'この部分は保存済みのキャッシュです。',
  errors: {
    unauthorized: '宿題サポートを使うにはログインしてください。',
    missing_image: '先に写真を選ぶか撮影してください。',
    too_large: '写真が大きすぎます。1枚あたり6MBまでです。',
    bad_type: 'JPEG、PNG、WebPのみ使えます。',
    too_many: '一度に3枚までです。',
    ai_unavailable: '問題を読めませんでした。しばらくしてから再度お試しください。',
    unreadable: 'この写真は読めません。はっきり撮ってもう一度お試しください。',
    missing_attempt: '確認する前に、自分の解答を書いてください。',
    missing_text: '先に問題を入力してください。',
    new_thread_failed: '新しい会話を作れませんでした。',
    payment_required: 'この期間の生徒プランが未開通です。購入すると宿題サポートを使えます。',
    paste_failed: 'クリップボードまたはリンクから画像を読めませんでした。もう一度試すか、端末から選んでください。',
  },
}

const KO: HomeworkHelpCopy = {
  intro:
    '숙제용 개인 채팅입니다. 문제를 입력하거나 찍으세요. 선생님이 관련 지식과 생각 순서를 보여 줍니다. 힌트는 한 단계씩 열리고, 답은 마지막 단계에서만 나옵니다.',
  empty: '풀고 있는 문제 하나를 입력하거나 찍으세요. 선생님은 당신만 안내합니다.',
  placeholder: '숙제 문제를 입력…',
  send: '보내기',
  showTools: '버튼 표시',
  emoji: '이모티콘',
  replying: '선생님이 답하고 있습니다',
  newThread: '새 대화',
  history: '숙제 기록',
  historyEmpty: '아직 숙제 대화가 없습니다.',
  historyClose: '목록 닫기',
  historyLoading: '목록을 불러오는 중…',
  photoTurn: '숙제 사진',
  pickPhoto: '사진 선택',
  takePhoto: '촬영',
  statement: '문제',
  knowledge: '관련 지식',
  thinking: '생각 방향',
  nextHint: '다음 힌트',
  showAnswer: '답 보기',
  answer: '답',
  attemptLabel: '내가 푼 풀이',
  attemptPlaceholder: '이미 해본 풀이를 적으세요',
  reviewButton: '풀어 준 것 봐 주기',
  reviewing: '보는 중…',
  gap: '다시 볼 부분',
  checkOk: '방향이 맞음',
  checkBad: '아직 아님',
  emptyPhoto: '사진에 문제가 없습니다. 한 문제를 선명하게 찍으세요.',
  removeImage: '빼기',
  cropTitle: '보낼 영역 선택',
  cropHint: '틀이나 모서리를 끌어 필요한 부분만 남기세요. 틀 밖은 서버로 보내지 않습니다.',
  cropConfirm: '이 영역 사용',
  cropCancel: '취소',
  cropWhole: '사진 전체 선택',
  cropFailed: '이 영역을 자르지 못했습니다. 다시 시도하세요.',
  cropProgress: '사진 {current}/{total}',
  knowledgeHeld: '이 지식은 아직 확실하지 않아 보여 주지 않습니다.',
  explain: '설명',
  practice: '실생활 예시',
  tagLoading: '이 지식을 여는 중…',
  answerHeld: '답은 아직 확실하지 않아 보여 주지 않습니다.',
  cachedFromDb: '이 부분은 저장된 캐시에서 가져온 것입니다.',
  errors: {
    unauthorized: '숙제 도우미를 쓰려면 로그인하세요.',
    missing_image: '먼저 사진을 고르거나 찍으세요.',
    too_large: '사진이 너무 큽니다. 한 장당 6MB까지입니다.',
    bad_type: 'JPEG, PNG, WebP만 받을 수 있습니다.',
    too_many: '한 번에 사진은 3장까지입니다.',
    ai_unavailable: '문제를 읽지 못했습니다. 잠시 후 다시 시도하세요.',
    unreadable: '이 사진을 읽지 못했습니다. 더 선명하게 찍고 다시 시도하세요.',
    missing_attempt: '확인받기 전에 내 풀이를 적으세요.',
    missing_text: '먼저 문제를 입력하세요.',
    new_thread_failed: '새 대화를 만들지 못했습니다.',
    payment_required: '이번 기간 학생 요금제가 열려 있지 않습니다. 구매한 뒤 숙제 도우미를 쓸 수 있습니다.',
    paste_failed: '클립보드나 링크에서 이미지를 읽지 못했습니다. 다시 시도하거나 기기에서 고르세요.',
  },
}

const COPY: Record<WebLocale, HomeworkHelpCopy> = {
  vi: VI,
  en: EN,
  zh: ZH,
  ja: JA,
  ko: KO,
}

export function homeworkHelpCopy(locale: WebLocale): HomeworkHelpCopy {
  return COPY[locale] ?? VI
}
