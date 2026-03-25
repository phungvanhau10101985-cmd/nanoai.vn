"use client"

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { LogOut, Wallet, Shield, Gift, Package } from 'lucide-react'
import { DepositCreditButton } from '@/components/deposit-credit-button'
import { DepositCreditMenuItem } from '@/components/deposit-credit-menu-item'
import { createClient } from '@/lib/supabase/client'
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
import type { Dictionary } from '@/lib/i18n/dictionaries'

interface HeaderUserMenuProps {
  user: User
  credits: number
  isAdmin?: boolean
  t: Dictionary
}

export function HeaderUserMenu({ user, credits, isAdmin, t }: HeaderUserMenuProps) {
  const [open, setOpen] = useState(false)
  const [displayCredits, setDisplayCredits] = useState<number>(Number(credits || 0))

  useEffect(() => {
    setDisplayCredits(Number(credits || 0))
  }, [credits])

  useEffect(() => {
    let mounted = true
    const supabase = createClient()
    const refreshCredits = async () => {
      const { data } = await supabase
        .from('credits')
        .select('balance')
        .eq('user_id', user.id)
        .single()
      if (!mounted) return
      const nextBalance = Number(data?.balance)
      if (Number.isFinite(nextBalance)) setDisplayCredits(nextBalance)
    }
    void refreshCredits()
    window.addEventListener('credits-updated', refreshCredits)
    return () => {
      mounted = false
      window.removeEventListener('credits-updated', refreshCredits)
    }
  }, [user.id])

  return (
    <div className="flex items-center gap-2 sm:gap-4">
      <div className="hidden sm:flex items-center gap-2 text-sm font-medium">
        <Wallet className="h-4 w-4" />
        <span>{displayCredits} {t.menu.credits}</span>
      </div>
      <DepositCreditButton variant="outline" size="sm" className="hidden sm:flex" />
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            className="relative h-10 w-10 sm:h-8 sm:w-8 rounded-full cursor-pointer min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0"
            aria-label={t.menu.accountMenu}
          >
            <Avatar className="pointer-events-none h-8 w-8">
              <AvatarImage src={user.user_metadata?.avatar_url} alt={user.email} />
              <AvatarFallback>{user.email?.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56 z-[1000]" align="end" sideOffset={8}>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">{user.user_metadata?.full_name}</p>
              <p className="text-xs leading-none text-muted-foreground">
                {user.email}
              </p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild className="sm:hidden cursor-default">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Wallet className="h-4 w-4" />
              <span>{displayCredits} {t.menu.credits}</span>
            </div>
          </DropdownMenuItem>
          <DepositCreditMenuItem />
          <DropdownMenuItem asChild>
            <Link href="/dashboard">{t.menu.dashboard}</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/dashboard/history">{t.menu.processedImages}</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/dashboard/history/translate">{t.menu.translateHistory}</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/nhac-nen-ai#music-history">{t.menu.musicHistory}</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/wallet">{t.menu.wallet}</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/account/plan" className="flex items-center gap-2">
              <Package className="h-4 w-4" aria-hidden />
              {t.menu.viewPlan}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/invite" className="flex items-center gap-2">
              <Gift className="h-4 w-4" />
              {t.menu.inviteFriends}
            </Link>
          </DropdownMenuItem>
          {isAdmin && (
            <DropdownMenuItem asChild>
              <Link href="/admin" className="flex items-center gap-2 font-medium text-primary">
                <Shield className="h-4 w-4" />
                <span>{t.menu.admin}</span>
              </Link>
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          {user.email === 'dev@local.test' && (
            <DropdownMenuItem asChild>
              <Link href="/auth/force-login" className="flex w-full items-center cursor-pointer text-amber-600 font-medium">
                <LogOut className="mr-2 h-4 w-4" />
                <span>{t.menu.switchToRealAccount}</span>
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
                <span>{user.email === 'dev@local.test' ? t.menu.exitDevMode : t.menu.signOut}</span>
              </button>
            </form>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
