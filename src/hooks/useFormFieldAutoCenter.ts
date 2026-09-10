import { useEffect } from 'react';

/**
 * Programmatically scrolls an element into the vertical center of the
 * viewport or nearest scrollable container with smooth animation.
 */
export const centerElementInView = (
  element: HTMLElement | null,
  options?: { force?: boolean },
): void => {
  if (!element || typeof window === 'undefined') return;

  const rect = element.getBoundingClientRect();
  const vh = window.innerHeight || document.documentElement.clientHeight;

  // Check if center of element is outside the comfortable middle band (25% to 75%)
  const elementCenter = rect.top + rect.height / 2;
  const isOutsideComfortZone =
    elementCenter < vh * 0.25 || elementCenter > vh * 0.75;

  if (options?.force || isOutsideComfortZone) {
    try {
      element.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest',
      });
    } catch {
      element.scrollIntoView(true);
    }
  }
};

/**
 * Global enhancer that monitors clicks and focus events on form fields,
 * ensuring they smoothly glide to the center of the screen when clicked
 * rather than forcing the user to scroll manually.
 */
export const useFormFieldAutoCenter = (): void => {
  useEffect(() => {
    if (typeof document === 'undefined') return;

    let lastScrolledElement: EventTarget | null = null;
    let scrollTimeout: ReturnType<typeof setTimeout> | null = null;

    const handleFocusOrClick = (event: Event) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      // Check if target is a form field or interactive input
      const isInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT';

      const isFormField =
        isInput ||
        target.hasAttribute('data-form-field') ||
        target.getAttribute('role') === 'combobox' ||
        target.classList.contains('formInput') ||
        target.classList.contains('formSelect') ||
        target.classList.contains('formTextarea');

      // Skip non-form elements or buttons (buttons handle their own click actions)
      if (!isFormField) return;

      // Avoid double-triggering for the same element in rapid succession (e.g. click then focus)
      if (lastScrolledElement === target) return;
      lastScrolledElement = target;

      if (scrollTimeout) clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        lastScrolledElement = null;
      }, 600);

      // Delay slightly to let virtual keyboard or layout reflow settle
      requestAnimationFrame(() => {
        centerElementInView(target);
      });
    };

    // Listen for form validation error (invalid event)
    const handleInvalid = (event: Event) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      requestAnimationFrame(() => {
        centerElementInView(target, { force: true });
      });
    };

    // Use capture phase to catch focus and click events across shadow DOM / portals
    document.addEventListener('focusin', handleFocusOrClick, { capture: true, passive: true });
    document.addEventListener('click', handleFocusOrClick, { capture: true, passive: true });
    document.addEventListener('invalid', handleInvalid, { capture: true, passive: true });

    return () => {
      document.removeEventListener('focusin', handleFocusOrClick, { capture: true });
      document.removeEventListener('click', handleFocusOrClick, { capture: true });
      document.removeEventListener('invalid', handleInvalid, { capture: true });
      if (scrollTimeout) clearTimeout(scrollTimeout);
    };
  }, []);
};
