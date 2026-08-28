'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { AlignCenter, AlignLeft, AlignRight, ArrowDown, ArrowUp, Bell, Bold, Camera, ChevronLeft, ChevronRight, ChevronsLeftRight, CircleHelp, ClipboardList, Clock, Copy, CreditCard, Crop, Download, ExternalLink, Eye, EyeOff, FileText, GripVertical, Heart, Home, ImagePlus, Images, Info, LayoutGrid, LayoutTemplate, Loader2, Lock, LogIn, LogOut, Mail, MapPin, Menu, MessageCircle, MousePointerClick, Newspaper, Package, Palette, Pencil, Phone, Plus, Redo2, RotateCcw, Ruler, Search, Share2, Shield, Shirt, ShoppingBag, Sparkles, Square, Store, Tag, Ticket, Trash2, Truck, Type, Undo2, Upload, User, UserPlus, Video, Wallet, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import type { WebLocale } from '@/lib/i18n/config'
import { getPartnerWebsiteCopy, type PartnerWebsiteCopy } from '@/lib/i18n/partner-website-copy'
import type {
  PartnerWebsiteCanonicalVisualSave,
  PartnerWebsiteProject,
} from '@/lib/partner-website/partner-website-types'
import { uploadPartnerImageFile } from '@/components/partner-website/partner-website-asset-panel'
import {
  buildVisualEditorScript,
  NANOAI_VE_MESSAGE,
} from '@/lib/partner-website/visual-editor/build-visual-editor-script'
import {
  serializeVisualEditorHtml,
  visualHtmlLooksUsable,
} from '@/lib/partner-website/visual-editor/serialize-visual-editor-html'
import { inferVisualEditImageKind, shouldUseCurrentImageAsRef } from '@/lib/partner-website/visual-editor/visual-editor-css-url'
import { buildAiImageColorFacts, mergeAiImageColorPrompt } from '@/lib/partner-website/visual-editor/merge-ai-image-color-prompt'
import {
  logoSizeFromAspect,
  mergeLogoSlotPrompt,
  type LogoDeviceKind,
  type LogoSlotKind,
  type LogoSlotPromptInput,
} from '@/lib/partner-website/visual-editor/build-logo-slot-prompt'
import {
  collectHttpImageUrls,
  dataUrlToPngFile,
  makeUserLogoColorSwatchDataUrl,
} from '@/lib/partner-website/visual-editor/logo-generation-context'
import { useToast } from '@/hooks/use-toast'
import { persistVisualEditorAdminLogo } from '@/lib/partner-website/visual-editor/persist-visual-editor-admin-logo'
import { persistVisualEditorChatIconLogo } from '@/lib/partner-website/visual-editor/persist-visual-editor-chat-icon-logo'
import { buildChatIconLogoPrompt } from '@/lib/partner-website/visual-editor/build-chat-icon-logo-prompt'
import {
  DEFAULT_LOGO_GEMINI_ASPECT_RATIO,
  LOGO_GEMINI_ASPECT_RATIOS,
  type LogoGeminiAspectRatio,
} from '@/lib/partner-website/visual-editor/gemini-working-aspect'
import type { PartnerWebsiteTheme } from '@/lib/partner-website/template/partner-website-template-types'
import { isHexColor, resolveShopThemeColors, themeCssVarMap } from '@/lib/partner-website/template/partner-website-theme-tokens'
import {
  cssColorToHex,
  shopThemeQuickPicksFromCopy,
  ThemeColorConfirmPicker,
} from '@/components/partner-website/partner-website-confirm-color-picker'
import { PartnerWebsiteThemeColorPicker } from '@/components/partner-website/partner-website-theme-color-picker'
import {
  parsePwBgStack,
  type PwBgStackItem,
  type PwBgStackRole,
} from '@/lib/partner-website/visual-editor/pw-bg-stack'
import {
  PW_SCENE_DEFAULT_INDEX,
  PW_SCENE_LAYERS,
  clampPwSceneIndex,
  pwSceneLayerPos,
} from '@/lib/partner-website/visual-editor/pw-scene'
import {
  buildVisualEditorChromeWidgetHtml,
  CHROME_FACEBOOK_CHAT_LOGO_SVG,
  CHROME_INSTAGRAM_LOGO_SVG,
  CHROME_WHATSAPP_LOGO_SVG,
  CHROME_ZALO_LOGO_SVG,
  chromeWidgetHost,
  chromeWidgetLabel,
  clampPwChromeGap,
  clampPwChromeIconSize,
  clampPwChromeLabelSize,
  clampPwChromeRadius,
  clampPwImageRadius,
  chromeKindShowsCountBadge,
  isChromeContactChatKind,
  isChromeIconOnlyStyle,
  isVisualEditorChromeWidgetKind,
  PW_CHROME_GAP_MAX,
  PW_CHROME_GAP_MIN,
  PW_CHROME_ICON_SIZE_DEFAULT,
  PW_CHROME_ICON_SIZE_MAX,
  PW_CHROME_ICON_SIZE_MIN,
  PW_CHROME_LABEL_SIZE_DEFAULT,
  PW_CHROME_LABEL_SIZE_MAX,
  PW_CHROME_LABEL_SIZE_MIN,
  PW_CHROME_RADIUS_MAX,
  PW_CHROME_RADIUS_MIN,
  PW_IMAGE_RADIUS_DEFAULT,
  PW_IMAGE_RADIUS_MAX,
  PW_IMAGE_RADIUS_MIN,
  PW_IMAGE_RADIUS_ROUNDED,
  VISUAL_EDITOR_CHROME_WIDGET_PICKER_KINDS,
  type VisualEditorChromeWidgetKind,
  type VisualEditorChromeWidgetStyle,
} from '@/lib/partner-website/visual-editor/chrome-widgets'
import {
  clampChromeKitShift,
  isChromeKitPickerKind,
  PW_KIT_X_MAX,
  PW_KIT_X_MIN,
} from '@/lib/partner-website/shop/partner-site-chrome-kit'
import {
  buildVisualEditorBannerHtml,
  bannerWidgetLabel,
} from '@/lib/partner-website/visual-editor/banner-widgets'
import {
  clampPwSliderWait,
  PW_SLIDER_SLIDE_MAX,
  PW_SLIDER_WAIT_DEFAULT,
  PW_SLIDER_WAIT_MAX,
  PW_SLIDER_WAIT_MIN,
  PW_SLIDER_WAIT_STEP,
} from '@/lib/partner-website/visual-editor/pw-slider-runtime'
import {
  buildVisualEditorProductGridHtml,
  productGridKindAllowedOnVisualPage,
  productGridWidgetLabel,
  VISUAL_EDITOR_PRODUCT_GRID_KINDS,
  type VisualEditorProductGridKind,
} from '@/lib/partner-website/visual-editor/product-grid-widgets'
import {
  canPickChromeGlyph,
  chromeGlyphsForKind,
  chromeGlyphSvg,
  normalizeChromeGlyph,
} from '@/lib/partner-website/visual-editor/chrome-widget-icons'
import {
  SEARCH_CAMERA_GLYPHS,
  SEARCH_LENS_GLYPHS,
  normalizeSearchGlyph,
  searchGlyphSvg,
  type SearchGlyphId,
} from '@/lib/partner-website/visual-editor/search-cluster-icons'
import { partnerSiteContactChannelsApiPath, partnerSiteProductsPath } from '@/lib/partner-website/shop/partner-site-shop-paths'
import type { PartnerSiteContactChannels } from '@/lib/partner-website/shop/partner-site-contact-channels'
import {
  extractFashionHomeCopyFromDocument,
  type FashionHomeCopyPatch,
} from '@/lib/partner-website/shop/build-fashion-home-copy'
import {
  appendVisualDeviceQuery,
  visualDeviceVariantFromHtmlPath,
} from '@/lib/partner-website/visual-editor/visual-editor-pages'
import type { PartnerWebsitePageKey } from '@/lib/partner-website/partner-website-page-catalog'
import {
  extractInfoPageCmsFromHtml,
} from '@/lib/partner-website/pages/partner-info-page-visual'
import { isPartnerTextArticlePage } from '@/lib/partner-website/pages/partner-text-article-page'
import {
  visualEditSelectValueFromTarget,
  visualEditTargetFromSelection,
} from '@/lib/partner-website/visual-editor/visual-edit-page-target'

const VISUAL_EDITOR_EDIT_KINDS = [
  'added-bg',
  'logo',
  'wordmark',
  'search',
  'search-submit',
  'search-image',
  'cat-toggle',
  'added-btn',
  'added-text',
  'chrome',
  'cta',
  'nav-link',
  'image',
  'dots',
  'field',
  'badge',
  'chat-embed',
  'paper',
  'other',
] as const
type VisualEditorEditKind = (typeof VISUAL_EDITOR_EDIT_KINDS)[number]

export type VisualEditorSelection = {
  isText: boolean
  isImage: boolean
  isBlock: boolean
  isMoveBlock: boolean
  isButton: boolean
  isAddedBtn: boolean
  isCatToggle: boolean
  isSearch: boolean
  isAddedBg: boolean
  isAddedBgSlot: boolean
  canClearBg: boolean
  isPaper: boolean
  isFillHost: boolean
  fillMode: 'color' | 'transparent' | 'image'
  paperMode: 'white' | 'image'
  paperPanX: number
  paperPanY: number
  bgCleared: boolean
  canInsertBgSlot: boolean
  editKind: VisualEditorEditKind
  chromeKind: string
  chromeSize: number
  chromeWidth: number
  chromeHeight: number
  chromeLabelSize: number
  chromeBold: boolean
  chromeGap: number
  chromeRadius: number
  chromeHover: string
  chromeCountOn: boolean
  chromeLayout: 'row' | 'col'
  canDelete: boolean
  layerPos: 'only' | 'bottom' | 'top' | 'middle' | ''
  layerIndex: number
  layerCount: number
  bgLayer: number
  bgIndex: number
  bgCount: number
  bgStack: PwBgStackItem[]
  isChrome: boolean
  chromeStyle: VisualEditorChromeWidgetStyle | ''
  chromeGlyph: string
  searchGlyph: string
  cameraGlyph: string
  lensGlyph: string
  btnStyle: 'hero' | 'primary' | 'outline' | ''
  btnColor: string
  btnBorder: string
  iconColor: string
  placeholderColor: string
  dotColor: string
  dotActiveColor: string
  text: string
  placeholder: string
  isBgImage: boolean
  isLogo: boolean
  logoFace: 'text' | 'image' | 'empty'
  logoSlot: LogoSlotKind
  logoBg: string
  logoBgImage: string
  themePrimary: string
  themeAccent: string
  themeBuy: string
  logoSlotCount: number
  logoFilledCount: number
  logoCropX: number
  logoCropY: number
  logoZoom: number
  isBannerPhoto: boolean
  isSlider: boolean
  slideWait: number
  slideArrows: boolean
  slideCount: number
  slideIndex: number
  bannerZoom: number
  logoLayer: 'block' | 'image' | ''
  hasImageLayer: boolean
  hasParentBlock: boolean
  canOverlay: boolean
  overlay: number
  paddingY: number
  paddingX: number
  canSizeBlock: boolean
  blockWidth: number
  blockHeight: number
  blockMaxWidth: number
  blockLabel: string
  textColor: string
  fontSize: number
  fontWeight: string
  textAlign: string
  bgColor: string
  src: string
  href: string
  imageWidth: number
  imageRadius: number
  canImageRadius: boolean
  width: number
  height: number
  canStickHeader: boolean
  stickHeader: boolean
  canPinScreen: boolean
  pinScreen: boolean
  canStayScroll: boolean
  stayScroll: boolean
  canHide: boolean
  canCopyToPages: boolean
  /** Lớp không gian toàn trang của phần tử — khác `layerIndex` (thứ tự trong vùng cha). */
  scene: number
  scenePos: 'bottom' | 'middle' | 'top'
  sceneCount: number
}

type HiddenBlockPlace = 'header' | 'dock' | 'float' | 'page'
type HiddenBlock = { id: string; label: string; place?: HiddenBlockPlace }

function parseHiddenBlockPlace(raw: unknown): HiddenBlockPlace | undefined {
  return raw === 'header' || raw === 'dock' || raw === 'float' || raw === 'page' ? raw : undefined
}

function hiddenPlaceCopy(place: HiddenBlockPlace | undefined, t: PartnerWebsiteCopy): string {
  if (place === 'header') return t.visualEditHiddenPlaceHeader
  if (place === 'dock') return t.visualEditHiddenPlaceDock
  if (place === 'float') return t.visualEditHiddenPlaceFloat
  if (place === 'page') return t.visualEditHiddenPlacePage
  return ''
}

function parseEditKind(raw: unknown): VisualEditorEditKind {
  return VISUAL_EDITOR_EDIT_KINDS.includes(raw as VisualEditorEditKind)
    ? (raw as VisualEditorEditKind)
    : 'other'
}

function parseLogoSlot(raw: unknown): LogoSlotKind {
  return raw === 'footer' || raw === 'header' ? raw : 'other'
}

function parseLogoFace(raw: unknown): VisualEditorSelection['logoFace'] {
  return raw === 'text' || raw === 'image' || raw === 'empty' ? raw : 'empty'
}

function selectionFromMessage(data: {
  isText?: boolean
  isImage?: boolean
  isBlock?: boolean
  isMoveBlock?: boolean
  isButton?: boolean
  isAddedBtn?: boolean
  isCatToggle?: boolean
  isSearch?: boolean
  isAddedBg?: boolean
  isAddedBgSlot?: boolean
  canClearBg?: boolean
  isPaper?: boolean
  isFillHost?: boolean
  fillMode?: string
  paperMode?: string
  paperPanX?: number
  paperPanY?: number
  bgCleared?: boolean
  canInsertBgSlot?: boolean
  editKind?: string
  chromeKind?: string
  chromeSize?: number
  chromeWidth?: number
  chromeHeight?: number
  chromeLabelSize?: number
  chromeBold?: boolean
  chromeGap?: number
  chromeRadius?: number
  chromeHover?: string
  chromeCountOn?: boolean
  chromeLayout?: 'row' | 'col'
  canDelete?: boolean
  layerPos?: string
  layerIndex?: number
  layerCount?: number
  bgLayer?: number
  bgIndex?: number
  bgCount?: number
  bgStack?: unknown
  isChrome?: boolean
  chromeStyle?: string
  chromeGlyph?: string
  searchGlyph?: string
  cameraGlyph?: string
  lensGlyph?: string
  btnStyle?: string
  btnColor?: string
  btnBorder?: string
  iconColor?: string
  placeholderColor?: string
  dotColor?: string
  dotActiveColor?: string
  text?: string
  placeholder?: string
  isBgImage?: boolean
  isLogo?: boolean
  logoFace?: string
  logoSlot?: string
  logoBg?: string
  logoBgImage?: string
  themePrimary?: string
  themeAccent?: string
  themeBuy?: string
  logoSlotCount?: number
  logoFilledCount?: number
  logoCropX?: number
  logoCropY?: number
  logoZoom?: number
  isBannerPhoto?: boolean
  isSlider?: boolean
  slideWait?: number
  slideArrows?: boolean
  slideCount?: number
  slideIndex?: number
  bannerZoom?: number
  logoLayer?: string
  hasImageLayer?: boolean
  hasParentBlock?: boolean
  canOverlay?: boolean
  overlay?: number
  paddingY?: number
  paddingX?: number
  canSizeBlock?: boolean
  blockWidth?: number
  blockHeight?: number
  blockMaxWidth?: number
  blockLabel?: string
  textColor?: string
  fontSize?: number
  fontWeight?: string
  textAlign?: string
  bgColor?: string
  src?: string
  href?: string
  imageWidth?: number
  imageRadius?: number
  canImageRadius?: boolean
  rect?: { width?: number; height?: number }
  canStickHeader?: boolean
  stickHeader?: boolean
  canPinScreen?: boolean
  pinScreen?: boolean
  canStayScroll?: boolean
  stayScroll?: boolean
  canHide?: boolean
  canCopyToPages?: boolean
  scene?: number
  scenePos?: string
  sceneCount?: number
}): VisualEditorSelection {
  return {
    isText: Boolean(data.isText),
    isImage: Boolean(data.isImage),
    isBlock: Boolean(data.isBlock),
    isMoveBlock: Boolean(data.isMoveBlock),
    isButton: Boolean(data.isButton),
    isAddedBtn: Boolean(data.isAddedBtn),
    isCatToggle: Boolean(data.isCatToggle),
    isSearch: Boolean(data.isSearch),
    isAddedBg: Boolean(data.isAddedBg),
    isAddedBgSlot: Boolean(data.isAddedBgSlot),
    canClearBg: Boolean(data.canClearBg),
    isPaper: Boolean(data.isPaper),
    isFillHost: Boolean(data.isFillHost),
    fillMode: data.fillMode === 'image' || data.fillMode === 'transparent' ? data.fillMode : 'color',
    paperMode: data.paperMode === 'image' ? 'image' : 'white',
    paperPanX: Number.isFinite(Number(data.paperPanX))
      ? Math.max(0, Math.min(100, Math.round(Number(data.paperPanX))))
      : 50,
    paperPanY: Number.isFinite(Number(data.paperPanY))
      ? Math.max(0, Math.min(100, Math.round(Number(data.paperPanY))))
      : 50,
    bgCleared: Boolean(data.bgCleared),
    canInsertBgSlot: Boolean(data.canInsertBgSlot),
    editKind: parseEditKind(data.editKind),
    chromeKind: String(data.chromeKind ?? '').replace(/[^a-z0-9-]/g, ''),
    chromeSize: clampPwChromeIconSize(data.chromeSize),
    chromeWidth: clampPwChromeIconSize(data.chromeWidth ?? data.chromeSize),
    chromeHeight: clampPwChromeIconSize(data.chromeHeight ?? data.chromeSize),
    chromeLabelSize: clampPwChromeLabelSize(data.chromeLabelSize),
    chromeBold: Boolean(data.chromeBold),
    chromeGap: clampPwChromeGap(data.chromeGap),
    chromeRadius: clampPwChromeRadius(data.chromeRadius),
    chromeHover: String(data.chromeHover ?? ''),
    chromeCountOn: data.chromeCountOn !== false,
    chromeLayout: data.chromeLayout === 'col' ? 'col' : 'row',
    canDelete: Boolean(data.canDelete),
    layerPos:
      data.layerPos === 'only' ||
      data.layerPos === 'bottom' ||
      data.layerPos === 'top' ||
      data.layerPos === 'middle'
        ? data.layerPos
        : '',
    layerIndex: Number(data.layerIndex) || 0,
    layerCount: Number(data.layerCount) || 0,
    bgLayer: Number(data.bgLayer) || 0,
    bgIndex: Number(data.bgIndex) || 0,
    bgCount: Number(data.bgCount) || 0,
    bgStack: parsePwBgStack(data.bgStack),
    isChrome: Boolean(data.isChrome),
    chromeGlyph: String(data.chromeGlyph ?? ''),
    searchGlyph: String(data.searchGlyph ?? ''),
    cameraGlyph: String(data.cameraGlyph ?? ''),
    lensGlyph: String(data.lensGlyph ?? ''),
    chromeStyle:
      data.chromeStyle === 'icon' ||
      data.chromeStyle === 'icon-square' ||
      data.chromeStyle === 'icon-label' ||
      data.chromeStyle === 'icon-label-below' ||
      data.chromeStyle === 'icon-label-left' ||
      data.chromeStyle === 'text'
        ? data.chromeStyle
        : '',
    btnStyle:
      data.btnStyle === 'hero' || data.btnStyle === 'primary' || data.btnStyle === 'outline'
        ? data.btnStyle
        : '',
    btnColor: String(data.btnColor ?? ''),
    btnBorder: String(data.btnBorder ?? ''),
    iconColor: String(data.iconColor ?? ''),
    placeholderColor: String(data.placeholderColor ?? ''),
    dotColor: String(data.dotColor ?? ''),
    dotActiveColor: String(data.dotActiveColor ?? ''),
    text: String(data.text ?? ''),
    placeholder: String(data.placeholder ?? ''),
    isBgImage: Boolean(data.isBgImage),
    isLogo: Boolean(data.isLogo),
    logoFace: parseLogoFace(data.logoFace),
    logoSlot: parseLogoSlot(data.logoSlot),
    logoBg: String(data.logoBg ?? ''),
    logoBgImage: String(data.logoBgImage ?? ''),
    themePrimary: String(data.themePrimary ?? ''),
    themeAccent: String(data.themeAccent ?? ''),
    themeBuy: String(data.themeBuy ?? ''),
    logoSlotCount: Number(data.logoSlotCount) || 0,
    logoFilledCount: Number(data.logoFilledCount) || 0,
    logoCropX: Number.isFinite(Number(data.logoCropX)) ? Number(data.logoCropX) : 0,
    logoCropY: Number.isFinite(Number(data.logoCropY)) ? Number(data.logoCropY) : 0,
    logoZoom: Number.isFinite(Number(data.logoZoom)) ? Math.max(30, Math.min(400, Number(data.logoZoom))) : 100,
    isBannerPhoto: Boolean(data.isBannerPhoto),
    isSlider: Boolean(data.isSlider),
    slideWait: clampPwSliderWait(data.slideWait ?? PW_SLIDER_WAIT_DEFAULT),
    slideArrows: data.slideArrows !== false,
    slideCount: Math.max(0, Math.round(Number(data.slideCount) || 0)),
    slideIndex: Math.max(0, Math.round(Number(data.slideIndex) || 0)),
    bannerZoom: Number.isFinite(Number(data.bannerZoom))
      ? Math.max(50, Math.min(300, Number(data.bannerZoom)))
      : 100,
    logoLayer: data.logoLayer === 'block' || data.logoLayer === 'image' ? data.logoLayer : '',
    hasImageLayer: Boolean(data.hasImageLayer),
    hasParentBlock: Boolean(data.hasParentBlock),
    canOverlay: Boolean(data.canOverlay),
    overlay: Number(data.overlay) || 0,
    paddingY: Number(data.paddingY) || 0,
    paddingX: Number(data.paddingX) || 0,
    canSizeBlock: Boolean(data.canSizeBlock),
    blockWidth: Number(data.blockWidth) || 0,
    blockHeight: Number(data.blockHeight) || 0,
    blockMaxWidth: Number(data.blockMaxWidth) || 0,
    blockLabel: String(data.blockLabel ?? ''),
    textColor: String(data.textColor ?? ''),
    fontSize: Number(data.fontSize) || 16,
    fontWeight: String(data.fontWeight ?? '400'),
    textAlign: String(data.textAlign ?? 'left'),
    bgColor: String(data.bgColor ?? ''),
    src: String(data.src ?? ''),
    href: String(data.href ?? ''),
    imageWidth: Number(data.imageWidth) || 100,
    imageRadius: clampPwImageRadius(data.imageRadius),
    canImageRadius: Boolean(data.canImageRadius),
    width: Number(data.rect?.width) || 0,
    height: Number(data.rect?.height) || 0,
    canStickHeader: Boolean(data.canStickHeader),
    stickHeader: Boolean(data.stickHeader),
    canPinScreen: Boolean(data.canPinScreen),
    pinScreen: Boolean(data.pinScreen),
    canStayScroll: Boolean(data.canStayScroll),
    stayScroll: Boolean(data.stayScroll),
    canHide: Boolean(data.canHide),
    canCopyToPages: data.canCopyToPages !== false,
    scene: clampPwSceneIndex(data.scene),
    scenePos:
      data.scenePos === 'bottom' || data.scenePos === 'top' || data.scenePos === 'middle'
        ? data.scenePos
        : pwSceneLayerPos(data.scene),
    sceneCount: Number(data.sceneCount) || PW_SCENE_LAYERS.length,
  }
}

function sceneLayerLabel(t: PartnerWebsiteCopy, index: number): string {
  const labels = [
    t.visualEditSceneBase,
    t.visualEditSceneLower,
    t.visualEditSceneMiddle,
    t.visualEditSceneUpper,
    t.visualEditSceneFloat,
  ]
  return labels[clampPwSceneIndex(index)] ?? t.visualEditSceneMiddle
}

function bgStackRoleLabel(t: PartnerWebsiteCopy, role: PwBgStackRole): string {
  const labels: Record<PwBgStackRole, string> = {
    canvas: t.visualEditBgStackCanvas,
    header: t.visualEditBgStackHeader,
    banner: t.visualEditBgStackBanner,
    categories: t.visualEditBgStackCategories,
    catalog: t.visualEditBgStackCatalog,
    promo: t.visualEditBgStackPromo,
    footer: t.visualEditBgStackFooter,
    content: t.visualEditBgStackContent,
    form: t.visualEditBgStackForm,
    gallery: t.visualEditBgStackGallery,
    'pdp-info': t.visualEditBgStackPdpInfo,
    reviews: t.visualEditBgStackReviews,
    'cart-list': t.visualEditBgStackCartList,
    'cart-summary': t.visualEditBgStackCartSummary,
    'account-nav': t.visualEditBgStackAccountNav,
    'account-main': t.visualEditBgStackAccountMain,
    added: t.visualEditBgStackAdded,
  }
  return labels[role] || t.visualEditBgStackAdded
}

const LOGO_COLOR_NAMES: Record<string, string> = {
  trắng: '#ffffff',
  white: '#ffffff',
  đen: '#111827',
  black: '#111827',
  đỏ: '#dc2626',
  red: '#dc2626',
  cam: '#c2410c',
  orange: '#c2410c',
  vàng: '#eab308',
  yellow: '#eab308',
  xanh: '#2563eb',
  blue: '#2563eb',
  'xanh lá': '#16a34a',
  green: '#16a34a',
  tím: '#7c3aed',
  purple: '#7c3aed',
  hồng: '#db2777',
  pink: '#db2777',
  xám: '#6b7280',
  gray: '#6b7280',
  grey: '#6b7280',
}

