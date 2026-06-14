import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { listMessages, deleteMessage } from '../api/admin.api';
import DataTable from '../components/DataTable';
import ConfirmDialog from '../components/ConfirmDialog';
import Badge from '../components/Badge';
import useDebounced from '../lib/useDebounced';
import { formatDateTime } from '../lib/format';

export default function Messages() {
  const qc = useQueryClient();
  const [searchParams] = useSearchParams();

  // Conversations page deep-links here with ?conversationId=…
  const [convInput, setConvInput] = useState(searchParams.get('conversationId') || '');
  const [senderInput, setSenderInput] = useState(searchParams.get('senderId') || '');
  const [page, setPage] = useState(1);
  const [pending, setPending] = useState(null); // message to delete

  const conversationId = useDebounced(convInput);
  const senderId = useDebounced(senderInput);

  // Reset paging when filters change.
  useEffect(() => setPage(1), [conversationId, senderId]);

  const params = useMemo(
    () => ({
      conversationId: conversationId || undefined,
      senderId: senderId || undefined,
      page,
      limit: 20,
    }),
    [conversationId, senderId, page]
  );

  const { data, isFetching, error } = useQuery({
    queryKey: ['messages', params],
    queryFn: () => listMessages(params),
    placeholderData: keepPreviousData,
  });

  const mutation = useMutation({
    mutationFn: (msg) => deleteMessage(msg.messageId),
    onSuccess: () => {
      toast.success('Message deleted');
      qc.invalidateQueries({ queryKey: ['messages'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
      setPending(null);
    },
    onError: (err) => toast.error(err?.message || 'Delete failed'),
  });

  const columns = [
    {
      key: 'sender',
      header: 'Sender',
      className: 'font-medium text-slate-900',
      render: (m) => m.sender?.name || <span className="text-slate-400">Unknown</span>,
    },
    {
      key: 'conversation',
      header: 'Conversation',
      render: (m) =>
        m.conversation ? (
          <span className="text-slate-500">
            {m.conversation.name || m.conversation.conversationId}
          </span>
        ) : (
          <span className="text-slate-400">—</span>
        ),
    },
    {
      key: 'content',
      header: 'Content',
      render: (m) =>
        m.isDeleted ? (
          <span className="italic text-slate-400">[deleted]</span>
        ) : m.type !== 'text' ? (
          <Badge tone="slate">{m.type}</Badge>
        ) : (
          <span className="block max-w-md truncate text-slate-700" title={m.content}>
            {m.content}
          </span>
        ),
    },
    { key: 'createdAt', header: 'Sent', render: (m) => formatDateTime(m.createdAt) },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (m) =>
        m.isDeleted ? (
          <span className="text-xs text-slate-300">—</span>
        ) : (
          <button
            type="button"
            onClick={() => setPending(m)}
            className="rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
          >
            Delete
          </button>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Messages</h2>
        <p className="text-sm text-slate-500">Moderate messages by conversation or sender.</p>
      </div>

      <DataTable
        columns={columns}
        rows={data?.items}
        rowKey={(m) => m.messageId}
        loading={isFetching && !data}
        error={error}
        emptyText="No messages match your filters."
        toolbar={
          <>
            <input
              value={convInput}
              onChange={(e) => setConvInput(e.target.value)}
              placeholder="Filter by conversation ID (CVE-…)"
              className="min-w-[240px] flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand-100"
            />
            <input
              value={senderInput}
              onChange={(e) => setSenderInput(e.target.value)}
              placeholder="Filter by sender ID (USR-…)"
              className="min-w-[240px] flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand-100"
            />
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
        title="Delete this message?"
        message="The message content will be removed for everyone. This cannot be undone."
        confirmLabel="Delete"
        danger
        loading={mutation.isPending}
        onConfirm={() => mutation.mutate(pending)}
        onCancel={() => (mutation.isPending ? null : setPending(null))}
      />
    </div>
  );
}
