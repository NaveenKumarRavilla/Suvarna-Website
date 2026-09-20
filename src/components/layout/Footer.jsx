import { Link } from 'react-router-dom';
import {
  Phone,
  Mail,
  MapPin,
  MessageCircle,
  Instagram,
  Facebook,
  Linkedin,
  Youtube,
} from 'lucide-react';
import { COMPANY, whatsappLink } from '../../utils/helpers';
import logo from '../../assets/suvarna-logo.svg';

const columns = [
  {
    title: 'Quick Links',
    links: [
      { label: 'Home', to: '/' },
      { label: 'Products', to: '/products' },
      { label: 'Categories', to: '/products' },
      { label: 'About Us', to: '/contact' },
      { label: 'Contact', to: '/contact' },
    ],
  },
  {
    title: 'Categories',
    links: [
      { label: 'Laptops', to: '/products?category=laptops' },
      { label: 'Desktops', to: '/products?category=desktops' },
      { label: 'CCTV', to: '/products?category=cctv' },
      { label: 'Printers', to: '/products?category=printers' },
      { label: 'Networking', to: '/products?category=networking' },
    ],
  },
  {
    title: 'Customer Support',
    links: [
      { label: 'Contact Us', to: '/contact' },
      { label: 'Shipping Policy', to: '/contact' },
      { label: 'Return Policy', to: '/contact' },
      { label: 'Privacy Policy', to: '/contact' },
      { label: 'Terms & Conditions', to: '/contact' },
    ],
  },
];

const socials = [
  { label: 'Instagram', icon: Instagram, href: 'https://instagram.com' },
  { label: 'Facebook', icon: Facebook, href: 'https://facebook.com' },
  { label: 'LinkedIn', icon: Linkedin, href: 'https://linkedin.com' },
  { label: 'YouTube', icon: Youtube, href: 'https://youtube.com' },
];

export default function Footer() {
  return (
    <footer className="mt-12 bg-primary text-slate-300">
      <div className="mx-auto grid max-w-8xl grid-cols-1 gap-10 px-4 py-12 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
        {/* Company */}
        <div>
          <Link to="/" className="inline-flex items-center">
            <img src={logo} alt="Suvarna IT Enterprises" className="h-12 w-auto max-w-[210px] object-contain sm:h-16" />
          </Link>
          <p className="mt-4 text-sm leading-relaxed text-slate-400">
            Suvarna IT Enterprises is your trusted partner for laptops, desktops,
            servers, printers, CCTV and complete IT infrastructure solutions.
            Genuine products, expert support and pan-India delivery.
          </p>
          <div className="mt-5 flex gap-3">
            {socials.map(({ label, icon: Icon, href }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-accent hover:text-navy-900"
              >
                <Icon size={16} />
              </a>
            ))}
          </div>
        </div>

        {/* Link columns */}
        {columns.map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-white">
              {col.title}
            </h3>
            <ul className="space-y-2.5">
              {col.links.map((link) => (
                <li key={link.label}>
                  <Link
                    to={link.to}
                    className="text-sm text-slate-400 transition hover:text-accent"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}

        {/* Contact */}
        <div>
          <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-white">
            Contact Us
          </h3>
          <ul className="space-y-3.5 text-sm text-slate-400">
            <li className="flex items-start gap-3">
              <Phone size={16} className="mt-0.5 shrink-0 text-accent" />
              <a href={`tel:${COMPANY.phone.replace(/\s/g, '')}`} className="transition hover:text-accent">
                {COMPANY.phone}
              </a>
            </li>
            <li className="flex items-start gap-3">
              <Mail size={16} className="mt-0.5 shrink-0 text-accent" />
              <a href={`mailto:${COMPANY.email}`} className="transition hover:text-accent">
                {COMPANY.email}
              </a>
            </li>
            <li className="flex items-start gap-3">
              <MapPin size={16} className="mt-0.5 shrink-0 text-accent" />
              <span>{COMPANY.address}</span>
            </li>
            <li className="flex items-start gap-3">
              <MessageCircle size={16} className="mt-0.5 shrink-0 text-[#25D366]" />
              <a
                href={whatsappLink('Hello Suvarna IT Enterprises, I need assistance.')}
                target="_blank"
                rel="noopener noreferrer"
                className="transition hover:text-[#25D366]"
              >
                WhatsApp Support
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-8xl flex-col items-center justify-between gap-2 px-4 py-5 text-center text-xs text-slate-400 sm:flex-row">
          <p>Copyright © 2026 Suvarna IT Enterprises. All Rights Reserved.</p>
          <p>
            Designed for performance. Powered by{' '}
            <span className="font-semibold text-accent">SUVARNA</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
