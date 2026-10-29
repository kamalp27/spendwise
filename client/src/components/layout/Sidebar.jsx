import React from 'react';
import {
  Wallet,
  LayoutDashboard,
  Receipt,
  Tags,
  PiggyBank,
  BarChart3,
  Shield,
  IndianRupee
} from 'lucide-react';

export const NAVIGATION_ITEMS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'transactions', label: 'Transactions', icon: Receipt },
  { id: 'categories', label: 'Categories', icon: Tags },
  { id: 'budgets', label: 'Budgets', icon: PiggyBank },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 }
];

export default function Sidebar({ activeTab, onSelectTab }) {
  return (
    <aside
      className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 bg-[#0F172A] border-r border-[#1E293B] z-20 select-none"
      aria-label="Sidebar Navigation"
    >
      {/* Brand Header */}
      <div className="h-16 flex items-center px-6 border-b border-[#1E293B] space-x-3">
        <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-600/30 flex-shrink-0">
          <Wallet className="w-5 h-5" aria-hidden="true" />
        </div>
        <div className="flex flex-col">
          <span className="text-base font-bold text-[#F8FAFC] tracking-tight leading-tight">
            SpendWise
          </span>
          <span className="text-[11px] text-[#94A3B8] font-medium leading-none">
            Expense Tracker
          </span>
        </div>
      </div>

      {/* Currency & Environment Badge */}
      <div className="px-5 py-3 mx-4 my-3 rounded-lg bg-[#0B0F19] border border-[#1E293B] flex items-center justify-between">
        <div className="flex items-center space-x-2 text-xs text-[#94A3B8]">
          <IndianRupee className="w-3.5 h-3.5 text-blue-400" aria-hidden="true" />
          <span>Currency: <strong className="text-white font-semibold">INR (₹)</strong></span>
        </div>
        <span className="w-2 h-2 rounded-full bg-emerald-400" title="System Ready" aria-hidden="true" />
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-4 py-2 space-y-1 overflow-y-auto" aria-label="Main navigation">
        <div className="px-3 pb-2 text-[10px] font-semibold tracking-wider text-[#94A3B8] uppercase">
          Menu
        </div>
        {NAVIGATION_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
                isActive
                  ? 'bg-blue-600 text-white font-semibold shadow-sm shadow-blue-600/20'
                  : 'text-[#94A3B8] hover:bg-[#1E293B]/70 hover:text-white'
              }`}
            >
              <Icon
                className={`w-4 h-4 flex-shrink-0 ${
                  isActive ? 'text-white' : 'text-[#94A3B8]'
                }`}
                aria-hidden="true"
              />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Footer Status Panel */}
      <div className="p-4 border-t border-[#1E293B]">
        <div className="flex items-center space-x-3 px-3 py-2.5 rounded-lg bg-[#0B0F19]/80 border border-[#1E293B]">
          <div className="w-7 h-7 rounded-md bg-blue-600/10 text-blue-400 flex items-center justify-center flex-shrink-0">
            <Shield className="w-3.5 h-3.5" aria-hidden="true" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-medium text-white truncate">Development Mode</span>
            <span className="text-[10px] text-[#94A3B8] truncate">Stage 5.2 Active</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
