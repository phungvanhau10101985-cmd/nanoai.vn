import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { EditCreditDialog } from './edit-credit-dialog'
import { Toaster } from '@/components/ui/sonner'
import { getCurrentWebLocale } from '@/lib/i18n/server'
import { pgListProfilesWithCreditBalance } from '@/lib/db/admin-users-pg'

export default async function AdminUsersPage() {
  const uiLocale = getCurrentWebLocale()
  const dateLocale = uiLocale === 'vi' ? 'vi-VN' : uiLocale === 'en' ? 'en-US' : uiLocale === 'zh' ? 'zh-CN' : uiLocale === 'ja' ? 'ja-JP' : 'ko-KR'
  const tr = (vi: string, en: string, zh: string, ja: string, ko: string) => {
    if (uiLocale === 'en') return en
    if (uiLocale === 'zh') return zh
    if (uiLocale === 'ja') return ja
    if (uiLocale === 'ko') return ko
    return vi
  }
  const formatCreatedAt = (value?: string | null) => {
    if (!value) return '—'
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return '—'
    return new Intl.DateTimeFormat(dateLocale, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d)
  }
  const { rows: usersRaw, error: usersError } = await pgListProfilesWithCreditBalance()
  if (usersError) {
    console.error('Error fetching users:', usersError)
  }

  const users =
    usersRaw?.map((u) => ({
      ...u,
      email: 'N/A' as const,
      balance: u.balance ?? 0,
    })) ?? []

  return (
    <div className="space-y-8">
      <Toaster />
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">{tr('Quản lý thành viên', 'User management', '用户管理', 'ユーザー管理', '사용자 관리')}</h2>
      </div>
      <Card>
        <CardContent className="mt-6">
          {usersError ? (
            <p className="mb-4 text-sm text-destructive" role="alert">
              {usersError}
            </p>
          ) : null}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{tr('Thành viên', 'Member', '成员', 'メンバー', '회원')}</TableHead>
                <TableHead>{tr('Vai trò', 'Role', '角色', '役割', '역할')}</TableHead>
                <TableHead>{tr('Ngày tạo tài khoản', 'Created at', '创建时间', '作成日時', '생성일시')}</TableHead>
                <TableHead className="text-right">{tr('Số dư tín dụng', 'Credit balance', '积分余额', 'クレジット残高', '크레딧 잔액')}</TableHead>
                <TableHead className="text-right">{tr('Hành động', 'Action', '操作', '操作', '작업')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user: { id: string; full_name?: string | null; avatar_url?: string | null; role?: string | null; email?: string; balance?: number; created_at?: string | null }) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-4">
                      <Avatar>
                        <AvatarImage src={user.avatar_url || ''} />
                        <AvatarFallback>{user.full_name?.[0] || 'U'}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{user.full_name}</p>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                      {user.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatCreatedAt(user.created_at)}</TableCell>
                  <TableCell className="text-right font-medium">{user.balance}</TableCell>
                  <TableCell className="text-right">
                    <EditCreditDialog userId={user.id} currentBalance={user.balance ?? 0} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
