import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Language, Translations, translations } from "@/i18n/translations";

// Map Indian states/regions to languages
const stateLanguageMap: Record<string, Language> = {
  // Tamil-speaking states
  "tamil nadu": "ta",
  "puducherry": "ta",
  "pondicherry": "ta",
  // Hindi-speaking states (Hindi belt)
  "uttar pradesh": "hi",
  "madhya pradesh": "hi",
  "bihar": "hi",
  "rajasthan": "hi",
  "haryana": "hi",
  "himachal pradesh": "hi",
  "uttarakhand": "hi",
  "jharkhand": "hi",
  "chhattisgarh": "hi",
  "delhi": "hi",
  "new delhi": "hi",
  "chandigarh": "hi",
};

const detectLanguageFromRegion = (region: string): Language => {
  const lower = region.toLowerCase().trim();
  return stateLanguageMap[lower] || "en";
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Translations;
}

const LanguageContext = createContext<LanguageContextType>({
  language: "en",
  setLanguage: () => {},
  t: translations.en,
});

export const useLanguage = () => useContext(LanguageContext);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem("app_language");
    return (saved as Language) || "en";
  });

  // Auto language detection removed — always default to English
  // Users can manually switch language using the toggle

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem("app_language", lang);
  };

  const t = translations[language];

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};
