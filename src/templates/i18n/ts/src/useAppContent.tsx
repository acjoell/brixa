import { useTranslation, Trans } from 'react-i18next'
import { LanguageSelector } from './components/LanguageSelector.tsx'
import type { AppContent } from './appContent.types'

export function useAppContent(): AppContent {
  const { t } = useTranslation()
  return {
    LanguageSelector,
    t: (key, fallback = key) => t(key, { defaultValue: fallback }),
    EditInstruction: () => (
      <Trans
        i18nKey="launchpad.edit"
        components={{
          codeFile: <code />,
          codeHmr: <code />,
        }}
      />
    ),
  }
}
