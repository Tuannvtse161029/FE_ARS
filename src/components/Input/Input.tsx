import { forwardRef } from 'react';
import { InputProps } from './Input.types';
import styles from './Input.module.css';

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helperText,
      leftIcon,
      rightIcon,
      fullWidth = true,
      required,
      className = '',
      floatLabel,
      id,
      ...props
    },
    ref
  ) => {
    const inputId = id || `input-${label?.toLowerCase().replace(/\s+/g, '-')}`;
    const hasLeftIcon = !!leftIcon;
    const hasRightIcon = !!rightIcon;

    const inputClasses = [
      styles.input,
      hasLeftIcon ? styles['input--withLeftIcon'] : '',
      hasRightIcon ? styles['input--withRightIcon'] : '',
      error ? styles['input--error'] : '',
      className,
    ]
      .filter(Boolean)
      .join(' ');

    const wrapperClasses = [
      styles.inputWrapper,
      fullWidth ? styles['inputWrapper--fullWidth'] : '',
      floatLabel ? styles['inputWrapper--floatLabel'] : '',
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <div className={wrapperClasses}>
        {label && (
          <label htmlFor={inputId} className={styles.label}>
            {label}
            {required && (
              <span className={styles.labelAsterisk} aria-hidden="true">
                {' '}
                *
              </span>
            )}
          </label>
        )}
        <div className={styles.inputContainer}>
          {hasLeftIcon && (
            <span className={`${styles.inputIcon} ${styles['inputIcon--left']}`}>
              {leftIcon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={inputClasses}
            required={required}
            aria-invalid={error ? 'true' : undefined}
            {...props}
          />
          {hasRightIcon && (
            <span className={`${styles.inputIcon} ${styles['inputIcon--right']}`}>
              {rightIcon}
            </span>
          )}
        </div>
        {error && <span className={styles.errorText}>{error}</span>}
        {!error && helperText && (
          <span className={styles.helperText}>{helperText}</span>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;
