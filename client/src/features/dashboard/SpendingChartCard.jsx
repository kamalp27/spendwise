import React, { useState } from 'react';
import { BarChart3, TrendingUp, Info, ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';

const TIME_RANGES = ['This Month', 'Last 30 Days', 'Year to Date'];

export default function SpendingChartCard({ onNavigateToAnalytics = null }) {
  const [selectedRange, setSelectedRange] = useState('This Month');
  const { user } = useAuth();

  const userCurrency = user?.currency || 'INR';
  const currencyBadge = userCurrency === 'INR' ? 'INR (₹)' : (userCurrency === 'USD' ? 'USD ($)' : (userCurrency === 'EUR' ? 'EUR (€)' : userCurrency));

  return (
    <section
      aria-labelledby="spending-chart-heading"
      className="bg-[#0F172A] border border-[#1E293B] rounded-xl p-5 sm:p-6 shadow-sm flex flex-col justify-between"
    >
      {/* Header with Title and Range Selectors */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-[#1E293B]">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-600/10 text-blue-400 flex items-center justify-center border border-blue-500/20 flex-shrink-0">
            <TrendingUp className="w-4 h-4" aria-hidden="true" />
          </div>
          <div>
            <h2 id="spending-chart-heading" className="text-base font-semibold text-white tracking-tight">
              Spending Trends
            </h2>
            <p className="text-xs text-[#94A3B8]">
              Daily expense accumulation and monthly pace
            </p>
          </div>
        </div>

        {/* Range Selector Pill Group */}
        <div className="inline-flex items-center p-1 rounded-lg bg-[#0B0F19] border border-[#1E293B] self-start sm:self-auto" role="tablist" aria-label="Time range selector">
          {TIME_RANGES.map((range) => {
            const isSelected = selectedRange === range;
            return (
              <button
                key={range}
                type="button"
                role="tab"
                aria-selected={isSelected}
                onClick={() => setSelectedRange(range)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-[#94A3B8] hover:text-white'
                }`}
              >
                {range}
              </button>
            );
          })}
        </div>
      </div>

      {/* Chart Canvas Area / Actionable Overview Container */}
      <div className="my-6 min-h-[240px] rounded-lg bg-[#0B0F19]/60 border border-dashed border-[#1E293B] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 rounded-xl bg-blue-600/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mb-3">
          <BarChart3 className="w-6 h-6" aria-hidden="true" />
        </div>
        <h3 className="text-sm font-semibold text-white tracking-tight">
          Interactive Analytics & Trends
        </h3>
        <p className="mt-1 text-xs text-[#94A3B8] max-w-md leading-relaxed">
          View comprehensive daily spending trends, category distributions, and payment channel analytics in the Analytics view.
        </p>
        {onNavigateToAnalytics && (
          <button
            type="button"
            onClick={onNavigateToAnalytics}
            aria-label="View detailed spending trends and breakdown"
            className="mt-4 inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 font-semibold text-xs border border-blue-500/30 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
          >
            <span>View Spending Trends</span>
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Footer / Context Note */}
      <div className="pt-3 border-t border-[#1E293B] flex items-center justify-between text-[11px] text-[#94A3B8]">
        <div className="flex items-center space-x-1.5">
          <Info className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" aria-hidden="true" />
          <span>Active range: <strong className="text-white">{selectedRange}</strong></span>
        </div>
        <span>Default Currency: {currencyBadge}</span>
      </div>
    </section>
  );
}
