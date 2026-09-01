import type { ShortcutSpec } from '../hooks/useShortcuts';

/**
 * ShortcutRegistry — single source of truth for all global keyboard
 * shortcuts in the ARS frontend.
 *
 * Pages register their shortcuts by adding entries here and wiring the
 * returned array through `useShortcuts`. The `KeyboardShortcutsHelp`
 * modal reads the same list to render the help table, so a new entry
 * lights up both the binding and the help row.
 *
 * Categories:
 *   - global          → always available in MainLayout (Part 1)
 *   - list            → row navigation across tables (Part 3+)
 *   - form            → form submit / cancel (Part 2+)
 *   - forum           → forum-specific (Part 4)
 *   - admin           → admin table actions (Part 5)
 *   - reviewer        → reviewer queue (Part 5)
 *
 * Each entry has a `key`, optional `modifier: 'mod'`, a `label` for the
 * help modal, an optional `group` for grouping in the help modal, and an
 * optional `description`. The actual handler is supplied by the page that
 * owns the shortcut — entries here describe the *spec*, not the action.
 * This keeps the help modal consistent regardless of who installs the
 * handler.
 */

export interface ShortcutEntry {
  /** Stable id used for the help modal's React `key`. */
  id: string;
  /** Group/category — drives the help modal section headers. */
  group: 'global' | 'list' | 'form' | 'forum' | 'admin' | 'reviewer';
  /** Display label, e.g. "New submission". */
  label: string;
  /** Optional longer explanation shown in the help modal. */
  description?: string;
  /** Key (case-insensitive). Modifiers must NOT be in this string. */
  key: string;
  /** Required modifier. `mod` resolves to Ctrl on Win/Linux, Meta on Mac. */
  modifier?: 'mod';
  /**
   * If true, the binding fires even when focus is inside a text input.
   * Used for save-style shortcuts that should always work.
   */
  allowInInputs?: boolean;
}

/** Catalogue of every shortcut the app supports. */
export const SHORTCUT_CATALOGUE: ShortcutEntry[] = [
  // ── Global (Part 1) ──────────────────────────────────────
  {
    id: 'global.help',
    group: 'global',
    label: 'Show keyboard shortcuts',
    description: 'Open this help dialog from anywhere on the page.',
    key: '?',
  },
  {
    id: 'global.search',
    group: 'global',
    label: 'Focus search',
    description: 'Move focus to the page-level search input.',
    key: '/',
  },
  {
    id: 'global.close',
    group: 'global',
    label: 'Close modal or overlay',
    key: 'Escape',
    allowInInputs: true,
  },
  // ── Form (Part 2) ─────────────────────────────────────────
  {
    id: 'form.submit',
    group: 'form',
    label: 'Submit form',
    description: 'Submit the current form (login, register, settings).',
    key: 'Enter',
    modifier: 'mod',
    allowInInputs: true,
  },
  {
    id: 'form.clear',
    group: 'form',
    label: 'Clear form',
    description: 'Reset all fields in the current form.',
    key: 'Escape',
    allowInInputs: true,
  },
  // ── List / Table navigation (Part 3) ───────────────────────
  {
    id: 'list.up',
    group: 'list',
    label: 'Previous row',
    description: 'Move keyboard focus to the row above.',
    key: 'j',
  },
  {
    id: 'list.down',
    group: 'list',
    label: 'Next row',
    description: 'Move keyboard focus to the row below.',
    key: 'k',
  },
  {
    id: 'list.open',
    group: 'list',
    label: 'Open item',
    description: 'Open or inspect the currently focused row.',
    key: 'Enter',
  },
  {
    id: 'list.new',
    group: 'list',
    label: 'New item',
    description: 'Open the create / new item form.',
    key: 'n',
  },
  {
    id: 'list.filter',
    group: 'list',
    label: 'Focus filter',
    description: 'Move focus to the search / filter bar.',
    key: 'f',
  },
  // ── Forum (Part 4) ───────────────────────────────────────
  {
    id: 'forum.list.up',
    group: 'forum',
    label: 'Previous post',
    description: 'Move focus to the post above in the feed.',
    key: 'j',
  },
  {
    id: 'forum.list.down',
    group: 'forum',
    label: 'Next post',
    description: 'Move focus to the post below in the feed.',
    key: 'k',
  },
  {
    id: 'forum.list.open',
    group: 'forum',
    label: 'Open post',
    description: 'Open or inspect the focused forum post.',
    key: 'Enter',
  },
  {
    id: 'forum.list.new',
    group: 'forum',
    label: 'New post',
    description: 'Open the "Create post" dialog.',
    key: 'n',
  },
  {
    id: 'forum.list.filter',
    group: 'forum',
    label: 'Focus filter',
    description: 'Move focus to the sidebar search input.',
    key: 'f',
  },
  {
    id: 'forum.create.submit',
    group: 'forum',
    label: 'Publish post',
    description: 'Publish the new forum post (works inside the textarea).',
    key: 'Enter',
    modifier: 'mod',
    allowInInputs: true,
  },
  {
    id: 'forum.reply.submit',
    group: 'forum',
    label: 'Post comment',
    description: 'Submit the comment reply (works inside the reply textarea).',
    key: 'Enter',
    modifier: 'mod',
    allowInInputs: true,
  },
  {
    id: 'forum.edit.submit',
    group: 'forum',
    label: 'Save edit',
    description: 'Save the comment edit.',
    key: 'Enter',
    allowInInputs: true,
  },
  // ── Admin (Part 5) ──────────────────────────────────────
  {
    id: 'admin.list.up',
    group: 'admin',
    label: 'Previous row',
    description: 'Move focus to the row above.',
    key: 'j',
  },
  {
    id: 'admin.list.down',
    group: 'admin',
    label: 'Next row',
    description: 'Move focus to the row below.',
    key: 'k',
  },
  {
    id: 'admin.list.open',
    group: 'admin',
    label: 'Open editorial record',
    description: 'Open the full editorial record for the focused row.',
    key: 'Enter',
  },
  {
    id: 'admin.list.filter',
    group: 'admin',
    label: 'Focus filter',
    description: 'Move focus to the search / filter toolbar.',
    key: 'f',
  },
  {
    id: 'admin.approve',
    group: 'admin',
    label: 'Approve paper',
    description: 'Approve the focused submission (opens approval confirmation).',
    key: 'a',
  },
  {
    id: 'admin.deny',
    group: 'admin',
    label: 'Deny paper',
    description: 'Deny the focused submission (opens rejection form).',
    key: 'd',
  },
  {
    id: 'admin.reject',
    group: 'admin',
    label: 'Reject paper',
    description: 'Reject the focused submission outright.',
    key: 'r',
  },
  {
    id: 'admin.export',
    group: 'admin',
    label: 'Export CSV',
    description: 'Export the current filtered list as a CSV file.',
    key: 'x',
  },
  // ── Reviewer (Part 5) ────────────────────────────────────
  {
    id: 'reviewer.list.up',
    group: 'reviewer',
    label: 'Previous assignment',
    description: 'Move focus to the assignment above.',
    key: 'j',
  },
  {
    id: 'reviewer.list.down',
    group: 'reviewer',
    label: 'Next assignment',
    description: 'Move focus to the assignment below.',
    key: 'k',
  },
  {
    id: 'reviewer.list.open',
    group: 'reviewer',
    label: 'Open assignment',
    description: 'Open the full assignment detail view.',
    key: 'Enter',
  },
  {
    id: 'reviewer.accept',
    group: 'reviewer',
    label: 'Accept assignment',
    description: 'Accept the focused review assignment.',
    key: 'a',
  },
  {
    id: 'reviewer.decline',
    group: 'reviewer',
    label: 'Decline assignment',
    description: 'Decline the focused review assignment.',
    key: 'd',
  },
  {
    id: 'reviewer.submit',
    group: 'reviewer',
    label: 'Submit evaluation',
    description: 'Submit the paper evaluation (works inside the form).',
    key: 'Enter',
    modifier: 'mod',
    allowInInputs: true,
  },
];

