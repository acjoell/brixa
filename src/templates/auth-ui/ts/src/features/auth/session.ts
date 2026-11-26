import { getSession, login, logout } from './authClient.js'
import type { AuthResult } from './authClient.js'

type Identity = { userId: string }
type Failure = Exclude<AuthResult, { kind: 'ok' | 'aborted' }>

export type SessionState =
  | { status: 'checking' }
  | { status: 'authenticated'; identity: Identity }
  | { status: 'unauthenticated' }
  | { status: 'error'; failure: Failure }

type OperationResult<T = undefined> = AuthResult<T> | { kind: 'busy' }

type PendingRequest = {
  controller: AbortController
  mutation: boolean
  previous: SessionState
}

function rejectedBeforeSessionChange(
  result: AuthResult,
): result is Extract<Failure, { kind: 'http' }> {
  return result.kind === 'http' && [400, 401, 403, 429, 503].includes(result.status)
}

export function createSessionActions(onState: (state: SessionState, required: boolean) => void) {
  let state: SessionState = { status: 'checking' }
  let active: PendingRequest | undefined
  let started = false
  let required = false

  function publish(next: SessionState) {
    state = next
    if (started) onState(next, required)
  }

  function begin(mutation: boolean) {
    if (!started) return { kind: 'aborted' } as const
    // A cancelled POST may already have reached the server. Do not overlap cookie mutations.
    if (
      active?.mutation ||
      (mutation && (state.status === 'checking' || state.status === 'error'))
    ) {
      return { kind: 'busy' } as const
    }

    const superseded = active
    const request = {
      controller: new globalThis.AbortController(),
      mutation,
      previous: superseded?.previous ?? state,
    }
    active = request
    superseded?.controller.abort()
    publish({ status: 'checking' })
    return { kind: 'started', request } as const
  }

  function finish(next: SessionState) {
    active = undefined
    publish(next)
  }

  async function verify(
    request: PendingRequest,
    logoutFailure?: Failure,
  ): Promise<AuthResult<Identity>> {
    const result = await getSession(request.controller.signal)
    if (request !== active) return { kind: 'aborted' }

    if (result.kind === 'ok') {
      finish(
        logoutFailure
          ? { status: 'error', failure: logoutFailure }
          : { status: 'authenticated', identity: result.data },
      )
    } else if (result.kind === 'http' && result.unauthorized === 'no_session') {
      finish({ status: 'unauthenticated' })
    } else if (result.kind === 'aborted') {
      finish(request.previous)
    } else {
      finish({ status: 'error', failure: result })
    }
    return result
  }

  async function retry(): Promise<OperationResult<Identity>> {
    const operation = begin(false)
    return operation.kind === 'started' ? verify(operation.request) : operation
  }

  async function signIn(input: Parameters<typeof login>[0]): Promise<OperationResult<Identity>> {
    const operation = begin(true)
    if (operation.kind !== 'started') return operation

    const { request } = operation
    const result = await login(input, request.controller.signal)
    if (request !== active) return { kind: 'aborted' }
    if (result.kind === 'ok') return verify(request)

    if (rejectedBeforeSessionChange(result)) {
      finish(request.previous)
    } else {
      // A lost or unexpected response cannot tell us whether the cookie changed.
      await verify(request)
    }
    return result
  }

  async function signOut(): Promise<OperationResult> {
    const operation = begin(true)
    if (operation.kind !== 'started') return operation

    const { request } = operation
    const result = await logout(request.controller.signal)
    if (request !== active) return { kind: 'aborted' }
    if (result.kind === 'ok' || (result.kind === 'http' && result.unauthorized === 'no_session')) {
      finish({ status: 'unauthenticated' })
      return { kind: 'ok', data: undefined }
    }
    if (rejectedBeforeSessionChange(result)) {
      finish({ status: 'error', failure: result })
    } else {
      await verify(request, result.kind === 'aborted' ? { kind: 'communication' } : result)
    }
    return result
  }

  function suspend() {
    const pending = active
    if (!pending || pending.mutation) return
    active = undefined
    pending.controller.abort()
    state = pending.previous
  }

  return {
    start() {
      started = true
    },
    stop() {
      started = false
      suspend()
    },
    setRequired(next: boolean) {
      required = next
      if (next && !active?.mutation) return retry()
      if (!next) suspend()
      publish(state)
    },
    retry,
    login: signIn,
    logout: signOut,
  }
}
