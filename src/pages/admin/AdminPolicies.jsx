import { useState } from 'react';
import { FileText, ExternalLink, Plus, Save, Trash2, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAdmin } from '../../context/AdminContext';
import { createPolicySlug, getPolicyPath, policyOptions } from '../../data/policies';
import Button from '../../components/common/Button';
import { Field, PageHeader, inputCls } from '../../components/admin/AdminForm';

const emptyForm = {
  title: '',
  summary: '',
  items: [{ heading: '', text: '' }],
};

const orderedPolicyIds = (policies) => [
  ...policyOptions.map(({ id }) => id).filter((id) => policies[id]),
  ...Object.keys(policies).filter((id) => !policyOptions.some((option) => option.id === id)),
];

export default function AdminPolicies() {
  const { policies, addPolicy, updatePolicy, deletePolicy } = useAdmin();
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const setField = (key) => (event) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));

  const closeEditor = () => {
    setForm(emptyForm);
    setEditingId(null);
    setError('');
  };

  const editPolicy = (id) => {
    const policy = policies[id];
    setEditingId(id);
    setForm({
      title: policy.title || '',
      summary: policy.summary || '',
      items: policy.items?.length ? policy.items.map((item) => ({ ...item })) : [{ heading: '', text: '' }],
    });
    setError('');
    setNotice('');
  };

  const updateItem = (index, key, value) => {
    setForm((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: value } : item
      ),
    }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const title = form.title.trim();
    const summary = form.summary.trim();
    const items = form.items
      .map(({ heading, text }) => ({ heading: heading.trim(), text: text.trim() }))
      .filter(({ heading, text }) => heading && text);

    if (!title || !summary || items.length === 0) {
      setError('Add a title, summary, and at least one complete policy section.');
      return;
    }

    const id = editingId || createPolicySlug(title);
    if (!id) {
      setError('Use a title with at least one letter or number to create a policy URL.');
      return;
    }
    if (!editingId && policies[id]) {
      setError('A policy with this URL already exists. Choose a different title.');
      return;
    }

    const policy = { title, summary, items };
    if (editingId) updatePolicy(id, policy);
    else addPolicy(id, policy);

    closeEditor();
    setNotice(`"${title}" was ${editingId ? 'updated' : 'added'}.`);
  };

  const removePolicy = (id) => {
    if (!window.confirm(`Delete "${policies[id].title}"? This will remove its public policy page and links.`)) return;
    deletePolicy(id);
    if (editingId === id) closeEditor();
    setNotice(`"${policies[id].title}" was deleted.`);
  };

  return (
    <div>
      <PageHeader
        title="Manage Policies"
        subtitle="Create and update the policies shown on your storefront."
        action={
          !editingId && (
            <Button
              variant="secondary"
              size="md"
              onClick={() => {
                setForm(emptyForm);
                setError('');
                setNotice('');
                setEditingId('');
              }}
            >
              <Plus size={16} />
              Add Policy
            </Button>
          )
        }
      />

      {notice && (
        <p role="status" className="mb-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          {notice}
        </p>
      )}

      {Boolean(editingId !== null) && (
        <form onSubmit={handleSubmit} className="mb-6 rounded-xl bg-white p-5 shadow-card sm:p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 className="text-base font-bold text-primary">{editingId ? 'Edit Policy' : 'Add Policy'}</h2>
            <button type="button" onClick={closeEditor} aria-label="Close policy editor" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
              <X size={18} />
            </button>
          </div>

          <div className="space-y-4">
            <Field label="Policy Title *">
              <input required value={form.title} onChange={setField('title')} className={inputCls} placeholder="e.g. Warranty Policy" />
            </Field>
            <Field label="Summary *">
              <textarea required rows="2" value={form.summary} onChange={setField('summary')} className={inputCls} placeholder="A short introduction to this policy" />
            </Field>

            <div>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-primary">Policy Sections *</h3>
                <button
                  type="button"
                  onClick={() => setForm((current) => ({ ...current, items: [...current.items, { heading: '', text: '' }] }))}
                  className="text-xs font-semibold text-secondary hover:underline"
                >
                  + Add section
                </button>
              </div>
              <div className="space-y-3">
                {form.items.map((item, index) => (
                  <div key={index} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Section {index + 1}</span>
                      {form.items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setForm((current) => ({ ...current, items: current.items.filter((_, itemIndex) => itemIndex !== index) }))}
                          aria-label={`Remove section ${index + 1}`}
                          className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                    <div className="space-y-3">
                      <Field label="Heading *">
                        <input required value={item.heading} onChange={(event) => updateItem(index, 'heading', event.target.value)} className={inputCls} placeholder="e.g. Eligibility" />
                      </Field>
                      <Field label="Content *">
                        <textarea required rows="3" value={item.text} onChange={(event) => updateItem(index, 'text', event.target.value)} className={inputCls} placeholder="Describe the policy details" />
                      </Field>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {error && <p role="alert" className="mt-4 text-sm font-medium text-red-600">{error}</p>}
          <div className="mt-5 flex flex-wrap gap-3">
            <Button type="submit" variant="primary"><Save size={16} /> Save Policy</Button>
            <Button type="button" variant="ghost" onClick={closeEditor}>Cancel</Button>
          </div>
        </form>
      )}

      {orderedPolicyIds(policies).length === 0 ? (
        <div className="rounded-xl bg-white p-10 text-center shadow-card">
          <FileText size={40} className="mx-auto text-slate-300" />
          <p className="mt-3 text-sm text-slate-500">No policies created yet.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {orderedPolicyIds(policies).map((id) => {
            const policy = policies[id];
            return (
              <article key={id} className="flex flex-col rounded-xl bg-white p-5 shadow-card">
                <div className="flex items-start justify-between gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary/10 text-secondary">
                    <FileText size={20} />
                  </span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">
                    {policy.items?.length || 0} section(s)
                  </span>
                </div>
                <h2 className="mt-3 text-sm font-bold text-primary">{policy.title}</h2>
                <p className="mt-1 line-clamp-3 flex-1 text-xs leading-relaxed text-slate-500">{policy.summary}</p>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
                  <Link to={getPolicyPath(id)} target="_blank" className="inline-flex items-center gap-1 text-xs font-semibold text-secondary hover:underline">
                    Preview <ExternalLink size={12} />
                  </Link>
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={() => editPolicy(id)} className="text-xs font-semibold text-secondary hover:underline">Edit</button>
                    <button type="button" onClick={() => removePolicy(id)} aria-label={`Delete ${policy.title}`} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <p className="mt-2 truncate text-[11px] text-slate-400">{getPolicyPath(id)}</p>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
