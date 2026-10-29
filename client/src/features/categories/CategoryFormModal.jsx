import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Plus,
  AlertCircle,
  Loader2,
  Check,
  Sparkles,
  Tag
} from 'lucide-react';
import { useFocusTrap } from '../../hooks/useFocusTrap.js';
import {
  AVAILABLE_CATEGORY_ICONS,
  AVAILABLE_CATEGORY_COLORS,
  getCategoryIcon
} from './categoryIcons.jsx';

const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;

export default function CategoryFormModal({
  isOpen,
  onSave,
  onClose
}) {
  const modalContainerRef = useRef(null);
  const nameInputRef = useRef(null);

  // Accessible Focus Trap & Escape Key Listener
  useFocusTrap({
    isOpen,
    onClose,
    containerRef: modalContainerRef,
    initialFocusRef: nameInputRef
  });

  // Form Fields State
  const [name, setName] = useState('');
  const [color, setColor] = useState('#3B82F6');
  const [icon, setIcon] = useState('tag');

  // Validation & Submission State
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setName('');
      setColor('#3B82F6');
      setIcon('tag');
      setErrors({});
      setTouched({});
      setIsSubmitting(false);
      setSubmitError(null);
    }
  }, [isOpen]);

  // Client-side field validation
  function validate(fieldName, value) {
    switch (fieldName) {
      case 'name': {
        const trimmed = (value || '').trim();
        if (!trimmed) {
          return 'Category name is required.';
        }
        if (trimmed.length > 50) {
          return 'Category name cannot exceed 50 characters.';
        }
        return null;
      }
      case 'color': {
        const val = (value || '').trim();
        if (!val) {
          return 'Color is required.';
        }
        if (!HEX_COLOR_REGEX.test(val)) {
          return 'Color must be a valid 6-digit hex code (e.g. #3B82F6).';
        }
        return null;
      }
      default:
        return null;
    }
  }

  function handleNameChange(e) {
    const val = e.target.value;
    setName(val);
    if (submitError) setSubmitError(null);
    if (touched.name) {
      const err = validate('name', val);
      setErrors((prev) => ({ ...prev, name: err }));
    }
  }

  function handleNameBlur() {
    setTouched((prev) => ({ ...prev, name: true }));
    const err = validate('name', name);
    setErrors((prev) => ({ ...prev, name: err }));
  }

  function handleColorSelect(hex) {
    setColor(hex);
    if (submitError) setSubmitError(null);
    if (touched.color) {
      setErrors((prev) => ({ ...prev, color: null }));
    }
  }

  function handleCustomColorChange(e) {
    const val = e.target.value;
    setColor(val);
    if (submitError) setSubmitError(null);
    if (touched.color) {
      const err = validate('color', val);
      setErrors((prev) => ({ ...prev, color: err }));
    }
  }

  function handleCustomColorBlur() {
    setTouched((prev) => ({ ...prev, color: true }));
    const err = validate('color', color);
    setErrors((prev) => ({ ...prev, color: err }));
  }

  function handleIconSelect(iconId) {
    setIcon(iconId);
    if (submitError) setSubmitError(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();

    // Mark fields as touched
    setTouched({ name: true, color: true });

    const nameErr = validate('name', name);
    const colorErr = validate('color', color);

    if (nameErr || colorErr) {
      setErrors({ name: nameErr, color: colorErr });
      if (nameErr && nameInputRef.current) {
        nameInputRef.current.focus();
      }
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      await onSave({
        name: name.trim(),
        color: color.trim().toUpperCase(),
        icon: icon.trim()
      });
      // On success, close modal
      onClose();
    } catch (err) {
      // Preserve inputs and display API validation / conflict message
      const msg = err.message || 'Failed to create category. Please check your connection and try again.';
      setSubmitError(msg);
      setIsSubmitting(false);
    }
  }

  if (!isOpen) return null;

  const PreviewIcon = getCategoryIcon(icon);
  const isValidColor = HEX_COLOR_REGEX.test(color);
  const safeColor = isValidColor ? color : '#3B82F6';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="category-modal-title"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
        onClick={() => !isSubmitting && onClose()}
        aria-hidden="true"
      />

      {/* Modal Dialog Box */}
      <div
        ref={modalContainerRef}
        className="relative w-full max-w-lg rounded-xl bg-[#0F172A] border border-[#1E293B] shadow-2xl z-10 flex flex-col my-8 max-h-[90vh] overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#1E293B]">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600/10 text-blue-400 flex items-center justify-center border border-blue-500/20">
              <Sparkles className="w-4 h-4" aria-hidden="true" />
            </div>
            <div>
              <h2 id="category-modal-title" className="text-base font-semibold text-white">
                New Custom Category
              </h2>
              <p className="text-xs text-[#94A3B8]">
                Create a personalized category for transaction tracking
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close dialog"
            className="p-1 rounded-lg text-[#94A3B8] hover:text-white hover:bg-[#1E293B] focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 disabled:opacity-50"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-5 space-y-5">
          {/* Server Error Alert Banner */}
          {submitError && (
            <div
              role="alert"
              className="p-3.5 rounded-lg bg-red-600/10 border border-red-500/20 text-red-400 text-xs flex items-start space-x-2"
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
              <div className="flex-1">
                <span className="font-semibold">Unable to create category:</span> {submitError}
              </div>
            </div>
          )}

          {/* Category Preview Card */}
          <div>
            <span className="block text-xs font-semibold text-slate-300 mb-2">
              Live Preview
            </span>
            <div className="p-3.5 rounded-xl bg-[#0B0F19] border border-[#1E293B] flex items-center justify-between gap-3">
              <div className="flex items-center space-x-3 min-w-0">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center border flex-shrink-0"
                  style={{
                    backgroundColor: `${safeColor}20`,
                    borderColor: `${safeColor}50`,
                    color: safeColor
                  }}
                  aria-hidden="true"
                >
                  <PreviewIcon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <span className="text-sm font-semibold text-white truncate block">
                    {name.trim() || 'Category Name'}
                  </span>
                  <span className="text-[11px] font-mono text-[#94A3B8] uppercase">
                    {safeColor} &bull; {icon}
                  </span>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-600/15 text-blue-400 border border-blue-500/30">
                Custom
              </span>
            </div>
          </div>

          {/* Category Name Input */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label
                htmlFor="category-name-input"
                className="text-xs font-semibold text-slate-200"
              >
                Category Name <span className="text-red-400">*</span>
              </label>
              <span className="text-[10px] text-[#94A3B8]">
                {name.length}/50
              </span>
            </div>
            <input
              ref={nameInputRef}
              id="category-name-input"
              type="text"
              value={name}
              maxLength={50}
              placeholder="e.g., Freelance, Gym & Fitness, Investments"
              onChange={handleNameChange}
              onBlur={handleNameBlur}
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? 'category-name-error' : undefined}
              className={`w-full px-3 py-2 rounded-lg bg-[#0B0F19] border text-sm text-white placeholder-slate-500 transition-colors focus-visible:outline focus-visible:outline-2 ${
                errors.name
                  ? 'border-red-500 focus-visible:outline-red-500'
                  : 'border-[#1E293B] focus-visible:outline-blue-500'
              }`}
            />
            {errors.name && (
              <p id="category-name-error" className="mt-1 text-xs text-red-400 flex items-center space-x-1">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
                <span>{errors.name}</span>
              </p>
            )}
          </div>

          {/* Color Selection */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-200">
                Category Color <span className="text-red-400">*</span>
              </label>
              <div className="flex items-center space-x-1.5">
                <span
                  className="w-3.5 h-3.5 rounded-full border border-slate-700"
                  style={{ backgroundColor: safeColor }}
                  aria-hidden="true"
                />
                <span className="text-[11px] font-mono text-[#94A3B8] uppercase">
                  {safeColor}
                </span>
              </div>
            </div>

            {/* Curated Swatch Palette */}
            <div
              className="grid grid-cols-6 sm:grid-cols-11 gap-2 p-2 rounded-lg bg-[#0B0F19] border border-[#1E293B]"
              role="radiogroup"
              aria-label="Select category color"
            >
              {AVAILABLE_CATEGORY_COLORS.map((c) => {
                const isSelected = color.toUpperCase() === c.hex.toUpperCase();
                return (
                  <button
                    key={c.hex}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    aria-label={`Select color ${c.name} (${c.hex})`}
                    onClick={() => handleColorSelect(c.hex)}
                    className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-white ${
                      isSelected
                        ? 'ring-2 ring-white scale-110 shadow-md'
                        : 'hover:scale-105 opacity-80 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: c.hex }}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5 text-white drop-shadow" aria-hidden="true" />}
                  </button>
                );
              })}
            </div>

            {/* Custom Hex Color Input */}
            <div className="mt-2 flex items-center space-x-2">
              <label htmlFor="custom-hex-input" className="text-[11px] text-[#94A3B8] whitespace-nowrap">
                Custom Hex:
              </label>
              <input
                id="custom-hex-input"
                type="text"
                value={color}
                maxLength={7}
                placeholder="#3B82F6"
                onChange={handleCustomColorChange}
                onBlur={handleCustomColorBlur}
                aria-label="Custom hex color code"
                aria-invalid={Boolean(errors.color)}
                className={`w-28 px-2 py-1 rounded bg-[#0B0F19] border text-xs text-white font-mono uppercase focus-visible:outline focus-visible:outline-2 ${
                  errors.color
                    ? 'border-red-500 focus-visible:outline-red-500'
                    : 'border-[#1E293B] focus-visible:outline-blue-500'
                }`}
              />
            </div>
            {errors.color && (
              <p className="mt-1 text-xs text-red-400 flex items-center space-x-1">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
                <span>{errors.color}</span>
              </p>
            )}
          </div>

          {/* Icon Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-200 mb-1.5">
              Select Icon
            </label>
            <div
              className="grid grid-cols-4 sm:grid-cols-8 gap-2 p-2 rounded-lg bg-[#0B0F19] border border-[#1E293B] max-h-36 overflow-y-auto"
              role="radiogroup"
              aria-label="Select category icon"
            >
              {AVAILABLE_CATEGORY_ICONS.map((opt) => {
                const IconComp = opt.icon;
                const isSelected = icon === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    aria-label={`Select ${opt.label} icon`}
                    onClick={() => handleIconSelect(opt.id)}
                    className={`flex flex-col items-center justify-center p-2 rounded-lg border text-xs transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 ${
                      isSelected
                        ? 'bg-blue-600/20 border-blue-500 text-white'
                        : 'border-transparent text-[#94A3B8] hover:text-white hover:bg-[#1E293B]/60'
                    }`}
                  >
                    <IconComp className="w-4 h-4 mb-1" aria-hidden="true" />
                    <span className="text-[10px] leading-none truncate max-w-full">
                      {opt.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-[#1E293B]">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg border border-[#1E293B] bg-[#0F172A] hover:bg-[#1E293B] text-slate-300 text-xs font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center space-x-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                  <span>Creating Category...</span>
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Create Category</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
