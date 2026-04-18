import { Link } from "react-router-dom";
import { Facebook, Instagram, Youtube, Mail, Phone, MapPin, Send } from "lucide-react";
import prodentLogo from "@/assets/prodent-logo.png";
import { useLanguage } from "@/contexts/LanguageContext";

const Footer = () => {
  const { t } = useLanguage();

  return (
    <footer className="bg-card border-t border-border/50">
      <div className="container mx-auto px-4 py-12">
        <div className="grid md:grid-cols-4 gap-8 mb-8">
          <div>
            <Link to="/" className="inline-block mb-4">
              <img src={prodentLogo} alt="PRODENT" className="h-12 object-contain" />
            </Link>
            <p className="text-sm text-muted-foreground mb-4">{t('footer.description')}</p>
            <div className="flex gap-3">
              <a href="#" className="w-9 h-9 rounded-prodent-btn bg-silk-jade/10 flex items-center justify-center hover:bg-silk-jade hover:text-white transition-all duration-150">
                <Facebook className="w-4 h-4" />
              </a>
              <a href="#" className="w-9 h-9 rounded-prodent-btn bg-silk-jade/10 flex items-center justify-center hover:bg-silk-jade hover:text-white transition-all duration-150">
                <Instagram className="w-4 h-4" />
              </a>
              <a href="#" className="w-9 h-9 rounded-prodent-btn bg-silk-jade/10 flex items-center justify-center hover:bg-silk-jade hover:text-white transition-all duration-150">
                <Youtube className="w-4 h-4" />
              </a>
              <a href="#" className="w-9 h-9 rounded-prodent-btn bg-silk-jade/10 flex items-center justify-center hover:bg-silk-jade hover:text-white transition-all duration-150">
                <Send className="w-4 h-4" />
              </a>
            </div>
          </div>

          <div>
            <h3 className="font-heading font-bold mb-4">{t('footer.patients')}</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/search" className="hover:text-silk-jade transition-colors duration-150">{t('footer.findDoctor')}</Link></li>
              <li><Link to="/clinics" className="hover:text-silk-jade transition-colors duration-150">{t('footer.clinics')}</Link></li>
              <li><Link to="/promotions" className="hover:text-silk-jade transition-colors duration-150">{t('footer.promotions')}</Link></li>
              <li><Link to="/reviews" className="hover:text-silk-jade transition-colors duration-150">{t('footer.reviews')}</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="font-heading font-bold mb-4">{t('footer.services')}</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/search?service=implants" className="hover:text-silk-jade transition-colors duration-150">{t('footer.implants')}</Link></li>
              <li><Link to="/search?service=braces" className="hover:text-silk-jade transition-colors duration-150">{t('footer.braces')}</Link></li>
              <li><Link to="/search?service=whitening" className="hover:text-silk-jade transition-colors duration-150">{t('footer.whitening')}</Link></li>
              <li><Link to="/search?service=veneers" className="hover:text-silk-jade transition-colors duration-150">{t('footer.veneers')}</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="font-heading font-bold mb-4">{t('footer.contacts')}</h3>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <Phone className="w-4 h-4 mt-0.5 flex-shrink-0 text-silk-jade" />
                <a href="tel:+998712000000" className="hover:text-silk-jade transition-colors duration-150">+998 71 200 00 00</a>
              </li>
              <li className="flex items-start gap-2">
                <Mail className="w-4 h-4 mt-0.5 flex-shrink-0 text-silk-jade" />
                <a href="mailto:info@prodent.uz" className="hover:text-silk-jade transition-colors duration-150">info@prodent.uz</a>
              </li>
              <li className="flex items-start gap-2">
                <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0 text-silk-jade" />
                <span>{t('footer.address')}</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-border/50 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
          <p>© 2024 PRODENT. {t('footer.rights')}.</p>
          <div className="flex gap-6">
            <Link to="/privacy" className="hover:text-silk-jade transition-colors duration-150">{t('footer.privacy')}</Link>
            <Link to="/terms" className="hover:text-silk-jade transition-colors duration-150">{t('footer.terms')}</Link>
            <Link to="/contacts" className="hover:text-silk-jade transition-colors duration-150">{t('footer.contacts')}</Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
