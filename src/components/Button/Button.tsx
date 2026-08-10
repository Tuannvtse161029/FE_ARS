import { ButtonProps } from './Button.types';
import styles from './Button.module.css';

export const Button = ({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  children,
  disabled,
  className = '',
  ...props
}: ButtonProps) => {
  const classNames = [
    styles.button,
    styles[`button--${variant}`],
    styles[`button--${size}`],
    fullWidth ? styles['button--fullWidth'] : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      className={classNames}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && <span className={styles.button__spinner} />}
      {!isLoading && leftIcon && <span className={styles.button__icon}>{leftIcon}</span>}
      {children}
      {!isLoading && rightIcon && <span className={styles.button__icon}>{rightIcon}</span>}
    </button>
  );
};

export default Button;
