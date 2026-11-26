import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router'
import { expect, it, vi } from 'vitest'
import { AuthRoutes } from './AuthApp.tsx'
import { ActivationForm, LoginForm } from './AuthForms.tsx'
import { ProtectedRoute } from './ProtectedRoute.tsx'
import { activationRetryAt, isActivationPasswordValid, readActivationToken } from './activation.js'
import { SessionContext } from './sessionContext.js'
import type { SessionState } from './session.js'
import messages from './messages.json'
// @@INSERT:imports@@

function renderRoute(path: string, state: SessionState = { status: 'checking' }) {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[path]}>
      <SessionContext value={{ state, retry: vi.fn(), login: vi.fn(), logout: vi.fn() }}>
        <AuthRoutes projectName="Generated project" initialThemePreference="dark" />
      </SessionContext>
    </MemoryRouter>,
  )
}

it.each([
  ['/login', messages.loginTitle, messages.loginIntro, true],
  ['/app', messages.appTitle, messages.sessionChecking, false],
  ['/activate', messages.activationTitle, messages.activationMissing, true],
  ['/missing', messages.notFoundTitle, messages.notFoundDetail, false],
])('renderiza la ruta %s sin APIs del navegador', (path, title, detail, compact) => {
  const markup = renderRoute(path, path === '/login' ? { status: 'unauthenticated' } : undefined)

  expect(markup.includes('Generated project')).toBe(!compact)
  expect(markup.includes('<footer')).toBe(!compact)
  expect(markup.includes('>GitHub</a>')).toBe(!compact)
  if (compact) expect(markup).toContain('alt="Brixa"')
  expect(markup).toContain('id="route-heading"')
  expect(markup).toContain('role="status"')
  expect(markup).toContain(title)
  expect(markup).toContain(detail)
  expect(markup).toMatch(/name="brixa-theme"[^>]*checked[^>]*value="dark"/)
  expect(markup).not.toContain('token=example')
})

it.each([
  ['/login', ['username', 'current-password'], [messages.showPassword]],
  [
    '/activate',
    ['new-password', 'new-password'],
    [messages.showNewPassword, messages.showConfirmation],
  ],
])('expone los campos de %s con sus controles accesibles', (path, fieldTypes, toggleLabels) => {
  const markup =
    path === '/activate'
      ? renderToStaticMarkup(<ActivationForm onSubmit={vi.fn()} />)
      : renderRoute(path, { status: 'unauthenticated' })
  const inputs = [...markup.matchAll(/<input[^>]*id="([^"]+)"[^>]*autoComplete="([^"]+)"[^>]*>/g)]

  expect(inputs.map(([, , autoComplete]) => autoComplete)).toEqual(fieldTypes)
  for (const [, id] of inputs) expect(markup).toContain(`for="${id}"`)
  const visibilityButtons = [
    ...markup.matchAll(/<button type="button" aria-controls="([^"]+)" aria-label="([^"]+)"/g),
  ]
  expect(visibilityButtons.map(([, id]) => id)).toEqual(
    inputs.filter(([, , type]) => type.endsWith('password')).map(([, id]) => id),
  )
  expect(visibilityButtons.map(([, , label]) => label)).toEqual(toggleLabels)
  expect(markup).not.toMatch(/<button type="submit" disabled=""/)
})

it('asocia el error de confirmación al campo y anuncia el estado del formulario', () => {
  const markup = renderToStaticMarkup(
    <ActivationForm feedback="passwordMismatch" onSubmit={vi.fn()} />,
  )
  const errorId = markup.match(/aria-invalid="true" aria-describedby="([^"]+)"/)?.[1]

  expect(errorId).toBeTruthy()
  expect(markup).toContain(`id="${errorId}"`)
  expect(markup).toContain(messages.passwordMismatch)
  expect(markup).toContain('role="alert"')
})

