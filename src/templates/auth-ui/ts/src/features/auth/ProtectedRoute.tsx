import { Navigate, Outlet } from 'react-router'
import { SessionNotice } from './SessionNotice.tsx'
import { useSession } from './sessionContext.js'

export function ProtectedRoute() {
  const { state } = useSession()

  if (state.status === 'authenticated') return <Outlet />
  if (state.status === 'unauthenticated') return <Navigate to="/login" replace />
  return <SessionNotice titleKey="appTitle" />
}
