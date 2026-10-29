import { describe, it, expect, vi, beforeEach } from 'vitest';
import http from 'http';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { signSessionId } from '../src/services/session.service.js';

// --- Fixtures for Multi-User Isolation ---

const ALICE = {
  id: '11111111-aaaa-aaaa-aaaa-111111111111',
  email: 'alice@spendwise.example',
  displayName: 'Alice User',
  currency: 'USD'
};

const BOB = {
  id: '22222222-bbbb-bbbb-bbbb-222222222222',
  email: 'bob@spendwise.example',
  displayName: 'Bob User',
  currency: 'EUR'
};

const ALICE_SID = 'aaaa1111222233334444555566667777888899990000aaaabbbbccccddddeeeeffff';
const BOB_SID = 'bbbb1111222233334444555566667777888899990000aaaabbbbccccddddeeeeffff';

const ALICE_COOKIE = `${env.SESSION_COOKIE_NAME}=${signSessionId(ALICE_SID, env.SESSION_SECRET)}`;
const BOB_COOKIE = `${env.SESSION_COOKIE_NAME}=${signSessionId(BOB_SID, env.SESSION_SECRET)}`;

const GLOBAL_CAT_ID = 'cccccccc-0000-0000-0000-000000000001';
const ALICE_CAT_ID = 'cccccccc-aaaa-aaaa-aaaa-111111111111';
const BOB_CAT_ID = 'cccccccc-bbbb-bbbb-bbbb-222222222222';

const ALICE_EXPENSE_ID = 'eeeeeeee-aaaa-aaaa-aaaa-111111111111';
const BOB_EXPENSE_ID = 'eeeeeeee-bbbb-bbbb-bbbb-222222222222';

const ALICE_BUDGET_ID = 'bbbbbbbb-aaaa-aaaa-aaaa-111111111111';
const BOB_BUDGET_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-222222222222';

// --- Helper for HTTP Dispatch ---
function dispatch(app, { method, url, headers = {}, body = null }) {
  return new Promise((resolve) => {
    const req = new http.IncomingMessage();
    req.method = method;
    req.url = url;
    req.headers = { host: 'localhost:5000', ...headers };
    req.socket = { remoteAddress: '127.0.0.1' };
    if (body) {
      req.body = body;
    }

    let responseData = '';
    const responseHeaders = {};
    const res = new http.ServerResponse(req);
    res.setHeader = (k, v) => {
      responseHeaders[k.toLowerCase()] = v;
    };
    res.getHeader = (k) => responseHeaders[k.toLowerCase()];
    res.write = (chunk) => {
      if (chunk) responseData += chunk;
    };
    res.end = (chunk) => {
      if (chunk) responseData += chunk;
      let parsed = responseData;
      try {
        parsed = JSON.parse(responseData);
      } catch (_) {}
      resolve({
        status: res.statusCode,
        headers: responseHeaders,
        body: parsed
      });
    };

    app.handle(req, res);
  });
}

