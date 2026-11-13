import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { USD_TO_VND } from './api-cost'
import type { LanguageCoachCacheBucket, LanguageCoachCacheReport } from './language-coach-cache-savings'

type Locale = 'vi' | 'en' | 'zh' | 'ja' | 'ko'

function asLocale(locale: string): Locale {
  if (locale === 'en' || locale === 'zh' || locale === 'ja' || locale === 'ko') return locale
  return 'vi'
}

function tr(locale: string, vi: string, en: string, zh: string, ja: string, ko: string) {
  const code = asLocale(locale)
  if (code === 'en') return en
  if (code === 'zh') return zh
  if (code === 'ja') return ja
  if (code === 'ko') return ko
  return vi
}

function formatVnd(n: number) {
  return `${Math.round(n).toLocaleString('vi-VN')}₫`
}

function formatUsd(n: number) {
  return `~${(n / USD_TO_VND).toFixed(4)} USD`
}

function formatCount(n: number) {
  return n.toLocaleString('vi-VN')
}

function formatHitRate(rate: number | null) {
  if (rate == null) return '—'
  return `${(rate * 100).toLocaleString('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
}

function bucketLabel(locale: string, id: LanguageCoachCacheBucket['id']) {
  if (id === 'tts') {
    return tr(locale, 'Đọc câu (TTS)', 'Read-aloud (TTS)', '朗读 (TTS)', '読み上げ (TTS)', '읽어 주기 (TTS)')
  }
  return tr(locale, 'Tra từ', 'Word lookup', '查词', '単語検索', '단어 조회')
}

export function LanguageCoachCachePanel({
  locale,
  rangeLabel,
  coachApiCostVnd,
  report,
  loadError,
}: {
  locale: string
  rangeLabel: string
  coachApiCostVnd: number
  report: LanguageCoachCacheReport
  loadError?: string | null
}) {
  const hitWidth = report.hitRate == null ? 0 : Math.max(0, Math.min(100, report.hitRate * 100))

  return (
    <Card id="hoc-ngoai-ngu-cache" className="border-teal-300 bg-teal-50/40 scroll-mt-24">
      <CardHeader>
        <CardTitle>
          {tr(
            locale,
            'Học ngoại ngữ AI — chi phí API và cache',
            'Language coach — API cost and cache',
            '外语学习 AI — API 费用与缓存',
            '語学コーチ — API費用とキャッシュ',
            '외국어 학습 AI — API 비용과 캐시'
          )}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{rangeLabel}</p>
        <p className="text-xs text-muted-foreground">
          {tr(
            locale,
            'Hit không gọi API. Tiết kiệm = số hit × chi phí trung bình một lượt gọi thật (TTS hoặc tra từ) trong cùng khoảng ngày. 1 USD = 25.000₫.',
            'A hit skips the API. Savings = hits × the average cost of one real call (TTS or word lookup) in the same date range. 1 USD = 25,000₫.',
            '命中不调用 API。节省 = 命中次数 × 同一日期内一次真实调用（朗读或查词）的平均费用。1 USD = 25,000₫。',
            'ヒットは API を呼びません。節約額 = ヒット数 × 同じ期間の実呼び出し（読み上げまたは単語）1回の平均費用。1 USD = 25,000₫。',
            '히트는 API를 호출하지 않습니다. 절감 = 히트 수 × 같은 기간의 실제 호출(TTS 또는 단어) 1회 평균 비용. 1 USD = 25,000₫.'
          )}
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {loadError ? (
          <p className="text-sm text-destructive">
            {tr(locale, 'Không đọc được sổ cache.', 'Could not read the cache ledger.', '无法读取缓存账本。', 'キャッシュ台帳を読めません。', '캐시 장부를 읽지 못했습니다.')}{' '}
            {loadError}
          </p>
        ) : null}

        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              {tr(locale, 'Chi API học ngoại ngữ', 'Language-coach API cost', '外语学习 API 费用', '語学コーチのAPI費用', '외국어 학습 API 비용')}
            </p>
            <p className="text-2xl font-bold text-amber-700">{formatVnd(coachApiCostVnd)}</p>
            <p className="text-xs text-muted-foreground">{formatUsd(coachApiCostVnd)}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              {tr(locale, 'Cache hit', 'Cache hit', '缓存命中', 'キャッシュヒット', '캐시 히트')}
            </p>
            <p className="text-2xl font-bold text-teal-800">{formatHitRate(report.hitRate)}</p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-teal-100">
              <div className="h-full rounded-full bg-teal-600" style={{ width: `${hitWidth}%` }} />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {formatCount(report.hits)} hit • {formatCount(report.misses)} miss • {formatCount(report.lookups)}{' '}
              {tr(locale, 'lượt', 'lookups', '次', '回', '회')}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              {tr(locale, 'Tiết kiệm nhờ cache', 'Saved by cache', '缓存节省', 'キャッシュで節約', '캐시로 절감')}
            </p>
            <p className="text-2xl font-bold text-emerald-800">{formatVnd(report.savedVnd)}</p>
            <p className="text-xs text-muted-foreground">
              {formatUsd(report.savedVnd)} •{' '}
              {tr(
                locale,
                'đọc câu + tra từ nếu không cache',
                'read-aloud + word lookup without cache',
                '朗读 + 查词若无缓存',
                '読み上げ＋単語検索がキャッシュなしなら',
                '읽어 주기 + 단어 조회, 캐시가 없으면'
              )}
              : {formatVnd(report.wouldHaveSpentVnd)}
            </p>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{tr(locale, 'Kho', 'Cache', '缓存', 'キャッシュ', '캐시')}</TableHead>
              <TableHead className="text-right">Hit</TableHead>
              <TableHead className="text-right">Miss</TableHead>
              <TableHead className="text-right">{tr(locale, 'Tỷ lệ hit', 'Hit rate', '命中率', 'ヒット率', '히트율')}</TableHead>
              <TableHead className="text-right">{tr(locale, 'Chi API thật', 'API spent', '实际 API', '実際のAPI', '실제 API')}</TableHead>
              <TableHead className="text-right">{tr(locale, 'Tiết kiệm', 'Saved', '节省', '節約', '절감')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {report.buckets.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{bucketLabel(locale, row.id)}</TableCell>
                <TableCell className="text-right">{formatCount(row.hits)}</TableCell>
                <TableCell className="text-right">{formatCount(row.misses)}</TableCell>
                <TableCell className="text-right">{formatHitRate(row.hitRate)}</TableCell>
                <TableCell className="text-right">
                  {formatVnd(row.spentVnd)}
                  <span className="block text-xs text-muted-foreground">
                    {formatCount(row.loggedCalls)} {tr(locale, 'lượt gọi', 'calls', '次调用', '回', '회 호출')}
                  </span>
                </TableCell>
                <TableCell className="text-right font-medium text-emerald-800">{formatVnd(row.savedVnd)}</TableCell>
              </TableRow>
            ))}
            <TableRow>
              <TableCell className="font-semibold">{tr(locale, 'Cộng', 'Total', '合计', '合計', '합계')}</TableCell>
              <TableCell className="text-right font-semibold">{formatCount(report.hits)}</TableCell>
              <TableCell className="text-right font-semibold">{formatCount(report.misses)}</TableCell>
              <TableCell className="text-right font-semibold">{formatHitRate(report.hitRate)}</TableCell>
              <TableCell className="text-right font-semibold">{formatVnd(report.spentVnd)}</TableCell>
              <TableCell className="text-right font-semibold text-emerald-800">{formatVnd(report.savedVnd)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>

        <p className="text-xs text-muted-foreground">
          {tr(
            locale,
            'Bộ đếm theo ngày hiện có cho đọc câu và tra từ. Hội thoại replay, phiên âm và tách từ chưa ghi hit/miss theo ngày nên chưa cộng vào số tiết kiệm. “Chi API học ngoại ngữ” là mọi log english-coach-; hai cột chi/tiết kiệm phía dưới chỉ tính TTS và tra từ.',
            'Daily counters exist for read-aloud and word lookup. Dialogue replay, transliteration, and tokenization do not record daily hits yet, so they are not in the savings. “Language-coach API cost” is every english-coach- log; the spent and saved columns below count only TTS and word lookup.',
            '按日计数目前只覆盖朗读和查词。对话重放、注音和分词还没有按日 hit/miss，因此不计入节省。“外语学习 API 费用”是全部 english-coach- 日志；下面的实付和节省只计朗读与查词。',
            '日次カウントは読み上げと単語検索のみです。会話リプレイ、翻字、分かち書きは日次のヒット未記録のため節約額に含めていません。「語学コーチのAPI費用」は english-coach- の全ログです。下の実費と節約は読み上げと単語検索だけです。',
            '일별 카운터는 읽어 주기와 단어 조회만 있습니다. 대화 리플레이, 표기 변환, 토큰 분리는 일별 히트가 없어 절감에 넣지 않습니다. “외국어 학습 API 비용”은 english-coach- 로그 전체이고, 아래 실비용·절감은 TTS와 단어 조회만입니다.'
          )}
        </p>
      </CardContent>
    </Card>
  )
}
