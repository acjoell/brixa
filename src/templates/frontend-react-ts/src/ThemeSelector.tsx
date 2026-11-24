import { useEffect, useState } from 'react'
import type { AppContent } from './appContent.types'

type Theme = 'system' | 'light' | 'dark'

const icons: Record<Theme, string> = {
  system: 'M3 4h18v12H3zM8 20h8m-4-4v4',
  light:
    'M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  dark: 'M21 13.2A9 9 0 0 1 10.8 3 9 9 0 1 0 21 13.2Z',
}

export function ThemeSelector({
  t,
  initialPreference,
}: {
  t: AppContent['t']
  initialPreference?: string
}) {
  const [preference, setPreference] = useState<Theme>(
    initialPreference === 'light' || initialPreference === 'dark' ? initialPreference : 'system',
  )

  useEffect(() => {
    const root = document.documentElement
    root.dataset.themePreference = preference

    if (preference !== 'system') {
      root.dataset.theme = preference
      return
    }

    const system = globalThis.matchMedia('(prefers-color-scheme: dark)')
    const sync = () => {
      root.dataset.theme = system.matches ? 'dark' : 'light'
    }

    sync()
    system.addEventListener('change', sync)
    return () => system.removeEventListener('change', sync)
  }, [preference])

  function selectTheme(theme: Theme) {
    setPreference(theme)
    try {
      globalThis.localStorage.setItem('brixa-theme', theme)
    } catch {
      // The selected theme still applies for this visit.
    }
  }

  return (
    <fieldset className="m-0 inline-flex min-w-0 gap-1 rounded-lg border border-control bg-panel p-1">
      <legend className="sr-only">{t('theme.label')}</legend>
      {(['system', 'light', 'dark'] as const).map((theme) => (
        <label key={theme} className="relative cursor-pointer">
          <input
            type="radio"
            name="brixa-theme"
            className="peer sr-only"
            checked={preference === theme}
            onChange={() => selectTheme(theme)}
          />
          <span className="flex size-8 items-center justify-center rounded-md text-muted peer-checked:bg-brand peer-checked:text-white peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent">
            <svg
              aria-hidden="true"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d={icons[theme]} />
            </svg>
          </span>
          <span className="sr-only">{t(`theme.${theme}`)}</span>
        </label>
      ))}
    </fieldset>
  )
}
