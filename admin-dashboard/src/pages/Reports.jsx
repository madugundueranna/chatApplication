import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { listReports, updateReport } from '../api/admin.api';
import DataTable from '../components/DataTable';
import Badge from '../components/Badge';
import { formatDateTime } from '../lib/format';

const STATUS_FILTERS = [
  { value: '', label: 'All statuses' },
  { value: 'open', label: 'Open' },
  { value: 'reviewed', label: 'Reviewed' },
  { value: 'dismissed', label: 'Dismissed' },
];

const STATUS_TONE = { open: 'amber', reviewed: 'green', dismissed: 'slate' };

// The status transitions offered per row.
const transitionsFor = (status) =>
  status === 'open'
    ? [
        { to: 'reviewed', label: 'Mark reviewed' },
        { to: 'dismissed', label: 'Dismiss' },
      ]
    : [{ to: 'open', label: 'Reopen' }];

function UserCell({ user, fallback }) {
  if (!user) return <span className="text-slate-400">{fallback}</span>;
  return (
    <span>
      <span className="font-medium text-slate-900">{user.name}</span>{' '}
      <span className="font-mono text-xs text-slate-400">{user.userId}</span>
    </span>
  );
}

export default function Reports() {
  const qc = useQueryClient();
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const params = useMemo(
    () => ({ status: status || undefined, page, limit: 20 }),
    [status, page]
  );

  const { data, isFetching, error } = useQuery({
    queryKey: ['reports', params],
    queryFn: () => listReports(params),
    placeholderData: keepPreviousData,
  });

  const mutation = useMutation({
    mutationFn: ({ reportId, to }) => updateReport(reportId, to),
    onSuccess: () => {
      toast.success('Report updated');
      qc.invalidateQueries({ queryKey: ['reports'] });
    },
    onError: (err) => toast.error(err?.message || 'Action failed'),
  });

  const columns = [
    {
      key: 'reporter',
      header: 'Reporter',
      render: (r) => <UserCell user={r.reporter} fallback="(deleted)" />,
    },
    {
      key: 'reported',
      header: 'Reported',
      render: (r) => <UserCell user={r.reported} fallback="(deleted)" />,
    },
    {
      key: 'reason',
      header: 'Reason',
      render: (r) => (
        <span className="block max-w-md truncate text-slate-600" title={r.reason}>
          {r.reason}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => <Badge tone={STATUS_TONE[r.status] || 'slate'}>{r.status}</Badge>,
    },
    { key: 'createdAt', header: 'Filed', render: (r) => formatDateTime(r.createdAt) },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (r) => (
        <div className="flex justify-end gap-1.5">
          {transitionsFor(r.status).map((t) => (
            <button
              key={t.to}
              type="button"
              disabled={mutation.isPending}
              onClick={() => mutation.mutate({ reportId: r.reportId, to: t.to })}
              className={
                t.to === 'dismissed'
                  ? 'rounded-md px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-40'
                  : 'rounded-md px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50 disabled:opacity-40'
              }
            >
              {t.label}
            </button>
          ))}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Reports</h2>
        <p className="text-sm text-slate-500">Review user reports and resolve them.</p>
      </div>

      <DataTable
        columns={columns}
        rows={data?.items}
        rowKey={(r) => r.reportId}
        loading={isFetching && !data}
        error={error}
        emptyText="No reports to review."
        toolbar={
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand-100"
          >
            {STATUS_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        }
        pagination={{
          page,
          totalPages: data?.totalPages,
          total: data?.total,
          onPageChange: setPage,
        }}
      />
    </div>
  );
}
