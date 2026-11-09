import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <section className="mx-auto flex min-h-[50vh] max-w-3xl flex-col items-center justify-center px-4 py-16 text-center">
      <p className="text-sm font-bold uppercase tracking-[0.2em] text-secondary">404</p>
      <h1 className="mt-3 text-3xl font-extrabold text-primary">Page not found</h1>
      <p className="mt-3 max-w-lg text-sm text-slate-600">
        The page you requested does not exist or may have moved.
      </p>
      <Link
        to="/products"
        className="mt-6 rounded-lg bg-primary px-5 py-3 text-sm font-bold text-white transition hover:bg-secondary"
      >
        Browse the catalogue
      </Link>
    </section>
  );
}
