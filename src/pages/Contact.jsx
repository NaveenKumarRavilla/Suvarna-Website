import { useState } from 'react';
import { Phone, Mail, MapPin, Clock, MessageCircle, Send, CheckCircle2 } from 'lucide-react';
import { COMPANY, whatsappLink } from '../utils/helpers';
import { useAdmin } from '../context/AdminContext';
import Button from '../components/common/Button';

const infoCards = [
  {
    icon: Phone,
    title: 'Call Us',
    lines: [COMPANY.phone, COMPANY.hours],
    href: `tel:${COMPANY.phone.replace(/\s/g, '')}`,
  },
  {
    icon: Mail,
    title: 'Email Us',
    lines: [COMPANY.email, 'We reply within 24 hours'],
    href: `mailto:${COMPANY.email}`,
  },
  {
    icon: MapPin,
    title: 'Visit Us',
    lines: [COMPANY.address],
  },
  {
    icon: Clock,
    title: 'Business Hours',
    lines: [COMPANY.hours, 'Sunday: Closed'],
  },
];

const inputCls =
  'w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-700 outline-none transition focus:border-secondary focus:bg-white focus:ring-2 focus:ring-secondary/20';

export default function Contact() {
  const [sent, setSent] = useState(false);
  const { addEnquiry } = useAdmin();

  const handleSubmit = (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    addEnquiry({
      name: form.querySelector('#ct-name')?.value || '',
      email: form.querySelector('#ct-email')?.value || '',
      phone: form.querySelector('#ct-phone')?.value || '',
      subject: form.querySelector('#ct-subject')?.value || '',
      message: form.querySelector('#ct-message')?.value || '',
    });
    setSent(true);
  };

  return (
    <div className="mx-auto max-w-8xl px-4 py-10">
      <div className="text-center">
        <div className="mx-auto mb-2 h-1 w-12 rounded-full bg-accent" aria-hidden="true" />
        <h1 className="text-2xl font-extrabold uppercase tracking-wide text-primary sm:text-3xl">
          Contact Us
        </h1>
        <p className="mx-auto mt-2 max-w-xl text-sm text-slate-500">
          Have a question about products, pricing or services? Our team is happy to help.
        </p>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {infoCards.map(({ icon: Icon, title, lines, href }) => {
          const Wrapper = href ? 'a' : 'div';
          return (
            <Wrapper
              key={title}
              {...(href ? { href } : {})}
              className="rounded-xl bg-white p-5 shadow-card transition hover:-translate-y-1 hover:shadow-card-hover"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-secondary/10 text-secondary">
                <Icon size={22} />
              </span>
              <h2 className="mt-3 text-sm font-bold text-primary">{title}</h2>
              {lines.map((line) => (
                <p key={line} className="mt-1 text-xs leading-relaxed text-slate-500">
                  {line}
                </p>
              ))}
            </Wrapper>
          );
        })}
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        {/* Form */}
        <section className="rounded-xl bg-white p-6 shadow-card sm:p-8">
          <h2 className="text-lg font-bold text-primary">Send us a Message</h2>
          {sent ? (
            <div className="mt-6 flex flex-col items-center gap-3 py-8 text-center">
              <CheckCircle2 size={48} className="text-emerald-500" />
              <p className="text-sm font-semibold text-primary">
                Thank you! Your message has been sent.
              </p>
              <p className="text-xs text-slate-500">
                Our team will get back to you within 24 hours.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="ct-name" className="mb-1.5 block text-xs font-semibold text-slate-600">
                    Name *
                  </label>
                  <input id="ct-name" required className={inputCls} placeholder="Your name" />
                </div>
                <div>
                  <label htmlFor="ct-email" className="mb-1.5 block text-xs font-semibold text-slate-600">
                    Email *
                  </label>
                  <input id="ct-email" type="email" required className={inputCls} placeholder="you@example.com" />
                </div>
              </div>
              <div>
                <label htmlFor="ct-phone" className="mb-1.5 block text-xs font-semibold text-slate-600">
                  Phone *
                </label>
                <input id="ct-phone" type="tel" required className={inputCls} placeholder="+91 98765 43210" />
              </div>
              <div>
                <label htmlFor="ct-subject" className="mb-1.5 block text-xs font-semibold text-slate-600">
                  Subject *
                </label>
                <input id="ct-subject" required className={inputCls} placeholder="How can we help?" />
              </div>
              <div>
                <label htmlFor="ct-message" className="mb-1.5 block text-xs font-semibold text-slate-600">
                  Message *
                </label>
                <textarea id="ct-message" required rows="4" className={inputCls} placeholder="Write your message..." />
              </div>
              <Button type="submit" variant="primary" size="lg">
                <Send size={16} />
                Send Message
              </Button>
            </form>
          )}
        </section>

        {/* WhatsApp CTA */}
        <section className="flex flex-col justify-center rounded-xl bg-gradient-to-br from-primary to-secondary p-8 text-white shadow-card">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15">
            <MessageCircle size={24} />
          </span>
          <h2 className="mt-4 text-xl font-extrabold">Need a quick answer?</h2>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-slate-200">
            Chat with our product experts on WhatsApp for instant pricing, availability
            and bulk order quotes.
          </p>
          <div className="mt-6">
            <Button
              href={whatsappLink('Hello Suvarna IT Enterprises, I have a question.')}
              target="_blank"
              rel="noopener noreferrer"
              variant="whatsapp"
              size="lg"
            >
              <MessageCircle size={18} />
              Chat on WhatsApp
            </Button>
          </div>
          <p className="mt-6 text-xs text-slate-300">
            {COMPANY.hours} &bull; Response within minutes during business hours
          </p>
        </section>
      </div>
    </div>
  );
}
