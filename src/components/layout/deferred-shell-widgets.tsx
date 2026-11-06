'use client'

import { useEffect, useState, type ComponentType } from 'react'

/**
 * next/dynamic({ ssr: false }) để lại boundary <!--$!--> và Next 14.2 báo
 * "could not finish this Suspense boundary" khi hydrate. Các widget này vẫn
 * chỉ gắn sau khi trình duyệt sẵn sàng, không render trên server.
 */
function useClientComponent(load: () => Promise<ComponentType>): ComponentType | null {
  const [Comp, setComp] = useState<ComponentType | null>(null)
  useEffect(() => {
    let live = true
    void load().then((Next) => {
      if (live) setComp(() => Next)
    })
    return () => {
      live = false
    }
  }, [load])
  return Comp
}

const loadAnalyticsTracker = () =>
  import('@/components/analytics/analytics-tracker').then((m) => m.AnalyticsTracker)
const loadMobileBottomBar = () =>
  import('@/components/layout/mobile-bottom-bar').then((m) => m.MobileBottomBar)
const loadInstallPrompt = () =>
  import('@/components/pwa/install-prompt').then((m) => m.InstallPrompt)
const loadPushNotificationPrompt = () =>
  import('@/components/pwa/push-notification-prompt').then((m) => m.PushNotificationPrompt)
const loadSwUpdateReload = () =>
  import('@/components/pwa/sw-update-reload').then((m) => m.SwUpdateReload)
const loadReferralCapture = () =>
  import('@/components/referral/referral-capture').then((m) => m.ReferralCapture)
const loadReferralClaimRunner = () =>
  import('@/components/referral/referral-claim-runner').then((m) => m.ReferralClaimRunner)
const loadCreditFeatureAccessGuard = () =>
  import('@/components/auth/credit-feature-access-guard').then((m) => m.CreditFeatureAccessGuard)

export function AnalyticsTracker() {
  const Comp = useClientComponent(loadAnalyticsTracker)
  return Comp ? <Comp /> : null
}

export function MobileBottomBar() {
  const Comp = useClientComponent(loadMobileBottomBar)
  return Comp ? <Comp /> : null
}

export function InstallPrompt() {
  const Comp = useClientComponent(loadInstallPrompt)
  return Comp ? <Comp /> : null
}

export function PushNotificationPrompt() {
  const Comp = useClientComponent(loadPushNotificationPrompt)
  return Comp ? <Comp /> : null
}

export function SwUpdateReload() {
  const Comp = useClientComponent(loadSwUpdateReload)
  return Comp ? <Comp /> : null
}

export function ReferralCapture() {
  const Comp = useClientComponent(loadReferralCapture)
  return Comp ? <Comp /> : null
}

export function ReferralClaimRunner() {
  const Comp = useClientComponent(loadReferralClaimRunner)
  return Comp ? <Comp /> : null
}

export function CreditFeatureAccessGuard() {
  const Comp = useClientComponent(loadCreditFeatureAccessGuard)
  return Comp ? <Comp /> : null
}
