import { useQuery } from '@tanstack/react-query';
import {
  Users as UsersIcon,
  Wifi,
  MessagesSquare,
  MessageSquareText,
  BadgeCheck,
  Shield,
} from 'lucide-react';
import { getStats } from '../api/admin.api';
import StatCard from '../components/StatCard';
import BarChartCard from '../components/charts/BarChartCard';
import LineChartCard from '../components/charts/LineChartCard';
import { shortDay } from '../lib/format';

const toSeries = (rows = []) =>
  rows.map((r) => ({ label: shortDay(r._id), value: r.count }));

export default function Dashboard() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['stats'],
    queryFn: getStats,
  });

  const users = data?.users || {};
  const conversations = data?.conversations || {};
  const messages = data?.messages || {};
  const signups = toSeries(data?.timeSeries?.signupsPerDay);
  const messagesPerDay = toSeries(data?.timeSeries?.messagesPerDay);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Dashboard</h2>
        <p className="text-sm text-slate-500">Overview of activity across the app.</p>
      </div>

      {error ? (
        <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-600">
          {error.message || 'Failed to load stats.'}
        </div>
      ) : null}

      {/* Primary metrics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total users" value={users.total ?? 0} icon={UsersIcon} loading={isLoading} />
        <StatCard label="Online now" value={users.onlineNow ?? 0} icon={Wifi} loading={isLoading} />
        <StatCard
          label="Conversations"
          value={conversations.total ?? 0}
          icon={MessagesSquare}
          loading={isLoading}
        />
        <StatCard
          label="Messages today"
          value={messages.today ?? 0}
          icon={MessageSquareText}
          loading={isLoading}
        />
      </div>

      {/* Secondary metrics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Verified users" value={users.verified ?? 0} icon={BadgeCheck} loading={isLoading} />
        <StatCard label="Admins" value={users.admins ?? 0} icon={Shield} loading={isLoading} />
        <StatCard
          label="Messages this week"
          value={messages.week ?? 0}
          icon={MessageSquareText}
          loading={isLoading}
        />
        <StatCard
          label="Total messages"
          value={messages.total ?? 0}
          icon={MessageSquareText}
          loading={isLoading}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <BarChartCard title="New signups (last 30 days)" data={signups} loading={isLoading} />
        <LineChartCard title="Messages per day (last 30 days)" data={messagesPerDay} loading={isLoading} />
      </div>
    </div>
  );
}
