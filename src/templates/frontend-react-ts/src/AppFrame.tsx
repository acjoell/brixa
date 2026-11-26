import type { ReactNode } from 'react'
import { ThemeSelector } from './ThemeSelector.tsx'
import { useAppContent } from './useAppContent.tsx'

const brandPath = `${import.meta.env.BASE_URL}brand/`
const repository = 'https://github.com/acjoell/brixa'

export function BrandMark({ alt = '' }: { alt?: string }) {
  return (
    <img
      src={`${brandPath}logo.png`}
      width="848"
      height="939"
      alt={alt}
      className="h-auto w-8 shrink-0 rounded-md"
    />
  )
}

export function AppFrame({
  projectName = '',
  initialThemePreference,
  navigation,
  compact = false,
  children,
}: {
  projectName?: string
  initialThemePreference?: string
  navigation?: ReactNode
  compact?: boolean
  children: ReactNode
}) {
  const { LanguageSelector, t } = useAppContent()

  return (
    <div className="flex min-h-svh flex-col">
      <header className={compact ? undefined : 'border-b border-line'}>
        <div
          className={
            compact
              ? 'flex justify-end px-5 py-3 sm:px-8'
              : 'mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-8 gap-y-4 px-5 py-4 sm:px-8'
          }
        >
          {!compact && (
            <div className="flex min-w-0 items-center gap-3">
              <BrandMark />
              <div className="min-w-0">
                <p className="m-0 text-sm font-semibold text-heading">Brixa</p>
                <p className="m-0 text-xs text-muted [overflow-wrap:anywhere]">{projectName}</p>
              </div>
            </div>
          )}
          <nav
            role={compact ? 'presentation' : undefined}
            aria-label={compact ? undefined : t('nav.label')}
            className={
              compact
                ? 'flex flex-wrap items-center justify-end gap-3 text-sm text-muted'
                : 'flex flex-wrap items-center gap-x-5 gap-y-3 text-sm text-muted'
            }
          >
            {!compact && (
              <>
                <a className="hover:text-heading" href={`${repository}#readme`}>
                  {t('nav.docs')}
                </a>
                <a className="hover:text-heading" href={repository}>
                  GitHub
                </a>
                {navigation}
              </>
            )}
            <LanguageSelector />
            <ThemeSelector t={t} initialPreference={initialThemePreference} />
          </nav>
        </div>
      </header>

      {children}

      {!compact && (
        <footer className="border-t border-line">
          <p className="m-0 mx-auto max-w-6xl px-5 py-5 text-sm text-muted sm:px-8">
            {t('footer.tagline')}
          </p>
        </footer>
      )}
    </div>
  )
}
