import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createSessionActions } from './session.js'
import type { SessionState } from './session.js'

const userId = '0f02a58e-6792-4f7e-a896-cd50b4530758'
const credentials = { email: 'test@example.test', password: 'session test fixture' }
const identity = { userId }
const authenticated = { status: 'authenticated', identity }
const absent = { status: 'unauthenticated' }
const fetch = vi.fn<typeof globalThis.fetch>()
const state = vi.fn<(state: SessionState) => void>()
const success = () => globalThis.Response.json(identity)
const unauthorized = () => new globalThis.Response(null, { status: 401 })
const noContent = () => new globalThis.Response(null, { status: 204 })

function deferredResponse() {
  let complete!: (response: Response) => void
  const promise = new Promise<Response>((resolve) => {
    complete = resolve
  })
  return { promise, resolve: complete }
}

let session: ReturnType<typeof createSessionActions>

beforeEach(() => {
  vi.stubGlobal('fetch', fetch.mockReset())
  state.mockReset()
  session = createSessionActions((next) => state(next))
  session.start()
})

afterEach(() => {
  session.stop()
  vi.unstubAllGlobals()
})

it('verifica bajo demanda y permite un reintento explícito después de una respuesta inválida', async () => {
  fetch.mockResolvedValueOnce(globalThis.Response.json({ userId: 'invalid' }))
  fetch.mockResolvedValueOnce(success())

  expect(fetch).not.toHaveBeenCalled()
  const initial = session.setRequired(true)
  expect(state).toHaveBeenLastCalledWith({ status: 'checking' })
  await initial
  expect(state).toHaveBeenLastCalledWith({
    status: 'error',
    failure: { kind: 'unexpected_response', status: 200 },
  })
  expect(fetch).toHaveBeenCalledTimes(1)

  await expect(session.retry()).resolves.toEqual({ kind: 'ok', data: identity })
  expect(state).toHaveBeenLastCalledWith(authenticated)
})

it('exige una sesión verificada después de que login devuelve 204', async () => {
  const verification = deferredResponse()
  fetch.mockResolvedValueOnce(unauthorized()).mockResolvedValueOnce(noContent())
  fetch.mockReturnValueOnce(verification.promise)
  await session.setRequired(true)
  expect(state).toHaveBeenLastCalledWith(absent)

  const login = session.login(credentials)
  await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(3))
  expect(fetch.mock.calls.map(([path]) => path)).toEqual([
    '/api/auth/session',
    '/api/auth/login',
    '/api/auth/session',
  ])
  expect(state).toHaveBeenLastCalledWith({ status: 'checking' })
  await expect(session.logout()).resolves.toEqual({ kind: 'busy' })
  await expect(session.login(credentials)).resolves.toEqual({ kind: 'busy' })
  await expect(session.retry()).resolves.toEqual({ kind: 'busy' })
  expect(fetch).toHaveBeenCalledTimes(3)

  verification.resolve(success())
  await expect(login).resolves.toEqual({ kind: 'ok', data: identity })
  expect(state).toHaveBeenLastCalledWith(authenticated)
})

it('resuelve un login 204 seguido de sesión ausente sin autenticar', async () => {
  fetch.mockResolvedValueOnce(unauthorized()).mockResolvedValueOnce(noContent())
  fetch.mockResolvedValueOnce(unauthorized())
  await session.setRequired(true)
  await expect(session.login(credentials)).resolves.toMatchObject({
    kind: 'http',
    unauthorized: 'no_session',
  })
  expect(state).toHaveBeenLastCalledWith(absent)
})

it.each([
  ['unauthenticated', unauthorized, absent],
  ['authenticated', success, authenticated],
] as const)(
  'un login rechazado conserva el estado previo %s',
  async (_status, response, previous) => {
    fetch.mockResolvedValueOnce(response()).mockResolvedValueOnce(unauthorized())
    await session.setRequired(true)

    await expect(session.login(credentials)).resolves.toMatchObject({
      kind: 'http',
      unauthorized: 'invalid_credentials',
    })
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(state).toHaveBeenLastCalledWith(previous)
  },
)

it.each([204, 401])('logout %i termina en sesión ausente', async (status) => {
  fetch
    .mockResolvedValueOnce(success())
    .mockResolvedValueOnce(new globalThis.Response(null, { status }))
  await session.setRequired(true)

  await expect(session.logout()).resolves.toEqual({ kind: 'ok', data: undefined })
  expect(state).toHaveBeenLastCalledWith(absent)
})

it('reconcilia un cierre de sesión ambiguo que el servidor pudo completar', async () => {
  fetch.mockResolvedValueOnce(success()).mockRejectedValueOnce(new TypeError('fixture offline'))
  fetch.mockResolvedValueOnce(unauthorized())
  await session.setRequired(true)

  await expect(session.logout()).resolves.toEqual({ kind: 'communication' })
  expect(state).toHaveBeenLastCalledWith(absent)
  expect(fetch).toHaveBeenCalledTimes(3)
})

