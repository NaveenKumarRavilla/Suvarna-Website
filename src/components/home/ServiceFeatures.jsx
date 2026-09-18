import { ShieldCheck, Lock, Truck, MessageCircle } from 'lucide-react';
import { whatsappLink } from '../../utils/helpers';

const features = [
  {
    icon: ShieldCheck,
    title: '100% Genuine Products',
    description: 'Original & Trusted Brands',
  },
  {
    icon: Lock,
    title: 'Secure Payments',
    description: 'Safe & Encrypted Transactions',
  },
  {
    icon: Truck,
    title: 'Fast Delivery',
    description: 'Quick Delivery Pan India',
  },
  {
    icon: MessageCircle,
    title: 'WhatsApp Support',
    description: 'Quick Support on WhatsApp',
    href: whatsappLink('Hello Suvarna IT Enterprises, I need support.'),
  },
];

export default function ServiceFeatures() {
  return (
    <section aria-label="Why shop with us" className="mx-auto max-w-8xl px-4 py-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
        {features.map(({ icon: Icon, title, description, href }) => {
          const Wrapper = href ? 'a' : 'div';
          return (
            <Wrapper
              key={title}
              {...(href
                ? { href, target: '_blank', rel: 'noopener noreferrer' }
                : {})}
              className="flex items-start gap-3.5 rounded-xl bg-white p-4 shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-card-hover sm:p-5"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-secondary/10 text-secondary">
                <Icon size={22} />
              </span>
              <span>
                <span className="block text-sm font-bold text-primary">
                  {title}
                </span>
                <span className="mt-0.5 block text-xs leading-snug text-slate-500">
                  {description}
                </span>
              </span>
            </Wrapper>
          );
        })}
      </div>
    </section>
  );
}
