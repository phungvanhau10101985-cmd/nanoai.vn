import assert from 'node:assert/strict'
import test from 'node:test'
import { parseHTML } from 'linkedom'
import {
  paintShopLoginIdentityOnElement,
  restoreLoginIdentitySeedsInDocument,
  shopCustomerInitials,
  shopCustomerLoginLabel,
  PW_LOGIN_IDENTITY_CSS,
} from '@/lib/partner-website/shop/partner-site-login-identity'

test('login identity label prefers shop name then profile then email local part', () => {
  assert.equal(shopCustomerLoginLabel({ customerName: 'Nguyễn Văn A', email: 'a@x.com' }), 'Nguyễn Văn A')
  assert.equal(shopCustomerLoginLabel({ profileName: 'Mai', email: 'a@x.com' }), 'Mai')
  assert.equal(shopCustomerLoginLabel({ email: 'mai.nguyen@gmail.com' }), 'mai.nguyen')
  assert.equal(shopCustomerLoginLabel({ customerName: 'Guest', email: 'a@x.com' }), 'a')
  assert.equal(shopCustomerLoginLabel({}), '')
})

test('login identity initials use first and last word', () => {
  assert.equal(shopCustomerInitials('Nguyễn Văn A'), 'NA')
  assert.equal(shopCustomerInitials('Mai'), 'MA')
  assert.equal(shopCustomerInitials(''), '?')
})

test('restore login seeds removes live name and avatar before save', () => {
  const { document } = parseHTML(
    `<a href="/account" data-pw-chrome-btn="login" data-pw-login-identity="1" data-pw-seed-login-label="Đăng nhập">
      <img class="pw-login-avatar" src="https://lh3.googleusercontent.com/a/x">
      <span class="pw-chrome-btn-label">Nguyễn Văn A</span>
    </a>`
  )
  restoreLoginIdentitySeedsInDocument(document)
  const el = document.querySelector('[data-pw-chrome-btn="login"]')
  assert.ok(el)
  assert.equal(el?.getAttribute('data-pw-login-identity'), null)
  assert.equal(el?.getAttribute('data-pw-seed-login-label'), null)
  assert.equal(el?.querySelector('.pw-login-avatar'), null)
  assert.equal(el?.textContent?.replace(/\s+/g, ' ').trim(), 'Đăng nhập')
})

test('login identity CSS shows avatar on text topbar buttons', () => {
  assert.match(PW_LOGIN_IDENTITY_CSS, /data-pw-login-identity/)
  assert.match(PW_LOGIN_IDENTITY_CSS, /\.pw-login-avatar/)
  assert.match(PW_LOGIN_IDENTITY_CSS, /border-radius:999px/)
  assert.match(PW_LOGIN_IDENTITY_CSS, /html\[data-pw-edit-device\]/)
  assert.match(PW_LOGIN_IDENTITY_CSS, /aspect-ratio:auto/)
  assert.match(PW_LOGIN_IDENTITY_CSS, /font-size:0!important/)
  assert.match(PW_LOGIN_IDENTITY_CSS, /font-size:13px!important/)
})

test('paint login identity replaces leftover Đăng nhập text with name and avatar', () => {
  const { document } = parseHTML(
    `<a href="/login" data-pw-chrome-btn="login" data-pw-chrome-style="text">Đăng nhập</a>`
  )
  const el = document.querySelector('[data-pw-chrome-btn="login"]')
  assert.ok(el)
  paintShopLoginIdentityOnElement(el as Element, { name: 'Phùng Hậu', avatarUrl: null }, '/account')
  assert.equal(el?.getAttribute('data-pw-login-identity'), '1')
  assert.equal(el?.getAttribute('href'), '/account')
  assert.equal(el?.querySelector('.pw-login-avatar-fallback')?.textContent, 'PH')
  assert.equal(el?.querySelector('.pw-chrome-btn-label')?.textContent, 'Phùng Hậu')
  assert.ok(el?.querySelector('.pw-login-avatar-fallback'))
  assert.doesNotMatch(el?.textContent || '', /Đăng nhập/)
})

test('client login identity helpers do not import postgres', async () => {
  const { readFile } = await import('node:fs/promises')
  const src = await readFile(new URL('./partner-site-login-identity.ts', import.meta.url), 'utf8')
  const link = await readFile(
    new URL('../../../components/partner-website/shop/partner-site-login-chrome-link.tsx', import.meta.url),
    'utf8'
  )
  assert.doesNotMatch(src, /from '@\/lib\/db\//)
  assert.doesNotMatch(src, /from 'pg'/)
  assert.doesNotMatch(link, /login-identity-pg/)
  assert.doesNotMatch(link, /from '@\/lib\/db\//)
})
