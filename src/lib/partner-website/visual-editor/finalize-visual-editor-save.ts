import type { PartnerWebsitePageKey } from '@/lib/partner-website/partner-website-page-catalog'
import type {
  PartnerWebsiteProject,
  PartnerWebsiteTheme,
} from '@/lib/partner-website/partner-website-types'
import { syncProductActionWidgetsAcrossProjectFiles } from '@/lib/partner-website/shop/sync-product-action-widgets'
import { syncSharedChromeAcrossProjectFiles } from '@/lib/partner-website/shop/sync-shared-chrome'
import {
  copyPageCloneElementsAcrossSameDevicePages,
} from '@/lib/partner-website/visual-editor/copy-element-across-pages'
import { normalizeVisualCoordinateContract } from '@/lib/partner-website/visual-editor/normalize-visual-coordinate-contract'
import { sanitizeVisualHtmlForStore } from '@/lib/partner-website/visual-editor/serialize-visual-editor-html'
import {
  applyVisualEditThemeFlag,
  mergeVisualPageHtmlIntoProject,
  productVisualShellHtmlPath,
  visualDeviceVariantFromHtmlPath,
  visualEditorHtmlPath,
  type VisualDeviceVariant,
} from '@/lib/partner-website/visual-editor/visual-editor-pages'

type FinalizeVisualEditorSaveInput = {
  project: PartnerWebsiteProject
  theme: PartnerWebsiteTheme
  htmlPath: string
  sourceHtml: string
  visualDevice: VisualDeviceVariant
  visualProductId?: string
  /** Desktop home mirror — used when `index.html` is missing so inner-page saves can still stamp chrome. */
  htmlSource?: string | null
  seedMissingHtml?: (path: string, pageKey: PartnerWebsitePageKey) => string
}

export type FinalizedVisualEditorSave = {
  project: PartnerWebsiteProject
  theme: PartnerWebsiteTheme
  canonicalHtml: string
  syncedHomeHtml: string
  clonedPageKeys: PartnerWebsitePageKey[]
}

/** `htmlSource` is only a compatibility mirror of canonical Desktop `index.html`. */
export function visualHomeHtmlSourceAfterSave(
  finalized: Pick<FinalizedVisualEditorSave, 'syncedHomeHtml'>,
  existingHtmlSource?: string | null
): string | null | undefined {
  const home = finalized.syncedHomeHtml.trim()
  return home.length >= 40 ? home : existingHtmlSource
}

/**
 * Pure half of the PATCH visual-save route.
 *
 * Keeping merge/chrome/clone/canonicalization here lets the route and parity tests
 * execute the exact same save transition without requiring a database in CI.
 */
function projectWithDeviceHomeFile(
  project: PartnerWebsiteProject,
  device: VisualDeviceVariant,
  htmlSource?: string | null
): PartnerWebsiteProject {
  const homePath = visualEditorHtmlPath('home', device)
  const existing = project.files.find((file) => file.path === homePath && file.kind === 'html')
  if ((existing?.content || '').trim().length >= 40) return project
  const fallback = device === 'desktop' ? htmlSource?.trim() || '' : ''
  if (fallback.length < 40) return project
  return mergeVisualPageHtmlIntoProject(project, fallback, homePath)
}

export function finalizeVisualEditorSave(
  input: FinalizeVisualEditorSaveInput
): FinalizedVisualEditorSave {
  const canonicalSource = normalizeVisualCoordinateContract(
    sanitizeVisualHtmlForStore(input.sourceHtml).trim(),
    { variant: input.visualDevice, writeCanonicalOnly: true }
  )
  if (canonicalSource.length < 40) {
    throw new Error('Visual HTML is empty — cannot save')
  }

  const projectWithHome = projectWithDeviceHomeFile(
    input.project,
    input.visualDevice,
    input.htmlSource
  )

  const otherDeviceHtml = new Map(
    input.project.files
      .filter(
        (file) =>
          file.kind === 'html' &&
          visualDeviceVariantFromHtmlPath(file.path) !== input.visualDevice
      )
      .map((file) => [file.path, file.content] as const)
  )

  const withProductShell = input.visualProductId
    ? mergeVisualPageHtmlIntoProject(
        projectWithHome,
        canonicalSource,
        productVisualShellHtmlPath(input.visualDevice)
      )
    : projectWithHome
  const merged = mergeVisualPageHtmlIntoProject(
    withProductShell,
    canonicalSource,
    input.htmlPath
  )
  const withActions = syncProductActionWidgetsAcrossProjectFiles(
    merged,
    input.htmlPath,
    canonicalSource
  )
  const withChrome = syncSharedChromeAcrossProjectFiles(
    withActions,
    input.htmlPath,
    canonicalSource
  )
  const cloned = copyPageCloneElementsAcrossSameDevicePages(
    withChrome,
    input.htmlPath,
    canonicalSource,
    input.seedMissingHtml ? { seedMissingHtml: input.seedMissingHtml } : undefined
  )
  const theme = cloned.pageKeys.reduce(
    (next, pageKey) =>
      applyVisualEditThemeFlag(next, { pageKey, variant: input.visualDevice }),
    input.theme
  )
  const project: PartnerWebsiteProject = {
    ...cloned.project,
    files: cloned.project.files.flatMap((file) => {
      if (file.kind !== 'html') return [file]
      const fileDevice = visualDeviceVariantFromHtmlPath(file.path)
      if (fileDevice !== input.visualDevice) {
        const original = otherDeviceHtml.get(file.path)
        if (original === undefined) return []
        return original === file.content ? [file] : [{ ...file, content: original }]
      }
      return [
        {
          ...file,
          content: normalizeVisualCoordinateContract(file.content, {
            variant: input.visualDevice,
            writeCanonicalOnly: true,
          }),
        },
      ]
    }),
  }
  const canonicalHtml =
    project.files
      .find((file) => file.kind === 'html' && file.path === input.htmlPath)
      ?.content?.trim() || canonicalSource
  const syncedHomeHtml =
    project.files
      .find((file) => file.kind === 'html' && file.path === 'index.html')
      ?.content?.trim() || ''

  return {
    project,
    theme,
    canonicalHtml,
    syncedHomeHtml,
    clonedPageKeys: cloned.pageKeys,
  }
}

