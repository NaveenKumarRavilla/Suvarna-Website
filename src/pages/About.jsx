import { MapPin } from 'lucide-react';
import { useAdmin } from '../context/AdminContext';
import Button from '../components/common/Button';

export default function About() {
  const { settings } = useAdmin();

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <section className="rounded-2xl bg-white p-8 shadow-card sm:p-12">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-secondary">About us</p>
        <h1 className="mt-3 text-3xl font-extrabold text-primary sm:text-4xl">{settings.storeName}</h1>
        <p className="mt-5 max-w-3xl text-base leading-7 text-slate-600">
          Suvarna IT Enterprises offers IT products for home, office and business use,
          including laptops, desktops, servers, printers, CCTV and networking equipment.
          Contact our team for product availability and enquiries.
        </p>
        <p className="mt-5 flex items-start gap-2 text-sm text-slate-600">
          <MapPin size={18} className="mt-0.5 shrink-0 text-secondary" />
          {settings.address}
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button to="/products" variant="primary">Browse products</Button>
          <Button to="/contact" variant="outline">Contact us</Button>
        </div>
      </section>
    </div>
  );
}
