import { useTranslation, Trans } from 'react-i18next'
import { LanguageSelector } from './components/LanguageSelector.tsx'
import type { AppContent, MessageKey } from './appContent.types'

export function useAppContent(): AppContent {
  const { t } = useTranslation()
  return {
    LanguageSelector,
    t: (key: MessageKey, params?: { val?: number }) => t(key, params),
    EditInstruction: () => (
      <Trans
        i18nKey="home.edit"
        components={{
          codeFile: <code />,
          codeHmr: <code />,
        }}
      />
    ),
  }
}
