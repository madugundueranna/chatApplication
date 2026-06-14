import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import ChartCard from './ChartCard';

// data: [{ label, value }]
export default function BarChartCard({ title, data = [], loading, color = '#2563EB' }) {
  return (
    <ChartCard title={title} loading={loading} isEmpty={!data.length}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} tickMargin={8} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} width={40} />
          <Tooltip
            cursor={{ fill: '#f8fafc' }}
            contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
          />
          <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
