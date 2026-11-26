import type { ReactNode } from 'react'
import { useAppContent } from '../../useAppContent.tsx'
import { useSession } from './sessionContext.js'
import messages from './messages.json'

export function SessionPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="mx-auto box-border w-full max-w-2xl flex-1 px-5 py-12 sm:py-16">
      <section
        aria-labelledby="route-heading"
        className="rounded-2xl border border-solid border-line bg-panel p-6 sm:p-9"
      >
        <h1 id="route-heading" tabIndex={-1} className="m-0 text-3xl font-semibold tracking-tight">
          {title}
        </h1>
        {children}
      </section>
    </main>
  )
}

export function SessionNotice({
  titleKey,
}: {
  titleKey: 'loginTitle' | 'appTitle' | 'sessionTitle'
}) {
  const { state, retry } = useSession()
  const { t } = useAppContent()
  const title = t(`auth.${titleKey}`, messages[titleKey])

  if (state.status !== 'error') {
    if (titleKey === 'sessionTitle') {
      return (
        <main className="mx-auto box-border w-full max-w-2xl flex-1 px-5 py-12">
          <h1 id="route-heading" tabIndex={-1} className="sr-only">
            {title}
          </h1>
          <p role="status" className="text-sm text-muted">
            {t('auth.sessionChecking', messages.sessionChecking)}
          </p>
        </main>
      )
    }
    return (
      <SessionPanel title={title}>
        <p role="status" className="mb-0 text-sm text-muted">
          {t('auth.sessionChecking', messages.sessionChecking)}
        </p>
      </SessionPanel>
    )
  }

  const { failure } = state
  let messageKey: 'sessionError' | 'rateLimited' | 'serviceUnavailable' | 'communicationError' =
    'sessionError'
  if (failure.kind === 'communication') messageKey = 'communicationError'
  if (failure.kind === 'http' && failure.status === 429) messageKey = 'rateLimited'
  if (failure.kind === 'http' && failure.status === 503) messageKey = 'serviceUnavailable'

  return (
    <SessionPanel title={title}>
      <p role="alert" className="text-sm text-muted">
        {t(`auth.${messageKey}`, messages[messageKey])}
      </p>
      <button
        type="button"
        onClick={() => void retry()}
        className="min-h-11 cursor-pointer rounded-lg border border-solid border-control bg-transparent px-4 text-sm font-semibold text-accent [font-family:inherit]"
      >
        {t('auth.sessionRetry', messages.sessionRetry)}
      </button>
    </SessionPanel>
  )
}
