import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import {
  GROUP_TITLES,
  formatShortcut,
  groupCatalogue,
  shortcutsForRole,
  type ShortcutEntry,
} from '../../utils/shortcutRegistry';
import type { UserRole } from '../../types/auth';
import styles from './KeyboardShortcutsHelp.module.css';

interface Props {
  open: boolean;
  onClose: () => void;
  /**
   * Active authenticated role. The modal renders ONLY the shortcuts
   * permitted for that role — Admin shortcuts stay out of a Lecturer's
   * view, Reviewer shortcuts stay out of an Admin's view, etc. Passing
   * `null`/`undefined` falls back to global-only shortcuts so the modal
   * stays safe during the brief unauthenticated window.
   *
   * The route guards and BE authorization remain authoritative — this
   * filter is purely UX defense in depth.
   */
  role: UserRole | null | undefined;
}

/**
 * KeyboardShortcutsHelp — modal that lists every keyboard shortcut the
 * ARS frontend supports, grouped by category.
 *
 * The modal is opened by the `?` shortcut (registered globally in
 * MainLayout) or by the "?" button in the header. The catalogue lives
 * in `src/utils/shortcutRegistry.ts` so adding a shortcut anywhere in
 * the app also adds its row here automatically.
 *
 * Accessibility:
 *   - role="dialog" so the global useShortcuts hook yields focus to this
 *     modal's bindings (Escape closes).
 *   - Focus is moved to the close button on open and restored on close
 *     so screen-reader users land in a known spot.
 *   - The shortcuts are presented as a definition list, not a table, so
 *     the structure survives responsive layouts.
 *
 * Role gating: the parent MUST pass the active role. With no role we
 * show only global shortcuts so the modal cannot accidentally advertise
 * a privileged command to the wrong audience.
 */
export const KeyboardShortcutsHelp = ({ open, onClose, role }: Props) => {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const visibleEntries = shortcutsForRole(role);
  const grouped = groupCatalogue(visibleEntries);
  const orderedGroups: ShortcutEntry['group'][] = [
    'global',
    'list',
    'form',
    'forum',
    'admin',
    'reviewer',
  ];

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className={styles.modal}>
        <header className={styles.header}>
          <div>
            <h2 id="shortcuts-title" className={styles.title}>
              Keyboard shortcuts
            </h2>
            <p className={styles.subtitle}>
              Power-user bindings available throughout the app. Press
              <kbd className={styles.inlineKbd}>?</kbd> anytime to reopen
              this dialog.
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            className={styles.iconButton}
            aria-label="Close keyboard shortcuts dialog"
            onClick={onClose}
          >
            <X size={16} aria-hidden />
          </button>
        </header>

        <div className={styles.body}>
          {orderedGroups.map((group) => {
            const entries = grouped[group];
            if (!entries || entries.length === 0) return null;
            return (
              <section className={styles.section} key={group}>
                <h3 className={styles.sectionTitle}>{GROUP_TITLES[group]}</h3>
                <dl className={styles.list}>
                  {entries.map((entry) => (
                    <div className={styles.row} key={entry.id}>
                      <dt className={styles.rowLabel}>
                        <span className={styles.rowLabelText}>
                          {entry.label}
                        </span>
                        {entry.description ? (
                          <span className={styles.rowDescription}>
                            {entry.description}
                          </span>
                        ) : null}
                      </dt>
                      <dd className={styles.rowShortcut}>
                        {formatShortcut(entry).map((chip, i) => (
                          <span className={styles.chips} key={`${entry.id}-${i}`}>
                            {i > 0 ? <span className={styles.plus}>+</span> : null}
                            <kbd className={styles.kbd}>{chip}</kbd>
                          </span>
                        ))}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            );
          })}
        </div>

        <footer className={styles.footer}>
          <p className={styles.footerNote}>
            <kbd className={styles.inlineKbd}>Mod</kbd> is
            <kbd className={styles.inlineKbd}>Ctrl</kbd> on Windows / Linux
            and <kbd className={styles.inlineKbd}>⌘</kbd> on macOS.
          </p>
          <button type="button" className={styles.closeButton} onClick={onClose}>
            Close
          </button>
        </footer>
      </div>
    </div>
  );
};

export default KeyboardShortcutsHelp;
