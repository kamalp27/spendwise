import React from 'react';
import {
  Receipt,
  Layers,
  Calculator,
  Flame,
  TrendingUp,
  TrendingDown,
  Minus,
  HelpCircle
} from 'lucide-react';
import SummaryCard from '../../components/common/SummaryCard.jsx';

export default function AnalyticsSummaryCards({ summary = {}, periodLabel = '' }) {
  const {
    totalSpending = 0,
    totalTransactions = 0,
    averageExpense = 0,
    highestExpense = 0,
    previousMonthSpending = 0,
    monthOverMonthChange = 0,
    monthOverMonthPercentage = null
  } = summary;

  // Month-over-Month calculation representation
  let momSubtitle = null;
  let momHelper = null;
  let momBadge = null;

  if (monthOverMonthPercentage === null) {
    momSubtitle = 'MoM: N/A (No prior spending)';
    momHelper = 'No recorded expenses in previous calendar month';
    momBadge = 'Baseline';
  } else if (monthOverMonthPercentage > 0) {
    momSubtitle = `+${monthOverMonthPercentage.toFixed(1)}% (+₹${monthOverMonthChange.toFixed(2)})`;
    momHelper = `Spending increased from ₹${previousMonthSpending.toFixed(2)} in prior month`;
    momBadge = 'Spending Up';
  } else if (monthOverMonthPercentage < 0) {
    momSubtitle = `${monthOverMonthPercentage.toFixed(1)}% (-₹${Math.abs(monthOverMonthChange).toFixed(2)})`;
    momHelper = `Spending decreased from ₹${previousMonthSpending.toFixed(2)} in prior month`;
    momBadge = 'Spending Down';
  } else {
    momSubtitle = '0.0% change vs prior month';
    momHelper = `Equal to ₹${previousMonthSpending.toFixed(2)} recorded in prior month`;
    momBadge = 'Flat';
  }

  return (
    <section
      aria-label="Monthly Financial Analytics Summary"
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
    >
      {/* 1. Total Spending */}
      <SummaryCard
        title="Total Spending"
        value={`₹${totalSpending.toFixed(2)}`}
        subtitle={momSubtitle}
        icon={Receipt}
        badge={momBadge}
        helperText={momHelper}
      />

      {/* 2. Transaction Count */}
      <SummaryCard
        title="Transactions"
        value={totalTransactions}
        subtitle={
          totalTransactions === 1
            ? '1 recorded expense'
            : `${totalTransactions} recorded expenses`
        }
        icon={Layers}
        badge="Activity"
        helperText={
          totalTransactions > 0
            ? `Active in ${periodLabel}`
            : 'No transactions recorded'
        }
      />

      {/* 3. Average Expense */}
      <SummaryCard
        title="Average Expense"
        value={`₹${averageExpense.toFixed(2)}`}
        subtitle="Per-transaction mean"
        icon={Calculator}
        badge="Mean"
        helperText={
          totalTransactions > 0
            ? `Calculated across ${totalTransactions} transaction(s)`
            : 'Awaiting expenses'
        }
      />

      {/* 4. Highest Expense */}
      <SummaryCard
        title="Highest Expense"
        value={`₹${highestExpense.toFixed(2)}`}
        subtitle="Single peak outlay"
        icon={Flame}
        badge="Peak"
        helperText={
          highestExpense > 0
            ? `Largest outlay in ${periodLabel}`
            : 'No outlays recorded'
        }
      />
    </section>
  );
}
