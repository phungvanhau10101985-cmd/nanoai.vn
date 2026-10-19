import type { WebLocale } from '@/lib/i18n/config'

export type HomeworkHelpCopy = {
  intro: string
  empty: string
  placeholder: string
  photoPlaceholder: string
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
  figure: string
  nextHint: string
  answerEncourage: string
  showAnswer: string
  answer: string
  solutionWarning: string
  showSolution: string
  showSolutionOwned: string
  solutionOpening: string
  solutionTitle: string
  emptyPhoto: string
  reading: string
  reviewTitle: string
  reviewHint: string
  reviewCancel: string
  reviewRemove: string
  problemLabel: string
  chatClosed: string
  removeImage: string
  cropTitle: string
  cropHint: string
  cropConfirm: string
  cropCancel: string
  cropWhole: string
  cropFailed: string
  cropProgress: string
  cropPreviewTitle: string
  cropPreviewHint: string
  cropPreviewConfirm: string
  cropPreviewRetry: string
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
  photoPlaceholder: 'Đề lấy từ ảnh. Gỡ ảnh nếu muốn gõ.',
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
  figure: 'Hình minh họa',
  nextHint: 'Gợi ý tiếp',
  answerEncourage:
    'Nên làm bài trước và lấy kết quả của mình, rồi hãy đối chiếu với đáp án. Làm xong rồi mới mở sẽ hay hơn mở xem rồi mới làm.',
  showAnswer: 'Xem đáp án',
  answer: 'Đáp án',
  solutionWarning:
    'Nên tự làm trước. Đọc lời giải xong, não lười tư duy hơn: bạn nhớ đường người khác đã đi, và lần sau dễ ngừng tự suy luận.',
  showSolution: 'Xem bài giải · {credits} credit',
  showSolutionOwned: 'Xem bài giải',
  solutionOpening: 'Đang mở bài giải…',
  solutionTitle: 'Bài giải',
  emptyPhoto: 'Không thấy câu bài tập trong ảnh. Chụp rõ một câu.',
  reading: 'Đang đọc đề trong ảnh',
  reviewTitle: 'Đề trong ảnh',
  reviewHint: 'Sửa nếu chỗ nào đọc sai. Đúng rồi thì bấm Gửi.',
  reviewCancel: 'Hủy',
  reviewRemove: 'Bỏ câu này',
  problemLabel: 'Câu {n}',
  chatClosed: 'Bài này đã gửi. Mỗi bài là một hội thoại. Mở hội thoại mới để làm bài khác.',
  removeImage: 'Gỡ ảnh',
  cropTitle: 'Chọn vùng cần gửi',
  cropHint:
    'Kéo để khoanh phần bài, rồi bấm Chọn khung. Kiểm tra vùng đã khoanh: bấm Xác nhận để gửi đọc ngay, hoặc Chọn lại để khoanh khác. Chọn cả ảnh gửi nguyên bức ảnh đi đọc ngay.',
  cropConfirm: 'Chọn khung',
  cropCancel: 'Hủy',
  cropWhole: 'Chọn cả ảnh',
  cropFailed: 'Không cắt được vùng này. Thử lại.',
  cropProgress: 'Ảnh {current}/{total}',
  cropPreviewTitle: 'Xác nhận vùng gửi',
  cropPreviewHint: 'Đúng vùng này thì bấm Xác nhận để đọc đề ngay. Muốn khoanh khác thì bấm Chọn lại.',
  cropPreviewConfirm: 'Xác nhận',
  cropPreviewRetry: 'Chọn lại',
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
    missing_text: 'Gõ đề bài trước.',
    new_thread_failed: 'Không tạo được hội thoại mới.',
    payment_required: 'Gói học sinh chưa mở cho kỳ này. Mua gói để dùng hỗ trợ làm bài.',
    insufficient_credits: 'Không đủ credit để mở bài giải.',
    paste_failed: 'Không lấy được ảnh từ clipboard hoặc link. Thử lại, hoặc chọn ảnh từ máy.',
    chat_closed: 'Hội thoại này đã khóa. Mở hội thoại mới để làm bài khác.',
    photo_blocked: 'Đã gõ đề thì không gửi ảnh. Xóa chữ nếu muốn chụp bài.',
  },
}

