import clsx from 'clsx';
import Spinner from './Spinner';

/**
 * Controlled confirmation modal.
 *
 * open, title, message, confirmLabel, danger, loading, onConfirm, onCancel
 */
export default function ConfirmDialog({
  open,
  title = 'Are you sure?',
  message,
  confirmLabel = 'Confirm',
  danger = false,
  loading = false,
  onConfirm,
  onCancel,
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-900/40"
        onClick={loading ? undefined : onCancel}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
      >
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        {message ? <p className="mt-2 text-sm text-slate-600">{message}</p> : null}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={clsx(
              'inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-60',
              danger ? 'bg-red-600 hover:bg-red-700' : 'bg-brand hover:bg-brand-700'
            )}
          >
            {loading ? <Spinner className="h-4 w-4" /> : null}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
