import assert from 'node:assert/strict'
import test from 'node:test'

import { getDictionary } from '@/lib/i18n/dictionaries'
import {
  featureLabelInHubText,
  hubThreadCreateTitle,
  hubThreadListLabel,
} from '@/lib/hub-chat/hub-thread-list-label'

const hint = (feature: string) =>
  getDictionary('vi').hubChat.featureOpenHint.replace('{feature}', feature)

test('feature chip creates a thread titled with the feature name', () => {
  assert.equal(
    hubThreadCreateTitle({
      action: 'select_feature',
      locale: 'vi',
      featureKey: 'tool:/tao-thiep-moi-cuoi-ai',
      message: '',
    }),
    'Tạo thiệp cưới AI'
  )
  assert.equal(
    hubThreadCreateTitle({
      action: 'select_feature',
      locale: 'vi',
      featureKey: 'tool:/ho-tro-lam-bai',
    }),
    'Hỗ trợ làm bài'
  )
  assert.equal(
    hubThreadCreateTitle({ action: 'start_preset', locale: 'vi', presetId: 'bag_kit' }),
    'Thiết kế túi đựng'
  )
})

test('placeholder Studio titles show the feature named in the conversation', () => {
  assert.equal(
    hubThreadListLabel(
      {
        title: 'Studio',
        presetId: null,
        projectTitle: null,
        firstUserMessage: 'Tạo thiệp cưới AI',
        lastMessagePreview: hint('Tạo thiệp cưới AI'),
      },
      'vi'
    ),
    'Tạo thiệp cưới AI'
  )
  assert.equal(
    hubThreadListLabel(
      {
        title: 'Studio',
        presetId: null,
        projectTitle: null,
        firstUserMessage: null,
        lastMessagePreview: hint('Hỗ trợ làm bài'),
      },
      'vi'
    ),
    'Hỗ trợ làm bài'
  )
  assert.equal(featureLabelInHubText(hint('Tạo thiệp cưới AI'), 'vi'), 'Tạo thiệp cưới AI')
})

test('studio preset and a real user title stay as they are', () => {
  assert.equal(
    hubThreadListLabel(
      {
        title: 'Studio',
        presetId: 'bag_kit',
        projectTitle: null,
        firstUserMessage: null,
        lastMessagePreview: 'Bạn muốn kích thước túi?',
      },
      'vi'
    ),
    'Thiết kế túi đựng'
  )
  assert.equal(
    hubThreadListLabel(
      {
        title: 'làm bài tập',
        presetId: null,
        projectTitle: null,
        firstUserMessage: 'làm bài tập',
        lastMessagePreview: 'Bạn muốn tôi hỗ trợ làm bài nào?',
      },
      'vi'
    ),
    'làm bài tập'
  )
  assert.equal(
    hubThreadListLabel(
      {
        title: 'Studio',
        presetId: 'bag_kit',
        projectTitle: 'Thiết kế túi đựng',
        firstUserMessage: 'Thiết kế túi đựng',
        lastMessagePreview: null,
      },
      'vi'
    ),
    'Thiết kế túi đựng'
  )
})
