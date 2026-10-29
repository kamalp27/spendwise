import React from 'react';
import {
  PiggyBank,
  IndianRupee,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Plus
} from 'lucide-react';
import BudgetProgressBar from './BudgetProgressBar.jsx';

export default function BudgetOverviewSummary({
  overallBudget = null,
  periodLabel = '',
  onAddOverallBudget = null
}) {
  if (!overallBudget) {
    return (
      <div className="p-5 rounded-xl bg-[#0F172A] border border-[#1E293B] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-xl bg-blue-600/10 border border-blue-500/20 text-blue-400 flex items-center justify-center flex-shrink-0">
            <PiggyBank className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">
              No Overall Budget Set for {periodLabel}
            </h2>
            <p className="text-xs text-[#94A3B8] mt-0.5 max-w-xl">
              Setting an overall monthly spending ceiling allows you to track combined household expenses alongside individual category caps.
            </p>
          </div>
        </div>

        {onAddOverallBudget && (
          <button
            type="button"
            onClick={onAddOverallBudget}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 font-semibold text-xs border border-blue-500/30 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 flex-shrink-0"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Set Overall Budget</span>
          </button>
        )}
      </div>
    );
  }

  const amount = Number(overallBudget.amount || 0);
  const actualSpent = Number(
    overallBudget.actualSpent !== undefined ? overallBudget.actualSpent : (overallBudget.actual_spent || 0)
  );
  const remainingAmount = Number(
    overallBudget.remainingAmount !== undefined
      ? overallBudget.remainingAmount
      : (overallBudget.remaining_amount !== undefined ? overallBudget.remaining_amount : amount - actualSpent)
  );
  const percentageUsed = Number(
    overallBudget.percentageUsed !== undefined
      ? overallBudget.percentageUsed
      : (overallBudget.percentage_used !== undefined
          ? overallBudget.percentage_used
          : (amount > 0 ? (actualSpent / amount) * 100 : 0))
  );

  const isOverBudget = actualSpent > amount;
  const isNearLimit = !isOverBudget && percentageUsed >= 85;

  return (
    <div
      className={`p-5 rounded-xl bg-[#0F172A] border transition-colors space-y-4 ${
        isOverBudget
          ? 'border-red-500/40'
          : isNearLimit
          ? 'border-amber-500/40'
          : 'border-blue-500/30 shadow-lg shadow-blue-950/20'
      }`}
      data-testid="overall-budget-summary"
    >
      {/* Top Row: Title, Period & Warning Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600/15 border border-blue-500/30 text-blue-400 flex items-center justify-center flex-shrink-0">
            <PiggyBank className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-base font-bold text-white tracking-tight">
                {periodLabel} Overall Budget
              </h2>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-600/20 text-blue-400 border border-blue-500/30">
                Monthly Cap
              </span>
            </div>
            <p className="text-xs text-[#94A3B8] mt-0.5">
              Aggregated spending ceiling across all financial categories
            </p>
          </div>
        </div>

        <div>
          {isOverBudget ? (
            <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-600/15 text-red-400 border border-red-500/30">
              <AlertTriangle className="w-3.5 h-3.5 text-red-400" aria-hidden="true" />
              <span>Over Budget by ₹{Math.abs(remainingAmount).toFixed(2)}</span>
            </span>
          ) : isNearLimit ? (
            <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
              <AlertCircle className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
              <span>{percentageUsed.toFixed(1)}% Used (Near Limit)</span>
            </span>
          ) : (
            <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-600/15 text-emerald-400 border border-emerald-500/30">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
              <span>₹{remainingAmount.toFixed(2)} Remaining</span>
            </span>
          )}
        </div>
      </div>

      {/* 3 Metric Summary Boxes */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3.5 rounded-lg bg-[#0B0F19] border border-[#1E293B]">
          <span className="text-xs font-medium text-[#94A3B8] block">Overall Limit</span>
          <span className="text-lg font-extrabold text-white flex items-center mt-0.5">
            <IndianRupee className="w-4 h-4 text-blue-400" aria-hidden="true" />
            <span>{amount.toFixed(2)}</span>
          </span>
        </div>

        <div className="p-3.5 rounded-lg bg-[#0B0F19] border border-[#1E293B]">
          <span className="text-xs font-medium text-[#94A3B8] block">Actual Spending</span>
          <span className="text-lg font-extrabold text-white flex items-center mt-0.5">
            <IndianRupee className="w-4 h-4 text-blue-400" aria-hidden="true" />
            <span>{actualSpent.toFixed(2)}</span>
          </span>
        </div>

        <div className="p-3.5 rounded-lg bg-[#0B0F19] border border-[#1E293B]">
          <span className="text-xs font-medium text-[#94A3B8] block">
            {isOverBudget ? 'Over Budget By' : 'Remaining Balance'}
          </span>
          <span
            className={`text-lg font-extrabold flex items-center mt-0.5 ${
              isOverBudget ? 'text-red-400' : 'text-emerald-400'
            }`}
          >
            <IndianRupee className="w-4 h-4" aria-hidden="true" />
            <span>{Math.abs(remainingAmount).toFixed(2)}</span>
          </span>
        </div>
      </div>

      {/* Overall Progress Bar */}
      <BudgetProgressBar
        percentageUsed={percentageUsed}
        actualSpent={actualSpent}
        amount={amount}
        label={`Total monthly spending against overall limit`}
      />
    </div>
  );
}
