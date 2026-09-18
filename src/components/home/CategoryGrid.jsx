import { Link } from 'react-router-dom';
import { gridCategories } from '../../data/categories';
import SectionHeader from '../common/SectionHeader';
import Button from '../common/Button';

export default function CategoryGrid() {
  return (
    <section aria-labelledby="top-categories" className="mx-auto max-w-8xl px-4 py-10">
      <SectionHeader
        title="Explore Top Categories"
        subtitle="Everything your business needs, in one place"
      />
      <div
        id="top-categories"
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 md:grid-cols-4 xl:grid-cols-8"
      >
        {gridCategories.map((cat) => {
          const Icon = cat.icon;
          return (
            <Link
              key={cat.id}
              to={`/products?category=${cat.id}`}
              className="group flex flex-col items-center gap-3 rounded-xl bg-white p-5 text-center shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-card-hover"
            >
              <span
                className={`flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br ${cat.gradient} text-white shadow-md transition-transform duration-300 group-hover:scale-110`}
              >
                <Icon size={26} />
              </span>
              <span>
                <span className="block text-sm font-bold text-primary group-hover:text-secondary">
                  {cat.label}
                </span>
                <span className="mt-0.5 block text-[11px] text-slate-400">
                  {cat.tagline}
                </span>
              </span>
            </Link>
          );
        })}
      </div>
      <div className="mt-8 text-center">
        <Button to="/products" variant="primary" size="lg">
          View All Categories
        </Button>
      </div>
    </section>
  );
}
