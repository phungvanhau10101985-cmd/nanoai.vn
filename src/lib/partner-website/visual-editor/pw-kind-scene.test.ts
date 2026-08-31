import { describe, expect, it } from 'vitest'
import {
  PW_KIND_SCENE,
  PW_KIND_SCENE_BG,
  PW_KIND_SCENE_CHROME,
  PW_KIND_SCENE_MEDIA,
  PW_KIND_SCENE_TEXT,
  kindLockedSceneFromAttrs,
  pwKindSceneAttr,
} from './pw-kind-scene'

function attrs(map: Record<string, string | null>): (name: string) => string | null {
  return (name) => (name in map ? map[name]! : null)
}

describe('kind locked scene', () => {
  it('pins added kinds to their default layer', () => {
    expect(kindLockedSceneFromAttrs(attrs({ 'data-pw-added-bg': '1' }))).toBe(PW_KIND_SCENE_BG)
    expect(kindLockedSceneFromAttrs(attrs({ 'data-pw-added-text': '1' }))).toBe(PW_KIND_SCENE_TEXT)
    expect(kindLockedSceneFromAttrs(attrs({ 'data-pw-added-btn': '1' }))).toBe(PW_KIND_SCENE_CHROME)
    expect(
      kindLockedSceneFromAttrs(attrs({ 'data-pw-chrome-added': '1', 'data-pw-chrome-btn': 'store' }))
    ).toBe(PW_KIND_SCENE_CHROME)
    expect(kindLockedSceneFromAttrs(attrs({ 'data-pw-added-image': '1' }))).toBe(PW_KIND_SCENE_MEDIA)
    expect(kindLockedSceneFromAttrs(attrs({ 'data-pw-added-video': '1' }))).toBe(PW_KIND_SCENE_MEDIA)
    expect(kindLockedSceneFromAttrs(attrs({ 'data-pw-added-catalog': '1' }))).toBe(PW_KIND_SCENE_MEDIA)
    expect(kindLockedSceneFromAttrs(attrs({ 'data-pw-featured-categories': '1' }))).toBe(PW_KIND_SCENE_MEDIA)
    expect(kindLockedSceneFromAttrs(attrs({ 'data-pw-catalog': '' }))).toBe(PW_KIND_SCENE_MEDIA)
    expect(kindLockedSceneFromAttrs(attrs({ 'data-pw-related': '1' }))).toBe(PW_KIND_SCENE_MEDIA)
    expect(kindLockedSceneFromAttrs(attrs({ 'data-pw-outfit': '1' }))).toBe(PW_KIND_SCENE_MEDIA)
    expect(kindLockedSceneFromAttrs(attrs({ 'data-pw-personalize': 'recommended' }))).toBe(
      PW_KIND_SCENE_MEDIA
    )
    expect(kindLockedSceneFromAttrs(attrs({ 'data-pw-added-banner': '1' }))).toBe(PW_KIND_SCENE_MEDIA)
    expect(kindLockedSceneFromAttrs(attrs({ 'data-pw-region': 'banner' }))).toBe(PW_KIND_SCENE_MEDIA)
  })

  it('does not lock kit chrome, header, or empty attrs', () => {
    expect(kindLockedSceneFromAttrs(attrs({ 'data-pw-chrome-kit': 'float' }))).toBeNull()
    expect(kindLockedSceneFromAttrs(attrs({ 'data-pw-region': 'header' }))).toBeNull()
    expect(kindLockedSceneFromAttrs(attrs({}))).toBeNull()
  })

  it('lets a mid button win over a catalog host attr on the same node', () => {
    expect(
      kindLockedSceneFromAttrs(
        attrs({
          'data-pw-chrome-added': '1',
          'data-pw-chrome-btn': 'store',
          'data-pw-catalog': '',
        })
      )
    ).toBe(PW_KIND_SCENE_CHROME)
  })

  it('stamps the scene attr helper', () => {
    expect(pwKindSceneAttr(PW_KIND_SCENE.media)).toBe(' data-pw-scene="2"')
    expect(PW_KIND_SCENE).toEqual({ bg: 1, media: 2, text: 3, chrome: 4 })
  })
})
