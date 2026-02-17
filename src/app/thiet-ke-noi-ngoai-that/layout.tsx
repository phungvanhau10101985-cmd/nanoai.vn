import { type ReactNode } from 'react'

export default function ThietKeNoiNgoaiThatLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden container py-6 mobile-nav-scroll">{children}</main>
    </div>
  )
}