const EN: HomeworkHelpCopy = {
  intro:
    'A private chat for homework. Type or photograph one question. The teacher lists the related knowledge and a way to think it through. Hints open one step at a time. The answer appears only when you open the last step.',
  empty: 'Type or photograph one question you are working on. The teacher guides only you.',
  placeholder: 'Type one homework question…',
  photoPlaceholder: 'The problem comes from the photo. Remove it to type.',
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
  figure: 'Figure',
  nextHint: 'Next hint',
  answerEncourage:
    'Work it out first and keep your own result, then compare it with the answer. Finishing first and then opening the answer teaches more than opening it and doing the work afterward.',
  showAnswer: 'Show answer',
  answer: 'Answer',
  solutionWarning:
    'Try it yourself first. After you read the worked solution, your mind gets lazier: you remember the path someone else took, and next time you stop reasoning it out.',
  showSolution: 'Show the worked solution · {credits} credit',
  showSolutionOwned: 'Show the worked solution',
  solutionOpening: 'Opening the worked solution…',
  solutionTitle: 'Worked solution',
  emptyPhoto: 'No homework question in this photo. Photograph one question clearly.',
  reading: 'Reading the problem in the photo',
  reviewTitle: 'Problem from the photo',
  reviewHint: 'Correct anything read wrong. If it is right, tap Send.',
  reviewCancel: 'Cancel',
  reviewRemove: 'Remove this question',
  problemLabel: 'Question {n}',
  chatClosed: 'This problem is in. Each problem has its own chat. Start a new chat for the next one.',
  removeImage: 'Remove',
  cropTitle: 'Choose what to send',
  cropHint:
    'Drag a frame around the work, then tap Select frame. Check the area: tap Confirm to send it to be read right away, or Select again to redraw. Select the whole photo sends the entire picture to be read right away.',
  cropConfirm: 'Select frame',
  cropCancel: 'Cancel',
  cropWhole: 'Select the whole photo',
  cropFailed: 'Could not crop this area. Try again.',
  cropProgress: 'Photo {current}/{total}',
  cropPreviewTitle: 'Confirm the area',
  cropPreviewHint: 'If this area is right, tap Confirm to read it now. Tap Select again to redraw.',
  cropPreviewConfirm: 'Confirm',
  cropPreviewRetry: 'Select again',
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
    missing_text: 'Type the problem first.',
    new_thread_failed: 'Could not start a new chat.',
    payment_required: 'The student plan is not active this period. Buy it to use homework help.',
    insufficient_credits: 'Not enough credits to open the worked solution.',
    paste_failed: 'Could not read that image from the clipboard or link. Try again, or choose a file.',
    chat_closed: 'This chat is closed. Start a new chat for another problem.',
    photo_blocked: 'You already typed the problem, so a photo cannot be added. Clear the text to use a photo.',
  },
}

