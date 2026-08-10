import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useLanguage, Language, languageNames } from '@/contexts/LanguageContext';
import { prefetchLocale } from '@/i18n/locale-loader';
import { Globe } from 'lucide-react';

// Show the language CODE (RU/UZ/…), not a flag emoji: Windows has no flag
// glyphs (they render as bare "RU" letters), and a flag is the wrong signal for
// a language anyway. Globe icon + code + an explicit aria-label for a11y.
export const LanguageSwitcher = () => {
  const { language, setLanguage } = useLanguage();

  const languages: Language[] = ['ru', 'uz', 'uz_cyrl', 'kz', 'kg', 'tj'];
  const code = (lang: Language) => lang.slice(0, 2).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="min-h-11 min-w-11 gap-1.5" aria-label={`Выбор языка: ${code(language)}`}>
          <Globe className="h-4 w-4" aria-hidden="true" />
          <span className="text-xs font-semibold">{code(language)}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[160px]">
        {languages.map((lang) => (
          <DropdownMenuItem
            key={lang}
            onClick={() => setLanguage(lang)}
            onFocus={() => prefetchLocale(lang)}
            onPointerEnter={() => prefetchLocale(lang)}
            aria-current={language === lang ? "true" : undefined}
            className={`min-h-11 cursor-pointer gap-3 focus:bg-accent focus:text-accent-foreground ${language === lang ? 'bg-accent' : ''}`}
          >
            <span className="w-6 text-xs font-semibold text-muted-foreground">{code(lang)}</span>
            <span>{languageNames[lang]}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
