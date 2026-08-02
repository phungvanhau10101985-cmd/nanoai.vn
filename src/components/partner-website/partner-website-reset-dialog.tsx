'use client'

import { useState } from 'react'
import { Loader2, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import type { PartnerWebsiteCopy } from '@/lib/i18n/partner-website-copy'
import {
  confirmPartnerWebsiteResetWithOtp,
  requestPartnerWebsiteResetOtp,
} from '@/app/dashboard/messaging/website/partner-website-reset-actions'

export function PartnerWebsiteResetDialog({
  partnerId,
  partnerTitle,
  t,
  disabled,
  onResetComplete,
}: {
  partnerId: string
  partnerTitle: string
  t: PartnerWebsiteCopy
  disabled?: boolean
  onResetComplete: () => void
}) {
  const [open, setOpen] = useState(false)
  const [otpStep, setOtpStep] = useState<'send' | 'confirm'>('send')
  const [otpInput, setOtpInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function resetDialog() {
    setOtpStep('send')
    setOtpInput('')
    setError(null)
  }

  async function sendOtp() {
    setBusy(true)
    setError(null)
    const res = await requestPartnerWebsiteResetOtp(partnerId)
    setBusy(false)
    if ('error' in res) {
      setError(res.error)
      return
    }
    if (res.debugOtp) {
      setOtpInput(String(res.debugOtp).replace(/\D/g, '').slice(0, 6))
    }
    setOtpStep('confirm')
  }

  async function confirmReset() {
    const otp = otpInput.replace(/\D/g, '').trim()
    if (otp.length !== 6) {
      setError(t.resetWebsiteOtpInvalid)
      return
    }
    setBusy(true)
    setError(null)
    const res = await confirmPartnerWebsiteResetWithOtp(partnerId, otp)
    setBusy(false)
    if ('error' in res) {
      setError(res.error)
      return
    }
    setOpen(false)
    resetDialog()
    onResetComplete()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) resetDialog()
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" disabled={disabled || !partnerId}>
          <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
          {t.resetWebsiteButton}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>{t.resetWebsiteTitle}</DialogTitle>
          <DialogDescription>
            {t.resetWebsiteDescription.replace('{name}', partnerTitle)}
          </DialogDescription>
        </DialogHeader>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {otpStep === 'send' ? (
          <DialogFooter>
            <Button type="button" onClick={() => void sendOtp()} disabled={busy}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t.resetWebsiteSendOtp}
            </Button>
          </DialogFooter>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">{t.resetWebsiteOtpHint}</p>
            <Input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder={t.resetWebsiteOtpPlaceholder}
              value={otpInput}
              onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
            />
            <DialogFooter className="gap-2 sm:justify-between">
              <Button type="button" variant="outline" onClick={() => void sendOtp()} disabled={busy}>
                {t.resetWebsiteResendOtp}
              </Button>
              <Button type="button" variant="destructive" onClick={() => void confirmReset()} disabled={busy}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {t.resetWebsiteConfirm}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
