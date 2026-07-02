import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, Phone, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import ApplicationModal from "../ApplicationModal";
import LanguageToggle from "../LanguageToggle";
import { useLanguage } from "@/contexts/LanguageContext";
import capitalLogo from "@/assets/hariox-logo-full.png";

const CapitalHeader = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const location = useLocation();
  const { t } = useLanguage();

  const navLinks = [
    { label: t.home, anchor: "#home" },
    { label: t.loans, anchor: "#services" },
    { label: t.howItWorks, anchor: "#process" },
    { label: t.emiCalculator, anchor: "#calculator" },
    { label: t.aboutUs || "About Us", href: "/about-us" },
    { label: "Services", href: "/services" },
    { label: "FAQs", href: "/faq" },
    { label: t.contact, href: "/contact-us" },
  ];
  
  // Check if we're on the home page
  const isHomePage = location.pathname === "/" || location.pathname === "";
  const baseUrl = "/";

  // Get the correct href for navigation links
  const getHref = (anchor: string) => {
    if (isHomePage) {
      return anchor;
    }
    return `${baseUrl}${anchor}`;
  };

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-100 shadow-sm">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="flex items-center justify-between h-16 lg:h-20">
            {/* Logo */}
            <Link to={baseUrl} className="flex items-center gap-2">
              <img 
                src={capitalLogo} 
                alt="Capital Hariox" 
                className="h-9 lg:h-11 w-auto"
              />
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center gap-8">
              {navLinks.map((link) => (
                link.href ? (
                  <Link
                    key={link.label}
                    to={link.href}
                    className="text-gray-600 hover:text-emerald-600 font-medium text-sm transition-colors relative group"
                  >
                    {link.label}
                    <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-emerald-500 transition-all group-hover:w-full" />
                  </Link>
                ) : isHomePage ? (
                  <a
                    key={link.label}
                    href={link.anchor}
                    className="text-gray-600 hover:text-emerald-600 font-medium text-sm transition-colors relative group"
                  >
                    {link.label}
                    <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-emerald-500 transition-all group-hover:w-full" />
                  </a>
                ) : (
                  <Link
                    key={link.label}
                    to={getHref(link.anchor!)}
                    className="text-gray-600 hover:text-emerald-600 font-medium text-sm transition-colors relative group"
                  >
                    {link.label}
                    <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-emerald-500 transition-all group-hover:w-full" />
                  </Link>
                )
              ))}
            </nav>

            {/* Desktop CTA */}
            <div className="hidden lg:flex items-center gap-3">
              <LanguageToggle />
              <a 
                href="tel:+919422799318" 
                className="flex items-center gap-2 text-gray-600 hover:text-emerald-600 transition-colors"
              >
                <Phone className="w-4 h-4" />
                <span className="text-sm font-medium">+91 9422799318</span>
              </a>
              <Link
                to="/my-account"
                className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-emerald-600 transition-colors"
              >
                <User className="w-4 h-4" />
                {t.login}
              </Link>
              <Button 
                className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold px-6 py-2 rounded-full shadow-lg shadow-emerald-500/20"
                onClick={() => setIsModalOpen(true)}
              >
                {t.applyNow}
              </Button>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="lg:hidden p-2 text-gray-600"
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
              className="lg:hidden bg-white border-t border-gray-100"
            >
              <nav className="container mx-auto px-4 py-4 space-y-3">
                {navLinks.map((link) => (
                  link.href ? (
                    <Link
                      key={link.label}
                      to={link.href}
                      onClick={() => setIsOpen(false)}
                      className="block py-2 text-gray-700 hover:text-emerald-600 font-medium"
                    >
                      {link.label}
                    </Link>
                  ) : isHomePage ? (
                    <a
                      key={link.label}
                      href={link.anchor}
                      onClick={() => setIsOpen(false)}
                      className="block py-2 text-gray-700 hover:text-emerald-600 font-medium"
                    >
                      {link.label}
                    </a>
                  ) : (
                    <Link
                      key={link.label}
                      to={getHref(link.anchor!)}
                      onClick={() => setIsOpen(false)}
                      className="block py-2 text-gray-700 hover:text-emerald-600 font-medium"
                    >
                      {link.label}
                    </Link>
                  )
                ))}
                <Link
                  to="/my-account"
                  onClick={() => setIsOpen(false)}
                  className="block py-2 text-gray-700 hover:text-emerald-600 font-medium flex items-center gap-2"
                >
                  <User className="w-5 h-5" />
                  {t.login}
                </Link>
                <div className="py-2">
                  <LanguageToggle />
                </div>
                <Button
                  className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold py-3 rounded-full mt-4"
                  onClick={() => {
                    setIsOpen(false);
                    setIsModalOpen(true);
                  }}
                >
                  {t.applyNow}
                </Button>
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <ApplicationModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
};

export default CapitalHeader;
