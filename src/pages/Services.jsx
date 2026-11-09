import { Link } from 'react-router-dom';
import { useAdmin } from '../context/AdminContext';
import Button from '../components/common/Button';

const serviceAreas = [
  { title: 'Computers and servers', description: 'Browse laptops, desktops and server products for personal and business use.', category: 'laptops' },
  { title: 'Printing', description: 'Explore printers and related products for home and office needs.', category: 'printers' },
  { title: 'CCTV', description: 'View CCTV products available in our catalogue.', category: 'cctv' },
  { title: 'Networking', description: 'Explore networking products listed for home and business use.', category: 'networking' },
];

export default function Services() {
  const { settings } = useAdmin();

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <section className="rounded-2xl bg-white p-8 shadow-card sm:p-12">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-secondary">What we offer</p>
        <h1 className="mt-3 text-3xl font-extrabold text-primary sm:text-4xl">Products and IT solutions</h1>
        <p className="mt-5 max-w-3xl text-base leading-7 text-slate-600">
          Explore the products currently listed by {settings.storeName}. Contact us to
          confirm availability and discuss your requirements.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {serviceAreas.map((area) => (
            <article key={area.title} className="rounded-xl border border-slate-200 p-5">
              <h2 className="text-base font-bold text-primary">{area.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{area.description}</p>
              <Link
                to={`/products?${new URLSearchParams({ category: area.category })}`}
                className="mt-4 inline-flex text-sm font-semibold text-secondary hover:underline"
              >
                Browse products
              </Link>
            </article>
          ))}
        </div>
        <div className="mt-8">
          <Button to="/contact" variant="primary">Contact our team</Button>
        </div>
      </section>
    </div>
  );
}
