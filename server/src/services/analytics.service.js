import { AppError } from '../utils/app-error.js';
import {
  validateUUID,
  validateMonth,
  validateYear
} from '../utils/validation.js';

export class AnalyticsService {
  /**
   * Calculates monthly spending aggregates, category breakdown, payment method distribution,
   * daily trend, and previous-month comparison for the authenticated user.
   *
   * @param {Object} db - Database pool or mock client.
   * @param {string} userId - UUID of authenticated user.
   * @param {Object} period - { month, year }.
   * @returns {Promise<Object>} Aggregated analytics data matching the API response contract.
   */
  static async getMonthlyAnalytics(db, userId, { month, year } = {}) {
    validateUUID(userId, 'userId');
    const cleanMonth = validateMonth(month, 'month');
    const cleanYear = validateYear(year, 'year');

    // 1. Calculate current month date boundaries (inclusive start, exclusive end)
    const startDate = `${cleanYear}-${String(cleanMonth).padStart(2, '0')}-01`;
    const nextMonth = cleanMonth === 12 ? 1 : cleanMonth + 1;
    const nextYear = cleanMonth === 12 ? cleanYear + 1 : cleanYear;
    const nextMonthStartDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

    // 2. Calculate previous month date boundaries (handling January-to-December rollover)
    const prevMonth = cleanMonth === 1 ? 12 : cleanMonth - 1;
    const prevYear = cleanMonth === 1 ? cleanYear - 1 : cleanYear;
    const prevStartDate = `${prevYear}-${String(prevMonth).padStart(2, '0')}-01`;
    const prevEndDate = startDate; // Previous month's exclusive end is current month's start

    // 3. Define Parameterized SQL Aggregation Queries with Strict User Isolation

    // Query A: Current Month Summary (Total, Count, Average, Max)
    const summarySql = `
      SELECT
        COALESCE(SUM(e.amount), 0) AS total_spending,
        COUNT(e.id) AS total_transactions,
        COALESCE(ROUND(AVG(e.amount), 2), 0) AS average_expense,
        COALESCE(MAX(e.amount), 0) AS highest_expense
      FROM expenses e
      WHERE e.user_id = $1
        AND e.date >= $2
        AND e.date < $3;
    `;

    // Query B: Previous Month Spending Total (for Month-over-Month comparison)
    const prevSummarySql = `
      SELECT
        COALESCE(SUM(e.amount), 0) AS previous_month_spending
      FROM expenses e
      WHERE e.user_id = $1
        AND e.date >= $2
        AND e.date < $3;
    `;

    // Query C: Category Spending Breakdown (including Uncategorized expenses)
    const categorySql = `
      SELECT
        c.id AS category_id,
        COALESCE(c.name, 'Uncategorized') AS category_name,
        COALESCE(c.icon, 'tag') AS category_icon,
        COALESCE(c.color, '#6B7280') AS category_color,
        COALESCE(SUM(e.amount), 0) AS total_amount,
        COUNT(e.id) AS transaction_count
      FROM expenses e
      LEFT JOIN categories c ON e.category_id = c.id
      WHERE e.user_id = $1
        AND e.date >= $2
        AND e.date < $3
      GROUP BY c.id, c.name, c.icon, c.color
      ORDER BY total_amount DESC, category_name ASC;
    `;

    // Query D: Payment Method Distribution
    const paymentSql = `
      SELECT
        e.payment_method,
        COALESCE(SUM(e.amount), 0) AS total_amount,
        COUNT(e.id) AS transaction_count
      FROM expenses e
      WHERE e.user_id = $1
        AND e.date >= $2
        AND e.date < $3
      GROUP BY e.payment_method
      ORDER BY total_amount DESC, e.payment_method ASC;
    `;

    // Query E: Daily Spending Chronological Trend
    const dailySql = `
      SELECT
        TO_CHAR(e.date, 'YYYY-MM-DD') AS date,
        COALESCE(SUM(e.amount), 0) AS daily_total,
        COUNT(e.id) AS transaction_count
      FROM expenses e
      WHERE e.user_id = $1
        AND e.date >= $2
        AND e.date < $3
      GROUP BY e.date
      ORDER BY e.date ASC;
    `;

    // 4. Execute all queries in parallel for optimal throughput
    const [summaryRes, prevSummaryRes, categoryRes, paymentRes, dailyRes] = await Promise.all([
      db.query(summarySql, [userId, startDate, nextMonthStartDate]),
      db.query(prevSummarySql, [userId, prevStartDate, prevEndDate]),
      db.query(categorySql, [userId, startDate, nextMonthStartDate]),
      db.query(paymentSql, [userId, startDate, nextMonthStartDate]),
      db.query(dailySql, [userId, startDate, nextMonthStartDate])
    ]);

    // 5. Parse and Normalize Current Month Summary
    const summaryRow = summaryRes.rows[0] || {};
    const totalSpending = parseFloat(parseFloat(summaryRow.total_spending || 0).toFixed(2));
    const totalTransactions = parseInt(summaryRow.total_transactions || 0, 10);
    const averageExpense = parseFloat(parseFloat(summaryRow.average_expense || 0).toFixed(2));
    const highestExpense = parseFloat(parseFloat(summaryRow.highest_expense || 0).toFixed(2));

    // 6. Calculate Month-over-Month Comparison Safely
    const prevRow = prevSummaryRes.rows[0] || {};
    const previousMonthSpending = parseFloat(parseFloat(prevRow.previous_month_spending || 0).toFixed(2));
    const monthOverMonthChange = parseFloat((totalSpending - previousMonthSpending).toFixed(2));

    let monthOverMonthPercentage = null;
    if (previousMonthSpending > 0) {
      const rawPct = ((totalSpending - previousMonthSpending) / previousMonthSpending) * 100;
      if (Number.isFinite(rawPct)) {
        monthOverMonthPercentage = parseFloat(rawPct.toFixed(2));
      }
    }

    // 7. Process Category Breakdown
    const byCategory = (categoryRes.rows || []).map((row) => {
      const totalAmount = parseFloat(parseFloat(row.total_amount || 0).toFixed(2));
      const transactionCount = parseInt(row.transaction_count || 0, 10);
      let percentage = 0;
      if (totalSpending > 0) {
        const rawPct = (totalAmount / totalSpending) * 100;
        percentage = Number.isFinite(rawPct) ? parseFloat(rawPct.toFixed(2)) : 0;
      }

      return {
        categoryId: row.category_id || null,
        categoryName: row.category_name,
        categoryIcon: row.category_icon,
        categoryColor: row.category_color,
        totalAmount,
        transactionCount,
        percentage
      };
    });

    // 8. Process Payment Method Breakdown
    const byPaymentMethod = (paymentRes.rows || []).map((row) => {
      const totalAmount = parseFloat(parseFloat(row.total_amount || 0).toFixed(2));
      const transactionCount = parseInt(row.transaction_count || 0, 10);
      let percentage = 0;
      if (totalSpending > 0) {
        const rawPct = (totalAmount / totalSpending) * 100;
        percentage = Number.isFinite(rawPct) ? parseFloat(rawPct.toFixed(2)) : 0;
      }

      return {
        paymentMethod: row.payment_method,
        totalAmount,
        transactionCount,
        percentage
      };
    });

    // 9. Process Daily Trend
    const dailyTrend = (dailyRes.rows || []).map((row) => {
      const dailyTotal = parseFloat(parseFloat(row.daily_total || 0).toFixed(2));
      const transactionCount = parseInt(row.transaction_count || 0, 10);

      return {
        date: row.date,
        dailyTotal,
        transactionCount
      };
    });

    // 10. Return Structured Canonical Contract
    return {
      period: {
        month: cleanMonth,
        year: cleanYear
      },
      summary: {
        totalSpending,
        totalTransactions,
        averageExpense,
        highestExpense,
        previousMonthSpending,
        monthOverMonthChange,
        monthOverMonthPercentage
      },
      byCategory,
      byPaymentMethod,
      dailyTrend
    };
  }
}
