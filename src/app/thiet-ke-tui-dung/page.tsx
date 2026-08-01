import { redirect } from 'next/navigation'
import { hubStudioLaunchHref } from '@/lib/hub-chat/hub-studio-launch'

export default function LegacyBagPackagingRedirectPage() {
  redirect(hubStudioLaunchHref('bag_kit'))
}
