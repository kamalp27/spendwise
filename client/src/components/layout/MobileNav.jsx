import React from 'react';
import { Wallet, X, IndianRupee } from 'lucide-react';
import { NAVIGATION_ITEMS } from './Sidebar.jsx';

export default function MobileNav({
  isOpen,
  onClose,
  activeTab,
  onSelectTab
}) {
  if (!isOpen) return null;

  return (
    <div className="md:hidden fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        className="relative flex-1 flex flex-col max-w-xs w-full bg-[#0F172A] border-r border-[#1E293B] p-6 focus:outline-none"
        role="dialog"
        aria-modal="true"
        aria-label="Mobile Navigation"
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between pb-6 border-b border-[#1E293B]">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-600/30">
              <Wallet className="w-5 h-5" aria-hidden="true" />
            </div>
            <div className="flex flex-col">
              <span className="text-base font-bold text-white tracking-tight">SpendWise</span>
              <span className="text-[11px] text-[#94A3B8]">Expense Tracker</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close mobile menu"
            className="p-1.5 rounded-lg text-[#94A3B8] hover:text-white hover:bg-[#1E293B] focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Currency Info */}
        <div className="my-4 p-3 rounded-lg bg-[#0B0F19] border border-[#1E293B] flex items-center space-x-2 text-xs text-[#94A3B8]">
          <IndianRupee className="w-4 h-4 text-blue-400" aria-hidden="true" />
          <span>Default Currency: <strong className="text-white">INR (₹)</strong></span>
        </div>

        {/* Navigation List */}
        <nav className="flex-1 space-y-1.5 mt-2" aria-label="Mobile menu">
          {NAVIGATION_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelectTab(item.id);
                  onClose();
                }}
                aria-current={isActive ? 'page' : undefined}
                className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
                  isActive
                    ? 'bg-blue-600 text-white font-semibold shadow-sm'
                    : 'text-[#94A3B8] hover:bg-[#1E293B] hover:text-white'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-[#94A3B8]'}`} aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Bottom environment badge */}
        <div className="pt-4 border-t border-[#1E293B] text-[11px] text-[#94A3B8] text-center">
          SpendWise UI Foundation &bull; Stage 5.2
        </div>
      </div>
    </div>
  );
}