const ZH: HomeworkHelpCopy = {
  intro: '单独聊天来做作业。输入或拍一道题。老师列出相关知识和思考步骤。提示逐条打开。答案只在最后一步出现。',
  empty: '输入或拍一道你正在做的题。老师只辅导你。',
  placeholder: '输入一道作业题…',
  photoPlaceholder: '题目以照片为准。移除照片后才能输入。',
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
  figure: '图示',
  nextHint: '下一条提示',
  answerEncourage: '先自己做完并记下结果，再和答案对照。先做完再打开，比先看答案再做更有收获。',
  showAnswer: '查看答案',
  answer: '答案',
  solutionWarning: '请先自己做。看完详解后，大脑会更懒于思考：你记住的是别人走过的路，下次就容易不再自己推理。',
  showSolution: '查看详解 · {credits} 积分',
  showSolutionOwned: '查看详解',
  solutionOpening: '正在打开详解…',
  solutionTitle: '详解',
  emptyPhoto: '照片里没有题目。请拍清楚一道题。',
  reading: '正在读取照片里的题目',
  reviewTitle: '照片里的题目',
  reviewHint: '读错的地方请改。没错就点发送。',
  reviewCancel: '取消',
  reviewRemove: '去掉这题',
  problemLabel: '第 {n} 题',
  chatClosed: '这道题已经提交。每道题一个对话。请开新对话做下一题。',
  removeImage: '移除',
  cropTitle: '选择要发送的区域',
  cropHint: '拖动方框圈出要交的部分，再点选择选框。核对区域：点确认会立刻送去阅读，点重新选择可再圈。选择整张照片会立刻把整张图送去阅读。',
  cropConfirm: '选择选框',
  cropCancel: '取消',
  cropWhole: '选择整张照片',
  cropFailed: '无法裁切这块区域。请重试。',
  cropProgress: '照片 {current}/{total}',
  cropPreviewTitle: '确认要发送的区域',
  cropPreviewHint: '区域正确就点确认，立刻送去阅读。要重圈就点重新选择。',
  cropPreviewConfirm: '确认',
  cropPreviewRetry: '重新选择',
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
    missing_text: '请先输入题目。',
    new_thread_failed: '无法新建对话。',
    payment_required: '本期学生套餐未开通。购买后才能使用作业辅导。',
    insufficient_credits: '积分不足，无法打开详解。',
    paste_failed: '无法从剪贴板或链接读取图片。请重试，或从设备选择图片。',
    chat_closed: '这个对话已关闭。请开新对话做另一题。',
    photo_blocked: '已经输入题目，就不能再上传照片。清空文字后才能拍照。',
  },
}

const JA: HomeworkHelpCopy = {
  intro:
    '宿題用の個別チャットです。問題を入力するか撮影します。先生が関連知識と考え方を出します。ヒントは一段ずつ開き、答えは最後のステップでだけ表示します。',
  empty: '取り組んでいる問題を入力するか撮影してください。先生はあなただけに案内します。',
  placeholder: '問題を入力…',
  photoPlaceholder: '問題は写真から読みます。入力するなら写真を外してください。',
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
  figure: '図',
  nextHint: '次のヒント',
  answerEncourage:
    '先に自分で解いて結果を出してから、答えと照合してください。答えを見てから解くより、解き終えてから開く方が身になります。',
  showAnswer: '答えを見る',
  answer: '答え',
  solutionWarning:
    'まず自分で解いてください。解説を読むと、頭は考えるのを怠けやすくなります。他人が通った道を覚えるだけで、次は自分で推論しなくなりがちです。',
  showSolution: '詳しい解説を見る · {credits} クレジット',
  showSolutionOwned: '詳しい解説を見る',
  solutionOpening: '解説を開いています…',
  solutionTitle: '詳しい解説',
  emptyPhoto: '写真に問題がありません。1問をはっきり撮ってください。',
  reading: '写真の問題を読んでいます',
  reviewTitle: '写真の問題',
  reviewHint: '読み間違いがあれば直してください。合っていれば送信を押します。',
  reviewCancel: 'キャンセル',
  reviewRemove: 'この問題を外す',
  problemLabel: '問 {n}',
  chatClosed: 'この問題は送信済みです。問題ごとに会話は一つです。次は新しい会話を開いてください。',
  removeImage: '外す',
  cropTitle: '送る範囲を選ぶ',
  cropHint:
    '枠をドラッグして範囲を決め、枠を選ぶを押します。範囲を確認し、確認を押すとその部分をすぐ読み取りに送ります。選び直すで枠を引き直せます。写真全体を選ぶと、写真全体をすぐ読み取りに送ります。',
  cropConfirm: '枠を選ぶ',
  cropCancel: 'キャンセル',
  cropWhole: '写真全体を選ぶ',
  cropFailed: 'この範囲を切り取れませんでした。もう一度お試しください。',
  cropProgress: '写真 {current}/{total}',
  cropPreviewTitle: '送る範囲を確認',
  cropPreviewHint: 'この範囲でよければ確認を押すとすぐ読み取りに送ります。やり直すなら選び直すを押します。',
  cropPreviewConfirm: '確認',
  cropPreviewRetry: '選び直す',
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
    missing_text: '先に問題を入力してください。',
    new_thread_failed: '新しい会話を作れませんでした。',
    payment_required: 'この期間の生徒プランが未開通です。購入すると宿題サポートを使えます。',
    insufficient_credits: 'クレジットが足りないため、解説を開けません。',
    paste_failed: 'クリップボードまたはリンクから画像を読めませんでした。もう一度試すか、端末から選んでください。',
    chat_closed: 'この会話は閉じています。別の問題は新しい会話で出してください。',
    photo_blocked: '問題を入力済みなので写真は送れません。写真にするなら文字を消してください。',
  },
}

