import WalletClient from './wallet-client'
import { Metadata } from 'next'
import { buildMetadata } from '@/lib/seo'

export const metadata: Metadata = buildMetadata({
  title: 'Ví',
  description: 'Quản lý ví và số dư credits.',
  path: '/wallet',
  noIndex: true,
})

export default function WalletPage() {
  return <WalletClient />
}
