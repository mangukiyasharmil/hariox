import { Globe } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Language, languageFlags } from "@/i18n/translations";

const languages: { code: Language; label: string; flag: string }[] = [
  { code: "en", label: "EN", flag: "EN" },
  { code: "hi", label: "हिंदी", flag: "हि" },
  { code: "ta", label: "தமிழ்", flag: "த" },
];

interface LanguageToggleProps {
  variant?: "default" | "compact";
}

const LanguageToggle = ({ variant = "default" }: LanguageToggleProps) => {
  const { language, setLanguage } = useLanguage();

  return (
    <div className="flex items-center gap-0.5 bg-muted rounded-full p-0.5">
      {languages.map((lang) => (
        <button
          key={lang.code}
          onClick={() => setLanguage(lang.code)}
          className={`px-2 py-1 text-xs font-medium rounded-full transition-all ${
            language === lang.code
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
          title={lang.label}
        >
          {lang.flag}
        </button>
      ))}
    </div>
  );
};

export default LanguageToggle;
