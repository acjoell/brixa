import { useId, useState } from 'react'
import type { FormEventHandler, ReactNode } from 'react'
import { BrandMark } from '../../AppFrame.tsx'

const inputClass =
  'box-border min-h-12 w-full rounded-lg border border-solid border-control bg-canvas px-3 text-base text-heading [font-family:inherit]'
const errorClass = 'text-sm font-semibold text-[light-dark(#a51d30,#ffadb8)]'

export function AuthForm({
  title,
  description,
  action,
  notice,
  onSubmit,
  pending = false,
  submitDisabled = false,
  noValidate,
  ambient = false,
  children,
}: {
  title: string
  description: string
  action?: string
  notice?: { text: string; error?: boolean }
  onSubmit?: FormEventHandler<HTMLFormElement>
  pending?: boolean
  submitDisabled?: boolean
  noValidate?: boolean
  ambient?: boolean
  children?: ReactNode
}) {
  const noticeId = useId()
  return (
    <main
      className={`box-border grid w-full flex-1 justify-items-center px-6 pt-6 pb-10 sm:content-center sm:py-12 ${
        ambient
          ? 'bg-[radial-gradient(ellipse_at_top,color-mix(in_srgb,var(--color-hero)_55%,transparent),transparent_65%)]'
          : ''
      }`}
    >
      <section aria-labelledby="route-heading" className="w-full max-w-96">
        <BrandMark alt="Brixa" />
        <h1
          id="route-heading"
          tabIndex={-1}
          className="mt-4 mb-0 text-3xl leading-tight font-semibold tracking-tight text-heading sm:text-4xl"
        >
          {title}
        </h1>
        <p className="mt-2 mb-0 text-sm leading-relaxed text-muted">{description}</p>
        <form
          aria-labelledby="route-heading"
          aria-describedby={notice ? noticeId : undefined}
          method="post"
          noValidate={noValidate}
          className="mt-6 grid gap-4"
          onSubmit={onSubmit ?? ((event) => event.preventDefault())}
        >
          {children}
          {action && (
            <button
              type="submit"
              disabled={!onSubmit || pending || submitDisabled}
              className="mt-1 min-h-12 rounded-lg border-0 bg-brand px-4 text-sm font-semibold text-white [font-family:inherit] disabled:cursor-not-allowed"
            >
              {action}
            </button>
          )}
          {notice && (
            <p
              id={noticeId}
              role={notice.error ? 'alert' : 'status'}
              className={`m-0 leading-relaxed ${notice.error ? errorClass : 'text-xs text-muted'}`}
            >
              {notice.text}
            </p>
          )}
        </form>
      </section>
    </main>
  )
}

export function EmailField({ label, error }: { label: string; error?: string }) {
  const id = useId()
  return (
    <div className="grid gap-2">
      <label htmlFor={id} className="text-sm font-medium text-heading">
        {label}
      </label>
      <input
        id={id}
        name="email"
        type="email"
        autoComplete="username"
        required
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={inputClass}
      />
      {error && (
        <p id={`${id}-error`} className={`m-0 ${errorClass}`}>
          {error}
        </p>
      )}
    </div>
  )
}

export function PasswordField({
  label,
  name,
  showLabel,
  hideLabel,
  autoComplete,
  error,
  hint,
}: {
  label: string
  name?: string
  showLabel: string
  hideLabel: string
  autoComplete: 'current-password' | 'new-password'
  error?: string
  hint?: string
}) {
  const id = useId()
  const [visible, setVisible] = useState(false)
  const description = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ')
  return (
    <div className="grid gap-2">
      <label htmlFor={id} className="text-sm font-medium text-heading">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={name}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          required
          aria-invalid={error ? true : undefined}
          aria-describedby={description || undefined}
          spellCheck={false}
          autoCapitalize="none"
          className={`${inputClass} pr-14`}
        />
        <button
          type="button"
          aria-controls={id}
          aria-label={visible ? hideLabel : showLabel}
          onClick={() => setVisible((previous) => !previous)}
          className="absolute inset-y-0 right-0 grid w-12 cursor-pointer place-items-center rounded-lg border-0 bg-transparent p-0 text-muted hover:text-heading focus-visible:-outline-offset-4"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-5"
          >
            {visible ? (
              <path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.2A11 11 0 0 1 12 5c5 0 8.8 4.7 10 7a16 16 0 0 1-3 3.8M6.2 6.2A18 18 0 0 0 2 12c1.2 2.3 5 7 10 7 1.5 0 2.9-.4 4.2-1.1" />
            ) : (
              <>
                <path d="M2 12c1.2-2.3 5-7 10-7s8.8 4.7 10 7c-1.2 2.3-5 7-10 7s-8.8-4.7-10-7Z" />
                <circle cx="12" cy="12" r="2.5" />
              </>
            )}
          </svg>
        </button>
      </div>
      {hint && (
        <p id={`${id}-hint`} className="m-0 text-sm text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className={`m-0 ${errorClass}`}>
          {error}
        </p>
      )}
    </div>
  )
}
