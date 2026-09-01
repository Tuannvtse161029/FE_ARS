import { useEffect, useRef } from 'react';

/**
 * useShortcuts — register global keyboard shortcuts on `document`.
 *
 * Design contract (Part 1 of the keyboard-shortcut rollout):
 *   - Listens on `keydown` at the document level, so shortcuts work from
 *     anywhere on the page without requiring focus on a specific element.
 *   - **Skips** when the active element is a text-entry surface (input,
 *     textarea, select, contenteditable). This prevents single-letter
 *     shortcuts like `n` (new) or `/` (search) from clobbering what the
 *     user is typing. Modifier-required shortcuts (Ctrl/Meta + key) still
 *     fire while typing — the modifier signals intent.
 *   - **Skips** when a modal is open (detected by the presence of
 *     `[role="dialog"]` anywhere in the DOM). This lets modals own the
 *     Escape key and any single-letter shortcuts that are in scope.
 *   - Returns nothing — registration is fire-and-forget, matching React's
 *     `useEffect` lifecycle so the binding auto-cleans on unmount.
 *
 * Future parts will register more shortcuts on top of this same hook.
 * The hook itself is stable; do not change its signature without a
 * plan across all callers.
 */

export type ShortcutHandler = (event: KeyboardEvent) => void;

export interface ShortcutSpec {
  /** Display label, e.g. "New". Shown in the help modal. */
  label: string;
  /** Optional group/category for the help modal ("Navigation", "List", etc.) */
  group?: string;
  /** Optional longer description for the help modal. */
  description?: string;
  /** Required modifier — Ctrl (Win/Linux) or Meta (Mac). Either triggers. */
  modifier?: 'mod';
  /** Single key (case-insensitive). Modifiers should NOT be in this string. */
  key: string;
  /** The action to invoke. */
  handler: ShortcutHandler;
  /**
   * If true, the handler runs even when focus is inside a text input.
   * Default false. Use for save-style shortcuts (Cmd+Enter) that should
   * work while a textarea has focus.
   */
  allowInInputs?: boolean;
}

const TEXT_INPUT_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

/** Returns true when the current focus target is a text-entry surface. */
const isTextInputFocused = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (TEXT_INPUT_TAGS.has(tag)) {
    // <input type="checkbox|radio|button|submit|reset|file|color|range|...>
    // are not text-entry surfaces and should not block shortcuts.
    if (tag === 'INPUT') {
      const type = (target as HTMLInputElement).type.toLowerCase();
      const textTypes = new Set([
        'text',
        'search',
        'email',
        'password',
        'tel',
        'url',
        'number',
        'date',
        'datetime-local',
        'month',
        'time',
        'week',
      ]);
      return textTypes.has(type);
    }
    return true;
  }
  if (target.isContentEditable) return true;
  return false;
};

/** Returns true when any open modal is currently mounted. */
const isModalOpen = (): boolean =>
  Boolean(document.querySelector('[role="dialog"]'));

/** True when the event's modifier (Ctrl on Win/Linux, Meta on Mac) is held. */
const hasMod = (event: KeyboardEvent): boolean =>
  event.ctrlKey || event.metaKey;

/**
 * Register one or more global keyboard shortcuts for the lifetime of the
 * calling component. Pass a new array each render to update bindings;
 * pass a stable array reference to avoid re-binding on every render.
 */
export const useShortcuts = (specs: ShortcutSpec[]): void => {
  // Keep the latest specs in a ref so the listener can read the most
  // recent closures without re-binding on every render.
  const specsRef = useRef(specs);
  specsRef.current = specs;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const specs = specsRef.current;
      if (specs.length === 0) return;

      // Modal-open guard: let the modal's own listeners win.
      const modalOpen = isModalOpen();
      const inInput = isTextInputFocused(event.target);

      for (const spec of specs) {
        // Modifier matching
        if (spec.modifier === 'mod' && !hasMod(event)) continue;
        if (spec.modifier !== 'mod' && hasMod(event)) continue;

        // Key matching (case-insensitive, ignores Shift state for letters)
        if (event.key.toLowerCase() !== spec.key.toLowerCase()) continue;

        // Input-focus guard — modifiers still allowed when set.
        if (inInput && !spec.allowInInputs && !spec.modifier) continue;

        // Modal guard — single-key shortcuts suppressed when a modal is
        // open so the modal owns Escape and its own bindings. `Enter` is
        // exempted when the spec is `allowInInputs` because save-style
        // shortcuts must work inside modals (e.g. comment edit save).
        if (modalOpen && !spec.modifier && spec.key !== 'Enter') continue;

        event.preventDefault();
        spec.handler(event);
        return;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);
};

export default useShortcuts;