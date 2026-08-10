import { Link } from "react-router-dom";
import { Instagram, Mail, Phone, MapPin, Send } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { BrandMark } from "@/components/shared/BrandMark";

const Footer = () => {
  const { t } = useLanguage();

  return (
    <footer className="bg-card border-t border-border/50">
      <div className="container mx-auto px-4 py-12">
        <div className="grid md:grid-cols-4 gap-8 mb-8">
          <div>
            <Link
              to="/"
              className="mb-4 inline-flex min-h-11 min-w-11 items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <BrandMark size="lg" />
            </Link>
            <p className="text-sm text-muted-foreground mb-4">{t('footer.description')}</p>
            <div className="flex gap-3">
              <a
                href="https://t.me/prodent_uz"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Telegram"
                className="flex h-11 w-11 items-center justify-center rounded-prodent-btn bg-primary/10 text-primary transition-all duration-150 hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <Send className="w-4 h-4" aria-hidden="true" />
              </a>
              <a
                href="https://instagram.com/prodent.uz"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                className="flex h-11 w-11 items-center justify-center rounded-prodent-btn bg-primary/10 text-primary transition-all duration-150 hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <Instagram className="w-4 h-4" aria-hidden="true" />
              </a>
            </div>
          </div>

          <div>
            <h3 className="font-heading font-bold mb-4">{t('footer.patients')}</h3>
            <ul className="text-sm text-muted-foreground">
              <li><Link to="/search" className="inline-flex min-h-11 min-w-11 items-center rounded-sm transition-colors duration-150 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{t('footer.findDoctor')}</Link></li>
              <li><Link to="/clinics" className="inline-flex min-h-11 min-w-11 items-center rounded-sm transition-colors duration-150 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{t('footer.clinics')}</Link></li>
              <li><Link to="/promotions" className="inline-flex min-h-11 min-w-11 items-center rounded-sm transition-colors duration-150 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{t('footer.promotions')}</Link></li>
              <li><Link to="/pricing" className="inline-flex min-h-11 min-w-11 items-center rounded-sm transition-colors duration-150 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{t('nav.pricing')}</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="font-heading font-bold mb-4">{t('footer.services')}</h3>
            <ul className="text-sm text-muted-foreground">
              <li><Link to="/search?service=implants" className="inline-flex min-h-11 min-w-11 items-center rounded-sm transition-colors duration-150 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{t('footer.implants')}</Link></li>
              <li><Link to="/search?service=braces" className="inline-flex min-h-11 min-w-11 items-center rounded-sm transition-colors duration-150 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{t('footer.braces')}</Link></li>
              <li><Link to="/search?service=whitening" className="inline-flex min-h-11 min-w-11 items-center rounded-sm transition-colors duration-150 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{t('footer.whitening')}</Link></li>
              <li><Link to="/search?service=veneers" className="inline-flex min-h-11 min-w-11 items-center rounded-sm transition-colors duration-150 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{t('footer.veneers')}</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="font-heading font-bold mb-4">{t('footer.contacts')}</h3>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <Phone className="w-4 h-4 flex-shrink-0 text-primary" aria-hidden="true" />
                <a href="tel:+998712000000" className="inline-flex min-h-11 min-w-11 items-center rounded-sm transition-colors duration-150 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">+998 71 200 00 00</a>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="w-4 h-4 flex-shrink-0 text-primary" aria-hidden="true" />
                <a href="mailto:info@prodent.uz" className="inline-flex min-h-11 min-w-11 items-center rounded-sm transition-colors duration-150 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">info@prodent.uz</a>
              </li>
              <li className="flex items-start gap-2">
                <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0 text-primary" aria-hidden="true" />
                <span>{t('footer.address')}</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-border/50 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} PRODENT. {t('footer.rights')}.</p>
          <div className="flex max-w-full flex-wrap justify-center gap-x-4 gap-y-2 text-center">
            <Link to="/privacy" className="inline-flex min-h-11 min-w-11 items-center rounded-sm transition-colors duration-150 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{t('footer.privacy')}</Link>
            <Link to="/terms" className="inline-flex min-h-11 min-w-11 items-center rounded-sm transition-colors duration-150 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{t('footer.terms')}</Link>
            <Link to="/contacts" className="inline-flex min-h-11 min-w-11 items-center rounded-sm transition-colors duration-150 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{t('footer.contacts')}</Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
