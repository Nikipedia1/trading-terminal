/**
 * Role-based access control – desk permissions.
 * Roles: viewer < trader < risk < admin (user kept as alias of trader).
 */

export type AuthRole = 'viewer' | 'trader' | 'user' | 'risk' | 'admin'

export type Permission =
  | 'charts.view'
  | 'news.view'
  | 'paper.trade'
  | 'live.arm'
  | 'live.order'
  | 'keys.manage'
  | 'risk.edit'
  | 'export.data'
  | 'admin.users'
  | 'layout.edit'

const ROLE_PERMS: Record<AuthRole, Permission[]> = {
  viewer: ['charts.view', 'news.view'],
  trader: [
    'charts.view',
    'news.view',
    'paper.trade',
    'export.data',
    'layout.edit',
  ],
  user: [
    'charts.view',
    'news.view',
    'paper.trade',
    'export.data',
    'layout.edit',
  ],
  risk: [
    'charts.view',
    'news.view',
    'paper.trade',
    'live.arm',
    'live.order',
    'keys.manage',
    'risk.edit',
    'export.data',
    'layout.edit',
  ],
  admin: [
    'charts.view',
    'news.view',
    'paper.trade',
    'live.arm',
    'live.order',
    'keys.manage',
    'risk.edit',
    'export.data',
    'layout.edit',
    'admin.users',
  ],
}

export function normalizeRole(role: string | undefined | null): AuthRole {
  const r = (role || 'viewer').toLowerCase()
  if (r === 'admin') return 'admin'
  if (r === 'risk') return 'risk'
  if (r === 'trader' || r === 'user') return 'trader'
  if (r === 'viewer') return 'viewer'
  return 'viewer'
}

export function can(role: string | undefined | null, perm: Permission): boolean {
  const r = normalizeRole(role)
  return ROLE_PERMS[r]?.includes(perm) ?? false
}

export function roleLabel(role: string | undefined | null): string {
  const r = normalizeRole(role)
  return r.toUpperCase()
}
