import { buildMetadata } from '@/lib/seo'
import { ApiKeysHub } from '@/components/integration/api-keys-hub'
import { resolveApiKeysHubBaseUrl } from '@/lib/integration/api-keys-hub-copy'

export const metadata = buildMetadata({
  title: 'Khóa API — vận hành NanoAI',
  description: 'Cron, webhook nội bộ và tham chiếu đầy đủ. Đối tác xem Bảng điều khiển → Hướng dẫn tích hợp API.',
  path: '/admin/api-keys',
  noIndex: true,
})

export default function AdminApiKeysPage() {
  const baseUrl = resolveApiKeysHubBaseUrl()
  return <ApiKeysHub variant="operator" baseUrl={baseUrl} />
}