function parseLogoColorText(raw: string): string | null {
  const s = String(raw || '').trim()
  if (!s) return null
  const named = LOGO_COLOR_NAMES[s.toLowerCase()]
  if (named) return named
  const withHash = s.startsWith('#') || /^rgba?\(/i.test(s) ? s : `#${s}`
  if (isHexColor(withHash) || /^rgba?\(/i.test(withHash)) return cssColorToHex(withHash, '#000000')
  if (/^[0-9a-fA-F]{3}$/.test(s) || /^[0-9a-fA-F]{6}$/.test(s)) return cssColorToHex(`#${s}`, '#000000')
  return null
}

function logoPromptInputFrom(
  selection: VisualEditorSelection,
  websiteTitle: string,
  htmlPath: string,
  pick?: { bgColor?: string; inkColor?: string; width?: number; height?: number; aspectRatio?: string }
): LogoSlotPromptInput {
  const device: LogoDeviceKind = visualDeviceVariantFromHtmlPath(htmlPath)
  const sized = pick?.aspectRatio ? logoSizeFromAspect(pick.aspectRatio, device) : null
  return {
    shopTitle: websiteTitle || 'Shop',
    slot: selection.logoSlot || 'header',
    device,
    bgColor: pick?.bgColor || 'rgb(255, 255, 255)',
    inkColor: pick?.inkColor,
    aspectRatio: pick?.aspectRatio,
    width: pick?.width || sized?.w || selection.width,
    height: pick?.height || sized?.h || selection.height,
  }
}

const CHROME_WIDGET_ICONS: Record<VisualEditorChromeWidgetKind, LucideIcon> = {
  home: Home,
  products: Package,
  categories: Menu,
  search: Search,
  'search-image': Camera,
  sale: Tag,
  cart: ShoppingBag,
  wishlist: Heart,
  'favorite-product': Heart,
  'add-cart': ShoppingBag,
  'buy-now': ShoppingBag,
  'recently-viewed': Clock,
  'try-on': Sparkles,
  chat: MessageCircle,
  'chat-zalo': MessageCircle,
  'chat-facebook': MessageCircle,
  'chat-instagram': MessageCircle,
  'chat-whatsapp': MessageCircle,
  phone: Phone,
  share: Share2,
  coupon: Ticket,
  'lead-form': Mail,
  topup: ArrowUp,
  account: User,
  login: LogIn,
  register: UserPlus,
  logout: LogOut,
  orders: ClipboardList,
  'order-tracking': Truck,
  wallet: Wallet,
  addresses: MapPin,
  'edit-profile': Pencil,
  notifications: Bell,
  security: Shield,
  'install-app': Download,
  contact: Phone,
  about: Info,
  faq: CircleHelp,
  shipping: Truck,
  returns: RotateCcw,
  payment: CreditCard,
  stores: Store,
  lookbook: Images,
  'size-guide': Ruler,
  blog: Newspaper,
  privacy: Lock,
  terms: FileText,
  'favorites-link': Heart,
  'orders-link': ClipboardList,
}

type Props = {
  locale: WebLocale
  partnerId: string
  siteSlug?: string
  iframeRef: React.RefObject<HTMLIFrameElement | null>
  projectRef: React.RefObject<PartnerWebsiteProject | null>
  active: boolean
  disabled?: boolean
  websiteTitle?: string
  compact?: boolean
  sidebar?: boolean
  onSave?: (
    project: PartnerWebsiteProject
  ) => Promise<PartnerWebsiteCanonicalVisualSave | void>
  onSaveShopHome?: (patch: FashionHomeCopyPatch) => Promise<void>
  onCancel: () => void
  onError: (message: string) => void
  onDirtyChange?: (dirty: boolean) => void
  onAdminLogoChange?: (url: string) => void
  /** Bump when iframe document is replaced (src → srcdoc freeze). */
  documentKey?: string
  /** Project HTML path for the page being edited (home = index.html). */
  htmlPath?: string
  /** Live shop URL for the page being edited. */
  viewHref?: string
  pageKey?: PartnerWebsitePageKey
  cmsSlug?: string | null
  pageSelectValue?: string
  onOpenDestination?: (next: string) => void
  /** Màu giao diện đang chọn — gửi vào prompt tạo logo. */
  theme?: PartnerWebsiteTheme | null
  onThemeLiveChange?: (next: PartnerWebsiteTheme) => void
  /** Cập nhật theme không debounce màu (ẩn/hiện nút chat). */
  onThemeFieldsChange?: (next: PartnerWebsiteTheme) => void
  themeSaving?: boolean
  saveFnRef?: MutableRefObject<(() => Promise<boolean>) | null>
  onRequestLeave?: (kind: 'view' | 'exit') => void
}

type VisualEditorIframeWindow = Window & {
  __nanoaiVeBound?: number
  __nanoaiVeActivate?: (payload?: Record<string, unknown>) => void
  __nanoaiVeDeactivate?: () => void
}

function postToIframe(iframe: HTMLIFrameElement | null, type: string, payload?: Record<string, unknown>) {
  iframe?.contentWindow?.postMessage({ source: NANOAI_VE_MESSAGE, type, ...payload }, '*')
}

type VisualEditorGapUnit = { t: number; l: number; w: number; h: number }
type VisualEditorHGapUnit = VisualEditorGapUnit & { side: 'left' | 'right' }

function parseGapUnits(raw: unknown): VisualEditorGapUnit[] {
  if (!Array.isArray(raw)) return []
  const out: VisualEditorGapUnit[] = []
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue
    const t = Number((row as { t?: unknown }).t)
    const l = Number((row as { l?: unknown }).l)
    const w = Number((row as { w?: unknown }).w)
    const h = Number((row as { h?: unknown }).h)
    if (![t, l, w, h].every(Number.isFinite)) continue
    out.push({ t, l, w, h })
  }
  return out
}

function parseHGapUnits(raw: unknown): VisualEditorHGapUnit[] {
  if (!Array.isArray(raw)) return []
  const out: VisualEditorHGapUnit[] = []
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue
    const side = (row as { side?: unknown }).side
    if (side !== 'left' && side !== 'right') continue
    const t = Number((row as { t?: unknown }).t)
    const l = Number((row as { l?: unknown }).l)
    const w = Number((row as { w?: unknown }).w)
    const h = Number((row as { h?: unknown }).h)
    if (![t, l, w, h].every(Number.isFinite)) continue
    out.push({ t, l, w, h, side })
  }
  return out
}

function gapHPlusPoint(unit: VisualEditorHGapUnit): { x: number; y: number } {
  const outset = 22
  return {
    x: unit.side === 'left' ? unit.l - outset : unit.l + unit.w + outset,
    y: unit.t + unit.h / 2,
  }
}

function isLucideIconComponent(Icon: unknown): Icon is LucideIcon {
  return typeof Icon === 'object' && Icon !== null && '$$typeof' in Icon
}

function gapPlusPoint(index: number, units: VisualEditorGapUnit[]): { x: number; y: number } | null {
  const prev = index > 0 ? units[index - 1] : null
  const next = index < units.length ? units[index] : null
  if (prev && next) {
    return {
      x: (Math.min(prev.l, next.l) + Math.max(prev.l + prev.w, next.l + next.w)) / 2,
      y: (prev.t + prev.h + next.t) / 2,
    }
  }
  if (next) return { x: next.l + next.w / 2, y: next.t }
  if (prev) return { x: prev.l + prev.w / 2, y: prev.t + prev.h }
  return null
}

function iframeEditorWindow(iframe: HTMLIFrameElement | null): VisualEditorIframeWindow | null {
  return (iframe?.contentWindow as VisualEditorIframeWindow | null) || null
}

function shopDocIsBlank(doc: Document | null): boolean {
  if (!doc) return true
  try {
    return doc.location?.href === 'about:blank'
  } catch {
    return false
  }
}

function cleanSerializedHtml(raw: string, htmlPath: string): string {
  const parser = new DOMParser()
  const doc = parser.parseFromString(raw, 'text/html')
  return serializeVisualEditorHtml(doc, visualDeviceVariantFromHtmlPath(htmlPath))
}

type VisualEditOpenPanel = 'add' | 'logo' | 'theme' | 'block' | 'chromeKit'

type ChromeKitListItem = {
  kind: string
  hidden: boolean
  dockShow: string
  slot: string
  label: string
}

const FLOATING_PANEL_W = 320
const FLOATING_PANEL_TOP = 52

function defaultFloatingPanelPos(): { x: number; y: number } {
  if (typeof window === 'undefined') return { x: 16, y: FLOATING_PANEL_TOP }
  return {
    x: Math.max(8, window.innerWidth - FLOATING_PANEL_W - 16),
    y: FLOATING_PANEL_TOP,
  }
}

function clampFloatingPanelPos(x: number, y: number, el: HTMLElement | null) {
  const w = el?.offsetWidth || FLOATING_PANEL_W
  const h = Math.min(el?.offsetHeight || 240, window.innerHeight - 16)
  const maxX = Math.max(8, window.innerWidth - w - 8)
  const maxY = Math.max(8, window.innerHeight - Math.min(h, 64) - 8)
  return {
    x: Math.min(Math.max(8, x), maxX),
    y: Math.min(Math.max(8, y), maxY),
  }
}

function VisualEditFloatingPanel({
  title,
  dragHint,
  closeLabel,
  pos,
  onPosChange,
  onClose,
  children,
}: {
  title: string
  dragHint: string
  closeLabel?: string
  pos: { x: number; y: number }
  onPosChange: (next: { x: number; y: number }) => void
  onClose?: () => void
  children: ReactNode
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null)

  function onDragPointerDown(e: ReactPointerEvent<HTMLElement>) {
    if (e.button !== 0) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y }
  }

  function onDragPointerMove(e: ReactPointerEvent<HTMLElement>) {
    const drag = dragRef.current
    if (!drag) return
    onPosChange(
      clampFloatingPanelPos(drag.origX + e.clientX - drag.startX, drag.origY + e.clientY - drag.startY, panelRef.current)
    )
  }

  function onDragPointerUp(e: ReactPointerEvent<HTMLElement>) {
    dragRef.current = null
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
  }

  return (
    <div
      ref={panelRef}
      className="fixed z-[130] flex w-[20rem] max-w-[calc(100vw-16px)] flex-col overflow-hidden rounded-lg border bg-background shadow-lg"
      style={{ left: pos.x, top: pos.y }}
      role="dialog"
      aria-label={title}
    >
      <div className="flex items-center gap-1 border-b bg-muted/40 px-1.5 py-1">
        <span
          className="inline-flex cursor-grab touch-none select-none items-center text-muted-foreground active:cursor-grabbing"
          title={dragHint}
          onPointerDown={onDragPointerDown}
          onPointerMove={onDragPointerMove}
          onPointerUp={onDragPointerUp}
          onPointerCancel={onDragPointerUp}
        >
          <GripVertical className="h-4 w-4" aria-hidden />
        </span>
        <span
          className="min-w-0 flex-1 cursor-grab touch-none select-none truncate text-xs font-semibold active:cursor-grabbing"
          title={dragHint}
          onPointerDown={onDragPointerDown}
          onPointerMove={onDragPointerMove}
          onPointerUp={onDragPointerUp}
          onPointerCancel={onDragPointerUp}
        >
          {title}
        </span>
        {onClose && closeLabel ? (
          <Button type="button" size="sm" variant="ghost" className="h-6 gap-1 px-1.5 text-[10px]" onClick={onClose}>
            <X className="h-3 w-3" aria-hidden />
            {closeLabel}
          </Button>
        ) : null}
      </div>
      <div className="max-h-[min(70vh,28rem)] overflow-y-auto p-2">{children}</div>
    </div>
  )
}

function ChromeKitPanel({
  t,
  locale,
  device,
  head,
  dock,
  headX,
  busy,
  onToggleHead,
  onToggleDock,
  onReorder,
  onShiftHead,
}: {
  t: PartnerWebsiteCopy
  locale: WebLocale
  device: 'desktop' | 'laptop' | 'tablet' | 'mobile'
  head: ChromeKitListItem[]
  dock: ChromeKitListItem[]
  headX: number
  busy: boolean
  onToggleHead: (kind: string, hidden: boolean) => void
  onToggleDock: (kind: string, show: 'shop' | 'pdp' | 'both' | 'off') => void
  onReorder: (kind: string, bar: 'head' | 'dock', dir: 'up' | 'down') => void
  onShiftHead: (x: number) => void
}) {
  const headTitle =
    device === 'tablet' ? t.visualEditChromeKitHeadTablet : device === 'mobile' ? t.visualEditChromeKitHeadMobile : t.visualEditChromeKitHeadPc
  const showDock = device === 'mobile' || device === 'tablet'
  const shift = clampChromeKitShift(headX)
  return (
    <div className="flex max-h-[70vh] flex-col gap-2 overflow-y-auto">
      <p className="px-1 text-[10px] leading-4 text-muted-foreground">{t.visualEditChromeKitHint}</p>
      <label className="flex flex-col gap-1 px-1 text-[10px] text-muted-foreground">
        <span className="flex items-center justify-between gap-2">
          <span>{t.visualEditChromeKitShift}</span>
          <span className="inline-flex items-center gap-1">
            <input
              type="number"
              min={PW_KIT_X_MIN}
              max={PW_KIT_X_MAX}
              step={1}
              value={shift}
              disabled={busy}
              onChange={(e) => {
                if (e.target.value === '') return
                onShiftHead(clampChromeKitShift(e.target.value))
              }}
              className="h-6 w-14 rounded border bg-background px-1 text-right text-[11px] text-foreground"
            />
            <span>px</span>
          </span>
        </span>
        <input
          type="range"
          min={PW_KIT_X_MIN}
          max={PW_KIT_X_MAX}
          step={1}
          value={shift}
          disabled={busy}
          onChange={(e) => onShiftHead(clampChromeKitShift(e.target.value))}
          className="w-full accent-foreground"
        />
        <span className="leading-4">{t.visualEditChromeKitShiftHint}</span>
      </label>
      <p className="px-1 text-[11px] font-semibold">{headTitle}</p>
      {head.map((item) => (
        <ChromeKitRow
          key={`h-${item.kind}`}
          label={isVisualEditorChromeWidgetKind(item.kind) ? chromeWidgetLabel(item.kind, locale) : item.label}
          hidden={item.hidden}
          busy={busy}
          hideLabel={t.visualEditBlockHide}
          showLabel={t.visualEditBlockShow}
          onToggle={() => onToggleHead(item.kind, !item.hidden)}
          onUp={() => onReorder(item.kind, 'head', 'up')}
          onDown={() => onReorder(item.kind, 'head', 'down')}
        />
      ))}
      {showDock ? (
        <>
          <p className="mt-1 px-1 text-[11px] font-semibold">{t.visualEditChromeKitDock}</p>
          <div className="grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-1 px-1 text-[9px] text-muted-foreground">
            <span />
            <span>{t.visualEditChromeKitShopPages}</span>
            <span>{t.visualEditChromeKitPdp}</span>
            <span />
            <span />
          </div>
          {dock.map((item) => {
            const show = item.hidden ? 'off' : item.dockShow || 'shop'
            const shopOn = show === 'shop' || show === 'both'
            const pdpOn = show === 'pdp' || show === 'both'
            return (
              <div key={`d-${item.kind}`} className="grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-1 rounded px-1 py-0.5 hover:bg-muted/60">
                <span className="truncate text-[11px]">
                  {isVisualEditorChromeWidgetKind(item.kind) ? chromeWidgetLabel(item.kind, locale) : item.label}
                </span>
                <button
                  type="button"
                  className="rounded p-0.5"
                  disabled={busy}
                  title={t.visualEditChromeKitShopPages}
                  onClick={() => {
                    const nextShop = !shopOn
                    const next = nextShop && pdpOn ? 'both' : nextShop ? 'shop' : pdpOn ? 'pdp' : 'off'
                    onToggleDock(item.kind, next)
                  }}
                >
                  {shopOn ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />}
                </button>
                <button
                  type="button"
                  className="rounded p-0.5"
                  disabled={busy}
                  title={t.visualEditChromeKitPdp}
                  onClick={() => {
                    const nextPdp = !pdpOn
                    const next = shopOn && nextPdp ? 'both' : nextPdp ? 'pdp' : shopOn ? 'shop' : 'off'
                    onToggleDock(item.kind, next)
                  }}
                >
                  {pdpOn ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />}
                </button>
                <button type="button" className="rounded p-0.5" disabled={busy} onClick={() => onReorder(item.kind, 'dock', 'up')}>
                  <ArrowUp className="h-3 w-3" />
                </button>
                <button type="button" className="rounded p-0.5" disabled={busy} onClick={() => onReorder(item.kind, 'dock', 'down')}>
                  <ArrowDown className="h-3 w-3" />
                </button>
              </div>
            )
          })}
        </>
      ) : null}
    </div>
  )
}

function ChromeKitRow({
  label,
  hidden,
  busy,
  hideLabel,
  showLabel,
  onToggle,
  onUp,
  onDown,
}: {
  label: string
  hidden: boolean
  busy: boolean
  hideLabel: string
  showLabel: string
  onToggle: () => void
  onUp: () => void
  onDown: () => void
}) {
  return (
    <div className="flex items-center gap-1 rounded px-1 py-0.5 hover:bg-muted/60">
      <span className="min-w-0 flex-1 truncate text-[11px]">{label}</span>
      <button type="button" className="rounded p-0.5" disabled={busy} onClick={onToggle} title={hidden ? showLabel : hideLabel}>
        {hidden ? <EyeOff className="h-3.5 w-3.5 text-muted-foreground" /> : <Eye className="h-3.5 w-3.5" />}
      </button>
      <button type="button" className="rounded p-0.5" disabled={busy} onClick={onUp}>
        <ArrowUp className="h-3 w-3" />
      </button>
      <button type="button" className="rounded p-0.5" disabled={busy} onClick={onDown}>
        <ArrowDown className="h-3 w-3" />
      </button>
    </div>
  )
}

