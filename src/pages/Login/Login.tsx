import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { useAuth } from '../../context/AuthContext';
import { loginSchema, type LoginFormData } from '../../utils/validation';
import { ROUTES } from '../../utils/constants';
import styles from './Login.module.css';
import ARSLogo from '../../assets/images/ARS_Logo.png';

const GoogleIcon = () => (
  <svg className={styles.googleIcon} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

const EyeIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
);

const EyeOffIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
);

const Login = () => {
  const { login, isLoading, error } = useAuth();
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: yupResolver(loginSchema),
    defaultValues: {
      username: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    await login(data);
  };

  const handleGoogleSignIn = () => {
    console.log('Sign in with Google');
  };

  return (
    <div className={styles.loginPage}>
      <div className={styles.logoHeader}>
        <div className={styles.logoWrapper}>
          <img src={ARSLogo} alt="ARS Logo" className={styles.logoImage} />
        </div>
        <span className={styles.brandText}>ARS - Academic Research Sharing</span>
      </div>

      <div className={styles.header}>
        <h1 className={styles.title}>Nice to see you again</h1>
      </div>

      <form className={styles.form} onSubmit={handleSubmit(onSubmit)}>
        {error && (
          <div className={styles.formError} role="alert">
            {error}
          </div>
        )}

        <Controller
          name="username"
          control={control}
          render={({ field }) => (
            <Input
              {...field}
              label="Login"
              placeholder="Email or phone number"
              error={errors.username?.message}
              autoComplete="email"
              disabled={isLoading}
              className={styles.loginInput}
            />
          )}
        />

        <div className={styles.passwordFieldWrapper}>
          <Controller
            name="password"
            control={control}
            render={({ field }) => (
              <Input
                {...field}
                type={showPassword ? 'text' : 'password'}
                label="Password"
                placeholder="Enter password"
                error={errors.password?.message}
                autoComplete="current-password"
                disabled={isLoading}
                className={styles.loginInput}
                rightIcon={
                  <button
                    type="button"
                    className={styles.passwordToggle}
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                }
              />
            )}
          />
        </div>

        <div className={styles.rememberRow}>
          <label className={styles.toggleWrapper}>
            <input
              type="checkbox"
              className={styles.toggleInput}
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
            />
            <span className={styles.toggleSlider}></span>
            <span className={styles.toggleLabel}>Remember me</span>
          </label>
          <Link to={ROUTES.FORGOT_PASSWORD} className={styles.forgotLink}>
            Forgot password?
          </Link>
        </div>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          fullWidth
          isLoading={isLoading}
          className={styles.submitButton}
        >
          Sign in
        </Button>

        <Button
          type="button"
          variant="outline"
          size="lg"
          fullWidth
          onClick={handleGoogleSignIn}
          disabled={isLoading}
          className={styles.googleButton}
        >
          <GoogleIcon />
          <span>Or sign in with Google</span>
        </Button>

        <div className={styles.footer}>
          <p className={styles.footerText}>
            Dont have an account?{' '}
            <Link to={ROUTES.REGISTER} className={styles.registerLink}>
              Sign up now
            </Link>
          </p>
        </div>
      </form>
    </div>
  );
};

export default Login;
