/**
 * Nhãn đa ngôn ngữ cho form video âm nhạc — đồng bộ tùy chọn với /tao-bai-hat-lyria-3.
 */
import type { LyriaGenreId } from '@/lib/music/music-video-veo-prompt'

export type MvUiLocale = 'vi' | 'en' | 'zh' | 'ja' | 'ko'

export const MV_GENRE_OPTIONS: { value: LyriaGenreId; label: Record<MvUiLocale, string> }[] = [
  { value: 'custom', label: { vi: 'Tự do theo mô tả', en: 'Custom', zh: '自定义', ja: '自由', ko: '사용자 정의' } },
  { value: 'pop', label: { vi: 'Pop', en: 'Pop', zh: '流行', ja: 'ポップ', ko: '팝' } },
  {
    value: 'c_pop',
    label: { vi: 'Nhạc pop Trung (C-pop)', en: 'Chinese pop (C-pop)', zh: '华语流行', ja: 'Cポップ', ko: 'C-pop' },
  },
  {
    value: 'j_pop',
    label: { vi: 'Nhạc pop Nhật (J-pop)', en: 'Japanese pop (J-pop)', zh: '日语流行', ja: 'Jポップ', ko: 'J-pop' },
  },
  {
    value: 'k_pop',
    label: { vi: 'Nhạc pop Hàn (K-pop)', en: 'Korean pop (K-pop)', zh: '韩语流行', ja: 'Kポップ', ko: 'K-pop' },
  },
  { value: 'nhac_tre', label: { vi: 'Nhạc trẻ (V-pop)', en: 'Youth pop (V-pop)', zh: '年轻流行', ja: 'Vポップ', ko: 'V-pop' } },
  { value: 'ballad', label: { vi: 'Ballad', en: 'Ballad', zh: '抒情', ja: 'バラード', ko: '발라드' } },
  {
    value: 'tam_trang',
    label: { vi: 'Nhạc tâm trạng', en: 'Mood / emotional', zh: '心情音乐', ja: '心情ミュージック', ko: '감성 무드' },
  },
  {
    value: 'nhac_che_hai',
    label: {
      vi: 'Nhạc chế / hài hước',
      en: 'Parody / humorous',
      zh: '改编搞笑',
      ja: 'パロディ・コミカル',
      ko: '패러디·유머',
    },
  },
  { value: 'bolero', label: { vi: 'Bolero / dân ca nhẹ', en: 'Bolero', zh: '波莱罗', ja: 'ボレロ', ko: '볼레로' } },
  { value: 'rap', label: { vi: 'Rap / Hip-hop', en: 'Rap / Hip-hop', zh: '说唱', ja: 'ラップ', ko: '랩' } },
  { value: 'trap', label: { vi: 'Trap', en: 'Trap', zh: '陷阱音乐', ja: 'トラップ', ko: '트랩' } },
  { value: 'rock', label: { vi: 'Rock', en: 'Rock', zh: '摇滚', ja: 'ロック', ko: '록' } },
  { value: 'edm', label: { vi: 'EDM / Điện tử', en: 'EDM', zh: '电子舞曲', ja: 'EDM', ko: 'EDM' } },
  { value: 'house', label: { vi: 'House', en: 'House', zh: '浩室', ja: 'ハウ스', ko: '하우스' } },
  {
    value: 'remix',
    label: { vi: 'Remix / sàn (club)', en: 'Remix / club', zh: '混音/夜店', ja: 'リミックス', ko: '리믹스' },
  },
  { value: 'lofi', label: { vi: 'Lo-fi', en: 'Lo-fi', zh: 'Lo-fi', ja: 'Lo-fi', ko: 'Lo-fi' } },
  {
    value: 'chill',
    label: { vi: 'Chill / thư giãn', en: 'Chill / relax', zh: '弛放', ja: 'チル', ko: '칠' },
  },
  { value: 'synthwave', label: { vi: 'Synthwave (retro 80s)', en: 'Synthwave', zh: '合成器浪潮', ja: 'シンセウェーブ', ko: '신스웨이브' } },
  { value: 'indie', label: { vi: 'Indie', en: 'Indie', zh: '独立', ja: 'インディ', ko: '인디' } },
  { value: 'jazz', label: { vi: 'Jazz', en: 'Jazz', zh: '爵士', ja: 'ジャズ', ko: '재즈' } },
  { value: 'rnb', label: { vi: 'R&B', en: 'R&B', zh: 'R&B', ja: 'R&B', ko: 'R&B' } },
  { value: 'folk', label: { vi: 'Folk / Acoustic', en: 'Folk / Acoustic', zh: '民谣', ja: 'フォーク', ko: '포크' } },
  { value: 'cinematic', label: { vi: 'Điện ảnh (cinematic)', en: 'Cinematic', zh: '电影感', ja: 'シネマ', ko: '시네마틱' } },
]

