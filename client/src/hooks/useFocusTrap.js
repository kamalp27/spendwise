import { useEffect, useRef } from 'react';

const FOCUSABLE_ELEMENTS_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])';

function isElementVisible(el) {
  if (el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0) {
    return true;
  }
  // In environments without layout engine (e.g. jsdom in automated tests), fall back to style checks
  if (typeof window !== 'undefined' && window.getComputedStyle) {
    const style = window.getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden';
  }
  return true;
}

function getFocusableElements(container) {
  if (!container) return [];
  return Array.from(
    container.querySelectorAll(FOCUSABLE_ELEMENTS_SELECTOR)
  ).filter(isElementVisible);
}

/**
 * Custom React hook for accessible focus management inside modal dialogs.
 * Traps Tab / Shift+Tab within the dialog container, sets initial focus,
 * handles Escape dismissal, and restores focus to the triggering element on close.
 *
 * @param {Object} options
 * @param {boolean} options.isOpen - Whether the modal is open.
 * @param {Function} options.onClose - Callback triggered on Escape.
 * @param {React.RefObject<HTMLElement>} options.containerRef - Ref to the dialog container.
 * @param {React.RefObject<HTMLElement>} [options.initialFocusRef] - Optional element to receive initial focus.
 */
export function useFocusTrap({
  isOpen,
  onClose,
  containerRef,
  initialFocusRef
}) {
  const previousActiveElementRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    // 1. Capture previously focused element before modal takes over
    if (document.activeElement && typeof document.activeElement.focus === 'function') {
      previousActiveElementRef.current = document.activeElement;
    }

    const container = containerRef?.current;
    if (!container) return;

    // 2. Set initial focus
    // Prefer explicit initialFocusRef, otherwise find the first focusable element inside the modal
    const focusableNodes = getFocusableElements(container);

    const targetElement = initialFocusRef?.current || focusableNodes[0];

    const rafId = requestAnimationFrame(() => {
      if (targetElement && typeof targetElement.focus === 'function') {
        targetElement.focus();
      }
    });

    // 3. Trap keyboard navigation inside container
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose?.();
        return;
      }

      if (event.key === 'Tab') {
        const currentFocusables = getFocusableElements(container);

        if (currentFocusables.length === 0) {
          event.preventDefault();
          return;
        }

        const firstNode = currentFocusables[0];
        const lastNode = currentFocusables[currentFocusables.length - 1];

        if (event.shiftKey) {
          // Backward tab: if on first element or focus is outside modal, jump to last
          if (document.activeElement === firstNode || !container.contains(document.activeElement)) {
            event.preventDefault();
            lastNode.focus();
          }
        } else {
          // Forward tab: if on last element or focus is outside modal, jump to first
          if (document.activeElement === lastNode || !container.contains(document.activeElement)) {
            event.preventDefault();
            firstNode.focus();
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown, true);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('keydown', handleKeyDown, true);

      // 4. Safely restore focus to previous element if it still exists in the document
      const prevElement = previousActiveElementRef.current;
      if (
        prevElement &&
        typeof prevElement.focus === 'function' &&
        document.contains(prevElement)
      ) {
        requestAnimationFrame(() => {
          try {
            prevElement.focus();
          } catch (_) {}
        });
      }
    };
  }, [isOpen, onClose, containerRef, initialFocusRef]);
}
