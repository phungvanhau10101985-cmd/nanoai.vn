import type { WebLocale } from '@/lib/i18n/config'

export type HomeworkHelpCopy = {
  intro: string
  pickPhoto: string
  takePhoto: string
  readButton: string
  reading: string
  anotherPhoto: string
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
  knowledgeHeld: string
  answerHeld: string
  errors: Record<string, string>
}

const VI: HomeworkHelpCopy = {
  intro:
    'Chụp một câu hoặc một trang bài. Mỗi câu hiện kiến thức liên quan và hướng tư duy. Gợi ý mở từng bước. Đáp án chỉ hiện khi bạn bấm bước cuối. Kiến thức được kiểm tra lại trước khi hiện.',
  pickPhoto: 'Chọn ảnh',
  takePhoto: 'Chụp bài',
  readButton: 'Đọc bài',
  reading: 'Đang đọc bài…',
  anotherPhoto: 'Chụp câu khác',
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
  knowledgeHeld: 'Chưa đủ chắc để hiện kiến thức của câu này.',
  answerHeld: 'Chưa đủ chắc để hiện đáp án.',
  errors: {
    unauthorized: 'Đăng nhập để dùng hỗ trợ làm bài.',
    missing_image: 'Chọn hoặc chụp ảnh bài trước.',
    too_large: 'Ảnh quá lớn. Mỗi ảnh tối đa 6MB.',
    bad_type: 'Chỉ nhận ảnh JPEG, PNG hoặc WebP.',
    too_many: 'Tối đa 3 ảnh mỗi lượt.',
    ai_unavailable: 'Chưa đọc được bài. Thử lại sau.',
    unreadable: 'Không đọc được nội dung ảnh. Chụp rõ hơn rồi thử lại.',
    missing_attempt: 'Gõ bài làm của bạn trước khi chữa.',
  },
}

const EN: HomeworkHelpCopy = {
  intro:
    'Photograph one question or one page. Each question lists the related knowledge and a way to think it through. Hints open one step at a time. The answer appears only when you open the last step. Related knowledge is checked again before it is shown.',
  pickPhoto: 'Choose photo',
  takePhoto: 'Take photo',
  readButton: 'Read the problem',
  reading: 'Reading…',
  anotherPhoto: 'Photograph another question',
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
  knowledgeHeld: 'This knowledge is not sure enough to show.',
  answerHeld: 'The answer is not sure enough to show.',
  errors: {
    unauthorized: 'Sign in to use homework help.',
    missing_image: 'Choose or take a photo first.',
    too_large: 'Photo is too large. Each photo can be up to 6MB.',
    bad_type: 'Use a JPEG, PNG, or WebP photo.',
    too_many: 'Up to 3 photos at a time.',
    ai_unavailable: 'Could not read the problem. Try again shortly.',
    unreadable: 'Could not read this photo. Take a clearer picture and try again.',
    missing_attempt: 'Type your work before asking for a check.',
  },
}

const ZH: HomeworkHelpCopy = {
  intro: '拍一道题或一页作业。每道题列出相关知识和思考步骤。提示逐条打开。答案只在最后一步出现。相关知识会先核对再显示。',
  pickPhoto: '选择照片',
  takePhoto: '拍照',
  readButton: '读题',
  reading: '正在读题…',
  anotherPhoto: '再拍一题',
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
  knowledgeHeld: '这条知识还不够确定，所以先不显示。',
  answerHeld: '答案还不够确定，所以先不显示。',
  errors: {
    unauthorized: '登录后才能使用作业辅导。',
    missing_image: '请先选择或拍摄作业照片。',
    too_large: '照片太大。每张最多 6MB。',
    bad_type: '只接受 JPEG、PNG 或 WebP。',
    too_many: '每次最多 3 张照片。',
    ai_unavailable: '暂时读不了题目。请稍后再试。',
    unreadable: '读不清这张照片。请拍清楚再试。',
    missing_attempt: '先写下你的解答，再请批改。',
  },
}

const JA: HomeworkHelpCopy = {
  intro:
    '問題を1問、または1ページ撮影します。各問に関連知識と考え方を出します。ヒントは一段ずつ開きます。答えは最後のステップでだけ表示します。関連知識は表示する前にもう一度確認します。',
  pickPhoto: '写真を選ぶ',
  takePhoto: '撮影する',
  readButton: '問題を読む',
  reading: '読んでいます…',
  anotherPhoto: '別の問題を撮る',
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
  knowledgeHeld: 'この知識はまだ確実ではないので表示しません。',
  answerHeld: '答えはまだ確実ではないので表示しません。',
  errors: {
    unauthorized: '宿題サポートを使うにはログインしてください。',
    missing_image: '先に写真を選ぶか撮影してください。',
    too_large: '写真が大きすぎます。1枚あたり6MBまでです。',
    bad_type: 'JPEG、PNG、WebPのみ使えます。',
    too_many: '一度に3枚までです。',
    ai_unavailable: '問題を読めませんでした。しばらくしてから再度お試しください。',
    unreadable: 'この写真は読めません。はっきり撮ってもう一度お試しください。',
    missing_attempt: '確認する前に、自分の解答を書いてください。',
  },
}

const KO: HomeworkHelpCopy = {
  intro:
    '문제 하나 또는 한 페이지를 찍습니다. 각 문제마다 관련 지식과 생각 순서를 보여 줍니다. 힌트는 한 단계씩 열리고, 답은 마지막 단계에서만 나옵니다. 관련 지식은 보여 주기 전에 다시 확인합니다.',
  pickPhoto: '사진 선택',
  takePhoto: '촬영',
  readButton: '문제 읽기',
  reading: '읽는 중…',
  anotherPhoto: '다른 문제 찍기',
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
  knowledgeHeld: '이 지식은 아직 확실하지 않아 보여 주지 않습니다.',
  answerHeld: '답은 아직 확실하지 않아 보여 주지 않습니다.',
  errors: {
    unauthorized: '숙제 도우미를 쓰려면 로그인하세요.',
    missing_image: '먼저 사진을 고르거나 찍으세요.',
    too_large: '사진이 너무 큽니다. 한 장당 6MB까지입니다.',
    bad_type: 'JPEG, PNG, WebP만 받을 수 있습니다.',
    too_many: '한 번에 사진은 3장까지입니다.',
    ai_unavailable: '문제를 읽지 못했습니다. 잠시 후 다시 시도하세요.',
    unreadable: '이 사진을 읽지 못했습니다. 더 선명하게 찍고 다시 시도하세요.',
    missing_attempt: '확인받기 전에 내 풀이를 적으세요.',
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
