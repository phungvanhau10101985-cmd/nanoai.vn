export type AdminUsersSort = 'name' | 'created' | 'credits'
export type AdminUsersSortDir = 'asc' | 'desc'

export function parseAdminUsersSort(input?: {
  sort?: string | string[]
  dir?: string | string[]
}): { sort: AdminUsersSort; dir: AdminUsersSortDir } {
  const sortRaw = Array.isArray(input?.sort) ? input.sort[0] : input?.sort
  const dirRaw = Array.isArray(input?.dir) ? input.dir[0] : input?.dir
  const sort: AdminUsersSort =
    sortRaw === 'created' || sortRaw === 'credits' ? sortRaw : 'name'
  const dir: AdminUsersSortDir = dirRaw === 'asc' ? 'asc' : 'desc'
  return { sort, dir }
}

export function buildAdminUsersHref(opts: {
  email?: string
  sort: AdminUsersSort
  dir: AdminUsersSortDir
}): string {
  const params = new URLSearchParams()
  if (opts.email?.trim()) params.set('email', opts.email.trim())
  if (opts.sort !== 'name') params.set('sort', opts.sort)
  if (opts.dir !== 'desc') params.set('dir', opts.dir)
  const qs = params.toString()
  return qs ? `/admin/users?${qs}` : '/admin/users'
}

export function toggleAdminUsersSort(
  current: { sort: AdminUsersSort; dir: AdminUsersSortDir },
  column: 'created' | 'credits'
): { sort: AdminUsersSort; dir: AdminUsersSortDir } {
  if (current.sort === column) {
    return { sort: column, dir: current.dir === 'desc' ? 'asc' : 'desc' }
  }
  return { sort: column, dir: 'desc' }
}
