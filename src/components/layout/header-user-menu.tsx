"use client"

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { LogOut, Wallet } from 'lucide-react'
import { DepositCreditButton } from '@/components/deposit-credit-button'
import { DepositCreditMenuItem } from '@/components/deposit-credit-menu-item'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import type { User } from '@supabase/supabase-js'

interface HeaderUserMenuProps {
  user: User
  credits: number
}

export function HeaderUserMenu({ user, credits }: HeaderUserMenuProps) {
  return (
    <div className="flex items-center gap-2 sm:gap-4">
      <div className="hidden sm:flex items-center gap-2 text-sm font-medium">
        <Wallet className="h-4 w-4" />
        <span>{credits} Tín dụng</span>
      </div>
      <DepositCreditButton variant="outline" size="sm" className="hidden sm:flex" />
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            className="relative h-10 w-10 sm:h-8 sm:w-8 rounded-full cursor-pointer min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0"
          >
            <Avatar className="h-8 w-8">
              <AvatarImage src={user.user_metadata?.avatar_url} alt={user.email} />
              <AvatarFallback>{user.email?.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56 z-[100]" align="end" forceMount>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">{user.user_metadata?.full_name}</p>
              <p className="text-xs leading-none text-muted-foreground">
                {user.email}
              </p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild className="sm:hidden">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Wallet className="h-4 w-4" />
              <span>{credits} Tín dụng</span>
            </div>
          </DropdownMenuItem>
          <DepositCreditMenuItem />
          <DropdownMenuItem asChild>
            <Link href="/dashboard">Bảng điều khiển</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/dashboard/history">Ảnh đã xử lý</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/dashboard/history/translate">Lịch sử dịch ảnh</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/wallet">Ví</Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {user.email === 'dev@local.test' && (
            <DropdownMenuItem asChild>
              <Link href="/auth/force-login" className="flex w-full items-center cursor-pointer text-amber-600 font-medium">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Đăng nhập tài khoản thật</span>
              </Link>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem asChild>
            <form action="/auth/signout" method="post" className="w-full">
              <button
                type="submit"
                className="flex w-full items-center cursor-pointer"
              >
                <LogOut className="mr-2 h-4 w-4" />
                <span>{user.email === 'dev@local.test' ? 'Thoát chế độ dev' : 'Đăng xuất'}</span>
              </button>
            </form>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
