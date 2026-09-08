import assert from 'node:assert/strict'
import test from 'node:test'
import {
  settlePartnerPwaPrompt,
  shouldShowPartnerPwaInstallError,
  type PartnerBeforeInstallPromptEvent,
} from './partner-site-pwa-install'

test('PWA install error is hidden when Chrome still accepted or installed', () => {
  assert.equal(
    shouldShowPartnerPwaInstallError({
      promptRejected: true,
      choice: 'accepted',
      appInstalled: false,
      isStandalone: false,
    }),
    false
  )
  assert.equal(
    shouldShowPartnerPwaInstallError({
      promptRejected: true,
      choice: null,
      appInstalled: true,
      isStandalone: false,
    }),
    false
  )
  assert.equal(
    shouldShowPartnerPwaInstallError({
      promptRejected: true,
      choice: null,
      appInstalled: false,
      isStandalone: true,
    }),
    false
  )
})

test('PWA install error shows only when prompt failed and the app was not installed', () => {
  assert.equal(
    shouldShowPartnerPwaInstallError({
      promptRejected: true,
      choice: null,
      appInstalled: false,
      isStandalone: false,
    }),
    true
  )
  assert.equal(
    shouldShowPartnerPwaInstallError({
      promptRejected: true,
      choice: 'dismissed',
      appInstalled: false,
      isStandalone: false,
    }),
    false
  )
  assert.equal(
    shouldShowPartnerPwaInstallError({
      promptRejected: false,
      choice: 'dismissed',
      appInstalled: false,
      isStandalone: false,
    }),
    false
  )
})

test('settlePartnerPwaPrompt uses userChoice even when prompt() rejects', async () => {
  const event = {
    prompt: () => Promise.reject(new Error('AbortError: The operation was aborted.')),
    userChoice: Promise.resolve({ outcome: 'accepted' as const }),
  } as PartnerBeforeInstallPromptEvent
  assert.equal(await settlePartnerPwaPrompt(event), 'accepted')
})
