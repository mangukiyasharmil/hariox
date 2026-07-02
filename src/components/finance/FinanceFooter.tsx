import { Link, useSearchParams } from "react-router-dom";
import { Phone, Mail, MapPin, Shield, FileText, Scale, AlertCircle, Building2 } from "lucide-react";
import WhatsAppIcon from "@/components/ui/whatsapp-icon";
import financeLogo from "@/assets/finance-logo.png";

const FinanceFooter = () => {
  const [searchParams] = useSearchParams();
  const currentYear = new Date().getFullYear();
  const companyParam = '';

  return (
    <footer id="contact" className="bg-[#0d1b2a] text-white">
      {/* Main Footer */}
      <div className="container mx-auto px-4 lg:px-8 py-12">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="lg:col-span-2">
              <img 
                src={financeLogo} 
                alt="Finance Hariox" 
                className="h-12 mb-4"
                loading="lazy"
              />
            <p className="text-gray-400 text-sm max-w-md leading-relaxed mb-6">
              Your trusted financial partner offering the best interest rates from India's leading banks. 
              We help you compare and choose the right loan with complete transparency.
            </p>
            
            {/* Contact */}
            <div className="space-y-3">
              <a href="tel:+919422799318" className="flex items-center gap-3 text-gray-400 hover:text-[#c9a227] transition-colors">
                <div className="w-8 h-8 bg-[#1a365d] flex items-center justify-center">
                  <Phone className="w-4 h-4 text-[#c9a227]" />
                </div>
                <span className="text-sm">+91 9422799318</span>
              </a>
              <a href="https://wa.me/918469391818" className="flex items-center gap-3 text-gray-400 hover:text-[#c9a227] transition-colors">
                <div className="w-8 h-8 bg-[#1a365d] flex items-center justify-center">
                  <WhatsAppIcon size="sm" className="text-[#25D366]" />
                </div>
                <span className="text-sm">WhatsApp Support</span>
              </a>
              <a href="mailto:hariox@gmail.com" className="flex items-center gap-3 text-gray-400 hover:text-[#c9a227] transition-colors">
                <div className="w-8 h-8 bg-[#1a365d] flex items-center justify-center">
                  <Mail className="w-4 h-4 text-[#c9a227]" />
                </div>
                <span className="text-sm">hariox@gmail.com</span>
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-bold text-white mb-4 text-sm uppercase tracking-widest flex items-center gap-2">
              <span className="w-2 h-2 bg-[#c9a227]" />
              Loan Products
            </h4>
            <ul className="space-y-2 text-sm text-gray-400">
              <li><Link to="/services" className="hover:text-[#c9a227] transition-colors">Personal Loan</Link></li>
              <li><Link to="/services" className="hover:text-[#c9a227] transition-colors">Business Loan</Link></li>
              <li><Link to="/services" className="hover:text-[#c9a227] transition-colors">Home Loan</Link></li>
              <li><Link to="/services" className="hover:text-[#c9a227] transition-colors">Education Loan</Link></li>
              <li><Link to="/services" className="hover:text-[#c9a227] transition-colors">Vehicle Loan</Link></li>
              <li><Link to="/services" className="hover:text-[#c9a227] transition-colors">Gold Loan</Link></li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="font-bold text-white mb-4 text-sm uppercase tracking-widest flex items-center gap-2">
              <span className="w-2 h-2 bg-[#c9a227]" />
              Company
            </h4>
            <ul className="space-y-2 text-sm text-gray-400">
              <li>
                <Link to="/about-us" className="hover:text-[#c9a227] transition-colors flex items-center gap-2">
                  <Building2 className="w-3.5 h-3.5" />
                  About Us
                </Link>
              </li>
              <li>
                <Link to="/services" className="hover:text-[#c9a227] transition-colors flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5" />
                  Services
                </Link>
              </li>
              <li>
                <Link to="/contact-us" className="hover:text-[#c9a227] transition-colors flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5" />
                  Contact Us
                </Link>
              </li>
              <li>
                <Link to="/faq" className="hover:text-[#c9a227] transition-colors flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5" />
                  FAQs
                </Link>
              </li>
              <li>
                <Link to="/my-account" className="hover:text-[#c9a227] transition-colors flex items-center gap-2">
                  <Shield className="w-3.5 h-3.5" />
                  My Account
                </Link>
              </li>
              <li>
                <Link to="/privacy-policy" className="hover:text-[#c9a227] transition-colors flex items-center gap-2">
                  <Shield className="w-3.5 h-3.5" />
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link to="/terms-conditions" className="hover:text-[#c9a227] transition-colors flex items-center gap-2">
                  <Scale className="w-3.5 h-3.5" />
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link to="/refund-policy" className="hover:text-[#c9a227] transition-colors flex items-center gap-2">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Refund Policy
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Company Details & Social Media */}
      <div className="border-t border-[#1a365d]/50">
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
                <a href="https://www.facebook.com/profile.php?id=61581304155665" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-[#c9a227] transition-colors" aria-label="Facebook">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                </a>
                <a href="https://www.instagram.com/hariox_finance/" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-[#c9a227] transition-colors" aria-label="Instagram">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.047-1.024-.06-1.379-.06-3.808v-.63c0-2.43.013-2.784.06-3.808.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 015.45 2.525c.636-.247 1.363-.416 2.427-.465C8.901 2.013 9.256 2 11.685 2h.63zm-.081 1.802h-.468c-2.456 0-2.784.011-3.807.058-.975.045-1.504.207-1.857.344-.467.182-.8.398-1.15.748-.35.35-.566.683-.748 1.15-.137.353-.3.882-.344 1.857-.047 1.023-.058 1.351-.058 3.807v.468c0 2.456.011 2.784.058 3.807.045.975.207 1.504.344 1.857.182.466.399.8.748 1.15.35.35.683.566 1.15.748.353.137.882.3 1.857.344 1.054.048 1.37.058 4.041.058h.08c2.597 0 2.917-.01 3.96-.058.976-.045 1.505-.207 1.858-.344.466-.182.8-.398 1.15-.748.35-.35.566-.683.748-1.15.137-.353.3-.882.344-1.857.048-1.055.058-1.37.058-4.041v-.08c0-2.597-.01-2.917-.058-3.96-.045-.976-.207-1.505-.344-1.858a3.097 3.097 0 00-.748-1.15 3.098 3.098 0 00-1.15-.748c-.353-.137-.882-.3-1.857-.344-1.023-.047-1.351-.058-3.807-.058zM12 6.865a5.135 5.135 0 110 10.27 5.135 5.135 0 010-10.27zm0 1.802a3.333 3.333 0 100 6.666 3.333 3.333 0 000-6.666zm5.338-3.205a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4z"/></svg>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="border-t border-[#1a365d]/50">
        <div className="container mx-auto px-4 lg:px-8 py-6">
          <p className="text-xs text-gray-500 leading-relaxed">
            <strong className="text-gray-400">Disclaimer:</strong> Finance Hariox is a loan aggregator and does not directly lend money. 
            We connect customers with RBI-registered banks and NBFCs. Loan approval, interest rates, processing fees, and terms are 
            determined solely by the lending partner. Interest rates mentioned are indicative and may vary based on credit profile. 
            All loan applications are subject to verification and approval by the respective financial institution.
          </p>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-[#1a365d]/50 bg-[#0a1628]">
        <div className="container mx-auto px-4 lg:px-8 py-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-gray-500">
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-4">
              <p>© {currentYear} Finance Hariox. All rights reserved.</p>
              <div className="flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-[#c9a227]" />
                <span>RBI Registered Partners</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" />
              <span>Surat, Gujarat, India</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default FinanceFooter;
