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
import { GoogleIcon } from '../../assets/icons/GoogleIcon';
import { Eye, EyeOff } from 'lucide-react';

const FAST_LOGIN_USERS = [
  { label: 'Researcher', email: 'researcher@arsplatform.com', password: 'Researcher1234' },
  { label: 'Reviewer', email: 'reviewer1.ars@arsplatform.test', password: 'Reviewer1234' },
  { label: 'Admin', email: 'admin@arsplatform.com', password: 'Password123' },
  { label: 'Lecturer', email: 'lecturer@arsplatform.com', password: 'Lecturer1234' },
  { label: 'Grad Student', email: 'gradstudent@arsplatform.com', password: 'Student1234' },
] as const;

const Login = () => {
  const { login, isLoading, error } = useAuth();
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    control,
    handleSubmit,
    setValue,
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

  const handleFastLogin = (email: string, password: string) => {
    setValue('username', email);
    setValue('password', password);
  };

  const handleGoogleSignIn = () => {
    console.log('Sign in with Google');
  };

  return (
    <div className={styles.loginPage}>
      <div className={styles.logoSection}>
        <img src={ARSLogo} alt="ARS Logo" className={styles.logoImage} />
        <span className={styles.brandText}>Academic Research Sharing</span>
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
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
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

        <div className={styles.devDivider}>
          <span className={styles.devDividerLine} />
          <span className={styles.devDividerText}>Dev only</span>
          <span className={styles.devDividerLine} />
        </div>

        <div className={styles.fastLoginGrid}>
          {FAST_LOGIN_USERS.map((user) => (
            <button
              key={user.label}
              type="button"
              className={styles.fastLoginBtn}
              onClick={() => handleFastLogin(user.email, user.password)}
              disabled={isLoading}
            >
              {user.label}
            </button>
          ))}
        </div>

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
