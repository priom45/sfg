import { Link } from 'react-router-dom';
import { Phone, Mail, MapPin } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-brand-surface border-t border-brand-border">
      <div className="section-padding py-10 lg:py-14">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <img src="/image.png" alt="The Supreme Waffle" className="h-10 w-auto object-contain" />
            </div>
            <p className="text-brand-text-dim text-[14px] leading-relaxed">
              Crafting the finest waffles with premium ingredients. Every bite is a moment of pure joy.
            </p>
          </div>

          <div>
            <h4 className="font-bold text-[12px] uppercase tracking-[0.15em] text-brand-text-dim mb-4">Quick Links</h4>
            <ul className="space-y-2.5">
              {[
                { to: '/menu', label: 'Our Menu' },
                { to: '/offers', label: 'Offers' },
                { to: '/track', label: 'Track Order' },
                { to: '/about', label: 'About Us' },
              ].map((link) => (
                <li key={link.label}>
                  <Link to={link.to} className="text-brand-text-muted hover:text-brand-gold text-[14px] font-medium transition-colors duration-200">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-[12px] uppercase tracking-[0.15em] text-brand-text-dim mb-4">Contact</h4>
            <ul className="space-y-3">
              <li className="flex items-center gap-3 text-brand-text-muted text-[14px]">
                <Phone size={14} strokeWidth={2.2} className="text-brand-gold-muted flex-shrink-0" />
                <span>+91 98765 43210</span>
              </li>
              <li className="flex items-center gap-3 text-brand-text-muted text-[14px]">
                <Mail size={14} strokeWidth={2.2} className="text-brand-gold-muted flex-shrink-0" />
                <span>thesupremewafflee@gmail.com</span>
              </li>
              <li className="flex items-start gap-3 text-brand-text-muted text-[14px]">
                <MapPin size={14} strokeWidth={2.2} className="text-brand-gold-muted flex-shrink-0 mt-0.5" />
                <span>Police Station Road, Kanuru, Vijayawada</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-brand-border mt-8 pt-5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-brand-text-dim text-[12px] font-semibold">
            &copy; {new Date().getFullYear()} The Supreme Waffle. All rights reserved.
          </p>
          <div className="flex items-center gap-5 text-brand-text-dim text-[12px] font-semibold">
            <Link to="/privacy" className="hover:text-brand-text-muted transition-colors">
              Privacy Policy
            </Link>
            <Link to="/terms" className="hover:text-brand-text-muted transition-colors">
              Terms of Service
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