export type VoiceGenderId = 'auto' | 'female' | 'male' | 'neutral' | 'duet_mf'
export const MV_VOICE_GENDER: { value: VoiceGenderId; label: Record<MvUiLocale, string> }[] = [
  { value: 'auto', label: { vi: 'Tự động', en: 'Auto', zh: '自动', ja: '自動', ko: '자동' } },
  { value: 'female', label: { vi: 'Nữ', en: 'Female', zh: '女声', ja: '女性', ko: '여성' } },
  { value: 'male', label: { vi: 'Nam', en: 'Male', zh: '男声', ja: '男性', ko: '남성' } },
  { value: 'neutral', label: { vi: 'Trung tính', en: 'Neutral', zh: '中性', ja: '中性的', ko: '중성' } },
  {
    value: 'duet_mf',
    label: { vi: 'Song ca nam + nữ', en: 'Male + female duet', zh: '男女对唱', ja: '男女デュエット', ko: '남녀 듀엣' },
  },
]

export type VoiceTimbreId = 'auto' | 'high' | 'bright' | 'warm' | 'soft' | 'deep' | 'rap'
export const MV_VOICE_TIMBRE: { value: VoiceTimbreId; label: Record<MvUiLocale, string> }[] = [
  { value: 'auto', label: { vi: 'Tự động', en: 'Auto', zh: '自动', ja: '自動', ko: '자동' } },
  { value: 'high', label: { vi: 'Cao, sáng', en: 'High, bright', zh: '高而亮', ja: '高く明るい', ko: '높고 밝게' } },
  { value: 'bright', label: { vi: 'Trẻ, pop sáng', en: 'Youthful pop', zh: '青春明亮', ja: '若いポップ', ko: '밝은 팝' } },
  { value: 'warm', label: { vi: 'Ấm, trầm-trung', en: 'Warm mid', zh: '温暖中音', ja: '温かい中音', ko: '따뜻한 중저음' } },
  { value: 'soft', label: { vi: 'Nhẹ, thở', en: 'Soft, breathy', zh: '轻柔气声', ja: 'ソフト・息多め', ko: '부드럽게' } },
  { value: 'deep', label: { vi: 'Trầm, vang', en: 'Deep, resonant', zh: '低沉浑厚', ja: '低く響く', ko: '깊고 울림' } },
  { value: 'rap', label: { vi: 'Rap / nói nhịp', en: 'Rap / rhythmic', zh: '说唱节奏', ja: 'ラップ調', ko: '랩·리듬' } },
]

export type VoiceLangId = 'auto' | 'vi_north' | 'vi_central' | 'vi_south' | 'en_uk' | 'en_us' | 'zh' | 'ja' | 'ko'
export const MV_VOICE_LANG: { value: VoiceLangId; label: Record<MvUiLocale, string> }[] = [
  {
    value: 'auto',
    label: { vi: 'Tự động (theo lời)', en: 'Auto (from lyrics)', zh: '自动（随歌词）', ja: '自動（歌詞に合わせる）', ko: '자동(가사에 맞춤)' },
  },
  { value: 'vi_north', label: { vi: 'Tiếng Việt — Bắc', en: 'Vietnamese — North', zh: '越南语—北方', ja: 'ベトナム語—北部', ko: '베트남어—북부' } },
  { value: 'vi_central', label: { vi: 'Tiếng Việt — Trung', en: 'Vietnamese — Central', zh: '越南语—中部', ja: 'ベトナム語—中部', ko: '베트남어—중부' } },
  { value: 'vi_south', label: { vi: 'Tiếng Việt — Nam', en: 'Vietnamese — South', zh: '越南语—南方', ja: 'ベトナム語—南部', ko: '베트남어—남부' } },
  { value: 'en_uk', label: { vi: 'Tiếng Anh — Anh (UK)', en: 'English — UK', zh: '英语—英式', ja: '英語—イギリス', ko: '영어—영국' } },
  { value: 'en_us', label: { vi: 'Tiếng Anh — Mỹ (US)', en: 'English — US', zh: '英语—美式', ja: '英語—米国', ko: '영어—미국' } },
  { value: 'zh', label: { vi: 'Tiếng Trung (Quan thoại)', en: 'Chinese (Mandarin)', zh: '中文（普通话）', ja: '中国語（標準語）', ko: '중국어(만다린)' } },
  { value: 'ja', label: { vi: 'Tiếng Nhật', en: 'Japanese', zh: '日语', ja: '日本語', ko: '일본어' } },
  { value: 'ko', label: { vi: 'Tiếng Hàn', en: 'Korean', zh: '韩语', ja: '韓国語', ko: '한국어' } },
]

