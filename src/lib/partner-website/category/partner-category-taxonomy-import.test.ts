import assert from 'node:assert/strict'
import test from 'node:test'
import * as XLSX from 'xlsx'
import {
  TAXONOMY_CATEGORY_COLUMNS,
  TAXONOMY_CATEGORY_PATH_COLUMNS,
  TAXONOMY_CLUSTER_COLUMNS,
  TAXONOMY_REQUIRED_SHEETS,
  buildManualTaxonomySheets,
  buildStandardTaxonomyTemplateBytes,
  buildStandardTaxonomyTemplateSheets,
  normalizeImportedSlug,
  parseTaxonomyWorkbook,
  truthyActive,
  truthyIndex,
} from '@/lib/partner-website/category/partner-category-taxonomy-import'

test('truthyActive / truthyIndex match 188 empty = false', () => {
  assert.equal(truthyActive('1'), true)
  assert.equal(truthyActive('true'), true)
  assert.equal(truthyActive(''), false)
  assert.equal(truthyActive('0'), false)
  assert.equal(truthyIndex('index'), true)
  assert.equal(truthyIndex(''), false)
  assert.equal(truthyIndex('noindex'), false)
})

test('standard template has 4 required sheets and example cat1–cat3 + clusters', () => {
  const sheets = buildStandardTaxonomyTemplateSheets()
  for (const name of TAXONOMY_REQUIRED_SHEETS) {
    assert.ok(Array.isArray(sheets[name]), name)
  }
  assert.equal(sheets.seo_clusters.length, 3)
  assert.equal(sheets.categories.length, 6)
  assert.equal(sheets.category_paths.length, 3)
  assert.deepEqual(Object.keys(sheets.categories[0] || {}).sort(), [...TAXONOMY_CATEGORY_COLUMNS].sort())
  assert.deepEqual(Object.keys(sheets.seo_clusters[0] || {}).sort(), [...TAXONOMY_CLUSTER_COLUMNS].sort())
  assert.deepEqual(Object.keys(sheets.category_paths[0] || {}).sort(), [...TAXONOMY_CATEGORY_PATH_COLUMNS].sort())
})

test('generated taxonomy_import.xlsx round-trips through parse', () => {
  const parsed = parseTaxonomyWorkbook(buildStandardTaxonomyTemplateBytes())
  assert.equal(parsed.ok, true)
  if (!parsed.ok) return
  assert.equal(parsed.clusters.length, 3)
  assert.equal(parsed.categories.length, 6)
  assert.equal(parsed.categories.filter((c) => c.level === 1).length, 1)
  assert.equal(parsed.categories.filter((c) => c.level === 2).length, 2)
  assert.equal(parsed.categories.filter((c) => c.level === 3).length, 3)
  assert.equal(parsed.pathErrors.length, 0)
  assert.equal(parsed.clusterErrors.length, 0)
  assert.equal(parsed.categoryErrors.length, 0)
  const tong = parsed.categories.find((c) => c.slug === 'dep-tong-nu-xop-mot')
  assert.equal(tong?.isActive, true)
  assert.equal(tong?.seoIndex, false)
  assert.equal(tong?.clusterExternalId, 'cluster__dep-tong-nu-xop-mot')
})

test('parse fails when a required sheet is missing', () => {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['id']]), 'categories')
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
  const parsed = parseTaxonomyWorkbook(buf)
  assert.equal(parsed.ok, false)
  if (parsed.ok) return
  assert.match(parsed.error, /thiếu sheet bắt buộc/)
  assert.match(parsed.error, /seo_clusters/)
})

