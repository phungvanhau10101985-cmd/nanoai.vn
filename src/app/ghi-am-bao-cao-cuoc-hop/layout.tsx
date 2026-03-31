import { type ReactNode } from 'react'

export default function GhiAmBaoCaoCuocHopLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <main className="container flex-1 py-6">{children}</main>
    </div>
  )
}
