import assert from 'node:assert/strict'
import test from 'node:test'
import { WEB_LOCALES } from '@/lib/i18n/config'
import { DEFAULT_PARTNER_WEBSITE_THEME } from '@/lib/partner-website/template/partner-website-template-types'
import { buildPartnerSiteShopThemeCss } from '@/lib/partner-website/shop/build-shop-theme-css'
import { injectPartnerShopRuntimeScriptsIntoHtml } from '@/lib/partner-website/shop/inject-partner-shop-runtime-scripts'
import { buildPartnerSiteBirthGenderPromptScript } from '@/lib/partner-website/shop/build-partner-site-birth-gender-prompt-script'
import {
  BIRTH_GENDER_PROMPT_COPY,
  birthGenderPromptLead,
  PW_BIRTH_GENDER_PROMPT_CSS,
} from '@/lib/partner-website/shop/partner-site-birth-gender-prompt'
import { isPartnerSiteShopLoginPath } from '@/lib/partner-website/shop/partner-site-birth-gender-prompt-session'
import {
  daysInCalendarMonth,
  isValidCalendarDate,
  partnerShopNeedsBirthOrGender,
} from '@/lib/partner-website/shop/partner-site-profile-demographics'

test('birth-gender prompt copy exists for all shop locales', () => {
  for (const locale of WEB_LOCALES) {
    const copy = BIRTH_GENDER_PROMPT_COPY[locale]
    assert.ok(copy.title)
    assert.ok(copy.lead)
    assert.ok(copy.leadNamed.includes('{shop}'))
    assert.equal(copy.monthLabels.length, 12)
    assert.ok(copy.defer)
    assert.ok(copy.save)
  }
  assert.match(birthGenderPromptLead('vi', '188.COM.VN'), /188\.COM\.VN/)
  assert.match(birthGenderPromptLead('vi', ''), /shop gửi/)
})

test('birth-gender prompt CSS matches 188 layout and theme tokens', () => {
  assert.match(PW_BIRTH_GENDER_PROMPT_CSS, /data-pw-birth-gender-prompt/)
  assert.match(PW_BIRTH_GENDER_PROMPT_CSS, /--pw-buy/)
  assert.match(PW_BIRTH_GENDER_PROMPT_CSS, /min-width:640px/)
  assert.doesNotMatch(PW_BIRTH_GENDER_PROMPT_CSS, /#ea580c|#f97316/)
  const theme = buildPartnerSiteShopThemeCss(DEFAULT_PARTNER_WEBSITE_THEME)
  assert.match(theme, /data-pw-birth-gender-prompt/)
})

test('live HTML injects birth-gender prompt; editor stamp strips it', () => {
  const html = '<!DOCTYPE html><html><body><header></header></body></html>'
  const out = injectPartnerShopRuntimeScriptsIntoHtml(html, {
    siteSlug: 'demo-shop',
    locale: 'vi',
    shopTitle: 'Demo Shop',
  })
  assert.match(out, /data-pw-birth-gender-prompt-bootstrap/)
  assert.match(out, /Nhận ưu đãi sinh nhật/)
  assert.match(out, /\/api\/site\/demo-shop\/personalization\/profile/)
  assert.match(out, /pw_fresh_login_after_auth:/)
  assert.match(out, /var SLUG="demo-shop"/)
  assert.match(out, /pwShopLiveUiOff/)
  const twice = injectPartnerShopRuntimeScriptsIntoHtml(out, {
    siteSlug: 'demo-shop',
    locale: 'vi',
  })
  assert.equal(twice.split('data-pw-birth-gender-prompt-bootstrap').length, 2)
})

test('prompt script skips login path and validates calendar like 188', () => {
  const script = buildPartnerSiteBirthGenderPromptScript({
    siteSlug: 'hotel-shop',
    locale: 'en',
    shopTitle: 'Hotel',
  })
  assert.match(script, /Get your birthday offer/)
  assert.match(script, /isLoginPath/)
  assert.match(script, /needGender/)
  assert.doesNotMatch(script, /#ea580c|#f97316/)
  assert.equal(isPartnerSiteShopLoginPath('/site/hotel-shop/login'), true)
  assert.equal(isPartnerSiteShopLoginPath('/login'), true)
  assert.equal(isPartnerSiteShopLoginPath('/site/hotel-shop/account'), false)
  assert.equal(daysInCalendarMonth(2024, 2), 29)
  assert.equal(isValidCalendarDate(2024, 2, 30), false)
  assert.equal(isValidCalendarDate(2024, 2, 29), true)
  assert.equal(partnerShopNeedsBirthOrGender({ gender: 'male', date_of_birth: '1990-05-01' }), false)
  assert.equal(partnerShopNeedsBirthOrGender({ gender: null, date_of_birth: '1990-05-01' }), true)
  assert.equal(partnerShopNeedsBirthOrGender({ gender: 'female', date_of_birth: null }), true)
})
