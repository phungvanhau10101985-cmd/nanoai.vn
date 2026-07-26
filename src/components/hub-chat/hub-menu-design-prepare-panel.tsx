'use client'

import { useRef } from 'react'
import { ImagePlus, Loader2, Plus, Trash2, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { WebLocale } from '@/lib/i18n/config'
import type { MenuDishItem } from '@/lib/hub-chat/menu-dish-items'
import { HubMenuFormatPicker, type MenuFormatPresetId } from '@/components/hub-chat/hub-menu-format-picker'

const COPY: Record<
  WebLocale,
  {
    title: string
    intro: string
    venueLabel: string
    venueHint: string
    venuePlaceholder: string
    logoLabel: string
    logoHint: string
    logoUploadBtn: string
    logoRemoveBtn: string
    dishesTitle: string
    dishesHint: string
    colOrder: string
    colName: string
    colUnit: string
    colPrice: string
    addDish: string
    removeDish: string
    orderPlaceholder: string
    namePlaceholder: string
    unitPlaceholder: string
    pricePlaceholder: string
    productUploadLabel: string
    productUploadBtn: string
    finishFlow: string
    savedCount: string
    photoCount: string
  }
> = {
  vi: {
    title: 'Thiết kế menu',
    intro:
      'Nhập tên quán/thương hiệu, tải logo (khuyến nghị), chọn kiểu menu, thêm danh sách món — rồi bấm «Tạo menu».',
    venueLabel: 'Tên quán / thương hiệu',
    venueHint: 'Hiển thị nổi bật trên đầu menu — có thể sửa lại so với brief trước đó.',
    venuePlaceholder: 'vd: Phở Bò Hà Nội, Cafe Sáng',
    logoLabel: 'Logo thương hiệu (ghép vào menu)',
    logoHint: 'Tải file logo PNG/JPG — AI sẽ ghép đúng logo của bạn lên menu.',
    logoUploadBtn: 'Tải logo',
    logoRemoveBtn: 'Xóa logo',
    dishesTitle: 'Danh sách món',
    dishesHint: 'Thêm từng món — số thứ tự, tên món, đơn vị (tô, ly, phần…), đơn giá VND.',
    colOrder: 'STT',
    colName: 'Tên món',
    colUnit: 'Đơn vị',
    colPrice: 'Giá (VND)',
    addDish: 'Thêm món',
    removeDish: 'Xóa',
    orderPlaceholder: '1',
    namePlaceholder: 'Phở bò tái',
    unitPlaceholder: 'tô',
    pricePlaceholder: '65000',
    productUploadLabel: 'Ảnh món tham khảo (tùy chọn)',
    productUploadBtn: 'Tải ảnh món',
    finishFlow: 'Hoàn tất quy trình',
    savedCount: 'Đã lưu {n} menu',
    photoCount: '{n} ảnh',
  },
  en: {
    title: 'Design menu',
    intro:
      'Enter venue/brand name, upload logo (recommended), pick menu format, add dishes — then tap «Generate menu».',
    venueLabel: 'Venue / brand name',
    venueHint: 'Shown prominently at the menu header — you can adjust from the earlier brief.',
    venuePlaceholder: 'e.g. Hanoi Beef Pho, Morning Café',
    logoLabel: 'Brand logo (composite on menu)',
    logoHint: 'Upload PNG/JPG logo — AI will embed your exact logo on the menu.',
    logoUploadBtn: 'Upload logo',
    logoRemoveBtn: 'Remove logo',
    dishesTitle: 'Dish list',
    dishesHint: 'Add each dish — order no., name, unit (bowl, cup, portion…), price in VND.',
    colOrder: 'No.',
    colName: 'Dish name',
    colUnit: 'Unit',
    colPrice: 'Price (VND)',
    addDish: 'Add dish',
    removeDish: 'Remove',
    orderPlaceholder: '1',
    namePlaceholder: 'Beef pho',
    unitPlaceholder: 'bowl',
    pricePlaceholder: '65000',
    productUploadLabel: 'Reference dish photos (optional)',
    productUploadBtn: 'Upload dish photos',
    finishFlow: 'Finish flow',
    savedCount: '{n} menu(s) saved',
    photoCount: '{n} photo(s)',
  },
  zh: {
    title: '设计菜单',
    intro: '填写店名/品牌、上传 logo（推荐）、选择版式、添加菜品 — 然后点击「生成菜单」。',
    venueLabel: '店名 / 品牌名',
    venueHint: '显示在菜单顶部 — 可在此修改先前 brief 中的名称。',
    venuePlaceholder: '例如：河内牛肉粉、晨光咖啡',
    logoLabel: '品牌 Logo（合成到菜单）',
    logoHint: '上传 PNG/JPG logo — AI 会将您的 logo 嵌入菜单。',
    logoUploadBtn: '上传 Logo',
    logoRemoveBtn: '删除 Logo',
    dishesTitle: '菜品列表',
    dishesHint: '逐条添加 — 序号、菜名、单位（碗、杯、份…）、越南盾单价。',
    colOrder: '序号',
    colName: '菜名',
    colUnit: '单位',
    colPrice: '价格 (VND)',
    addDish: '添加菜品',
    removeDish: '删除',
    orderPlaceholder: '1',
    namePlaceholder: '牛肉河粉',
    unitPlaceholder: '碗',
    pricePlaceholder: '65000',
    productUploadLabel: '菜品参考图（可选）',
    productUploadBtn: '上传菜品图',
    finishFlow: '完成流程',
    savedCount: '已保存 {n} 个菜单',
    photoCount: '{n} 张图',
  },
  ja: {
    title: 'メニューデザイン',
    intro:
      '店名/ブランド名を入力、ロゴをアップロード（推奨）、形式選択、料理追加 — 「メニュー生成」を押してください。',
    venueLabel: '店名 / ブランド名',
    venueHint: 'メニュー上部に大きく表示 — 前の brief から変更できます。',
    venuePlaceholder: '例：ハノイ牛肉フォー、モーニングカフェ',
    logoLabel: 'ブランドロゴ（メニューに合成）',
    logoHint: 'PNG/JPG ロゴをアップロード — AI がそのロゴをメニューに埋め込みます。',
    logoUploadBtn: 'ロゴをアップロード',
    logoRemoveBtn: 'ロゴを削除',
    dishesTitle: '料理リスト',
    dishesHint: '料理を追加 — 番号、名称、単位（杯、皿、人前…）、VND価格。',
    colOrder: 'No.',
    colName: '料理名',
    colUnit: '単位',
    colPrice: '価格 (VND)',
    addDish: '料理を追加',
    removeDish: '削除',
    orderPlaceholder: '1',
    namePlaceholder: '牛肉フォー',
    unitPlaceholder: '杯',
    pricePlaceholder: '65000',
    productUploadLabel: '料理参考写真（任意）',
    productUploadBtn: '料理写真をアップロード',
    finishFlow: 'フローを完了',
    savedCount: 'メニュー {n} 件保存済み',
    photoCount: '{n} 枚',
  },
  ko: {
    title: '메뉴 디자인',
    intro:
      '매장/브랜드명 입력, 로고 업로드(권장), 메뉴 형식 선택, 메뉴 추가 — «메뉴 생성»을 누르세요.',
    venueLabel: '매장 / 브랜드명',
    venueHint: '메뉴 상단에 크게 표시 — 이전 brief에서 수정 가능.',
    venuePlaceholder: '예: 하노이 쇠고기 쌀국수, 모닝 카페',
    logoLabel: '브랜드 로고(메뉴에 합성)',
    logoHint: 'PNG/JPG 로고 업로드 — AI가 메뉴에 로고를 그대로 합성합니다.',
    logoUploadBtn: '로고 업로드',
    logoRemoveBtn: '로고 삭제',
    dishesTitle: '메뉴 목록',
    dishesHint: '항목 추가 — 번호, 메뉴명, 단위(그릇, 잔, 인분…), VND 가격.',
    colOrder: '번호',
    colName: '메뉴명',
    colUnit: '단위',
    colPrice: '가격 (VND)',
    addDish: '메뉴 추가',
    removeDish: '삭제',
    orderPlaceholder: '1',
    namePlaceholder: '쇠고기 쌀국수',
    unitPlaceholder: '그릇',
    pricePlaceholder: '65000',
    productUploadLabel: '메뉴 참고 사진(선택)',
    productUploadBtn: '메뉴 사진 업로드',
    finishFlow: '플로우 완료',
    savedCount: '메뉴 {n}개 저장됨',
    photoCount: '{n}장',
  },
}

export function HubMenuDesignPreparePanel({
  locale,
  selectedFormatId,
  venueName,
  logoUrl,
  dishes,
  uploadImages,
  approvedMenuCount,
  busy,
  onSelectFormat,
  onVenueNameChange,
  onVenueNameCommit,
  onUploadLogo,
  onRemoveLogo,
  onDishesChange,
  onDishesCommit,
  onUploadProductFiles,
  onFinishFlow,
}: {
  locale: WebLocale
  selectedFormatId: MenuFormatPresetId | ''
  venueName: string
  logoUrl?: string | null
  dishes: MenuDishItem[]
  uploadImages: string[]
  approvedMenuCount: number
  busy: boolean
  onSelectFormat: (presetId: MenuFormatPresetId) => void | Promise<void>
  onVenueNameChange: (text: string) => void
  onVenueNameCommit?: (text: string) => void | Promise<void>
  onUploadLogo: (files: FileList) => void | Promise<void>
  onRemoveLogo: () => void | Promise<void>
  onDishesChange: (dishes: MenuDishItem[]) => void
  onDishesCommit?: (dishes: MenuDishItem[]) => void | Promise<void>
  onUploadProductFiles: (files: FileList) => void | Promise<void>
  onFinishFlow: () => void | Promise<void>
}) {
  const t = COPY[locale]
  const logoFileRef = useRef<HTMLInputElement>(null)

  const updateDish = (id: string, patch: Partial<MenuDishItem>) => {
    const next = dishes.map((d) => (d.id === id ? { ...d, ...patch } : d))
    onDishesChange(next)
  }

  const addDish = () => {
    const nextOrder = String(dishes.length + 1)
    onDishesChange([
      ...dishes,
      { id: `dish-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`, order: nextOrder, name: '', unit: '', priceVnd: '' },
    ])
  }

  const removeDish = (id: string) => {
    const next = dishes.filter((d) => d.id !== id)
    onDishesChange(next.length ? next : [{ id: `dish-${Date.now()}`, order: '1', name: '', unit: '', priceVnd: '' }])
    void onDishesCommit?.(next)
  }

  const rows = dishes.length
    ? dishes
    : [{ id: 'dish-default', order: '1', name: '', unit: '', priceVnd: '' }]

  return (
    <div className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 dark:border-emerald-800 dark:bg-emerald-950/20">
      <div>
        <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">{t.title}</p>
        <p className="mt-1 text-xs text-emerald-800/80 dark:text-emerald-200/80">{t.intro}</p>
        {approvedMenuCount > 0 ? (
          <p className="mt-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
            {t.savedCount.replace('{n}', String(approvedMenuCount))}
          </p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-emerald-900 dark:text-emerald-100">{t.venueLabel}</label>
        <p className="text-[11px] text-emerald-800/70 dark:text-emerald-200/70">{t.venueHint}</p>
        <Input
          value={venueName}
          onChange={(e) => onVenueNameChange(e.target.value)}
          onBlur={(e) => void onVenueNameCommit?.(e.target.value)}
          placeholder={t.venuePlaceholder}
          className="h-9 text-sm"
          disabled={busy}
        />
      </div>

      <div className="space-y-2 rounded-md border border-violet-200 bg-violet-50/60 p-2.5 dark:border-violet-800 dark:bg-violet-950/20">
        <p className="text-xs font-semibold text-violet-900 dark:text-violet-100">{t.logoLabel}</p>
        <p className="text-[11px] text-violet-800/80 dark:text-violet-200/80">{t.logoHint}</p>
        {logoUrl ? (
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- user upload preview */}
            <img
              src={logoUrl}
              alt=""
              className="h-16 w-16 rounded-md border border-violet-200 bg-white object-contain p-1 dark:border-violet-700"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 gap-1 text-xs"
              disabled={busy}
              onClick={() => void onRemoveLogo()}
            >
              <X className="h-3.5 w-3.5" />
              {t.logoRemoveBtn}
            </Button>
          </div>
        ) : null}
        <input
          ref={logoFileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) void onUploadLogo(e.target.files)
            e.target.value = ''
          }}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 gap-1 border-violet-300 text-xs"
          disabled={busy}
          onClick={() => logoFileRef.current?.click()}
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
          {t.logoUploadBtn}
        </Button>
      </div>

      <HubMenuFormatPicker
        locale={locale}
        selectedPresetId={selectedFormatId}
        busy={busy}
        onSelectPreset={onSelectFormat}
      />

      <div className="space-y-2">
        <div>
          <p className="text-xs font-semibold text-emerald-900 dark:text-emerald-100">{t.dishesTitle}</p>
          <p className="text-[11px] text-emerald-800/70 dark:text-emerald-200/70">{t.dishesHint}</p>
        </div>
        <div className="hidden gap-1.5 px-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800/80 sm:grid sm:grid-cols-[3rem_1fr_5rem_6rem_2rem] dark:text-emerald-200/80">
          <span>{t.colOrder}</span>
          <span>{t.colName}</span>
          <span>{t.colUnit}</span>
          <span>{t.colPrice}</span>
          <span className="sr-only">{t.removeDish}</span>
        </div>
        <div className="space-y-2">
          {rows.map((dish) => (
            <div
              key={dish.id}
              className="grid grid-cols-1 gap-1.5 rounded-md border border-emerald-100 bg-white/70 p-2 sm:grid-cols-[3rem_1fr_5rem_6rem_2rem] dark:border-emerald-900 dark:bg-emerald-950/30"
            >
              <Input
                value={dish.order}
                onChange={(e) => updateDish(dish.id, { order: e.target.value })}
                onBlur={() => void onDishesCommit?.(dishes)}
                placeholder={t.orderPlaceholder}
                disabled={busy}
                className="h-8 text-xs"
                aria-label={t.colOrder}
              />
              <Input
                value={dish.name}
                onChange={(e) => updateDish(dish.id, { name: e.target.value })}
                onBlur={() => void onDishesCommit?.(dishes)}
                placeholder={t.namePlaceholder}
                disabled={busy}
                className="h-8 text-xs"
                aria-label={t.colName}
              />
              <Input
                value={dish.unit}
                onChange={(e) => updateDish(dish.id, { unit: e.target.value })}
                onBlur={() => void onDishesCommit?.(dishes)}
                placeholder={t.unitPlaceholder}
                disabled={busy}
                className="h-8 text-xs"
                aria-label={t.colUnit}
              />
              <Input
                value={dish.priceVnd}
                onChange={(e) => updateDish(dish.id, { priceVnd: e.target.value })}
                onBlur={() => void onDishesCommit?.(dishes)}
                placeholder={t.pricePlaceholder}
                disabled={busy}
                className="h-8 text-xs"
                inputMode="numeric"
                aria-label={t.colPrice}
              />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-8 w-8 shrink-0 text-emerald-800 hover:bg-emerald-100 hover:text-red-700 dark:text-emerald-200"
                disabled={busy || rows.length <= 1}
                aria-label={t.removeDish}
                onClick={() => removeDish(dish.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 gap-1 border-emerald-300 text-xs text-emerald-900 hover:bg-emerald-100 dark:border-emerald-700 dark:text-emerald-100"
          disabled={busy}
          onClick={addDish}
        >
          <Plus className="h-3.5 w-3.5" />
          {t.addDish}
        </Button>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-emerald-900 dark:text-emerald-100">{t.productUploadLabel}</label>
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            disabled={busy}
            onChange={(e) => {
              const files = e.target.files
              if (files?.length) void onUploadProductFiles(files)
              e.target.value = ''
            }}
          />
          <Button type="button" size="sm" variant="outline" className="h-8 gap-1 text-xs" disabled={busy} asChild>
            <span>
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
              {t.productUploadBtn}
            </span>
          </Button>
          {uploadImages.length > 0 ? (
            <span className="text-[11px] text-emerald-700 dark:text-emerald-300">
              {t.photoCount.replace('{n}', String(uploadImages.length))}
            </span>
          ) : null}
        </label>
      </div>

      {approvedMenuCount > 0 ? (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="h-8 text-xs"
          disabled={busy}
          onClick={() => void onFinishFlow()}
        >
          {t.finishFlow}
        </Button>
      ) : null}
    </div>
  )
}
