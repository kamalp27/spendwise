import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';
import { CreditCard, Wallet } from 'lucide-react';
import EmptyState from '../../components/common/EmptyState.jsx';

const PAYMENT_METHOD_COLORS = {
  UPI: '#3B82F6',
  'Credit Card': '#8B5CF6',
  'Debit Card': '#06B6D4',
  Cash: '#10B981',
  'Net Banking': '#F59E0B',
  Other: '#6B7280'
};

function PaymentTooltip({ active, payload }) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="p-2.5 rounded-lg bg-[#0F172A] border border-[#1E293B] text-xs shadow-xl space-y-1">
        <p className="font-semibold text-white">{data.paymentMethod}</p>
        <p className="text-blue-400 font-bold">₹{Number(data.totalAmount || 0).toFixed(2)}</p>
        <p className="text-[#94A3B8]">
          {Number(data.percentage || 0).toFixed(1)}% of total • {data.transactionCount} transaction(s)
        </p>
      </div>
    );
  }
  return null;
}

export default function PaymentMethodDistribution({ byPaymentMethod = [], totalSpending = 0 }) {
  const hasData = byPaymentMethod.length > 0 && totalSpending > 0;

  return (
    <section
      aria-label="Payment Method Distribution"
      className="bg-[#0F172A] border border-[#1E293B] rounded-xl p-5 sm:p-6 shadow-sm flex flex-col justify-between"
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-[#1E293B]">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-600/10 text-blue-400 flex items-center justify-center border border-blue-500/20 flex-shrink-0">
            <CreditCard className="w-4 h-4" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white tracking-tight">
              Payment Methods
            </h2>
            <p className="text-xs text-[#94A3B8]">
              Volume by transaction channel
            </p>
          </div>
        </div>
        <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-[#1E293B] text-[#94A3B8]">
          {byPaymentMethod.length} Channel(s)
        </span>
      </div>

      {/* Body */}
      <div className="my-6">
        {!hasData ? (
          <EmptyState
            icon={Wallet}
            title="No payment method data"
            description="Payment channels (UPI, Cards, Cash, Net Banking) will appear here once transactions are recorded."
          />
        ) : (
          <div className="space-y-4">
            {/* Recharts Horizontal Bar Chart */}
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100}>
                <BarChart
                  data={byPaymentMethod}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                >
                  <XAxis type="number" hide />
                  <YAxis
                    dataKey="paymentMethod"
                    type="category"
                    stroke="#94A3B8"
                    fontSize={11}
                    width={85}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip content={<PaymentTooltip />} />
                  <Bar dataKey="totalAmount" radius={[0, 4, 4, 0]}>
                    {byPaymentMethod.map((entry) => (
                      <Cell
                        key={`pm-cell-${entry.paymentMethod}`}
                        fill={PAYMENT_METHOD_COLORS[entry.paymentMethod] || '#3B82F6'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* List breakdown with progress track */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
              {byPaymentMethod.map((item) => {
                const color = PAYMENT_METHOD_COLORS[item.paymentMethod] || '#3B82F6';
                return (
                  <div
                    key={`pm-stat-${item.paymentMethod}`}
                    className="p-2.5 rounded-lg bg-[#0B0F19] border border-[#1E293B]/70 text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: color }}
                          aria-hidden="true"
                        />
                        <span className="font-medium text-white">{item.paymentMethod}</span>
                      </div>
                      <span className="text-[#94A3B8]">
                        {Number(item.percentage || 0).toFixed(1)}%
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>{item.transactionCount} txn(s)</span>
                      <strong className="text-white font-semibold">
                        ₹{Number(item.totalAmount || 0).toFixed(2)}
                      </strong>
                    </div>

                    <div className="w-full bg-[#1E293B] h-1 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${Math.min(100, item.percentage || 0)}%`,
                          backgroundColor: color
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="pt-3 border-t border-[#1E293B] flex items-center justify-between text-[11px] text-[#94A3B8]">
        <span>Strict database grouping</span>
        <span>Includes UPI, Cards, Cash & Banking</span>
      </div>
    </section>
  );
}
