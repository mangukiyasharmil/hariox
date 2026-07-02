import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, Phone, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import financeLogo from "@/assets/finance-logo.png";
import LanguageToggle from "./LanguageToggle";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePublicCompany } from "@/contexts/PublicCompanyContext";

interface HeaderProps {
  onApplyNow?: () => void;
}

const Header = ({ onApplyNow }: HeaderProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const { t } = useLanguage();
  const { company } = usePublicCompany();

  const logoSrc = company?.logo_url || financeLogo;
  const brandName = company?.name || "Credit Hariox";
  const supportPhone = company?.phone || "+91 9422799318";
  const supportPhoneClean = supportPhone.replace(/[\s+\-()]/g, "");
  
  const navLinks = [
    { label: t.home, anchor: "#home" },
    { label: t.services, href: "/services" },
    { label: t.aboutUs || "About Us", href: "/about-us" },
    { label: t.blog, href: "/blog" },
    { label: t.contact, href: "/contact-us" },
  ];
  
  const isHomePage = location.pathname === "/" || location.pathname === "";
  
  const getHref = (anchor: string) => {
    if (isHomePage) return anchor;
    return `/${anchor}`;
  };

  return (
    <>
      <header
        className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border animate-in fade-in slide-in-from-top-2 duration-300"
      >
        <div className="container mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-3">
              <img 
                src={logoSrc} 
                alt={brandName} 
                className="h-12 w-auto"
              />
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center gap-8">
              {navLinks.map((link) => (
                link.href ? (
                  <Link
                    key={link.label}
                    to={link.href}
                    className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors duration-300"
                  >
                    {link.label}
                  </Link>
                ) : isHomePage ? (
                  <a
                    key={link.label}
                    href={link.anchor}
                    className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors duration-300"
                  >
                    {link.label}
                  </a>
                ) : (
                  <Link
                    key={link.label}
                    to={getHref(link.anchor!)}
                    className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors duration-300"
                  >
                    {link.label}
                  </Link>
                )
              ))}
            </nav>

            {/* CTA Button */}
            <div className="hidden lg:flex items-center gap-3">
              <LanguageToggle />
              <a 
                href={`tel:${supportPhoneClean}`} 
                className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                <Phone className="w-4 h-4" />
                {supportPhone}
              </a>
              <Link
                to="/my-account"
                className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                <User className="w-4 h-4" />
                {t.login}
              </Link>
              <Button variant="hero" size="lg" onClick={onApplyNow}>
                {t.applyNow}
              </Button>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="lg:hidden p-2 text-foreground"
              aria-label="Toggle menu"
            >
              {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="lg:hidden bg-background border-t border-border"
            >
              <div className="container mx-auto px-6 py-6">
                <nav className="flex flex-col gap-4">
                  {navLinks.map((link) => (
                    link.href ? (
                      <Link
                        key={link.label}
                        to={link.href}
                        onClick={() => setIsOpen(false)}
                        className="text-lg font-medium text-foreground py-2"
                      >
                        {link.label}
                      </Link>
                    ) : isHomePage ? (
                      <a
                        key={link.label}
                        href={link.anchor}
                        onClick={() => setIsOpen(false)}
                        className="text-lg font-medium text-foreground py-2"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link
                        key={link.label}
                        to={getHref(link.anchor!)}
                        onClick={() => setIsOpen(false)}
                        className="text-lg font-medium text-foreground py-2"
                      >
                        {link.label}
                      </Link>
                    )
                  ))}
                  <Link
                    to="/my-account"
                    onClick={() => setIsOpen(false)}
                    className="text-lg font-medium text-foreground py-2 flex items-center gap-2"
                  >
                    <User className="w-5 h-5" />
                    {t.login}
                  </Link>
                  <div className="py-2">
                    <LanguageToggle />
                  </div>
                  <Button 
                    variant="hero" 
                    size="lg" 
                    className="mt-4 w-full"
                    onClick={() => {
                      setIsOpen(false);
                      onApplyNow?.();
                    }}
                  >
                    {t.applyNow}
                  </Button>
                </nav>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>
    </>
  );
};

export default Header;
