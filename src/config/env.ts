export const EnvConfig = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'https://arsplatform.onrender.com',
  env: import.meta.env.MODE || 'development',
  isProduction: import.meta.env.PROD,
  isDevelopment: import.meta.env.DEV,
} as const;

export default EnvConfig;
