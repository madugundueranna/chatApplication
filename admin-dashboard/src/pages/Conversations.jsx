import { useState } from 'react';
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { listConversations, deleteConversation } from '../api/admin.api';
import DataTable from '../components/DataTable';
import ConfirmDialog from '../components/ConfirmDialog';
import Badge from '../components/Badge';
import { formatDateTime } from '../lib/format';

// Each participant is shown as their name with the readable userId (USR-…)
// beside it, capped at 3 with a "+N more" overflow.
const renderParticipants = (parts = []) => {
  if (!parts.length) return <span className="text-slate-400">—</span>;
  const shown = parts.slice(0, 3);
  const extra = parts.length - shown.length;
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
      {shown.map((p) => (
        <span key={p.userId} className="whitespace-nowrap">
          {p.name}
          <span className="ml-1 font-mono text-xs text-slate-400">{p.userId}</span>
        </span>
      ))}
      {extra > 0 ? <span className="text-slate-400">+{extra} more</span> : null}
    </span>
  );
};

export default function Conversations() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [pending, setPending] = useState(null); // conversation to delete

  const { data, isFetching, error } = useQuery({
    queryKey: ['conversations', page],
    queryFn: () => listConversations({ page, limit: 20 }),
    placeholderData: keepPreviousData,
  });

  const mutation = useMutation({
    mutationFn: (conv) => deleteConversation(conv.conversationId),
    onSuccess: () => {
      toast.success('Conversation deleted');
      qc.invalidateQueries({ queryKey: ['conversations'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
      setPending(null);
    },
    onError: (err) => toast.error(err?.message || 'Delete failed'),
  });

  const columns = [
    {
      key: 'type',
      header: 'Type',
      render: (c) => <Badge tone={c.type === 'group' ? 'blue' : 'slate'}>{c.type}</Badge>,
    },
    {
      key: 'participants',
      header: 'Participants',
      className: 'text-slate-700',
      render: (c) => (
        <span>
          {c.type === 'group' && c.name ? (
            <span className="font-medium text-slate-900">{c.name}: </span>
          ) : null}
          {renderParticipants(c.participants)}
        </span>
      ),
    },
    { key: 'messageCount', header: 'Messages', align: 'right', render: (c) => c.messageCount ?? 0 },
    {
      key: 'updatedAt',
      header: 'Last activity',
      render: (c) => formatDateTime(c.updatedAt),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (c) => (
        <div className="flex justify-end gap-1.5">
          <button
            type="button"
            onClick={() => navigate(`/messages?conversationId=${c.conversationId}`)}
            className="rounded-md px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50"
          >
            View messages
          </button>
          <button
            type="button"
            onClick={() => setPending(c)}
            className="rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
          >
            Delete
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Conversations</h2>
        <p className="text-sm text-slate-500">Browse and moderate conversations.</p>
      </div>

      <DataTable
        columns={columns}
        rows={data?.items}
        rowKey={(c) => c.conversationId}
        loading={isFetching && !data}
        error={error}
        emptyText="No conversations yet."
        pagination={{
          page,
          totalPages: data?.totalPages,
          total: data?.total,
          onPageChange: setPage,
        }}
      />

      <ConfirmDialog
        open={!!pending}
        title="Delete this conversation?"
        message="All messages in this conversation will be permanently removed. This cannot be undone."
        confirmLabel="Delete"
        danger
        loading={mutation.isPending}
        onConfirm={() => mutation.mutate(pending)}
        onCancel={() => (mutation.isPending ? null : setPending(null))}
      />
    </div>
  );
}
