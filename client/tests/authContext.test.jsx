import React, { useEffect } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { AuthProvider, useAuth, AuthContext } from '../src/context/AuthContext.jsx';
import { AuthService } from '../src/services/auth.service.js';
import { CategoryService } from '../src/services/category.service.js';
import { ExpenseService } from '../src/services/expense.service.js';
import App from '../src/App.jsx';

// Test consumer component exposing AuthContext values and actions
function TestConsumer({ onMount }) {
  const auth = useAuth();

  useEffect(() => {
    if (onMount) {
      onMount(auth);
    }
  }, [auth, onMount]);

  return (
    <div>
      <div data-testid="auth-status">{auth.status}</div>
      <div data-testid="auth-user">{auth.user ? JSON.stringify(auth.user) : 'null'}</div>
      <div data-testid="auth-error">{auth.error ? JSON.stringify(auth.error) : 'null'}</div>
      <button data-testid="btn-refresh" onClick={() => auth.refreshSession()}>
        Refresh
      </button>
      <button data-testid="btn-logout" onClick={() => auth.logout()}>
        Logout
      </button>
    </div>
  );
}

describe('Frontend Authentication Context & Session Restoration (Stage 6.2D3)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Test 1: Initial session restoration succeeds
  it('restores authenticated session on mount when GET /auth/me succeeds', async () => {
    const mockProfile = {
      id: 'usr-1111-2222-3333',
      email: 'alex@spendwise.example',
      displayName: 'Alex Morgan',
      currency: 'INR',
      createdAt: '2026-10-01T10:00:00.000Z',
      lastLoginAt: '2026-10-29T10:00:00.000Z'
    };

    vi.spyOn(AuthService, 'getProfile').mockResolvedValueOnce(mockProfile);

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    // Initial state is loading
    expect(screen.getByTestId('auth-status').textContent).toBe('loading');

    // Transitions to authenticated
    await waitFor(() => {
      expect(screen.getByTestId('auth-status').textContent).toBe('authenticated');
    });

    const userText = screen.getByTestId('auth-user').textContent;
    const parsedUser = JSON.parse(userText);
    expect(parsedUser.id).toBe(mockProfile.id);
    expect(parsedUser.email).toBe(mockProfile.email);
    expect(parsedUser.displayName).toBe(mockProfile.displayName);
    expect(parsedUser.currency).toBe('INR');
    expect(screen.getByTestId('auth-error').textContent).toBe('null');
  });

  // Test 2: HTTP 401 produces unauthenticated status with null user and null error
  it('sets unauthenticated status with null user and null error on HTTP 401', async () => {
    const unauthError = new Error('Authentication required.');
    unauthError.status = 401;
    unauthError.code = 'UNAUTHENTICATED';

    vi.spyOn(AuthService, 'getProfile').mockRejectedValueOnce(unauthError);

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('auth-status').textContent).toBe('unauthenticated');
    });

    expect(screen.getByTestId('auth-user').textContent).toBe('null');
    expect(screen.getByTestId('auth-error').textContent).toBe('null');
  });

  // Test 3: Network or server errors produce distinct recoverable error state
  it('captures distinct recoverable error state on network connection failure', async () => {
    const networkError = new Error('Network Error');
    networkError.isNetworkError = true;
    networkError.code = 'NETWORK_ERROR';

    vi.spyOn(AuthService, 'getProfile').mockRejectedValueOnce(networkError);

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('auth-status').textContent).toBe('unauthenticated');
    });

    expect(screen.getByTestId('auth-user').textContent).toBe('null');
    const errorObj = JSON.parse(screen.getByTestId('auth-error').textContent);
    expect(errorObj.code).toBe('NETWORK_ERROR');
    expect(errorObj.message).toContain('Unable to connect to authentication server');
  });

  it('captures distinct recoverable error state on HTTP 500 server error', async () => {
    const serverError = new Error('Internal Server Error');
    serverError.status = 500;
    serverError.code = 'INTERNAL_SERVER_ERROR';

    vi.spyOn(AuthService, 'getProfile').mockRejectedValueOnce(serverError);

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('auth-status').textContent).toBe('unauthenticated');
    });

    expect(screen.getByTestId('auth-user').textContent).toBe('null');
    const errorObj = JSON.parse(screen.getByTestId('auth-error').textContent);
    expect(errorObj.code).toBe('INTERNAL_SERVER_ERROR');
    expect(errorObj.message).toContain('temporarily unavailable');
  });

  it('captures distinct error when account is deactivated (HTTP 403)', async () => {
    const forbiddenError = new Error('Account deactivated by administrator.');
    forbiddenError.status = 403;
    forbiddenError.code = 'ACCOUNT_DEACTIVATED';

    vi.spyOn(AuthService, 'getProfile').mockRejectedValueOnce(forbiddenError);

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('auth-status').textContent).toBe('unauthenticated');
    });

    const errorObj = JSON.parse(screen.getByTestId('auth-error').textContent);
    expect(errorObj.code).toBe('ACCOUNT_DEACTIVATED');
    expect(errorObj.message).toBe('Account deactivated by administrator.');
  });

  // Test 4: refreshSession() rechecks and updates context correctly
  it('re-checks and updates session state when refreshSession() is invoked', async () => {
    const unauthError = new Error('Authentication required.');
    unauthError.status = 401;

    const initialMock = vi.spyOn(AuthService, 'getProfile').mockRejectedValueOnce(unauthError);

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('auth-status').textContent).toBe('unauthenticated');
    });

    // Now user logs in out-of-band or session becomes valid
    const freshProfile = {
      id: 'usr-9999',
      email: 'refreshed@spendwise.example',
      displayName: 'Refreshed User',
      currency: 'INR'
    };
    initialMock.mockResolvedValueOnce(freshProfile);

    // Trigger refresh
    fireEvent.click(screen.getByTestId('btn-refresh'));

    await waitFor(() => {
      expect(screen.getByTestId('auth-status').textContent).toBe('authenticated');
    });

    const parsedUser = JSON.parse(screen.getByTestId('auth-user').textContent);
    expect(parsedUser.id).toBe(freshProfile.id);
    expect(parsedUser.email).toBe(freshProfile.email);
  });

  // Test 5: Concurrent/repeated session checks discard stale out-of-order responses
  it('discards stale out-of-order session check responses', async () => {
    let resolveFirst;
    let resolveSecond;

    const firstPromise = new Promise((resolve) => {
      resolveFirst = resolve;
    });
    const secondPromise = new Promise((resolve) => {
      resolveSecond = resolve;
    });

    const profileSpy = vi
      .spyOn(AuthService, 'getProfile')
      .mockReturnValueOnce(firstPromise)
      .mockReturnValueOnce(secondPromise);

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    // Initial check (first request) is started
    expect(screen.getByTestId('auth-status').textContent).toBe('loading');

    // Trigger second request before first finishes
    fireEvent.click(screen.getByTestId('btn-refresh'));

    // Second request finishes FIRST with newer data
    const newerUser = { id: 'user-new', email: 'new@example.com', displayName: 'New User' };
    await act(async () => {
      resolveSecond(newerUser);
    });

    await waitFor(() => {
      expect(screen.getByTestId('auth-status').textContent).toBe('authenticated');
    });
    expect(JSON.parse(screen.getByTestId('auth-user').textContent).id).toBe('user-new');

    // First request finishes LATER with stale data
    const staleUser = { id: 'user-old-stale', email: 'stale@example.com', displayName: 'Old Stale' };
    await act(async () => {
      resolveFirst(staleUser);
    });

    // Must still retain the newer data and NOT revert to the stale data
    expect(JSON.parse(screen.getByTestId('auth-user').textContent).id).toBe('user-new');
  });

  // Test 6: logout() clears local state even if server logout fails
  it('clears user and sets unauthenticated status even if AuthService.logout() fails', async () => {
    const activeProfile = {
      id: 'usr-active-1',
      email: 'active@spendwise.example',
      displayName: 'Active User',
      currency: 'INR'
    };

    vi.spyOn(AuthService, 'getProfile').mockResolvedValueOnce(activeProfile);

    // Mock logout to fail with network error
    const logoutError = new Error('Logout Network Disconnect');
    logoutError.code = 'NETWORK_ERROR';
    vi.spyOn(AuthService, 'logout').mockRejectedValueOnce(logoutError);

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('auth-status').textContent).toBe('authenticated');
    });

    // Trigger logout
    fireEvent.click(screen.getByTestId('btn-logout'));

    // Local state must be cleared immediately
    await waitFor(() => {
      expect(screen.getByTestId('auth-status').textContent).toBe('unauthenticated');
    });
    expect(screen.getByTestId('auth-user').textContent).toBe('null');

    // Error describes the safe warning
    const errorObj = JSON.parse(screen.getByTestId('auth-error').textContent);
    expect(errorObj.code).toBe('NETWORK_ERROR');
  });

  // Test 7: No credentials or tokens written to localStorage or sessionStorage
  it('never stores tokens, passwords, or session IDs in localStorage or sessionStorage', async () => {
    const setLocalSpy = vi.spyOn(Storage.prototype, 'setItem');
    const setSessionSpy = vi.spyOn(sessionStorage, 'setItem');

    const testProfile = {
      id: 'usr-secure-test',
      email: 'secure@spendwise.example',
      displayName: 'Secure User',
      currency: 'INR'
    };

    vi.spyOn(AuthService, 'getProfile').mockResolvedValueOnce(testProfile);
    vi.spyOn(AuthService, 'logout').mockResolvedValueOnce({ message: 'Logged out successfully.' });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('auth-status').textContent).toBe('authenticated');
    });

    fireEvent.click(screen.getByTestId('btn-logout'));

    await waitFor(() => {
      expect(screen.getByTestId('auth-status').textContent).toBe('unauthenticated');
    });

    // Verify localStorage was never called with auth credentials
    const localCalls = setLocalSpy.mock.calls;
    for (const [key, val] of localCalls) {
      expect(key.toLowerCase()).not.toContain('token');
      expect(key.toLowerCase()).not.toContain('session');
      expect(key.toLowerCase()).not.toContain('password');
      expect(key.toLowerCase()).not.toContain('secret');
      expect(String(val)).not.toContain('usr-secure-test');
    }

    const sessionCalls = setSessionSpy.mock.calls;
    for (const [key, val] of sessionCalls) {
      expect(key.toLowerCase()).not.toContain('token');
      expect(key.toLowerCase()).not.toContain('session');
      expect(key.toLowerCase()).not.toContain('password');
      expect(key.toLowerCase()).not.toContain('secret');
    }
  });

  // Test 8: Protected dashboard data fetching waits until session restoration resolves
  it('waits for session restoration to resolve before loading dashboard domain data', async () => {
    let resolveSession;
    const sessionPromise = new Promise((resolve) => {
      resolveSession = resolve;
    });

    vi.spyOn(AuthService, 'getProfile').mockReturnValueOnce(sessionPromise);
    const getCategoriesSpy = vi.spyOn(CategoryService, 'getCategories').mockResolvedValue([]);
    const listExpensesSpy = vi.spyOn(ExpenseService, 'listExpenses').mockResolvedValue({
      items: [],
      pagination: { total: 0, page: 1, limit: 50, totalPages: 1 }
    });

    render(
      <AuthProvider>
        <App />
      </AuthProvider>
    );

    // During loading: loading screen is displayed
    expect(screen.getByText('Verifying session...')).toBeDefined();
    expect(getCategoriesSpy).not.toHaveBeenCalled();
    expect(listExpensesSpy).not.toHaveBeenCalled();

    // Now resolve session
    const userProfile = {
      id: 'usr-ready-1',
      email: 'ready@spendwise.example',
      displayName: 'Ready User',
      currency: 'INR'
    };

    await act(async () => {
      resolveSession(userProfile);
    });

    // Loading screen vanishes and domain queries trigger
    await waitFor(() => {
      expect(screen.queryByText('Verifying session...')).toBeNull();
    });

    expect(getCategoriesSpy).toHaveBeenCalledTimes(1);
    expect(listExpensesSpy).toHaveBeenCalledTimes(1);
  });

  // Test 9: useAuth() hook throws error when rendered outside AuthProvider (null context)
  it('throws a descriptive error when useAuth is consumed with null context', () => {
    // Suppress console.error in this test because React logs the thrown error
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    function ComponentConsumingAuth() {
      useAuth();
      return <div>Will not render</div>;
    }

    expect(() => {
      render(
        <AuthContext.Provider value={null}>
          <ComponentConsumingAuth />
        </AuthContext.Provider>
      );
    }).toThrow('useAuth must be used within an AuthProvider');

    consoleSpy.mockRestore();
  });

  describe('Gated Financial Data Access & Stale In-Flight Protection', () => {
    it('does not trigger domain requests while session restoration is loading', async () => {
      let resolveSession;
      const sessionPromise = new Promise((resolve) => {
        resolveSession = resolve;
      });

      vi.spyOn(AuthService, 'getProfile').mockReturnValueOnce(sessionPromise);
      const getCategoriesSpy = vi.spyOn(CategoryService, 'getCategories').mockResolvedValue([]);
      const listExpensesSpy = vi.spyOn(ExpenseService, 'listExpenses').mockResolvedValue({
        items: [],
        pagination: { total: 0, page: 1, limit: 50, totalPages: 1 }
      });

      render(
        <AuthProvider>
          <App />
        </AuthProvider>
      );

      expect(screen.getByText('Verifying session...')).toBeDefined();
      expect(getCategoriesSpy).not.toHaveBeenCalled();
      expect(listExpensesSpy).not.toHaveBeenCalled();

      // Clean up pending promise
      await act(async () => {
        resolveSession(null);
      });
    });

    it('does not trigger domain requests and displays honest unauthenticated UI on HTTP 401', async () => {
      const unauthError = new Error('Authentication required.');
      unauthError.status = 401;

      vi.spyOn(AuthService, 'getProfile').mockRejectedValueOnce(unauthError);
      const getCategoriesSpy = vi.spyOn(CategoryService, 'getCategories').mockResolvedValue([]);
      const listExpensesSpy = vi.spyOn(ExpenseService, 'listExpenses').mockResolvedValue({
        items: [],
        pagination: { total: 0, page: 1, limit: 50, totalPages: 1 }
      });

      render(
        <AuthProvider>
          <App />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Authentication Required')).toBeDefined();
      });

      expect(getCategoriesSpy).not.toHaveBeenCalled();
      expect(listExpensesSpy).not.toHaveBeenCalled();
      expect(
        screen.getByText(
          'You are not currently signed in. Financial records and personal expense data are protected and withheld until an authenticated session is established.'
        )
      ).toBeDefined();
      expect(screen.getByText('Not signed in')).toBeDefined();
      expect(screen.getByText('Unauthenticated')).toBeDefined();
      expect(screen.queryByLabelText('Financial Summary Cards')).toBeNull();
    });

    it('does not trigger domain requests and displays honest error UI after session-check network error', async () => {
      const netError = new Error('Network connection timeout');
      netError.isNetworkError = true;
      netError.code = 'NETWORK_ERROR';

      vi.spyOn(AuthService, 'getProfile').mockRejectedValueOnce(netError);
      const getCategoriesSpy = vi.spyOn(CategoryService, 'getCategories').mockResolvedValue([]);
      const listExpensesSpy = vi.spyOn(ExpenseService, 'listExpenses').mockResolvedValue({
        items: [],
        pagination: { total: 0, page: 1, limit: 50, totalPages: 1 }
      });

      render(
        <AuthProvider>
          <App />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Session Verification Failed')).toBeDefined();
      });

      expect(getCategoriesSpy).not.toHaveBeenCalled();
      expect(listExpensesSpy).not.toHaveBeenCalled();
      expect(
        screen.getByText(
          'Unable to connect to authentication server. Please check your network connection.'
        )
      ).toBeDefined();
      expect(screen.queryByLabelText('Financial Summary Cards')).toBeNull();
    });

    it('resumes domain requests when session transitions from unauthenticated to authenticated', async () => {
      const unauthError = new Error('Authentication required.');
      unauthError.status = 401;

      const profileSpy = vi.spyOn(AuthService, 'getProfile').mockRejectedValueOnce(unauthError);
      const getCategoriesSpy = vi.spyOn(CategoryService, 'getCategories').mockResolvedValue([]);
      const listExpensesSpy = vi.spyOn(ExpenseService, 'listExpenses').mockResolvedValue({
        items: [],
        pagination: { total: 0, page: 1, limit: 50, totalPages: 1 }
      });

      render(
        <AuthProvider>
          <App />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Authentication Required')).toBeDefined();
      });

      expect(getCategoriesSpy).not.toHaveBeenCalled();
      expect(listExpensesSpy).not.toHaveBeenCalled();

      // Now configure successful authentication on session check
      const validUser = {
        id: 'usr-resumed-1',
        email: 'resumed@spendwise.example',
        displayName: 'Resumed User',
        currency: 'INR'
      };
      profileSpy.mockResolvedValueOnce(validUser);

      // Trigger "Check Active Session"
      fireEvent.click(screen.getByText('Check Active Session'));

      await waitFor(() => {
        expect(screen.queryByText('Authentication Required')).toBeNull();
      });

      expect(getCategoriesSpy).toHaveBeenCalledTimes(1);
      expect(listExpensesSpy).toHaveBeenCalledTimes(1);
      expect(screen.getByText('Resumed User')).toBeDefined();
    });

    it('prevents stale in-flight responses from repopulating financial state after logout', async () => {
      const mockInitialUser = {
        id: 'usr-sess-99',
        email: 'session@spendwise.example',
        displayName: 'Session User',
        currency: 'INR'
      };

      let resolveExpenses;
      const expensesPromise = new Promise((resolve) => {
        resolveExpenses = resolve;
      });

      vi.spyOn(CategoryService, 'getCategories').mockResolvedValue([]);
      const listExpensesSpy = vi.spyOn(ExpenseService, 'listExpenses').mockReturnValue(expensesPromise);
      vi.spyOn(AuthService, 'logout').mockResolvedValue({ message: 'Logged out successfully.' });

      function Harness() {
        const { logout } = useAuth();
        return (
          <div>
            <button data-testid="logout-btn" onClick={() => logout()}>
              Log Out
            </button>
            <App />
          </div>
        );
      }

      render(
        <AuthProvider initialStatus="authenticated" initialUser={mockInitialUser}>
          <Harness />
        </AuthProvider>
      );

      // Initially authenticated: loadExpenses was triggered and is in-flight
      expect(listExpensesSpy).toHaveBeenCalledTimes(1);

      // User initiates logout while request is still pending
      fireEvent.click(screen.getByTestId('logout-btn'));

      // Transitions to unauthenticated
      await waitFor(() => {
        expect(screen.getByText('Authentication Required')).toBeDefined();
      });

      // Now the pending request resolves with data
      await act(async () => {
        resolveExpenses({
          items: [
            {
              id: 'stale-exp-99',
              title: 'Secret Stale Transaction',
              amount: 5432,
              date: '2026-10-29',
              paymentMethod: 'Cash',
              payment_method: 'Cash',
              categoryId: 'cat-1',
              category_id: 'cat-1'
            }
          ],
          pagination: { total: 1, page: 1, limit: 50, totalPages: 1 }
        });
      });

      // The resolved data must NOT be rendered or repopulate the dashboard
      expect(screen.queryByText('Secret Stale Transaction')).toBeNull();
      expect(screen.getByText('Authentication Required')).toBeDefined();
    });
  });
});
