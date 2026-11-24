import { useTranslation, Trans } from "react-i18next";
import { LanguageSelector } from "./components/LanguageSelector.jsx";

export function useAppContent() {
  const { t } = useTranslation();
  return {
    LanguageSelector,
    t: (key) => t(key),
    EditInstruction: () => (
      <Trans
        i18nKey="launchpad.edit"
        components={{
          codeFile: <code />,
          codeHmr: <code />,
        }}
      />
    ),
  };
}
