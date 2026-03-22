import { PaymentConfigClient } from './payment-config-client'
import { getCurrentWebLocale } from '@/lib/i18n/server'

export const metadata = {
  title: 'Cấu hình nạp tiền',
  description: 'Quản trị số tài khoản nhận tiền và QR thanh toán (payment_configs).',
}

export default function AdminPaymentConfigPage() {
  const initialLocale = getCurrentWebLocale()
  return <PaymentConfigClient initialLocale={initialLocale} />
}
