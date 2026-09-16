import assert from 'node:assert/strict'
import test from 'node:test'
import {
  SETTINGS_DATA_ROLE_BOX_CLASS,
  SETTINGS_DATA_ROLE_INPUT_CLASS,
  SETTINGS_DATA_ROLE_LABEL_CLASS,
  SETTINGS_DATA_ROLE_SWATCH_CLASS,
  settingsDataRoleCopy,
} from '@/lib/messaging/settings-data-role'

test('settings data roles keep three distinct colors', () => {
  assert.match(SETTINGS_DATA_ROLE_BOX_CLASS.internal, /zinc/)
  assert.match(SETTINGS_DATA_ROLE_BOX_CLASS.issued, /blue/)
  assert.match(SETTINGS_DATA_ROLE_BOX_CLASS.inbound, /emerald/)
  assert.match(SETTINGS_DATA_ROLE_LABEL_CLASS.internal, /zinc/)
  assert.match(SETTINGS_DATA_ROLE_LABEL_CLASS.issued, /blue/)
  assert.match(SETTINGS_DATA_ROLE_LABEL_CLASS.inbound, /emerald/)
  assert.match(SETTINGS_DATA_ROLE_INPUT_CLASS.issued, /blue/)
  assert.match(SETTINGS_DATA_ROLE_INPUT_CLASS.inbound, /emerald/)
  assert.match(SETTINGS_DATA_ROLE_SWATCH_CLASS.internal, /zinc/)
  assert.match(SETTINGS_DATA_ROLE_SWATCH_CLASS.issued, /blue/)
  assert.match(SETTINGS_DATA_ROLE_SWATCH_CLASS.inbound, /emerald/)
})

test('settings data role copy maps messaging dictionary keys', () => {
  const copy = settingsDataRoleCopy({
    settingsDataRoleLegendTitle: 'Title',
    settingsDataRoleLegendInternal: 'Internal',
    settingsDataRoleLegendIssued: 'Issued',
    settingsDataRoleLegendInbound: 'Inbound',
    settingsDataRoleBadgeInternal: 'In',
    settingsDataRoleBadgeIssued: 'Out',
    settingsDataRoleBadgeInbound: 'Inb',
  } as Parameters<typeof settingsDataRoleCopy>[0])
  assert.equal(copy.legendTitle, 'Title')
  assert.equal(copy.badge.internal, 'In')
  assert.equal(copy.badge.issued, 'Out')
  assert.equal(copy.badge.inbound, 'Inb')
})
