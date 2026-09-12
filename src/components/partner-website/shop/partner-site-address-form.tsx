'use client'

import type { PartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import type { PartnerSiteCustomerAddressInput } from '@/lib/partner-website/shop/partner-site-customer-address'
import { VIETNAM_PROVINCES } from '@/lib/partner-website/shop/vietnam-provinces'
import { PW_EL } from '@/lib/partner-website/visual-editor/pw-ui-contract'

type Props = {
  value: PartnerSiteCustomerAddressInput
  onChange: (next: PartnerSiteCustomerAddressInput) => void
  t: PartnerSiteShopCopy
  idPrefix: string
  autoFocus?: boolean
}

export function PartnerSiteAddressFormFields({ value, onChange, t, idPrefix, autoFocus }: Props) {
  function patch(part: Partial<PartnerSiteCustomerAddressInput>) {
    onChange({ ...value, ...part })
  }

  return (
    <div className="pw-shop-address-form-grid">
      <div className="pw-shop-address-form-grid-2">
        <label data-pw-el={PW_EL.label} htmlFor={`${idPrefix}-full-name`}>
          {t.addressFullName} *
          <input
            id={`${idPrefix}-full-name`}
            type="text"
            required
            minLength={2}
            maxLength={255}
            value={value.full_name}
            onChange={(e) => patch({ full_name: e.target.value })}
            data-pw-el={PW_EL.field}
            autoComplete="name"
            autoFocus={autoFocus}
          />
        </label>
        <label data-pw-el={PW_EL.label} htmlFor={`${idPrefix}-phone`}>
          {t.addressPhone} *
          <input
            id={`${idPrefix}-phone`}
            type="tel"
            required
            minLength={10}
            maxLength={20}
            value={value.phone}
            onChange={(e) => patch({ phone: e.target.value })}
            data-pw-el={PW_EL.field}
            autoComplete="tel"
          />
        </label>
      </div>
      <label data-pw-el={PW_EL.label} htmlFor={`${idPrefix}-province`}>
        {t.addressProvince}
        <select
          id={`${idPrefix}-province`}
          value={value.province || ''}
          onChange={(e) => patch({ province: e.target.value })}
          data-pw-el={PW_EL.field}
          autoComplete="address-level1"
        >
          <option value="">{t.addressProvincePlaceholder}</option>
          {VIETNAM_PROVINCES.map((province) => (
            <option key={province} value={province}>
              {province}
            </option>
          ))}
        </select>
      </label>
      <div className="pw-shop-address-form-grid-2">
        <label data-pw-el={PW_EL.label} htmlFor={`${idPrefix}-district`}>
          {t.addressDistrict}
          <input
            id={`${idPrefix}-district`}
            type="text"
            value={value.district || ''}
            onChange={(e) => patch({ district: e.target.value })}
            data-pw-el={PW_EL.field}
            autoComplete="address-level2"
          />
        </label>
        <label data-pw-el={PW_EL.label} htmlFor={`${idPrefix}-ward`}>
          {t.addressWard}
          <input
            id={`${idPrefix}-ward`}
            type="text"
            value={value.ward || ''}
            onChange={(e) => patch({ ward: e.target.value })}
            data-pw-el={PW_EL.field}
            autoComplete="address-level3"
          />
        </label>
      </div>
      <label data-pw-el={PW_EL.label} htmlFor={`${idPrefix}-street`}>
        {t.addressStreet} *
        <textarea
          id={`${idPrefix}-street`}
          required
          minLength={5}
          maxLength={500}
          rows={3}
          value={value.street_address}
          onChange={(e) => patch({ street_address: e.target.value })}
          placeholder={t.addressStreetPlaceholder}
          data-pw-el={PW_EL.field}
          autoComplete="street-address"
        />
      </label>
      <label className="pw-shop-address-default-check" htmlFor={`${idPrefix}-default`}>
        <input
          id={`${idPrefix}-default`}
          type="checkbox"
          checked={value.is_default === true}
          onChange={(e) => patch({ is_default: e.target.checked })}
        />
        {t.addressMakeDefault}
      </label>
    </div>
  )
}
