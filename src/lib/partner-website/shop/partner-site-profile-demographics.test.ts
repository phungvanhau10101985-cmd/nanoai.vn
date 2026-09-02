import assert from 'node:assert/strict'
import test from 'node:test'
import {
  assertDobChangeAllowed,
  birthYearFromIso,
  composeDobWithYear,
  parseDobParts,
  parseIsoDateOfBirth,
  parsePartnerShopGender,
  partnerShopBirthYearOptions,
} from '@/lib/partner-website/shop/partner-site-profile-demographics'

test('parses shop gender like 188 (male/female only)', () => {
  assert.equal(parsePartnerShopGender('male'), 'male')
  assert.equal(parsePartnerShopGender('Female'), 'female')
  assert.equal(parsePartnerShopGender('other'), null)
  assert.equal(parsePartnerShopGender(''), null)
})

test('parses ISO date of birth and rejects future / out-of-range years', () => {
  const now = new Date('2026-09-02T00:00:00.000Z')
  assert.equal(parseIsoDateOfBirth('1985-10-10', now), '1985-10-10')
  assert.equal(parseIsoDateOfBirth('2027-01-01', now), null)
  assert.equal(parseIsoDateOfBirth('1890-01-01', now), null)
  assert.equal(parseIsoDateOfBirth('not-a-date', now), null)
})

test('locks day/month after the first saved birthday', () => {
  assert.deepEqual(assertDobChangeAllowed(null, '1985-10-10'), { ok: true })
  assert.deepEqual(assertDobChangeAllowed('1985-10-10', '1990-10-10'), { ok: true })
  assert.deepEqual(assertDobChangeAllowed('1985-10-10', '1985-11-10'), {
    ok: false,
    code: 'DOB_DAY_LOCKED',
  })
  assert.equal(composeDobWithYear('1985-10-10', '1991'), '1991-10-10')
  assert.deepEqual(parseDobParts('1985-10-10'), { year: '1985', month: '10', day: '10' })
  assert.equal(birthYearFromIso('1985-10-10'), 1985)
})

test('birth year dropdown covers current year back 100 years', () => {
  const now = new Date('2026-06-01T00:00:00.000Z')
  const years = partnerShopBirthYearOptions(now)
  assert.equal(years[0], 2026)
  assert.equal(years[years.length - 1], 1926)
  assert.equal(years.length, 101)
})
