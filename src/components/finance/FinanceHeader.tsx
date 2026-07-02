import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, Phone, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import FinanceApplicationModal from "./FinanceApplicationModal";
import financeLogo from "@/assets/finance-logo.png";

const FinanceHeader = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const location = useLocation();

  const isHomePage = location.pathname === "/" || location.pathname === "";

  const navLinks = [
    { label: "Home", href: "/" },
    { label: "About Us", href: "/about-us" },
    { label: "Services", href: "/services" },
    { label: "Blog", href: "/blog" },
    { label: "Contact", href: "/contact-us" },
  ];

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-lg border-b border-border/60">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="flex items-center justify-between h-16 lg:h-[72px]">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 shrink-0">
              <img
                src={financeLogo}
                alt="Finance Hariox"
                className="h-9 lg:h-11 w-auto"
              />
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center gap-1">
              {navLinks.map((link) => {
                const isActive = location.pathname === link.href;
                return (
                  <Link
                    key={link.label}
                    to={link.href}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? "text-primary bg-primary/8"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>

            {/* Desktop CTA */}
            <div className="hidden lg:flex items-center gap-4">
              <a
                href="tel:+919422799318"
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <Phone className="w-4 h-4" />
                <span className="text-sm font-medium">+91 94227 99318</span>
              </a>
              <Button
                size="sm"
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-6 rounded-lg shadow-sm"
                onClick={() => setIsModalOpen(true)}
              >
                Apply Now
              </Button>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="lg:hidden p-2 text-foreground rounded-lg hover:bg-muted/60 transition-colors"
              aria-label="Toggle menu"
            >
              {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
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
              transition={{ duration: 0.2 }}
              className="lg:hidden bg-background border-t border-border/60 shadow-lg"
            >
              <nav className="container mx-auto px-4 py-3 space-y-1">
                {navLinks.map((link) => {
                  const isActive = location.pathname === link.href;
                  return (
                    <Link
                      key={link.label}
                      to={link.href}
                      onClick={() => setIsOpen(false)}
                      className={`block px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                        isActive
                          ? "text-primary bg-primary/8"
                          : "text-foreground hover:bg-muted/60"
                      }`}
                    >
                      {link.label}
                    </Link>
                  );
                })}
                <div className="pt-3 border-t border-border/40">
                  <a
                    href="tel:+919422799318"
                    className="flex items-center gap-2 px-4 py-2.5 text-muted-foreground text-sm"
                  >
                    <Phone className="w-4 h-4" />
                    +91 94227 99318
                  </a>
                  <Button
                    className="w-full mt-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                    onClick={() => {
                      setIsOpen(false);
                      setIsModalOpen(true);
                    }}
                  >
                    Apply Now
                  </Button>
                </div>
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <FinanceApplicationModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
};

export default FinanceHeader;
