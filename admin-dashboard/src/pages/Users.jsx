import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { listUsers, updateUser, deleteUser } from '../api/admin.api';
import { useAuth } from '../auth/AuthProvider';
import DataTable from '../components/DataTable';
import ConfirmDialog from '../components/ConfirmDialog';
import Badge from '../components/Badge';
import useDebounced from '../lib/useDebounced';
import { formatDate } from '../lib/format';

const FILTERS = [
  { value: '', label: 'All users' },
  { value: 'verified', label: 'Verified' },
  { value: 'unverified', label: 'Unverified' },
  { value: 'online', label: 'Online' },
  { value: 'admin', label: 'Admins' },
  { value: 'user', label: 'Regular users' },
  { value: 'active', label: 'Active' },
  { value: 'banned', label: 'Banned' },
];

const SORTS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'name', label: 'Name (A–Z)' },
];

// Build the confirm-action descriptors for one user row.
const actionsFor = (u) => [
  {
    key: 'verify',
    label: u.isVerified ? 'Unverify' : 'Verify',
    payload: { isVerified: !u.isVerified },
    title: u.isVerified ? 'Unverify this user?' : 'Verify this user?',
    message: `This will ${u.isVerified ? 'remove verification from' : 'mark as verified'} ${u.name}.`,
    confirmLabel: u.isVerified ? 'Unverify' : 'Verify',
    success: u.isVerified ? 'User unverified' : 'User verified',
  },
  {
    key: 'badge',
    label: u.isVerifiedAccount ? 'Remove badge' : 'Give badge',
    payload: { isVerifiedAccount: !u.isVerifiedAccount },
    title: u.isVerifiedAccount ? 'Remove verified badge?' : 'Grant verified badge?',
    message: u.isVerifiedAccount
      ? `${u.name} will lose the verified (blue tick) badge.`
      : `${u.name} will get the verified (blue tick) badge shown in the app.`,
    confirmLabel: u.isVerifiedAccount ? 'Remove' : 'Grant',
    success: u.isVerifiedAccount ? 'Badge removed' : 'Badge granted',
  },
  {
    key: 'role',
    label: u.role === 'admin' ? 'Demote' : 'Promote',
    selfBlocked: true,
    payload: { role: u.role === 'admin' ? 'user' : 'admin' },
    title: u.role === 'admin' ? 'Remove admin access?' : 'Make this user an admin?',
    message:
      u.role === 'admin'
        ? `${u.name} will lose admin access.`
        : `${u.name} will gain full admin access.`,
    confirmLabel: u.role === 'admin' ? 'Demote' : 'Promote',
    danger: u.role === 'admin',
    success: u.role === 'admin' ? 'Admin demoted' : 'User promoted to admin',
  },
  {
    key: 'ban',
    label: u.isActive ? 'Ban' : 'Unban',
    selfBlocked: true,
    payload: { isActive: !u.isActive },
    title: u.isActive ? 'Ban this user?' : 'Unban this user?',
    message: u.isActive
      ? `${u.name} will be suspended and signed out of all sessions.`
      : `${u.name} will regain access to their account.`,
    confirmLabel: u.isActive ? 'Ban' : 'Unban',
    danger: u.isActive,
    success: u.isActive ? 'User banned' : 'User unbanned',
  },
  {
    key: 'delete',
    label: 'Delete',
    selfBlocked: true,
    isDelete: true,
    title: 'Delete this user?',
    message: `${u.name} and their messages will be permanently removed. This cannot be undone.`,
    confirmLabel: 'Delete',
    danger: true,
    success: 'User deleted',
  },
];

