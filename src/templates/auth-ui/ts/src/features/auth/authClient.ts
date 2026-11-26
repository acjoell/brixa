export type AuthResult<T = undefined> =
  | { kind: 'ok'; data: T }
  | {
      kind: 'http'
      status: number
      retryAfter: string | null
      unauthorized?: 'invalid_credentials' | 'no_session'
      code?: 'PASSWORD_POLICY'
    }
  | { kind: 'communication' }
  | { kind: 'unexpected_response'; status: number }
  | { kind: 'aborted' }

type PostOperation = 'login' | 'logout' | 'activate' | 'activate/validate'
type LoginInput = { email: string; password: string }
type ActivationInput = { token: string; password: string }
type PostBody = LoginInput | { token: string } | ActivationInput
type Session = { userId: string }
export type PasswordPolicy = { minLength: number; maxLength: number; maxBytes: number }

const userIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function request(
  operation: 'session' | PostOperation,
  signal?: AbortSignal,
  body?: PostBody,
): Promise<AuthResult<Response>> {
  if (signal?.aborted) return { kind: 'aborted' }

  const isSession = operation === 'session'
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (!isSession) headers['X-Requested-With'] = 'XMLHttpRequest'
  if (body) headers['Content-Type'] = 'application/json'

  let response: Response
  try {
    response = await globalThis.fetch(`/api/auth/${operation}`, {
      method: isSession ? 'GET' : 'POST',
      mode: 'same-origin',
      referrerPolicy: 'same-origin',
      credentials: 'same-origin',
      redirect: 'error',
      cache: 'no-store',
      headers,
      signal,
      ...(body && { body: JSON.stringify(body) }),
    })
  } catch {
    return { kind: signal?.aborted ? 'aborted' : 'communication' }
  }

  const { status } = response
  const expectsJson = isSession || operation === 'activate/validate'
  if (status === (expectsJson ? 200 : 204)) return { kind: 'ok', data: response }
  if (status < 400 || status > 599) return { kind: 'unexpected_response', status }

  const failure = { kind: 'http', status, retryAfter: response.headers.get('Retry-After') } as const
  if (operation === 'activate' && status === 400) {
    const result = await readJson(response, signal)
    if (result.kind === 'aborted' || result.kind === 'communication') return result
    if (result.kind === 'ok' && isObject(result.data) && result.data.code === 'PASSWORD_POLICY')
      return { ...failure, code: 'PASSWORD_POLICY' }
  }
  if (status !== 401 || operation === 'activate' || operation === 'activate/validate')
    return failure
  return {
    ...failure,
    unauthorized: operation === 'login' ? 'invalid_credentials' : 'no_session',
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

async function readJson(response: Response, signal?: AbortSignal): Promise<AuthResult<unknown>> {
  const unexpected = { kind: 'unexpected_response', status: response.status } as const
  if (
    response.headers.get('Content-Type')?.split(';')[0]?.trim().toLowerCase() !== 'application/json'
  ) {
    return unexpected
  }

  try {
    const payload: unknown = await response.json()
    return signal?.aborted ? { kind: 'aborted' } : { kind: 'ok', data: payload }
  } catch (error) {
    if (signal?.aborted) return { kind: 'aborted' }
    return error instanceof SyntaxError ? unexpected : { kind: 'communication' }
  }
}

export async function getSession(signal?: AbortSignal): Promise<AuthResult<Session>> {
  const result = await request('session', signal)
  if (result.kind !== 'ok') return result
  const parsed = await readJson(result.data, signal)
  if (parsed.kind !== 'ok') return parsed
  const payload = parsed.data

  if (
    !isObject(payload) ||
    Object.keys(payload).length !== 1 ||
    typeof payload.userId !== 'string' ||
    !userIdPattern.test(payload.userId)
  ) {
    return { kind: 'unexpected_response', status: result.data.status }
  }
  return { kind: 'ok', data: { userId: payload.userId } }
}

async function mutate(
  operation: PostOperation,
  signal?: AbortSignal,
  body?: PostBody,
): Promise<AuthResult> {
  const result = await request(operation, signal, body)
  return result.kind === 'ok' ? { kind: 'ok', data: undefined } : result
}

export function login({ email, password }: LoginInput, signal?: AbortSignal): Promise<AuthResult> {
  return mutate('login', signal, { email, password })
}

export function logout(signal?: AbortSignal): Promise<AuthResult> {
  return mutate('logout', signal)
}

export function activate(
  { token, password }: ActivationInput,
  signal?: AbortSignal,
): Promise<AuthResult> {
  return mutate('activate', signal, { token, password })
}

export async function validateActivation(
  token: string,
  signal?: AbortSignal,
): Promise<AuthResult<PasswordPolicy>> {
  const result = await request('activate/validate', signal, { token })
  if (result.kind !== 'ok') return result
  const parsed = await readJson(result.data, signal)
  if (parsed.kind !== 'ok') return parsed

  const body = parsed.data
  const policy = isObject(body) && Object.keys(body).length === 1 ? body.passwordPolicy : undefined
  if (isObject(policy) && Object.keys(policy).length === 3) {
    const { minLength, maxLength, maxBytes } = policy
    if (
      typeof minLength === 'number' &&
      Number.isInteger(minLength) &&
      minLength >= 8 &&
      typeof maxLength === 'number' &&
      Number.isInteger(maxLength) &&
      minLength <= maxLength &&
      maxLength <= 128 &&
      maxBytes === 512
    )
      return { kind: 'ok', data: { minLength, maxLength, maxBytes } }
  }
  return { kind: 'unexpected_response', status: result.data.status }
}
