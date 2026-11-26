import { useEffect } from 'react'
import type { ComponentType, ReactNode } from 'react'
import {
  BrowserRouter,
  Link,
  Navigate,
  Route,
  createRoutesFromElements,
  matchRoutes,
  useLocation,
  useRoutes,
} from 'react-router'
import { AppFrame } from '../../AppFrame.tsx'
import { useAppContent } from '../../useAppContent.tsx'
import { ActivationView } from './ActivationView.tsx'
import { LoginView } from './AuthForms.tsx'
import { ProtectedRoute } from './ProtectedRoute.tsx'
import { SessionNotice } from './SessionNotice.tsx'
import { WorkspaceView } from './WorkspaceView.tsx'
import { SessionProvider } from './SessionProvider.tsx'
import { useSession } from './sessionContext.js'
import messages from './messages.json'
// @@INSERT:imports@@

const entry = {
  // @@INSERT:landing@@
} as { Welcome?: ComponentType<{ loginLink?: ReactNode }> }

type AppProps = {
  projectName?: string
  initialThemePreference?: string
}

function NotFound() {
  const { t } = useAppContent()
  return (
    <main className="mx-auto box-border w-full max-w-2xl flex-1 px-5 py-12">
      <h1 id="route-heading" tabIndex={-1} className="text-3xl font-semibold">
        {t('auth.notFoundTitle', messages.notFoundTitle)}
      </h1>
      <p className="text-muted">{t('auth.notFoundDetail', messages.notFoundDetail)}</p>
      <Link to="/" className="font-semibold text-accent underline underline-offset-4">
        {t('auth.notFoundBack', messages.notFoundBack)}
      </Link>
    </main>
  )
}

function PrivateEntry() {
  const { state } = useSession()
  if (state.status === 'authenticated') return <Navigate to="/app" replace />
  if (state.status === 'unauthenticated') return <Navigate to="/login" replace />
  return <SessionNotice titleKey="sessionTitle" />
}

function PublicLanding({ Welcome }: { Welcome: NonNullable<typeof entry.Welcome> }) {
  const { state } = useSession()
  const { t } = useAppContent()
  const authenticated = state.status === 'authenticated'
  return (
    <Welcome
      loginLink={
        <Link className="ml-4 font-semibold text-accent" to={authenticated ? '/app' : '/login'}>
          {authenticated
            ? t('auth.workspaceAction', messages.workspaceAction)
            : t('auth.loginAction', messages.loginAction)}
        </Link>
      }
    />
  )
}

const routes = createRoutesFromElements(
  <>
    {entry.Welcome && <Route path="/" element={<PublicLanding Welcome={entry.Welcome} />} />}
    <Route id="session-required">
      {!entry.Welcome && <Route path="/" element={<PrivateEntry />} />}
      <Route path="/login" element={<LoginView />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/app" element={<WorkspaceView />} />
      </Route>
    </Route>
    <Route path="/activate" element={<ActivationView />} />
    <Route path="*" element={<NotFound />} />
  </>,
)

function requiresSession(pathname: string) {
  return (
    matchRoutes(routes, pathname)?.some(({ route }) => route.id === 'session-required') ?? false
  )
}

export function AuthRoutes({ projectName, initialThemePreference }: AppProps) {
  const { pathname } = useLocation()
  const { state } = useSession()
  const { t } = useAppContent()
  const content = useRoutes(routes)
  const translate = (key: keyof typeof messages) => t(`auth.${key}`, messages[key])
  const { Welcome } = entry
  const login = translate('loginTitle')
  const app = translate('appTitle')
  const activation = translate('activationTitle')
  const notFound = translate('notFoundTitle')
  const titles = {
    '/': Welcome ? t('home.title') : translate('sessionTitle'),
    '/login': login,
    '/app': app,
    '/activate': activation,
  }
  const path = (pathname.replace(/\/+$/, '') || '/').toLowerCase()
  const sessionRequired = requiresSession(pathname)
  const title = Object.hasOwn(titles, path)
    ? titles[path as keyof typeof titles]
    : sessionRequired
      ? app
      : notFound

  useEffect(() => {
    document.title = projectName ? `${title} · ${projectName}` : title
  }, [projectName, title])

  useEffect(() => {
    const heading =
      document.getElementById('route-heading') ?? document.getElementById('welcome-title')
    heading?.focus()
  }, [pathname])

  const guardedStatus = sessionRequired ? state.status : undefined
  useEffect(() => {
    if (guardedStatus && document.activeElement === document.body) {
      document.getElementById('route-heading')?.focus()
    }
  }, [guardedStatus])

  return (
    <AppFrame
      compact={path === '/login' || path === '/activate'}
      projectName={projectName}
      initialThemePreference={initialThemePreference}
      navigation={
        Welcome && (
          <Link to="/" className="hover:text-heading">
            {t('home.title')}
          </Link>
        )
      }
    >
      <p className="sr-only" role="status">
        {title}
      </p>
      {content}
    </AppFrame>
  )
}

function SessionRouter(props: AppProps) {
  const { pathname } = useLocation()
  return (
    <SessionProvider required={requiresSession(pathname)}>
      <AuthRoutes {...props} />
    </SessionProvider>
  )
}

export default function AuthApp(props: AppProps) {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <SessionRouter {...props} />
    </BrowserRouter>
  )
}
