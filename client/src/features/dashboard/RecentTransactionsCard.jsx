import React from 'react';
import { Receipt, ArrowRight, ShieldCheck, IndianRupee } from 'lucide-react';
import EmptyState from '../../components/common/EmptyState.jsx';
import { PREDEFINED_CATEGORIES } from '../expenses/constants.js';

function getCategoryColor(catName) {
  const match = PREDEFINED_CATEGORIES.find((c) => c.name === catName);
  return match ? match.color : '#3B82F6';
}

export default function RecentTransactionsCard({
  transactions = [],
  onNavigateToTransactions,
  onAddExpense
}) {
  const recentTransactions = transactions.slice(0, 5);

  return (
    <section
      aria-labelledby="recent-transactions-heading"
      className="bg-[#0F172A] border border-[#1E293B] rounded-xl p-5 sm:p-6 shadow-sm flex flex-col justify-between"
    >
      {/* Card Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-[#1E293B]">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-600/10 text-blue-400 flex items-center justify-center border border-blue-500/20 flex-shrink-0">
            <Receipt className="w-4 h-4" aria-hidden="true" />
          </div>
          <div>
            <h2 id="recent-transactions-heading" className="text-base font-semibold text-white tracking-tight">
              Recent Transactions
            </h2>
            <p className="text-xs text-[#94A3B8]">
              Latest expense activity logged to your account
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 self-start sm:self-auto">
          {onNavigateToTransactions && (
            <button
              type="button"
              onClick={onNavigateToTransactions}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#94A3B8] hover:text-white hover:bg-[#1E293B] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
            >
              <span>View All</span>
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* Transaction List Area */}
      <div className="my-6">
        {recentTransactions.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="No transactions recorded yet"
            description="Your recent spending records will appear here once added. Each record tracks category, payment method (UPI, Card, Cash, Net Banking), date, and amount in INR (₹)."
            actionLabel="Add Expense"
            onAction={onAddExpense || onNavigateToTransactions}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs" aria-label="Recent transactions preview">
              <thead>
                <tr className="border-b border-[#1E293B] bg-[#0B0F19]/40 text-[#94A3B8]">
                  <th scope="col" className="py-2.5 px-3 font-semibold">Date</th>
                  <th scope="col" className="py-2.5 px-3 font-semibold">Title</th>
                  <th scope="col" className="py-2.5 px-3 font-semibold">Category</th>
                  <th scope="col" className="py-2.5 px-3 font-semibold">Method</th>
                  <th scope="col" className="py-2.5 px-3 font-semibold text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E293B]/60 text-slate-200">
                {recentTransactions.map((tx) => {
                  const color =
                    tx.categoryColor ||
                    getCategoryColor(tx.categoryName || tx.category);
                  const categoryDisplay = tx.categoryName || tx.category || 'Other';

                  return (
                    <tr key={tx.id} className="hover:bg-[#1E293B]/30 transition-colors">
                      <td className="py-2.5 px-3 font-mono text-[11px] text-[#94A3B8]">
                        {tx.date}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-white truncate max-w-[180px]">
                        {tx.title}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
                          style={{
                            backgroundColor: `${color}15`,
                            color: color,
                            border: `1px solid ${color}30`
                          }}
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ backgroundColor: color }}
                            aria-hidden="true"
                          />
                          <span>{categoryDisplay}</span>
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-[11px] text-slate-400">
                        {tx.paymentMethod || tx.payment_method}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-white text-right">
                        <span className="inline-flex items-center justify-end space-x-0.5">
                          <IndianRupee className="w-3 h-3 text-blue-400" aria-hidden="true" />
                          <span>{Number(tx.amount).toFixed(2)}</span>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer / Context Notice */}
      <div className="pt-3 border-t border-[#1E293B] flex items-center justify-between text-[11px] text-[#94A3B8]">
        <div className="flex items-center space-x-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-blue-400" aria-hidden="true" />
          <span>API Integration Active</span>
        </div>
        <span>{recentTransactions.length} of {transactions.length} Records</span>
      </div>
    </section>
  );
}
