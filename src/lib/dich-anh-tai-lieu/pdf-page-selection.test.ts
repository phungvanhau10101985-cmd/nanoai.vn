import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { formatPdfPageSelection, parsePdfPageSelection, parseThumbPageList, pdfPageNumberFromUrl } from './pdf-page-selection'
import { parseKeepTerms } from './pdf-keep-terms'
import { parsePopplerXhtmlLayout } from './pdf-text-layout'

describe('parsePdfPageSelection', () => {
  it('reads a range and a single page', () => {
    const parsed = parsePdfPageSelection('3-8, 12', 20)
    assert.deepEqual('pages' in parsed ? parsed.pages : [], [3, 4, 5, 6, 7, 8, 12])
  })

  it('swaps a reversed range and drops duplicates', () => {
    const parsed = parsePdfPageSelection('8-3, 4', 20)
    assert.deepEqual('pages' in parsed ? parsed.pages : [], [3, 4, 5, 6, 7, 8])
  })

  it('rejects a page outside the file', () => {
    const parsed = parsePdfPageSelection('51', 50)
    assert.equal('error' in parsed ? parsed.error : '', 'range')
  })

  it('rejects a half-typed range', () => {
    const parsed = parsePdfPageSelection('3-', 20)
    assert.equal('error' in parsed ? parsed.error : '', 'format')
  })

  it('formats a run of pages', () => {
    assert.equal(formatPdfPageSelection([1, 2, 3, 5, 6]), '1-3, 5-6')
  })

  it('keeps at most eight real page numbers', () => {
    assert.deepEqual(parseThumbPageList('2, 2, 0, 9, 4', 8, 8), [2, 4])
    assert.equal(parseThumbPageList('1,2,3,4,5,6,7,8,9', 20, 8).length, 8)
  })

  it('reads the 1-based page from an upload name', () => {
    assert.equal(pdfPageNumberFromUrl('https://cdn.example/uploads/u/translate_pdf_1_page_2.png'), 3)
  })
})

describe('parseKeepTerms', () => {
  it('splits lines and commas and drops duplicates', () => {
    assert.deepEqual(parseKeepTerms('VTC-15, kW\nkW\n0901234567'), ['VTC-15', 'kW', '0901234567'])
  })
})

describe('parsePopplerXhtmlLayout', () => {
  it('joins words on a line and keeps the line box', () => {
    const xhtml = `<doc>
      <page width="612" height="792">
        <line xMin="72" yMin="70" xMax="300" yMax="84">
          <word xMin="72" yMin="70" xMax="110" yMax="84">Hello</word>
          <word xMin="116" yMin="70" xMax="180" yMax="84">world</word>
        </line>
      </page>
      <page width="200" height="300"></page>
    </doc>`
    const pages = parsePopplerXhtmlLayout(xhtml)
    assert.equal(pages.length, 2)
    assert.equal(pages[0].lines.length, 1)
    assert.equal(pages[0].lines[0].text, 'Hello world')
    assert.equal(pages[0].lines[0].x, 72)
    assert.equal(pages[0].lines[0].w, 228)
    assert.equal(pages[1].lines.length, 0)
  })
})
