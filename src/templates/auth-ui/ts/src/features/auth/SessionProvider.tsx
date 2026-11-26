import { useLayoutEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { createSessionActions } from './session.js'
import type { SessionState } from './session.js'
import { SessionContext } from './sessionContext.js'

export function SessionProvider({
  required,
  children,
}: {
  required: boolean
  children: ReactNode
}) {
  const [snapshot, setSnapshot] = useState<{ state: SessionState; required: boolean }>({
    state: { status: 'checking' },
    required: false,
  })
  const [actions] = useState(() =>
    createSessionActions((state, required) => setSnapshot({ state, required })),
  )

  useLayoutEffect(() => {
    actions.start()
    return actions.stop
  }, [actions])

  useLayoutEffect(() => {
    void actions.setRequired(required)
  }, [actions, required])

  return (
    <SessionContext
      value={{
        state: required && !snapshot.required ? { status: 'checking' } : snapshot.state,
        retry: actions.retry,
        login: actions.login,
        logout: actions.logout,
      }}
    >
      {children}
    </SessionContext>
  )
}
