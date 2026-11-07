import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useAdmin } from '../../context/AdminContext';

const HIDDEN_FROM_SEARCH = ['home', 'contact', 'services', 'offers'];

export default function SearchBar() {
  const { categories } = useAdmin();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const navigate = useNavigate();

  const searchable = categories.filter((category) => !HIDDEN_FROM_SEARCH.includes(category.id));

  const handleSubmit = (e) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set('search', query.trim());
    if (category !== 'all') params.set('category', category);
    navigate(`/products${params.toString() ? `?${params.toString()}` : ''}`);
  };

  return (
    <form
      onSubmit={handleSubmit}
      role="search"
      className="flex w-full items-stretch overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-slate-200 transition focus-within:ring-2 focus-within:ring-secondary"
    >
      <label htmlFor="search-category" className="sr-only">
        Category
      </label>
      <select
        id="search-category"
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        className="hidden max-w-[150px] border-r border-slate-200 bg-slate-50 px-3 text-sm text-slate-600 outline-none md:block"
      >
        <option value="all">All Categories</option>
        {searchable.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label}
          </option>
        ))}
      </select>
      <label htmlFor="search-input" className="sr-only">
        Search products
      </label>
      <input
        id="search-input"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search for products, brands and more..."
        className="w-full px-4 py-2.5 text-sm text-slate-700 outline-none"
      />
      <button
        type="submit"
        aria-label="Search"
        className="flex items-center gap-2 bg-accent px-4 font-semibold text-navy-900 transition hover:bg-accent-dark hover:text-white"
      >
        <Search size={18} />
        <span className="hidden xl:inline">Search</span>
      </button>
    </form>
  );
}