it('publica error si el servidor todavía conserva la sesión tras un logout ambiguo', async () => {
  fetch.mockResolvedValueOnce(success()).mockRejectedValueOnce(new TypeError('fixture offline'))
  fetch.mockResolvedValueOnce(success()).mockResolvedValueOnce(success())
  await session.setRequired(true)

  await expect(session.logout()).resolves.toEqual({ kind: 'communication' })
  expect(state).toHaveBeenLastCalledWith({ status: 'error', failure: { kind: 'communication' } })
  expect(fetch).toHaveBeenCalledTimes(3)
  await session.retry()
  expect(state).toHaveBeenLastCalledWith(authenticated)
})

it.each([400, 403, 429, 503])(
  'un rechazo HTTP conocido (%i) conserva el formulario',
  async (status) => {
    fetch
      .mockResolvedValueOnce(unauthorized())
      .mockResolvedValueOnce(
        new globalThis.Response(null, { status, headers: { 'Retry-After': '30' } }),
      )
    await session.setRequired(true)

    await expect(session.login(credentials)).resolves.toEqual({
      kind: 'http',
      status,
      retryAfter: '30',
    })
    expect(state).toHaveBeenLastCalledWith(absent)
    expect(fetch).toHaveBeenCalledTimes(2)
  },
)

it('cancela lecturas al salir y valida de nuevo una sesión cuyo valor anterior está en memoria', async () => {
  const stale = deferredResponse()
  fetch.mockResolvedValueOnce(success()).mockReturnValueOnce(stale.promise)
  fetch.mockResolvedValueOnce(unauthorized())
  await session.setRequired(true)
  const initial = session.retry()

  session.setRequired(false)
  expect(fetch.mock.calls[1]?.[1]?.signal?.aborted).toBe(true)
  expect(state).toHaveBeenLastCalledWith(authenticated)
  await session.setRequired(true)
  expect(state).toHaveBeenLastCalledWith(absent)
  stale.resolve(success())
  await expect(initial).resolves.toEqual({ kind: 'aborted' })
  expect(state).toHaveBeenLastCalledWith(absent)
})

it('mantiene una mutación activa al salir a una ruta pública y ocupa la reconciliación', async () => {
  const loginResponse = deferredResponse()
  const verification = deferredResponse()
  fetch.mockResolvedValueOnce(unauthorized()).mockReturnValueOnce(loginResponse.promise)
  fetch.mockReturnValueOnce(verification.promise)
  await session.setRequired(true)
  const pending = session.login(credentials)

  session.setRequired(false)
  await session.setRequired(true)
  expect(fetch.mock.calls[1]?.[1]?.signal?.aborted).toBe(false)
  loginResponse.resolve(new globalThis.Response(null, { status: 502 }))
  await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(3))
  await expect(session.login(credentials)).resolves.toEqual({ kind: 'busy' })
  await expect(session.logout()).resolves.toEqual({ kind: 'busy' })
  verification.resolve(success())
  await expect(pending).resolves.toMatchObject({ kind: 'http', status: 502 })
  expect(state).toHaveBeenLastCalledWith(authenticated)
  expect(fetch).toHaveBeenCalledTimes(3)
})

it('impide otra mutación hasta verificar la sesión tras un resultado ambiguo', async () => {
  fetch
    .mockResolvedValueOnce(unauthorized())
    .mockRejectedValueOnce(new TypeError('fixture offline'))
  fetch
    .mockRejectedValueOnce(new TypeError('fixture still offline'))
    .mockResolvedValueOnce(unauthorized())
  await session.setRequired(true)

  await expect(session.login(credentials)).resolves.toEqual({ kind: 'communication' })
  expect(state).toHaveBeenLastCalledWith({ status: 'error', failure: { kind: 'communication' } })
  await expect(session.login(credentials)).resolves.toEqual({ kind: 'busy' })
  expect(fetch).toHaveBeenCalledTimes(3)
  await session.retry()
  expect(state).toHaveBeenLastCalledWith(absent)
})

it('cancelar el ciclo invalida la respuesta y permite iniciar otro ciclo independiente', async () => {
  const stale = deferredResponse()
  fetch.mockReturnValueOnce(stale.promise).mockResolvedValueOnce(unauthorized())
  const initial = session.setRequired(true)

  session.stop()
  expect(fetch.mock.calls[0]?.[1]?.signal?.aborted).toBe(true)
  await expect(session.login(credentials)).resolves.toEqual({ kind: 'aborted' })
  expect(fetch).toHaveBeenCalledTimes(1)
  session.start()
  await session.setRequired(true)
  const updates = state.mock.calls.length
  stale.resolve(success())
  await expect(initial).resolves.toEqual({ kind: 'aborted' })
  expect(state).toHaveBeenCalledTimes(updates)
  expect(state).toHaveBeenLastCalledWith(absent)
})
