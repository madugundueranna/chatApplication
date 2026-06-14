import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import Spinner from '../components/Spinner';

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Already signed in as an admin — skip the form.
  if (user) return <Navigate to="/" replace />;

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err?.message || 'Login failed. Check your credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand text-white">
            <MessageCircle className="h-6 w-6" />
          </span>
          <h1 className="mt-3 text-xl font-bold text-slate-900">Chatloop Admin</h1>
          <p className="text-sm text-slate-500">Sign in to the admin console</p>
        </div>

        <form
          onSubmit={onSubmit}
          className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          {error ? (
            <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </div>
          ) : null}

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@chatloop.app"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand-100"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand-100"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {submitting ? <Spinner className="h-4 w-4" /> : null}
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
}