export default function Users() {
  const { user: me } = useAuth();
  const qc = useQueryClient();

  const [searchInput, setSearchInput] = useState('');
  const search = useDebounced(searchInput);
  const [filter, setFilter] = useState('');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);

  // A pending action holds both the row and its chosen descriptor.
  const [pending, setPending] = useState(null); // { user, action }

  const params = useMemo(
    () => ({ search: search || undefined, filter: filter || undefined, sort, page, limit: 20 }),
    [search, filter, sort, page]
  );

  const { data, isFetching, error } = useQuery({
    queryKey: ['users', params],
    queryFn: () => listUsers(params),
    placeholderData: keepPreviousData,
  });

  const mutation = useMutation({
    mutationFn: ({ user, action }) =>
      action.isDelete ? deleteUser(user.userId) : updateUser(user.userId, action.payload),
    onSuccess: (_res, { action }) => {
      toast.success(action.success);
      qc.invalidateQueries({ queryKey: ['users'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
      setPending(null);
    },
    onError: (err) => toast.error(err?.message || 'Action failed'),
  });

  // Reset to page 1 whenever a filter/search/sort changes.
  const onFilterChange = (setter) => (e) => {
    setter(e.target.value);
    setPage(1);
  };

  const columns = [
    { key: 'name', header: 'Name', className: 'font-medium text-slate-900' },
    { key: 'email', header: 'Email', render: (u) => <span className="text-slate-500">{u.email}</span> },
    {
      key: 'role',
      header: 'Role',
      render: (u) => <Badge tone={u.role === 'admin' ? 'blue' : 'slate'}>{u.role}</Badge>,
    },
    {
      key: 'isVerified',
      header: 'Email',
      render: (u) =>
        u.isVerified ? <Badge tone="green">Verified</Badge> : <Badge tone="slate">No</Badge>,
    },
    {
      key: 'isVerifiedAccount',
      header: 'Badge',
      render: (u) =>
        u.isVerifiedAccount ? <Badge tone="blue">✓ Verified</Badge> : <Badge tone="slate">—</Badge>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (u) =>
        !u.isActive ? (
          <Badge tone="red">Banned</Badge>
        ) : u.isOnline ? (
          <Badge tone="green">Online</Badge>
        ) : (
          <Badge tone="slate">Offline</Badge>
        ),
    },
    { key: 'createdAt', header: 'Joined', render: (u) => formatDate(u.createdAt) },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (u) => {
        const isSelf = u.userId === me?.userId;
        return (
          <div className="flex justify-end gap-1.5">
            {actionsFor(u).map((action) => {
              const disabled = isSelf && action.selfBlocked;
              return (
                <button
                  key={action.key}
                  type="button"
                  disabled={disabled}
                  title={disabled ? 'You cannot do this to your own account' : undefined}
                  onClick={() => setPending({ user: u, action })}
                  className={
                    action.danger
                      ? 'rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-30 disabled:hover:bg-transparent'
                      : 'rounded-md px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent'
                  }
                >
                  {action.label}
                </button>
              );
            })}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Users</h2>
        <p className="text-sm text-slate-500">Manage accounts, roles and access.</p>
      </div>

      <DataTable
        columns={columns}
        rows={data?.items}
        rowKey={(u) => u.userId}
        loading={isFetching && !data}
        error={error}
        emptyText="No users match your filters."
        toolbar={
          <>
            <div className="relative flex-1 min-w-[220px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={searchInput}
                onChange={(e) => {
                  setSearchInput(e.target.value);
                  setPage(1);
                }}
                placeholder="Search by name or email…"
                className="w-full rounded-md border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand-100"
              />
            </div>
            <select
              value={filter}
              onChange={onFilterChange(setFilter)}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand-100"
            >
              {FILTERS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
            <select
              value={sort}
              onChange={onFilterChange(setSort)}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand-100"
            >
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </>
        }
        pagination={{
          page,
          totalPages: data?.totalPages,
          total: data?.total,
          onPageChange: setPage,
        }}
      />

      <ConfirmDialog
        open={!!pending}
        title={pending?.action.title}
        message={pending?.action.message}
        confirmLabel={pending?.action.confirmLabel}
        danger={pending?.action.danger}
        loading={mutation.isPending}
        onConfirm={() => mutation.mutate(pending)}
        onCancel={() => (mutation.isPending ? null : setPending(null))}
      />
    </div>
  );
}
