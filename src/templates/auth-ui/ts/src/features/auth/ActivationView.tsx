import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useLocation, useNavigate, useNavigationType } from 'react-router'
import type { Location } from 'react-router'
import { ActivationForm } from './AuthForms.tsx'
import type { ActivationFeedback } from './AuthForms.tsx'
import { activationRetryAt, readActivationToken, isActivationPasswordValid } from './activation.js'
import { activate, validateActivation } from './authClient.js'
import type { PasswordPolicy } from './authClient.js'

type Validation = { key: string; retryAt?: number } & (
  { status: 'valid'; policy: PasswordPolicy } | { status: 'error' } | { status: 'limited' }
)

export function ActivationView() {
  const location = useLocation()
  const { hash, key, pathname, search } = location
  const navigation = useNavigationType()
  const navigate = useNavigate()
  const [flow, setFlow] = useState<{ key: string; token: string | null }>()
  const [feedback, setFeedback] = useState<ActivationFeedback>()
  const [validation, setValidation] = useState<Validation>()
  const captured = useRef<{ source: Location; token: string | null }>(undefined)
  const request = useRef<AbortController>(undefined)
  const token = !hash && flow?.key === key ? flow.token : undefined
  const current = validation?.key === key && token ? validation : undefined

  useEffect(() => {
    if (hash) {
      if (captured.current?.source === location) return
      captured.current = { source: location, token: readActivationToken(hash) }
      setFlow(undefined)
      setFeedback(undefined)
      setValidation(undefined)
      void navigate({ pathname, search, hash: '' }, { replace: true })
      return
    }

    // Transfer the in-memory token only to the replacement of the link we just read.
    const pending = captured.current
    captured.current = undefined
    if (
      pending &&
      navigation === 'REPLACE' &&
      pending.source.key !== key &&
      pending.source.pathname === pathname &&
      pending.source.search === search
    ) {
      setFlow({ key, token: pending.token })
    } else if (flow && flow.key !== key) {
      setFlow(undefined)
      setFeedback(undefined)
      setValidation(undefined)
    }
  }, [flow, hash, key, location, navigate, navigation, pathname, search])

  useLayoutEffect(
    () => () => {
      request.current?.abort()
      request.current = undefined
    },
    [hash, key],
  )

  const check = useCallback(async () => {
    if (!token || request.current) return
    const controller = new globalThis.AbortController()
    request.current = controller
    setValidation(undefined)
    const result = await validateActivation(token, controller.signal)
    if (request.current !== controller || controller.signal.aborted) return
    request.current = undefined
    if (result.kind === 'ok') setValidation({ key, status: 'valid', policy: result.data })
    else if (result.kind === 'http' && result.status === 400) setFlow({ key, token: null })
    else if (result.kind === 'http' && result.status === 429) {
      setValidation({ key, status: 'limited', retryAt: activationRetryAt(result.retryAfter) })
    } else setValidation({ key, status: 'error' })
  }, [key, token])

  useLayoutEffect(() => {
    if (!token) return
    // StrictMode can replay an effect before its queued work starts.
    let cancelled = false
    globalThis.queueMicrotask(() => {
      if (!cancelled) void check()
    })
    return () => {
      cancelled = true
    }
  }, [check, token])

  useEffect(() => {
    if (current?.retryAt === undefined) return
    let timer: ReturnType<typeof setTimeout>
    function releaseWhenDue(at: number) {
      const remaining = at - Date.now()
      if (remaining > 0)
        timer = globalThis.setTimeout(() => releaseWhenDue(at), Math.min(remaining, 2_147_483_647))
      else
        setValidation((previous) =>
          previous && previous === current ? { ...previous, retryAt: undefined } : previous,
        )
    }
    releaseWhenDue(current.retryAt)
    return () => globalThis.clearTimeout(timer)
  }, [current])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (
      !token ||
      current?.status !== 'valid' ||
      request.current ||
      (current.retryAt !== undefined && Date.now() < current.retryAt)
    )
      return

    const password = event.currentTarget.elements.namedItem('password')
    const confirmation = event.currentTarget.elements.namedItem('confirmation')
    if (
      !(password instanceof globalThis.HTMLInputElement) ||
      !(confirmation instanceof globalThis.HTMLInputElement)
    )
      return

    if (!isActivationPasswordValid(password.value, current.policy)) {
      setFeedback('passwordLimits')
      password.focus()
      return
    }
    if (password.value !== confirmation.value) {
      setFeedback('passwordMismatch')
      confirmation.focus()
      return
    }

    const controller = new globalThis.AbortController()
    request.current = controller
    setFeedback('operationPending')
    const input = { token, password: password.value }
    const result = await activate(input, controller.signal)
    if (request.current !== controller || controller.signal.aborted) return
    request.current = undefined

    if (result.kind === 'http' && result.status === 429) {
      setValidation({ ...current, retryAt: activationRetryAt(result.retryAfter) })
      setFeedback('rateLimited')
      return
    }
    if (password.value === input.password) password.value = ''
    if (confirmation.value === input.password) confirmation.value = ''

    if (result.kind === 'ok') {
      setFlow(undefined)
      void navigate('/login', { replace: true, state: { accountActivated: true } })
      return
    }
    if (result.kind === 'http' && result.status === 400) {
      if (result.code === 'PASSWORD_POLICY') {
        setFeedback('passwordPolicyRejected')
        password.focus()
        return
      }
      setFlow({ key, token: null })
      setFeedback(undefined)
      return
    }
    if (result.kind === 'http' && result.status === 503) {
      setFeedback('serviceUnavailable')
      return
    }
    setFeedback('activationUnconfirmed')
  }

  return (
    <ActivationForm
      onSubmit={current?.status === 'valid' ? (event) => void submit(event) : undefined}
      submitDisabled={current?.status === 'valid' && current.retryAt !== undefined}
      passwordPolicy={current?.status === 'valid' ? current.policy : undefined}
      onRetry={
        current?.status === 'error' || current?.status === 'limited'
          ? () => {
              if (
                current.status !== 'limited' ||
                current.retryAt === undefined ||
                Date.now() >= current.retryAt
              )
                void check()
            }
          : undefined
      }
      retryDisabled={current?.status === 'limited' && current.retryAt !== undefined}
      feedback={
        hash
          ? 'activationChecking'
          : token === undefined
            ? 'activationMissing'
            : token === null
              ? 'activationInvalid'
              : current?.status === 'valid'
                ? feedback
                : current?.status === 'limited'
                  ? 'rateLimited'
                  : current?.status === 'error'
                    ? 'activationValidationError'
                    : 'activationChecking'
      }
    />
  )
}
