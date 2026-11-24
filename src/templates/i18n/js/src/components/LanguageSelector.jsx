import { useTranslation } from "react-i18next";

export function LanguageSelector() {
  const { t, i18n } = useTranslation();

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="language-select">{t("selector.label")}</label>
      <select
        id="language-select"
        className="min-h-9 rounded-md border border-control bg-panel px-2 py-1 text-sm text-heading"
        value={i18n.resolvedLanguage}
        onChange={(e) => {
          void i18n.changeLanguage(e.target.value);
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
  );
}
