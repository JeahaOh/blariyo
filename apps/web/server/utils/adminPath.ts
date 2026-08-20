export function isAdminPath(pathname: string) {
  return pathname === '/admin'
    || pathname.startsWith('/admin/')
    || pathname === '/api/v1/admin'
    || pathname.startsWith('/api/v1/admin/')
}
