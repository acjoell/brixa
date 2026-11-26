import { createContext, useContext } from 'react'
import type { createSessionActions, SessionState } from './session.js'

type SessionContextValue = { state: SessionState } & Pick<
  ReturnType<typeof createSessionActions>,
  'retry' | 'login' | 'logout'
>

export const SessionContext = createContext<SessionContextValue | null>(null)

export function useSession(): SessionContextValue {
  const session = useContext(SessionContext)
  if (!session) throw new Error('useSession requires SessionProvider')
  return session
}
