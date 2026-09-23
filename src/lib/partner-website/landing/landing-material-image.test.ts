import assert from 'node:assert/strict'
import test from 'node:test'
import {
  pickMaterialProductImageUrl,
  resolveLandingMaterialImageSource,
} from '@/lib/partner-website/landing/landing-material-image'

test('single-product landing defaults to a gallery photo', () => {
  assert.equal(resolveLandingMaterialImageSource({ sourceType: 'products', productCount: 1 }), 'product')
  assert.equal(
    resolveLandingMaterialImageSource({ sourceType: 'products', productCount: 1, stored: 'ai' }),
    'ai'
  )
})

test('category landing keeps AI material images', () => {
  assert.equal(resolveLandingMaterialImageSource({ sourceType: 'category', productCount: 8 }), 'ai')
})

test('material photo prefers a gallery frame other than the cover', () => {
  assert.equal(
    pickMaterialProductImageUrl({
      imageUrl: 'https://cdn.example/cover.jpg',
      galleryImages: ['https://cdn.example/cover.jpg', 'https://cdn.example/detail.jpg'],
    }),
    'https://cdn.example/detail.jpg'
  )
  assert.equal(
    pickMaterialProductImageUrl({ imageUrl: 'https://cdn.example/only.jpg', galleryImages: [] }),
    'https://cdn.example/only.jpg'
  )
})
