import { type ReactNode } from 'react'

export default function SuaAnhTheoYeuCauLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex-1 container py-6">{children}</main>
    </div>
  )
}

