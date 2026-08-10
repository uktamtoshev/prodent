import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      // Cap the container at every breakpoint, not just 2xl. Previously the
      // container had no max-width below 1536px, so on common 1280–1500px
      // screens the hero/sections stretched edge-to-edge and looked ragged
      // against the max-w-6xl blocks below them.
      screens: {
        sm: "640px",
        md: "768px",
        lg: "1024px",
        xl: "1280px",
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ['InterVariable', 'Inter', 'system-ui', 'sans-serif'],
        heading: ['Manrope', 'InterVariable', 'Inter', 'system-ui', 'sans-serif'],
        // `font-display` is written in 75 places — every module wordmark
        // ("PRODENT Маркет", "PRODENT Склад", …) among them — but was never
        // defined here, so the class was inert and the brand rendered in Inter.
        // Same stack as `heading`; Manrope is already loaded in index.html.
        display: ['Manrope', 'InterVariable', 'Inter', 'system-ui', 'sans-serif'],
        // IBM Plex *Sans* is proportional — `font-mono` silently produced
        // non-aligning "monospace" columns. JetBrains Mono is referenced by
        // .font-mono-jb but never loaded in index.html either. Use the OS mono
        // font: genuinely monospaced, zero extra bytes on mobile 4G.
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
        arabic: ['Tajawal', 'InterVariable', 'Inter', 'system-ui', 'sans-serif'],
      },
      // Per ops/typography-guidelines.md — CRM-density scale (base = 14px).
      // Overrides Tailwind defaults so text-base/sm/lg shrink to fit dense
      // medical tables. xs (12px) is the WCAG floor — anything smaller is banned.
      fontSize: {
        xs:   ['12px', { lineHeight: '1.4',  fontWeight: '500' }],
        sm:   ['13px', { lineHeight: '1.45' }],
        base: ['14px', { lineHeight: '1.5'  }],
        lg:   ['16px', { lineHeight: '1.3',  fontWeight: '600' }],
        xl:   ['20px', { lineHeight: '1.25', fontWeight: '600' }],
        '2xl':['24px', { lineHeight: '1.2',  fontWeight: '700' }],
        '3xl':['32px', { lineHeight: '1.1',  fontWeight: '700' }],

        // Рабочие размеры кабинета из макета. Заведены токенами намеренно:
        // контракт cabinet-design-debt держит потолок на произвольные размеры
        // вида text-[13.5px], и запас там — две единицы на весь кабинет.
        cell: ['13.5px', { lineHeight: '1.45' }],              // таблицы, списки, вкладки, кнопки
        meta: ['12.5px', { lineHeight: '1.4'  }],              // подписи KPI, вторая строка списка
        kpi:  ['26px',   { lineHeight: '1.2',  fontWeight: '700', letterSpacing: '-0.02em' }],
      },
      letterSpacing: {
        tightest: '-0.02em',  // legacy — keep for Manrope page headers
        tight:    '-0.01em',
        normal:   '0',
        wide:     '0.02em',
        wider:    '0.08em',
      },
      colors: {
        // Accessible defaults: slate-400 was too pale for the small helper text
        // used throughout dense cards, and emerald-500 failed with white labels.
        slate: {
          400: "#475569",
          500: "#334155",
        },
        emerald: {
          500: "#047857",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // Вторая поверхность внутри карточки (шапка таблицы и подобные полосы).
        "surface-2": "hsl(var(--surface-2))",
        // Design-system brand scale
        brand: {
          DEFAULT: "hsl(var(--brand))",
          50: "hsl(var(--brand-50))",
          100: "hsl(var(--brand-100))",
          700: "hsl(var(--brand-700))",
        },
        // Named brand accents referenced across the marketing site (Footer, Hero,
        // Header, About, password-input focus ring). These were used in classes
        // (text-silk-jade, bg-silk-jade/10, ring-silk-jade, tashkent-sky, …) but
        // never defined, so the classes silently no-op'd. Defined here on-brand with
        // an <alpha-value> placeholder so opacity modifiers (e.g. /10) work.
        "silk-jade": "hsl(168 76% 36% / <alpha-value>)",
        "oriental-emerald": "hsl(152 69% 31% / <alpha-value>)",
        "tashkent-sky": "hsl(199 89% 48% / <alpha-value>)",
        "desert-gold": "hsl(38 92% 50% / <alpha-value>)",
        // PRODENT Brand Colors - XMed Style
        "teal-primary": "hsl(175 82% 32%)",
        "teal-light": "hsl(175 60% 45%)",
        "teal-dark": "hsl(180 55% 25%)",
        "teal-bg": "hsl(180 20% 98%)",
        "cream-white": "hsl(60 20% 99%)",
        "mist-gray": "hsl(180 15% 93%)",
        "ink-gray": "hsl(200 25% 15%)",
        "success-green": "hsl(var(--success-green) / <alpha-value>)",
        "warning-amber": "hsl(var(--warning-amber) / <alpha-value>)",
        // Status semantics — always use the matching pair, e.g.
        // `bg-status-success-bg text-status-success`. Both themes are AA.
        // Never encode a status with colour alone: add an icon or a label.
        status: {
          success: "hsl(var(--status-success) / <alpha-value>)",
          "success-bg": "hsl(var(--status-success-bg) / <alpha-value>)",
          warning: "hsl(var(--status-warning) / <alpha-value>)",
          "warning-bg": "hsl(var(--status-warning-bg) / <alpha-value>)",
          danger: "hsl(var(--status-danger) / <alpha-value>)",
          "danger-bg": "hsl(var(--status-danger-bg) / <alpha-value>)",
          info: "hsl(var(--status-info) / <alpha-value>)",
          "info-bg": "hsl(var(--status-info-bg) / <alpha-value>)",
          neutral: "hsl(var(--status-neutral) / <alpha-value>)",
          "neutral-bg": "hsl(var(--status-neutral-bg) / <alpha-value>)",
        },
        // Star ratings: a positive signal, not a warning state. `rating-muted`
        // is the empty half of the scale.
        rating: {
          DEFAULT: "hsl(var(--rating) / <alpha-value>)",
          muted: "hsl(var(--rating-muted) / <alpha-value>)",
        },
        // Surround under user media (radiographs, photos). Intentionally the
        // same in both themes — see src/index.css.
        scrim: "hsl(var(--scrim) / <alpha-value>)",
        // FDI tooth-chart states. Always use the pair, e.g.
        // `bg-tooth-caries-bg text-tooth-caries border-tooth-caries`, and
        // always ship a letter code / legend next to the colour.
        tooth: {
          healthy: "hsl(var(--tooth-healthy) / <alpha-value>)",
          "healthy-bg": "hsl(var(--tooth-healthy-bg) / <alpha-value>)",
          watch: "hsl(var(--tooth-watch) / <alpha-value>)",
          "watch-bg": "hsl(var(--tooth-watch-bg) / <alpha-value>)",
          caries: "hsl(var(--tooth-caries) / <alpha-value>)",
          "caries-bg": "hsl(var(--tooth-caries-bg) / <alpha-value>)",
          perio: "hsl(var(--tooth-perio) / <alpha-value>)",
          "perio-bg": "hsl(var(--tooth-perio-bg) / <alpha-value>)",
          endo: "hsl(var(--tooth-endo) / <alpha-value>)",
          "endo-bg": "hsl(var(--tooth-endo-bg) / <alpha-value>)",
          filling: "hsl(var(--tooth-filling) / <alpha-value>)",
          "filling-bg": "hsl(var(--tooth-filling-bg) / <alpha-value>)",
          crown: "hsl(var(--tooth-crown) / <alpha-value>)",
          "crown-bg": "hsl(var(--tooth-crown-bg) / <alpha-value>)",
          implant: "hsl(var(--tooth-implant) / <alpha-value>)",
          "implant-bg": "hsl(var(--tooth-implant-bg) / <alpha-value>)",
          removed: "hsl(var(--tooth-removed) / <alpha-value>)",
          "removed-bg": "hsl(var(--tooth-removed-bg) / <alpha-value>)",
        },
        // Mint Sidebar Colors
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-bg))",
          border: "hsl(var(--sidebar-border))",
          hover: "hsl(var(--sidebar-item-hover))",
          active: "hsl(var(--sidebar-item-active))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-light": "hsl(var(--sidebar-accent-light))",
          text: "hsl(var(--sidebar-text))",
          muted: "hsl(var(--sidebar-text-muted))",
        },
      },
      backgroundImage: {
        'gradient-primary': 'var(--gradient-primary)',
        'gradient-jade': 'var(--gradient-jade)',
        'gradient-gold': 'var(--gradient-gold)',
        'gradient-sky': 'var(--gradient-sky)',
        'gradient-hero': 'var(--gradient-hero)',
        'gradient-card': 'var(--gradient-card)',
        'gradient-glow': 'var(--gradient-glow)',
        'gradient-mesh': 'var(--gradient-mesh)',
      },
      boxShadow: {
        'card': 'var(--shadow-card)',
        'soft': 'var(--shadow-soft)',
        'medium': 'var(--shadow-medium)',
        'strong': 'var(--shadow-strong)',
        'glow': 'var(--shadow-glow)',
        'glass': 'var(--shadow-glass)',
        'prodent': '0px 8px 24px rgba(0, 0, 0, 0.06)',
      },
      transitionTimingFunction: {
        'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
        'bounce': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        "xl": "0.875rem",
        "2xl": "1rem",
        "3xl": "1.5rem",
        "prodent": "14px",
        "prodent-btn": "12px",
        "prodent-input": "10px",
        // Радиусы макета: панель 10px, поле 8px.
        "panel": "10px",
        "field": "8px",
      },
      spacing: {
        // Плотность кабинета из макета. Даёт h-row, p-card-x, gap-section и т.п.
        // ВАЖНО: h-ctl (36px) — это НИЖЕ нормы тач-цели 44px. Любой элемент
        // управления, ужатый до h-ctl, обязан нести класс cabinet-control:
        // на касании он возвращает 44px (правило в index.css).
        'row': '42px',        // строка таблицы
        'row-head': '36px',   // шапка таблицы
        'card-x': '14px',     // внутренний отступ карточки по горизонтали
        'card-y': '11px',     // шапка карточки по вертикали
        'section': '13px',    // шаг между секциями и колонками
        'ctl': '36px',        // кнопка и поле
        'ctl-sm': '29px',     // малая кнопка
        'prodent-btn': '48px',
        // The cabinet top bar's height, as a token. `h-cabinet-topbar` on the
        // bar itself, `h-cabinet` for everything that must fill what's left.
        'cabinet-topbar': 'var(--cabinet-topbar-h)',
      },
      height: {
        cabinet: 'calc(100dvh - var(--cabinet-topbar-h))',
      },
      minHeight: {
        cabinet: 'calc(100dvh - var(--cabinet-topbar-h))',
      },
      maxHeight: {
        cabinet: 'calc(100dvh - var(--cabinet-topbar-h))',
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "prodent-fade-in": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(40px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "slide-up": {
          "0%": { opacity: "0", transform: "translateY(40px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.95)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.7" },
        },
        "float": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-15px)" },
        },
        "spin-slow": {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        "blob": {
          "0%": { transform: "translate(0px, 0px) scale(1)" },
          "33%": { transform: "translate(30px, -50px) scale(1.1)" },
          "66%": { transform: "translate(-20px, 20px) scale(0.9)" },
          "100%": { transform: "translate(0px, 0px) scale(1)" },
        },
        "shimmer": {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "underline-slide": {
          "0%": { transform: "scaleX(0)", transformOrigin: "left" },
          "100%": { transform: "scaleX(1)", transformOrigin: "left" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "prodent-fade-in": "prodent-fade-in 150ms ease-out forwards",
        "fade-in": "fade-in 0.5s ease-out forwards",
        "fade-in-up": "fade-in-up 0.6s ease-out forwards",
        "slide-up": "slide-up 0.5s ease-out forwards",
        "scale-in": "scale-in 0.3s ease-out forwards",
        "pulse-soft": "pulse-soft 2s ease-in-out infinite",
        "float": "float 6s ease-in-out infinite",
        "spin-slow": "spin-slow 20s linear infinite",
        "blob": "blob 7s infinite",
        "shimmer": "shimmer 1.5s infinite",
        "underline-slide": "underline-slide 200ms ease-out forwards",
      },
    },
  },
  plugins: [tailwindcssAnimate],
} satisfies Config;
