import React from 'react';
import { getCategoryIcon } from './categoryIcons.jsx';
import { Shield, Sparkles } from 'lucide-react';

export default function CategoryCard({ category }) {
  if (!category) return null;

  const isPredefined = Boolean(category.isPredefined || category.is_predefined);
  const color = category.color || '#3B82F6';
  const Icon = getCategoryIcon(category.icon);

  return (
    <div
      className="p-4 rounded-xl bg-[#0F172A] border border-[#1E293B] hover:border-[#334155] transition-colors flex items-center justify-between gap-3"
      data-testid={`category-card-${category.id || category.name}`}
    >
      <div className="flex items-center space-x-3.5 min-w-0">
        {/* Category Icon with Custom Color Accent */}
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 border transition-transform"
          style={{
            backgroundColor: `${color}18`,
            borderColor: `${color}40`,
            color: color
          }}
          aria-hidden="true"
        >
          <Icon className="w-5 h-5" />
        </div>

        {/* Category Name & Color Tag */}
        <div className="min-w-0 flex flex-col">
          <span className="text-sm font-semibold text-[#F8FAFC] truncate" title={category.name}>
            {category.name}
          </span>
          <div className="flex items-center space-x-2 mt-0.5">
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: color }}
              aria-hidden="true"
            />
            <span className="text-[11px] font-mono text-[#94A3B8] uppercase">
              {color}
            </span>
          </div>
        </div>
      </div>

      {/* Origin Badge (Predefined vs Custom) */}
      <div className="flex-shrink-0">
        {isPredefined ? (
          <span
            className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-[#1E293B] text-[#94A3B8] border border-[#334155]/40"
            title="System predefined default category"
          >
            <Shield className="w-3 h-3 text-[#94A3B8]" aria-hidden="true" />
            <span>Predefined</span>
          </span>
        ) : (
          <span
            className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-blue-600/15 text-blue-400 border border-blue-500/30"
            title="User custom created category"
          >
            <Sparkles className="w-3 h-3 text-blue-400" aria-hidden="true" />
            <span>Custom</span>
          </span>
        )}
      </div>
    </div>
  );
}