test('manual upsert sheets use the same 188 external_id prefixes', () => {
  const built = buildManualTaxonomySheets({
    body: {
      cat1Name: 'Giày dép nữ',
      cat2Name: 'Dép sandal Nữ',
      cat3Name: 'Dép quai ngang nữ',
      clusterName: 'Dép sandal nữ quai ngang',
      cat3SeoIndex: 'index',
      isActive: true,
    },
  })
  assert.equal(built.cat1ExternalId, 'cat1__giay-dep-nu')
  assert.equal(built.cat2ExternalId, 'cat2__giay-dep-nu__dep-sandal-nu')
  assert.equal(built.cat3ExternalId, 'cat3__giay-dep-nu__dep-sandal-nu__dep-quai-ngang-nu')
  assert.equal(built.clusterExternalId, 'cluster__dep-sandal-nu-quai-ngang')
  assert.equal(built.sheets.categories.length, 3)
  assert.equal(built.sheets.seo_clusters.length, 1)
  assert.equal(built.sheets.category_paths.length, 1)
  const parsed = parseTaxonomyWorkbook(
    XLSX.write(
      (() => {
        const wb = XLSX.utils.book_new()
        for (const [name, rows] of Object.entries(built.sheets)) {
          XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), name)
        }
        return wb
      })(),
      { type: 'buffer', bookType: 'xlsx' }
    ) as Buffer
  )
  assert.equal(parsed.ok, true)
  if (!parsed.ok) return
  assert.equal(parsed.categories.length, 3)
  assert.equal(parsed.clusters.length, 1)
  assert.equal(parsed.pathErrors.length, 0)
})

test('manual form reuses existing cat1/cat2/cluster ids', () => {
  const built = buildManualTaxonomySheets({
    body: {
      cat1ExistingExternalId: 'cat1__giay-dep-nu',
      cat2ExistingExternalId: 'cat2__giay-dep-nu__dep-sandal-nu',
      cat3Name: 'Dép kẹp nữ',
      clusterExistingExternalId: 'cluster__dep-sandal-nu-quai-ngang',
    },
    existingCat1: { externalId: 'cat1__giay-dep-nu', name: 'Giày dép nữ', slug: 'giay-dep-nu', level: 1 },
    existingCat2: {
      externalId: 'cat2__giay-dep-nu__dep-sandal-nu',
      name: 'Dép sandal Nữ',
      slug: 'dep-sandal-nu',
      level: 2,
      parentExternalId: 'cat1__giay-dep-nu',
    },
    existingCluster: {
      externalId: 'cluster__dep-sandal-nu-quai-ngang',
      slug: 'dep-sandal-nu-quai-ngang',
      name: 'Dép sandal nữ quai ngang',
    },
  })
  assert.equal(built.sheets.categories.length, 1)
  assert.equal(built.sheets.seo_clusters.length, 0)
  assert.equal(built.cat3ExternalId, 'cat3__giay-dep-nu__dep-sandal-nu__dep-kep-nu')
  assert.equal(built.sheets.categories[0]?.parent_id, 'cat2__giay-dep-nu__dep-sandal-nu')
})

test('normalizeImportedSlug sanitizes invalid NanoAI slug but keeps valid 188 slug', () => {
  assert.deepEqual(normalizeImportedSlug('giay-dep-nu', 'Giày'), { slug: 'giay-dep-nu', warned: false })
  const bad = normalizeImportedSlug('Giày Dép!!', 'Giày dép nữ')
  assert.equal(bad.warned, true)
  assert.equal(bad.slug, 'giay-dep')
})

test('duplicate category id in sheet is reported, not silently kept twice', () => {
  const sheets = buildStandardTaxonomyTemplateSheets()
  sheets.categories.push({ ...sheets.categories[0]! })
  const parsed = parseTaxonomyWorkbook(
    XLSX.write(
      (() => {
        const wb = XLSX.utils.book_new()
        for (const [name, rows] of Object.entries(sheets)) {
          XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), name)
        }
        return wb
      })(),
      { type: 'buffer', bookType: 'xlsx' }
    ) as Buffer
  )
  assert.equal(parsed.ok, true)
  if (!parsed.ok) return
  assert.equal(parsed.categories.filter((c) => c.externalId === 'cat1__giay-dep-nu').length, 1)
  assert.ok(parsed.categoryErrors.some((m) => m.includes('trùng id')))
})
