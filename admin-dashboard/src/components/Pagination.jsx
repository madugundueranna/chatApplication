import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function Pagination({ page, totalPages, total, onPageChange }) {
  const pages = totalPages || 1;
  const canPrev = page > 1;
  const canNext = page < pages;

  return (
    <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm text-slate-500">
      <span>
        Page <span className="font-medium text-slate-700">{page}</span> of{' '}
        <span className="font-medium text-slate-700">{pages}</span>
        {typeof total === 'number' ? ` · ${total} total` : null}
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={!canPrev}
          className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1.5 font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" /> Prev
        </button>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={!canNext}
          className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1.5 font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
