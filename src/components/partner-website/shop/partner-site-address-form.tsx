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
}

export function PartnerSiteAddressFormFields({ value, onChange, t, idPrefix }: Props) {
  function patch(part: Partial<PartnerSiteCustomerAddressInput>) {
    onChange({ ...value, ...part })
  }

  return (
    <div className="pw-shop-address-form-grid">
      <div className="pw-shop-address-form-grid-2">
        <label data-pw-el={PW_EL.label}>
          {t.addressFullName} *
          <input
            type="text"
            required
            minLength={2}
            maxLength={255}
            value={value.full_name}
            onChange={(e) => patch({ full_name: e.target.value })}
            data-pw-el={PW_EL.field}
            autoComplete="name"
          />
        </label>
        <label data-pw-el={PW_EL.label}>
          {t.addressPhone} *
          <input
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
      <label data-pw-el={PW_EL.label}>
        {t.addressProvince}
        <select
          value={value.province || ''}
          onChange={(e) => patch({ province: e.target.value })}
          data-pw-el={PW_EL.field}
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
        <label data-pw-el={PW_EL.label}>
          {t.addressDistrict}
          <input
            type="text"
            value={value.district || ''}
            onChange={(e) => patch({ district: e.target.value })}
            data-pw-el={PW_EL.field}
          />
        </label>
        <label data-pw-el={PW_EL.label}>
          {t.addressWard}
          <input
            type="text"
            value={value.ward || ''}
            onChange={(e) => patch({ ward: e.target.value })}
            data-pw-el={PW_EL.field}
          />
        </label>
      </div>
      <label data-pw-el={PW_EL.label}>
        {t.addressStreet} *
        <input
          type="text"
          required
          minLength={5}
          maxLength={500}
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
