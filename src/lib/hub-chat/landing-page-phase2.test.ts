import assert from 'node:assert/strict'

import test from 'node:test'



import {

  collectLandingPageSections,

  landingPageFilename,

  landingPageTitle,

  sortLandingSectionsByFlow,

} from '@/lib/hub-chat/landing-page-sections'

import { buildStandaloneLandingPageHtml } from '@/lib/hub-chat/landing-page-share-html'

import { normalizeLandingShareSections } from '@/lib/hub-chat/landing-page-share-utils'

import type { HubStudioSession } from '@/lib/hub-chat/hub-studio-types'



test('collectLandingPageSections returns landing_full only', () => {

  const session = {

    presetId: 'landing_page',

    briefNotes: { product_name: 'Bloom Studio' },

    referenceImages: [

      { screenKey: 'landing_full', screenLabel: 'Full LP', url: 'https://cdn/full.png', approvedAt: 1 },

      { screenKey: 'hero_desktop', screenLabel: 'Hero', url: 'https://cdn/b.png', approvedAt: 2 },

    ],

  } as unknown as HubStudioSession



  const sections = collectLandingPageSections(session, 'en')

  assert.equal(sections.length, 1)

  assert.equal(sections[0]?.key, 'landing_full')

  assert.equal(sections[0]?.url, 'https://cdn/full.png')

  assert.equal(landingPageTitle(session), 'Bloom Studio')

})



test('collectLandingPageSections empty when no landing_full', () => {

  const session = {

    presetId: 'landing_page',

    briefNotes: { product_name: 'TaskFlow' },

    referenceImages: [

      { screenKey: 'hero_desktop', screenLabel: 'Hero', url: 'https://cdn/b.png', approvedAt: 2 },

    ],

  } as unknown as HubStudioSession



  assert.equal(collectLandingPageSections(session, 'en').length, 0)

})



test('landingPageFilename slugifies title', () => {

  assert.equal(landingPageFilename('TaskFlow Pro'), 'landing-taskflow-pro')

})



test('buildStandaloneLandingPageHtml includes full landing section', () => {

  const html = buildStandaloneLandingPageHtml({

    title: 'Demo',

    logoUrl: 'https://cdn/logo.png',

    sections: [

      {

        key: 'landing_full',

        label: 'Full landing',

        url: 'https://cdn/full.png',

        formFactor: 'mobile',

      },

    ],

  })

  assert.ok(html.includes('<!DOCTYPE html>'))

  assert.ok(html.includes('https://cdn/full.png'))

})



test('sortLandingSectionsByFlow keeps landing_full', () => {

  const sorted = sortLandingSectionsByFlow([

    { key: 'landing_full', label: 'Full', url: 'https://x/f.png', formFactor: 'mobile' },

  ])

  assert.equal(sorted[0]?.key, 'landing_full')

})



test('normalizeLandingShareSections filters invalid rows', () => {

  const sections = normalizeLandingShareSections([

    { key: 'landing_full', label: 'Full', url: 'https://x/y.png', formFactor: 'mobile' },

    { key: '', url: 'bad' },

    null,

  ])

  assert.equal(sections.length, 1)

  assert.equal(sections[0]?.key, 'landing_full')

})

