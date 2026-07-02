import { Link, useSearchParams } from "react-router-dom";
import { Phone, Mail, MapPin, Shield, FileText, Scale, AlertCircle } from "lucide-react";
import WhatsAppIcon from "@/components/ui/whatsapp-icon";
import capitalLogo from "@/assets/hariox-logo-full.png";

const CapitalFooter = () => {
  const [searchParams] = useSearchParams();
  const currentYear = new Date().getFullYear();
  const companyParam = '';

  return (
    <footer id="contact" className="bg-gray-900 text-white">
      {/* Main Footer - Compact */}
      <div className="container mx-auto px-4 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-8">
          {/* Brand & Logo */}
          <div className="flex-shrink-0">
            <img 
              src={capitalLogo} 
              alt="Capital Hariox" 
              className="h-10 mb-3 brightness-0 invert"
            />
            <p className="text-gray-400 text-sm max-w-xs leading-relaxed">
              Your trusted financial partner for quick loans with minimal documentation.
            </p>
            
            {/* Contact - Horizontal */}
            <div className="flex flex-wrap gap-4 mt-4 text-sm">
              <a href="tel:+919422799318" className="flex items-center gap-1.5 text-gray-400 hover:text-emerald-400 transition-colors">
                <Phone className="w-3.5 h-3.5" />
                +91 9422799318
              </a>
              <a href="https://wa.me/918469391818" className="flex items-center gap-1.5 text-gray-400 hover:text-emerald-400 transition-colors">
                <WhatsAppIcon size="xs" className="text-[#25D366]" />
                WhatsApp
              </a>
              <a href="mailto:hariox@gmail.com" className="flex items-center gap-1.5 text-gray-400 hover:text-emerald-400 transition-colors">
                <Mail className="w-3.5 h-3.5" />
                hariox@gmail.com
              </a>
            </div>
          </div>

          {/* Quick Links - Inline */}
          <div className="flex flex-wrap gap-6 text-sm">
            <div>
              <h4 className="font-semibold text-white mb-2 text-xs uppercase tracking-wider">Quick Links</h4>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-gray-400">
                <a href={`/${companyParam}#services`} className="hover:text-emerald-400 transition-colors">Loan Products</a>
                <Link to="/about-us" className="hover:text-emerald-400 transition-colors">About Us</Link>
                <Link to="/services" className="hover:text-emerald-400 transition-colors">Services</Link>
                <Link to="/contact-us" className="hover:text-emerald-400 transition-colors">Contact Us</Link>
                <Link to="/faq" className="hover:text-emerald-400 transition-colors">FAQs</Link>
                <Link to="/my-account" className="hover:text-emerald-400 transition-colors">My Account</Link>
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-2 text-xs uppercase tracking-wider">Legal</h4>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-gray-400">
                <Link to="/privacy-policy" className="hover:text-emerald-400 transition-colors flex items-center gap-1">
                  <FileText className="w-3 h-3" />
                  Privacy Policy
                </Link>
                <Link to="/terms-conditions" className="hover:text-emerald-400 transition-colors flex items-center gap-1">
                  <Scale className="w-3 h-3" />
                  Terms & Conditions
                </Link>
                <Link to="/refund-policy" className="hover:text-emerald-400 transition-colors flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Refund Policy
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Company Details & Social Media */}
      <div className="border-t border-gray-800">
        <div className="container mx-auto px-4 lg:px-8 py-6">
          <div className="grid md:grid-cols-3 gap-6 text-sm text-gray-400">
            <div>
              <p className="text-white font-medium text-xs uppercase tracking-wider mb-2">Company Details</p>
              <p><strong className="text-gray-300">GST:</strong> 24AAGCF2801F1Z6</p>
              <p><strong className="text-gray-300">CIN:</strong> U66190GJ2025PTC159913</p>
            </div>
            <div>
              <p className="text-white font-medium text-xs uppercase tracking-wider mb-2">Business Hours</p>
              <p>Mon–Sat: 10:00 AM – 6:00 PM IST</p>
              <p>Sun: Closed</p>
            </div>
            <div>
              <p className="text-white font-medium text-xs uppercase tracking-wider mb-2">Follow Us</p>
              <div className="flex items-center gap-3 mt-1">
                <a href="https://www.facebook.com/share/17rqXWgMBC/?mibextid=wwXIfr" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-emerald-400 transition-colors" aria-label="Facebook">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                </a>
                <a href="https://www.instagram.com/hariox?igsh=Yjk4amNzcGJqZHIz" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-emerald-400 transition-colors" aria-label="Instagram">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.047-1.024-.06-1.379-.06-3.808v-.63c0-2.43.013-2.784.06-3.808.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 015.45 2.525c.636-.247 1.363-.416 2.427-.465C8.901 2.013 9.256 2 11.685 2h.63zm-.081 1.802h-.468c-2.456 0-2.784.011-3.807.058-.975.045-1.504.207-1.857.344-.467.182-.8.398-1.15.748-.35.35-.566.683-.748 1.15-.137.353-.3.882-.344 1.857-.047 1.023-.058 1.351-.058 3.807v.468c0 2.456.011 2.784.058 3.807.045.975.207 1.504.344 1.857.182.466.399.8.748 1.15.35.35.683.566 1.15.748.353.137.882.3 1.857.344 1.054.048 1.37.058 4.041.058h.08c2.597 0 2.917-.01 3.96-.058.976-.045 1.505-.207 1.858-.344.466-.182.8-.398 1.15-.748.35-.35.566-.683.748-1.15.137-.353.3-.882.344-1.857.048-1.055.058-1.37.058-4.041v-.08c0-2.597-.01-2.917-.058-3.96-.045-.976-.207-1.505-.344-1.858a3.097 3.097 0 00-.748-1.15 3.098 3.098 0 00-1.15-.748c-.353-.137-.882-.3-1.857-.344-1.023-.047-1.351-.058-3.807-.058zM12 6.865a5.135 5.135 0 110 10.27 5.135 5.135 0 010-10.27zm0 1.802a3.333 3.333 0 100 6.666 3.333 3.333 0 000-6.666zm5.338-3.205a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4z"/></svg>
                </a>
                <a href="https://www.youtube.com/@hariox" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-emerald-400 transition-colors" aria-label="YouTube">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                </a>
                <a href="https://www.linkedin.com/company/hariox" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-emerald-400 transition-colors" aria-label="LinkedIn">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="border-t border-gray-800">
        <div className="container mx-auto px-4 lg:px-8 py-4">
          <p className="text-xs text-gray-500 leading-relaxed">
            <strong className="text-gray-400">Disclaimer:</strong> Capital Hariox acts as a loan facilitator connecting customers with RBI-registered banks and NBFCs. 
            We do not directly lend money. Loan approval, interest rates, and terms are solely determined by the lending partner. 
            All loan applications are subject to verification and approval by the respective financial institution.
          </p>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-gray-800 bg-gray-950">
        <div className="container mx-auto px-4 lg:px-8 py-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-gray-500">
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-x-4 gap-y-1">
              <p>© {currentYear} Capital Hariox. All rights reserved.</p>
              <div className="flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-emerald-500" />
                <span>RBI Registered Partners</span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" />
              <span>Surat, Gujarat, India</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default CapitalFooter;