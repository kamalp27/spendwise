import React from 'react';

/**
 * Accessible progress bar for budget utilization.
 * Dynamically adjusts color thresholds (Normal -> Warning -> Exceeded)
 * and announces values via ARIA.
 */
export default function BudgetProgressBar({
  percentageUsed = 0,
  actualSpent = 0,
  amount = 0,
  label = 'Budget utilization'
}) {
  const percentage = Number.isFinite(percentageUsed) ? percentageUsed : 0;
  const isOverBudget = percentage >= 100;
  const isNearLimit = percentage >= 85 && percentage < 100;

  // Clamped width for the visual CSS bar
  const visualWidth = Math.min(100, Math.max(0, percentage));

  let barColorClass = 'bg-blue-500';
  if (isOverBudget) {
    barColorClass = 'bg-red-500';
  } else if (isNearLimit) {
    barColorClass = 'bg-amber-500';
  }

  return (
    <div className="space-y-1.5 w-full">
      <div className="flex items-center justify-between text-xs">
        <span className="text-[#94A3B8] font-medium">{label}</span>
        <span
          className={`font-semibold font-mono ${
            isOverBudget
              ? 'text-red-400'
              : isNearLimit
              ? 'text-amber-400'
              : 'text-slate-300'
          }`}
        >
          {percentage.toFixed(1)}%
        </span>
      </div>

      <div
        role="progressbar"
        aria-label={label}
        aria-valuenow={Math.min(100, Math.round(percentage))}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={`${percentage.toFixed(1)}% of budget spent (${actualSpent.toFixed(2)} of ${amount.toFixed(2)})`}
        className="w-full h-2 rounded-full bg-[#0B0F19] overflow-hidden border border-[#1E293B]"
      >
        <div
          className={`h-full rounded-full transition-all duration-300 ${barColorClass}`}
          style={{ width: `${visualWidth}%` }}
        />
      </div>
    </div>
  );
}
