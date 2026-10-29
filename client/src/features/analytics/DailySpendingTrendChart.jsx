import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { TrendingUp, Calendar } from 'lucide-react';
import EmptyState from '../../components/common/EmptyState.jsx';

function TrendTooltip({ active, payload }) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="p-2.5 rounded-lg bg-[#0F172A] border border-[#1E293B] text-xs shadow-xl space-y-1">
        <p className="font-semibold text-white">{data.date}</p>
        <p className="text-blue-400 font-bold">₹{Number(data.dailyTotal || 0).toFixed(2)}</p>
        <p className="text-[#94A3B8]">{data.transactionCount} transaction(s)</p>
      </div>
    );
  }
  return null;
}

export default function DailySpendingTrendChart({ dailyTrend = [], totalSpending = 0 }) {
  const hasData = dailyTrend.length > 0 && totalSpending > 0;

  // Compute peak day for helper metrics
  let peakDay = null;
  let peakAmount = 0;
  for (const day of dailyTrend) {
    if (day.dailyTotal > peakAmount) {
      peakAmount = day.dailyTotal;
      peakDay = day.date;
    }
  }

  return (
    <section
      aria-label="Daily Spending Velocity Trend"
      className="bg-[#0F172A] border border-[#1E293B] rounded-xl p-5 sm:p-6 shadow-sm flex flex-col justify-between"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-[#1E293B]">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-600/10 text-blue-400 flex items-center justify-center border border-blue-500/20 flex-shrink-0">
            <TrendingUp className="w-4 h-4" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white tracking-tight">
              Daily Spending Velocity
            </h2>
            <p className="text-xs text-[#94A3B8]">
              Chronological expense accumulation throughout the month
            </p>
          </div>
        </div>

        {hasData && (
          <div className="flex items-center space-x-3 text-xs text-[#94A3B8] self-start sm:self-auto">
            <span>
              Active Days: <strong className="text-white">{dailyTrend.length}</strong>
            </span>
            {peakDay && (
              <span>
                Peak: <strong className="text-blue-400">₹{peakAmount.toFixed(2)}</strong> ({peakDay.slice(8)})
              </span>
            )}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="my-6">
        {!hasData ? (
          <EmptyState
            icon={Calendar}
            title="No daily spending recorded"
            description="A chronological trend area chart will visualize day-by-day accumulation once expenses are logged."
          />
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100}>
              <AreaChart
                data={dailyTrend}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="spendingVelocityGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563EB" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#2563EB" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
                <XAxis
                  dataKey="date"
                  stroke="#94A3B8"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: '#1E293B' }}
                  tickFormatter={(val) => (typeof val === 'string' && val.length >= 10 ? val.slice(8) : val)}
                />
                <YAxis
                  stroke="#94A3B8"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: '#1E293B' }}
                  tickFormatter={(val) => `₹${val}`}
                />
                <Tooltip content={<TrendTooltip />} />
                <Area
                  type="monotone"
                  dataKey="dailyTotal"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#spendingVelocityGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="pt-3 border-t border-[#1E293B] flex items-center justify-between text-[11px] text-[#94A3B8]">
        <span>Chronological SQL DATE aggregation</span>
        <span>Days on X-axis (01-31)</span>
      </div>
    </section>
  );
}
