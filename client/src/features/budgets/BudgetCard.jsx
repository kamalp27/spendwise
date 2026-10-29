import React from 'react';
import {
  Wallet,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  IndianRupee
} from 'lucide-react';
import BudgetProgressBar from './BudgetProgressBar.jsx';
import { getCategoryIcon } from '../categories/categoryIcons.jsx';

export default function BudgetCard({ budget }) {
  if (!budget) return null;

  const isOverall = Boolean(budget.isOverall || budget.is_overall || budget.category_id === null);
  const amount = Number(budget.amount || 0);
  const actualSpent = Number(budget.actualSpent !== undefined ? budget.actualSpent : (budget.actual_spent || 0));
  const remainingAmount = Number(
    budget.remainingAmount !== undefined
      ? budget.remainingAmount
      : (budget.remaining_amount !== undefined ? budget.remaining_amount : amount - actualSpent)
  );
  const percentageUsed = Number(
    budget.percentageUsed !== undefined
      ? budget.percentageUsed
      : (budget.percentage_used !== undefined
          ? budget.percentage_used
          : (amount > 0 ? (actualSpent / amount) * 100 : 0))
  );

  const isOverBudget = actualSpent > amount;
  const isNearLimit = !isOverBudget && percentageUsed >= 85;

  const categoryName = budget.categoryName || budget.category_name;
  const categoryIcon = budget.categoryIcon || budget.category_icon;
  const categoryColor = budget.categoryColor || budget.category_color || '#3B82F6';
  const IconComp = isOverall ? Wallet : getCategoryIcon(categoryIcon);

  return (
    <div
      className={`p-5 rounded-xl bg-[#0F172A] border transition-colors flex flex-col justify-between space-y-4 ${
        isOverBudget
          ? 'border-red-500/40 hover:border-red-500/60'
          : isNearLimit
          ? 'border-amber-500/40 hover:border-amber-500/60'
          : 'border-[#1E293B] hover:border-[#334155]'
      }`}
      data-testid={`budget-card-${budget.id || (isOverall ? 'overall' : categoryName)}`}
    >
      {/* Card Header: Icon, Title & Status Badge */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center space-x-3 min-w-0">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 border"
            style={{
              backgroundColor: isOverall ? 'rgba(37, 99, 235, 0.15)' : `${categoryColor}18`,
              borderColor: isOverall ? 'rgba(37, 99, 235, 0.35)' : `${categoryColor}40`,
              color: isOverall ? '#3B82F6' : categoryColor
            }}
            aria-hidden="true"
          >
            <IconComp className="w-5 h-5" />
          </div>

          <div className="min-w-0 flex flex-col">
            <span className="text-sm font-semibold text-[#F8FAFC] truncate">
              {isOverall ? 'Overall Monthly Budget' : categoryName}
            </span>
            <span className="text-[11px] text-[#94A3B8]">
              {isOverall ? 'All Categories Combined' : 'Category Cap'}
            </span>
          </div>
        </div>

        {/* Warning / Status Badge */}
        <div className="flex-shrink-0">
          {isOverBudget ? (
            <span
              className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-red-600/15 text-red-400 border border-red-500/30"
              title="Budget limit exceeded"
            >
              <AlertTriangle className="w-3 h-3 text-red-400" aria-hidden="true" />
              <span>Over Budget</span>
            </span>
          ) : isNearLimit ? (
            <span
              className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30"
              title="Approaching budget limit"
            >
              <AlertCircle className="w-3 h-3 text-amber-400" aria-hidden="true" />
              <span>Near Limit</span>
            </span>
          ) : (
            <span
              className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-600/15 text-emerald-400 border border-emerald-500/30"
              title="Within budget limits"
            >
              <CheckCircle2 className="w-3 h-3 text-emerald-400" aria-hidden="true" />
              <span>On Track</span>
            </span>
          )}
        </div>
      </div>

      {/* Financial Metrics Grid */}
      <div className="grid grid-cols-3 gap-2 py-2 border-y border-[#1E293B]/70 text-xs">
        <div>
          <span className="text-[11px] text-[#94A3B8] block">Budget</span>
          <span className="font-bold text-[#F8FAFC] flex items-center mt-0.5">
            <IndianRupee className="w-3 h-3 text-blue-400" aria-hidden="true" />
            <span>{amount.toFixed(2)}</span>
          </span>
        </div>

        <div>
          <span className="text-[11px] text-[#94A3B8] block">Spent</span>
          <span className="font-bold text-[#F8FAFC] flex items-center mt-0.5">
            <IndianRupee className="w-3 h-3 text-blue-400" aria-hidden="true" />
            <span>{actualSpent.toFixed(2)}</span>
          </span>
        </div>

        <div>
          <span className="text-[11px] text-[#94A3B8] block">
            {isOverBudget ? 'Exceeded' : 'Remaining'}
          </span>
          <span
            className={`font-bold flex items-center mt-0.5 ${
              isOverBudget ? 'text-red-400' : 'text-emerald-400'
            }`}
          >
            <IndianRupee className="w-3 h-3" aria-hidden="true" />
            <span>{Math.abs(remainingAmount).toFixed(2)}</span>
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <BudgetProgressBar
        percentageUsed={percentageUsed}
        actualSpent={actualSpent}
        amount={amount}
        label={isOverall ? 'Total monthly spending' : `${categoryName} spending`}
      />
    </div>
  );
}
