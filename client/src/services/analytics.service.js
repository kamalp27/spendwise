import apiClient from './api-client.js';

/**
 * Normalizes the backend analytics response into a predictable frontend representation.
 * Handles both camelCase and snake_case response variants, ensures numerical safety,
 * and preserves null for undefined month-over-month percentages.
 *
 * @param {Object} raw - Raw data payload from backend response envelope.
 * @returns {Object} Normalized analytics data object.
 */
export function normalizeAnalyticsSummary(raw) {
  if (!raw || typeof raw !== 'object') {
    return {
      period: { month: 10, year: 2026 },
      summary: {
        totalSpending: 0,
        totalTransactions: 0,
        averageExpense: 0,
        highestExpense: 0,
        previousMonthSpending: 0,
        monthOverMonthChange: 0,
        monthOverMonthPercentage: null
      },
      byCategory: [],
      byPaymentMethod: [],
      dailyTrend: []
    };
  }

  const periodRaw = raw.period || {};
  const summaryRaw = raw.summary || {};
  const byCategoryRaw = Array.isArray(raw.byCategory)
    ? raw.byCategory
    : Array.isArray(raw.by_category)
      ? raw.by_category
      : [];
  const byPaymentRaw = Array.isArray(raw.byPaymentMethod)
    ? raw.byPaymentMethod
    : Array.isArray(raw.by_payment_method)
      ? raw.by_payment_method
      : [];
  const dailyTrendRaw = Array.isArray(raw.dailyTrend)
    ? raw.dailyTrend
    : Array.isArray(raw.daily_trend)
      ? raw.daily_trend
      : [];

  // Parse MoM percentage safely
  let momPercentage = null;
  const rawMomPct =
    summaryRaw.monthOverMonthPercentage !== undefined
      ? summaryRaw.monthOverMonthPercentage
      : summaryRaw.month_over_month_percentage;

  if (rawMomPct !== null && rawMomPct !== undefined && rawMomPct !== '') {
    const parsedMom = Number(rawMomPct);
    if (Number.isFinite(parsedMom)) {
      momPercentage = parsedMom;
    }
  }

  return {
    period: {
      month: Number(periodRaw.month || 10),
      year: Number(periodRaw.year || 2026)
    },
    summary: {
      totalSpending: Number(
        summaryRaw.totalSpending !== undefined
          ? summaryRaw.totalSpending
          : (summaryRaw.total_spending || 0)
      ),
      totalTransactions: Number(
        summaryRaw.totalTransactions !== undefined
          ? summaryRaw.totalTransactions
          : (summaryRaw.total_transactions || 0)
      ),
      averageExpense: Number(
        summaryRaw.averageExpense !== undefined
          ? summaryRaw.averageExpense
          : (summaryRaw.average_expense || 0)
      ),
      highestExpense: Number(
        summaryRaw.highestExpense !== undefined
          ? summaryRaw.highestExpense
          : (summaryRaw.highest_expense || 0)
      ),
      previousMonthSpending: Number(
        summaryRaw.previousMonthSpending !== undefined
          ? summaryRaw.previousMonthSpending
          : (summaryRaw.previous_month_spending || 0)
      ),
      monthOverMonthChange: Number(
        summaryRaw.monthOverMonthChange !== undefined
          ? summaryRaw.monthOverMonthChange
          : (summaryRaw.month_over_month_change || 0)
      ),
      monthOverMonthPercentage: momPercentage
    },
    byCategory: byCategoryRaw.map((item) => ({
      categoryId: item.categoryId || item.category_id || null,
      categoryName: item.categoryName || item.category_name || 'Uncategorized',
      categoryIcon: item.categoryIcon || item.category_icon || 'tag',
      categoryColor: item.categoryColor || item.category_color || '#6B7280',
      totalAmount: Number(
        item.totalAmount !== undefined ? item.totalAmount : (item.total_amount || 0)
      ),
      transactionCount: Number(
        item.transactionCount !== undefined
          ? item.transactionCount
          : (item.transaction_count || 0)
      ),
      percentage: Number(item.percentage || 0)
    })),
    byPaymentMethod: byPaymentRaw.map((item) => ({
      paymentMethod: item.paymentMethod || item.payment_method || 'Other',
      totalAmount: Number(
        item.totalAmount !== undefined ? item.totalAmount : (item.total_amount || 0)
      ),
      transactionCount: Number(
        item.transactionCount !== undefined
          ? item.transactionCount
          : (item.transaction_count || 0)
      ),
      percentage: Number(item.percentage || 0)
    })),
    dailyTrend: dailyTrendRaw.map((item) => ({
      date: String(item.date || ''),
      dailyTotal: Number(
        item.dailyTotal !== undefined ? item.dailyTotal : (item.daily_total || 0)
      ),
      transactionCount: Number(
        item.transactionCount !== undefined
          ? item.transactionCount
          : (item.transaction_count || 0)
      )
    }))
  };
}

/**
 * Service for fetching database-aggregated financial analytics.
 * Interacts with GET /api/v1/analytics/summary.
 */
export class AnalyticsService {
  /**
   * Fetches monthly analytics summary from backend aggregation endpoint.
   *
   * @param {Object} [params={}]
   * @param {number|string} [params.month] - Calendar month (1-12).
   * @param {number|string} [params.year] - Calendar year (e.g. 2026).
   * @returns {Promise<Object>} Normalized analytics response.
   */
  static async getMonthlySummary({ month, year } = {}) {
    const params = {};
    if (month !== undefined && month !== null && month !== '') {
      params.month = month;
    }
    if (year !== undefined && year !== null && year !== '') {
      params.year = year;
    }

    const response = await apiClient.get('/analytics/summary', { params });
    return normalizeAnalyticsSummary(response?.data);
  }
}

export default AnalyticsService;
