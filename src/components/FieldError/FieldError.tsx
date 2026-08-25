import type { CSSProperties } from 'react';
import styles from './FieldError.module.css';

export interface FieldErrorProps {
  /** Stable id used for `aria-describedby` on the input. */
  id?: string;
  /** The error message to render. Renders nothing when null/empty. */
  message?: string | null;
  /**
   * Optional inline style overrides. Use sparingly; the default styling
   * (red text, small font, 4px gap above) matches the existing pages.
   */
  style?: CSSProperties;
  /** Optional test id for vitest assertions. */
  testId?: string;
}

/**
 * Inline, accessible field-level error message.
 *
 *  - Uses `role="alert"` + `aria-live="polite"` so screen readers announce
 *    the message without stealing focus.
 *  - Owns its own `id` so the parent input can wire `aria-describedby`.
 *  - Renders nothing when the message is empty — that lets callers drop it
 *    under every input unconditionally.
 */
export const FieldError = ({
  id,
  message,
  style,
  testId,
}: FieldErrorProps): JSX.Element | null => {
  if (!message) return null;
  return (
    <p
      id={id}
      role="alert"
      aria-live="polite"
      data-testid={testId}
      className={styles.error}
      style={style}
    >
      {message}
    </p>
  );
};

export default FieldError;