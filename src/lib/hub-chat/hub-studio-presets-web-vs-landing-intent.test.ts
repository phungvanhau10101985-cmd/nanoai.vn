import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  matchStudioPreset,
  matchesLandingPageIntent,
  matchesWebAppDesignIntent,
} from '@/lib/hub-chat/hub-studio-presets'

test('web design phrases are web-app intent, not landing', () => {
  for (const phrase of [
    'tạo web',
    'Tạo giao diện web',
    'thiết kế web app',
    'studio flow tạo web',
    'thiết kế website',
    'create a website',
    'design web app',
  ]) {
    assert.equal(matchesWebAppDesignIntent(phrase), true, phrase)
    assert.equal(matchesLandingPageIntent(phrase), false, phrase)
    assert.equal(matchStudioPreset(phrase)?.id, 'mobile_shop', phrase)
  }
})

test('only explicit landing / ladipage phrases are landing intent', () => {
  for (const phrase of [
    'tạo landing page',
    'Tôi muốn thiết kế landing page',
    'tạo ladipage',
    'tạo ladipge',
    'thiết kế landing',
    'trang đích',
  ]) {
    assert.equal(matchesLandingPageIntent(phrase), true, phrase)
    assert.equal(matchesWebAppDesignIntent(phrase), false, phrase)
    assert.equal(matchStudioPreset(phrase)?.id, 'landing_page', phrase)
  }
})

test('mixed web + landing wording prefers landing', () => {
  assert.equal(matchesLandingPageIntent('tạo web landing page'), true)
  assert.equal(matchesWebAppDesignIntent('tạo web landing page'), false)
  assert.equal(matchStudioPreset('tạo web landing page')?.id, 'landing_page')
})
