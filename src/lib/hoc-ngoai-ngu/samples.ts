export const LANGUAGE_PAIR_CODES = ['vi', 'en', 'zh', 'ja', 'ko', 'th', 'hi'] as const

export type LanguagePairCode = (typeof LANGUAGE_PAIR_CODES)[number]

export type SpeakingSample = {
  teacher: string
  learner: string
  fix: string
}

/** Câu hội thoại bằng tiếng đang học. Chú thích nằm ở `SAMPLE_GLOSS`. */
export const SPEAKING_SAMPLES: Record<LanguagePairCode, SpeakingSample> = {
  en: {
    teacher: 'What did you do this morning?',
    learner: 'I go to the market this morning.',
    fix: 'I went to the market this morning.',
  },
  zh: {
    teacher: '你今天早上做了什么？',
    learner: '我今天早上去市场。',
    fix: '我今天早上去了市场。',
  },
  ja: {
    teacher: '今朝何をしましたか。',
    learner: '今朝、市場に行きます。',
    fix: '今朝、市場に行きました。',
  },
  ko: {
    teacher: '오늘 아침에 뭐 했어요?',
    learner: '오늘 아침에 시장에 가요.',
    fix: '오늘 아침에 시장에 갔어요.',
  },
  th: {
    teacher: 'เมื่อเช้าคุณทำอะไร',
    learner: 'เมื่อเช้าฉันไปตลาด',
    fix: 'เมื่อเช้าฉันไปตลาดมา',
  },
  hi: {
    teacher: 'आज सुबह आपने क्या किया?',
    learner: 'मैं आज सुबह बाज़ार जाता हूँ।',
    fix: 'मैं आज सुबह बाज़ार गया।',
  },
  vi: {
    teacher: 'Sáng nay bạn làm gì?',
    learner: 'Sáng nay tôi đi chợ.',
    fix: 'Sáng nay tôi đã đi chợ.',
  },
}

/** Chú thích bằng tiếng mẹ đẻ, giải thích vì sao câu sửa đúng hơn. */
export const SAMPLE_GLOSS: Record<LanguagePairCode, Record<LanguagePairCode, string>> = {
  en: {
    vi: 'Câu nói việc đã xảy ra sáng nay phải dùng thì quá khứ: went, không dùng go.',
    en: 'A finished action this morning uses the past tense: went, not go.',
    zh: '今早已经发生的事要用过去时 went，不用 go。',
    ja: '今朝すでにしたことは過去形 went を使います。go ではありません。',
    ko: '오늘 아침에 이미 한 일은 과거 went를 씁니다. go가 아닙니다.',
    th: 'เรื่องที่ทำเสร็จเมื่อเช้าใช้รูปอดีต went ไม่ใช่ go',
    hi: 'आज सुबह हो चुके काम के लिए went लिखें, go नहीं।',
  },
  zh: {
    vi: 'Việc đã xong sáng nay cần trợ từ 了. Câu thiếu 了 nghe như thói quen, không phải việc vừa xảy ra.',
    en: 'A completed action this morning needs 了. Without it, the line sounds like a habit.',
    zh: '今早已经完成的动作要加 了。不加的话听起来像习惯，不是刚发生的事。',
    ja: '今朝すでに終えた動作には 了 が要ります。ないと習慣のように聞こえます。',
    ko: '오늘 아침 이미 끝난 동작에는 了가 필요합니다. 없으면 습관처럼 들립니다.',
    th: 'การกระทำที่จบแล้วเมื่อเช้าต้องมี 了 ถ้าไม่มีจะฟังเหมือนนิสัย',
    hi: 'आज सुबह पूरा हो चुके काम में 了 चाहिए। बिना इसके वाक्य आदत जैसा लगता है।',
  },
  ja: {
    vi: 'Việc đã làm sáng nay dùng 行きました. 行きます là thì hiện tại hoặc tương lai.',
    en: 'A finished trip this morning is 行きました. 行きます is present or future.',
    zh: '今早已经去过要用 行きました。行きます 是现在或将来。',
    ja: '今朝すでに行ったことは 行きました です。行きます は現在か未来です。',
    ko: '오늘 아침 이미 간 일은 行きました입니다. 行きます는 현재나 미래입니다.',
    th: 'เรื่องที่ไปแล้วเมื่อเช้าใช้ 行きました ส่วน 行きます เป็นปัจจุบันหรืออนาคต',
    hi: 'आज सुबह हो चुकी यात्रा 行きました है। 行きます वर्तमान या भविष्य है।',
  },
  ko: {
    vi: 'Việc đã làm sáng nay dùng 갔어요. 가요 là hiện tại.',
    en: 'A finished action this morning is 갔어요. 가요 is present.',
    zh: '今早已经做的事用 갔어요。가요 是现在时。',
    ja: '今朝すでにしたことは 갔어요 です。가요 は現在です。',
    ko: '오늘 아침에 이미 한 일은 갔어요입니다. 가요는 현재입니다.',
    th: 'สิ่งที่ทำเสร็จเมื่อเช้าใช้ 갔어요 ส่วน 가요 เป็นปัจจุบัน',
    hi: 'आज सुबह हो चुका काम 갔어요 है। 가요 वर्तमान है।',
  },
  th: {
    vi: 'Câu kể việc sáng nay nên có มา để nói việc đó đã xảy ra rồi.',
    en: 'A line about this morning needs มา so it is clearly already done.',
    zh: '说今早的事要加上 มา，才表示已经发生。',
    ja: '今朝の話には มา を足すと、すでに起きたことになります。',
    ko: '오늘 아침 일에는 มา를 붙여야 이미 끝난 일이 됩니다.',
    th: 'ประโยคเกี่ยวกับเมื่อเช้าควรมี มา เพื่อบอกว่าเกิดขึ้นแล้ว',
    hi: 'आज सुबह की बात में มา जोड़ें, तभी पूरा हो चुका काम स्पष्ट होता है।',
  },
  hi: {
    vi: 'Việc đã xong sáng nay dùng गया, không dùng जाता हूँ.',
    en: 'A finished action this morning uses गया, not जाता हूँ.',
    zh: '今早已经做完的事用 गया，不用 जाता हूँ。',
    ja: '今朝すでに終えたことは गया です。जाता हूँ ではありません。',
    ko: '오늘 아침 이미 끝난 일은 गया입니다. जाता हूँ가 아닙니다.',
    th: 'สิ่งที่ทำเสร็จเมื่อเช้าใช้ गया ไม่ใช่ जाता हूँ',
    hi: 'आज सुबह हो चुके काम के लिए गया लिखें, जाता हूँ नहीं।',
  },
  vi: {
    vi: 'Việc đã xảy ra sáng nay nói rõ bằng đã đi. Đi một mình dễ nghe như thói quen.',
    en: 'A finished action this morning is đã đi. Đi alone can sound like a habit.',
    zh: '今早已经发生的事要说 đã đi。只说 đi 容易听成习惯。',
    ja: '今朝すでにしたことは đã đi です。đi だけだと習慣に聞こえます。',
    ko: '오늘 아침 이미 한 일은 đã đi입니다. đi만 쓰면 습관처럼 들립니다.',
    th: 'เรื่องที่เกิดขึ้นแล้วเมื่อเช้าควรพูด đã đi ถ้าพูดแค่ đi จะฟังเหมือนนิสัย',
    hi: 'आज सुबह हो चुके काम के लिए đã đi कहें। केवल đi आदत जैसा लगता है।',
  },
}
