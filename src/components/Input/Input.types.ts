import { InputHTMLAttributes, ReactNode } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
  /** When true, applies float-label animation — label floats up as a small
   *  pill above the field on focus/fill. Use the matching CSS class on the
   *  parent or the module's own float-label CSS to style the transition. */
  floatLabel?: boolean;
}

export interface InputRef {
  focus: () => void;
  blur: () => void;
}
