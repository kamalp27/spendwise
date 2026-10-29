import React from 'react';

/**
 * Reusable empty state component for honest, un-fabricated data representation.
 */
export default function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  className = ''
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center p-8 text-center rounded-xl bg-[#0B0F19]/60 border border-dashed border-[#1E293B] ${className}`}
    >
      {Icon && (
        <div className="w-12 h-12 rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-3 shadow-inner">
          <Icon className="w-6 h-6" aria-hidden="true" />
        </div>
      )}
      <h3 className="text-base font-semibold text-white tracking-tight">{title}</h3>
      {description && (
        <p className="mt-1 text-sm text-[#94A3B8] max-w-sm leading-relaxed">
          {description}
        </p>
      )}
      {actionLabel && (
        <button
          type="button"
          onClick={onAction}
          className="mt-4 inline-flex items-center space-x-2 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
        >
          <span>{actionLabel}</span>
        </button>
      )}
    </div>
  );
}
