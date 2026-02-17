'use client'

import { usePathname, useRouter } from 'next/navigation'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { User, Users, ChevronDown } from 'lucide-react'

const tryOnLinks = [
  { href: '/thu-do-online/1-nguoi', label: 'Thử đồ 1 người', icon: User },
  { href: '/thu-do-online/2-nguoi', label: 'Thử đồ 2 người', icon: Users },
  { href: '/thu-do-online/3-nguoi', label: 'Thử đồ 3 người', icon: Users },
  { href: '/thu-do-online/4-nguoi', label: 'Thử đồ 4 người', icon: Users },
  { href: '/thu-do-online/5-nguoi', label: 'Thử đồ 5 người', icon: Users },
]

export function TryOnNavDropdown() {
  const pathname = usePathname()
  const router = useRouter()

  const handleChooseMode = (href: string) => {
    if (pathname === href) {
      router.push(href + '?reset=1')
    } else {
      router.push(href)
    }
  }

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-all border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 hover:scale-[1.02] outline-none data-[state=open]:ring-2 data-[state=open]:ring-primary/30">
        <span>Thử đồ / Phối đồ</span>
        <ChevronDown className="h-3 w-3 transition-transform data-[state=open]:rotate-180" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {tryOnLinks.map((item) => {
          const Icon = item.icon
          return (
            <DropdownMenuItem key={item.href} asChild>
              <div
                className="flex items-center gap-2 cursor-pointer"
                onClick={() => handleChooseMode(item.href)}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </div>
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
