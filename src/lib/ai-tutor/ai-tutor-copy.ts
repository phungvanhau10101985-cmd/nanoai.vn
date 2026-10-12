import type { WebLocale } from '@/lib/i18n/config'
import type { TutorErrorCode, TutorShare } from '@/lib/ai-tutor/ai-tutor-types'

export type AiTutorCopy = {
  intro: string
  empty: string
  placeholder: string
  send: string
  sending: string
  explain: string
  practice: string
  related: string
  share: Record<TutorShare, string>
  errors: Record<TutorErrorCode, string>
}

const VI: AiTutorCopy = {
  intro:
    'Chat riêng với gia sư. Mỗi câu được phân loại chủ đề, viết lại bằng lời dễ hiểu và một tình huống ngoài đời. Dưới câu trả lời có 2 đến 3 nhãn để đào sâu. Chủ đề và nhãn được kiểm tra chéo rồi lưu, học sinh khác hỏi cùng ý hoặc bấm nhãn sẵn thì dùng bản đã lưu.',
  empty: 'Hỏi một ý bạn chưa hiểu. Gia sư trả lời cho riêng bạn.',
  placeholder: 'Hỏi một vấn đề…',
  send: 'Gửi',
  sending: 'Đang soạn…',
  explain: 'Giải thích',
  practice: 'Áp dụng thực tế',
  related: 'Đào sâu thêm',
  share: {
    reused: 'Chủ đề này đã được kiểm tra và lưu. Bạn đang xem bản dùng chung.',
    saved: 'Đã kiểm tra chéo và lưu. Học sinh khác hỏi cùng chủ đề sẽ thấy bản này.',
    private: 'Chưa lưu bản dùng chung. Câu này chỉ hiện trong chat của bạn.',
  },
  errors: {
    unauthorized: 'Đăng nhập để học với gia sư.',
    missing_text: 'Gõ câu hỏi trước khi gửi.',
    ai_unavailable: 'Gia sư chưa trả lời được. Thử lại sau.',
  },
}

const EN: AiTutorCopy = {
  intro:
    'A private chat with a tutor. Each question is filed under a topic, then explained in plain words with one real-life situation. Two or three labels sit under the answer so you can go deeper. Topics and labels are cross-checked before they are saved. Another student who asks that topic, or taps a saved label, gets the stored note.',
  empty: 'Ask about one idea you do not understand yet. The tutor answers only you.',
  placeholder: 'Ask about one idea…',
  send: 'Send',
  sending: 'Writing…',
  explain: 'Explanation',
  practice: 'In real life',
  related: 'Go deeper',
  share: {
    reused: 'This topic was already checked and saved. You are reading the shared note.',
    saved: 'Cross-checked and saved. Another student who asks this topic will see this note.',
    private: 'This reply was not saved for other students. It stays in your chat.',
  },
  errors: {
    unauthorized: 'Sign in to study with the tutor.',
    missing_text: 'Type a question before sending.',
    ai_unavailable: 'The tutor could not answer. Try again later.',
  },
}

const ZH: AiTutorCopy = {
  intro:
    '和学生一对一聊天。每个问题会归到一个主题，用好懂的话说明，并举一个生活里的例子。回答下面有 2 到 3 个标签，点开可以再学深一点。主题和标签先交叉核对再保存。别的学生问到同一主题，或点已有标签，就读已保存的内容。',
  empty: '问一个你还没弄懂的问题。家教会只回答你。',
  placeholder: '问一个问题…',
  send: '发送',
  sending: '正在写…',
  explain: '说明',
  practice: '生活里的例子',
  related: '再学深一点',
  share: {
    reused: '这个主题已经核对并保存。你正在看共用的那一版。',
    saved: '已交叉核对并保存。其他学生问到同一主题会看到这一版。',
    private: '没有存成共用。这条只留在你的聊天里。',
  },
  errors: {
    unauthorized: '登录后才能和家教学习。',
    missing_text: '先写下问题再发送。',
    ai_unavailable: '家教暂时答不了。请稍后再试。',
  },
}

const JA: AiTutorCopy = {
  intro:
    '生徒と家庭教師の1対1チャットです。質問はテーマに分け、わかりやすい言葉と、ふだんの生活での一例で説明します。答えの下に2つか3つのラベルがあり、押すとさらに深く学べます。テーマとラベルは突き合わせてから保存します。別の生徒が同じテーマを聞くか、保存済みのラベルを押すと、その内容を出します。',
  empty: 'まだわからないことを一つ聞いてください。家庭教師はあなただけに答えます。',
  placeholder: '質問を書く…',
  send: '送る',
  sending: '作成中…',
  explain: '説明',
  practice: '実生活での例',
  related: 'もっと深く',
  share: {
    reused: 'このテーマは確認済みで保存されています。共通の内容を見ています。',
    saved: '突き合わせて保存しました。同じテーマを聞く生徒にはこの内容が出ます。',
    private: '共通には保存していません。この返答はあなたのチャットだけに残ります。',
  },
  errors: {
    unauthorized: '家庭教師と学ぶにはログインしてください。',
    missing_text: '送る前に質問を書いてください。',
    ai_unavailable: '今は答えられません。あとでもう一度試してください。',
  },
}

const KO: AiTutorCopy = {
  intro:
    '학생과 과외 선생님의 1:1 채팅입니다. 질문은 주제로 분류되고, 쉬운 말과 생활 속 예시로 설명됩니다. 답 아래 라벨 2~3개가 붙어 더 깊게 볼 수 있습니다. 주제와 라벨은 서로 확인한 뒤에 저장합니다. 다른 학생이 그 주제를 묻거나 저장된 라벨을 누르면 저장된 내용을 봅니다.',
  empty: '아직 모르는 것 하나를 물어보세요. 선생님은 나에게만 답합니다.',
  placeholder: '질문을 입력…',
  send: '보내기',
  sending: '작성 중…',
  explain: '설명',
  practice: '실생활 예시',
  related: '더 깊게',
  share: {
    reused: '이 주제는 이미 확인하고 저장되었습니다. 공유된 내용을 보고 있습니다.',
    saved: '교차 확인 후 저장했습니다. 같은 주제를 묻는 다른 학생도 이 내용을 봅니다.',
    private: '공유로 저장하지 않았습니다. 이 답은 내 채팅에만 남습니다.',
  },
  errors: {
    unauthorized: '과외 선생님과 공부하려면 로그인하세요.',
    missing_text: '보내기 전에 질문을 입력하세요.',
    ai_unavailable: '지금은 답하지 못했습니다. 나중에 다시 시도하세요.',
  },
}

const COPY: Record<WebLocale, AiTutorCopy> = { vi: VI, en: EN, zh: ZH, ja: JA, ko: KO }

export function aiTutorCopy(locale: WebLocale): AiTutorCopy {
  return COPY[locale] ?? COPY.vi
}
