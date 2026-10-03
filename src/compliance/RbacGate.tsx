import type { ReactNode } from 'react'
import { useAuthStore } from '@/auth/authStore'
import { can, type Permission } from '@/auth/rbac'

export function RbacGate({
  perm,
  children,
  fallback = null,
}: {
  perm: Permission
  children: ReactNode
  fallback?: ReactNode
}) {
  const role = useAuthStore((s) => s.user?.role)
  if (!can(role, perm)) return <>{fallback}</>
  return <>{children}</>
}
