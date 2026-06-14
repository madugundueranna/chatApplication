import { NavLink } from 'react-router-dom';
import clsx from 'clsx';
import {
  LayoutDashboard,
  Users,
  MessagesSquare,
  MessageSquareText,
  MessageCircle,
} from 'lucide-react';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/users', label: 'Users', icon: Users },
  { to: '/conversations', label: 'Conversations', icon: MessagesSquare },
  { to: '/messages', label: 'Messages', icon: MessageSquareText },
];

export default function Sidebar() {
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
      <div className="flex h-16 items-center gap-2 border-b border-slate-200 px-5">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand text-white">
          <MessageCircle className="h-5 w-5" />
        </span>
        <div className="leading-tight">
          <p className="text-sm font-bold text-slate-900">Chatloop</p>
          <p className="text-xs text-slate-400">Admin</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-slate-600 hover:bg-slate-100'
              )
            }
          >
            <Icon className="h-5 w-5" />
            {label}
          </NavLink>
        ))}
      </nav>

      <p className="p-4 text-xs text-slate-400">Chatloop Admin · v1.0.0</p>
    </aside>
  );
}