/**
 * Format a shortcut for display in the help modal. Returns an array of
 * "chips" the renderer can lay out side-by-side, e.g.
 *   ['Ctrl', '+', 'Enter']   →  "Ctrl + Enter"
 *   ['?']                    →  "?"
 *   ['Mod', '+', '/']        →  "Mod + /"
 *
 * `Mod` is shown instead of "Ctrl/Cmd" so the same string renders
 * correctly regardless of platform — users mentally translate "Mod" to
 * their platform's modifier.
 */
export const formatShortcut = (entry: ShortcutEntry): string[] => {
  const chips: string[] = [];
  if (entry.modifier === 'mod') chips.push('Mod');
  chips.push(prettyKey(entry.key));
  return chips;
};

const prettyKey = (key: string): string => {
  switch (key) {
    case ' ':
      return 'Space';
    case 'Escape':
      return 'Esc';
    case 'ArrowUp':
      return '↑';
    case 'ArrowDown':
      return '↓';
    case 'ArrowLeft':
      return '←';
    case 'ArrowRight':
      return '→';
    case 'Enter':
      return '↵';
    default:
      return key;
  }
};

/**
 * Convert the catalogue into ShortcutSpec[] suitable for `useShortcuts`.
 * Pages that want to install a binding merge their own handlers into
 * the result via `mergeSpecs`. Until Part 2 lands, no live bindings
 * are installed — only the catalogue and the help modal are wired.
 */
export const catalogueAsSpecs = (
  handlers: Partial<Record<string, ShortcutSpec['handler']>> = {},
  overrides: Partial<Record<string, Omit<ShortcutSpec, 'handler' | 'key' | 'modifier'>>> = {},
): ShortcutSpec[] =>
  SHORTCUT_CATALOGUE.filter((entry) => handlers[entry.id]).map((entry) => {
    const handler = handlers[entry.id];
    const override = overrides[entry.id] ?? {};
    return {
      label: entry.label,
      group: entry.group,
      description: entry.description,
      key: entry.key,
      modifier: entry.modifier,
      allowInInputs: entry.allowInInputs,
      handler: handler as ShortcutSpec['handler'],
      ...override,
    };
  });

/** Group catalogue entries by their `group` for the help modal layout. */
export const groupCatalogue = (
  entries: ShortcutEntry[],
): Record<string, ShortcutEntry[]> =>
  entries.reduce<Record<string, ShortcutEntry[]>>((acc, entry) => {
    const bucket = acc[entry.group] ?? [];
    bucket.push(entry);
    acc[entry.group] = bucket;
    return acc;
  }, {});

/** Human-readable group titles for the help modal section headers. */
export const GROUP_TITLES: Record<ShortcutEntry['group'], string> = {
  global: 'Global',
  list: 'Lists & Tables',
  form: 'Forms',
  forum: 'Forum',
  admin: 'Admin',
  reviewer: 'Reviewer',
};