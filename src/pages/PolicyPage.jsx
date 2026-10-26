import { Link, useParams } from 'react-router-dom';
import { useAdmin } from '../context/AdminContext';

export default function PolicyPage({ slug: fixedSlug }) {
  const { slug: routeSlug } = useParams();
  const { policies } = useAdmin();
  const policy = policies[fixedSlug || routeSlug];

  if (!policy) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10">
        <article className="rounded-2xl bg-white p-8 text-center shadow-card">
          <h1 className="text-2xl font-extrabold text-primary">Policy not found</h1>
          <p className="mt-2 text-sm text-slate-600">This policy may have been removed or the link may be incorrect.</p>
          <Link to="/contact" className="mt-5 inline-flex text-sm font-semibold text-secondary hover:underline">
            Back to Contact
          </Link>
        </article>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-6">
        <Link to="/contact" className="inline-flex items-center text-sm font-medium text-secondary hover:text-primary">
          ← Back to Contact
        </Link>
      </div>

      <article className="rounded-2xl bg-white p-6 shadow-card sm:p-8">
        <div className="mb-4 h-1 w-16 rounded-full bg-accent" aria-hidden="true" />
        <h1 className="text-2xl font-extrabold uppercase tracking-wide text-primary sm:text-3xl">
          {policy.title}
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600">
          {policy.summary}
        </p>

        <div className="mt-8 space-y-6">
          {policy.items.map(({ heading, text }) => (
            <section key={heading} className="rounded-xl border border-slate-200 bg-slate-50 p-5">
              <h2 className="text-base font-bold text-primary">{heading}</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{text}</p>
            </section>
          ))}
        </div>
      </article>
    </div>
  );
}