it.each([
  { status: 'checking' },
  { status: 'unauthenticated' },
  { status: 'error', failure: { kind: 'communication' } },
  { status: 'authenticated', identity: { userId: 'test-user' } },
] satisfies SessionState[])('muestra /app según la sesión: $status', (state) => {
  const markup = renderRoute('/app', state)
  expect(markup.includes(messages.appWelcome)).toBe(state.status === 'authenticated')
  expect(markup.includes(messages.logoutAction)).toBe(state.status === 'authenticated')
  expect(markup.includes(messages.sessionRetry)).toBe(state.status === 'error')
  expect(markup.includes('id="route-heading"')).toBe(state.status !== 'unauthenticated')
})

it.each([
  { status: 'checking' },
  { status: 'unauthenticated' },
  { status: 'error', failure: { kind: 'communication' } },
  { status: 'authenticated', identity: { userId: 'test-user' } },
] satisfies SessionState[])('muestra /login según la sesión: $status', (state) => {
  const markup = renderRoute('/login', state)
  expect(markup.includes('<form')).toBe(state.status === 'unauthenticated')
  expect(markup.includes(messages.sessionChecking)).toBe(state.status === 'checking')
  expect(markup.includes(messages.sessionRetry)).toBe(state.status === 'error')
  expect(markup.includes('id="route-heading"')).toBe(state.status !== 'authenticated')
})

it.each([
  ['loginRejected', messages.loginRejected, 'alert'],
  ['loginPending', messages.loginPending, 'status'],
  ['loginHttpRejected', messages.loginHttpRejected, 'alert'],
] as const)('presenta %s en el formulario de login', (feedback, message, role) => {
  const markup = renderToStaticMarkup(<LoginForm feedback={feedback} onSubmit={vi.fn()} />)
  expect(markup).toContain(message)
  expect(markup).toContain(`role="${role}"`)
  expect(/<button type="submit" disabled=""/.test(markup)).toBe(feedback === 'loginPending')
})

it('muestra los errores por campo y el rechazo general debajo de la acción', () => {
  const markup = renderToStaticMarkup(
    <LoginForm
      fieldErrors={{ email: 'emailInvalid', password: 'passwordRequired' }}
      feedback="rateLimited"
      retryAfter={30}
      onSubmit={vi.fn()}
    />,
  )
  for (const errorId of [...markup.matchAll(/aria-invalid="true" aria-describedby="([^"]+)"/g)]) {
    expect(markup).toContain(`id="${errorId[1]}"`)
  }
  expect(markup.match(/aria-invalid="true"/g)).toHaveLength(2)
  expect(markup).toContain(messages.emailInvalid)
  expect(markup).toContain(messages.passwordRequired)
  expect(markup).toContain(messages.retryAfter.replace('{seconds}', '30'))
  expect(markup.indexOf('type="submit"')).toBeLessThan(markup.indexOf('role="alert"'))
})

it('resuelve la raíz privada con un estado neutro o adapta el CTA público a la sesión', () => {
  const checking = renderRoute('/')
  const known = renderRoute('/', { status: 'authenticated', identity: { userId: 'test-user' } })
  if (checking.includes('id="welcome-title"')) {
    const unknown = [
      checking,
      renderRoute('/', { status: 'unauthenticated' }),
      renderRoute('/', { status: 'error', failure: { kind: 'communication' } }),
    ]
    for (const markup of unknown) {
      expect(markup).toMatch(new RegExp(`href="/login"[^>]*>${messages.loginAction}</a>`))
    }
    expect(known).toMatch(new RegExp(`href="/app"[^>]*>${messages.workspaceAction}</a>`))
  } else {
    expect(checking).toContain(messages.sessionChecking)
    expect(checking).not.toContain(messages.appTitle)
    expect(known).not.toContain(messages.appWelcome)
    expect(renderRoute('/', { status: 'error', failure: { kind: 'communication' } })).toContain(
      messages.sessionRetry,
    )
  }
})

