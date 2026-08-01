"use client"

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  LogOut,
  Wallet,
  Shield,
  Gift,
  Package,
  ListTodo,
  Headphones,
  MessageSquare,
  MessagesSquare,
  KeyRound,
  ShoppingBag,
  Smartphone,
  LayoutDashboard,
  ImageIcon,
  Languages,
  Music2,
  Sparkles,
  Globe,
} from 'lucide-react'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { AppUser } from '@/lib/auth/app-user'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import { fireMetaStandardEvent } from '@/lib/tracking/meta-standard-events-client'

interface HeaderUserMenuProps {
  user: AppUser
  credits: number
  isAdmin?: boolean
  t: Dictionary
}

export function HeaderUserMenu({ user, credits, isAdmin, t }: HeaderUserMenuProps) {
  const [open, setOpen] = useState(false)
  const [downloadDialogOpen, setDownloadDialogOpen] = useState(false)
  const [displayCredits, setDisplayCredits] = useState<number>(Number(credits || 0))
  const [isGuestTrial, setIsGuestTrial] = useState<boolean>(String(user.email ?? '').includes('@guest.nanoai.local'))
  const [guestTrialRemaining, setGuestTrialRemaining] = useState<number>(0)
  const [guestTrialBudget, setGuestTrialBudget] = useState<number>(3)
  const [trialForcedLogout, setTrialForcedLogout] = useState(false)

  const creditLabel = isGuestTrial
    ? `Dùng thử ${guestTrialRemaining.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}/${guestTrialBudget.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} credits`
    : `${displayCredits} ${t.menu.credits}`
  const showFullAccountMenu = !isGuestTrial

  useEffect(() => {
    setDisplayCredits(Number(credits || 0))
  }, [credits])

  useEffect(() => {
    let mounted = true
    const refreshCredits = async () => {
      const res = await fetch('/api/account/credits', { credentials: 'same-origin' })
      if (!res.ok) {
        if (isGuestTrial && !trialForcedLogout) {
          setTrialForcedLogout(true)
          window.location.reload()
        }
        return
      }
      const j = (await res.json()) as {
        balance?: unknown
        isGuestTrial?: unknown
        guestTrialRemaining?: unknown
        guestTrialBudget?: unknown
      }
      if (!mounted) return
      setIsGuestTrial(Boolean(j.isGuestTrial))
      const nextTrialRemaining = Number(j.guestTrialRemaining)
      if (Number.isFinite(nextTrialRemaining)) setGuestTrialRemaining(Math.max(0, nextTrialRemaining))
      const nextTrialBudget = Number(j.guestTrialBudget)
      if (Number.isFinite(nextTrialBudget) && nextTrialBudget > 0) setGuestTrialBudget(nextTrialBudget)
      if (
        Boolean(j.isGuestTrial) &&
        Number.isFinite(nextTrialRemaining) &&
        Number.isFinite(nextTrialBudget) &&
        nextTrialBudget > 0 &&
        nextTrialRemaining < nextTrialBudget
      ) {
        fireMetaStandardEvent('StartTrial', { dedupeKey: 'guest_trial_first_use' })
      }
      const nextBalance = Number(j.balance)
      if (Number.isFinite(nextBalance)) setDisplayCredits(nextBalance)
    }
    void refreshCredits()
    window.addEventListener('credits-updated', refreshCredits)
    return () => {
      mounted = false
      window.removeEventListener('credits-updated', refreshCredits)
    }
  }, [user.id, isGuestTrial, trialForcedLogout])

  return (
    <div className="flex items-center gap-2 sm:gap-4">
      <div className="hidden sm:flex items-center gap-2 text-sm font-medium">
        <Wallet className="h-4 w-4" />
        <span>{creditLabel}</span>
      </div>
      {showFullAccountMenu && (
        <DepositCreditButton variant="outline" size="sm" className="hidden sm:flex" />
      )}
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            className="relative h-10 w-10 sm:h-8 sm:w-8 rounded-full cursor-pointer min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0"
            aria-label={t.menu.accountMenu}
          >
            <Avatar className="pointer-events-none h-8 w-8">
              <AvatarImage
                src={typeof user.user_metadata?.avatar_url === 'string' ? user.user_metadata.avatar_url : undefined}
                alt={user.email ?? ''}
              />
              <AvatarFallback>{(user.email ?? '?').charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          className="z-[1000] max-h-[calc(100vh-5rem)] w-64 overflow-y-auto p-1.5"
          align="end"
          sideOffset={8}
          onInteractOutside={(e) => {
            const t = e.target
            if (t instanceof Element && t.closest('[data-nanoai-widget-root]')) {
              e.preventDefault()
            }
          }}
        >
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">
                {typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : ''}
              </p>
              <p className="text-xs leading-none text-muted-foreground">
                {user.email}
              </p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild className="sm:hidden cursor-default">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Wallet className="h-4 w-4" />
              <span>{creditLabel}</span>
            </div>
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer"
            onSelect={() => setDownloadDialogOpen(true)}
          >
            <span className="flex items-center gap-2">
              <Smartphone className="h-4 w-4" aria-hidden />
              {t.menu.downloadApp}
            </span>
          </DropdownMenuItem>
          {showFullAccountMenu && (
            <>
              <DepositCreditMenuItem />
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {t.menu.personalSection}
              </DropdownMenuLabel>
              <DropdownMenuItem asChild>
                <Link href="/dashboard" className="flex items-center gap-2">
                  <LayoutDashboard className="h-4 w-4" aria-hidden />
                  {t.menu.dashboard}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/dashboard/tasks" className="flex items-center gap-2">
                  <ListTodo className="h-4 w-4" aria-hidden />
                  {t.menu.tasksHub}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/wallet" className="flex items-center gap-2">
                  <Wallet className="h-4 w-4" aria-hidden />
                  {t.menu.wallet}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/account/plan" className="flex items-center gap-2">
                  <Package className="h-4 w-4" aria-hidden />
                  {t.menu.viewPlan}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/invite" className="flex items-center gap-2">
                  <Gift className="h-4 w-4" aria-hidden />
                  {t.menu.inviteFriends}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {t.menu.messagesSection}
              </DropdownMenuLabel>
              <DropdownMenuItem asChild>
                <Link href="/support-chat" className="flex items-center gap-2">
                  <Headphones className="h-4 w-4 text-sky-600" aria-hidden />
                  {t.menu.supportChat}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/messaging/my-chats" className="flex items-center gap-2">
                  <MessagesSquare className="h-4 w-4 text-violet-600" aria-hidden />
                  {t.menu.myChats}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/messaging/my-orders" className="flex items-center gap-2">
                  <ShoppingBag className="h-4 w-4" aria-hidden />
                  {t.menu.myOrders}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {t.menu.businessSection}
              </DropdownMenuLabel>
              <DropdownMenuItem asChild>
                <Link href="/dashboard/messaging" className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" aria-hidden />
                  {t.menu.partnerInbox}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/dashboard/messaging/website" className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-violet-600" aria-hidden />
                  {t.menu.messagingWebsite}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/dashboard/api-integration" className="flex items-center gap-2">
                  <KeyRound className="h-4 w-4" aria-hidden />
                  {t.menu.partnerApiIntegration}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/dashboard/customer-api-keys" className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4" aria-hidden />
                  {t.menu.customerApiKeys}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {t.menu.historySection}
              </DropdownMenuLabel>
              <DropdownMenuItem asChild>
                <Link href="/dashboard/history" className="flex items-center gap-2">
                  <ImageIcon className="h-4 w-4" aria-hidden />
                  {t.menu.processedImages}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/dashboard/history/translate" className="flex items-center gap-2">
                  <Languages className="h-4 w-4" aria-hidden />
                  {t.menu.translateHistory}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/tao-bai-hat-lyria-3#lyria3-saved-music" className="flex items-center gap-2">
                  <Music2 className="h-4 w-4" aria-hidden />
                  {t.menu.musicHistory}
                </Link>
              </DropdownMenuItem>
            </>
          )}
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

      <Dialog open={downloadDialogOpen} onOpenChange={setDownloadDialogOpen}>
        <DialogContent className="z-[1100] max-w-md" overlayClassName="z-[1090]">
          <DialogHeader>
            <DialogTitle>{t.menu.downloadApp}</DialogTitle>
            <DialogDescription>{t.menu.downloadAppSubtitle}</DialogDescription>
          </DialogHeader>
          <div className="space-y-5 text-sm">
            <div className="rounded-xl border bg-muted/30 p-4 space-y-2">
              <p className="font-medium text-foreground">{t.menu.downloadAndroidTitle}</p>
              <p className="text-xs text-muted-foreground">{t.menu.downloadAndroidChromeHint}</p>
              <ol className="list-decimal space-y-2 pl-5 text-muted-foreground leading-relaxed">
                <li>{t.menu.downloadAndroidStep1}</li>
                <li>{t.menu.downloadAndroidStep2}</li>
                <li>{t.menu.downloadAndroidStep3}</li>
              </ol>
            </div>
            <div className="rounded-xl border bg-muted/30 p-4 space-y-2">
              <p className="font-medium text-foreground">{t.menu.downloadIosTitle}</p>
              <p className="text-xs text-muted-foreground">{t.menu.downloadIosSafariHint}</p>
              <ol className="list-decimal space-y-2 pl-5 text-muted-foreground leading-relaxed">
                <li>{t.menu.downloadIosStep1}</li>
                <li>{t.menu.downloadIosStep2}</li>
                <li>{t.menu.downloadIosStep3}</li>
              </ol>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
