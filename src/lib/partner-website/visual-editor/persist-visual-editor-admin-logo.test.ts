import { describe, expect, it } from 'vitest'
import { isPersistableAdminLogoUrl } from './persist-visual-editor-admin-logo'

describe('isPersistableAdminLogoUrl', () => {
  it('accepts http(s) logo files', () => {
    expect(isPersistableAdminLogoUrl('https://cdn.example/logo.png')).toBe(true)
    expect(isPersistableAdminLogoUrl('http://localhost:3000/uploads/a.jpg')).toBe(true)
  })

  it('rejects empty or local paths', () => {
    expect(isPersistableAdminLogoUrl('')).toBe(false)
    expect(isPersistableAdminLogoUrl('/logo.png')).toBe(false)
    expect(isPersistableAdminLogoUrl('data:image/png;base64,xx')).toBe(false)
  })
})
