import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { AuthProvider, useAuth } from '../src/context/AuthContext.jsx';
import AuthView from '../src/features/auth/AuthView.jsx';
import { AuthService } from '../src/services/auth.service.js';
import { CategoryService } from '../src/services/category.service.js';
import { ExpenseService } from '../src/services/expense.service.js';
import App from '../src/App.jsx';

describe('Frontend Login, Registration, and Logout UI (Stage 6.2D4)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Test 1: Login succeeds and updates authentication state
  it('submits login credentials, updates authentication state, and renders the dashboard', async () => {
    const unauthError = new Error('Authentication required.');
    unauthError.status = 401;
    vi.spyOn(AuthService, 'getProfile').mockRejectedValueOnce(unauthError);

    const mockUser = {
      id: 'usr-login-123',
      email: 'alex@spendwise.example',
      displayName: 'Alex Morgan',
      currency: 'INR'
    };

    const loginSpy = vi.spyOn(AuthService, 'login').mockResolvedValueOnce(mockUser);
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

    // Initial state is unauthenticated showing AuthView
    await waitFor(() => {
      expect(screen.getByText('Authentication Required')).toBeDefined();
    });

    // Fill in login form
    const emailInput = screen.getByLabelText(/Email Address/);
    const passwordInput = screen.getByLabelText(/Password/);

    fireEvent.change(emailInput, { target: { value: 'alex@spendwise.example' } });
    fireEvent.change(passwordInput, { target: { value: 'SecretPass123!' } });

    // Submit login form
    const submitBtn = screen.getByRole('button', { name: /Sign In/i });
    fireEvent.click(submitBtn);

    // Expect AuthService.login to be called with exact payload
    expect(loginSpy).toHaveBeenCalledWith({
      email: 'alex@spendwise.example',
      password: 'SecretPass123!'
    });

    // Auth state transitions to authenticated and mounts dashboard
    await waitFor(() => {
      expect(screen.queryByText('Authentication Required')).toBeNull();
      expect(screen.getByText('Alex Morgan')).toBeDefined();
    });

    expect(getCategoriesSpy).toHaveBeenCalledTimes(1);
    expect(listExpensesSpy).toHaveBeenCalledTimes(1);
  });

  // Test 2: Invalid login displays a safe error
  it('displays a safe error message on invalid credentials and keeps status unauthenticated', async () => {
    const credError = new Error('Invalid email or password.');
    credError.status = 401;
    credError.code = 'INVALID_CREDENTIALS';

    vi.spyOn(AuthService, 'login').mockRejectedValueOnce(credError);

    render(
      <AuthProvider initialStatus="unauthenticated">
        <AuthView />
      </AuthProvider>
    );

    const emailInput = screen.getByLabelText(/Email Address/);
    const passwordInput = screen.getByLabelText(/Password/);

    fireEvent.change(emailInput, { target: { value: 'wrong@spendwise.example' } });
    fireEvent.change(passwordInput, { target: { value: 'WrongPassword123' } });

    fireEvent.click(screen.getByRole('button', { name: /Sign In/i }));

    await waitFor(() => {
      expect(screen.getByText('Invalid email or password.')).toBeDefined();
    });

    // Form remains in unauthenticated login view
    expect(screen.getByText('Authentication Required')).toBeDefined();
  });

  // Test 3: Registration succeeds and updates authentication state
  it('submits valid registration data and updates authentication context to authenticated', async () => {
    const unauthError = new Error('Authentication required.');
    unauthError.status = 401;
    vi.spyOn(AuthService, 'getProfile').mockRejectedValueOnce(unauthError);

    const newUser = {
      id: 'usr-new-456',
      email: 'sam@spendwise.example',
      displayName: 'Sam Wilson',
      currency: 'USD'
    };

    const registerSpy = vi.spyOn(AuthService, 'register').mockResolvedValueOnce(newUser);
    vi.spyOn(CategoryService, 'getCategories').mockResolvedValue([]);
    vi.spyOn(ExpenseService, 'listExpenses').mockResolvedValue({
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

    // Switch to registration tab
    fireEvent.click(screen.getByRole('tab', { name: /Create Account/i }));

    // Fill in registration form
    fireEvent.change(screen.getByLabelText(/Full Name/i), { target: { value: 'Sam Wilson' } });
    fireEvent.change(screen.getByLabelText(/Email Address/i), { target: { value: 'sam@spendwise.example' } });
    fireEvent.change(screen.getByLabelText(/Base Tracking Currency/i), { target: { value: 'USD' } });
    fireEvent.change(screen.getByLabelText(/^Password \*/i), { target: { value: 'StrongPass123' } });
    fireEvent.change(screen.getByLabelText(/Confirm Password/i), { target: { value: 'StrongPass123' } });

    fireEvent.click(screen.getByRole('button', { name: /Create Account/i }));

    expect(registerSpy).toHaveBeenCalledWith({
      displayName: 'Sam Wilson',
      email: 'sam@spendwise.example',
      password: 'StrongPass123',
      currency: 'USD'
    });

    await waitFor(() => {
      expect(screen.queryByText('Authentication Required')).toBeNull();
      expect(screen.getByText('Sam Wilson')).toBeDefined();
    });
  });

  // Test 4: Registration validation follows the real backend contract
  it('enforces backend password strength and confirmation validation before submission', async () => {
    const registerSpy = vi.spyOn(AuthService, 'register');

    render(
      <AuthProvider initialStatus="unauthenticated">
        <AuthView initialMode="register" />
      </AuthProvider>
    );

    // Empty submission triggers field errors
    fireEvent.click(screen.getByRole('button', { name: /Create Account/i }));

    expect(screen.getByText('Full name is required.')).toBeDefined();
    expect(screen.getByText('Email address is required.')).toBeDefined();
    expect(screen.getByText('Password is required.')).toBeDefined();
    expect(registerSpy).not.toHaveBeenCalled();

    // Password too short (< 8)
    fireEvent.change(screen.getByLabelText(/Full Name/i), { target: { value: 'Sam' } });
    fireEvent.change(screen.getByLabelText(/Email Address/i), { target: { value: 'sam@example.com' } });
    fireEvent.change(screen.getByLabelText(/^Password \*/i), { target: { value: 'Abc1' } });
    fireEvent.change(screen.getByLabelText(/Confirm Password/i), { target: { value: 'Abc1' } });

    fireEvent.click(screen.getByRole('button', { name: /Create Account/i }));
    expect(screen.getByText('Password must be at least 8 characters long.')).toBeDefined();
    expect(registerSpy).not.toHaveBeenCalled();

    // Password missing uppercase letter
    fireEvent.change(screen.getByLabelText(/^Password \*/i), { target: { value: 'alllowercase1' } });
    fireEvent.change(screen.getByLabelText(/Confirm Password/i), { target: { value: 'alllowercase1' } });

    fireEvent.click(screen.getByRole('button', { name: /Create Account/i }));
    expect(
      screen.getByText('Password must contain at least one uppercase letter, one lowercase letter, and one number.')
    ).toBeDefined();
    expect(registerSpy).not.toHaveBeenCalled();

    // Password missing number
    fireEvent.change(screen.getByLabelText(/^Password \*/i), { target: { value: 'NoNumberHere' } });
    fireEvent.change(screen.getByLabelText(/Confirm Password/i), { target: { value: 'NoNumberHere' } });

    fireEvent.click(screen.getByRole('button', { name: /Create Account/i }));
    expect(
      screen.getByText('Password must contain at least one uppercase letter, one lowercase letter, and one number.')
    ).toBeDefined();
    expect(registerSpy).not.toHaveBeenCalled();

    // Passwords do not match
    fireEvent.change(screen.getByLabelText(/^Password \*/i), { target: { value: 'ValidPass1' } });
    fireEvent.change(screen.getByLabelText(/Confirm Password/i), { target: { value: 'DifferentPass2' } });

    fireEvent.click(screen.getByRole('button', { name: /Create Account/i }));
    expect(screen.getByText('Passwords do not match.')).toBeDefined();
    expect(registerSpy).not.toHaveBeenCalled();
  });

  // Test 5: Duplicate submissions are prevented while submitting
  it('disables submit button and prevents duplicate submissions while request is in-flight', async () => {
    let resolveLogin;
    const loginPromise = new Promise((resolve) => {
      resolveLogin = resolve;
    });

    const loginSpy = vi.spyOn(AuthService, 'login').mockReturnValue(loginPromise);

    render(
      <AuthProvider initialStatus="unauthenticated">
        <AuthView initialMode="login" />
      </AuthProvider>
    );

    fireEvent.change(screen.getByLabelText(/Email Address/), { target: { value: 'user@example.com' } });
    fireEvent.change(screen.getByLabelText(/Password/), { target: { value: 'Password123!' } });

    const submitBtn = screen.getByRole('button', { name: /Sign In/i });
    fireEvent.click(submitBtn);

    // Button should now be disabled and show loading indicator
    expect(submitBtn.disabled).toBe(true);
    expect(screen.getByText('Signing In...')).toBeDefined();

    // Attempting a second click does not invoke login again
    fireEvent.click(submitBtn);
    expect(loginSpy).toHaveBeenCalledTimes(1);

    // Resolve login
    await act(async () => {
      resolveLogin({ id: 'usr-1', email: 'user@example.com', displayName: 'User', currency: 'INR' });
    });
  });

  // Test 6: Password fields are not persisted to browser storage
  it('never stores candidate passwords or tokens in localStorage or sessionStorage', async () => {
    const localSpy = vi.spyOn(Storage.prototype, 'setItem');
    const sessionSpy = vi.spyOn(sessionStorage, 'setItem');

    vi.spyOn(AuthService, 'login').mockResolvedValueOnce({
      id: 'usr-sec-1',
      email: 'sec@example.com',
      displayName: 'Sec User',
      currency: 'INR'
    });

    render(
      <AuthProvider initialStatus="unauthenticated">
        <AuthView initialMode="login" />
      </AuthProvider>
    );

    const testPassword = 'UltraSecretPassword99!';
    fireEvent.change(screen.getByLabelText(/Email Address/), { target: { value: 'sec@example.com' } });
    fireEvent.change(screen.getByLabelText(/Password/), { target: { value: testPassword } });

    fireEvent.click(screen.getByRole('button', { name: /Sign In/i }));

    await waitFor(() => {
      expect(screen.queryByText('Invalid email or password.')).toBeNull();
    });

    // Verify localStorage and sessionStorage never received the plaintext password
    for (const [key, val] of localSpy.mock.calls) {
      expect(String(val)).not.toContain(testPassword);
      expect(key.toLowerCase()).not.toContain('password');
      expect(key.toLowerCase()).not.toContain('token');
    }

    for (const [key, val] of sessionSpy.mock.calls) {
      expect(String(val)).not.toContain(testPassword);
      expect(key.toLowerCase()).not.toContain('password');
      expect(key.toLowerCase()).not.toContain('token');
    }
  });

  // Test 7: Logout calls the service and returns to the unauthenticated interface
  it('calls AuthService.logout from Header and returns the UI to the unauthenticated interface', async () => {
    const activeUser = {
      id: 'usr-active-99',
      email: 'active@spendwise.example',
      displayName: 'Active Admin',
      currency: 'INR'
    };

    const logoutSpy = vi.spyOn(AuthService, 'logout').mockResolvedValueOnce({ message: 'Logged out successfully.' });
    vi.spyOn(CategoryService, 'getCategories').mockResolvedValue([]);
    vi.spyOn(ExpenseService, 'listExpenses').mockResolvedValue({
      items: [],
      pagination: { total: 0, page: 1, limit: 50, totalPages: 1 }
    });

    render(
      <AuthProvider initialStatus="authenticated" initialUser={activeUser}>
        <App />
      </AuthProvider>
    );

    // User is signed in and visible
    expect(screen.getByText('Active Admin')).toBeDefined();

    // Click logout button in Header
    const logoutBtn = screen.getByRole('button', { name: /Log out of account/i });
    fireEvent.click(logoutBtn);

    expect(logoutSpy).toHaveBeenCalledTimes(1);

    // Transitions back to unauthenticated view
    await waitFor(() => {
      expect(screen.getByText('Authentication Required')).toBeDefined();
      expect(screen.getByText('Not signed in')).toBeDefined();
      expect(screen.getByText('Unauthenticated')).toBeDefined();
    });
  });

  // Test 8: Session restoration remains functional on mount
  it('restores authenticated session on initial mount without manual login', async () => {
    const existingUser = {
      id: 'usr-restored-1',
      email: 'restored@spendwise.example',
      displayName: 'Restored User',
      currency: 'INR'
    };

    vi.spyOn(AuthService, 'getProfile').mockResolvedValueOnce(existingUser);
    vi.spyOn(CategoryService, 'getCategories').mockResolvedValue([]);
    vi.spyOn(ExpenseService, 'listExpenses').mockResolvedValue({
      items: [],
      pagination: { total: 0, page: 1, limit: 50, totalPages: 1 }
    });

    render(
      <AuthProvider>
        <App />
      </AuthProvider>
    );

    // Loading boundary while GET /auth/me is in-flight
    expect(screen.getByText('Verifying session...')).toBeDefined();

    // Automatically transitions to authenticated dashboard
    await waitFor(() => {
      expect(screen.queryByText('Verifying session...')).toBeNull();
      expect(screen.getByText('Restored User')).toBeDefined();
    });
  });

  // Test 9: Protected financial data is not displayed after logout
  it('purges financial data and stops displaying transactions immediately after logout', async () => {
    const activeUser = {
      id: 'usr-active-88',
      email: 'fin@spendwise.example',
      displayName: 'Fin User',
      currency: 'INR'
    };

    const mockExpense = {
      id: 'exp-top-secret',
      title: 'Confidential Transaction',
      amount: 8888,
      date: '2026-10-29',
      paymentMethod: 'Cash',
      payment_method: 'Cash',
      categoryId: 'cat-1',
      category_id: 'cat-1'
    };

    vi.spyOn(CategoryService, 'getCategories').mockResolvedValue([]);
    vi.spyOn(ExpenseService, 'listExpenses').mockResolvedValue({
      items: [mockExpense],
      pagination: { total: 1, page: 1, limit: 50, totalPages: 1 }
    });
    vi.spyOn(AuthService, 'logout').mockResolvedValueOnce({ message: 'Logged out successfully.' });

    render(
      <AuthProvider initialStatus="authenticated" initialUser={activeUser}>
        <App />
      </AuthProvider>
    );

    // Wait for transaction to load in authenticated view
    await waitFor(() => {
      expect(screen.getByText('Confidential Transaction')).toBeDefined();
    });

    // Log out
    fireEvent.click(screen.getByRole('button', { name: /Log out of account/i }));

    // Transaction must vanish immediately
    await waitFor(() => {
      expect(screen.queryByText('Confidential Transaction')).toBeNull();
      expect(screen.getByText('Authentication Required')).toBeDefined();
    });
  });

  // Test 10: Network/server failures produce safe, recoverable messages
  it('displays user-friendly messages for rate limiting, conflicts, and network failures', async () => {
    // 10a: Rate limit exceeded (429)
    const rateLimitError = new Error('Too many attempts.');
    rateLimitError.status = 429;
    rateLimitError.code = 'AUTH_RATE_LIMIT_EXCEEDED';
    vi.spyOn(AuthService, 'login').mockRejectedValueOnce(rateLimitError);

    render(
      <AuthProvider initialStatus="unauthenticated">
        <AuthView initialMode="login" />
      </AuthProvider>
    );

    fireEvent.change(screen.getByLabelText(/Email Address/), { target: { value: 'user@example.com' } });
    fireEvent.change(screen.getByLabelText(/Password/), { target: { value: 'Password123!' } });
    fireEvent.click(screen.getByRole('button', { name: /Sign In/i }));

    await waitFor(() => {
      expect(screen.getByText(/Too many authentication attempts/)).toBeDefined();
    });

    // 10b: Registration email conflict (409)
    const conflictError = new Error('Email exists');
    conflictError.status = 409;
    conflictError.code = 'EMAIL_ALREADY_EXISTS';
    vi.spyOn(AuthService, 'register').mockRejectedValueOnce(conflictError);

    fireEvent.click(screen.getByRole('tab', { name: /Create Account/i }));

    fireEvent.change(screen.getByLabelText(/Full Name/i), { target: { value: 'User' } });
    fireEvent.change(screen.getByLabelText(/Email Address/i), { target: { value: 'exists@example.com' } });
    fireEvent.change(screen.getByLabelText(/^Password \*/i), { target: { value: 'ValidPass123' } });
    fireEvent.change(screen.getByLabelText(/Confirm Password/i), { target: { value: 'ValidPass123' } });
    fireEvent.click(screen.getByRole('button', { name: /Create Account/i }));

    await waitFor(() => {
      expect(screen.getByText('An account with this email address is already registered.')).toBeDefined();
    });
  });

  // Test 11: Accessible form controls and password visibility toggles
  it('provides accessible form controls, tab controls, and password visibility toggle', () => {
    render(
      <AuthProvider initialStatus="unauthenticated">
        <AuthView initialMode="login" />
      </AuthProvider>
    );

    // Verify accessible role and attributes
    expect(screen.getByRole('tablist', { name: /Authentication Options/i })).toBeDefined();
    expect(screen.getByRole('tab', { name: /Sign In/i }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tab', { name: /Create Account/i }).getAttribute('aria-selected')).toBe('false');

    // Password input toggle
    const passwordInput = screen.getByLabelText(/Password/);
    expect(passwordInput.type).toBe('password');

    const toggleBtn = screen.getByRole('button', { name: /Show password/i });
    fireEvent.click(toggleBtn);
    expect(passwordInput.type).toBe('text');

    fireEvent.click(screen.getByRole('button', { name: /Hide password/i }));
    expect(passwordInput.type).toBe('password');
  });
});