const KO: HomeworkHelpCopy = {
  intro:
    '숙제용 개인 채팅입니다. 문제를 입력하거나 찍으세요. 선생님이 관련 지식과 생각 순서를 보여 줍니다. 힌트는 한 단계씩 열리고, 답은 마지막 단계에서만 나옵니다.',
  empty: '풀고 있는 문제 하나를 입력하거나 찍으세요. 선생님은 당신만 안내합니다.',
  placeholder: '숙제 문제를 입력…',
  photoPlaceholder: '문제는 사진에서 읽습니다. 입력하려면 사진을 빼세요.',
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
  figure: '그림',
  nextHint: '다음 힌트',
  answerEncourage:
    '먼저 직접 풀어 자기 결과를 낸 다음, 답과 대조하세요. 답을 보고 나서 푸는 것보다, 풀고 나서 여는 편이 더 좋습니다.',
  showAnswer: '답 보기',
  answer: '답',
  solutionWarning:
    '먼저 직접 풀어 보세요. 풀이를 읽고 나면 뇌는 생각하기를 더 게을리합니다. 다른 사람이 간 길을 기억하고, 다음엔 스스로 추론하지 않게 됩니다.',
  showSolution: '자세한 풀이 보기 · {credits} 크레딧',
  showSolutionOwned: '자세한 풀이 보기',
  solutionOpening: '풀이를 여는 중…',
  solutionTitle: '자세한 풀이',
  emptyPhoto: '사진에 문제가 없습니다. 한 문제를 선명하게 찍으세요.',
  reading: '사진 속 문제를 읽는 중',
  reviewTitle: '사진 속 문제',
  reviewHint: '잘못 읽은 곳이 있으면 고치세요. 맞으면 보내기를 누르세요.',
  reviewCancel: '취소',
  reviewRemove: '이 문제 빼기',
  problemLabel: '문제 {n}',
  chatClosed: '이 문제는 보냈습니다. 문제마다 대화는 하나입니다. 다음 문제는 새 대화에서 내세요.',
  removeImage: '빼기',
  cropTitle: '보낼 영역 선택',
  cropHint:
    '틀을 끌어 범위를 정한 뒤 프레임 선택을 누르세요. 영역을 확인한 다음 확인을 누르면 바로 읽도록 보내고, 다시 선택은 틀을 다시 그립니다. 사진 전체 선택은 사진 전체를 바로 읽도록 보냅니다.',
  cropConfirm: '프레임 선택',
  cropCancel: '취소',
  cropWhole: '사진 전체 선택',
  cropFailed: '이 영역을 자르지 못했습니다. 다시 시도하세요.',
  cropProgress: '사진 {current}/{total}',
  cropPreviewTitle: '보낼 영역 확인',
  cropPreviewHint: '이 영역이 맞으면 확인을 눌러 바로 읽도록 보냅니다. 다시 고르려면 다시 선택을 누르세요.',
  cropPreviewConfirm: '확인',
  cropPreviewRetry: '다시 선택',
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
    missing_text: '먼저 문제를 입력하세요.',
    new_thread_failed: '새 대화를 만들지 못했습니다.',
    payment_required: '이번 기간 학생 요금제가 열려 있지 않습니다. 구매한 뒤 숙제 도우미를 쓸 수 있습니다.',
    insufficient_credits: '크레딧이 부족해 풀이를 열 수 없습니다.',
    paste_failed: '클립보드나 링크에서 이미지를 읽지 못했습니다. 다시 시도하거나 기기에서 고르세요.',
    chat_closed: '이 대화는 잠겼습니다. 다른 문제는 새 대화에서 내세요.',
    photo_blocked: '문제를 입력했으면 사진을 올릴 수 없습니다. 사진을 쓰려면 글을 지우세요.',
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
