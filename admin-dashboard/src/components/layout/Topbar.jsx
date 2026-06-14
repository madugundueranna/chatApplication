import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../auth/AuthProvider';
import Spinner from '../Spinner';

export default function Topbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const onLogout = async () => {
    setBusy(true);
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch {
      toast.error('Could not log out cleanly.');
    } finally {
      setBusy(false);
    }
  };

  const initials = (user?.name || user?.email || '?')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6">
      <h1 className="text-base font-semibold text-slate-700">Admin Console</h1>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
            {initials}
          </span>
          <div className="hidden text-right leading-tight sm:block">
            <p className="text-sm font-medium text-slate-800">{user?.name}</p>
            <p className="text-xs text-slate-400">{user?.email}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onLogout}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        >
          {busy ? <Spinner className="h-4 w-4" /> : <LogOut className="h-4 w-4" />}
          Logout
        </button>
      </div>
    </header>
  );
}