export type BpmPreset = 'auto' | 'slow' | 'medium' | 'fast'
export const MV_BPM: { value: BpmPreset; label: Record<MvUiLocale, string> }[] = [
  { value: 'auto', label: { vi: 'Tự động', en: 'Auto', zh: '自动', ja: '自動', ko: '자동' } },
  {
    value: 'slow',
    label: { vi: 'Chậm (~72–88 BPM)', en: 'Slow (~72–88 BPM)', zh: '慢速（约72–88）', ja: '遅め（72–88付近）', ko: '느림(~72–88 BPM)' },
  },
  {
    value: 'medium',
    label: { vi: 'Vừa (~96–112 BPM)', en: 'Medium (~96–112 BPM)', zh: '中速（约96–112）', ja: '中速（96–112付近）', ko: '보통(~96–112 BPM)' },
  },
  {
    value: 'fast',
    label: { vi: 'Nhanh (~122–138 BPM)', en: 'Fast (~122–138 BPM)', zh: '快速（约122–138）', ja: '速め（122–138付近）', ko: '빠름(~122–138 BPM)' },
  },
]

export type StructurePreset = 'auto' | 'verse_chorus' | 'verse_chorus_bridge' | 'short_hook' | 'through'
export const MV_STRUCTURE: { value: StructurePreset; label: Record<MvUiLocale, string> }[] = [
  { value: 'auto', label: { vi: 'Tự động', en: 'Auto', zh: '自动', ja: '自動', ko: '자동' } },
  {
    value: 'verse_chorus',
    label: { vi: 'Verse + điệp khúc', en: 'Verse + chorus', zh: '主歌+副歌', ja: 'ヴァース＋サビ', ko: '버스+후렴' },
  },
  {
    value: 'verse_chorus_bridge',
    label: { vi: 'Có bridge (đoạn chuyển)', en: 'With bridge', zh: '含桥段', ja: 'ブリッジあり', ko: '브리지 포함' },
  },
  {
    value: 'short_hook',
    label: { vi: 'Intro ngắn, hook rõ', en: 'Short intro, strong hook', zh: '短前奏、记忆点强', ja: '短いイントロ・フック重視', ko: '짧은 인트로·훅 강조' },
  },
  {
    value: 'through',
    label: { vi: 'Một mạch, ít lặp cứng', en: 'Flowing, few rigid repeats', zh: '连贯、少生硬重复', ja: '流れる展開・硬い反復少なめ', ko: '자연스러운 전개·기계적 반복 적게' },
  },
]

export type DensityPreset = 'auto' | 'minimal' | 'balanced' | 'full'
export const MV_DENSITY: { value: DensityPreset; label: Record<MvUiLocale, string> }[] = [
  { value: 'auto', label: { vi: 'Tự động', en: 'Auto', zh: '自动', ja: '自動', ko: '자동' } },
  {
    value: 'minimal',
    label: { vi: 'Tối giản (ít nhạc cụ)', en: 'Minimal (sparse)', zh: '极简（少乐器）', ja: 'ミニマル', ko: '미니멀(악기 적게)' },
  },
  { value: 'balanced', label: { vi: 'Cân bằng', en: 'Balanced', zh: '平衡', ja: 'バランス', ko: '균형' } },
  {
    value: 'full',
    label: { vi: 'Đầy đặn (nhiều layer)', en: 'Full (layered)', zh: '饱满（多层）', ja: '厚み・レイヤー多め', ko: '풍성(레이어 많이)' },
  },
]
