import { useTranslation, Trans } from 'react-i18next'
import { LanguageSelector } from './components/LanguageSelector.jsx'

export function useAppContent() {
  const { t } = useTranslation()
  return {
    LanguageSelector,
    t: (key, params) => t(key, params),
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