it('aplica el mismo guard a cualquier ruta hija declarativa', () => {
  for (const state of [
    { status: 'checking' },
    { status: 'authenticated', identity: { userId: 'test-user' } },
  ] satisfies SessionState[]) {
    const markup = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/app/custom']}>
        <SessionContext value={{ state, retry: vi.fn(), login: vi.fn(), logout: vi.fn() }}>
          <Routes>
            <Route element={<ProtectedRoute />}>
              <Route path="/app/custom" element={<p>Custom route test</p>} />
            </Route>
          </Routes>
        </SessionContext>
      </MemoryRouter>,
    )
    expect(markup.includes('Custom route test')).toBe(state.status === 'authenticated')
  }
})

const canonicalToken = 'A'.repeat(43)

it('muestra comprobación neutra, reintento recuperable y acceso desde un enlace inválido', () => {
  const policyForm = renderToStaticMarkup(
    <ActivationForm
      feedback="passwordPolicyRejected"
      passwordPolicy={{ minLength: 12, maxLength: 50, maxBytes: 512 }}
      onSubmit={vi.fn()}
    />,
  )
  expect(policyForm).toContain('12 to 50 Unicode characters, up to 512 UTF-8 bytes')
  expect(policyForm).toMatch(/aria-describedby="[^"]*-hint [^"]*-error"/)
  const checking = renderToStaticMarkup(<ActivationForm feedback="activationChecking" />)
  expect(checking).toContain('role="status"')
  expect(checking).not.toContain('type="submit"')
  const retry = renderToStaticMarkup(
    <ActivationForm feedback="rateLimited" onRetry={vi.fn()} retryDisabled />,
  )
  expect(retry).toContain('type="button" disabled=""')
  const invalid = renderToStaticMarkup(
    <MemoryRouter>
      <ActivationForm feedback="activationInvalid" />
    </MemoryRouter>,
  )
  expect(invalid).toContain('href="/login"')
})

it('interpreta Retry-After como segundos o fecha HTTP sin aceptar plazos inválidos', () => {
  expect(activationRetryAt('2', 1_000)).toBe(3_000)
  expect(activationRetryAt('Thu, 01 Jan 1970 00:00:03 GMT', 1_000)).toBe(3_000)
  for (const invalid of [null, '0', 'invalid', '9007199254740992'])
    expect(activationRetryAt(invalid, 1_000)).toBeUndefined()
})

it('lee un solo token canónico del fragmento', () => {
  expect(readActivationToken(`#token=${canonicalToken}`)).toBe(canonicalToken)
  expect(readActivationToken('')).toBeNull()
  expect(readActivationToken('#token=' + 'A'.repeat(42) + 'B')).toBeNull()
  expect(readActivationToken(`#token=${canonicalToken}&token=${canonicalToken}`)).toBeNull()
  expect(readActivationToken('#token=example')).toBeNull()
})

it('aplica los límites de contraseña del backend por puntos de código y UTF-8', () => {
  const policy = { minLength: 8, maxLength: 128, maxBytes: 512 }
  expect(isActivationPasswordValid(' '.repeat(8), policy)).toBe(true)
  expect(isActivationPasswordValid('🧱'.repeat(128), policy)).toBe(true)
  expect(isActivationPasswordValid('🧱'.repeat(129), policy)).toBe(false)
  expect(isActivationPasswordValid('', policy)).toBe(false)
  expect(isActivationPasswordValid('🧱'.repeat(7), policy)).toBe(false)
  expect(isActivationPasswordValid('🧱'.repeat(8), { ...policy, maxBytes: 31 })).toBe(false)
  expect(isActivationPasswordValid(String.fromCharCode(0xd800), policy)).toBe(false)
})

it('no incluye los campos ni el secreto en el HTML previo a leer el fragmento', () => {
  const markup = renderRoute(`/activate#token=${canonicalToken}`)
  expect(markup).not.toContain(canonicalToken)
  expect(markup).not.toContain('autoComplete="new-password"')
  expect(markup).not.toContain('type="submit"')
})
