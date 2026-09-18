import { Trash2 } from 'lucide-react';
import { useAdmin } from '../../context/AdminContext';
import { PageHeader, StatusBadge, tableWrap, tableCls, thCls, tdCls, inputCls } from '../../components/admin/AdminForm';

const statuses = ['New', 'Contacted', 'Closed'];

export default function AdminEnquiries() {
  const { enquiries, updateEnquiryStatus, deleteEnquiry } = useAdmin();

  return (
    <div>
      <PageHeader
        title="Manage Enquiries"
        subtitle={`${enquiries.filter((e) => e.status === 'New').length} new enquiries`}
      />
      {enquiries.length === 0 ? (
        <div className="rounded-xl bg-white p-10 text-center shadow-card">
          <p className="text-sm text-slate-500">
            No enquiries yet. Contact form submissions will appear here.
          </p>
        </div>
      ) : (
        <div className={tableWrap}>
          <table className={tableCls}>
            <thead className="border-b border-slate-100 bg-slate-50">
              <tr>
                <th className={thCls}>Date</th>
                <th className={thCls}>Name</th>
                <th className={thCls}>Subject</th>
                <th className={thCls}>Message</th>
                <th className={thCls}>Status</th>
                <th className={thCls}><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {enquiries.map((e) => (
                <tr key={e.id} className="transition hover:bg-slate-50">
                  <td className={tdCls}>{e.date}</td>
                  <td className={tdCls}>
                    <span className="block font-semibold text-primary">{e.name}</span>
                    <span className="text-xs text-slate-400">{e.email}</span>
                  </td>
                  <td className={`${tdCls} font-medium`}>{e.subject}</td>
                  <td className={tdCls}>
                    <span className="block max-w-[240px] truncate text-xs text-slate-500">{e.message}</span>
                  </td>
                  <td className={tdCls}>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={e.status} />
                      <select
                        value={e.status}
                        onChange={(ev) => updateEnquiryStatus(e.id, ev.target.value)}
                        aria-label={`Status of enquiry from ${e.name}`}
                        className={`${inputCls} !w-auto !py-1.5 text-xs font-semibold`}
                      >
                        {statuses.map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                  </td>
                  <td className={tdCls}>
                    <button
                      type="button"
                      onClick={() => deleteEnquiry(e.id)}
                      aria-label={`Delete enquiry from ${e.name}`}
                      className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
