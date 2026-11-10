'use client'

import { useState } from 'react'
import { LANGUAGE_PAIR_CODES, SAMPLE_GLOSS, SPEAKING_SAMPLES, type LanguagePairCode } from '@/lib/hoc-ngoai-ngu/samples'

function nextDifferent(current: LanguagePairCode, clicked: LanguagePairCode): LanguagePairCode {
  if (clicked !== current) return clicked
  return LANGUAGE_PAIR_CODES.find((code) => code !== clicked) ?? 'en'
}

export function LanguagePairSwitcher({
  nativeLabel,
  targetLabel,
  labels,
  teacherLabel,
  learnerLabel,
  fixLabel,
  glossLabel,
  initialNative = 'vi',
  initialTarget = 'en',
  lockTarget = false,
  nativeCodes,
}: {
  nativeLabel: string
  targetLabel: string
  labels: Record<LanguagePairCode, string>
  teacherLabel: string
  learnerLabel: string
  fixLabel: string
  glossLabel: string
  initialNative?: LanguagePairCode
  initialTarget?: LanguagePairCode
  lockTarget?: boolean
  nativeCodes?: LanguagePairCode[]
}) {
  const natives = nativeCodes ?? [...LANGUAGE_PAIR_CODES]
  const [native, setNative] = useState<LanguagePairCode>(initialNative)
  const [target, setTarget] = useState<LanguagePairCode>(initialTarget)
  const sample = SPEAKING_SAMPLES[target]
  const gloss = SAMPLE_GLOSS[target][native]

  function chooseNative(code: LanguagePairCode) {
    setNative(code)
    if (lockTarget) return
    if (code === target) setTarget(nextDifferent(code, code))
  }

  function chooseTarget(code: LanguagePairCode) {
    if (code === native) return
    setTarget(code)
  }

  return (
    <div>
      <div className="space-y-3">
        <div>
          <p id="tieng-me-de" className="text-xs font-semibold uppercase tracking-wide text-slate-500">{nativeLabel}</p>
          <div className="mt-2 flex flex-wrap gap-2" role="group" aria-labelledby="tieng-me-de">
            {natives.map((code) => (
              <button
                key={`native-${code}`}
                type="button"
                aria-pressed={native === code}
                onClick={() => chooseNative(code)}
                className={native === code
                  ? 'rounded-full bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white'
                  : 'rounded-full border border-slate-300 px-3 py-1.5 text-sm'}
              >
                {labels[code]}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p id="tieng-dang-hoc" className="text-xs font-semibold uppercase tracking-wide text-slate-500">{targetLabel}</p>
          <div className="mt-2 flex flex-wrap gap-2" role="group" aria-labelledby="tieng-dang-hoc">
            {(lockTarget ? [target] : LANGUAGE_PAIR_CODES).map((code) => {
              const blocked = code === native
              return (
                <button
                  key={`target-${code}`}
                  type="button"
                  aria-pressed={target === code}
                  disabled={blocked}
                  onClick={() => chooseTarget(code)}
                  className={target === code
                    ? 'rounded-full bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white'
                    : 'rounded-full border border-slate-300 px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-40'}
                >
                  {labels[code]}
                </button>
              )
            })}
          </div>
        </div>
      </div>
      <div className="mt-4 space-y-3 rounded-lg border border-slate-200 p-4 text-sm leading-6">
        <p><span className="font-semibold">{teacherLabel}. </span>{sample.teacher}</p>
        <p><span className="font-semibold">{learnerLabel}. </span>{sample.learner}</p>
        <p><span className="font-semibold">{fixLabel}. </span>{sample.fix}</p>
        <p className="text-muted-foreground"><span className="font-semibold text-foreground">{glossLabel}. </span>{gloss}</p>
      </div>
    </div>
  )
}
