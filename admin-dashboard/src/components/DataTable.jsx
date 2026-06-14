import clsx from 'clsx';
import Spinner from './Spinner';
import Pagination from './Pagination';

/**
 * Reusable server-paginated table.
 *
 * columns: [{ key, header, render?(row), className?, align? }]
 * rows:    array of records
 * rowKey:  (row) => string|number
 * toolbar: optional node rendered above the table (search / filters)
 * pagination: { page, totalPages, total, onPageChange }
 */
export default function DataTable({
  columns,
  rows = [],
  rowKey,
  loading,
  error,
  emptyText = 'Nothing to show.',
  toolbar,
  pagination,
}) {
  const colSpan = columns.length;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      {toolbar ? (
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 p-4">
          {toolbar}
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={clsx(
                    'whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500',
                    col.align === 'right' && 'text-right',
                    col.headerClassName
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={colSpan} className="px-4 py-12">
                  <div className="flex items-center justify-center gap-2 text-slate-400">
                    <Spinner className="h-5 w-5" /> Loading…
                  </div>
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={colSpan} className="px-4 py-12 text-center text-red-500">
                  {error.message || 'Failed to load data.'}
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={colSpan} className="px-4 py-12 text-center text-slate-400">
                  {emptyText}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={rowKey(row)} className="hover:bg-slate-50/70">
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={clsx(
                        'whitespace-nowrap px-4 py-3 text-slate-700',
                        col.align === 'right' && 'text-right',
                        col.className
                      )}
                    >
                      {col.render ? col.render(row) : row[col.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pagination ? <Pagination {...pagination} /> : null}
    </div>
  );
}
