import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { EditCreditDialog } from './edit-credit-dialog'
import { Toaster } from '@/components/ui/sonner'

export default async function AdminUsersPage() {
  const supabase = createClient()

  const { data: usersData, error } = await supabase
    .from('profiles')
    .select(`
      id,
      full_name,
      email:users(email),
      avatar_url,
      role,
      credits(balance)
    `)

  if (error) {
    console.error('Error fetching users:', error)
    // Handle error appropriately
  }

  // The query returns credits as an array, so we need to flatten it
  const users = usersData?.map(u => ({
    ...u,
    // @ts-ignore
    email: u.email.email,
    // @ts-ignore
    balance: u.credits[0]?.balance ?? 0
  })) || []

  return (
    <div className="space-y-8">
      <Toaster />
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Quản lý thành viên</h2>
      </div>
      <Card>
        <CardContent className="mt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Thành viên</TableHead>
                <TableHead>Vai trò</TableHead>
                <TableHead className="text-right">Số dư tín dụng</TableHead>
                <TableHead className="text-right">Hành động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
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
                  <TableCell className="text-right font-medium">{user.balance}</TableCell>
                  <TableCell className="text-right">
                    <EditCreditDialog userId={user.id} currentBalance={user.balance} />
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
