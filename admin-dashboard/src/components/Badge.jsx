import clsx from 'clsx';

const TONES = {
  green: 'bg-emerald-100 text-emerald-700',
  red: 'bg-red-100 text-red-700',
  amber: 'bg-amber-100 text-amber-700',
  blue: 'bg-brand-100 text-brand-700',
  slate: 'bg-slate-100 text-slate-600',
};

export default function Badge({ tone = 'slate', children }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        TONES[tone] || TONES.slate
      )}
    >
      {children}
    </span>
  );
}
