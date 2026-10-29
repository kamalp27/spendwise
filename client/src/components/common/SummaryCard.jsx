import React from 'react';

/**
 * Reusable Summary Card component for displaying financial metrics.
 * Designed to strictly represent honest, un-fabricated data or empty states.
 */
export default function SummaryCard({
  title,
  value,
  subtitle,
  icon: Icon,
  badge,
  status = 'neutral',
  helperText
}) {
  const isValueEmpty = value === undefined || value === null || value === '' || value === '—';

  return (
    <div className="bg-[#0F172A] border border-[#1E293B] rounded-xl p-5 flex flex-col justify-between hover:border-slate-700/80 transition-colors shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-[#94A3B8] tracking-wide uppercase">
          {title}
        </span>
        {Icon && (
          <div className="w-8 h-8 rounded-lg bg-blue-600/10 text-blue-400 flex items-center justify-center border border-blue-500/20">
            <Icon className="w-4 h-4" aria-hidden="true" />
          </div>
        )}
      </div>

      <div className="mt-3">
        <div className="flex items-baseline space-x-2">
          <span
            className={`text-2xl font-bold tracking-tight ${
              isValueEmpty ? 'text-slate-500' : 'text-[#F8FAFC]'
            }`}
          >
            {value ?? '—'}
          </span>
          {badge && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-[#1E293B] text-[#94A3B8]">
              {badge}
            </span>
          )}
        </div>

        {subtitle && (
          <p className="mt-1 text-xs text-[#94A3B8]">
            {subtitle}
          </p>
        )}
      </div>

      {helperText && (
        <div className="mt-3 pt-3 border-t border-[#1E293B]/70 text-[11px] text-[#94A3B8]">
          {helperText}
        </div>
      )}
    </div>
  );
}
