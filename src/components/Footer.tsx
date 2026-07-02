import { Link, useLocation } from "react-router-dom";
import { Mail, Phone, MapPin } from "lucide-react";
import WhatsAppIcon from "@/components/ui/whatsapp-icon";
import financeLogo from "@/assets/finance-logo.png";
import { usePublicCompany } from "@/contexts/PublicCompanyContext";

const quickLinks = [
  { label: "Home", anchor: "#home" },
  { label: "About Us", href: "/about-us" },
  { label: "Services", href: "/services" },
  { label: "Blog", href: "/blog" },
  { label: "Contact Us", href: "/contact-us" },
  { label: "My Account", href: "/my-account" },
  { label: "Privacy Policy", href: "/privacy-policy" },
  { label: "Terms & Conditions", href: "/terms-conditions" },
  { label: "Refund Policy", href: "/refund-policy" },
];

const Footer = () => {
  const location = useLocation();
  const isHomePage = location.pathname === "/" || location.pathname === "";
  const { company } = usePublicCompany();

  const logoSrc = company?.logo_url || financeLogo;
  const brandName = company?.name || "Credit Hariox";
  const supportPhone = company?.phone || "+91 9422799318";
  const supportPhoneClean = supportPhone.replace(/[\s+\-()]/g, "");
  const supportWhatsapp = company?.whatsapp_number || "918469391818";
  const supportWhatsappClean = supportWhatsapp.replace(/[\s+\-()]/g, "");
  const supportEmail = company?.email || "hariox@gmail.com";
  const address = company?.address || "D-1, 1st Floor, Yogi Nagar,\nNr. Silver Business Hub, Bapa Sitaram Chowk,\nSimada, Surat, Gujarat — 395006, India";
  
  const getHref = (anchor: string) => {
    if (isHomePage) return anchor;
    return `/${anchor}`;
  };

  return (
    <footer className="bg-[hsl(220,25%,12%)] text-white">
      <div className="container mx-auto px-6 lg:px-8">
        {/* Main Footer */}
        <div className="py-12 lg:py-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-8">
          {/* Brand Column */}
          <div>
            <img 
              src={logoSrc} 
              alt={brandName} 
              className="h-12 w-auto mb-5 rounded-lg bg-white p-1.5"
            />
            <p className="text-white/70 text-sm mb-6 leading-relaxed">
              {company ? `${brandName} - Your trusted partner for financial growth and loan advisory services.` : "India's most trusted loan consulting platform. Get expert loan advisory with competitive rates and hassle-free process."}
            </p>
            <div className="flex items-center gap-3">
              <a
                href={`tel:${supportPhoneClean}`}
                className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center hover:bg-primary/80 transition-colors"
                aria-label="Call us"
              >
                <Phone className="w-5 h-5 text-white" />
              </a>
              <a
                href={`https://wa.me/${supportWhatsappClean}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-lg bg-success flex items-center justify-center hover:bg-success/80 transition-colors"
                aria-label="WhatsApp"
              >
                <WhatsAppIcon size="md" className="text-white" />
              </a>
              <a
                href={`mailto:${supportEmail}`}
                className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center hover:bg-accent/80 transition-colors"
                aria-label="Email us"
              >
                <Mail className="w-5 h-5 text-white" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-semibold text-lg mb-5">Quick Links</h4>
            <ul className="space-y-3">
              {quickLinks.map((link, index) => (
                <li key={index}>
                  {link.href ? (
                    <Link to={link.href} className="text-white/70 hover:text-white transition-colors text-sm">
                      {link.label}
                    </Link>
                  ) : isHomePage ? (
                    <a href={link.anchor} className="text-white/70 hover:text-white transition-colors text-sm">
                      {link.label}
                    </a>
                  ) : (
                    <Link to={getHref(link.anchor!)} className="text-white/70 hover:text-white transition-colors text-sm">
                      {link.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h4 className="font-semibold text-lg mb-5">Contact Info</h4>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Phone className="w-5 h-5 text-primary mt-0.5" />
                <div>
                  <a href={`tel:${supportPhoneClean}`} className="text-white hover:text-primary transition-colors text-sm font-medium">
                    {supportPhone}
                  </a>
                  <p className="text-white/50 text-xs mt-0.5">Mon-Sat: 10AM-6PM IST</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <WhatsAppIcon size="md" className="text-[#25D366] mt-0.5" />
                <div>
                  <a href={`https://wa.me/${supportWhatsappClean}`} target="_blank" rel="noopener noreferrer" className="text-white hover:text-success transition-colors text-sm font-medium">
                    {supportWhatsapp.startsWith("91") ? `+91 ${supportWhatsapp.substring(2)}` : supportWhatsapp}
                  </a>
                  <p className="text-white/50 text-xs mt-0.5">WhatsApp Support</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Mail className="w-5 h-5 text-accent mt-0.5" />
                <div>
                  <a href={`mailto:${supportEmail}`} className="text-white hover:text-accent transition-colors text-sm font-medium">
                    {supportEmail}
                  </a>
                  <p className="text-white/50 text-xs mt-0.5">24/7 Email Support</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-secondary mt-0.5" />
                <div>
                  <p className="text-white/90 text-sm font-medium">{company ? brandName : "Hariox Corporate Services Pvt. Ltd."}</p>
                  <p className="text-white/60 text-xs mt-1 leading-relaxed whitespace-pre-line">
                    {address}
                  </p>
                  {!company && (
                    <a 
                      href="https://maps.google.com/?q=Hariox+Corporate+Services+Surat+Gujarat" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary text-xs hover:underline mt-1 inline-block"
                    >
                      View on Google Maps
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Company Details */}
          <div>
            <h4 className="font-semibold text-lg mb-5">Company Details</h4>
            <div className="space-y-4">
              <div>
                <p className="text-white/90 text-sm font-medium">GST Number</p>
                <p className="text-white/60 text-xs mt-0.5">24AAGCF2801F1Z6</p>
              </div>
              <div>
                <p className="text-white/90 text-sm font-medium">CIN Number</p>
                <p className="text-white/60 text-xs mt-0.5">U66190GJ2025PTC159913</p>
              </div>
              <div>
                <p className="text-white/90 text-sm font-medium">Business Hours</p>
                <p className="text-white/60 text-xs mt-0.5">Mon–Sat: 10:00 AM – 6:00 PM IST</p>
                <p className="text-white/60 text-xs">Sun: Closed</p>
              </div>
              <div className="flex items-center gap-3 pt-2">
                <a
                  href="https://www.facebook.com/profile.php?id=61587337503047"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white/60 hover:text-primary transition-colors"
                  aria-label="Facebook"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                </a>
                <a
                  href="https://www.instagram.com/hariox?igsh=Yjk4amNzcGJqZHIz"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white/60 hover:text-accent transition-colors"
                  aria-label="Instagram"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.047-1.024-.06-1.379-.06-3.808v-.63c0-2.43.013-2.784.06-3.808.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 015.45 2.525c.636-.247 1.363-.416 2.427-.465C8.901 2.013 9.256 2 11.685 2h.63zm-.081 1.802h-.468c-2.456 0-2.784.011-3.807.058-.975.045-1.504.207-1.857.344-.467.182-.8.398-1.15.748-.35.35-.566.683-.748 1.15-.137.353-.3.882-.344 1.857-.047 1.023-.058 1.351-.058 3.807v.468c0 2.456.011 2.784.058 3.807.045.975.207 1.504.344 1.857.182.466.399.8.748 1.15.35.35.683.566 1.15.748.353.137.882.3 1.857.344 1.054.048 1.37.058 4.041.058h.08c2.597 0 2.917-.01 3.96-.058.976-.045 1.505-.207 1.858-.344.466-.182.8-.398 1.15-.748.35-.35.566-.683.748-1.15.137-.353.3-.882.344-1.857.048-1.055.058-1.37.058-4.041v-.08c0-2.597-.01-2.917-.058-3.96-.045-.976-.207-1.505-.344-1.858a3.097 3.097 0 00-.748-1.15 3.098 3.098 0 00-1.15-.748c-.353-.137-.882-.3-1.857-.344-1.023-.047-1.351-.058-3.807-.058zM12 6.865a5.135 5.135 0 110 10.27 5.135 5.135 0 010-10.27zm0 1.802a3.333 3.333 0 100 6.666 3.333 3.333 0 000-6.666zm5.338-3.205a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4z"/>
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="py-4 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-3">
          <p className="text-white/50 text-xs">
            © 2026 {brandName}. All rights reserved.
          </p>
          <p className="text-white/50 text-xs">
            {company ? brandName : "Hariox Corporate Services Pvt. Ltd. | Surat, Gujarat"}
          </p>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="bg-[hsl(220,25%,8%)] py-4">
        <div className="container mx-auto px-6 lg:px-8">
          <p className="text-white/40 text-xs text-center leading-relaxed">
            <span className="font-medium">Disclaimer:</span> {company ? brandName : "Hariox Corporate Services Pvt. Ltd."} is a loan consulting and advisory service. We assist customers with loan applications and provide professional financial guidance. Final loan approval depends entirely on bank policies, customer eligibility, and creditworthiness. Our consulting fees are charged for professional advisory services and are non-refundable regardless of loan approval outcome.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
