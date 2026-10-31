import { useTranslation } from 'react-i18next'

export function LanguageSelector() {
  const { t, i18n } = useTranslation()

  return (
    <div style={{ marginBottom: '1rem' }}>
      <label htmlFor="language-select">{t('selector.label')}: </label>
      <select
        id="language-select"
        value={i18n.resolvedLanguage}
        onChange={(e) => {
          void i18n.changeLanguage(e.target.value)
        }}
      >
        <option value="en" lang="en">
          English
        </option>
        <option value="es" lang="es">
          Español
        </option>
      </select>
    </div>
  )
}
