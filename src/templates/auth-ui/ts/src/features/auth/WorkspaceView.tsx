import { useAppContent } from '../../useAppContent.tsx'
import { SessionPanel } from './SessionNotice.tsx'
import { useSession } from './sessionContext.js'
import messages from './messages.json'

export function WorkspaceView() {
  const { logout } = useSession()
  const { t } = useAppContent()

  return (
    <SessionPanel title={t('auth.appTitle', messages.appTitle)}>
      <p className="text-sm leading-relaxed text-muted">
        {t('auth.appWelcome', messages.appWelcome)}
      </p>
      <button
        type="button"
        onClick={() => void logout()}
        className="min-h-11 cursor-pointer rounded-lg border border-solid border-control bg-canvas px-4 text-sm font-semibold text-heading [font-family:inherit]"
      >
        {t('auth.logoutAction', messages.logoutAction)}
      </button>
    </SessionPanel>
  )
}
