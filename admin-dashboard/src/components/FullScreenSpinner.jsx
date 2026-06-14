import Spinner from './Spinner';

export default function FullScreenSpinner({ label }) {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-3 text-slate-500">
      <Spinner className="h-7 w-7 text-brand" />
      {label ? <p className="text-sm">{label}</p> : null}
    </div>
  );
}