export function PartnerWebsiteVisualEditorToolbar({
  locale,
  partnerId,
  siteSlug,
  iframeRef,
  active,
  disabled,
  websiteTitle,
  compact = false,
  sidebar = false,
  onSave,
  onSaveShopHome,
  onCancel,
  onError,
  onDirtyChange,
  onAdminLogoChange,
  documentKey,
  htmlPath = 'index.html',
  viewHref,
  pageKey,
  cmsSlug,
  pageSelectValue,
  onOpenDestination,
  theme,
  onThemeLiveChange,
  onThemeFieldsChange,
  themeSaving,
  saveFnRef,
  onRequestLeave,
}: Props) {
  const t = getPartnerWebsiteCopy(locale)
  const { toast } = useToast()
  const themePicks = useMemo(() => shopThemeQuickPicksFromCopy(theme, t), [theme, t])
  const [selection, setSelection] = useState<VisualEditorSelection | null>(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploadBusy, setUploadBusy] = useState(false)
  const [aiBusy, setAiBusy] = useState(false)
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiImageColor, setAiImageColor] = useState(() =>
    theme ? cssColorToHex(resolveShopThemeColors(theme).primaryColor, '#c2410c') : '#c2410c'
  )
  const [aiImageAccent, setAiImageAccent] = useState(() =>
    theme ? cssColorToHex(resolveShopThemeColors(theme).accentColor, '#fb923c') : '#fb923c'
  )
  const [hrefDraft, setHrefDraft] = useState('')
  const [useCurrentRef, setUseCurrentRef] = useState(true)
  const [refUrl, setRefUrl] = useState('')
  const [infoAiPrompt, setInfoAiPrompt] = useState('')
  const [infoAiBusy, setInfoAiBusy] = useState(false)
  const rewriteInfoPageRef = useRef<(notes?: string) => Promise<void>>(async () => {})
  const [addBtnStyle, setAddBtnStyle] = useState<'hero' | 'primary' | 'outline'>('hero')
  const [addBtnLabel, setAddBtnLabel] = useState(t.visualEditAddButtonLabel)
  const [textDraft, setTextDraft] = useState('')
  const [addBtnColor, setAddBtnColor] = useState('')
  const [addBgColor, setAddBgColor] = useState(
    theme ? resolveShopThemeColors(theme).surfaceColor : '#f3f4f6'
  )
  const [addBtnBorder, setAddBtnBorder] = useState('#ffffff')
  const [addBtnHref, setAddBtnHref] = useState(siteSlug ? partnerSiteProductsPath(siteSlug) : '')
  const [addButtonPanelOpen, setAddButtonPanelOpen] = useState(false)
  const [contactChannels, setContactChannels] = useState<PartnerSiteContactChannels | null>(null)
  const [openPanel, setOpenPanel] = useState<VisualEditOpenPanel | null>(null)
  const [chromeKitHead, setChromeKitHead] = useState<ChromeKitListItem[]>([])
  const [chromeKitDock, setChromeKitDock] = useState<ChromeKitListItem[]>([])
  const [chromeKitHeadX, setChromeKitHeadX] = useState(0)
  const [panelPos, setPanelPos] = useState<{ x: number; y: number } | null>(null)
  const [bgColorPickerOpen, setBgColorPickerOpen] = useState(false)
  const pinnedBgSelectionRef = useRef<VisualEditorSelection | null>(null)
  const [logoAspect, setLogoAspect] = useState<LogoGeminiAspectRatio>(DEFAULT_LOGO_GEMINI_ASPECT_RATIO)
  const [logoBgChoice, setLogoBgChoice] = useState<'theme' | 'white' | 'custom'>('theme')
  const [logoBgCustom, setLogoBgCustom] = useState('#c2410c')
  const [logoInkChoice, setLogoInkChoice] = useState<'white' | 'theme' | 'custom'>('white')
  const [logoInkCustom, setLogoInkCustom] = useState('#ffffff')
  const [logoInkText, setLogoInkText] = useState('')
  const [chatIconPrompt, setChatIconPrompt] = useState('')
  const [hiddenBlocks, setHiddenBlocks] = useState<HiddenBlock[]>([])
  /** Lớp không gian đang được lọc để bấm. -1 = bấm mọi lớp. */
  const [sceneFocus, setSceneFocus] = useState(-1)
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)
  const insertBtnLockRef = useRef(false)
  const insertBgLockRef = useRef(false)
  const [addBgAskOpen, setAddBgAskOpen] = useState(false)
  const [insertBgPickPlace, setInsertBgPickPlace] = useState<'before' | 'after' | null>(null)
  const [insertAnchorActive, setInsertAnchorActive] = useState(false)
  const [insertAnchorPlace, setInsertAnchorPlace] = useState<'left' | 'right' | 'before' | 'after' | null>(
    null
  )
  const [gapUnits, setGapUnits] = useState<VisualEditorGapUnit[]>([])
  const [hGapUnits, setHGapUnits] = useState<VisualEditorHGapUnit[]>([])
  const [hGapActiveIndex, setHGapActiveIndex] = useState(-1)
  const [gapActiveIndex, setGapActiveIndex] = useState(-1)
  const [iframeBox, setIframeBox] = useState({ top: 0, left: 0, width: 0, height: 0 })
  const [chromeDupAskKind, setChromeDupAskKind] = useState<VisualEditorChromeWidgetKind | null>(null)
  const chromeDupAskKindRef = useRef<VisualEditorChromeWidgetKind | null>(null)
  const pendingChromeDupRef = useRef<{
    kind: VisualEditorChromeWidgetKind
    html: string
    host: string
  } | null>(null)
  const btnLabelFocusedRef = useRef(false)
  const textDraftFocusedRef = useRef(false)
  const btnHrefFocusedRef = useRef(false)
  const btnLabelInputRef = useRef<HTMLInputElement>(null)
  const textDraftInputRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const refFileRef = useRef<HTMLInputElement>(null)
  const logoFileRef = useRef<HTMLInputElement>(null)
  const articleImageFileRef = useRef<HTMLInputElement>(null)
  const freeImageFileRef = useRef<HTMLInputElement>(null)
  const [addVideoUrl, setAddVideoUrl] = useState('')
  const chatIconFileRef = useRef<HTMLInputElement>(null)
  const scriptInjectedRef = useRef(false)
  const lastLogoKeyRef = useRef('')
  const promptTextareaRef = useRef<HTMLTextAreaElement>(null)
  const aiLockRef = useRef(false)
  const saveWaiterRef = useRef<{ resolve: (ok: boolean) => void } | null>(null)
  const generateLogoRef = useRef<() => Promise<void>>(async () => {})

  useEffect(() => {
    onDirtyChange?.(dirty || canUndo)
  }, [dirty, canUndo, onDirtyChange])

  const openBlockPanel = useCallback(() => {
    setOpenPanel('block')
    setPanelPos((pos) => pos ?? defaultFloatingPanelPos())
  }, [])

  useEffect(() => {
    if (!active) {
      setOpenPanel(null)
      setAddButtonPanelOpen(false)
      setAddBgAskOpen(false)
      setInsertBgPickPlace(null)
      setInsertAnchorActive(false)
      setInsertAnchorPlace(null)
      setGapUnits([])
      setGapActiveIndex(-1)
      return
    }
    openBlockPanel()
  }, [active, openBlockPanel])

  useEffect(() => {
    if (!openPanel || openPanel === 'block') return
    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {
        if (openPanel === 'add') {
          postToIframe(iframeRef.current, 'clearInsertAnchor')
          setInsertAnchorActive(false)
          setInsertAnchorPlace(null)
        }
        openBlockPanel()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [openPanel, openBlockPanel])

  useEffect(() => {
    if (openPanel !== 'add' || !siteSlug?.trim()) return
    let cancelled = false
    void fetch(partnerSiteContactChannelsApiPath(siteSlug), { cache: 'no-store' })
      .then((r) => r.json())
      .then((j: { channels?: PartnerSiteContactChannels }) => {
        if (!cancelled && j.channels) setContactChannels(j.channels)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [openPanel, siteSlug])

  const hadSelectionRef = useRef(false)
  useEffect(() => {
    const has = Boolean(selection)
    if (has && !hadSelectionRef.current) {
      setOpenPanel('block')
      setPanelPos((pos) => pos ?? defaultFloatingPanelPos())
    }
    hadSelectionRef.current = has
  }, [selection])

  const activatePayloadRef = useRef<{
    device: ReturnType<typeof visualDeviceVariantFromHtmlPath>
    logoUrl: string
    chatIconLogoUrl: string
    vars: ReturnType<typeof themeCssVarMap> | undefined
    hideChatLauncher: boolean
    infoPage: boolean
    pageKey?: string
    cmsSlug?: string
    hoverNameOn: boolean
  }>({ device: 'desktop', logoUrl: '', chatIconLogoUrl: '', vars: undefined, hideChatLauncher: true, infoPage: false, hoverNameOn: true })
  activatePayloadRef.current = {
    device: visualDeviceVariantFromHtmlPath(htmlPath),
    logoUrl: theme?.logoUrl || '',
    chatIconLogoUrl: theme?.chatIconLogoUrl || '',
    vars: theme ? themeCssVarMap(theme) : undefined,
    hideChatLauncher: theme?.hideChatLauncher !== false,
    infoPage: isPartnerTextArticlePage({ pageKey, cmsSlug }),
    pageKey: pageKey || '',
    cmsSlug: cmsSlug?.trim() || '',
    hoverNameOn: true,
  }

  const isTextArticlePage = isPartnerTextArticlePage({ pageKey, cmsSlug })

  const injectScript = useCallback(() => {
    const iframe = iframeRef.current
    const doc = iframe?.contentDocument
    const win = iframeEditorWindow(iframe)
    if (!doc?.body || !win || shopDocIsBlank(doc)) return false
    try {
      win.__nanoaiVeDeactivate?.()
    } catch {
      /* ignore */
    }
    doc.getElementById('nanoai-visual-editor-script')?.remove()
    try {
      win.__nanoaiVeBound = 0
      win.__nanoaiVeActivate = undefined
      win.__nanoaiVeDeactivate = undefined
    } catch {
      /* ignore */
    }
    const script = doc.createElement('script')
    script.id = 'nanoai-visual-editor-script'
    script.textContent = buildVisualEditorScript(locale)
    try {
      doc.body.appendChild(script)
    } catch {
      return false
    }
    scriptInjectedRef.current = true
    return Boolean(doc.body.classList.contains('nanoai-ve-active') || win.__nanoaiVeActivate)
  }, [iframeRef, locale])

  const activateEditor = useCallback((iframe: HTMLIFrameElement | null) => {
    const win = iframeEditorWindow(iframe)
    try {
      if (typeof win?.__nanoaiVeActivate === 'function') {
        win.__nanoaiVeActivate(activatePayloadRef.current)
        return
      }
    } catch {
      /* fallback */
    }
    postToIframe(iframe, 'activate', activatePayloadRef.current)
  }, [])

  useEffect(() => {
    scriptInjectedRef.current = false
  }, [iframeRef.current?.src, active, documentKey])

  useEffect(() => {
    if (!active) return
    const iframe = iframeRef.current
    if (!iframe) return
    let cancelled = false
    let timer = 0
    let started = Date.now()

    const shopDocReady = () => {
      const doc = iframe.contentDocument
      if (!doc?.body || shopDocIsBlank(doc)) return false
      return Boolean(
        doc.querySelector(
          'header, .pw-header, .pw-shop-header, .pw-shop, [data-pw-page], .pw-hero, [data-pw-region="header"]'
        )
      )
    }

    // Saved HTML can carry a stale `nanoai-ve-active` class. Trusting the class alone would
    // skip injection forever, leaving clicks to follow the page's own links instead of selecting.
    const editorLive = () =>
      Boolean(
        iframeEditorWindow(iframe)?.__nanoaiVeBound &&
          iframe.contentDocument?.body?.classList.contains('nanoai-ve-active')
      )

    const arm = () => {
      if (cancelled) return
      if (editorLive()) return
      if (!shopDocReady()) {
        if (Date.now() - started < 8000) {
          window.clearTimeout(timer)
          timer = window.setTimeout(arm, 50)
        }
        return
      }
      injectScript()
      activateEditor(iframe)
      if (cancelled || editorLive()) return
      if (Date.now() - started < 8000) {
        window.clearTimeout(timer)
        timer = window.setTimeout(arm, 80)
      }
    }

    const onLoad = () => {
      if (cancelled) return
      started = Date.now()
      arm()
    }

    iframe.addEventListener('load', onLoad)
    arm()
    const watchdog = window.setInterval(() => {
      if (cancelled) return
      if (!shopDocReady()) return
      if (editorLive()) return
      injectScript()
      activateEditor(iframe)
    }, 400)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
      window.clearInterval(watchdog)
      iframe.removeEventListener('load', onLoad)
    }
  }, [active, documentKey, htmlPath, iframeRef, injectScript, activateEditor])

  useEffect(() => {
    if (!active) return
    const syncBox = () => {
      const r = iframeRef.current?.getBoundingClientRect()
      if (!r) return
      setIframeBox({ top: r.top, left: r.left, width: r.width, height: r.height })
    }
    syncBox()
    window.addEventListener('resize', syncBox)
    window.addEventListener('scroll', syncBox, true)
    return () => {
      window.removeEventListener('resize', syncBox)
      window.removeEventListener('scroll', syncBox, true)
    }
  }, [active, iframeRef, documentKey])

  useEffect(() => {
    if (!active) return
    const win = iframeRef.current?.contentWindow
    if (!win) return
    const onErr = (e: Event) => {
      e.preventDefault()
      e.stopImmediatePropagation()
    }
    const onParentErr = (e: ErrorEvent) => {
      if (!String(e.filename || '').includes('about:srcdoc')) return
      e.preventDefault()
      e.stopImmediatePropagation()
    }
    try {
      win.addEventListener('error', onErr)
      win.addEventListener('unhandledrejection', onErr)
    } catch {
      /* iframe may be cross-origin briefly */
    }
    window.addEventListener('error', onParentErr, true)
    return () => {
      window.removeEventListener('error', onParentErr, true)
      try {
        win.removeEventListener('error', onErr)
        win.removeEventListener('unhandledrejection', onErr)
      } catch {
        /* ignore */
      }
    }
  }, [active, documentKey, iframeRef])

  // Đổi trang chữ (shipping/returns…) → gửi lại activate với pageKey/infoPage đúng
  useEffect(() => {
    if (!active) return
    const iframe = iframeRef.current
    if (!iframe) return
    activateEditor(iframe)
  }, [active, pageKey, cmsSlug, activateEditor, iframeRef])

  useEffect(() => {
    if (active) return
    try {
      iframeEditorWindow(iframeRef.current)?.__nanoaiVeDeactivate?.()
    } catch {
      /* ignore */
    }
  }, [active, iframeRef])

  const handleSaveHtml = useCallback(
    async (rawHtml: string): Promise<boolean> => {
      setSaving(true)
      try {
        const iframe = iframeRef.current
        const doc = iframe?.contentDocument
        if (onSave) {
          const variant = visualDeviceVariantFromHtmlPath(htmlPath)
          const html = doc ? serializeVisualEditorHtml(doc, variant) : cleanSerializedHtml(rawHtml, htmlPath)
          if (!visualHtmlLooksUsable(html)) {
            onError(t.visualEditSaveFailed)
            saveWaiterRef.current?.resolve(false)
            saveWaiterRef.current = null
            return false
          }
          const next: PartnerWebsiteProject = {
            entryPath: htmlPath,
            files: [{ path: htmlPath, kind: 'html', content: html }],
          }
          await onSave(next)
          setDirty(false)
          setCanUndo(false)
          setCanRedo(false)
          postToIframe(iframeRef.current, 'resetHistory')
          saveWaiterRef.current?.resolve(true)
          saveWaiterRef.current = null
          return true
        }
        if (onSaveShopHome) {
          if (!doc) {
            onError(t.visualEditSaveFailed)
            saveWaiterRef.current?.resolve(false)
            saveWaiterRef.current = null
            return false
          }
          const patch = extractFashionHomeCopyFromDocument(doc)
          if (Object.values(patch).some((v) => v != null && !(Array.isArray(v) && v.length === 0))) {
            await onSaveShopHome(patch)
          }
          setDirty(false)
          setCanUndo(false)
          setCanRedo(false)
          postToIframe(iframeRef.current, 'resetHistory')
          saveWaiterRef.current?.resolve(true)
          saveWaiterRef.current = null
          return true
        }
        onError(t.visualEditSaveFailed)
        saveWaiterRef.current?.resolve(false)
        saveWaiterRef.current = null
        return false
      } catch (e) {
        onError(e instanceof Error ? e.message : t.visualEditSaveFailed)
        saveWaiterRef.current?.resolve(false)
        saveWaiterRef.current = null
        return false
      } finally {
        setSaving(false)
      }
    },
    [htmlPath, iframeRef, onError, onSave, onSaveShopHome, t.visualEditSaveFailed]
  )

  useEffect(() => {
    if (!active) {
      setSelection(null)
      setDirty(false)
      setAiPrompt('')
      setRefUrl('')
      setHrefDraft('')
      setHiddenBlocks([])
      setSceneFocus(-1)
      setCanUndo(false)
      setCanRedo(false)
      return
    }

    function onMessage(ev: MessageEvent) {
      const data = ev.data as {
        source?: string
        type?: string
        isText?: boolean
        isImage?: boolean
        isBlock?: boolean
        isMoveBlock?: boolean
        isButton?: boolean
        isAddedBtn?: boolean
        isCatToggle?: boolean
        isSearch?: boolean
        isAddedBg?: boolean
        isAddedBgSlot?: boolean
        canClearBg?: boolean
        bgCleared?: boolean
        canInsertBgSlot?: boolean
        editKind?: string
        chromeKind?: string
        chromeSize?: number
        chromeWidth?: number
        chromeHeight?: number
        chromeLabelSize?: number
        canDelete?: boolean
        canStickHeader?: boolean
        stickHeader?: boolean
        canPinScreen?: boolean
        canStayScroll?: boolean
        stayScroll?: boolean
        pinScreen?: boolean
        canCopyToPages?: boolean
        reason?: string
        id?: string
        isChrome?: boolean
        chromeStyle?: string
        searchGlyph?: string
        cameraGlyph?: string
        lensGlyph?: string
        btnStyle?: string
        btnColor?: string
        btnBorder?: string
        iconColor?: string
        placeholderColor?: string
        dotColor?: string
        dotActiveColor?: string
        text?: string
        isBgImage?: boolean
        isLogo?: boolean
        generate?: boolean
        logoFace?: string
        logoSlot?: string
        logoBg?: string
        logoBgImage?: string
        themePrimary?: string
        themeAccent?: string
        themeBuy?: string
        logoSlotCount?: number
        logoFilledCount?: number
        logoCropX?: number
        logoCropY?: number
        logoZoom?: number
        isBannerPhoto?: boolean
        bannerZoom?: number
        hasImageLayer?: boolean
        hasParentBlock?: boolean
        canOverlay?: boolean
        overlay?: number
        paddingY?: number
        paddingX?: number
        canSizeBlock?: boolean
        blockWidth?: number
        blockHeight?: number
        blockMaxWidth?: number
        blockLabel?: string
        textColor?: string
        fontSize?: number
        fontWeight?: string
        textAlign?: string
        bgColor?: string
        src?: string
        href?: string
        imageWidth?: number
        imageRadius?: number
        canImageRadius?: boolean
        html?: string
        rect?: { width?: number; height?: number }
        hidden?: HiddenBlock[] | boolean
        canUndo?: boolean
        canRedo?: boolean
        dirty?: boolean
        focus?: number
        notes?: string
        kind?: string
        picked?: boolean
        units?: unknown
        active?: number
        hUnits?: unknown
        hActive?: number
        place?: string
        index?: number
        head?: unknown
        dock?: unknown
        show?: string
        bar?: string
        dir?: string
      }
      if (data?.source !== NANOAI_VE_MESSAGE) return

      if (data.type === 'scene') {
        const focus = Number(data.focus)
        setSceneFocus(Number.isFinite(focus) && focus >= 0 ? clampPwSceneIndex(focus) : -1)
      }

      if (data.type === 'select' || data.type === 'logoCreate' || data.type === 'logoUpload') {
        const next = selectionFromMessage(data)
        setSelection(next)
        setHrefDraft(next.href)
        setUseCurrentRef(shouldUseCurrentImageAsRef(next))
        if (next.isLogo) {
          const logoKey = `${next.logoSlot}:${Math.round(next.width)}x${Math.round(next.height)}:${next.logoBg}:${next.themePrimary}:${next.logoBgImage}`
          if (data.type === 'logoCreate' || lastLogoKeyRef.current !== logoKey) {
            lastLogoKeyRef.current = logoKey
            setAiPrompt((prev) =>
              data.type === 'logoCreate' || /website logo for|drawn slot is/i.test(prev) ? '' : prev
            )
          }
        } else if (next.isBannerPhoto) {
          setAiPrompt((prev) => {
            const cur = prev.trim()
            if (!cur || cur === t.visualEditAiBannerDefault) return t.visualEditAiBannerDefault
            return prev
          })
        }
        if (data.type === 'logoCreate' && next.isLogo) {
          requestAnimationFrame(() => promptTextareaRef.current?.focus())
          if (data.generate) {
            window.setTimeout(() => {
              void generateLogoRef.current()
            }, 80)
          }
        }
        if (data.type === 'logoUpload') {
          window.setTimeout(() => logoFileRef.current?.click(), 0)
        }
        if (next.editKind === 'added-btn' || next.editKind === 'cta') {
          setAddButtonPanelOpen(true)
          const label = String(data.text ?? '').trim()
          if (!btnLabelFocusedRef.current) setAddBtnLabel(label || t.visualEditAddButtonLabel)
          if (data.btnStyle === 'hero' || data.btnStyle === 'primary' || data.btnStyle === 'outline') {
            setAddBtnStyle(data.btnStyle)
          }
          if (!btnLabelFocusedRef.current) {
            setAddBtnColor(String(data.btnColor ?? ''))
            if (data.btnBorder) setAddBtnBorder(String(data.btnBorder))
          }
          if (!btnHrefFocusedRef.current) setAddBtnHref(next.href)
        } else {
          setAddButtonPanelOpen(false)
        }
        if (data.type !== 'logoCreate' && data.type !== 'logoUpload' && data.picked) {
          openBlockPanel()
        }
        if (data.type === 'logoCreate' || data.type === 'logoUpload') {
          openBlockPanel()
        }
        if (
          (next.isText ||
            next.editKind === 'chrome' ||
            next.editKind === 'cat-toggle' ||
            next.editKind === 'search-submit' ||
            next.editKind === 'search-image' ||
            (next.editKind === 'nav-link' && next.chromeKind)) &&
          !textDraftFocusedRef.current
        ) {
          setTextDraft(String(data.text ?? ''))
        }
        if (next.editKind === 'search' && !textDraftFocusedRef.current) {
          const placeholder = (data as { placeholder?: unknown }).placeholder
          setTextDraft(String(placeholder ?? ''))
        }
      }
      if (data.type === 'deselect') {
        setSelection(null)
        setHrefDraft('')
        setAddButtonPanelOpen(false)
        pinnedBgSelectionRef.current = null
      }
      if (data.type === 'loaded') {
        if (active) activateEditor(iframeRef.current)
        postToIframe(iframeRef.current, 'listHidden')
      }
      if (data.type === 'ready') {
        postToIframe(iframeRef.current, 'listHidden')
        postToIframe(iframeRef.current, 'setHoverNameOn', { on: true })
      }
      if (data.type === 'dirty') {
        setDirty(true)
        setCanUndo(true)
      }
      if (data.type === 'infoSeoNotes' && typeof data.notes === 'string') {
        setInfoAiPrompt(data.notes)
      }
      if (data.type === 'infoAiRewrite') {
        const notes = typeof data.notes === 'string' ? data.notes : ''
        if (notes) setInfoAiPrompt(notes)
        void rewriteInfoPageRef.current(notes)
      }
      if (data.type === 'infoArticleInsertImage') {
        articleImageFileRef.current?.click()
      }
      if (data.type === 'history') {
        setCanUndo(Boolean(data.canUndo))
        setCanRedo(Boolean(data.canRedo))
        if (typeof data.dirty === 'boolean') setDirty(data.dirty)
      }
      if (data.type === 'hidden' && Array.isArray(data.hidden)) {
        setHiddenBlocks(
          data.hidden
            .map((row) => ({
              id: String(row.id ?? ''),
              label: String(row.label ?? ''),
              place: parseHiddenBlockPlace(row.place),
            }))
            .filter((row) => row.id)
        )
      }
      if (data.type === 'hideChatLauncher') {
        void persistChatLauncherHidden(data.hidden === true)
      }
      if (data.type === 'insertBgPicked') {
        setInsertBgPickPlace(null)
        setAddBgAskOpen(false)
        setDirty(true)
      }
      if (data.type === 'insertBgPickCancel') {
        setInsertBgPickPlace(null)
      }
      if (data.type === 'gapUnits') {
        setGapUnits(parseGapUnits(data.units))
        const nextActive = Number(data.active)
        setGapActiveIndex(Number.isFinite(nextActive) ? nextActive : -1)
        setHGapUnits(parseHGapUnits(data.hUnits))
        const nextH = Number(data.hActive)
        setHGapActiveIndex(Number.isFinite(nextH) ? nextH : -1)
      }
      if (data.type === 'openAddAtGap') {
        try {
          const place = String(data.place || '')
          setInsertAnchorActive(true)
          setInsertAnchorPlace(
            place === 'left' || place === 'right' || place === 'before' || place === 'after'
              ? place
              : null
          )
          setAddBgAskOpen(false)
          setInsertBgPickPlace(null)
          setOpenPanel('add')
          setPanelPos((pos) => pos ?? defaultFloatingPanelPos())
        } catch (err) {
          console.error(err)
        }
      }
      if (data.type === 'insertAnchorClear') {
        setInsertAnchorActive(false)
        setInsertAnchorPlace(null)
      }
      if (data.type === 'chromeDuplicateAsk') {
        const kind = String(data.kind || '')
        if (isVisualEditorChromeWidgetKind(kind)) {
          chromeDupAskKindRef.current = kind
          setChromeDupAskKind(kind)
        }
      }
      if (data.type === 'chromeKitState') {
        const head = Array.isArray(data.head) ? (data.head as ChromeKitListItem[]) : []
        const dock = Array.isArray(data.dock) ? (data.dock as ChromeKitListItem[]) : []
        setChromeKitHead(head)
        setChromeKitDock(dock)
        setChromeKitHeadX(clampChromeKitShift(data.headX))
      }
      if (data.type === 'favoriteNeedHost') {
        onError(t.visualEditFavoriteNeedHost)
      }
      if (data.type === 'copyToAllPagesSkip') {
        const reason = String(data.reason || '')
        onError(
          reason === 'chrome'
            ? t.visualEditCopyAllPagesSkip
            : reason === 'locked'
              ? t.visualEditCopyAllPagesLocked
              : t.visualEditCopyAllPagesNone
        )
      }
      if (data.type === 'copyToAllPagesReady') {
        void handleSaveHtml('').then((ok) => {
          if (!ok) return
          toast({ title: t.visualEditCopyAllPagesDone })
        })
      }
      if (data.type === 'html' && data.html && saveWaiterRef.current) {
        void handleSaveHtml(data.html)
      }
    }

    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [active, activateEditor, documentKey, handleSaveHtml, onError, openBlockPanel, t.visualEditAddButtonLabel, t.visualEditCopyAllPagesDone, t.visualEditCopyAllPagesLocked, t.visualEditCopyAllPagesNone, t.visualEditCopyAllPagesSkip, t.visualEditFavoriteNeedHost, toast])

  useEffect(() => {
    if (!active) return
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault()
        e.stopPropagation()
        if (!disabled && (dirty || canUndo)) void requestSave()
        return
      }
      if (e.key === 'Escape' || e.key === 'Esc') {
        if (insertBgPickPlace) {
          e.preventDefault()
          e.stopPropagation()
          postToIframe(iframeRef.current, 'cancelInsertBgPick')
          setInsertBgPickPlace(null)
          return
        }
        if (addBgAskOpen) {
          e.preventDefault()
          setAddBgAskOpen(false)
          return
        }
        if (insertAnchorActive) {
          e.preventDefault()
          postToIframe(iframeRef.current, 'clearInsertAnchor')
          setInsertAnchorActive(false)
          setInsertAnchorPlace(null)
          return
        }
      }
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return
      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault()
        e.stopPropagation()
        postToIframe(iframeRef.current, e.shiftKey ? 'redo' : 'undo')
        return
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault()
        e.stopPropagation()
        postToIframe(iframeRef.current, 'redo')
        return
      }
      if (!selection) return
      if (
        (e.key === 'Delete' || e.key === 'Backspace') &&
        (selection.isAddedBg || selection.canClearBg || selection.canDelete)
      ) {
        e.preventDefault()
        e.stopPropagation()
        postToIframe(
          iframeRef.current,
          selection.isBlock && selection.canDelete && !selection.isAddedBg ? 'deleteBlock' : 'deleteUnit'
        )
        setDirty(true)
        return
      }
      const step = e.shiftKey ? 10 : 1
      let dx = 0
      let dy = 0
      if (e.key === 'ArrowLeft') dx = -step
      else if (e.key === 'ArrowRight') dx = step
      else if (e.key === 'ArrowUp') dy = -step
      else if (e.key === 'ArrowDown') dy = step
      else return
      e.preventDefault()
      e.stopPropagation()
      postToIframe(iframeRef.current, 'nudge', { dx, dy })
      setDirty(true)
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [active, disabled, dirty, canUndo, iframeRef, selection, insertBgPickPlace, addBgAskOpen, insertAnchorActive])

  async function requestSave(): Promise<boolean> {
    const iframe = iframeRef.current
    const doc = iframe?.contentDocument
    if (doc?.documentElement) {
      return handleSaveHtml('')
    }
    if (!iframe) {
      onError(t.visualEditSaveFailed)
      return false
    }
    return new Promise((resolve) => {
      saveWaiterRef.current = { resolve }
      postToIframe(iframe, 'serialize')
      window.setTimeout(() => {
        if (saveWaiterRef.current) {
          saveWaiterRef.current = null
          onError(t.visualEditSaveFailed)
          resolve(false)
        }
      }, 20000)
    })
  }

  if (saveFnRef) saveFnRef.current = requestSave

  const liveViewHref = viewHref
    ? appendVisualDeviceQuery(viewHref, visualDeviceVariantFromHtmlPath(htmlPath))
    : undefined

  function openLiveView() {
    if (dirty || canUndo || saving || busy) return
    if (onRequestLeave) {
      onRequestLeave('view')
      return
    }
    if (!liveViewHref) return
    const bust = `v=${Date.now()}`
    const href = /[?&]v=/.test(liveViewHref)
      ? liveViewHref.replace(/([?&])v=[^&]*/, `$1${bust}`)
      : `${liveViewHref}${liveViewHref.includes('?') ? '&' : '?'}${bust}`
    window.open(href, '_blank', 'noopener,noreferrer')
  }

  async function persistChatLauncherHidden(hidden: boolean): Promise<boolean> {
    if (!partnerId) return false
    if ((theme?.hideChatLauncher !== false) === hidden) return true
    try {
      const res = await fetch(`/api/messaging/partner-website/${encodeURIComponent(partnerId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_chat_launcher', hideChatLauncher: hidden }),
      })
      const json = (await res.json().catch(() => ({}))) as {
        website?: { theme?: PartnerWebsiteTheme }
        error?: string
      }
      if (!res.ok) {
        onError(json.error || t.visualEditSaveFailed)
        return false
      }
      const nextTheme = { ...(json.website?.theme ?? theme) } as PartnerWebsiteTheme
      if (hidden) nextTheme.hideChatLauncher = true
      else nextTheme.hideChatLauncher = false
      onThemeFieldsChange?.(nextTheme)
      return true
    } catch {
      onError(t.visualEditSaveFailed)
      return false
    }
  }

  async function persistChatIconLogo(url: string): Promise<boolean> {
    if (!partnerId) return false
    const result = await persistVisualEditorChatIconLogo(partnerId, url)
    if (!result.ok) {
      onError(result.error || t.visualEditSaveFailed)
      return false
    }
    const nextTheme = { ...(result.theme ?? theme), chatIconLogoUrl: url } as PartnerWebsiteTheme
    onThemeFieldsChange?.(nextTheme)
    return true
  }

  async function applySharedChatIconLogo(url: string) {
    postToIframe(iframeRef.current, 'setChatIconLogo', { url })
    setDirty(true)
    await persistChatIconLogo(url)
  }

  async function persistAdminLogo(url: string) {
    const result = await persistVisualEditorAdminLogo(partnerId, url)
    if (!result.ok) {
      onError(result.error || t.visualEditSaveFailed)
      return
    }
    onAdminLogoChange?.(url)
  }

  async function handleUploadAsLogo(files: FileList | null) {
    if (!files?.length || !partnerId) return
    const file = files[0]
    if (!file?.type.startsWith('image/')) {
      onError(t.imageInvalidType)
      return
    }
    setUploadBusy(true)
    try {
      const url = await uploadPartnerImageFile(partnerId, file)
      postToIframe(iframeRef.current, 'setLogoSrc', { url, allSlots: true })
      setDirty(true)
      await persistAdminLogo(url)
      openBlockPanel()
    } catch (e) {
      onError(e instanceof Error ? e.message : t.uploadFailed)
    } finally {
      setUploadBusy(false)
    }
  }

  async function handleUploadReplace(files: FileList | null) {
    if (!files?.length || !partnerId) return
    const file = files[0]
    if (!file?.type.startsWith('image/')) {
      onError(t.imageInvalidType)
      return
    }
    setUploadBusy(true)
    try {
      const url = await uploadPartnerImageFile(partnerId, file)
      if (selection?.isLogo) {
        postToIframe(iframeRef.current, 'setLogoSrc', {
          url,
          allSlots: selection.logoFilledCount === 0,
        })
      } else {
        postToIframe(iframeRef.current, 'setImageSrc', {
          url,
          allSlots: false,
        })
      }
      setDirty(true)
      if (selection?.isLogo) await persistAdminLogo(url)
    } catch (e) {
      onError(e instanceof Error ? e.message : t.uploadFailed)
    } finally {
      setUploadBusy(false)
    }
  }

  async function handleUploadChatIconLogo(files: FileList | null) {
    if (!files?.length || !partnerId) return
    const file = files[0]
    if (!file?.type.startsWith('image/')) {
      onError(t.imageInvalidType)
      return
    }
    setUploadBusy(true)
    try {
      const url = await uploadPartnerImageFile(partnerId, file)
      await applySharedChatIconLogo(url)
    } catch (e) {
      onError(e instanceof Error ? e.message : t.uploadFailed)
    } finally {
      setUploadBusy(false)
    }
  }

  async function handleUploadArticleImage(files: FileList | null) {
    if (!files?.length || !partnerId) return
    const file = files[0]
    if (!file?.type.startsWith('image/')) {
      onError(t.imageInvalidType)
      return
    }
    setUploadBusy(true)
    try {
      const url = await uploadPartnerImageFile(partnerId, file)
      postToIframe(iframeRef.current, 'insertArticleImage', { url })
      setDirty(true)
      openBlockPanel()
    } catch (e) {
      onError(e instanceof Error ? e.message : t.uploadFailed)
    } finally {
      setUploadBusy(false)
    }
  }

  async function handleUploadFreeImage(files: FileList | null) {
    if (!files?.length || !partnerId) return
    const file = files[0]
    if (!file?.type.startsWith('image/')) {
      onError(t.imageInvalidType)
      return
    }
    setUploadBusy(true)
    try {
      const url = await uploadPartnerImageFile(partnerId, file)
      postToIframe(iframeRef.current, 'insertFreeImage', { url, useAnchor: insertAnchorActive })
      setDirty(true)
      openBlockPanel()
    } catch (e) {
      onError(e instanceof Error ? e.message : t.uploadFailed)
    } finally {
      setUploadBusy(false)
    }
  }

  async function handleUploadReference(files: FileList | null) {
    if (!files?.length || !partnerId) return
    const file = files[0]
    if (!file?.type.startsWith('image/')) {
      onError(t.imageInvalidType)
      return
    }
    setUploadBusy(true)
    try {
      const url = await uploadPartnerImageFile(partnerId, file)
      setRefUrl(url)
      setUseCurrentRef(false)
    } catch (e) {
      onError(e instanceof Error ? e.message : t.uploadFailed)
    } finally {
      setUploadBusy(false)
    }
  }

  async function requestGeneratedImage(input: {
    prompt: string
    kind: 'logo' | 'banner' | 'product_photo'
    aspectRatio: string
    referenceImageUrl?: string
    referenceImageUrls?: string[]
    referenceImageMeta?: Array<{ screenKey: string; label?: string }>
    allSlots?: boolean
    lockHeld?: boolean
    target?: 'image' | 'chat-icon'
  }) {
    if (!partnerId || (!input.lockHeld && aiLockRef.current)) return
    const prompt = input.prompt.trim()
    if (prompt.length < 4) {
      onError(t.visualEditAiPromptRequired)
      return
    }
    if (!input.lockHeld) {
      aiLockRef.current = true
      setAiBusy(true)
    }
    try {
      const refs = collectHttpImageUrls([
        ...(input.referenceImageUrls || []),
        input.referenceImageUrl,
      ])
      const res = await fetch(
        `/api/messaging/partner-website/${encodeURIComponent(partnerId)}/visual-edit-image`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({
            prompt,
            referenceImageUrl: refs[0] || null,
            referenceImageUrls: refs,
            referenceImageMeta: input.referenceImageMeta?.slice(0, refs.length),
            title: websiteTitle || 'Partner website',
            kind: input.kind,
            aspectRatio: input.aspectRatio,
          }),
        }
      )
      const json = (await res.json().catch(() => ({}))) as { publicUrl?: string; error?: string }
      if (!res.ok || !json.publicUrl) {
        onError(json.error || t.visualEditAiFailed)
        return
      }
      if (input.target === 'chat-icon') {
        await applySharedChatIconLogo(json.publicUrl)
      } else {
        if (input.kind === 'logo') {
          postToIframe(iframeRef.current, 'setLogoSrc', {
            url: json.publicUrl,
            allSlots: Boolean(input.allSlots),
          })
          setDirty(true)
          await persistAdminLogo(json.publicUrl)
        } else {
          postToIframe(iframeRef.current, 'setImageSrc', { url: json.publicUrl, allSlots: Boolean(input.allSlots) })
          setDirty(true)
        }
      }
    } catch (e) {
      onError(e instanceof Error ? e.message : t.visualEditAiFailed)
    } finally {
      if (!input.lockHeld) {
        aiLockRef.current = false
        setAiBusy(false)
      }
    }
  }

  function logoThemeHex() {
    const resolved = theme ? resolveShopThemeColors(theme) : null
    return cssColorToHex(selection?.themePrimary || resolved?.primaryColor || '', '#c2410c')
  }

  function logoPickColors() {
    const themeHex = logoThemeHex()
    const customBg = parseLogoColorText(logoBgCustom) || themeHex
    const bgColor = logoBgChoice === 'white' ? '#ffffff' : logoBgChoice === 'custom' ? customBg : themeHex
    const customInk = parseLogoColorText(logoInkCustom) || '#ffffff'
    const swatchInk =
      logoInkChoice === 'white' ? '#ffffff' : logoInkChoice === 'theme' ? themeHex : customInk
    const typedInk = logoInkText.trim()
    const inkColor = typedInk ? parseLogoColorText(typedInk) || typedInk : swatchInk
    return { themeHex, bgColor, inkColor }
  }

  function applyLogoBgChoice(choice: 'theme' | 'white') {
    setLogoBgChoice(choice)
    if (choice === 'white' && logoInkChoice === 'white') setLogoInkChoice('theme')
    if (choice === 'theme' && logoInkChoice === 'theme') setLogoInkChoice('white')
  }

  function applyLogoColorDraft(kind: 'bg' | 'ink', raw: string) {
    if (kind === 'bg') {
      setLogoBgCustom(raw)
      setLogoBgChoice('custom')
      return
    }
    setLogoInkCustom(raw)
    setLogoInkChoice('custom')
  }

  async function handleCreateChatIconLogo() {
    if (!partnerId || aiLockRef.current) return
    if (selection?.chromeKind !== 'chat') return
    aiLockRef.current = true
    setAiBusy(true)
    try {
      const styleRef = refUrl.trim()
      const refs = styleRef && /^https?:\/\//i.test(styleRef) ? [styleRef] : []
      await requestGeneratedImage({
        prompt: buildChatIconLogoPrompt({
          shopTitle: websiteTitle || 'Shop',
          extra: chatIconPrompt,
          hasReference: refs.length > 0,
          colorFacts: buildAiImageColorFacts({ main: aiImageColor, accent: aiImageAccent }),
        }),
        kind: 'logo',
        aspectRatio: '1:1',
        referenceImageUrls: refs,
        referenceImageMeta: refs.length
          ? [{ screenKey: 'chat_icon_style', label: 'Chat mua icon style reference' }]
          : undefined,
        target: 'chat-icon',
        lockHeld: true,
      })
    } catch (e) {
      onError(e instanceof Error ? e.message : t.visualEditAiFailed)
    } finally {
      aiLockRef.current = false
      setAiBusy(false)
    }
  }

  async function handleCreateLogoFromPanel() {
    if (!partnerId || aiLockRef.current) return
    const device: LogoDeviceKind = visualDeviceVariantFromHtmlPath(htmlPath)
    const size = logoSizeFromAspect(logoAspect, device)
    const { bgColor } = logoPickColors()
    postToIframe(iframeRef.current, 'placeHeaderLogo', {
      width: size.w,
      height: size.h,
      bgColor,
    })
    openBlockPanel()
    await new Promise((resolve) => window.setTimeout(resolve, 80))
    await handleGenerateAi({ forceLogo: true })
  }

  async function handleGenerateAi(opts?: { forceLogo?: boolean }) {
    if (!partnerId) return
    const asLogo = Boolean(opts?.forceLogo || selection?.isLogo)
    if (asLogo) {
      if (aiLockRef.current) return
      aiLockRef.current = true
      setAiBusy(true)
      try {
      const pick = logoPickColors()
      const device: LogoDeviceKind = visualDeviceVariantFromHtmlPath(htmlPath)
      const size = logoSizeFromAspect(logoAspect, device)
      const ctx = logoPromptInputFrom(
        selection || {
          isText: false,
          isImage: true,
          isBlock: false,
          isMoveBlock: false,
          isButton: false,
          isAddedBtn: false,
          isCatToggle: false,
          isSearch: false,
          isAddedBg: false,
          isAddedBgSlot: false,
          canClearBg: false,
          isPaper: false,
          isFillHost: false,
          fillMode: 'color',
          paperMode: 'white',
          paperPanX: 50,
          paperPanY: 50,
          bgCleared: false,
          canInsertBgSlot: false,
          editKind: 'logo',
          chromeKind: '',
          chromeSize: PW_CHROME_ICON_SIZE_DEFAULT,
          chromeWidth: PW_CHROME_ICON_SIZE_DEFAULT,
          chromeHeight: PW_CHROME_ICON_SIZE_DEFAULT,
          chromeLabelSize: PW_CHROME_LABEL_SIZE_DEFAULT,
          chromeBold: false,
          chromeGap: 6,
          chromeRadius: 0,
          chromeHover: '',
          chromeCountOn: true,
          chromeLayout: 'row',
          chromeGlyph: '',
          searchGlyph: '',
          cameraGlyph: '',
          lensGlyph: '',
          canDelete: false,
          layerPos: '',
          layerIndex: 0,
          layerCount: 0,
          bgLayer: 0,
          bgIndex: 0,
          bgCount: 0,
          bgStack: [],
          isChrome: false,
          chromeStyle: '',
          btnStyle: '',
          btnColor: '',
          btnBorder: '',
          iconColor: '',
          placeholderColor: '',
          dotColor: '',
          dotActiveColor: '',
          text: '',
          placeholder: '',
          isBgImage: false,
          isLogo: true,
          logoFace: 'empty',
          logoSlot: 'header',
          logoBg: pick.bgColor,
          logoBgImage: '',
          themePrimary: pick.themeHex,
          themeAccent: '',
          themeBuy: '',
          logoSlotCount: 0,
          logoFilledCount: 0,
          logoCropX: 0,
          logoCropY: 0,
          logoZoom: 100,
          isBannerPhoto: false,
          isSlider: false,
          slideWait: PW_SLIDER_WAIT_DEFAULT,
          slideArrows: true,
          slideCount: 0,
          slideIndex: 0,
          bannerZoom: 100,
          logoLayer: 'block',
          hasImageLayer: true,
          hasParentBlock: false,
          canOverlay: false,
          overlay: 0,
          paddingY: 0,
          paddingX: 0,
          canSizeBlock: false,
          blockWidth: 0,
          blockHeight: 0,
          blockMaxWidth: 0,
          blockLabel: '',
          textColor: '',
          fontSize: 16,
          fontWeight: '400',
          textAlign: 'left',
          bgColor: pick.bgColor,
          src: '',
          href: '',
          imageWidth: 100,
          imageRadius: PW_IMAGE_RADIUS_DEFAULT,
          canImageRadius: false,
          width: size.w,
          height: size.h,
          canStickHeader: false,
          stickHeader: false,
          canPinScreen: false,
          pinScreen: false,
          canStayScroll: false,
          stayScroll: false,
          canHide: false,
          canCopyToPages: false,
          scene: PW_SCENE_DEFAULT_INDEX,
          scenePos: 'middle',
          sceneCount: PW_SCENE_LAYERS.length,
        },
        websiteTitle || 'Shop',
        htmlPath,
        {
          bgColor: pick.bgColor,
          inkColor: pick.inkColor,
          width: size.w,
          height: size.h,
          aspectRatio: logoAspect,
        }
      )
      ctx.bgColor = pick.bgColor
      ctx.inkColor = pick.inkColor
      const prompt = mergeLogoSlotPrompt(aiPrompt, ctx)
      const refs: string[] = []
      const meta: Array<{ screenKey: string; label?: string }> = []
      const contextDataUrl = makeUserLogoColorSwatchDataUrl({
        bgColor: pick.bgColor,
        inkColor: pick.inkColor,
        aspectRatio: logoAspect,
      })
      const contextFile = dataUrlToPngFile(contextDataUrl, 'logo-user-colors.png')
      if (contextFile) {
        try {
          refs.push(await uploadPartnerImageFile(partnerId, contextFile))
          meta.push({ screenKey: 'logo_colors', label: 'User-picked background and logo colors' })
        } catch {
          /* keep generating with prompt colors if upload fails */
        }
      }
      const styleRef =
        refUrl.trim() ||
        (useCurrentRef && selection?.logoFace === 'image' ? selection.src.trim() : '')
      if (styleRef) {
        refs.push(styleRef)
        meta.push({ screenKey: 'logo_style', label: 'Logo style reference' })
      }
      await requestGeneratedImage({
        prompt,
        kind: 'logo',
        aspectRatio: logoAspect,
        referenceImageUrls: refs,
        referenceImageMeta: meta,
        allSlots: !selection || selection.logoFilledCount === 0,
        lockHeld: true,
      })
      } catch (e) {
        onError(e instanceof Error ? e.message : t.visualEditAiFailed)
      } finally {
        aiLockRef.current = false
        setAiBusy(false)
      }
      return
    }
    if (!selection) return
    if (aiPrompt.trim().length < 4) {
      onError(t.visualEditAiPromptRequired)
      return
    }
    const prompt = mergeAiImageColorPrompt(aiPrompt, { main: aiImageColor, accent: aiImageAccent })
    const inferred = inferVisualEditImageKind({
      ...selection,
      isBannerPhoto: selection.isBannerPhoto,
      isPaper: selection.isPaper,
      isFillHost: selection.isFillHost,
      isAddedBg: selection.isAddedBg,
    })
    let referenceImageUrl = refUrl.trim() || (useCurrentRef ? selection.src.trim() : '')
    if (useCurrentRef && !refUrl.trim() && selection.src.trim() && !/^https?:\/\//i.test(referenceImageUrl)) {
      try {
        const res = await fetch(selection.src.trim())
        if (res.ok) {
          const blob = await res.blob()
          if (blob.type.startsWith('image/') && partnerId) {
            const file = new File(
              [blob],
              'current-ref.png',
              { type: blob.type || 'image/png' }
            )
            referenceImageUrl = await uploadPartnerImageFile(partnerId, file)
          }
        }
      } catch {
        /* keep original src; API only accepts http(s) */
      }
    }
    await requestGeneratedImage({
      prompt,
      kind: inferred.kind,
      aspectRatio: inferred.aspectRatio,
      referenceImageUrl: referenceImageUrl || undefined,
    })
  }
  generateLogoRef.current = handleCreateLogoFromPanel

  function commitHref(next: string) {
    const kind = selection?.editKind
    if (kind !== 'added-btn' && kind !== 'cta' && kind !== 'nav-link' && kind !== 'added-text') return
    setHrefDraft(next)
    postToIframe(iframeRef.current, 'setHref', { href: next })
    setDirty(true)
  }

  function readInfoDraftFromIframe() {
    const doc = iframeRef.current?.contentDocument
    if (!doc) return { title: '', content: '' }
    const root =
      doc.querySelector(
        'main [data-pw-region="content"], main [data-pw-info-article], main .pw-shop-info, main [data-pw-info-body]'
      ) || doc.querySelector('[data-pw-region="content"], .pw-shop-info, [data-pw-info-article]')
    const html = `<article data-pw-region="content">${root?.innerHTML || ''}</article>`
    const extracted = extractInfoPageCmsFromHtml(html)
    return { title: extracted.title, content: extracted.content }
  }

  async function rewriteInfoPage(notesOverride?: string) {
    if (!partnerId || infoAiBusy) return
    const draft = readInfoDraftFromIframe()
    const notes = typeof notesOverride === 'string' ? notesOverride : infoAiPrompt
    // Ô gợi ý không bắt buộc: AI tự viết lại + tối ưu từ khóa từ tiêu đề/nội dung trang.
    if (!draft.content.trim() && !draft.title.trim() && !notes.trim() && !cmsSlug?.trim() && !pageKey) {
      onError(t.visualEditInfoAiNeedContent)
      return
    }
    setInfoAiBusy(true)
    postToIframe(iframeRef.current, 'setInfoSeoBusy', { busy: true })
    try {
      const res = await fetch(
        `/api/messaging/partner-website/${encodeURIComponent(partnerId)}/rewrite-info-page`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pageKey,
            cmsSlug,
            currentTitle: draft.title,
            currentContent: draft.content,
            extraPrompt: notes,
            locale,
          }),
        }
      )
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean
        title?: string
        paragraphs?: string[]
        seoTitle?: string
        seoDescription?: string
        keywords?: string[]
        error?: string
      }
      if (!res.ok || !json.success) {
        onError(json.error || t.visualEditAiFailed)
        return
      }
      postToIframe(iframeRef.current, 'setInfoPageContent', {
        title: json.title,
        paragraphs: json.paragraphs,
        seoTitle: json.seoTitle,
        seoDescription: json.seoDescription,
        keywords: json.keywords,
      })
      setDirty(true)
      window.setTimeout(() => {
        void requestSave()
      }, 120)
    } catch (e) {
      onError(e instanceof Error ? e.message : t.visualEditAiFailed)
    } finally {
      setInfoAiBusy(false)
      postToIframe(iframeRef.current, 'setInfoSeoBusy', { busy: false })
    }
  }
  rewriteInfoPageRef.current = rewriteInfoPage

  function insertChromeWidget(
    kind: VisualEditorChromeWidgetKind,
    opts?: { force?: boolean }
  ) {
    const slug = siteSlug?.trim()
    if (!slug) {
      onError(t.visualEditSaveFailed)
      return
    }
    const html = buildVisualEditorChromeWidgetHtml({
      kind,
      siteSlug: slug,
      locale,
      style: 'icon-label-left',
      logoUrl: kind === 'chat' ? theme?.chatIconLogoUrl || theme?.logoUrl || undefined : undefined,
      chatIconLogoUrl: kind === 'chat' ? theme?.chatIconLogoUrl || undefined : undefined,
      href:
        kind === 'chat-zalo'
          ? contactChannels?.zaloUrl
          : kind === 'chat-facebook'
            ? contactChannels?.messengerUrl
            : kind === 'chat-instagram'
              ? contactChannels?.instagramUrl
              : kind === 'chat-whatsapp' || kind === 'phone'
                ? contactChannels?.phone
                : undefined,
      iconSize: PW_CHROME_ICON_SIZE_DEFAULT,
    })
    if (!html) return
    const host = chromeWidgetHost(kind)
    pendingChromeDupRef.current = { kind, html, host }
    postToIframe(iframeRef.current, 'insertChromeBtn', {
      kind,
      html,
      host,
      force: Boolean(opts?.force),
      atCenter: true,
      useAnchor: insertAnchorActive,
    })
    if (opts?.force) {
      openBlockPanel()
      setDirty(true)
    }
  }

  function handleChromeDupAdd() {
    const pending = pendingChromeDupRef.current
    const kind = chromeDupAskKindRef.current
    chromeDupAskKindRef.current = null
    pendingChromeDupRef.current = null
    setChromeDupAskKind(null)
    if (pending && pending.kind === kind) {
      postToIframe(iframeRef.current, 'insertChromeBtn', {
        kind: pending.kind,
        html: pending.html,
        host: pending.host,
        force: true,
        atCenter: true,
      })
      setDirty(true)
      return
    }
    if (kind) insertChromeWidget(kind, { force: true })
  }

  function handleChromeDupKeep() {
    const kind = chromeDupAskKindRef.current
    if (!kind) return
    chromeDupAskKindRef.current = null
    pendingChromeDupRef.current = null
    setChromeDupAskKind(null)
    postToIframe(iframeRef.current, 'bringExistingChromeToCenter', { kind })
    setDirty(true)
  }

  function insertTextBlock() {
    if (insertBgPickPlace) cancelInsertBgPickUi()
    setAddBgAskOpen(false)
    postToIframe(iframeRef.current, 'insertText', { useAnchor: insertAnchorActive })
    setDirty(true)
    openBlockPanel()
  }

  function insertBgBlock(place: 'overlay' | 'before' | 'after' | 'anchor' = 'overlay') {
    if (insertBgLockRef.current) return
    insertBgLockRef.current = true
    window.setTimeout(() => {
      insertBgLockRef.current = false
    }, 700)
    const useAnchor = place === 'anchor' || insertAnchorActive
    postToIframe(iframeRef.current, 'insertBg', {
      color: addBgColor || '#f3f4f6',
      place: useAnchor ? 'anchor' : place,
      useAnchor,
    })
    setDirty(true)
    setAddBgAskOpen(false)
    setInsertBgPickPlace(null)
    if (useAnchor) {
      setInsertAnchorActive(false)
      setInsertAnchorPlace(null)
    }
    openBlockPanel()
  }

  function cancelInsertBgPickUi() {
    postToIframe(iframeRef.current, 'cancelInsertBgPick')
    setInsertBgPickPlace(null)
  }

  function startInsertBgPick(place: 'before' | 'after') {
    setAddBgAskOpen(false)
    setInsertBgPickPlace(place)
    postToIframe(iframeRef.current, 'startInsertBgPick', {
      place,
      color: addBgColor || '#f3f4f6',
    })
  }

  function insertBannerWidget() {
    const slug = siteSlug?.trim()
    if (!slug) {
      onError(t.visualEditSaveFailed)
      return
    }
    if (insertBgPickPlace) cancelInsertBgPickUi()
    setAddBgAskOpen(false)
    const html = buildVisualEditorBannerHtml({ kind: 'hero', siteSlug: slug, locale })
    if (!html) return
    postToIframe(iframeRef.current, 'insertBanner', { html, useAnchor: insertAnchorActive })
    setDirty(true)
    openBlockPanel()
  }

  function insertSliderWidget() {
    const slug = siteSlug?.trim()
    if (!slug) {
      onError(t.visualEditSaveFailed)
      return
    }
    if (insertBgPickPlace) cancelInsertBgPickUi()
    setAddBgAskOpen(false)
    const html = buildVisualEditorBannerHtml({ kind: 'slider', siteSlug: slug, locale })
    if (!html) return
    postToIframe(iframeRef.current, 'insertBanner', {
      html,
      slideHtml: buildVisualEditorBannerHtml({ kind: 'hero', siteSlug: slug, locale }),
      useAnchor: insertAnchorActive,
      beside: !insertAnchorActive,
      mergeSlide: true,
    })
    setDirty(true)
    openBlockPanel()
  }

  function insertProductGridWidget(kind: VisualEditorProductGridKind) {
    const slug = siteSlug?.trim()
    if (!slug) {
      onError(t.visualEditSaveFailed)
      return
    }
    if (!productGridKindAllowedOnVisualPage(kind, pageKey)) return
    if (insertBgPickPlace) cancelInsertBgPickUi()
    setAddBgAskOpen(false)
    const html = buildVisualEditorProductGridHtml({ kind, siteSlug: slug, locale, limit: 10 })
    if (!html) return
    postToIframe(iframeRef.current, 'insertProductGrid', { html, useAnchor: insertAnchorActive })
    setDirty(true)
    openBlockPanel()
  }

  function insertButtonBlock() {
    if (insertBgPickPlace) cancelInsertBgPickUi()
    setAddBgAskOpen(false)
    if (insertBtnLockRef.current) return
    insertBtnLockRef.current = true
    window.setTimeout(() => {
      insertBtnLockRef.current = false
    }, 700)
    postToIframe(iframeRef.current, 'insertButton', {
      style: addBtnStyle,
      label: addBtnLabel.trim() || t.visualEditAddButtonLabel,
      href: addBtnHref.trim() || (siteSlug ? partnerSiteProductsPath(siteSlug) : ''),
      useAnchor: insertAnchorActive,
      color: addBtnColor,
    })
    setDirty(true)
    openBlockPanel()
    setAddButtonPanelOpen(true)
  }

  function chromeStyleChoices(): Array<[VisualEditorChromeWidgetStyle, string]> {
    return [
      ['icon', t.visualEditAddStyleIcon],
      ['icon-square', t.visualEditAddStyleIconSquare],
      ['icon-label-below', t.visualEditAddStyleIconLabelBelow],
      ['icon-label-left', t.visualEditAddStyleIconLabelLeft],
      ['text', t.visualEditAddStyleText],
    ]
  }

  function applySelectedChromeStyle(style: VisualEditorChromeWidgetStyle) {
    postToIframe(iframeRef.current, 'setChromeStyle', { style })
    setDirty(true)
  }

  function renderChromeGlyphPicker(kind: string, current: string) {
    if (!canPickChromeGlyph(kind)) return null
    const glyphs = chromeGlyphsForKind(kind)
    const activeGlyph = normalizeChromeGlyph(kind, current)
    return (
      <div className="space-y-1">
        <p className="text-[10px] text-muted-foreground">{t.visualEditSearchGlyph}</p>
        <div className="flex flex-wrap gap-1">
          {glyphs.map((glyph) => (
            <Button
              key={glyph}
              type="button"
              size="sm"
              variant={activeGlyph === glyph ? 'default' : 'outline'}
              className={cn(btn, 'px-1.5')}
              disabled={busy}
              title={glyph}
              onClick={() => {
                postToIframe(iframeRef.current, 'setChromeGlyph', { glyph })
                setDirty(true)
              }}
            >
              <span
                className="inline-flex h-4 w-4 items-center justify-center [&>svg]:h-4 [&>svg]:w-4"
                dangerouslySetInnerHTML={{ __html: chromeGlyphSvg(glyph, '') }}
              />
            </Button>
          ))}
        </div>
      </div>
    )
  }

  function renderSearchGlyphPicker(kind: 'camera' | 'lens', current: string, label?: string) {
    const glyphs = kind === 'camera' ? SEARCH_CAMERA_GLYPHS : SEARCH_LENS_GLYPHS
    const activeGlyph = normalizeSearchGlyph(kind, current)
    return (
      <div className="space-y-1">
        <p className="text-[10px] text-muted-foreground">
          {label || (kind === 'camera' ? t.visualEditSearchCameraGlyph : t.visualEditSearchLensGlyph)}
        </p>
        <div className="flex flex-wrap gap-1">
          {glyphs.map((glyph) => (
            <Button
              key={glyph}
              type="button"
              size="sm"
              variant={activeGlyph === glyph ? 'default' : 'outline'}
              className={cn(btn, 'px-1.5')}
              disabled={busy}
              title={glyph}
              onClick={() => {
                postToIframe(iframeRef.current, 'setSearchGlyph', { glyph, kind })
                setDirty(true)
              }}
            >
              <span
                className="inline-flex h-4 w-4 items-center justify-center [&>svg]:h-4 [&>svg]:w-4"
                dangerouslySetInnerHTML={{ __html: searchGlyphSvg(glyph as SearchGlyphId, '') }}
              />
            </Button>
          ))}
        </div>
      </div>
    )
  }

  function applySelectedButtonStyle(style: 'hero' | 'primary' | 'outline') {
    postToIframe(iframeRef.current, 'setButtonStyle', { style })
    setDirty(true)
  }

  if (!active) return null

  const isBold = selection?.fontWeight === '700' || selection?.fontWeight === 'bold'
  const busy = disabled || saving || uploadBusy || aiBusy
  const logoActionLabel =
    selection?.logoFace === 'image' ? t.visualEditRecreateLogo : t.visualEditCreateLogo
  const hasRealLogoSrc = Boolean(
    selection?.isLogo && (selection.logoFace === 'image' || Boolean(selection.src))
  )
  const logoTheme = logoThemeHex()
  const logoSwatch = (selected: boolean, color: string, title: string, onClick: () => void) => (
    <button
      type="button"
      disabled={busy}
      title={title}
      aria-label={title}
      className={cn(
        'h-6 w-6 shrink-0 rounded-sm border',
        selected ? 'border-primary ring-1 ring-primary' : 'border-border'
      )}
      style={{ backgroundColor: color }}
      onClick={onClick}
    />
  )
  const logoCreateFields = (
    <div className="grid w-full min-w-0 gap-1">
      <div className="flex flex-wrap gap-0.5" title={t.visualEditLogoAspect}>
        {LOGO_GEMINI_ASPECT_RATIOS.map((aspect) => (
          <button
            key={aspect}
            type="button"
            disabled={busy}
            className={cn(
              'rounded border px-1 py-0.5 text-[10px] font-semibold leading-none',
              logoAspect === aspect ? 'border-primary bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'
            )}
            onClick={() => setLogoAspect(aspect)}
          >
            {aspect}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-x-2 gap-y-1">
        <span className="text-[10px] text-muted-foreground">{t.visualEditLogoBgLabel}</span>
        <div className="flex min-w-0 items-center gap-1">
          {logoSwatch(logoBgChoice === 'theme', logoTheme, t.visualEditLogoBgTheme, () => applyLogoBgChoice('theme'))}
          {logoSwatch(logoBgChoice === 'white', '#ffffff', t.visualEditLogoBgWhite, () => applyLogoBgChoice('white'))}
          <input
            type="text"
            value={logoBgChoice === 'custom' ? logoBgCustom : logoBgChoice === 'white' ? '#ffffff' : logoTheme}
            placeholder={t.visualEditLogoColorHexPlaceholder}
            disabled={busy}
            title={t.visualEditLogoColorHex}
            className="h-6 min-w-0 flex-1 rounded border bg-background px-1.5 font-mono text-[10px]"
            onChange={(e) => applyLogoColorDraft('bg', e.target.value)}
          />
        </div>
        <span className="text-[10px] text-muted-foreground">{t.visualEditLogoInkLabel}</span>
        <div className="flex min-w-0 items-center gap-1">
          {logoSwatch(logoInkChoice === 'white', '#ffffff', t.visualEditLogoInkWhite, () => setLogoInkChoice('white'))}
          {logoSwatch(logoInkChoice === 'theme', logoTheme, t.visualEditLogoInkTheme, () => setLogoInkChoice('theme'))}
          {logoSwatch(
            logoInkChoice === 'custom',
            parseLogoColorText(logoInkCustom) || '#111827',
            t.visualEditLogoInkOther,
            () => setLogoInkChoice('custom')
          )}
        </div>
      </div>
      <input
        type="text"
        value={logoInkText}
        placeholder={t.visualEditLogoInkTextPlaceholder}
        disabled={busy}
        title={t.visualEditLogoInkTextPlaceholder}
        className="h-6 w-full min-w-0 rounded border bg-background px-1.5 text-[10px]"
        onChange={(e) => setLogoInkText(e.target.value)}
      />
      <div className="flex min-w-0 items-center gap-1">
        <input
          type="text"
          value={aiPrompt}
          onChange={(e) => setAiPrompt(e.target.value)}
          placeholder={t.visualEditLogoIdeaLabel}
          disabled={busy}
          className="h-6 min-w-0 flex-1 rounded border bg-background px-1.5 text-[10px]"
        />
        {refUrl ? <img src={refUrl} alt="" className="h-6 w-8 rounded border bg-white object-contain" /> : null}
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-6 w-6 shrink-0 p-0"
          disabled={busy}
          title={t.visualEditUploadReference}
          onClick={() => refFileRef.current?.click()}
        >
          {uploadBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <ImagePlus className="h-3 w-3" />}
        </Button>
        {refUrl ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-6 w-6 shrink-0 p-0"
            disabled={busy}
            title={t.visualEditRemoveReference}
            onClick={() => {
              setRefUrl('')
              setUseCurrentRef(false)
            }}
          >
            <X className="h-3 w-3" />
          </Button>
        ) : null}
      </div>
    </div>
  )
  const editKind = selection?.editKind ?? 'other'
  const showCtaStyle = editKind === 'added-btn' || editKind === 'cta'
  const chromeFaceKind = Boolean(
    selection &&
      (editKind === 'chrome' ||
        editKind === 'cat-toggle' ||
        editKind === 'search-submit' ||
        editKind === 'search-image' ||
        (editKind === 'nav-link' && selection.chromeKind))
  )
  const showHref =
    !chromeFaceKind && (showCtaStyle || editKind === 'nav-link' || editKind === 'added-text')
  const showChromeStyle = chromeFaceKind
  const showSearchHint = editKind === 'search'
  const showWordmarkHint = editKind === 'wordmark'
  const showDotsHint = editKind === 'dots'
  const showFieldHint = editKind === 'field'
  const showBadgeHint = editKind === 'badge'
  const showChatEmbedHint = editKind === 'chat-embed'
  const showAddedBgHint = editKind === 'added-bg'
  const showNavLinkHint = editKind === 'nav-link' && !chromeFaceKind
  const showWidgetColors =
    chromeFaceKind ||
    editKind === 'search' ||
    editKind === 'field' ||
    editKind === 'badge'
  const showWidgetIconColor = chromeFaceKind
  const showWidgetTextColor =
    editKind === 'search' ||
    editKind === 'search-submit' ||
    editKind === 'search-image' ||
    editKind === 'field' ||
    chromeFaceKind
  const showPlaceholderColor = editKind === 'field'
  const showDotColors = editKind === 'dots'
  const chromeLikeKind = chromeFaceKind || editKind === 'search'
  const showInlineChromeTools = false
  const showPinScreen = Boolean(selection?.canPinScreen)
  const showStayScroll = Boolean(selection?.canStayScroll)
  const showHideEl = Boolean(selection?.canHide)
  const showStickHeader = Boolean(
    selection?.canStickHeader &&
      selection.chromeKind !== 'chat' &&
      selection.chromeKind !== 'chat-zalo' &&
      selection.chromeKind !== 'chat-facebook'
  )
  const showBlockTools = Boolean(
    selection?.isBlock && !selection.isAddedBg && !selection.isPaper && !chromeLikeKind && editKind !== 'paper'
  )
  const showLayerSwitch = Boolean(
    selection?.hasImageLayer &&
      !selection.isLogo &&
      !chromeLikeKind &&
      editKind !== 'added-bg' &&
      editKind !== 'nav-link' &&
      editKind !== 'wordmark' &&
      editKind !== 'dots' &&
      editKind !== 'field' &&
      editKind !== 'badge' &&
      editKind !== 'chat-embed'
  )
  const showLayerStack = Boolean(
    selection &&
      editKind !== 'search' &&
      editKind !== 'search-submit' &&
      editKind !== 'search-image' &&
      editKind !== 'logo' &&
      editKind !== 'wordmark' &&
      editKind !== 'cat-toggle' &&
      editKind !== 'chrome' &&
      editKind !== 'nav-link' &&
      editKind !== 'dots' &&
      editKind !== 'field' &&
      editKind !== 'chat-embed' &&
      editKind !== 'paper'
  )
  // Lớp không gian: mọi phần tử chọn được đều phải biết đang ở lớp nào và đổi lớp được.
  const showSceneStack = Boolean(sceneFocus >= 0 || (selection && editKind !== 'chat-embed'))
  const showTextTools = Boolean(
    (selection?.isText ||
      editKind === 'wordmark' ||
      editKind === 'badge') &&
      !chromeFaceKind &&
      editKind !== 'added-bg' &&
      editKind !== 'search' &&
      editKind !== 'search-submit' &&
      editKind !== 'search-image' &&
      editKind !== 'logo' &&
      editKind !== 'image' &&
      editKind !== 'field' &&
      editKind !== 'dots'
  )
  const showImageTools = Boolean(
    selection &&
      (editKind === 'logo' ||
        editKind === 'image' ||
        editKind === 'paper' ||
        selection.isPaper ||
        selection.isFillHost ||
        selection.isAddedBg ||
        ((selection.isImage || selection.isBgImage || selection.isBannerPhoto) &&
          editKind !== 'chrome' &&
          editKind !== 'cat-toggle' &&
          editKind !== 'search' &&
          editKind !== 'search-submit' &&
          editKind !== 'search-image' &&
          editKind !== 'wordmark' &&
          editKind !== 'dots' &&
          editKind !== 'field' &&
          editKind !== 'badge' &&
          editKind !== 'added-bg' &&
          editKind !== 'added-btn' &&
          editKind !== 'cta' &&
          editKind !== 'nav-link'))
  )
  const chromeTitle =
    selection?.chromeKind && isVisualEditorChromeWidgetKind(selection.chromeKind)
      ? chromeWidgetLabel(selection.chromeKind, locale)
      : t.visualEditChromeWidgetTitle
  const renderChromeNumSlider = (
    label: string,
    value: number,
    min: number,
    max: number,
    clamp: (raw: unknown) => number,
    onValue: (size: number) => void
  ) => (
    <label className="flex flex-col gap-1 text-[10px] text-muted-foreground">
      <span className="flex items-center justify-between gap-2">
        <span>{label}</span>
        <span className="inline-flex items-center gap-1">
          <input
            type="number"
            min={min}
            max={max}
            step={1}
            value={value}
            disabled={busy}
            onChange={(e) => {
              if (e.target.value === '') return
              onValue(clamp(e.target.value))
            }}
            className="h-6 w-14 rounded border bg-background px-1 text-right text-[11px] text-foreground"
          />
          <span>px</span>
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        disabled={busy}
        onChange={(e) => onValue(clamp(e.target.value))}
        className="w-full accent-foreground"
      />
    </label>
  )
  const renderChromeSizeSliders = (
    style: string | null | undefined,
    iconSize: number,
    labelSize: number,
    extraClass?: string
  ) => {
    const postSize = (next: { size?: number; icon?: number; label?: number }) => {
      postToIframe(iframeRef.current, 'setChromeSize', next)
      setDirty(true)
    }
    const showIcon = style !== 'text'
    const showText = !isChromeIconOnlyStyle(style)
    return (
      <div className={cn('flex flex-col gap-2', extraClass)}>
        {renderChromeNumSlider(
          t.visualEditChromeAllSize,
          iconSize,
          PW_CHROME_ICON_SIZE_MIN,
          PW_CHROME_ICON_SIZE_MAX,
          clampPwChromeIconSize,
          (size) => postSize({ size })
        )}
        {showIcon
          ? renderChromeNumSlider(
              t.visualEditChromeIconSize,
              iconSize,
              PW_CHROME_ICON_SIZE_MIN,
              PW_CHROME_ICON_SIZE_MAX,
              clampPwChromeIconSize,
              (icon) => postSize({ icon })
            )
          : null}
        {showText
          ? renderChromeNumSlider(
              t.visualEditChromeTextSize,
              labelSize,
              PW_CHROME_LABEL_SIZE_MIN,
              PW_CHROME_LABEL_SIZE_MAX,
              clampPwChromeLabelSize,
              (label) => postSize({ label })
            )
          : null}
      </div>
    )
  }
  const deleteLabel =
    editKind === 'paper' || selection?.isPaper
      ? t.visualEditPaperWhite
      : editKind === 'added-bg' || selection?.canClearBg
      ? t.visualEditDeleteBg
      : editKind === 'chat-embed'
        ? t.visualEditChatEmbedDelete
        : chromeFaceKind || editKind === 'added-btn' || editKind === 'cta'
          ? t.visualEditChromeDelete
          : t.visualEditDeleteUnit
  if (selection?.isBlock || selection?.isAddedBg) {
    pinnedBgSelectionRef.current = selection
  } else if (selection && !bgColorPickerOpen) {
    pinnedBgSelectionRef.current = null
  }
  const colorSel =
    selection?.isBlock || selection?.isAddedBg
      ? selection
      : bgColorPickerOpen
        ? pinnedBgSelectionRef.current
        : null
  const showBgColorPicker = Boolean(
    colorSel &&
      (colorSel.isBlock || colorSel.isAddedBg) &&
      (selection?.isBlock || selection?.isAddedBg || bgColorPickerOpen)
  )

  const btn = compact ? 'h-6 px-1.5 text-[10px]' : 'h-7 px-2 text-xs'
  const slider = compact ? 'h-5 w-16 accent-primary' : 'h-7 w-24 accent-primary'
  const showFillAiStudio = Boolean(
    selection && (selection.isPaper || selection.isFillHost || selection.isAddedBg || editKind === 'paper')
  )
  const aiPromptPlaceholder =
    selection?.isPaper || selection?.isFillHost || selection?.isAddedBg || editKind === 'paper'
      ? t.visualEditPaperAiPlaceholder
      : selection?.isBannerPhoto
        ? t.visualEditAiBannerPlaceholder
        : t.visualEditAiImagePlaceholder
  const renderAiImageStudio = (promptId: string) => {
    const currentSrc = selection?.src?.trim() || ''
    const canUseCurrent = shouldUseCurrentImageAsRef({
      src: currentSrc,
      isLogo: selection?.isLogo,
      logoFace: selection?.logoFace,
      isImage: selection?.isImage,
      isBgImage: selection?.isBgImage,
      isBannerPhoto: selection?.isBannerPhoto,
      isPaper: selection?.isPaper,
      isFillHost: selection?.isFillHost,
      isAddedBg: selection?.isAddedBg,
    })
    return (
      <div className="space-y-1.5">
        <label className="flex min-w-0 flex-col gap-0.5" htmlFor={promptId}>
          <span className="text-[10px] text-muted-foreground">{t.visualEditAiPromptLabel}</span>
          <textarea
            id={promptId}
            ref={promptTextareaRef}
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            placeholder={aiPromptPlaceholder}
            rows={compact ? 2 : 3}
            disabled={busy}
            className={cn(
              'w-full rounded-md border bg-background px-2 py-1 resize-y',
              compact ? 'text-[10px]' : 'text-xs'
            )}
          />
        </label>
        <div className="space-y-1">
          <p className="text-[10px] font-semibold leading-4">{t.visualEditAiColorTitle}</p>
          <p className="text-[10px] leading-4 text-muted-foreground">{t.visualEditAiColorHint}</p>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 text-[10px]">
              <span className="text-muted-foreground">{t.visualEditAiColorMain}</span>
              <ThemeColorConfirmPicker
                value={cssColorToHex(aiImageColor, '#c2410c')}
                disabled={busy}
                compact={compact}
                okLabel={t.themeColorOk}
                themePicks={themePicks}
                onConfirm={setAiImageColor}
              />
            </div>
            <div className="flex items-center gap-1 text-[10px]">
              <span className="text-muted-foreground">{t.visualEditAiColorAccent}</span>
              <ThemeColorConfirmPicker
                value={cssColorToHex(aiImageAccent, '#fb923c')}
                disabled={busy}
                compact={compact}
                okLabel={t.themeColorOk}
                themePicks={themePicks}
                onConfirm={setAiImageAccent}
              />
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {refUrl || canUseCurrent ? (
            <img
              src={refUrl || currentSrc}
              alt=""
              className={cn('rounded border object-cover', compact ? 'h-7 w-10' : 'h-10 w-16')}
            />
          ) : null}
          <label className="flex items-center gap-1 text-[10px]">
            <input
              type="checkbox"
              checked={useCurrentRef && !refUrl && canUseCurrent}
              disabled={busy || !canUseCurrent}
              onChange={(e) => {
                setUseCurrentRef(e.target.checked)
                if (e.target.checked) setRefUrl('')
              }}
            />
            {t.visualEditUseCurrentAsRef}
          </label>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={btn}
            disabled={busy}
            onClick={() => refFileRef.current?.click()}
          >
            {uploadBusy ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <ImagePlus className="mr-1 h-3 w-3" />}
            {t.visualEditUploadReference}
          </Button>
          {refUrl ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-6 w-6 shrink-0 p-0"
              disabled={busy}
              title={t.visualEditRemoveReference}
              onClick={() => {
                setRefUrl('')
                setUseCurrentRef(false)
              }}
            >
              <X className="h-3 w-3" />
            </Button>
          ) : null}
        </div>
        <Button
          type="button"
          size="sm"
          className={cn(btn, 'w-full')}
          disabled={busy}
          onClick={() => void handleGenerateAi()}
        >
          {aiBusy ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Sparkles className="mr-1 h-3 w-3" />}
          {t.visualEditCreateWithAi}
        </Button>
      </div>
    )
  }
  const hrefField =
    showHref && selection && !showCtaStyle && !addButtonPanelOpen ? (
      <label className="flex min-w-0 w-full flex-col gap-0.5 text-[10px]">
        <span className="shrink-0 text-muted-foreground">
          {editKind === 'added-text' || editKind === 'nav-link' ? t.visualEditTextHref : t.visualEditButtonHref}
        </span>
        <input
          type="text"
          value={hrefDraft}
          placeholder={t.visualEditButtonHrefPlaceholder}
          className={cn(
            'min-w-0 w-full rounded-md border bg-background px-2',
            compact ? 'h-6 text-[10px]' : 'h-8 text-xs'
          )}
          disabled={busy}
          onChange={(e) => setHrefDraft(e.target.value)}
          onBlur={(e) => commitHref(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              commitHref(hrefDraft)
            }
          }}
        />
      </label>
    ) : null

  const destIsLogoHome = Boolean(selection?.isLogo || editKind === 'logo')
  const destTarget = visualEditTargetFromSelection({
    href: selection?.href || hrefDraft,
    chromeKind: selection?.chromeKind,
    siteSlug,
    isLogo: destIsLogoHome,
  })
  const destSelectValue = destTarget ? visualEditSelectValueFromTarget(destTarget) : ''
  const openDestLabel = destIsLogoHome ? t.visualEditOpenHomePage : t.visualEditOpenPage
  const openDestButton =
    onOpenDestination && destSelectValue && destSelectValue !== pageSelectValue ? (
      <Button
        type="button"
        size="sm"
        variant="secondary"
        className={cn(btn, destIsLogoHome ? 'w-full justify-center gap-1' : 'gap-1')}
        disabled={busy}
        title={openDestLabel}
        onClick={() => onOpenDestination(destSelectValue)}
      >
        <ExternalLink className="h-3.5 w-3.5" />
        {openDestLabel}
      </Button>
    ) : null

  function togglePanel(id: VisualEditOpenPanel) {
    setOpenPanel((cur) => {
      if (id === 'block') return 'block'
      return cur === id ? 'block' : id
    })
    setPanelPos((pos) => pos ?? defaultFloatingPanelPos())
  }

  const blockPanelTitle =
    selection?.isSlider
      ? t.visualEditAddSlider || bannerWidgetLabel('slider', locale)
      : chromeFaceKind
      ? chromeTitle
      : editKind === 'added-bg'
        ? t.visualEditAddBg
        : editKind === 'search'
          ? t.visualEditSearchTitle
          : editKind === 'wordmark'
            ? t.visualEditWordmarkTitle
            : editKind === 'dots'
              ? t.visualEditDotsTitle
              : editKind === 'field'
                ? t.visualEditFieldTitle
                : editKind === 'badge'
                  ? t.visualEditBadgeTitle
                  : editKind === 'chat-embed'
                    ? t.visualEditChatEmbedTitle
                    : editKind === 'added-btn' || editKind === 'cta'
                      ? t.visualEditPageButtonTitle
                      : editKind === 'nav-link'
                        ? t.visualEditNavLinkTitle
                        : editKind === 'logo'
                          ? t.visualEditLogoPanelTitle
                          : editKind === 'image'
                            ? t.visualEditImagePanelTitle
                            : editKind === 'paper'
                              ? t.visualEditPaperTitle
                            : t.visualEditMenuBlock
  const panelTitle =
    openPanel === 'add'
      ? t.visualEditAddWidget
      : openPanel === 'chromeKit'
        ? t.visualEditChromeKit
        : openPanel === 'theme'
          ? t.visualEditMenuTheme
          : blockPanelTitle

  return (
    <>
      <input
        ref={refFileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          void handleUploadReference(e.target.files)
          e.target.value = ''
        }}
      />
      <input
        ref={logoFileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          void handleUploadAsLogo(e.target.files)
          e.target.value = ''
        }}
      />
      <input
        ref={articleImageFileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          void handleUploadArticleImage(e.target.files)
          e.target.value = ''
        }}
      />
      <input
        ref={freeImageFileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          void handleUploadFreeImage(e.target.files)
          e.target.value = ''
        }}
      />
      <input
        ref={chatIconFileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          void handleUploadChatIconLogo(e.target.files)
          e.target.value = ''
        }}
      />
      <div className={cn('flex min-w-0 flex-col', sidebar && 'h-full')}>
        <div className={cn('flex min-w-0 flex-nowrap items-center overflow-x-auto', compact ? 'gap-1' : 'gap-2')}>
          <Button
            type="button"
            size="sm"
            variant={openPanel === 'add' ? 'default' : 'outline'}
            className={cn(btn, 'gap-1')}
            disabled={busy}
            title={t.visualEditAddWidget}
            aria-expanded={openPanel === 'add'}
            onClick={() => {
              if (openPanel !== 'add') {
                setInsertAnchorActive(false)
                setInsertAnchorPlace(null)
                postToIframe(iframeRef.current, 'clearInsertAnchor')
              }
              setOpenPanel((cur) => (cur === 'add' ? 'block' : 'add'))
              setPanelPos((pos) => pos || defaultFloatingPanelPos())
            }}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            {t.visualEditAddWidget}
          </Button>
          <Button
            type="button"
            size="sm"
            variant={openPanel === 'chromeKit' ? 'default' : 'outline'}
            className={cn(btn, 'gap-1')}
            disabled={busy}
            title={t.visualEditChromeKit}
            aria-expanded={openPanel === 'chromeKit'}
            onClick={() => {
              setOpenPanel((cur) => (cur === 'chromeKit' ? 'block' : 'chromeKit'))
              setPanelPos((pos) => pos || defaultFloatingPanelPos())
              postToIframe(iframeRef.current, 'listChromeKit', {})
            }}
          >
            <LayoutTemplate className="h-3.5 w-3.5" aria-hidden />
            {t.visualEditChromeKit}
          </Button>
          {theme && onThemeLiveChange ? (
            <Button
              type="button"
              size="sm"
              variant={openPanel === 'theme' ? 'default' : 'outline'}
              className={cn(btn, 'gap-1')}
              disabled={busy}
              title={t.themeColorTitle}
              aria-expanded={openPanel === 'theme'}
              onClick={() => togglePanel('theme')}
            >
              <Palette className="h-3.5 w-3.5" aria-hidden />
              {t.visualEditMenuTheme}
            </Button>
          ) : null}
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className={cn(btn, 'gap-1')}
              disabled={busy || !canUndo}
              title={`${t.visualEditUndo} (Ctrl+Z)`}
              onClick={() => postToIframe(iframeRef.current, 'undo')}
            >
              <Undo2 className="h-3.5 w-3.5" aria-hidden />
              {compact ? null : t.visualEditUndo}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className={cn(btn, 'gap-1')}
              disabled={busy || !canRedo}
              title={`${t.visualEditRedo} (Ctrl+Y)`}
              onClick={() => postToIframe(iframeRef.current, 'redo')}
            >
              <Redo2 className="h-3.5 w-3.5" aria-hidden />
              {compact ? null : t.visualEditRedo}
            </Button>
            <span className="px-1 text-[10px] text-muted-foreground">
              {dirty || canUndo ? t.visualEditUnsavedStatus : t.visualEditSavedStatus}
            </span>
            {liveViewHref ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className={cn(btn, 'gap-1')}
                disabled={busy || saving || dirty || canUndo}
                title={dirty || canUndo ? t.visualEditViewNeedsSave : t.visualEditViewSite}
                onClick={() => openLiveView()}
              >
                <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                {t.visualEditViewSite}
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className={btn}
              disabled={saving}
              onClick={() => (onRequestLeave ? onRequestLeave('exit') : onCancel())}
            >
              <X className="mr-1 h-3 w-3" />
              {t.visualEditCancel}
            </Button>
            <Button
              type="button"
              size="sm"
              className={btn}
              disabled={busy || !(dirty || canUndo)}
              title={`${t.visualEditSave} (Ctrl+S)`}
              onClick={requestSave}
            >
              {saving ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
              {t.visualEditSave}
            </Button>
          </div>
        </div>
        {showInlineChromeTools && chromeLikeKind && selection ? (
          <div className="flex flex-wrap items-center gap-1.5 border-t px-2 py-1.5">
            {showChromeStyle ? (
              <div className="flex flex-wrap items-center gap-1">
                {chromeStyleChoices().map(([style, label]) => (
                  <Button
                    key={style}
                    type="button"
                    size="sm"
                    variant={selection.chromeStyle === style ? 'default' : 'outline'}
                    className={btn}
                    disabled={busy}
                    onClick={() => applySelectedChromeStyle(style)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            ) : null}
            {editKind === 'search' ? (
              <label className="flex min-w-[10rem] flex-1 items-center gap-1 text-[10px]">
                <span className="shrink-0 text-muted-foreground">{t.visualEditSearchTitle}</span>
                <input
                  type="text"
                  value={textDraft}
                  placeholder={t.visualEditTextContent}
                  className={cn('min-w-0 flex-1 rounded-md border bg-background px-2', compact ? 'h-6 text-[10px]' : 'h-8 text-xs')}
                  disabled={busy}
                  onFocus={() => {
                    textDraftFocusedRef.current = true
                  }}
                  onBlur={() => {
                    textDraftFocusedRef.current = false
                  }}
                  onChange={(e) => {
                    const text = e.currentTarget.value
                    setTextDraft(text)
                    postToIframe(iframeRef.current, 'setSearchPlaceholder', { text })
                    setDirty(true)
                  }}
                />
              </label>
            ) : null}
            {(showChromeStyle && !isChromeIconOnlyStyle(selection.chromeStyle)) || editKind === 'search-submit' ? (
              <label className="flex min-w-[8rem] flex-1 items-center gap-1 text-[10px]">
                <span className="shrink-0 text-muted-foreground">{t.visualEditTextContent}</span>
                <input
                  type="text"
                  value={textDraft}
                  placeholder={t.visualEditTextContent}
                  className={cn('min-w-0 flex-1 rounded-md border bg-background px-2', compact ? 'h-6 text-[10px]' : 'h-8 text-xs')}
                  disabled={busy}
                  onFocus={() => {
                    textDraftFocusedRef.current = true
                  }}
                  onBlur={() => {
                    textDraftFocusedRef.current = false
                  }}
                  onChange={(e) => {
                    const text = e.currentTarget.value
                    setTextDraft(text)
                    postToIframe(iframeRef.current, 'setButtonLabel', { text })
                    setDirty(true)
                  }}
                />
              </label>
            ) : null}
          </div>
        ) : null}
        {typeof document !== 'undefined' && openPanel && panelPos
          ? createPortal(
              <VisualEditFloatingPanel
                title={panelTitle}
                dragHint={t.visualEditPanelDragHint}
                closeLabel={openPanel === 'block' ? undefined : t.visualEditPanelClose}
                pos={panelPos}
                onPosChange={setPanelPos}
                onClose={
                  openPanel === 'block'
                    ? undefined
                    : () => {
                        if (openPanel === 'add') {
                          postToIframe(iframeRef.current, 'clearInsertAnchor')
                          setInsertAnchorActive(false)
                          setInsertAnchorPlace(null)
                        }
                        openBlockPanel()
                      }
                }
              >
                {openPanel === 'add' ? (
                  <div className="flex flex-col gap-1">
                    {insertAnchorActive ? (
                      <p className="px-2 py-1 text-[10px] leading-4 text-muted-foreground">
                        {t.visualEditInsertAtGapHint}
                      </p>
                    ) : null}
                    {isTextArticlePage ? (
                      <p className="px-2 py-1 text-[10px] leading-4 text-muted-foreground">
                        {t.visualEditArticleEditHint}
                      </p>
                    ) : null}
                    <button
                      type="button"
                      className="flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-left text-[11px] font-medium hover:bg-muted"
                      disabled={busy}
                      onClick={insertTextBlock}
                    >
                      <Type className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      {t.visualEditAddText}
                    </button>
                    <button
                      type="button"
                      className="flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-left text-[11px] font-medium hover:bg-muted"
                      disabled={busy || uploadBusy}
                      onClick={() => freeImageFileRef.current?.click()}
                    >
                      {uploadBusy ? (
                        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
                      ) : (
                        <ImagePlus className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      )}
                      {t.visualEditAddImage}
                    </button>
                    <div className="flex flex-col gap-1 px-2 py-1">
                      <label className="flex items-center gap-1.5 text-[11px] font-medium">
                        <Video className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        {t.visualEditAddVideo}
                      </label>
                      <input
                        type="url"
                        value={addVideoUrl}
                        onChange={(e) => setAddVideoUrl(e.target.value)}
                        placeholder={t.visualEditAddVideoUrl}
                        className="h-7 rounded border border-border bg-background px-2 text-[11px]"
                      />
                      <button
                        type="button"
                        className="flex w-full items-center justify-center rounded px-2 py-1 text-[11px] font-medium hover:bg-muted"
                        disabled={busy || !addVideoUrl.trim()}
                        onClick={() => {
                          const url = addVideoUrl.trim()
                          if (!url) return
                          postToIframe(iframeRef.current, 'insertVideo', { url, useAnchor: insertAnchorActive })
                          setAddVideoUrl('')
                          setDirty(true)
                          openBlockPanel()
                        }}
                      >
                        {t.visualEditAddVideo}
                      </button>
                    </div>
                    {isTextArticlePage ? (
                      <button
                        type="button"
                        className="flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-left text-[11px] font-medium hover:bg-muted"
                        disabled={busy || uploadBusy}
                        onClick={() => articleImageFileRef.current?.click()}
                      >
                        {uploadBusy ? (
                          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
                        ) : (
                          <ImagePlus className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        )}
                        {t.visualEditAddArticleImage}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-left text-[11px] font-medium hover:bg-muted"
                      disabled={busy}
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        insertButtonBlock()
                      }}
                    >
                      <MousePointerClick className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      {t.visualEditAddButton}
                    </button>
                    <button
                      type="button"
                      className="flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-left text-[11px] font-medium hover:bg-muted"
                      disabled={busy}
                      onClick={() => insertBannerWidget()}
                    >
                      <Images className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      {insertAnchorPlace === 'left' || insertAnchorPlace === 'right'
                        ? t.visualEditAddBannerRegular || t.visualEditAddBanner
                        : t.visualEditAddBanner || bannerWidgetLabel('hero', locale)}
                    </button>
                    <div className="flex flex-col">
                      <button
                        type="button"
                        className="flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-left text-[11px] font-medium hover:bg-muted"
                        disabled={busy}
                        onClick={() => insertSliderWidget()}
                      >
                        <ChevronsLeftRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        {insertAnchorPlace === 'left' || insertAnchorPlace === 'right'
                          ? t.visualEditAddSliderPush || t.visualEditAddSlider
                          : t.visualEditAddSlider || bannerWidgetLabel('slider', locale)}
                      </button>
                      {insertAnchorPlace === 'left' || insertAnchorPlace === 'right' ? (
                        <p className="px-2 pb-1 pl-7 text-[10px] leading-4 text-muted-foreground">
                          {t.visualEditAddSliderPushHint}
                        </p>
                      ) : null}
                    </div>
                    {VISUAL_EDITOR_PRODUCT_GRID_KINDS.filter((kind) =>
                      productGridKindAllowedOnVisualPage(kind, pageKey)
                    ).map((kind) => {
                      const Icon =
                        kind === 'recently-viewed'
                          ? Clock
                          : kind === 'recommended'
                            ? Sparkles
                            : kind === 'related'
                              ? Images
                              : kind === 'outfit'
                                ? Shirt
                                : LayoutGrid
                      const labelKey =
                        kind === 'catalog'
                          ? 'visualEditAddProductGrid'
                          : kind === 'recently-viewed'
                            ? 'visualEditAddRecentlyViewedGrid'
                            : kind === 'related'
                              ? 'visualEditAddRelatedGrid'
                              : kind === 'outfit'
                                ? 'visualEditAddOutfitGrid'
                                : 'visualEditAddRecommendedGrid'
                      return (
                        <button
                          key={kind}
                          type="button"
                          className="flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-left text-[11px] font-medium hover:bg-muted"
                          disabled={busy}
                          onClick={() => insertProductGridWidget(kind)}
                        >
                          <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          {t[labelKey] || productGridWidgetLabel(kind, locale)}
                        </button>
                      )
                    })}
                    <div className="flex flex-col gap-1 rounded px-2 py-1.5">
                      <button
                        type="button"
                        className="flex w-full items-center gap-1.5 text-left text-[11px] font-medium hover:bg-muted"
                        disabled={busy}
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          if (insertBgPickPlace) cancelInsertBgPickUi()
                          if (insertAnchorActive) {
                            insertBgBlock('anchor')
                            return
                          }
                          setAddBgAskOpen((open) => !open)
                        }}
                      >
                        <Square className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        {t.visualEditAddBg}
                      </button>
                      <div className="flex items-center gap-1.5 pl-5">
                        <span className="shrink-0 text-[10px] text-muted-foreground">{t.visualEditAddBgColor}</span>
                        <ThemeColorConfirmPicker
                          value={cssColorToHex(addBgColor, '#f3f4f6')}
                          disabled={busy}
                          compact={false}
                          okLabel={t.themeColorOk}
                          themePicks={themePicks}
                          onConfirm={(color) => {
                            setAddBgColor(color)
                            if (insertBgPickPlace) {
                              postToIframe(iframeRef.current, 'setInsertBgPickColor', {
                                color: color || '#f3f4f6',
                              })
                            }
                          }}
                        />
                        <span className="font-mono text-[10px] uppercase text-muted-foreground">
                          {cssColorToHex(addBgColor, '#f3f4f6')}
                        </span>
                      </div>
                    </div>
                    {insertAnchorActive ? null : insertBgPickPlace ? (
                      <div className="flex flex-col gap-1 px-2 pb-1">
                        <p className="text-[10px] leading-4 text-muted-foreground">{t.visualEditInsertBgNeedSelect}</p>
                        <button
                          type="button"
                          className="flex w-full items-center justify-center gap-1 rounded px-1.5 py-1.5 text-[10px] font-medium hover:bg-muted"
                          disabled={busy}
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            cancelInsertBgPickUi()
                            setAddBgAskOpen(true)
                          }}
                        >
                          {t.visualEditInsertBgCancel}
                        </button>
                      </div>
                    ) : addBgAskOpen ? (
                      <div className="flex flex-col gap-0.5 px-2 pb-1">
                        <button
                          type="button"
                          className="flex w-full items-center gap-1.5 rounded px-1.5 py-1.5 text-left text-[11px] font-medium hover:bg-muted"
                          disabled={busy}
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            startInsertBgPick('before')
                          }}
                        >
                          <ArrowUp className="h-3 w-3 shrink-0" aria-hidden />
                          {t.visualEditInsertBgAbove}
                        </button>
                        <button
                          type="button"
                          className="flex w-full items-center gap-1.5 rounded px-1.5 py-1.5 text-left text-[11px] font-medium hover:bg-muted"
                          disabled={busy}
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            startInsertBgPick('after')
                          }}
                        >
                          <ArrowDown className="h-3 w-3 shrink-0" aria-hidden />
                          {t.visualEditInsertBgBelow}
                        </button>
                        <button
                          type="button"
                          className="flex w-full items-center gap-1.5 rounded px-1.5 py-1.5 text-left text-[11px] font-medium hover:bg-muted"
                          disabled={busy}
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            insertBgBlock('overlay')
                          }}
                        >
                          <Square className="h-3 w-3 shrink-0" aria-hidden />
                          {t.visualEditAddBgNoInsert}
                        </button>
                      </div>
                    ) : null}
                    <div className="max-h-48 overflow-y-auto">
                      {VISUAL_EDITOR_CHROME_WIDGET_PICKER_KINDS.filter((kind) => !isChromeKitPickerKind(kind)).map((kind) => {
                        const Icon = isLucideIconComponent(CHROME_WIDGET_ICONS[kind])
                          ? CHROME_WIDGET_ICONS[kind]
                          : Plus
                        return (
                          <button
                            key={kind}
                            type="button"
                            className="flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-left text-[11px] hover:bg-muted"
                            disabled={busy}
                            onClick={() => insertChromeWidget(kind)}
                          >
                            {isChromeContactChatKind(kind) ? (
                              <span
                                className="inline-flex h-3.5 w-3.5 shrink-0 [&>svg]:h-full [&>svg]:w-full"
                                aria-hidden
                                dangerouslySetInnerHTML={{
                                  __html:
                                    kind === 'chat-zalo'
                                      ? CHROME_ZALO_LOGO_SVG
                                      : kind === 'chat-instagram'
                                        ? CHROME_INSTAGRAM_LOGO_SVG
                                        : kind === 'chat-whatsapp'
                                          ? CHROME_WHATSAPP_LOGO_SVG
                                          : CHROME_FACEBOOK_CHAT_LOGO_SVG,
                                }}
                              />
                            ) : (
                              <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                            )}
                            {chromeWidgetLabel(kind, locale)}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ) : null}
                {openPanel === 'chromeKit' ? (
                  <ChromeKitPanel
                    t={t}
                    locale={locale}
                    device={visualDeviceVariantFromHtmlPath(htmlPath)}
                    head={chromeKitHead}
                    dock={chromeKitDock}
                    headX={chromeKitHeadX}
                    busy={busy}
                    onToggleHead={(kind, hidden) => {
                      postToIframe(iframeRef.current, 'setChromeKitHidden', { kind, bar: 'head', hidden })
                      setDirty(true)
                    }}
                    onToggleDock={(kind, show) => {
                      postToIframe(iframeRef.current, 'setChromeKitDockShow', { kind, show })
                      setDirty(true)
                    }}
                    onReorder={(kind, bar, dir) => {
                      postToIframe(iframeRef.current, 'reorderChromeKit', { kind, bar, dir })
                      setDirty(true)
                    }}
                    onShiftHead={(x) => {
                      setChromeKitHeadX(x)
                      postToIframe(iframeRef.current, 'setChromeKitShift', { bar: 'head', x })
                      setDirty(true)
                    }}
                  />
                ) : null}
                {openPanel === 'theme' && theme && onThemeLiveChange ? (
                  <PartnerWebsiteThemeColorPicker
                    t={t}
                    theme={theme}
                    compact
                    layout="stack"
                    disabled={busy}
                    saving={themeSaving}
                    onLiveChange={onThemeLiveChange}
                  />
                ) : null}
                {openPanel === 'block' ? (
                  <div className="flex flex-col gap-2">
                    {destIsLogoHome ? openDestButton : null}
                    {selection && !selection.isLogo ? (
                      <p className="text-[10px] leading-tight text-muted-foreground">{t.visualEditNudgeHint}</p>
                    ) : null}
                    {selection ? (
                      <div className="space-y-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className={cn(btn, 'w-full justify-start')}
                          disabled={busy}
                          title={t.visualEditCopyAllPagesHint}
                          onClick={() => postToIframe(iframeRef.current, 'copyToAllPages')}
                        >
                          <Copy className="h-3 w-3" />
                          <span className="ml-1">{t.visualEditCopyAllPages}</span>
                        </Button>
                        <p className="text-[10px] leading-4 text-muted-foreground">{t.visualEditCopyAllPagesHint}</p>
                      </div>
                    ) : null}
        {showAddedBgHint && selection ? (
          <div className="rounded-md border bg-background px-2 py-1.5">
            <p className="text-[11px] font-semibold leading-4">{t.visualEditBgStackAdded}</p>
            <p className="text-[10px] leading-4 text-muted-foreground">{t.visualEditAddedBgHint}</p>
          </div>
        ) : null}
        {showBgColorPicker && selection && selection.canClearBg && !selection.isPaper && !selection.isFillHost && editKind !== 'paper' ? (
          <p className="text-[10px] leading-4 text-muted-foreground">{t.visualEditRegionBgHint}</p>
        ) : null}
        {selection && (selection.isPaper || selection.isFillHost || selection.isAddedBg || editKind === 'paper') ? (
          <div className="space-y-1.5 rounded-md border bg-background px-2 py-1.5">
            <p className="text-[11px] font-semibold leading-4">
              {selection.isPaper || editKind === 'paper' ? t.visualEditPaperTitle : t.visualEditBgFillTitle}
            </p>
            <p className="text-[10px] leading-4 text-muted-foreground">{t.visualEditBgFillHint}</p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className={cn(btn, 'w-full')}
              disabled={busy}
              onClick={() => fileRef.current?.click()}
            >
              {uploadBusy ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <ImagePlus className="mr-1 h-3 w-3" />}
              {t.visualEditPaperPickImage}
            </Button>
            {renderAiImageStudio('nanoai-ve-fill-ai-prompt')}
            {selection.isPaper || editKind === 'paper' ? (
              <Button
                type="button"
                size="sm"
                variant={selection.paperMode === 'white' && selection.fillMode !== 'transparent' ? 'default' : 'outline'}
                className={cn(btn, 'w-full')}
                disabled={busy || (selection.paperMode === 'white' && selection.fillMode !== 'transparent' && selection.fillMode !== 'image')}
                onClick={() => {
                  postToIframe(iframeRef.current, 'setPaperWhite')
                  setDirty(true)
                }}
              >
                {t.visualEditPaperWhite}
              </Button>
            ) : null}
            {selection.fillMode === 'image' ? (
              <div className="space-y-1.5 border-t pt-1.5">
                <p className="text-[11px] font-semibold leading-4">{t.visualEditBgImagePos}</p>
                <p className="text-[10px] leading-4 text-muted-foreground">{t.visualEditBgImagePosHint}</p>
                <div className="flex items-start gap-2">
                  <div className="grid grid-cols-3 gap-0.5" role="group" aria-label={t.visualEditBgImagePos}>
                    {(
                      [
                        [0, 0],
                        [50, 0],
                        [100, 0],
                        [0, 50],
                        [50, 50],
                        [100, 50],
                        [0, 100],
                        [50, 100],
                        [100, 100],
                      ] as const
                    ).map(([x, y]) => {
                      const on = selection.paperPanX === x && selection.paperPanY === y
                      return (
                        <button
                          key={`${x}-${y}`}
                          type="button"
                          disabled={busy}
                          title={`${x}% / ${y}%`}
                          className={cn(
                            'h-4 w-4 rounded-sm border',
                            on ? 'border-primary bg-primary' : 'border-muted-foreground/40 bg-background hover:bg-muted'
                          )}
                          onClick={() => {
                            postToIframe(iframeRef.current, 'setPaperPan', { x, y })
                            setDirty(true)
                          }}
                        />
                      )
                    })}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      <span className="w-16 shrink-0">{t.visualEditBgImagePosX}</span>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={selection.paperPanX}
                        className={cn(slider, 'min-w-0 flex-1')}
                        disabled={busy}
                        onChange={(e) => {
                          postToIframe(iframeRef.current, 'setPaperPan', {
                            x: Number(e.target.value),
                            y: selection.paperPanY,
                          })
                          setDirty(true)
                        }}
                      />
                      <span className="w-8 shrink-0 tabular-nums">{selection.paperPanX}%</span>
                    </label>
                    <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      <span className="w-16 shrink-0">{t.visualEditBgImagePosY}</span>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={selection.paperPanY}
                        className={cn(slider, 'min-w-0 flex-1')}
                        disabled={busy}
                        onChange={(e) => {
                          postToIframe(iframeRef.current, 'setPaperPan', {
                            x: selection.paperPanX,
                            y: Number(e.target.value),
                          })
                          setDirty(true)
                        }}
                      />
                      <span className="w-8 shrink-0 tabular-nums">{selection.paperPanY}%</span>
                    </label>
                    <button
                      type="button"
                      className="text-[10px] text-muted-foreground underline-offset-2 hover:underline"
                      disabled={busy}
                      onClick={() => {
                        postToIframe(iframeRef.current, 'setPaperPan', { x: 50, y: 50 })
                        setDirty(true)
                      }}
                    >
                      {t.visualEditResetImagePos}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
        {showBgColorPicker && selection && !selection.isAddedBg && !selection.canDelete && !selection.canClearBg ? (
          <p className="text-[10px] leading-4 text-muted-foreground">{t.visualEditBgLockedHint}</p>
        ) : null}
        {showSearchHint && selection ? (
          <div className="rounded-md border bg-background px-2 py-1.5 space-y-1.5">
            <p className="text-[11px] font-semibold leading-4">{t.visualEditSearchTitle}</p>
            <p className="text-[10px] leading-4 text-muted-foreground">{t.visualEditSearchHint}</p>
            {renderSearchGlyphPicker('camera', selection.cameraGlyph || selection.searchGlyph, t.visualEditSearchCameraGlyph)}
            {renderSearchGlyphPicker('lens', selection.lensGlyph || selection.searchGlyph, t.visualEditSearchLensGlyph)}
          </div>
        ) : null}
        {showWordmarkHint && selection ? (
          <div className="rounded-md border bg-background px-2 py-1.5">
            <p className="text-[11px] font-semibold leading-4">{t.visualEditWordmarkTitle}</p>
            <p className="text-[10px] leading-4 text-muted-foreground">{t.visualEditWordmarkHint}</p>
          </div>
        ) : null}
        {showDotsHint && selection ? (
          <div className="rounded-md border bg-background px-2 py-1.5">
            <p className="text-[11px] font-semibold leading-4">{t.visualEditDotsTitle}</p>
            <p className="text-[10px] leading-4 text-muted-foreground">{t.visualEditDotsHint}</p>
          </div>
        ) : null}
        {showFieldHint && selection ? (
          <div className="rounded-md border bg-background px-2 py-1.5">
            <p className="text-[11px] font-semibold leading-4">{t.visualEditFieldTitle}</p>
            <p className="text-[10px] leading-4 text-muted-foreground">{t.visualEditFieldHint}</p>
          </div>
        ) : null}
        {showBadgeHint && selection ? (
          <div className="rounded-md border bg-background px-2 py-1.5">
            <p className="text-[11px] font-semibold leading-4">{t.visualEditBadgeTitle}</p>
            <p className="text-[10px] leading-4 text-muted-foreground">{t.visualEditBadgeHint}</p>
          </div>
        ) : null}
        {showChatEmbedHint && selection ? (
          <div className="rounded-md border bg-background px-2 py-1.5 space-y-2">
            <p className="text-[11px] font-semibold leading-4">{t.visualEditChatEmbedTitle}</p>
            <p className="text-[10px] leading-4 text-muted-foreground">{t.visualEditChatEmbedHint}</p>
            {partnerId ? (
              <Button type="button" size="sm" variant="outline" className="h-7 text-[11px]" asChild>
                <Link
                  href={`/dashboard/messaging/settings?partner=${encodeURIComponent(partnerId)}&section=api`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t.visualEditChatEmbedOpenSettings}
                  <ExternalLink className="ml-1 h-3 w-3" aria-hidden />
                </Link>
              </Button>
            ) : null}
          </div>
        ) : null}
        {theme?.hideChatLauncher && !selection ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className={btn}
            disabled={busy}
            onClick={() => {
              void (async () => {
                const ok = await persistChatLauncherHidden(false)
                if (ok) postToIframe(iframeRef.current, 'restoreChatLauncher')
              })()
            }}
          >
            <Eye className="mr-1 h-3 w-3" />
            {t.visualEditChatEmbedRestore}
          </Button>
        ) : null}
        {showNavLinkHint && selection ? (
          <div className="rounded-md border bg-background px-2 py-1.5">
            <p className="text-[11px] font-semibold leading-4">{t.visualEditNavLinkTitle}</p>
            <p className="text-[10px] leading-4 text-muted-foreground">{t.visualEditNavLinkHint}</p>
          </div>
        ) : null}
          {showLayerSwitch && selection ? (
            <div className="flex overflow-hidden rounded-md border border-primary/40 bg-white">
              <Button
                type="button"
                size="sm"
                variant={
                  selection.isLogo
                    ? selection.logoLayer === 'block'
                      ? 'default'
                      : 'ghost'
                    : selection.isBlock || selection.isMoveBlock
                      ? 'default'
                      : 'ghost'
                }
                className={cn(btn, 'rounded-none')}
                disabled={busy}
                onClick={() => postToIframe(iframeRef.current, 'setLayerMode', { mode: 'block' })}
              >
                {t.visualEditLayerBlock}
              </Button>
              <Button
                type="button"
                size="sm"
                variant={
                  selection.isLogo
                    ? selection.logoLayer === 'image'
                      ? 'default'
                      : 'ghost'
                    : selection.isImage || selection.isBgImage
                      ? 'default'
                      : 'ghost'
                }
                className={cn(btn, 'rounded-none')}
                disabled={busy}
                onClick={() => postToIframe(iframeRef.current, 'setLayerMode', { mode: 'image' })}
              >
                {t.visualEditLayerImage}
              </Button>
            </div>
          ) : null}
          {selection?.isSlider ? (
            <div className="flex w-full min-w-[12rem] flex-col gap-2 rounded-md border bg-background px-2 py-1.5">
              <div className="flex items-center justify-between gap-1">
                <button
                  type="button"
                  className="inline-flex h-7 w-7 items-center justify-center rounded border hover:bg-muted"
                  disabled={busy}
                  title={t.visualEditSliderPrev}
                  onClick={() => {
                    postToIframe(iframeRef.current, 'goSlide', {
                      index: selection.slideIndex - 1,
                    })
                    setDirty(true)
                  }}
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden />
                </button>
                <span className="text-[11px] font-semibold tabular-nums">
                  {t.visualEditSliderSlide} {selection.slideIndex + 1} / {Math.max(1, selection.slideCount)}
                </span>
                <button
                  type="button"
                  className="inline-flex h-7 w-7 items-center justify-center rounded border hover:bg-muted"
                  disabled={busy}
                  title={t.visualEditSliderNext}
                  onClick={() => {
                    postToIframe(iframeRef.current, 'goSlide', {
                      index: selection.slideIndex + 1,
                    })
                    setDirty(true)
                  }}
                >
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </button>
              </div>
              <div className="flex flex-wrap gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className={btn}
                  disabled={busy || selection.slideCount >= PW_SLIDER_SLIDE_MAX}
                  onClick={() => {
                    postToIframe(iframeRef.current, 'addSlide')
                    setDirty(true)
                  }}
                >
                  <Plus className="mr-1 h-3 w-3" />
                  {t.visualEditSliderAdd}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className={cn(btn, 'text-destructive')}
                  disabled={busy || selection.slideCount <= 2}
                  onClick={() => {
                    postToIframe(iframeRef.current, 'removeSlide')
                    setDirty(true)
                  }}
                >
                  <Trash2 className="mr-1 h-3 w-3" />
                  {t.visualEditSliderRemove}
                </Button>
              </div>
              <label className="flex flex-col gap-1 text-[10px]" title={t.visualEditSliderWaitHint}>
                <span className="flex items-center justify-between gap-2">
                  <span className="font-medium text-foreground">{t.visualEditSliderWait}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {selection.slideWait <= 0
                      ? t.visualEditSliderWaitOff
                      : `${(selection.slideWait / 1000).toFixed(1)}s`}
                  </span>
                </span>
                <input
                  type="range"
                  min={PW_SLIDER_WAIT_MIN}
                  max={PW_SLIDER_WAIT_MAX}
                  step={PW_SLIDER_WAIT_STEP}
                  value={selection.slideWait}
                  className={slider}
                  disabled={busy}
                  onChange={(e) => {
                    postToIframe(iframeRef.current, 'setSlideWait', {
                      ms: clampPwSliderWait(e.target.value),
                    })
                    setDirty(true)
                  }}
                />
                <span className="text-muted-foreground">{t.visualEditSliderWaitHint}</span>
              </label>
              <label className="flex cursor-pointer items-start gap-2">
                <Switch
                  className="mt-0.5 shrink-0 data-[state=checked]:bg-primary"
                  checked={selection.slideArrows}
                  disabled={busy}
                  onCheckedChange={(on) => {
                    postToIframe(iframeRef.current, 'setSlideArrows', { on })
                    setDirty(true)
                  }}
                />
                <span className="min-w-0">
                  <span className="block text-[11px] font-semibold leading-4">{t.visualEditSliderArrows}</span>
                  <span className="block text-[10px] leading-4 text-muted-foreground">
                    {t.visualEditSliderArrowsHint}
                  </span>
                </span>
              </label>
            </div>
          ) : null}
          {showImageTools && selection?.isBannerPhoto ? (
            <label
              className="flex min-w-[10rem] flex-1 items-center gap-1.5 text-[10px] sm:min-w-[14rem]"
              title={t.visualEditBannerZoomHint}
            >
              <span className="shrink-0 text-muted-foreground">{t.visualEditBannerZoom}</span>
              <input
                type="range"
                min={50}
                max={300}
                value={selection.bannerZoom}
                className={cn(slider, 'min-w-0 flex-1')}
                disabled={busy}
                onChange={(e) =>
                  postToIframe(iframeRef.current, 'setBannerZoom', { zoom: Number(e.target.value) })
                }
              />
              <span className="w-8 shrink-0 tabular-nums text-muted-foreground">{selection.bannerZoom}%</span>
            </label>
          ) : null}
          {(selection?.canSizeBlock || selection?.isAddedBg) && !chromeLikeKind ? (
            <div className="flex w-full min-w-[12rem] flex-col gap-1.5 rounded-md border bg-background px-2 py-1.5">
              <p className="text-[10px] leading-4 text-muted-foreground">
                {selection.isAddedBg ? t.visualEditBgSizeHint : t.visualEditBlockSizeHint}
              </p>
              {selection.isAddedBg && selection.isAddedBgSlot ? null : renderChromeNumSlider(
                selection.isAddedBg ? t.visualEditBgWidth : t.visualEditBlockWidth,
                Math.max(selection.isAddedBg ? 24 : 80, selection.blockWidth || selection.width || 80),
                selection.isAddedBg ? 24 : 80,
                Math.max(80, selection.blockMaxWidth || 390),
                (raw) =>
                  Math.max(
                    selection.isAddedBg ? 24 : 80,
                    Math.min(Math.max(80, selection.blockMaxWidth || 390), Math.round(Number(raw) || 80))
                  ),
                (width) => {
                  postToIframe(iframeRef.current, 'setBlockSize', { width })
                  setDirty(true)
                }
              )}
              {renderChromeNumSlider(
                selection.isAddedBg ? t.visualEditBgHeight : t.visualEditBlockHeight,
                Math.max(selection.isAddedBg ? 24 : 80, selection.blockHeight || selection.height || 80),
                selection.isAddedBg ? 24 : 80,
                2400,
                (raw) =>
                  Math.max(selection.isAddedBg ? 24 : 80, Math.min(2400, Math.round(Number(raw) || 80))),
                (height) => {
                  postToIframe(iframeRef.current, 'setBlockSize', { height })
                  setDirty(true)
                }
              )}
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className={cn(btn, 'self-start')}
                disabled={busy}
                onClick={() => {
                  postToIframe(iframeRef.current, 'resetBlockSize')
                  setDirty(true)
                }}
              >
                {t.visualEditBlockSizeReset}
              </Button>
            </div>
          ) : null}
          {showWidgetColors && selection ? (
            <div
              className={cn(
                'flex flex-wrap items-center rounded-md border bg-background/90',
                compact ? 'gap-1 p-1.5' : 'gap-1.5 p-2'
              )}
            >
              <div className="flex items-center gap-1 text-[10px]">
                <span className="text-muted-foreground">{t.visualEditAddButtonColor}</span>
                <ThemeColorConfirmPicker
                  value={
                    selection.btnColor
                      ? cssColorToHex(selection.btnColor, '#ffffff')
                      : 'transparent'
                  }
                  disabled={busy}
                  compact={compact}
                  okLabel={t.themeColorOk}
                  themePicks={themePicks}
                  allowTransparent
                  transparentLabel={t.visualEditBgTransparent}
                  onConfirm={(color) => {
                    postToIframe(iframeRef.current, 'setButtonColor', {
                      color: color === 'transparent' ? '' : color,
                    })
                    setDirty(true)
                  }}
                />
              </div>
              <div className="flex items-center gap-1 text-[10px]">
                <span className="text-muted-foreground">{t.visualEditAddButtonBorder}</span>
                <ThemeColorConfirmPicker
                  value={cssColorToHex(selection.btnBorder || '', '#e5e7eb')}
                  disabled={busy}
                  compact={compact}
                  okLabel={t.themeColorOk}
                  themePicks={themePicks}
                  onConfirm={(color) => {
                    postToIframe(iframeRef.current, 'setButtonBorder', { color })
                    setDirty(true)
                  }}
                />
              </div>
              {showWidgetIconColor ? (
                <div className="flex items-center gap-1 text-[10px]">
                  <span className="text-muted-foreground">
                    {t.visualEditIconColor}
                  </span>
                  <ThemeColorConfirmPicker
                    value={cssColorToHex(selection.iconColor || '', '#ffffff')}
                    disabled={busy}
                    compact={compact}
                    okLabel={t.themeColorOk}
                    themePicks={themePicks}
                    onConfirm={(color) => {
                      postToIframe(iframeRef.current, 'setIconColor', { color })
                      setDirty(true)
                    }}
                  />
                </div>
              ) : null}
              {showWidgetTextColor ? (
                <div className="flex items-center gap-1 text-[10px]">
                  <span className="text-muted-foreground">{t.visualEditTextColor}</span>
                  <ThemeColorConfirmPicker
                    value={cssColorToHex(selection.textColor || '', '#ffffff')}
                    disabled={busy}
                    compact={compact}
                    okLabel={t.themeColorOk}
                    themePicks={themePicks}
                    onConfirm={(color) => {
                      postToIframe(iframeRef.current, 'setColor', { color })
                      setDirty(true)
                    }}
                  />
                </div>
              ) : null}
              {chromeFaceKind ? (
                <div className="flex items-center gap-1 text-[10px]">
                  <span className="text-muted-foreground">{t.visualEditChromeHover}</span>
                  <ThemeColorConfirmPicker
                    value={cssColorToHex(
                      selection.chromeHover || selection.textColor || selection.iconColor || '',
                      '#ffffff'
                    )}
                    disabled={busy}
                    compact={compact}
                    okLabel={t.themeColorOk}
                    themePicks={themePicks}
                    onConfirm={(color) => {
                      postToIframe(iframeRef.current, 'setChromeHover', { color })
                      setDirty(true)
                    }}
                  />
                </div>
              ) : null}
              {editKind === 'search' ? (
                <label className="flex items-center gap-1 text-[10px]">
                  <span className="text-muted-foreground">{t.visualEditFontSize}</span>
                  <input
                    type="range"
                    min={10}
                    max={72}
                    value={selection.fontSize}
                    className={slider}
                    disabled={busy}
                    onChange={(e) => {
                      postToIframe(iframeRef.current, 'setFontSize', { size: Number(e.target.value) })
                      setDirty(true)
                    }}
                  />
                  <span className="w-5 tabular-nums text-muted-foreground">{selection.fontSize}</span>
                </label>
              ) : null}
              {showPlaceholderColor ? (
                <div className="flex items-center gap-1 text-[10px]">
                  <span className="text-muted-foreground">{t.visualEditPlaceholderColor}</span>
                  <ThemeColorConfirmPicker
                    value={cssColorToHex(selection.placeholderColor || '', '#9ca3af')}
                    disabled={busy}
                    compact={compact}
                    okLabel={t.themeColorOk}
                    themePicks={themePicks}
                    onConfirm={(color) => {
                      postToIframe(iframeRef.current, 'setPlaceholderColor', { color })
                      setDirty(true)
                    }}
                  />
                </div>
              ) : null}
            </div>
          ) : null}
          {showDotColors && selection ? (
            <div
              className={cn(
                'flex flex-wrap items-center rounded-md border bg-background/90',
                compact ? 'gap-1 p-1.5' : 'gap-1.5 p-2'
              )}
            >
              <div className="flex items-center gap-1 text-[10px]">
                <span className="text-muted-foreground">{t.visualEditDotColor}</span>
                <ThemeColorConfirmPicker
                  value={cssColorToHex(selection.dotColor || '', '#ffffff')}
                  disabled={busy}
                  compact={compact}
                  okLabel={t.themeColorOk}
                  themePicks={themePicks}
                  onConfirm={(color) => {
                    postToIframe(iframeRef.current, 'setDotColor', { color })
                    setDirty(true)
                  }}
                />
              </div>
              <div className="flex items-center gap-1 text-[10px]">
                <span className="text-muted-foreground">{t.visualEditDotActiveColor}</span>
                <ThemeColorConfirmPicker
                  value={cssColorToHex(selection.dotActiveColor || '', '#ffffff')}
                  disabled={busy}
                  compact={compact}
                  okLabel={t.themeColorOk}
                  themePicks={themePicks}
                  onConfirm={(color) => {
                    postToIframe(iframeRef.current, 'setDotActiveColor', { color })
                    setDirty(true)
                  }}
                />
              </div>
            </div>
          ) : null}
          {showTextTools && selection ? (
            <>
              {selection.isText && !selection.isButton && editKind !== 'chrome' && editKind !== 'cat-toggle' ? (
                <input
                  ref={textDraftInputRef}
                  type="text"
                  value={textDraft}
                  placeholder={t.visualEditTextContent}
                  className={cn(
                    'min-w-[8rem] flex-1 rounded-md border bg-background px-2',
                    compact ? 'h-6 text-[10px]' : 'h-8 text-xs'
                  )}
                  disabled={busy}
                  onFocus={() => {
                    textDraftFocusedRef.current = true
                  }}
                  onBlur={() => {
                    textDraftFocusedRef.current = false
                  }}
                  onChange={(e) => {
                    const input = e.currentTarget
                    const start = input.selectionStart
                    const end = input.selectionEnd
                    const text = input.value
                    setTextDraft(text)
                    postToIframe(iframeRef.current, 'setTextContent', { text })
                    setDirty(true)
                    requestAnimationFrame(() => {
                      const el = textDraftInputRef.current
                      if (!el || start == null || end == null) return
                      try {
                        el.setSelectionRange(start, end)
                      } catch {
                        /* ignore */
                      }
                    })
                  }}
                />
              ) : null}
              {hrefField}
              <div className="flex items-center gap-1 text-[10px]">
                <span className="text-muted-foreground">{t.visualEditTextColor}</span>
                <ThemeColorConfirmPicker
                  value={cssColorToHex(selection.textColor, '#111827')}
                  disabled={busy}
                  compact={compact}
                  okLabel={t.themeColorOk}
                  themePicks={themePicks}
                  onConfirm={(color) => postToIframe(iframeRef.current, 'setColor', { color })}
                />
              </div>
              <label className="flex items-center gap-1 text-[10px]">
                <span className="text-muted-foreground">{t.visualEditFontSize}</span>
                <input
                  type="range"
                  min={10}
                  max={72}
                  value={selection.fontSize}
                  className={slider}
                  disabled={busy}
                  onChange={(e) =>
                    postToIframe(iframeRef.current, 'setFontSize', { size: Number(e.target.value) })
                  }
                />
                <span className="w-5 tabular-nums text-muted-foreground">{selection.fontSize}</span>
              </label>
              <Button
                type="button"
                size="sm"
                variant={isBold ? 'default' : 'outline'}
                className={btn}
                disabled={busy}
                onClick={() => postToIframe(iframeRef.current, 'setFontWeight', { bold: !isBold })}
              >
                <Bold className="h-3.5 w-3.5" />
                {compact ? null : <span className="ml-1">{t.visualEditBold}</span>}
              </Button>
              <div className="flex items-center gap-0.5">
                {(
                  [
                    ['left', AlignLeft, t.visualEditAlignLeft],
                    ['center', AlignCenter, t.visualEditAlignCenter],
                    ['right', AlignRight, t.visualEditAlignRight],
                  ] as const
                ).map(([align, Icon, label]) => (
                  <Button
                    key={align}
                    type="button"
                    size="sm"
                    variant={selection.textAlign === align ? 'default' : 'outline'}
                    className={cn(btn, 'px-1.5')}
                    disabled={busy}
                    title={label}
                    onClick={() => postToIframe(iframeRef.current, 'setTextAlign', { align })}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </Button>
                ))}
              </div>
            </>
          ) : null}
          {!showTextTools ? hrefField : null}
          {destIsLogoHome ? null : openDestButton}
          {showBgColorPicker && colorSel ? (
            <div className="flex flex-wrap items-center gap-1 text-[10px]">
              <span className="text-muted-foreground">
                {colorSel.isAddedBg ? t.visualEditAddBgColor : t.visualEditBgColor}
              </span>
              <ThemeColorConfirmPicker
                value={
                  colorSel.fillMode === 'transparent' || colorSel.bgCleared
                    ? 'transparent'
                    : cssColorToHex(colorSel.bgColor, colorSel.isAddedBg ? addBgColor : '#ffffff')
                }
                disabled={busy}
                compact={compact}
                okLabel={t.themeColorOk}
                themePicks={themePicks}
                allowTransparent={Boolean(
                  colorSel.isFillHost ||
                    colorSel.isAddedBg ||
                    colorSel.isPaper ||
                    colorSel.canClearBg ||
                    colorSel.bgCleared
                )}
                transparentLabel={t.visualEditBgTransparent}
                onOpenChange={setBgColorPickerOpen}
                onConfirm={(color) => {
                  if (color === 'transparent') {
                    postToIframe(iframeRef.current, 'clearRegionFill')
                  } else {
                    postToIframe(iframeRef.current, 'setBgColor', { color })
                  }
                  setDirty(true)
                }}
              />
              {colorSel.isFillHost ||
              colorSel.isAddedBg ||
              colorSel.isPaper ||
              colorSel.canClearBg ||
              colorSel.bgCleared ? (
                <Button
                  type="button"
                  size="sm"
                  variant={colorSel.bgCleared ? 'default' : 'outline'}
                  className={cn(btn, 'px-1.5')}
                  disabled={busy || colorSel.bgCleared}
                  title={t.visualEditBgTransparent}
                  onClick={() => {
                    postToIframe(iframeRef.current, 'clearRegionFill')
                    setDirty(true)
                  }}
                >
                  {t.visualEditBgTransparent}
                </Button>
              ) : null}
            </div>
          ) : null}
          {showSceneStack ? (
            <div className="flex min-w-[12rem] flex-col gap-1 rounded-md border bg-background px-1.5 py-1">
              <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                {t.visualEditSceneTitle}
              </p>
              <p className="text-[10px] leading-4 text-muted-foreground">
                {t.visualEditSceneWorkLayer}:{' '}
                <span className="font-semibold text-foreground">
                  {sceneFocus >= 0 ? sceneLayerLabel(t, sceneFocus) : t.visualEditSceneAllLayers}
                </span>
              </p>
              <div className="flex overflow-hidden rounded-md border">
                {[...PW_SCENE_LAYERS].reverse().map((layer) => {
                  const locked = sceneFocus === layer.index
                  const onAddedBg = Boolean(selection?.isAddedBg && selection.scene === layer.index)
                  const pressed = selection?.isAddedBg ? onAddedBg : locked
                  return (
                    <button
                      key={layer.key}
                      type="button"
                      disabled={busy}
                      title={`${sceneLayerLabel(t, layer.index)} · ${selection?.isAddedBg ? t.visualEditSceneElementLayer : t.visualEditSceneLock}`}
                      aria-pressed={pressed}
                      className={cn(
                        'relative flex-1 border-r px-1 py-1 text-[10px] leading-4 last:border-r-0 disabled:opacity-50',
                        pressed
                          ? 'bg-primary font-semibold text-primary-foreground'
                          : 'text-muted-foreground hover:bg-muted'
                      )}
                      onClick={() => {
                        if (selection?.isAddedBg) {
                          postToIframe(iframeRef.current, 'setScene', { scene: layer.index })
                          return
                        }
                        postToIframe(iframeRef.current, 'setSceneFocus', {
                          scene: locked ? -1 : layer.index,
                        })
                      }}
                    >
                      <span className="inline-flex items-center justify-center gap-0.5">
                        {pressed && !selection?.isAddedBg ? (
                          <MousePointerClick className="h-2.5 w-2.5 shrink-0 opacity-90" aria-hidden />
                        ) : null}
                        {sceneLayerLabel(t, layer.index)}
                      </span>
                    </button>
                  )
                })}
              </div>
              {selection ? (
                <p className="rounded border bg-muted/40 px-1.5 py-1 text-[10px] leading-4 text-muted-foreground">
                  {t.visualEditSceneElementLayer}:{' '}
                  <span className="font-semibold text-foreground">{sceneLayerLabel(t, selection.scene)}</span>
                </p>
              ) : null}
              <p className="text-[10px] leading-4 text-muted-foreground">
                {selection?.isAddedBg ? t.visualEditSceneHintAddedBg : t.visualEditSceneHint}
              </p>
              {selection && !selection.isAddedBg ? (
                <div className="flex overflow-hidden rounded-md border">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className={cn(btn, 'flex-1 rounded-none border-0 border-r')}
                    disabled={busy || selection.scenePos === 'top'}
                    title={t.visualEditSceneUp}
                    onClick={() => postToIframe(iframeRef.current, 'sceneUp')}
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                    <span className="ml-1">{t.visualEditSceneUp}</span>
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className={cn(btn, 'flex-1 rounded-none border-0')}
                    disabled={busy || selection.scenePos === 'bottom'}
                    title={t.visualEditSceneDown}
                    onClick={() => postToIframe(iframeRef.current, 'sceneDown')}
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                    <span className="ml-1">{t.visualEditSceneDown}</span>
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}
          {showLayerStack && selection ? (
            <div className="flex min-w-[12rem] flex-col overflow-hidden rounded-md border bg-background">
              {selection.isAddedBg ? (
                <div className="min-w-0 border-b px-1.5 py-0.5">
                  <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {t.visualEditBgStackTitle}
                    {selection.bgCount ? ` · ${selection.bgIndex}/${Math.max(0, selection.bgCount - 1)}` : ''}
                  </p>
                  <ol className="mt-0.5 max-h-24 overflow-auto">
                    {[...selection.bgStack].reverse().map((row) => (
                      <li
                        key={`${row.role}-${row.index}`}
                        className={cn(
                          'flex items-center gap-1 text-[10px] leading-4',
                          row.current ? 'font-semibold text-primary' : 'text-muted-foreground'
                        )}
                      >
                        <span className="w-3 tabular-nums">{row.index}</span>
                        <span className="min-w-0 truncate">{bgStackRoleLabel(t, row.role)}</span>
                        {row.locked ? (
                          <span className="ml-auto shrink-0 text-[9px]">{t.visualEditBgStackLocked}</span>
                        ) : null}
                      </li>
                    ))}
                  </ol>
                </div>
              ) : (
                <div className="min-w-0 border-b px-1.5 py-0.5">
                  <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {t.visualEditLayerTitle}
                    {selection.layerCount > 1 ? ` · ${selection.layerIndex}/${selection.layerCount}` : ''}
                  </p>
                  <p className="text-[10px] leading-4 text-muted-foreground">{t.visualEditLayerOrderHint}</p>
                </div>
              )}
              <div className="flex">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className={cn(btn, 'flex-1 rounded-none border-0 border-r')}
                  disabled={busy || selection.layerPos === 'top' || selection.layerPos === 'only'}
                  title={t.visualEditLayerUp}
                  onClick={() =>
                    postToIframe(iframeRef.current, selection.isAddedBg ? 'layerBgUp' : 'layerElUp')
                  }
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                  <span className="ml-1">{t.visualEditLayerUp}</span>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className={cn(btn, 'flex-1 rounded-none border-0')}
                  disabled={busy || selection.layerPos === 'bottom' || selection.layerPos === 'only'}
                  title={t.visualEditLayerDown}
                  onClick={() =>
                    postToIframe(iframeRef.current, selection.isAddedBg ? 'layerBgDown' : 'layerElDown')
                  }
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                  <span className="ml-1">{t.visualEditLayerDown}</span>
                </Button>
              </div>
            </div>
          ) : null}
          {showPinScreen && selection ? (
            <label className="flex cursor-pointer items-start gap-2 rounded-md border bg-background px-2 py-1.5">
              <Switch
                className="mt-0.5 shrink-0 data-[state=checked]:bg-primary"
                checked={selection.pinScreen}
                disabled={busy}
                onCheckedChange={(on) => {
                  postToIframe(iframeRef.current, 'setPinScreen', { on })
                  setDirty(true)
                }}
              />
              <span className="min-w-0">
                <span className="block text-[11px] font-semibold leading-4">{t.visualEditPinScreen}</span>
                <span className="block text-[10px] leading-4 text-muted-foreground">{t.visualEditPinScreenHint}</span>
              </span>
            </label>
          ) : null}
          {showHideEl && selection && !showBlockTools ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className={btn}
              disabled={busy}
              title={t.visualEditBlockHide}
              onClick={() => {
                postToIframe(iframeRef.current, 'hideBlock')
                setDirty(true)
              }}
            >
              <EyeOff className="h-3 w-3" />
              {compact ? null : <span className="ml-1">{t.visualEditBlockHide}</span>}
            </Button>
          ) : null}
          {showStayScroll && selection ? (
            <label className="flex cursor-pointer items-start gap-2 rounded-md border bg-background px-2 py-1.5">
              <Switch
                className="mt-0.5 shrink-0 data-[state=checked]:bg-primary"
                checked={selection.stayScroll}
                disabled={busy}
                onCheckedChange={(on) => {
                  postToIframe(iframeRef.current, 'setStayScroll', { on })
                  setDirty(true)
                }}
              />
              <span className="min-w-0">
                <span className="block text-[11px] font-semibold leading-4">{t.visualEditStayScroll}</span>
                <span className="block text-[10px] leading-4 text-muted-foreground">{t.visualEditStayScrollHint}</span>
              </span>
            </label>
          ) : null}
          {showStickHeader && selection ? (
            <label className="flex cursor-pointer items-start gap-2 rounded-md border bg-background px-2 py-1.5">
              <Switch
                className="mt-0.5 shrink-0 data-[state=checked]:bg-primary"
                checked={selection.stickHeader}
                disabled={busy}
                onCheckedChange={(on) => {
                  postToIframe(iframeRef.current, 'setStickHeader', { on })
                  setDirty(true)
                }}
              />
              <span className="min-w-0">
                <span className="block text-[11px] font-semibold leading-4">{t.visualEditStickHeader}</span>
                <span className="block text-[10px] leading-4 text-muted-foreground">{t.visualEditStickHeaderHint}</span>
              </span>
            </label>
          ) : null}
          {showImageTools && selection && (selection.isImage || selection.isBannerPhoto) && !selection.isLogo ? (
            <>
              {selection.isImage && !selection.isBannerPhoto ? (
              <label className="flex items-center gap-1 text-[10px]">
                <span className="text-muted-foreground">{t.visualEditImageWidth}</span>
                <input
                  type="range"
                  min={20}
                  max={100}
                  value={selection.imageWidth}
                  className={slider}
                  disabled={busy}
                  onChange={(e) =>
                    postToIframe(iframeRef.current, 'setImageWidth', { width: Number(e.target.value) })
                  }
                />
                <span className="w-7 tabular-nums text-muted-foreground">{selection.imageWidth}%</span>
              </label>
              ) : null}
              {selection.canImageRadius ? (
                <div className="grid gap-1">
                  <div className="flex flex-wrap items-center gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant={(selection.imageRadius ?? 0) === 0 ? 'default' : 'outline'}
                      className={btn}
                      disabled={busy}
                      onClick={() => {
                        postToIframe(iframeRef.current, 'setImageRadius', { radius: 0 })
                        setDirty(true)
                      }}
                    >
                      {t.visualEditImageSquare}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={(selection.imageRadius ?? 0) > 0 ? 'default' : 'outline'}
                      className={btn}
                      disabled={busy}
                      onClick={() => {
                        postToIframe(iframeRef.current, 'setImageRadius', { radius: PW_IMAGE_RADIUS_ROUNDED })
                        setDirty(true)
                      }}
                    >
                      {t.visualEditImageRound}
                    </Button>
                  </div>
                  <label className="flex items-center gap-1 text-[10px]">
                    <span className="text-muted-foreground">{t.visualEditImageRadius}</span>
                    <input
                      type="range"
                      min={PW_IMAGE_RADIUS_MIN}
                      max={PW_IMAGE_RADIUS_MAX}
                      value={selection.imageRadius ?? PW_IMAGE_RADIUS_DEFAULT}
                      className={slider}
                      disabled={busy}
                      onChange={(e) => {
                        postToIframe(iframeRef.current, 'setImageRadius', { radius: Number(e.target.value) })
                        setDirty(true)
                      }}
                    />
                    <span className="w-8 tabular-nums text-muted-foreground">
                      {selection.imageRadius ?? 0}px
                    </span>
                  </label>
                </div>
              ) : null}
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className={btn}
                disabled={busy}
                onClick={() => postToIframe(iframeRef.current, 'resetImageTransform')}
              >
                {t.visualEditResetImagePos}
              </Button>
            </>
          ) : null}
          {showBlockTools && selection ? (
            <>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className={btn}
                disabled={busy}
                title={t.visualEditBlockHide}
                onClick={() => postToIframe(iframeRef.current, 'hideBlock')}
              >
                <EyeOff className="h-3 w-3" />
                {compact ? null : <span className="ml-1">{t.visualEditBlockHide}</span>}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className={btn}
                disabled={busy}
                title={t.visualEditBlockDuplicate}
                onClick={() => postToIframe(iframeRef.current, 'duplicateBlock')}
              >
                <Copy className="h-3 w-3" />
                {compact ? null : <span className="ml-1">{t.visualEditBlockDuplicate}</span>}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className={cn(btn, 'text-destructive')}
                disabled={busy}
                title={t.visualEditBlockDelete}
                onClick={() => {
                  postToIframe(iframeRef.current, 'deleteBlock')
                  setDirty(true)
                }}
              >
                <Trash2 className="h-3 w-3" />
                {compact ? null : <span className="ml-1">{t.visualEditBlockDelete}</span>}
              </Button>
              <label className="flex items-center gap-1 text-[10px]" title={t.visualEditBlockPaddingY}>
                <span className="text-muted-foreground">{compact ? 'Y' : t.visualEditBlockPaddingY}</span>
                <input
                  type="range"
                  min={0}
                  max={120}
                  value={selection.paddingY}
                  className={slider}
                  disabled={busy}
                  onChange={(e) =>
                    postToIframe(iframeRef.current, 'setPadding', { y: Number(e.target.value) })
                  }
                />
                <span className="w-6 tabular-nums text-muted-foreground">{selection.paddingY}</span>
              </label>
              <label className="flex items-center gap-1 text-[10px]" title={t.visualEditBlockPaddingX}>
                <span className="text-muted-foreground">{compact ? 'X' : t.visualEditBlockPaddingX}</span>
                <input
                  type="range"
                  min={0}
                  max={80}
                  value={selection.paddingX}
                  className={slider}
                  disabled={busy}
                  onChange={(e) =>
                    postToIframe(iframeRef.current, 'setPadding', { x: Number(e.target.value) })
                  }
                />
                <span className="w-6 tabular-nums text-muted-foreground">{selection.paddingX}</span>
              </label>
              {selection.canOverlay ? (
                <label className="flex items-center gap-1 text-[10px]" title={t.visualEditBlockOverlay}>
                  <span className="text-muted-foreground">{compact ? '%' : t.visualEditBlockOverlay}</span>
                  <input
                    type="range"
                    min={0}
                    max={80}
                    value={selection.overlay}
                    className={slider}
                    disabled={busy}
                    onChange={(e) =>
                      postToIframe(iframeRef.current, 'setOverlay', { value: Number(e.target.value) })
                    }
                  />
                  <span className="w-7 tabular-nums text-muted-foreground">{selection.overlay}%</span>
                </label>
              ) : null}
            </>
          ) : null}
          {selection &&
          !selection.isPaper &&
          editKind !== 'paper' &&
          (selection.isAddedBg || selection.canClearBg || (!selection.isBlock && selection.canDelete)) ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className={cn(btn, 'text-destructive')}
              disabled={busy}
              title={deleteLabel}
              onClick={() => {
                postToIframe(iframeRef.current, 'deleteUnit')
                setDirty(true)
              }}
            >
              <Plus className="h-3 w-3 rotate-45" aria-hidden />
              {compact ? null : <span className="ml-1">{deleteLabel}</span>}
            </Button>
          ) : null}
          {selection?.hasParentBlock && !selection.isBlock ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className={btn}
              disabled={busy}
              onClick={() => postToIframe(iframeRef.current, 'selectParentBlock')}
            >
              <LayoutTemplate className="mr-1 h-3 w-3" />
              {t.visualEditSelectBlock}
              {selection.blockLabel && !compact ? ` · ${selection.blockLabel}` : ''}
            </Button>
          ) : null}
          {!selection ? (
            <span className="text-[11px] text-muted-foreground">{t.visualEditSelectHint}</span>
          ) : null}

        {hiddenBlocks.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1 text-[10px]">
            <span className="text-muted-foreground">{t.visualEditHiddenBlocks}:</span>
            {hiddenBlocks.map((row) => {
              const place = hiddenPlaceCopy(row.place, t)
              return (
              <Button
                key={row.id}
                type="button"
                size="sm"
                variant="secondary"
                className={btn}
                disabled={busy}
                title={place ? `${row.label} · ${place}` : row.label}
                onClick={() => postToIframe(iframeRef.current, 'showHidden', { id: row.id })}
              >
                <Eye className="mr-1 h-3 w-3" />
                {t.visualEditBlockShow}
                {row.label ? ` · ${row.label}` : ''}
                {place ? ` · ${place}` : ''}
              </Button>
              )
            })}
            <p className="w-full text-[10px] leading-4 text-muted-foreground">{t.visualEditHiddenBlocksHint}</p>
          </div>
        ) : null}

        {showChromeStyle && selection ? (
          <div className="flex flex-col gap-1.5 rounded-md border bg-background px-2 py-1.5">
            <div>
              <p className="text-[11px] font-semibold leading-4">{chromeTitle}</p>
              <p className="text-[10px] leading-4 text-muted-foreground">{t.visualEditChromeWidgetHint}</p>
            </div>
            <div className="flex flex-wrap items-center gap-1 text-[10px]">
            <span className="shrink-0 text-muted-foreground">{t.visualEditAddStyleTitle}</span>
            {chromeStyleChoices().map(([style, label]) => (
              <Button
                key={style}
                type="button"
                size="sm"
                variant={selection.chromeStyle === style ? 'default' : 'outline'}
                className={btn}
                disabled={busy}
                onClick={() => applySelectedChromeStyle(style)}
              >
                {label}
              </Button>
            ))}
            </div>
            <div className="flex flex-col gap-0.5">
            <p className="text-[10px] leading-4 text-muted-foreground">{t.visualEditChromeLayoutHint}</p>
            <div className="flex flex-wrap items-center gap-1 text-[10px]">
              <span className="shrink-0 text-muted-foreground">{t.visualEditChromeLayout}</span>
              <Button
                type="button"
                size="sm"
                variant={selection.chromeLayout !== 'col' ? 'default' : 'outline'}
                className={btn}
                disabled={busy}
                onClick={() => {
                  postToIframe(iframeRef.current, 'setChromeLayout', { dir: 'row' })
                  setDirty(true)
                }}
              >
                {t.visualEditChromeLayoutRow}
              </Button>
              <Button
                type="button"
                size="sm"
                variant={selection.chromeLayout === 'col' ? 'default' : 'outline'}
                className={btn}
                disabled={busy}
                onClick={() => {
                  postToIframe(iframeRef.current, 'setChromeLayout', { dir: 'col' })
                  setDirty(true)
                }}
              >
                {t.visualEditChromeLayoutCol}
              </Button>
            </div>
            </div>
            {selection.chromeStyle !== 'text' && editKind === 'search-submit'
              ? renderSearchGlyphPicker('lens', selection.searchGlyph)
              : selection.chromeStyle !== 'text' && editKind === 'search-image'
                ? renderSearchGlyphPicker('camera', selection.searchGlyph)
                : selection.chromeStyle !== 'text' &&
                    canPickChromeGlyph(selection.chromeKind || (editKind === 'cat-toggle' ? 'categories' : ''))
                  ? renderChromeGlyphPicker(
                      selection.chromeKind || (editKind === 'cat-toggle' ? 'categories' : 'account'),
                      selection.chromeGlyph
                    )
                  : null}
            {renderChromeSizeSliders(
              selection.chromeStyle,
              selection.chromeWidth,
              selection.chromeLabelSize
            )}
            <div className="flex flex-wrap items-center gap-1 text-[10px]">
              <Button
                type="button"
                size="sm"
                variant={selection.chromeBold ? 'default' : 'outline'}
                className={btn}
                disabled={busy}
                title={t.visualEditChromeBold}
                onClick={() => {
                  postToIframe(iframeRef.current, 'setChromeBold', { on: !selection.chromeBold })
                  setDirty(true)
                }}
              >
                <Bold className="mr-1 h-3 w-3" />
                {t.visualEditChromeBold}
              </Button>
            </div>
            {renderChromeNumSlider(
              t.visualEditChromeGap,
              selection.chromeGap ?? 6,
              PW_CHROME_GAP_MIN,
              PW_CHROME_GAP_MAX,
              clampPwChromeGap,
              (size) => {
                postToIframe(iframeRef.current, 'setChromeGap', { size })
                setDirty(true)
              }
            )}
            {renderChromeNumSlider(
              t.visualEditChromeRadius,
              selection.chromeRadius ?? 0,
              PW_CHROME_RADIUS_MIN,
              PW_CHROME_RADIUS_MAX,
              clampPwChromeRadius,
              (size) => {
                postToIframe(iframeRef.current, 'setChromeRadius', { size })
                setDirty(true)
              }
            )}
            {selection.chromeKind === 'chat' ? (
              <div className="grid gap-1 border-t border-border/70 pt-1.5">
                <p className="text-[11px] font-semibold leading-4">{t.visualEditChatIconLogoTitle}</p>
                <p className="text-[10px] leading-4 text-muted-foreground">{t.visualEditChatIconLogoHint}</p>
                <p className="rounded-md bg-muted/70 px-2 py-1 text-[10px] leading-4 text-foreground">
                  {t.visualEditChatIconLogoDefaultPrompt}
                </p>
                {theme?.chatIconLogoUrl || selection.src ? (
                  <img
                    src={theme?.chatIconLogoUrl || selection.src}
                    alt=""
                    className="h-10 w-10 rounded-full border object-cover"
                  />
                ) : null}
                <input
                  type="text"
                  value={chatIconPrompt}
                  onChange={(e) => setChatIconPrompt(e.target.value)}
                  placeholder={t.visualEditChatIconLogoPromptPlaceholder}
                  disabled={busy}
                  className={cn(
                    'min-w-0 w-full rounded-md border bg-background px-2',
                    compact ? 'h-6 text-[10px]' : 'h-8 text-xs'
                  )}
                />
                <div className="space-y-1">
                  <p className="text-[10px] font-semibold leading-4">{t.visualEditAiColorTitle}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1 text-[10px]">
                      <span className="text-muted-foreground">{t.visualEditAiColorMain}</span>
                      <ThemeColorConfirmPicker
                        value={cssColorToHex(aiImageColor, '#c2410c')}
                        disabled={busy}
                        compact={compact}
                        okLabel={t.themeColorOk}
                        themePicks={themePicks}
                        onConfirm={setAiImageColor}
                      />
                    </div>
                    <div className="flex items-center gap-1 text-[10px]">
                      <span className="text-muted-foreground">{t.visualEditAiColorAccent}</span>
                      <ThemeColorConfirmPicker
                        value={cssColorToHex(aiImageAccent, '#fb923c')}
                        disabled={busy}
                        compact={compact}
                        okLabel={t.themeColorOk}
                        themePicks={themePicks}
                        onConfirm={setAiImageAccent}
                      />
                    </div>
                  </div>
                </div>
                <div className="flex min-w-0 items-center gap-1">
                  {refUrl ? <img src={refUrl} alt="" className="h-7 w-7 rounded-full border bg-white object-cover" /> : null}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className={cn(btn, 'shrink-0')}
                    disabled={busy}
                    title={t.visualEditUploadReference}
                    onClick={() => refFileRef.current?.click()}
                  >
                    {uploadBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <ImagePlus className="h-3 w-3" />}
                    <span className="ml-1">{t.visualEditLogoReferenceLabel}</span>
                  </Button>
                  {refUrl ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 shrink-0 p-0"
                      disabled={busy}
                      title={t.visualEditRemoveReference}
                      onClick={() => {
                        setRefUrl('')
                        setUseCurrentRef(false)
                      }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  ) : null}
                </div>
                <div className="flex min-w-0 flex-wrap items-center gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className={cn(btn, 'shrink-0')}
                    disabled={busy}
                    title={t.visualEditChatIconLogoUpload}
                    onClick={() => chatIconFileRef.current?.click()}
                  >
                    {uploadBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                    <span className="ml-1">{t.visualEditChatIconLogoUpload}</span>
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className={cn(btn, 'shrink-0')}
                    disabled={busy}
                    onClick={() => void handleCreateChatIconLogo()}
                  >
                    {aiBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                    <span className="ml-1">{t.visualEditChatIconLogoCreate}</span>
                  </Button>
                </div>
              </div>
            ) : null}
            {!selection.chromeStyle || !isChromeIconOnlyStyle(selection.chromeStyle) ? (
              <label className="flex min-w-0 w-full flex-col gap-0.5 text-[10px]">
                <span className="shrink-0 text-muted-foreground">{t.visualEditTextContent}</span>
                <input
                  ref={textDraftInputRef}
                  type="text"
                  value={textDraft}
                  placeholder={t.visualEditTextContent}
                  className={cn(
                    'min-w-0 w-full rounded-md border bg-background px-2',
                    compact ? 'h-6 text-[10px]' : 'h-8 text-xs'
                  )}
                  disabled={busy}
                  onFocus={() => {
                    textDraftFocusedRef.current = true
                  }}
                  onBlur={() => {
                    textDraftFocusedRef.current = false
                  }}
                  onChange={(e) => {
                    const text = e.currentTarget.value
                    setTextDraft(text)
                    postToIframe(iframeRef.current, 'setButtonLabel', { text })
                    setDirty(true)
                  }}
                />
              </label>
            ) : null}
            {chromeKindShowsCountBadge(selection.chromeKind) ? (
              <label className="flex cursor-pointer items-start gap-2 rounded-md border bg-background px-2 py-1.5">
                <Switch
                  className="mt-0.5 shrink-0 data-[state=checked]:bg-primary"
                  checked={selection.chromeCountOn !== false}
                  disabled={busy}
                  onCheckedChange={(on) => {
                    postToIframe(iframeRef.current, 'setChromeCount', { on })
                    setDirty(true)
                  }}
                />
                <span className="min-w-0">
                  <span className="block text-[11px] font-semibold leading-4">{t.visualEditChromeCountBadge}</span>
                  <span className="block text-[10px] leading-4 text-muted-foreground">
                    {t.visualEditChromeCountBadgeHint}
                  </span>
                </span>
              </label>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="outline"
              className={cn(btn, 'w-full justify-center')}
              disabled={busy}
              onClick={() => {
                postToIframe(iframeRef.current, 'resetChromeFace', {})
                setDirty(true)
              }}
            >
              <RotateCcw className="mr-1 h-3 w-3" />
              {t.visualEditChromeReset}
            </Button>
          </div>
        ) : null}

        {showCtaStyle && selection ? (
          <div
            className={cn(
              'flex flex-wrap items-center rounded-md border bg-background/90',
              compact ? 'gap-1 p-1.5' : 'gap-1.5 p-2'
            )}
          >
            <div className="flex min-w-full flex-col gap-0.5">
              <span className="text-[11px] font-semibold leading-4">{t.visualEditPageButtonTitle}</span>
              <span className="text-[10px] leading-4 text-muted-foreground">{t.visualEditPageButtonHint}</span>
            </div>
            <div className="flex items-center gap-1 text-[10px]">
              <span className="text-muted-foreground">{t.visualEditAddButtonColor}</span>
              <ThemeColorConfirmPicker
                value={cssColorToHex(addBtnColor || selection?.bgColor || '', '#ffffff')}
                disabled={busy}
                compact={compact}
                okLabel={t.themeColorOk}
                themePicks={themePicks}
                onConfirm={(color) => {
                  setAddBtnColor(color)
                  postToIframe(iframeRef.current, 'setButtonColor', { color })
                  setDirty(true)
                }}
              />
            </div>
            <div className="flex items-center gap-1 text-[10px]">
              <span className="text-muted-foreground">{t.visualEditAddButtonBorder}</span>
              <ThemeColorConfirmPicker
                value={cssColorToHex(addBtnBorder || selection?.btnBorder || '', '#ffffff')}
                disabled={busy}
                compact={compact}
                okLabel={t.themeColorOk}
                themePicks={themePicks}
                onConfirm={(color) => {
                  setAddBtnBorder(color)
                  postToIframe(iframeRef.current, 'setButtonBorder', { color })
                  setDirty(true)
                }}
              />
            </div>
            <input
              ref={btnLabelInputRef}
              type="text"
              value={addBtnLabel}
              placeholder={t.visualEditAddButtonText}
              className={cn(
                'min-w-[7rem] rounded-md border bg-background px-2',
                compact ? 'h-6 text-[10px]' : 'h-8 text-xs'
              )}
              disabled={busy}
              onFocus={() => {
                btnLabelFocusedRef.current = true
              }}
              onBlur={() => {
                btnLabelFocusedRef.current = false
              }}
              onChange={(e) => {
                const input = e.currentTarget
                const start = input.selectionStart
                const end = input.selectionEnd
                const text = input.value
                setAddBtnLabel(text)
                postToIframe(iframeRef.current, 'setButtonLabel', { text })
                setDirty(true)
                requestAnimationFrame(() => {
                  const el = btnLabelInputRef.current
                  if (!el || start == null || end == null) return
                  try {
                    el.setSelectionRange(start, end)
                  } catch {
                    /* ignore */
                  }
                })
              }}
            />
            {(
              [
                ['hero', t.visualEditBtnStyleHero],
                ['primary', t.visualEditBtnStylePrimary],
                ['outline', t.visualEditBtnStyleOutline],
              ] as const
            ).map(([style, label]) => (
              <Button
                key={style}
                type="button"
                size="sm"
                variant={(selection?.btnStyle || addBtnStyle) === style ? 'default' : 'outline'}
                className={btn}
                disabled={busy}
                onClick={() => {
                  setAddBtnStyle(style)
                  applySelectedButtonStyle(style)
                }}
              >
                {label}
              </Button>
            ))}
            <input
              type="text"
              value={addBtnHref}
              placeholder={t.visualEditButtonHrefPlaceholder}
              className={cn(
                'min-w-[12rem] flex-1 rounded-md border bg-background px-2',
                compact ? 'h-6 text-[10px]' : 'h-8 text-xs'
              )}
              disabled={busy}
              onFocus={() => {
                btnHrefFocusedRef.current = true
              }}
              onChange={(e) => {
                setAddBtnHref(e.target.value)
                setHrefDraft(e.target.value)
              }}
              onBlur={(e) => {
                btnHrefFocusedRef.current = false
                commitHref(e.target.value)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  commitHref(addBtnHref)
                }
              }}
            />
            <div className="flex items-center gap-1 text-[10px]">
              <span className="text-muted-foreground">{t.visualEditTextColor}</span>
              <ThemeColorConfirmPicker
                value={cssColorToHex(selection.textColor || '', '#ffffff')}
                disabled={busy}
                compact={compact}
                okLabel={t.themeColorOk}
                themePicks={themePicks}
                onConfirm={(color) => {
                  postToIframe(iframeRef.current, 'setColor', { color })
                  setDirty(true)
                }}
              />
            </div>
            <div className="flex items-center gap-1 text-[10px]">
              <span className="text-muted-foreground">{t.visualEditChromeHover}</span>
              <ThemeColorConfirmPicker
                value={cssColorToHex(selection.chromeHover || selection.textColor || '', '#ffffff')}
                disabled={busy}
                compact={compact}
                okLabel={t.themeColorOk}
                themePicks={themePicks}
                onConfirm={(color) => {
                  postToIframe(iframeRef.current, 'setChromeHover', { color })
                  setDirty(true)
                }}
              />
            </div>
            <div className="flex flex-wrap items-center gap-1 text-[10px]">
              <Button
                type="button"
                size="sm"
                variant={selection.chromeBold ? 'default' : 'outline'}
                className={btn}
                disabled={busy}
                title={t.visualEditChromeBold}
                onClick={() => {
                  postToIframe(iframeRef.current, 'setChromeBold', { on: !selection.chromeBold })
                  setDirty(true)
                }}
              >
                <Bold className="mr-1 h-3 w-3" />
                {t.visualEditChromeBold}
              </Button>
            </div>
            {renderChromeNumSlider(
              t.visualEditChromeTextSize,
              selection.fontSize || selection.chromeLabelSize || 14,
              10,
              72,
              (raw) => {
                const n = Number(raw)
                if (!Number.isFinite(n)) return 14
                return Math.min(72, Math.max(10, Math.round(n)))
              },
              (size) => {
                postToIframe(iframeRef.current, 'setFontSize', { size })
                setDirty(true)
              }
            )}
            {renderChromeNumSlider(
              t.visualEditChromeRadius,
              selection.chromeRadius ?? 0,
              PW_CHROME_RADIUS_MIN,
              PW_CHROME_RADIUS_MAX,
              clampPwChromeRadius,
              (size) => {
                postToIframe(iframeRef.current, 'setChromeRadius', { size })
                setDirty(true)
              }
            )}
            <Button
              type="button"
              size="sm"
              variant="outline"
              className={cn(btn, 'w-full justify-center')}
              disabled={busy}
              onClick={() => {
                postToIframe(iframeRef.current, 'resetChromeFace', {})
                setDirty(true)
              }}
            >
              <RotateCcw className="mr-1 h-3 w-3" />
              {t.visualEditChromeReset}
            </Button>
          </div>
        ) : null}

        {showImageTools && selection ? (
          <div
            className={cn(
              'w-full rounded-md border bg-background/80',
              selection.isLogo
                ? 'flex w-full max-w-md flex-col gap-1 p-1.5'
                : cn('flex flex-col', compact ? 'gap-1 p-1.5' : 'gap-2 p-2')
            )}
          >
            {selection.isBannerPhoto ? (
              <label
                className="flex w-full items-center gap-2 text-[10px] sm:col-span-2"
                title={t.visualEditBannerZoomHint}
              >
                <span className="shrink-0 font-medium text-muted-foreground">{t.visualEditBannerZoom}</span>
                <input
                  type="range"
                  min={50}
                  max={300}
                  value={selection.bannerZoom}
                  className={cn(slider, 'h-6 min-w-0 w-full max-w-none flex-1 accent-primary')}
                  disabled={busy}
                  onChange={(e) =>
                    postToIframe(iframeRef.current, 'setBannerZoom', { zoom: Number(e.target.value) })
                  }
                />
                <span className="w-8 shrink-0 tabular-nums text-muted-foreground">{selection.bannerZoom}%</span>
              </label>
            ) : null}
            {selection.isLogo ? (
              <>
                {logoCreateFields}
                {hasRealLogoSrc ? (
                  <div className="flex w-full flex-col gap-1">
                    <Button
                      type="button"
                      size="sm"
                      className="h-7 px-2 text-[11px]"
                      disabled={busy}
                      title={t.visualEditLogoZoomHint}
                      onClick={() => postToIframe(iframeRef.current, 'openLogoCrop', {})}
                    >
                      <Crop className="mr-1 h-3 w-3" />
                      {t.visualEditLogoCrop}
                    </Button>
                    <p className="text-[10px] leading-snug text-muted-foreground">{t.visualEditLogoZoomHint}</p>
                    <label className="flex w-full items-center gap-1.5 text-[10px]" title={t.visualEditLogoZoomHint}>
                      <span className="w-14 shrink-0 text-muted-foreground">{t.visualEditLogoZoom}</span>
                      <button
                        type="button"
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded border bg-background text-xs font-semibold"
                        disabled={busy}
                        aria-label="-"
                        onClick={() =>
                          postToIframe(iframeRef.current, 'setLogoZoom', {
                            zoom: Math.max(30, selection.logoZoom - 10),
                          })
                        }
                      >
                        −
                      </button>
                      <input
                        type="range"
                        min={30}
                        max={400}
                        value={selection.logoZoom}
                        className={cn(slider, 'h-6 min-w-0 w-full flex-1 accent-primary')}
                        disabled={busy}
                        onChange={(e) =>
                          postToIframe(iframeRef.current, 'setLogoZoom', { zoom: Number(e.target.value) })
                        }
                      />
                      <button
                        type="button"
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded border bg-background text-xs font-semibold"
                        disabled={busy}
                        aria-label="+"
                        onClick={() =>
                          postToIframe(iframeRef.current, 'setLogoZoom', {
                            zoom: Math.min(400, selection.logoZoom + 10),
                          })
                        }
                      >
                        +
                      </button>
                      <span className="w-8 shrink-0 tabular-nums text-muted-foreground">{selection.logoZoom}%</span>
                    </label>
                    <button
                      type="button"
                      className="self-start text-[10px] text-muted-foreground underline-offset-2 hover:underline"
                      disabled={busy}
                      onClick={() => postToIframe(iframeRef.current, 'setLogoReset', {})}
                    >
                      {t.visualEditResetImagePos}
                    </button>
                  </div>
                ) : null}
              </>
            ) : compact ? null : (
              <div className="min-w-0">
                <p className="text-xs font-medium">{t.visualEditAiImageTitle}</p>
                <p className="text-[11px] text-muted-foreground">{t.visualEditAiImageHint}</p>
              </div>
            )}
            {selection.isLogo || showFillAiStudio ? null : renderAiImageStudio('nanoai-ve-ai-prompt')}
            <div className={cn('flex flex-wrap items-center gap-1', selection.isLogo && 'shrink-0')}>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  void handleUploadReplace(e.target.files)
                  e.target.value = ''
                }}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                className={selection.isLogo ? 'h-6 px-1.5 text-[10px]' : btn}
                disabled={busy}
                title={
                  selection.isLogo
                    ? t.visualEditUploadAsLogo
                    : selection.isPaper || selection.isFillHost || selection.isAddedBg || editKind === 'paper'
                      ? t.visualEditPaperPickImage
                      : t.visualEditReplaceImage
                }
                onClick={() => fileRef.current?.click()}
              >
                {uploadBusy ? (
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                ) : (
                  <ImagePlus className="mr-1 h-3 w-3" />
                )}
                {selection.isLogo
                  ? t.visualEditUploadAsLogo
                  : selection.isPaper || selection.isFillHost || selection.isAddedBg || editKind === 'paper'
                    ? t.visualEditPaperPickImage
                    : t.visualEditReplaceImage}
              </Button>
              {selection.isLogo ? (
              <Button
                type="button"
                size="sm"
                className="h-6 px-1.5 text-[10px]"
                disabled={busy}
                title={logoActionLabel}
                onClick={() => void handleGenerateAi()}
              >
                {aiBusy ? (
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                ) : (
                  <Sparkles className="mr-1 h-3 w-3" />
                )}
                {logoActionLabel}
              </Button>
              ) : null}
              {hasRealLogoSrc ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className={selection.isLogo ? 'h-6 px-1.5 text-[10px]' : btn}
                  disabled={busy}
                  title={t.visualEditApplyLogoAll}
                  onClick={() => {
                    postToIframe(iframeRef.current, 'setImageSrc', { url: selection.src, allSlots: true })
                    setDirty(true)
                    void persistAdminLogo(selection.src)
                  }}
                >
                  <Images className={cn('h-3 w-3', !selection.isLogo && 'mr-1')} />
                  {selection.isLogo ? null : t.visualEditApplyLogoAll}
                </Button>
              ) : null}
              {selection.isLogo && hasRealLogoSrc ? (
                <label className="flex items-center gap-1 text-[10px] text-muted-foreground" title={t.visualEditUseCurrentAsRef}>
                  <input
                    type="checkbox"
                    checked={useCurrentRef && !refUrl}
                    disabled={busy}
                    onChange={(e) => {
                      setUseCurrentRef(e.target.checked)
                      if (e.target.checked) setRefUrl('')
                    }}
                  />
                  {t.visualEditUseCurrentAsRef}
                </label>
              ) : null}
            </div>
          </div>
        ) : null}
                  </div>
                ) : null}
              </VisualEditFloatingPanel>,
              document.body
            )
          : null}
      </div>
      {typeof document !== 'undefined' && active && (gapUnits.length > 0 || hGapUnits.length > 0)
        ? createPortal(
            <div className="pointer-events-none fixed inset-0 z-[90]" data-pw-gap-plus-host="1">
              {Array.from({ length: gapUnits.length + 1 }, (_, i) => {
                const point = gapPlusPoint(i, gapUnits)
                if (!point) return null
                const x = iframeBox.left + point.x
                const y = iframeBox.top + point.y
                if (
                  x < iframeBox.left - 8 ||
                  x > iframeBox.left + iframeBox.width + 8 ||
                  y < iframeBox.top - 8 ||
                  y > iframeBox.top + iframeBox.height + 8
                ) {
                  return null
                }
                return (
                  <button
                    key={'v-' + i}
                    type="button"
                    className={cn(
                      'pointer-events-auto absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-[1.5px] border-white bg-[#2563eb] text-[20px] font-bold leading-none text-white shadow opacity-90 hover:bg-[#1d4ed8] hover:opacity-100',
                      gapActiveIndex === i && 'bg-[#1d4ed8] opacity-100'
                    )}
                    style={{ left: x, top: y }}
                    aria-label={t.visualEditAddAtGap}
                    title={t.visualEditAddAtGap}
                    onClick={() => {
                      postToIframe(iframeRef.current, 'setInsertAnchor', { index: i })
                    }}
                  >
                    +
                  </button>
                )
              })}
              {hGapUnits.map((unit, i) => {
                const point = gapHPlusPoint(unit)
                const x = iframeBox.left + point.x
                const y = iframeBox.top + point.y
                if (
                  x < iframeBox.left - 8 ||
                  x > iframeBox.left + iframeBox.width + 8 ||
                  y < iframeBox.top - 8 ||
                  y > iframeBox.top + iframeBox.height + 8
                ) {
                  return null
                }
                return (
                  <button
                    key={'h-' + i + '-' + unit.side}
                    type="button"
                    className={cn(
                      'pointer-events-auto absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-[1.5px] border-white bg-[#2563eb] text-[20px] font-bold leading-none text-white shadow opacity-90 hover:bg-[#1d4ed8] hover:opacity-100',
                      hGapActiveIndex === i && 'bg-[#1d4ed8] opacity-100'
                    )}
                    style={{ left: x, top: y }}
                    aria-label={t.visualEditAddAtSide}
                    title={t.visualEditAddAtSide}
                    onClick={() => {
                      postToIframe(iframeRef.current, 'setInsertHAnchor', { index: i })
                    }}
                  >
                    +
                  </button>
                )
              })}
            </div>,
            document.body
          )
        : null}
      <AlertDialog
        open={Boolean(chromeDupAskKind)}
        onOpenChange={(open) => {
          if (!open) handleChromeDupKeep()
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t.visualEditChromeDupAskTitle.replace(
                '{name}',
                chromeDupAskKind ? chromeWidgetLabel(chromeDupAskKind, locale) : ''
              )}
            </AlertDialogTitle>
            <AlertDialogDescription>{t.visualEditChromeDuplicate}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:justify-end">
            <Button type="button" variant="outline" onClick={handleChromeDupKeep}>
              {t.visualEditChromeDupAskKeep}
            </Button>
            <Button type="button" onClick={handleChromeDupAdd}>
              {t.visualEditChromeDupAskAdd}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

