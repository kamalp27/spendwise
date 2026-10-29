import React, { useState, useRef } from 'react';
import {
  Lock,
  UserPlus,
  LogIn,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Wallet,
  Eye,
  EyeOff,
  Loader2
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';

const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

export const SUPPORTED_CURRENCIES = [
  { code: 'INR', label: 'INR (₹) - Indian Rupee' },
  { code: 'USD', label: 'USD ($) - US Dollar' },
  { code: 'EUR', label: 'EUR (€) - Euro' },
  { code: 'GBP', label: 'GBP (£) - British Pound' }
];

export default function AuthView({ initialMode = 'login' }) {
  const { login, register, refreshSession, error: authError } = useAuth();

  const [mode, setMode] = useState(initialMode); // 'login' | 'register'
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState(null);

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginErrors, setLoginErrors] = useState({});

  // Registration form state
  const [regDisplayName, setRegDisplayName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regCurrency, setRegCurrency] = useState('INR');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [regErrors, setRegErrors] = useState({});

  // Input references for accessible auto-focus
  const loginEmailRef = useRef(null);
  const loginPasswordRef = useRef(null);
  const regNameRef = useRef(null);
  const regEmailRef = useRef(null);
  const regPasswordRef = useRef(null);
  const regConfirmPasswordRef = useRef(null);

  // Switch between Login and Registration tabs
  const switchMode = (newMode) => {
    setMode(newMode);
    setServerError(null);
    setLoginErrors({});
    setRegErrors({});
  };

  // Live password validation criteria matching backend
  const passwordCriteria = {
    length: regPassword.length >= 8 && regPassword.length <= 72,
    hasLower: /[a-z]/.test(regPassword),
    hasUpper: /[A-Z]/.test(regPassword),
    hasNumber: /[0-9]/.test(regPassword)
  };

  // Handle Login Submission
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    setServerError(null);
    const errors = {};

    const cleanEmail = loginEmail.trim();
    if (!cleanEmail) {
      errors.email = 'Email address is required.';
    } else if (!EMAIL_REGEX.test(cleanEmail)) {
      errors.email = 'Please enter a valid email address.';
    }

    if (!loginPassword) {
      errors.password = 'Password is required.';
    }

    if (Object.keys(errors).length > 0) {
      setLoginErrors(errors);
      if (errors.email && loginEmailRef.current) {
        loginEmailRef.current.focus();
      } else if (errors.password && loginPasswordRef.current) {
        loginPasswordRef.current.focus();
      }
      return;
    }

    setLoginErrors({});
    setIsSubmitting(true);

    try {
      await login({
        email: cleanEmail,
        password: loginPassword
      });
      // Context handles state update to 'authenticated'
    } catch (err) {
      let message = 'Invalid email or password.';
      if (err.isNetworkError || err.code === 'NETWORK_ERROR') {
        message = 'Unable to connect to authentication server. Please check your network connection.';
      } else if (err.code === 'AUTH_RATE_LIMIT_EXCEEDED' || err.status === 429) {
        message = 'Too many authentication attempts. Please try again after 15 minutes.';
      } else if (err.code === 'ACCOUNT_DEACTIVATED' || err.status === 403) {
        message = 'This account has been deactivated. Please contact support.';
      } else if (err.status === 500) {
        message = 'Authentication service temporarily unavailable. Please try again later.';
      } else if (err.message && !err.message.includes('Internal')) {
        message = err.message;
      }

      setServerError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Registration Submission
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    setServerError(null);
    const errors = {};

    const cleanName = regDisplayName.trim();
    if (!cleanName) {
      errors.displayName = 'Full name is required.';
    } else if (cleanName.length > 100) {
      errors.displayName = 'Full name cannot exceed 100 characters.';
    }

    const cleanEmail = regEmail.trim();
    if (!cleanEmail) {
      errors.email = 'Email address is required.';
    } else if (!EMAIL_REGEX.test(cleanEmail)) {
      errors.email = 'Please enter a valid email address.';
    } else if (cleanEmail.length > 255) {
      errors.email = 'Email cannot exceed 255 characters.';
    }

    if (!regPassword) {
      errors.password = 'Password is required.';
    } else if (regPassword.length < 8) {
      errors.password = 'Password must be at least 8 characters long.';
    } else if (regPassword.length > 72) {
      errors.password = 'Password cannot exceed 72 characters.';
    } else if (
      !passwordCriteria.hasLower ||
      !passwordCriteria.hasUpper ||
      !passwordCriteria.hasNumber
    ) {
      errors.password =
        'Password must contain at least one uppercase letter, one lowercase letter, and one number.';
    }

    if (!regConfirmPassword) {
      errors.confirmPassword = 'Please confirm your password.';
    } else if (regPassword !== regConfirmPassword) {
      errors.confirmPassword = 'Passwords do not match.';
    }

    if (Object.keys(errors).length > 0) {
      setRegErrors(errors);
      if (errors.displayName && regNameRef.current) {
        regNameRef.current.focus();
      } else if (errors.email && regEmailRef.current) {
        regEmailRef.current.focus();
      } else if (errors.password && regPasswordRef.current) {
        regPasswordRef.current.focus();
      } else if (errors.confirmPassword && regConfirmPasswordRef.current) {
        regConfirmPasswordRef.current.focus();
      }
      return;
    }

    setRegErrors({});
    setIsSubmitting(true);

    try {
      await register({
        displayName: cleanName,
        email: cleanEmail,
        password: regPassword,
        currency: regCurrency
      });
      // Context updates state to 'authenticated'
    } catch (err) {
      let message = 'Registration failed. Please check the form and try again.';
      if (err.isNetworkError || err.code === 'NETWORK_ERROR') {
        message = 'Unable to connect to authentication server. Please check your network connection.';
      } else if (err.code === 'EMAIL_ALREADY_EXISTS' || err.status === 409) {
        message = 'An account with this email address is already registered.';
      } else if (err.code === 'AUTH_RATE_LIMIT_EXCEEDED' || err.status === 429) {
        message = 'Too many attempts. Please try again after 15 minutes.';
      } else if (err.message && !err.message.includes('Internal')) {
        message = err.message;
      }

      setServerError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-8 px-4 sm:px-6">
      {/* Brand Identity & Header Notice */}
      <div className="text-center mb-6">
        <div className="w-12 h-12 mx-auto rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-3 shadow-inner">
          <Wallet className="w-6 h-6" aria-hidden="true" />
        </div>
        <h1 className="text-xl font-bold text-white tracking-tight">SpendWise</h1>
        <h2 className="text-sm font-semibold text-blue-400 mt-1">Authentication Required</h2>
        <p className="mt-2 text-xs text-[#94A3B8] leading-relaxed">
          You are not currently signed in. Financial records and personal expense data are protected
          and withheld until an authenticated session is established.
        </p>
      </div>

      {/* Boot Session Verification Alert (if initial check had network/server failure) */}
      {authError && (
        <div
          role="alert"
          className="mb-5 rounded-lg bg-red-950/40 border border-red-500/30 p-4 text-xs text-red-300 flex items-start justify-between gap-3 shadow-sm"
        >
          <div className="flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="font-semibold text-white">Session Verification Failed</p>
              <p className="mt-0.5">{authError.message || 'Unable to connect to authentication server.'}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => refreshSession()}
            className="flex-shrink-0 inline-flex items-center space-x-1 px-2.5 py-1 rounded bg-red-600/20 hover:bg-red-600/30 text-red-200 border border-red-500/30 text-[11px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-400"
          >
            <RefreshCw className="w-3 h-3" aria-hidden="true" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Main Authentication Card */}
      <div className="bg-[#0F172A] border border-[#1E293B] rounded-xl shadow-xl overflow-hidden">
        {/* Navigation Tabs (Login / Register) */}
        <div className="flex border-b border-[#1E293B]" role="tablist" aria-label="Authentication Options">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'login'}
            aria-controls="login-panel"
            id="tab-login"
            onClick={() => switchMode('login')}
            className={`flex-1 py-3 px-4 text-xs font-semibold flex items-center justify-center space-x-2 border-b-2 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 ${
              mode === 'login'
                ? 'border-blue-500 text-white bg-blue-600/5'
                : 'border-transparent text-[#94A3B8] hover:text-white hover:bg-[#1E293B]/40'
            }`}
          >
            <LogIn className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Sign In</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={mode === 'register'}
            aria-controls="register-panel"
            id="tab-register"
            onClick={() => switchMode('register')}
            className={`flex-1 py-3 px-4 text-xs font-semibold flex items-center justify-center space-x-2 border-b-2 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 ${
              mode === 'register'
                ? 'border-blue-500 text-white bg-blue-600/5'
                : 'border-transparent text-[#94A3B8] hover:text-white hover:bg-[#1E293B]/40'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Create Account</span>
          </button>
        </div>

        {/* Server Submission Error Banner */}
        {serverError && (
          <div
            role="alert"
            className="m-5 mb-0 p-3 rounded-lg bg-red-950/40 border border-red-500/30 text-xs text-red-300 flex items-start space-x-2"
          >
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <span className="leading-relaxed">{serverError}</span>
          </div>
        )}

        {/* LOGIN PANEL */}
        {mode === 'login' && (
          <div id="login-panel" role="tabpanel" aria-labelledby="tab-login" className="p-5 sm:p-6">
            <form onSubmit={handleLoginSubmit} noValidate className="space-y-4">
              {/* Email Address */}
              <div>
                <label htmlFor="login-email" className="block text-xs font-medium text-[#F8FAFC] mb-1.5">
                  Email Address <span className="text-red-400">*</span>
                </label>
                <input
                  ref={loginEmailRef}
                  id="login-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={loginEmail}
                  onChange={(e) => {
                    setLoginEmail(e.target.value);
                    if (loginErrors.email) setLoginErrors((prev) => ({ ...prev, email: null }));
                  }}
                  aria-invalid={Boolean(loginErrors.email)}
                  aria-describedby={loginErrors.email ? 'login-email-error' : undefined}
                  placeholder="you@example.com"
                  className={`w-full px-3 py-2 rounded-lg bg-[#0B0F19] border text-sm text-white placeholder-[#64748B] transition-colors focus-visible:outline focus-visible:outline-2 ${
                    loginErrors.email
                      ? 'border-red-500 focus-visible:outline-red-500'
                      : 'border-[#1E293B] focus-visible:outline-blue-500'
                  }`}
                />
                {loginErrors.email && (
                  <p id="login-email-error" role="alert" className="mt-1 text-xs text-red-400 flex items-center space-x-1">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
                    <span>{loginErrors.email}</span>
                  </p>
                )}
              </div>

              {/* Password */}
              <div>
                <label htmlFor="login-password" className="block text-xs font-medium text-[#F8FAFC] mb-1.5">
                  Password <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <input
                    ref={loginPasswordRef}
                    id="login-password"
                    name="password"
                    type={showLoginPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={loginPassword}
                    onChange={(e) => {
                      setLoginPassword(e.target.value);
                      if (loginErrors.password) setLoginErrors((prev) => ({ ...prev, password: null }));
                    }}
                    aria-invalid={Boolean(loginErrors.password)}
                    aria-describedby={loginErrors.password ? 'login-password-error' : undefined}
                    placeholder="Enter your password"
                    className={`w-full px-3 py-2 pr-10 rounded-lg bg-[#0B0F19] border text-sm text-white placeholder-[#64748B] transition-colors focus-visible:outline focus-visible:outline-2 ${
                      loginErrors.password
                        ? 'border-red-500 focus-visible:outline-red-500'
                        : 'border-[#1E293B] focus-visible:outline-blue-500'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword((prev) => !prev)}
                    aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-white transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 rounded p-1"
                  >
                    {showLoginPassword ? (
                      <EyeOff className="w-4 h-4" aria-hidden="true" />
                    ) : (
                      <Eye className="w-4 h-4" aria-hidden="true" />
                    )}
                  </button>
                </div>
                {loginErrors.password && (
                  <p id="login-password-error" role="alert" className="mt-1 text-xs text-red-400 flex items-center space-x-1">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
                    <span>{loginErrors.password}</span>
                  </p>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-2 py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 disabled:cursor-not-allowed text-white text-xs font-semibold shadow-sm transition-colors flex items-center justify-center space-x-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                    <span>Signing In...</span>
                  </>
                ) : (
                  <>
                    <LogIn className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Sign In</span>
                  </>
                )}
              </button>
            </form>

            {/* Switch to Register */}
            <div className="mt-6 pt-5 border-t border-[#1E293B] text-center">
              <p className="text-xs text-[#94A3B8]">
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('register')}
                  className="font-medium text-blue-400 hover:text-blue-300 underline underline-offset-2 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 rounded"
                >
                  Create one now
                </button>
              </p>
            </div>
          </div>
        )}

        {/* REGISTRATION PANEL */}
        {mode === 'register' && (
          <div id="register-panel" role="tabpanel" aria-labelledby="tab-register" className="p-5 sm:p-6">
            <form onSubmit={handleRegisterSubmit} noValidate className="space-y-4">
              {/* Display Name */}
              <div>
                <label htmlFor="register-displayName" className="block text-xs font-medium text-[#F8FAFC] mb-1.5">
                  Full Name / Display Name <span className="text-red-400">*</span>
                </label>
                <input
                  ref={regNameRef}
                  id="register-displayName"
                  name="displayName"
                  type="text"
                  autoComplete="name"
                  maxLength={100}
                  required
                  value={regDisplayName}
                  onChange={(e) => {
                    setRegDisplayName(e.target.value);
                    if (regErrors.displayName) setRegErrors((prev) => ({ ...prev, displayName: null }));
                  }}
                  aria-invalid={Boolean(regErrors.displayName)}
                  aria-describedby={regErrors.displayName ? 'register-displayName-error' : undefined}
                  placeholder="e.g. Alex Morgan"
                  className={`w-full px-3 py-2 rounded-lg bg-[#0B0F19] border text-sm text-white placeholder-[#64748B] transition-colors focus-visible:outline focus-visible:outline-2 ${
                    regErrors.displayName
                      ? 'border-red-500 focus-visible:outline-red-500'
                      : 'border-[#1E293B] focus-visible:outline-blue-500'
                  }`}
                />
                {regErrors.displayName && (
                  <p id="register-displayName-error" role="alert" className="mt-1 text-xs text-red-400 flex items-center space-x-1">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
                    <span>{regErrors.displayName}</span>
                  </p>
                )}
              </div>

              {/* Email Address */}
              <div>
                <label htmlFor="register-email" className="block text-xs font-medium text-[#F8FAFC] mb-1.5">
                  Email Address <span className="text-red-400">*</span>
                </label>
                <input
                  ref={regEmailRef}
                  id="register-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={regEmail}
                  onChange={(e) => {
                    setRegEmail(e.target.value);
                    if (regErrors.email) setRegErrors((prev) => ({ ...prev, email: null }));
                  }}
                  aria-invalid={Boolean(regErrors.email)}
                  aria-describedby={regErrors.email ? 'register-email-error' : undefined}
                  placeholder="you@example.com"
                  className={`w-full px-3 py-2 rounded-lg bg-[#0B0F19] border text-sm text-white placeholder-[#64748B] transition-colors focus-visible:outline focus-visible:outline-2 ${
                    regErrors.email
                      ? 'border-red-500 focus-visible:outline-red-500'
                      : 'border-[#1E293B] focus-visible:outline-blue-500'
                  }`}
                />
                {regErrors.email && (
                  <p id="register-email-error" role="alert" className="mt-1 text-xs text-red-400 flex items-center space-x-1">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
                    <span>{regErrors.email}</span>
                  </p>
                )}
              </div>

              {/* Currency Selector */}
              <div>
                <label htmlFor="register-currency" className="block text-xs font-medium text-[#F8FAFC] mb-1.5">
                  Base Tracking Currency
                </label>
                <select
                  id="register-currency"
                  name="currency"
                  value={regCurrency}
                  onChange={(e) => setRegCurrency(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#0B0F19] border border-[#1E293B] text-sm text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
                >
                  {SUPPORTED_CURRENCIES.map((curr) => (
                    <option key={curr.code} value={curr.code}>
                      {curr.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Password */}
              <div>
                <label htmlFor="register-password" className="block text-xs font-medium text-[#F8FAFC] mb-1.5">
                  Password <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <input
                    ref={regPasswordRef}
                    id="register-password"
                    name="password"
                    type={showRegPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    value={regPassword}
                    onChange={(e) => {
                      setRegPassword(e.target.value);
                      if (regErrors.password) setRegErrors((prev) => ({ ...prev, password: null }));
                    }}
                    aria-invalid={Boolean(regErrors.password)}
                    aria-describedby="register-password-requirements"
                    placeholder="Min 8 chars, 1 uppercase, 1 lowercase, 1 number"
                    className={`w-full px-3 py-2 pr-10 rounded-lg bg-[#0B0F19] border text-sm text-white placeholder-[#64748B] transition-colors focus-visible:outline focus-visible:outline-2 ${
                      regErrors.password
                        ? 'border-red-500 focus-visible:outline-red-500'
                        : 'border-[#1E293B] focus-visible:outline-blue-500'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegPassword((prev) => !prev)}
                    aria-label={showRegPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-white transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 rounded p-1"
                  >
                    {showRegPassword ? (
                      <EyeOff className="w-4 h-4" aria-hidden="true" />
                    ) : (
                      <Eye className="w-4 h-4" aria-hidden="true" />
                    )}
                  </button>
                </div>
                {regErrors.password && (
                  <p id="register-password-error" role="alert" className="mt-1 text-xs text-red-400 flex items-center space-x-1">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
                    <span>{regErrors.password}</span>
                  </p>
                )}

                {/* Password Criteria Checklist */}
                <div
                  id="register-password-requirements"
                  className="mt-2.5 p-2.5 rounded-lg bg-[#0B0F19]/80 border border-[#1E293B] grid grid-cols-2 gap-1.5 text-[11px]"
                >
                  <span
                    className={`flex items-center space-x-1.5 ${
                      passwordCriteria.length ? 'text-emerald-400' : 'text-[#64748B]'
                    }`}
                  >
                    <CheckCircle2 className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
                    <span>8-72 characters</span>
                  </span>
                  <span
                    className={`flex items-center space-x-1.5 ${
                      passwordCriteria.hasUpper ? 'text-emerald-400' : 'text-[#64748B]'
                    }`}
                  >
                    <CheckCircle2 className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
                    <span>1 uppercase letter</span>
                  </span>
                  <span
                    className={`flex items-center space-x-1.5 ${
                      passwordCriteria.hasLower ? 'text-emerald-400' : 'text-[#64748B]'
                    }`}
                  >
                    <CheckCircle2 className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
                    <span>1 lowercase letter</span>
                  </span>
                  <span
                    className={`flex items-center space-x-1.5 ${
                      passwordCriteria.hasNumber ? 'text-emerald-400' : 'text-[#64748B]'
                    }`}
                  >
                    <CheckCircle2 className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
                    <span>1 number</span>
                  </span>
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label htmlFor="register-confirmPassword" className="block text-xs font-medium text-[#F8FAFC] mb-1.5">
                  Confirm Password <span className="text-red-400">*</span>
                </label>
                <input
                  ref={regConfirmPasswordRef}
                  id="register-confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={regConfirmPassword}
                  onChange={(e) => {
                    setRegConfirmPassword(e.target.value);
                    if (regErrors.confirmPassword)
                      setRegErrors((prev) => ({ ...prev, confirmPassword: null }));
                  }}
                  aria-invalid={Boolean(regErrors.confirmPassword)}
                  aria-describedby={regErrors.confirmPassword ? 'register-confirmPassword-error' : undefined}
                  placeholder="Re-enter your password"
                  className={`w-full px-3 py-2 rounded-lg bg-[#0B0F19] border text-sm text-white placeholder-[#64748B] transition-colors focus-visible:outline focus-visible:outline-2 ${
                    regErrors.confirmPassword
                      ? 'border-red-500 focus-visible:outline-red-500'
                      : 'border-[#1E293B] focus-visible:outline-blue-500'
                  }`}
                />
                {regErrors.confirmPassword && (
                  <p
                    id="register-confirmPassword-error"
                    role="alert"
                    className="mt-1 text-xs text-red-400 flex items-center space-x-1"
                  >
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
                    <span>{regErrors.confirmPassword}</span>
                  </p>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-2 py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 disabled:cursor-not-allowed text-white text-xs font-semibold shadow-sm transition-colors flex items-center justify-center space-x-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                    <span>Creating Account...</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Create Account</span>
                  </>
                )}
              </button>
            </form>

            {/* Switch to Login */}
            <div className="mt-6 pt-5 border-t border-[#1E293B] text-center">
              <p className="text-xs text-[#94A3B8]">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className="font-medium text-blue-400 hover:text-blue-300 underline underline-offset-2 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 rounded"
                >
                  Sign in
                </button>
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Check Active Session Re-check Button */}
      <div className="mt-6 text-center">
        <button
          type="button"
          onClick={() => refreshSession()}
          className="inline-flex items-center space-x-2 text-xs font-medium text-[#94A3B8] hover:text-white transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 rounded px-2 py-1"
        >
          <RefreshCw className="w-3 h-3 text-blue-400" aria-hidden="true" />
          <span>Check Active Session</span>
        </button>
      </div>
    </div>
  );
}
