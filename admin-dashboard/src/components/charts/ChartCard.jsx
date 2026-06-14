import Spinner from '../Spinner';

// Shared frame for the dashboard charts: title + fixed-height body with
// loading / empty fallbacks so each chart wrapper stays tiny.
export default function ChartCard({ title, loading, isEmpty, children }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
      <div className="mt-4 h-64">
        {loading ? (
          <div className="flex h-full items-center justify-center text-slate-400">
            <Spinner className="h-5 w-5" />
          </div>
        ) : isEmpty ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">
            No data yet.
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
