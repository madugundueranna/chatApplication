import clsx from 'clsx';

export default function StatCard({ label, value, icon: Icon, hint, loading }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          {loading ? (
            <div className="mt-2 h-8 w-20 animate-pulse rounded bg-slate-200" />
          ) : (
            <p className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">
              {value}
            </p>
          )}
          {hint ? <p className="mt-1 text-xs text-slate-400">{hint}</p> : null}
        </div>
        {Icon ? (
          <span className={clsx('rounded-lg bg-brand-50 p-2.5 text-brand')}>
            <Icon className="h-5 w-5" />
          </span>
        ) : null}
      </div>
    </div>
  );
}