describe('Stage 6.2D6 — Multi-User Data Isolation & Scoping Verification', () => {
  let app;
  let mockDb;

  beforeEach(() => {
    app = createApp();

    mockDb = {
      query: vi.fn(async (sql, params = []) => {
        // 1. Session lookup in user_sessions
        if (sql.includes('user_sessions')) {
          const sidParam = params[0];
          if (sidParam === ALICE_SID) {
            return {
              rows: [
                {
                  sid: ALICE_SID,
                  sess: {},
                  expire: new Date(Date.now() + 86400000),
                  user_id: ALICE.id,
                  user_account_id: ALICE.id,
                  email: ALICE.email,
                  display_name: ALICE.displayName,
                  currency: ALICE.currency,
                  is_active: true
                }
              ]
            };
          }
          if (sidParam === BOB_SID) {
            return {
              rows: [
                {
                  sid: BOB_SID,
                  sess: {},
                  expire: new Date(Date.now() + 86400000),
                  user_id: BOB.id,
                  user_account_id: BOB.id,
                  email: BOB.email,
                  display_name: BOB.displayName,
                  currency: BOB.currency,
                  is_active: true
                }
              ]
            };
          }
          return { rows: [] };
        }

        // 2. Categories Table
        // 2a. Category verification: verifyCategoryAccess
        if (sql.includes('SELECT id, name, is_predefined, user_id') && sql.includes('FROM categories')) {
          const [catId, userId] = params;
          if (catId === GLOBAL_CAT_ID) {
            return {
              rows: [{ id: GLOBAL_CAT_ID, name: 'Food & Dining', is_predefined: true, user_id: null }]
            };
          }
          if (catId === ALICE_CAT_ID && userId === ALICE.id) {
            return {
              rows: [{ id: ALICE_CAT_ID, name: 'Alice Crafts', is_predefined: false, user_id: ALICE.id }]
            };
          }
          if (catId === BOB_CAT_ID && userId === BOB.id) {
            return {
              rows: [{ id: BOB_CAT_ID, name: 'Bob Consulting', is_predefined: false, user_id: BOB.id }]
            };
          }
          // If User A requests User B's category, return empty (not found/inaccessible)
          return { rows: [] };
        }

        // 2b. Category listing: listCategories
        if (sql.includes('SELECT id, name, icon, color, is_predefined, user_id') && sql.includes('FROM categories')) {
          const userId = params[0];
          const globalCat = {
            id: GLOBAL_CAT_ID,
            name: 'Food & Dining',
            icon: 'utensils',
            color: '#3B82F6',
            is_predefined: true,
            user_id: null
          };
          if (userId === ALICE.id) {
            return {
              rows: [
                globalCat,
                {
                  id: ALICE_CAT_ID,
                  name: 'Alice Crafts',
                  icon: 'scissors',
                  color: '#EC4899',
                  is_predefined: false,
                  user_id: ALICE.id
                }
              ]
            };
          }
          if (userId === BOB.id) {
            return {
              rows: [
                globalCat,
                {
                  id: BOB_CAT_ID,
                  name: 'Bob Consulting',
                  icon: 'briefcase',
                  color: '#10B981',
                  is_predefined: false,
                  user_id: BOB.id
                }
              ]
            };
          }
          return { rows: [globalCat] };
        }

        // 2c. Category creation: createCategory
        if (sql.includes('INSERT INTO categories')) {
          const [name, icon, color, userId] = params;
          return {
            rows: [
              {
                id: 'cccccccc-neww-neww-neww-000000000001',
                name,
                icon,
                color,
                is_predefined: false,
                user_id: userId,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              }
            ]
          };
        }

        // 3. Expenses Table
        // 3a. Single expense lookup: getExpenseById (WHERE e.id = $1 AND e.user_id = $2)
        if (sql.includes('FROM expenses e') && sql.includes('WHERE e.id = $1 AND e.user_id = $2')) {
          const [expId, userId] = params;
          if (expId === ALICE_EXPENSE_ID && userId === ALICE.id) {
            return {
              rows: [
                {
                  id: ALICE_EXPENSE_ID,
                  user_id: ALICE.id,
                  category_id: GLOBAL_CAT_ID,
                  title: 'Alice Lunch',
                  amount: '25.00',
                  date: '2026-10-29',
                  payment_method: 'UPI',
                  notes: 'Lunch with team',
                  category_name: 'Food & Dining',
                  category_icon: 'utensils',
                  category_color: '#3B82F6'
                }
              ]
            };
          }
          if (expId === BOB_EXPENSE_ID && userId === BOB.id) {
            return {
              rows: [
                {
                  id: BOB_EXPENSE_ID,
                  user_id: BOB.id,
                  category_id: BOB_CAT_ID,
                  title: 'Bob Secret Expense',
                  amount: '5000.00',
                  date: '2026-10-29',
                  payment_method: 'Credit Card',
                  notes: 'Private consulting gear',
                  category_name: 'Bob Consulting',
                  category_icon: 'briefcase',
                  category_color: '#10B981'
                }
              ]
            };
          }
          // Cross-user lookup returns 0 rows
          return { rows: [] };
        }

        // 3b. Expense count for pagination
        if (sql.includes('SELECT COUNT(*) AS total FROM expenses e')) {
          const userId = params[0];
          if (userId === ALICE.id) return { rows: [{ total: '1' }] };
          if (userId === BOB.id) return { rows: [{ total: '1' }] };
          return { rows: [{ total: '0' }] };
        }

        // 3c. Expense listing: listExpenses
        if (sql.includes('FROM expenses e') && sql.includes('LIMIT $') && sql.includes('OFFSET $')) {
          const userId = params[0];
          if (userId === ALICE.id) {
            return {
              rows: [
                {
                  id: ALICE_EXPENSE_ID,
                  user_id: ALICE.id,
                  category_id: GLOBAL_CAT_ID,
                  title: 'Alice Lunch',
                  amount: '25.00',
                  date: '2026-10-29',
                  payment_method: 'UPI',
                  category_name: 'Food & Dining'
                }
              ]
            };
          }
          if (userId === BOB.id) {
            return {
              rows: [
                {
                  id: BOB_EXPENSE_ID,
                  user_id: BOB.id,
                  category_id: BOB_CAT_ID,
                  title: 'Bob Secret Expense',
                  amount: '5000.00',
                  date: '2026-10-29',
                  payment_method: 'Credit Card',
                  category_name: 'Bob Consulting'
                }
              ]
            };
          }
          return { rows: [] };
        }

        // 3d. Expense creation: createExpense
        if (sql.includes('INSERT INTO expenses')) {
          const [userId, categoryId, title, amount, date, paymentMethod, notes] = params;
          return {
            rows: [
              {
                id: 'eeeeeeee-neww-neww-neww-000000000001',
                user_id: userId,
                category_id: categoryId,
                title,
                amount,
                date,
                payment_method: paymentMethod,
                notes,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              }
            ]
          };
        }

        // 3e. Expense update: updateExpense
        if (sql.includes('UPDATE expenses')) {
          const [expId, userId] = params;
          if (expId === ALICE_EXPENSE_ID && userId === ALICE.id) {
            return {
              rows: [
                {
                  id: ALICE_EXPENSE_ID,
                  user_id: ALICE.id,
                  title: 'Updated Alice Lunch',
                  amount: '30.00'
                }
              ]
            };
          }
          return { rows: [] };
        }

        // 3f. Expense deletion: deleteExpense
        if (sql.includes('DELETE FROM expenses')) {
          const [expId, userId] = params;
          if (expId === ALICE_EXPENSE_ID && userId === ALICE.id) {
            return { rows: [{ id: ALICE_EXPENSE_ID }] };
          }
          if (expId === BOB_EXPENSE_ID && userId === BOB.id) {
            return { rows: [{ id: BOB_EXPENSE_ID }] };
          }
          return { rows: [] };
        }

        // 4. Budgets Table
        // 4a. Budget listing: listBudgetsWithSpending
        if (sql.includes('FROM budgets b') && sql.includes('WHERE b.user_id = $1')) {
          const userId = params[0];
          if (userId === ALICE.id) {
            return {
              rows: [
                {
                  id: ALICE_BUDGET_ID,
                  user_id: ALICE.id,
                  category_id: null,
                  amount: '2000.00',
                  month: 10,
                  year: 2026,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                  category_name: null,
                  actual_spent: '25.00'
                }
              ]
            };
          }
          if (userId === BOB.id) {
            return {
              rows: [
                {
                  id: BOB_BUDGET_ID,
                  user_id: BOB.id,
                  category_id: null,
                  amount: '8000.00',
                  month: 10,
                  year: 2026,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                  category_name: null,
                  actual_spent: '5000.00'
                }
              ]
            };
          }
          return { rows: [] };
        }

        // 4b. Budget creation: createBudget
        if (sql.includes('INSERT INTO budgets')) {
          const [userId, categoryId, amount, month, year] = params;
          return {
            rows: [
              {
                id: 'bbbbbbbb-neww-neww-neww-000000000001',
                user_id: userId,
                category_id: categoryId,
                amount,
                month,
                year,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              }
            ]
          };
        }

        // 5. Analytics Queries
        if (sql.includes('total_spending') && sql.includes('FROM expenses e')) {
          const userId = params[0];
          if (userId === ALICE.id) {
            return {
              rows: [
                {
                  total_spending: '25.00',
                  total_transactions: '1',
                  average_expense: '25.00',
                  highest_expense: '25.00'
                }
              ]
            };
          }
          if (userId === BOB.id) {
            return {
              rows: [
                {
                  total_spending: '5000.00',
                  total_transactions: '1',
                  average_expense: '5000.00',
                  highest_expense: '5000.00'
                }
              ]
            };
          }
          return { rows: [{ total_spending: '0', total_transactions: '0', average_expense: '0', highest_expense: '0' }] };
        }

        if (sql.includes('previous_month_spending')) {
          return { rows: [{ previous_month_spending: '0' }] };
        }

        if (sql.includes('FROM expenses e') && sql.includes('GROUP BY c.id, c.name, c.icon, c.color')) {
          const userId = params[0];
          if (userId === ALICE.id) {
            return {
              rows: [
                {
                  category_id: GLOBAL_CAT_ID,
                  category_name: 'Food & Dining',
                  category_icon: 'utensils',
                  category_color: '#3B82F6',
                  total_amount: '25.00',
                  transaction_count: '1'
                }
              ]
            };
          }
          if (userId === BOB.id) {
            return {
              rows: [
                {
                  category_id: BOB_CAT_ID,
                  category_name: 'Bob Consulting',
                  category_icon: 'briefcase',
                  category_color: '#10B981',
                  total_amount: '5000.00',
                  transaction_count: '1'
                }
              ]
            };
          }
          return { rows: [] };
        }

        if (sql.includes('FROM expenses e') && sql.includes('GROUP BY e.payment_method')) {
          const userId = params[0];
          if (userId === ALICE.id) {
            return {
              rows: [{ payment_method: 'UPI', total_amount: '25.00', transaction_count: '1' }]
            };
          }
          if (userId === BOB.id) {
            return {
              rows: [{ payment_method: 'Credit Card', total_amount: '5000.00', transaction_count: '1' }]
            };
          }
          return { rows: [] };
        }

        if (sql.includes('FROM expenses e') && sql.includes('GROUP BY e.date')) {
          const userId = params[0];
          if (userId === ALICE.id) {
            return {
              rows: [{ date: '2026-10-29', daily_total: '25.00', transaction_count: '1' }]
            };
          }
          if (userId === BOB.id) {
            return {
              rows: [{ date: '2026-10-29', daily_total: '5000.00', transaction_count: '1' }]
            };
          }
          return { rows: [] };
        }

        return { rows: [] };
      })
    };

    app.locals.db = mockDb;
  });

  // ==========================================
  // 1. Cross-User Expense Isolation
  // ==========================================
  describe('1. Cross-User Expense Isolation', () => {
    it("User A cannot retrieve User B's expense by ID (returns 404 without leaking existence)", async () => {
      const res = await dispatch(app, {
        method: 'GET',
        url: `/api/v1/expenses/${BOB_EXPENSE_ID}`,
        headers: {
          cookie: ALICE_COOKIE
        }
      });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('EXPENSE_NOT_FOUND');

      // Verify the SQL query was scoped with both expense ID and Alice's user_id
      const queryCall = mockDb.query.mock.calls.find(
        (call) => call[0].includes('WHERE e.id = $1 AND e.user_id = $2')
      );
      expect(queryCall).toBeDefined();
      expect(queryCall[1]).toEqual([BOB_EXPENSE_ID, ALICE.id]);
    });

    it("User A cannot update User B's expense (returns 404, never updates record)", async () => {
      const res = await dispatch(app, {
        method: 'PATCH',
        url: `/api/v1/expenses/${BOB_EXPENSE_ID}`,
        headers: {
          cookie: ALICE_COOKIE,
          'content-type': 'application/json',
          'x-spendwise-csrf': '1',
          origin: env.CLIENT_URL
        },
        body: { amount: 10.0 }
      });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('EXPENSE_NOT_FOUND');

      // Ensure UPDATE query was NEVER called
      const updateCall = mockDb.query.mock.calls.find((call) =>
        call[0].includes('UPDATE expenses')
      );
      expect(updateCall).toBeUndefined();
    });

    it("User A cannot delete User B's expense (returns 404, never deletes record)", async () => {
      const res = await dispatch(app, {
        method: 'DELETE',
        url: `/api/v1/expenses/${BOB_EXPENSE_ID}`,
        headers: {
          cookie: ALICE_COOKIE,
          'x-requested-with': 'XMLHttpRequest',
          origin: env.CLIENT_URL
        }
      });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('EXPENSE_NOT_FOUND');

      // Verify DELETE query was executed with Alice's user_id, which returned 0 rows
      const deleteCall = mockDb.query.mock.calls.find((call) =>
        call[0].includes('DELETE FROM expenses')
      );
      expect(deleteCall).toBeDefined();
      expect(deleteCall[1]).toEqual([BOB_EXPENSE_ID, ALICE.id]);
    });

    it("User A listing expenses only receives User A's records and never User B's", async () => {
      const res = await dispatch(app, {
        method: 'GET',
        url: '/api/v1/expenses',
        headers: {
          cookie: ALICE_COOKIE
        }
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].id).toBe(ALICE_EXPENSE_ID);
      expect(res.body.data[0].user_id).toBe(ALICE.id);

      // Verify that SQL query filter included Alice's user_id as $1
      const listCall = mockDb.query.mock.calls.find((call) =>
        call[0].includes('FROM expenses e') && call[0].includes('LIMIT $')
      );
      expect(listCall).toBeDefined();
      expect(listCall[1][0]).toBe(ALICE.id);
    });
  });

  // ==========================================
  // 2. Cross-User Category Isolation & Global Availability
  // ==========================================
  describe('2. Cross-User Category Isolation & Global Category Availability', () => {
    it("User A listing categories only receives Global categories and User A's custom categories", async () => {
      const res = await dispatch(app, {
        method: 'GET',
        url: '/api/v1/categories',
        headers: {
          cookie: ALICE_COOKIE
        }
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const categories = res.body.data;
      expect(categories.length).toBe(2);

      // Contains Global and Alice's category
      expect(categories.some((c) => c.id === GLOBAL_CAT_ID && c.is_predefined === true)).toBe(true);
      expect(categories.some((c) => c.id === ALICE_CAT_ID && c.user_id === ALICE.id)).toBe(true);

      // Strictly excludes Bob's category
      expect(categories.some((c) => c.id === BOB_CAT_ID)).toBe(false);
      expect(categories.some((c) => c.user_id === BOB.id)).toBe(false);
    });

    it("User B listing categories only receives Global categories and User B's custom categories", async () => {
      const res = await dispatch(app, {
        method: 'GET',
        url: '/api/v1/categories',
        headers: {
          cookie: BOB_COOKIE
        }
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const categories = res.body.data;
      expect(categories.length).toBe(2);

      expect(categories.some((c) => c.id === GLOBAL_CAT_ID && c.is_predefined === true)).toBe(true);
      expect(categories.some((c) => c.id === BOB_CAT_ID && c.user_id === BOB.id)).toBe(true);
      expect(categories.some((c) => c.id === ALICE_CAT_ID)).toBe(false);
      expect(categories.some((c) => c.user_id === ALICE.id)).toBe(false);
    });

    it("User A cannot create an expense referencing User B's custom category", async () => {
      const res = await dispatch(app, {
        method: 'POST',
        url: '/api/v1/expenses',
        headers: {
          cookie: ALICE_COOKIE,
          'content-type': 'application/json',
          'x-requested-with': 'XMLHttpRequest',
          origin: env.CLIENT_URL
        },
        body: {
          title: 'Illicit Category Expense',
          amount: 45.0,
          date: '2026-10-29',
          payment_method: 'UPI',
          category_id: BOB_CAT_ID
        }
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_CATEGORY');

      // Ensure expense was not inserted
      const insertCall = mockDb.query.mock.calls.find((call) =>
        call[0].includes('INSERT INTO expenses')
      );
      expect(insertCall).toBeUndefined();
    });

    it("User A can create an expense referencing a global predefined category", async () => {
      const res = await dispatch(app, {
        method: 'POST',
        url: '/api/v1/expenses',
        headers: {
          cookie: ALICE_COOKIE,
          'content-type': 'application/json',
          'x-requested-with': 'XMLHttpRequest',
          origin: env.CLIENT_URL
        },
        body: {
          title: 'Valid Global Category Expense',
          amount: 55.0,
          date: '2026-10-29',
          payment_method: 'Cash',
          category_id: GLOBAL_CAT_ID
        }
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);

      const insertCall = mockDb.query.mock.calls.find((call) =>
        call[0].includes('INSERT INTO expenses')
      );
      expect(insertCall).toBeDefined();
      expect(insertCall[1][0]).toBe(ALICE.id);
      expect(insertCall[1][1]).toBe(GLOBAL_CAT_ID);
    });
  });

  // ==========================================
  // 3. Cross-User Budget Isolation
  // ==========================================
  describe('3. Cross-User Budget Isolation', () => {
    it("User A listing budgets only receives User A's budgets and calculated spending", async () => {
      const res = await dispatch(app, {
        method: 'GET',
        url: '/api/v1/budgets?month=10&year=2026',
        headers: {
          cookie: ALICE_COOKIE
        }
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].id).toBe(ALICE_BUDGET_ID);
      expect(res.body.data[0].userId).toBe(ALICE.id);
      expect(res.body.data[0].amount).toBe(2000);

      // Check query parameter was scoped to Alice
      const budgetCall = mockDb.query.mock.calls.find((call) =>
        call[0].includes('FROM budgets b') && call[0].includes('WHERE b.user_id = $1')
      );
      expect(budgetCall).toBeDefined();
      expect(budgetCall[1][0]).toBe(ALICE.id);
    });

    it("User A cannot create a budget referencing User B's custom category", async () => {
      const res = await dispatch(app, {
        method: 'POST',
        url: '/api/v1/budgets',
        headers: {
          cookie: ALICE_COOKIE,
          'content-type': 'application/json',
          'x-requested-with': 'XMLHttpRequest',
          origin: env.CLIENT_URL
        },
        body: {
          categoryId: BOB_CAT_ID,
          amount: 500,
          month: 10,
          year: 2026
        }
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_CATEGORY');

      // Verify budget INSERT was never executed
      const insertCall = mockDb.query.mock.calls.find((call) =>
        call[0].includes('INSERT INTO budgets')
      );
      expect(insertCall).toBeUndefined();
    });
  });

  // ==========================================
  // 4. Cross-User Analytics Isolation
  // ==========================================
  describe('4. Cross-User Analytics Isolation', () => {
    it("User A's analytics metrics strictly reflect User A's data and never include User B's transactions", async () => {
      const res = await dispatch(app, {
        method: 'GET',
        url: '/api/v1/analytics/summary?month=10&year=2026',
        headers: {
          cookie: ALICE_COOKIE
        }
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const { summary, byCategory, byPaymentMethod, dailyTrend } = res.body.data;

      // Alice's summary total is 25.00, transaction count 1
      expect(summary.totalSpending).toBe(25.0);
      expect(summary.totalTransactions).toBe(1);

      // Verify Alice's categories in breakdown (Food & Dining), no Bob Consulting
      expect(byCategory.some((c) => c.categoryName === 'Food & Dining')).toBe(true);
      expect(byCategory.some((c) => c.categoryName === 'Bob Consulting')).toBe(false);

      // Verify that every single analytics query used Alice's user_id ($1)
      const analyticsCalls = mockDb.query.mock.calls.filter((call) =>
        call[0].includes('FROM expenses e') && call[0].includes('e.user_id = $1')
      );
      expect(analyticsCalls.length).toBe(5);
      analyticsCalls.forEach((call) => {
        expect(call[1][0]).toBe(ALICE.id);
        expect(call[1][0]).not.toBe(BOB.id);
      });
    });
  });

  // ==========================================
  // 5. Anti-Spoofing & Identity Tampering Defenses
  // ==========================================
  describe('5. Anti-Spoofing & Identity Tampering Defenses', () => {
    it('ignores caller-supplied x-user-id header and strictly enforces session identity', async () => {
      const res = await dispatch(app, {
        method: 'GET',
        url: '/api/v1/expenses',
        headers: {
          cookie: ALICE_COOKIE,
          'x-user-id': BOB.id // Attacker trying to spoof Bob via header
        }
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data[0].user_id).toBe(ALICE.id);

      const listCall = mockDb.query.mock.calls.find((call) =>
        call[0].includes('FROM expenses e') && call[0].includes('LIMIT $')
      );
      expect(listCall[1][0]).toBe(ALICE.id);
      expect(listCall[1][0]).not.toBe(BOB.id);
    });

    it('ignores caller-supplied userId and user_id in body when creating expenses', async () => {
      const res = await dispatch(app, {
        method: 'POST',
        url: '/api/v1/expenses',
        headers: {
          cookie: ALICE_COOKIE,
          'content-type': 'application/json',
          'x-requested-with': 'XMLHttpRequest',
          origin: env.CLIENT_URL
        },
        body: {
          title: 'Spoofed User Expense',
          amount: 80.0,
          date: '2026-10-29',
          payment_method: 'UPI',
          // Maliciously attempting to inject Bob as owner
          userId: BOB.id,
          user_id: BOB.id
        }
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);

      const insertCall = mockDb.query.mock.calls.find((call) =>
        call[0].includes('INSERT INTO expenses')
      );
      expect(insertCall).toBeDefined();
      expect(insertCall[1][0]).toBe(ALICE.id); // Must be Alice, NOT Bob!
      expect(insertCall[1][0]).not.toBe(BOB.id);
    });

    it('ignores caller-supplied userId in query string for all domain routes', async () => {
      // Querying expenses with ?userId=BOB.id
      const expRes = await dispatch(app, {
        method: 'GET',
        url: `/api/v1/expenses?userId=${BOB.id}&user_id=${BOB.id}`,
        headers: {
          cookie: ALICE_COOKIE
        }
      });
      expect(expRes.status).toBe(200);
      expect(expRes.body.data[0].user_id).toBe(ALICE.id);

      // Querying budgets with ?userId=BOB.id
      const budgetRes = await dispatch(app, {
        method: 'GET',
        url: `/api/v1/budgets?month=10&year=2026&userId=${BOB.id}`,
        headers: {
          cookie: ALICE_COOKIE
        }
      });
      expect(budgetRes.status).toBe(200);
      expect(budgetRes.body.data[0].userId).toBe(ALICE.id);

      // Querying analytics with ?userId=BOB.id
      const analyticsRes = await dispatch(app, {
        method: 'GET',
        url: `/api/v1/analytics/summary?month=10&year=2026&userId=${BOB.id}`,
        headers: {
          cookie: ALICE_COOKIE
        }
      });
      expect(analyticsRes.status).toBe(200);
      expect(analyticsRes.body.data.summary.totalSpending).toBe(25.0);
    });

    it('rejects tampered or forged cookie attempting to impersonate Bob', async () => {
      // Forged signature for Bob's SID
      const forgedBobCookie = `${env.SESSION_COOKIE_NAME}=s:${BOB_SID}.invalid_attacker_hmac_signature`;

      const res = await dispatch(app, {
        method: 'GET',
        url: '/api/v1/expenses',
        headers: {
          cookie: forgedBobCookie
        }
      });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    });
  });
});
