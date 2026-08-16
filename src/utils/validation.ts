import * as yup from 'yup';

export const loginSchema = yup.object({
  username: yup
    .string()
    .required('Username is required')
    .min(3, 'Username must be at least 3 characters')
    .max(50, 'Username must be at most 50 characters'),
  password: yup
    .string()
    .required('Password is required')
    .min(6, 'Password must be at least 6 characters'),
});

export const registerSchema = yup.object({
  fullName: yup
    .string()
    .required('Full name is required')
    .min(2, 'Full name must be at least 2 characters')
    .max(100, 'Full name must be at most 100 characters'),
  email: yup
    .string()
    .required('Email is required')
    .email('Invalid email format'),
  phoneNumber: yup
    .string()
    .required('Phone number is required')
    .matches(/^[+\d\s\-()]{8,20}$/, 'Invalid phone number format'),
  password: yup
    .string()
    .required('Password is required')
    .min(8, 'Password must be at least 8 characters')
    .matches(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .matches(/[0-9]/, 'Password must contain at least one number'),
  retypePassword: yup
    .string()
    .required('Please retype your password')
    .oneOf([yup.ref('password')], 'Passwords must match'),
  role: yup
    .string()
    .required('Role is required')
    .oneOf(
      ['Researcher', 'Reviewer', 'Lecturer', 'Graduate Student'],
      'Invalid role'
    ),
  pdfUrl: yup
    .string()
    .required('Verification document is required'),
});

export type LoginFormData = yup.InferType<typeof loginSchema>;
export type RegisterFormData = yup.InferType<typeof registerSchema>;

// Reset Password schemas

export const forgotPasswordSchema = yup.object({
  email: yup
    .string()
    .required('Email is required')
    .email('Invalid email format'),
});

export const verifyOtpSchema = yup.object({
  otp: yup
    .string()
    .required('Verification code is required')
    .matches(/^\d{6}$/, 'Code must be exactly 6 digits'),
});

export const resetPasswordSchema = yup.object({
  newPassword: yup
    .string()
    .required('New password is required')
    .min(8, 'Password must be at least 8 characters')
    .matches(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .matches(/[0-9]/, 'Password must contain at least one number'),
  confirmPassword: yup
    .string()
    .required('Please confirm your password')
    .oneOf([yup.ref('newPassword')], 'Passwords must match'),
});

export type ForgotPasswordFormData = yup.InferType<typeof forgotPasswordSchema>;
export type VerifyOtpFormData = yup.InferType<typeof verifyOtpSchema>;
export type ResetPasswordFormData = yup.InferType<typeof resetPasswordSchema>;
