import React, { useState } from 'react';
import { Menu, X, Wallet, Calendar, User, LogOut } from 'lucide-react';
import { NAVIGATION_ITEMS } from './Sidebar.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

export default function Header({
  activeTab,
  onToggleMobileMenu,
  isMobileMenuOpen
}) {
  const { user, logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const currentNav = NAVIGATION_ITEMS.find((item) => item.id === activeTab);
  const currentTitle = currentNav ? currentNav.label : 'Overview';

  // Current system display period (INR default tracking period)
  const currentMonth = 'October 2026';
  const displayCurrency = user?.currency ? `${user.currency}` : '—';

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <header className="sticky top-0 z-10 h-16 bg-[#0F172A]/90 backdrop-blur-md border-b border-[#1E293B]">
      <div className="h-full px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        {/* Left: Mobile Menu Toggle & Title */}
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={onToggleMobileMenu}
            aria-label={isMobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            className="md:hidden p-2 rounded-lg text-[#94A3B8] hover:text-white hover:bg-[#1E293B] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
          >
            {isMobileMenuOpen ? (
              <X className="w-5 h-5" aria-hidden="true" />
            ) : (
              <Menu className="w-5 h-5" aria-hidden="true" />
            )}
          </button>

          {/* Mobile brand logo */}
          <div className="md:hidden flex items-center space-x-2">
            <div className="w-7 h-7 rounded-md bg-blue-600 flex items-center justify-center text-white">
              <Wallet className="w-4 h-4" aria-hidden="true" />
            </div>
            <span className="font-bold text-white text-sm">SpendWise</span>
          </div>

          {/* Desktop active page title */}
          <div className="hidden md:flex items-center space-x-3">
            <h1 className="text-lg font-bold text-white tracking-tight">
              {currentTitle}
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#1E293B] text-[#94A3B8] font-medium">
              {displayCurrency}
            </span>
          </div>
        </div>

        {/* Right: Period & Profile Badge */}
        <div className="flex items-center space-x-4">
          <div className="hidden sm:flex items-center space-x-2 text-xs font-medium text-[#94A3B8] bg-[#0B0F19] px-3 py-1.5 rounded-lg border border-[#1E293B]">
            <Calendar className="w-3.5 h-3.5 text-blue-400" aria-hidden="true" />
            <span>{currentMonth}</span>
          </div>

          {/* Profile Identity Slot */}
          <div className="flex items-center space-x-2.5 pl-2 sm:border-l sm:border-[#1E293B]">
            <div className="w-8 h-8 rounded-full bg-blue-600/20 border border-blue-500/30 text-blue-400 flex items-center justify-center">
              <User className="w-4 h-4" aria-hidden="true" />
            </div>
            <div className="hidden sm:flex flex-col text-left">
              <span className="text-xs font-medium text-white leading-none">
                {user ? user.displayName || user.email : 'Not signed in'}
              </span>
              <span className="text-[10px] text-[#94A3B8] leading-tight">
                {user ? user.email : 'Unauthenticated'}
              </span>
            </div>

            {user && (
              <button
                type="button"
                onClick={handleLogout}
                disabled={isLoggingOut}
                aria-label="Log out of account"
                className="ml-2 inline-flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#94A3B8] hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 disabled:opacity-50"
              >
                <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
                <span className="hidden md:inline">{isLoggingOut ? 'Logging out...' : 'Logout'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
