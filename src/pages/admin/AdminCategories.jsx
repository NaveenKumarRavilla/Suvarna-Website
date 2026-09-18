import { gridCategories } from '../../data/categories';
import { useAdmin } from '../../context/AdminContext';
import { PageHeader, tableWrap, tableCls, thCls, tdCls } from '../../components/admin/AdminForm';

export default function AdminCategories() {
  const { products } = useAdmin();

  return (
    <div>
      <PageHeader
        title="Manage Categories"
        subtitle="Storefront category navigation and product counts."
      />
      <div className={tableWrap}>
        <table className={tableCls}>
          <thead className="border-b border-slate-100 bg-slate-50">
            <tr>
              <th className={thCls}>Category</th>
              <th className={thCls}>Tagline</th>
              <th className={thCls}>Products</th>
              <th className={thCls}>Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {gridCategories.map((cat) => {
              const Icon = cat.icon;
              const count = products.filter((p) => p.category === cat.id).length;
              return (
                <tr key={cat.id} className="transition hover:bg-slate-50">
                  <td className={tdCls}>
                    <span className="flex items-center gap-3">
                      <span className={`flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br ${cat.gradient} text-white`}>
                        <Icon size={17} />
                      </span>
                      <span className="font-semibold text-primary">{cat.label}</span>
                    </span>
                  </td>
                  <td className={tdCls}>{cat.tagline}</td>
                  <td className={tdCls}>
                    <span className="rounded-full bg-secondary/10 px-2.5 py-1 text-xs font-bold text-secondary">
                      {count}
                    </span>
                  </td>
                  <td className={tdCls}>
                    <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
                      Active
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-xs text-slate-400">
        Category definitions are code-based (src/data/categories.js). Product counts update automatically.
      </p>
    </div>
  );
}
