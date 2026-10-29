import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { PieChart as PieChartIcon, Tags } from 'lucide-react';
import EmptyState from '../../components/common/EmptyState.jsx';

function CategoryTooltip({ active, payload }) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="p-2.5 rounded-lg bg-[#0F172A] border border-[#1E293B] text-xs shadow-xl space-y-1">
        <p className="font-semibold text-white">{data.categoryName}</p>
        <p className="text-blue-400 font-bold">₹{Number(data.totalAmount || 0).toFixed(2)}</p>
        <p className="text-[#94A3B8]">
          {Number(data.percentage || 0).toFixed(1)}% of total • {data.transactionCount} expense(s)
        </p>
      </div>
    );
  }
  return null;
}

export default function CategoryDonutChart({ byCategory = [], totalSpending = 0 }) {
  const hasData = byCategory.length > 0 && totalSpending > 0;

  return (
    <section
      aria-label="Category Spending Breakdown"
      className="bg-[#0F172A] border border-[#1E293B] rounded-xl p-5 sm:p-6 shadow-sm flex flex-col justify-between"
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-[#1E293B]">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-600/10 text-blue-400 flex items-center justify-center border border-blue-500/20 flex-shrink-0">
            <PieChartIcon className="w-4 h-4" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white tracking-tight">
              Category Distribution
            </h2>
            <p className="text-xs text-[#94A3B8]">
              Breakdown of expenses by allocated group
            </p>
          </div>
        </div>
        <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-[#1E293B] text-[#94A3B8]">
          {byCategory.length} Group(s)
        </span>
      </div>

      {/* Body */}
      <div className="my-6">
        {!hasData ? (
          <EmptyState
            icon={Tags}
            title="No category spending"
            description="No expenses have been allocated to categories for this period. As expenses are logged, category share and donut charts will render here."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            {/* Donut Chart Canvas */}
            <div className="h-56 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100}>
                <PieChart>
                  <Pie
                    data={byCategory}
                    dataKey="totalAmount"
                    nameKey="categoryName"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                  >
                    {byCategory.map((cat, idx) => (
                      <Cell
                        key={`cat-cell-${cat.categoryId || idx}`}
                        fill={cat.categoryColor || '#3B82F6'}
                        stroke="#0F172A"
                        strokeWidth={2}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<CategoryTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Structured Breakdown List */}
            <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
              {byCategory.map((cat, idx) => {
                const color = cat.categoryColor || '#6B7280';
                return (
                  <div
                    key={`cat-item-${cat.categoryId || idx}`}
                    className="flex items-center justify-between p-2 rounded-lg bg-[#0B0F19] border border-[#1E293B]/70 text-xs"
                  >
                    <div className="flex items-center space-x-2 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: color }}
                        aria-hidden="true"
                      />
                      <span className="font-medium text-white truncate">
                        {cat.categoryName}
                      </span>
                    </div>

                    <div className="flex items-center space-x-3 text-right flex-shrink-0">
                      <span className="text-[#94A3B8]">
                        {Number(cat.percentage || 0).toFixed(1)}%
                      </span>
                      <strong className="text-white font-semibold">
                        ₹{Number(cat.totalAmount || 0).toFixed(2)}
                      </strong>
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
        <span>Aggregated across all expenses</span>
        <span>Reconciles to total spending</span>
      </div>
    </section>
  );
}
